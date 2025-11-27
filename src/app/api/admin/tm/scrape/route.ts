/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import pLimit from "p-limit";

// ---- Config ----
export const runtime = "nodejs";

const BASE = "https://www.transfermarkt.com";
const COUNTRY_ID_DEFAULT = "135"; // Poland
const SEASON_DEFAULT = 2025;

// polite limits
const CONCURRENCY = 3;
const FETCH_DELAY_MS = 600;

// ---- Supabase (service) ----
// Use a service key on the server so you can upsert freely regardless of RLS.
// Add SUPABASE_SERVICE_ROLE_KEY in your env and NEVER expose it client-side.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ---- Utilities ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- helpers ---
function ensurePath(p?: string | null) {
  if (!p) return "/";
  if (p.startsWith("http")) return p;   // full URL
  return p.startsWith("/") ? p : `/${p.replace(/^(\.\/)+/, "")}`;
}

async function fetchHtml(pathOrUrl: string, referer?: string) {
  const isAbs = /^https?:\/\//i.test(pathOrUrl);
  const url = isAbs ? pathOrUrl : `${BASE}${ensurePath(pathOrUrl)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(referer ? { "Referer": referer } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}${txt ? ` — ${txt.slice(0, 160)}…` : ""}`);
  }
  return res.text();
}


function abs(path: string | undefined | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${BASE}${path}`;
}

function parseIntLoose(s?: string | null) {
  if (!s) return null;
  // "1.762" → 1762, "515" → 515
  const clean = s.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, "");
  const n = parseInt(clean, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatEU(s?: string | null) {
  if (!s) return null;
  // "24.9" or "24,9" → 24.9
  const clean = s.replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

function parseEuroToInt(s?: string | null) {
  if (!s) return null;
  // "€83.96m", "€163k", "€298.41m", "-", "€50k"
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
  // normalize 1.23 or 1,23
  num = num.replace(/\./g, "").replace(/,/g, ".");
  const f = parseFloat(num);
  if (!Number.isFinite(f)) return null;
  return Math.round(f * mult);
}

function extractFirstHref($td: cheerio.Cheerio<any>) {
  const href = $td.find("a").attr("href");
  return href || null;
}


// ---- Parsers ----

// 1) Competitions from country competitions page
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

    // name + competition code in inline-table
    const $nameCell = $(tds[0]);
    const $inline = $nameCell.find("table.inline-table td").eq(1);
    const $a = $inline.find("a").first();
    const name = $a.text().trim();
    const profile_path = $a.attr("href") || "";
    // code from .../wettbewerb/PL2
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

// --- clubs parser: also produce a kader_path we can use later ---
function parseClubs(html: string, competitionCode: string, seasonId: number) {
  const $ = cheerio.load(html);
  const rows: any[] = [];

  $("table.items > tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (tds.length < 7) return;

    const $nameCell = $(tds[1]);
    const $nameLink = $nameCell.find("a").first();
    const name = $nameLink.text().trim();
    const startseitePath = $nameLink.attr("href") || ""; // e.g. /lks-lodz/startseite/verein/256/saison_id/2025
    const profile_path = ensurePath(startseitePath);

    // try to find a direct roster link from the "Squad" count column (3rd col) — usually the <a> there points at /kader/...
    const $squadLink = $(tds[2]).find("a").first(); // e.g. /lks-lodz/kader/verein/256/saison_id/2025
    let kader_path = ensurePath($squadLink.attr("href") || "");

    // fallback: transform startseite → kader
    if (!/\/kader\/verein\/\d+/.test(kader_path)) {
      kader_path = profile_path
        .replace("/startseite/verein/", "/kader/verein/")
        .replace(/\/?$/, "");
    }
    // prefer the full layout
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
        profile_path, // startseite
        kader_path,   // full roster page we’ll fetch for players
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


// --- players parser: map by headers so both short and plus/1 layouts work ---
function parsePlayers(html: string, seasonId: number, tm_club_id: number) {
  const $ = cheerio.load(html);
  const headers = $("table.items thead th")
    .map((_, th) => $(th).text().trim().toLowerCase())
    .get();

  const idx = {
    num: headers.findIndex(h => h === "#" || h.includes("#")),
    player: headers.findIndex(h => h.includes("player")),
    dobAge: headers.findIndex(h => h.includes("date of birth")),
    nat: headers.findIndex(h => h.startsWith("nat")),
    height: headers.findIndex(h => h.includes("height")),
    foot: headers.findIndex(h => h.includes("foot")),
    joined: headers.findIndex(h => h.includes("joined")),
    signedFrom: headers.findIndex(h => h.includes("signed from")),
    contract: headers.findIndex(h => h.includes("contract")),
    mv: headers.findIndex(h => h.includes("market value")),
  };

  const rows: any[] = [];
  $("table.items > tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (!tds.length) return;

    // number
    const number =
      idx.num >= 0
        ? $(tds[idx.num]).find(".rn_nummer").text().trim() || null
        : $(tds[0]).find(".rn_nummer").text().trim() || null;

    // player cell
    const pIdx = idx.player >= 0 ? idx.player : 1;
    const $pCell = $(tds[pIdx]);
    const $nameA = $pCell.find(".hauptlink a[href*='/spieler/'], .hauptlink a[href*='/profil/spieler/']").first();
    const name = $nameA.text().trim();
    const player_path = ensurePath($nameA.attr("href") || "");
    const idm = player_path.match(/\/spieler\/(\d+)/) || player_path.match(/\/profil\/spieler\/(\d+)/);
    const tm_player_id = idm ? parseInt(idm[1], 10) : null;

    // position (second row of the inline-table)
    const position = $pCell.find("table.inline-table tr").eq(1).find("td").last().text().trim() || null;

    // age (from dobAge col) – keep simple integer, not the whole date
    let age: number | null = null;
    if (idx.dobAge >= 0) {
      const txt = $(tds[idx.dobAge]).text().trim();
      const m = txt.match(/\((\d+)\)/);
      age = m ? parseInt(m[1], 10) : null;
    }

    // nationalities
    const natIdx = idx.nat >= 0 ? idx.nat : (idx.dobAge >= 0 ? idx.dobAge + 1 : 3);
    const nationalities: string[] = [];
    $(tds[natIdx])
      .find("img[alt]")
      .each((__, im) => {
        const alt = $(im).attr("alt");
        if (alt) nationalities.push(alt.trim());
      });

    // contract
    const contractIdx = idx.contract >= 0 ? idx.contract : -1;
    const contract_until = contractIdx >= 0 ? $(tds[contractIdx]).text().trim() || null : null;

    // market value
    const mvIdx = idx.mv >= 0 ? idx.mv : (tds.length - 1);
    const market_value_eur = parseEuroToInt($(tds[mvIdx]).text().trim());

    // image
    const img = $pCell.find("img").attr("src") || $pCell.find("img").attr("data-src") || null;
    const image_url = img?.startsWith("http") ? img : (img ? `${BASE}${img}` : null);

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


// ---- Upserts ----
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

// ---- Route handler ----
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get("country") || COUNTRY_ID_DEFAULT; // "135"
    const seasonId = parseInt(searchParams.get("season") || `${SEASON_DEFAULT}`, 10);

    // 1) Country competitions page (Poland)
    const countryUrl = `/wettbewerbe/national/wettbewerbe/${countryId}`;
    const countryHtml = await fetchHtml(countryUrl);
    const competitions = parseCompetitions(countryHtml, countryId);

    await upsertCompetitions(competitions);

    // 2) For each competition, visit profile_path and read clubs table
    const limit = pLimit(CONCURRENCY);
    const compResults: { code: string; clubs: any[] }[] = [];

    for (const comp of competitions) {
      const code = comp.code as string;
      const compPath = comp.profile_path as string; // "/.../wettbewerb/PL2"
      // Ensure we hit a page that shows the clubs list (it already does on startseite)
      const compHtml = await fetchHtml(compPath);
      const clubs = parseClubs(compHtml, code, seasonId);
      await upsertClubs(clubs);
      compResults.push({ code, clubs });
      await sleep(FETCH_DELAY_MS);
    }

    // 3) For each club, go to its squad (many profile paths already contain ".../saison_id/2025")
    let playersTotal = 0;
    for (const comp of compResults) {
      for (const club of comp.clubs) {
        const tmClubId = club.tm_club_id as number;

        // Prefer the Total/Squad link patterns if present:
        // If profile_path has /startseite/verein/<id>/saison_id/<season> we can derive /kader/verein/<id>/saison_id/<season>
        let squadPath: string;
        const m = (club.profile_path as string).match(/\/startseite\/verein\/(\d+)(?:\/saison_id\/(\d+))?/);
        if (m) {
          const id = m[1];
          const season = m[2] || `${seasonId}`;
          squadPath = `/kader/verein/${id}/saison_id/${season}`;
        } else {
          // fallback just in case
          squadPath = club.profile_path;
        }

        const squadHtml = await fetchHtml(squadPath);
        const players = parsePlayers(squadHtml, seasonId, tmClubId);
        playersTotal += players.length;
        await upsertPlayers(players);
        await sleep(FETCH_DELAY_MS);
      }
    }

    return NextResponse.json({
      ok: true,
      countryId,
      seasonId,
      competitions: competitions.length,
      clubs: compResults.reduce((a, c) => a + c.clubs.length, 0),
      players: playersTotal,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Scrape failed" },
      { status: 500 }
    );
  }
}
