// src/app/api/admin/tm/scrape/run/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

/* =========================
   Config & singletons
========================= */
const BASE = "https://www.transfermarkt.com";
const DEFAULT_COUNTRY = "135"; // Poland
const DEFAULT_SEASON = 2025;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // NOTE: service role key required server-side
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/* =========================
   Small utils
========================= */
function ensurePath(p?: string | null) {
  if (!p) return "/";
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith("/") ? p : `/${p.replace(/^(\.\/)+/, "")}`;
}

async function fetchHtml(pathOrUrl: string, referer?: string) {
  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${BASE}${ensurePath(pathOrUrl)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(referer ? { Referer: referer } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} for ${url}${txt ? ` — ${txt.slice(0, 160)}…` : ""}`
    );
  }
  return res.text();
}

function parseIntLoose(s?: string | null) {
  if (!s) return null;
  const clean = s.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, "");
  const n = parseInt(clean, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatEU(s?: string | null) {
  if (!s) return null;
  const clean = s.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

function parseEuroToInt(s?: string | null) {
  if (!s) return null;
  const raw = s.replace(/[€\s]/g, "").toLowerCase();
  if (!raw || raw === "-") return null;

  let mult = 1;
  let num = raw;

  if (raw.endsWith("m")) {
    mult = 1_000_000;
    num = raw.slice(0, -1);
  } else if (raw.endsWith("k")) {
    mult = 1_000;
    num = raw.slice(0, -1);
  }

  num = num.replace(/\./g, "").replace(/,/g, ".");
  const f = parseFloat(num);
  if (!Number.isFinite(f)) return null;
  return Math.round(f * mult);
}

function extractFirstHref($td: cheerio.Cheerio<any>) {
  const href = $td.find("a").attr("href");
  return href || null;
}

/* =========================
   Parsers
========================= */
// 1) Country competitions
function parseCompetitions(html: string, countryId: string) {
  const $ = cheerio.load(html);
  const rows: any[] = [];
  let currentTier: string | null = null;

  $("table.items > tbody > tr").each((_, tr) => {
    const $tr = $(tr);
    if ($tr.find("td.extrarow").length) {
      currentTier = $tr.text().trim().replace(/\s+/g, " ");
      return;
    }
    const tds = $tr.find("> td");
    if (tds.length < 5) return;

    const $nameCell = $(tds[0]);
    const $inline = $nameCell.find("table.inline-table td").eq(1);
    const $a = $inline.find("a").first();
    const name = $a.text().trim();
    const profile_path = $a.attr("href") || "";

    let code: string | null = null;
    const m = profile_path.match(/\/wettbewerb\/([^/?#]+)/i);
    if (m) code = m[1];

    const clubs = parseIntLoose($(tds[1]).text().trim());
    const players = parseIntLoose($(tds[2]).text().trim());
    const forum_path = extractFirstHref($(tds[3]));
    const total_value_eur = parseEuroToInt($(tds[4]).text().trim());

    if (code && name) {
      rows.push({
        country_id: countryId,
        tier_label: currentTier,
        code,
        name,
        profile_path,
        clubs_count: clubs,
        players_count: players,
        forum_path,
        total_value_eur,
      });
    }
  });

  return rows;
}

// 2) Clubs within a competition
function parseClubs(html: string, competitionCode: string, seasonId: number) {
  const $ = cheerio.load(html);
  const rows: any[] = [];

  $("table.items > tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (tds.length < 7) return;

    const $nameCell = $(tds[1]);
    const $nameLink = $nameCell.find("a").first();
    const name = $nameLink.text().trim();
    const startseitePath = $nameLink.attr("href") || ""; // /.../startseite/verein/256/saison_id/2025
    const profile_path = ensurePath(startseitePath);

    // Try direct roster link (kader)
    const $squadLink = $(tds[2]).find("a").first(); // /.../kader/verein/256/saison_id/2025
    let kader_path = ensurePath($squadLink.attr("href") || "");
    if (!/\/kader\/verein\/\d+/.test(kader_path)) {
      kader_path = profile_path
        .replace("/startseite/verein/", "/kader/verein/")
        .replace(/\/?$/, "");
    }
    if (!/\/plus\/1\/?$/.test(kader_path)) {
      kader_path = `${kader_path}/plus/1`;
    }

    const m = profile_path.match(/\/verein\/(\d+)/);
    const tm_club_id = m ? parseInt(m[1], 10) : null;

    const squad_size = parseIntLoose($(tds[2]).text().trim());
    const avg_age = parseFloatEU($(tds[3]).text().trim());
    const foreigners = parseIntLoose($(tds[4]).text().trim());
    const avg_market_value_eur = parseEuroToInt($(tds[5]).text().trim());
    const total_market_value_eur = parseEuroToInt($(tds[6]).text().trim());

    if (tm_club_id && name) {
      rows.push({
        competition_code: competitionCode,
        season_id: seasonId,
        tm_club_id,
        name,
        profile_path,
        kader_path,
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

// 3) Squad players for a club
function parsePlayers(html: string, seasonId: number, tm_club_id: number) {
  const $ = cheerio.load(html);
  const headers = $("table.items thead th")
    .map((_, th) => $(th).text().trim().toLowerCase())
    .get();

  const idx = {
    num: headers.findIndex((h) => h === "#" || h.includes("#")),
    player: headers.findIndex((h) => h.includes("player")),
    dobAge: headers.findIndex((h) => h.includes("date of birth")),
    nat: headers.findIndex((h) => h.startsWith("nat")),
    height: headers.findIndex((h) => h.includes("height")),
    foot: headers.findIndex((h) => h.includes("foot")),
    joined: headers.findIndex((h) => h.includes("joined")),
    signedFrom: headers.findIndex((h) => h.includes("signed from")),
    contract: headers.findIndex((h) => h.includes("contract")),
    mv: headers.findIndex((h) => h.includes("market value")),
  };

  const rows: any[] = [];
  $("table.items > tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (!tds.length) return;

    const number =
      idx.num >= 0
        ? $(tds[idx.num]).find(".rn_nummer").text().trim() || null
        : $(tds[0]).find(".rn_nummer").text().trim() || null;

    const pIdx = idx.player >= 0 ? idx.player : 1;
    const $pCell = $(tds[pIdx]);
    const $nameA = $pCell
      .find(".hauptlink a[href*='/spieler/'], .hauptlink a[href*='/profil/spieler/']")
      .first();
    const name = $nameA.text().trim();
    const player_path = ensurePath($nameA.attr("href") || "");
    const idm =
      player_path.match(/\/spieler\/(\d+)/) ||
      player_path.match(/\/profil\/spieler\/(\d+)/);
    const tm_player_id = idm ? parseInt(idm[1], 10) : null;

    const position = $pCell
      .find("table.inline-table tr")
      .eq(1)
      .find("td")
      .last()
      .text()
      .trim() || null;

    let age: number | null = null;
    if (idx.dobAge >= 0) {
      const txt = $(tds[idx.dobAge]).text().trim();
      const m = txt.match(/\((\d+)\)/);
      age = m ? parseInt(m[1], 10) : null;
    }

    const natIdx = idx.nat >= 0 ? idx.nat : idx.dobAge + 1;
    const nationalities: string[] = [];
    $(tds[natIdx])
      .find("img[alt]")
      .each((__, im) => {
        const alt = $(im).attr("alt");
        if (alt) nationalities.push(alt.trim());
      });

    const contractIdx = idx.contract >= 0 ? idx.contract : -1;
    const contract_until =
      contractIdx >= 0 ? $(tds[contractIdx]).text().trim() || null : null;

    const mvIdx = idx.mv >= 0 ? idx.mv : tds.length - 1;
    const market_value_eur = parseEuroToInt($(tds[mvIdx]).text().trim());

    const img =
      $pCell.find("img").attr("src") ||
      $pCell.find("img").attr("data-src") ||
      null;
    const image_url = img?.startsWith("http") ? img : img ? `${BASE}${img}` : null;

    if (tm_player_id && name) {
      rows.push({
        season_id: seasonId,
        tm_club_id,
        tm_player_id,
        number,
        name,
        player_path,
        position,
        age,
        nationalities,
        contract_until,
        market_value_eur,
        image_url,
      });
    }
  });

  return rows;
}

/* =========================
   Upserts
========================= */
async function upsertCompetitions(rows: any[]) {
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("tm_competitions")
    .upsert(rows, { onConflict: "country_id,code" });
  if (error) throw error;
  return rows.length;
}

async function upsertClubs(rows: any[]) {
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("tm_clubs")
    .upsert(rows, { onConflict: "competition_code,season_id,tm_club_id" });
  if (error) throw error;
  return rows.length;
}

async function upsertPlayers(rows: any[]) {
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("tm_squad_players")
    .upsert(rows, { onConflict: "season_id,tm_club_id,tm_player_id" });
  if (error) throw error;
  return rows.length;
}

/* =========================
   Route (non-streaming)
========================= */
export async function POST(req: Request) {
  try {
    const { country = DEFAULT_COUNTRY, season = DEFAULT_SEASON } =
      (await req.json().catch(() => ({}))) as {
        country?: string;
        season?: number;
      };

    // 1) competitions
    const countryUrl = `/wettbewerbe/national/wettbewerbe/${country}`;
    const countryHtml = await fetchHtml(countryUrl);
    const competitions = parseCompetitions(countryHtml, String(country));
    const nComp = await upsertCompetitions(competitions);

    // 2) clubs for each competition
    let allClubs: any[] = [];
    for (const comp of competitions) {
      const compHtml = await fetchHtml(comp.profile_path);
      const clubs = parseClubs(compHtml, comp.code, Number(season));
      await upsertClubs(clubs);
      allClubs = allClubs.concat(clubs);
    }
    const nClubs = allClubs.length;

    // 3) players across all clubs
    let nPlayers = 0;
    for (const club of allClubs) {
      // derive /kader/ path if not already
      let squadPath: string;
      const m = (club.profile_path as string).match(
        /\/startseite\/verein\/(\d+)(?:\/saison_id\/(\d+))?/
      );
      if (m) {
        const id = m[1];
        const seasonId = m[2] || `${season}`;
        squadPath = `/kader/verein/${id}/saison_id/${seasonId}`;
      } else {
        squadPath = club.kader_path || club.profile_path;
      }

      const squadHtml = await fetchHtml(squadPath);
      const players = parsePlayers(squadHtml, Number(season), club.tm_club_id);
      await upsertPlayers(players);
      nPlayers += players.length;
    }

    return NextResponse.json({
      ok: true,
      country,
      season,
      competitions: nComp,
      clubs: nClubs,
      players: nPlayers,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
