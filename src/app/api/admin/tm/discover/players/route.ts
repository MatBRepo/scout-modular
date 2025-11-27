// app/api/admin/tm/discover/players/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const BASE = "https://www.transfermarkt.com";

/* ---------------- HTTP ---------------- */
async function fetchHtml(pathOrUrl: string) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} for ${url}${
        txt ? ` — ${txt.slice(0, 120)}…` : ""
      }`
    );
  }
  return res.text();
}

/* ---------------- parsing helpers ---------------- */
const clean = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

function parseIntLoose(s?: string | null) {
  if (!s) return null;
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
function parseFloatEU(s?: string | null) {
  if (!s) return null;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function parseEuroToInt(s?: string | null) {
  if (!s) return null;
  const raw = s.replace(/[€\s]/g, "").toLowerCase();
  if (!raw || raw === "-") return null;
  let mult = 1,
    num = raw;
  if (raw.endsWith("m")) {
    mult = 1_000_000;
    num = raw.slice(0, -1);
  } else if (raw.endsWith("k")) {
    mult = 1_000;
    num = raw.slice(0, -1);
  }
  const f = parseFloat(num.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(f) ? Math.round(f * mult) : null;
}
function parseHeightCm(s?: string | null) {
  if (!s) return null;
  const m = s.match(/(\d)[,\.](\d{2})\s*m/i);
  if (m) {
    const cm = parseInt(m[1] + m[2], 10);
    return Number.isFinite(cm) ? cm : null;
  }
  return parseIntLoose(s);
}
function parseDateEUtoISO(s?: string | null) {
  if (!s) return null;
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/* ---------------- competition clubs ---------------- */
function parseClubs(html: string, competitionCode: string, seasonId: number) {
  const $ = cheerio.load(html);
  const rows: any[] = [];
  $("table.items > tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (tds.length < 7) return;

    const $nameCell = $(tds[1]);
    const $a = $nameCell.find("a").first();
    const name = clean($a.text());
    const profile_path = $a.attr("href") || "";
    const idMatch = profile_path.match(/\/verein\/(\d+)/);
    const tm_club_id = idMatch ? parseInt(idMatch[1], 10) : null;

    const squad_size = parseIntLoose($(tds[2]).text());
    const avg_age = parseFloatEU($(tds[3]).text());
    const foreigners = parseIntLoose($(tds[4]).text());
    const avg_market_value_eur = parseEuroToInt($(tds[5]).text());
    const totalText = $(tds[6]).text() || $(tds[6]).find("a").text();
    const total_market_value_eur = parseEuroToInt(totalText);

    if (tm_club_id && name) {
      rows.push({
        competition_code: competitionCode,
        season_id: seasonId,
        tm_club_id,
        name,
        profile_path,
        squad_size,
        avg_age,
        foreigners,
        avg_market_value_eur,
        total_market_value_eur,
      });
    }
  });
  return rows;
}

/* ---------------- roster (plus/1) ---------------- */
function parsePlayersFromRoster(
  html: string,
  seasonId: number,
  tm_club_id: number
) {
  const $ = cheerio.load(html);
  const rows: any[] = [];

  $("table.items > tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (tds.length < 10) return;

    const number = clean($(tds[0]).find(".rn_nummer").text()) || null;

    const $playerCell = $(tds[1]);
    const img =
      $playerCell.find("img").attr("src") ||
      $playerCell.find("img").attr("data-src") ||
      null;
    const $nameA = $playerCell.find("a").first();
    const name = clean($nameA.text());
    const player_path = $nameA.attr("href") || "";
    const idm = player_path.match(/\/spieler\/(\d+)/);
    const tm_player_id = idm ? parseInt(idm[1], 10) : null;

    const position =
      clean(
        $playerCell
          .find("table.inline-table tr")
          .eq(1)
          .find("td")
          .last()
          .text()
      ) || null;

    const dobAge = clean($(tds[2]).text());
    const date_of_birth = parseDateEUtoISO(dobAge);
    const age = parseIntLoose(dobAge.match(/\((\d+)\)/)?.[1] || "");

    const natImgs = $(tds[3]).find("img");
    const nationalities: string[] = [];
    natImgs.each((_, im) => {
      const alt = $(im).attr("alt");
      if (alt) nationalities.push(clean(alt));
    });

    const height_cm = parseHeightCm(clean($(tds[4]).text()));
    const foot = clean($(tds[5]).text()) || null;

    const joined_on = parseDateEUtoISO(clean($(tds[6]).text()));
    const $signedFrom = $(tds[7]).find("a").first();
    const signed_from_name =
      clean($signedFrom.attr("title") || $signedFrom.text()) || null;
    const signed_from_path = $signedFrom.attr("href") || null;
    const signed_from_id = signed_from_path?.match(/\/verein\/(\d+)/)?.[1]
      ? parseInt(signed_from_path!.match(/\/verein\/(\d+)/)![1], 10)
      : null;

    const contract_until_text = clean($(tds[8]).text()) || null;
    const contract_until = parseDateEUtoISO(contract_until_text || undefined);

    const mvText = clean(
      ($(tds[9]).text() || $(tds[9]).find("a").text())
    );
    const market_value_eur = parseEuroToInt(mvText);

    rows.push({
      season_id: seasonId,
      tm_club_id,
      tm_player_id,
      number,
      name,
      player_path,
      position,
      age: Number.isFinite(age) ? age : null,
      nationalities,
      contract_until: contract_until_text,
      contract_until_date: contract_until || null,
      market_value_eur,
      image_url: img?.startsWith("http") ? img : img ? `${BASE}${img}` : null,
      date_of_birth: date_of_birth || null,
      height_cm,
      foot,
      joined_on,
      signed_from_name,
      signed_from_id,
      signed_from_path,
    });
  });

  return rows.filter((r) => r.tm_player_id && r.name);
}

/* ---------------- handler ---------------- */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    const seasonId = parseInt(searchParams.get("season") || "2025", 10);

    if (!path) {
      return new Response(
        JSON.stringify({ error: "Missing ?path=" }),
        { status: 400 }
      );
    }

    const compHtml = await fetchHtml(path);
    const codeMatch = path.match(/\/wettbewerb\/([^/?#]+)/i);
    const competitionCode = codeMatch ? codeMatch[1] : null;

    const clubs = parseClubs(compHtml, competitionCode || "", seasonId);

    const items: any[] = [];
    let playersTotal = 0;

    for (const club of clubs) {
      const m = (club.profile_path as string).match(
        /\/startseite\/verein\/(\d+)(?:\/saison_id\/(\d+))?/
      );
      const id = m ? m[1] : `${club.tm_club_id}`;
      const season = m?.[2] || `${seasonId}`;
      const rosterPath = `/kader/verein/${id}/saison_id/${season}/plus/1`;

      const rosterHtml = await fetchHtml(rosterPath);
      const players = parsePlayersFromRoster(
        rosterHtml,
        seasonId,
        club.tm_club_id
      );
      playersTotal += players.length;

      for (const p of players) {
        items.push({
          tm_player_id: p.tm_player_id,
          tm_club_id: club.tm_club_id,
          club_name: club.name,
          name: p.name,
          position: p.position,
          age: p.age,
          nationalities: p.nationalities,
          player_path: p.player_path,
          image_url: p.image_url,
        });
      }
    }

    return new Response(
      JSON.stringify({
        competition_code: competitionCode,
        season_id: seasonId,
        clubs_count: clubs.length,
        players_count: playersTotal,
        items,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Discover failed" }),
      { status: 500 }
    );
  }
}
