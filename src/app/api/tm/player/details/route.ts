/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = "https://www.transfermarkt.com";

/* -------------------- helpers: HTTP -------------------- */
function ensurePath(p?: string | null) {
  if (!p) return "/";
  if (p.startsWith("http")) return p;
  return p.startsWith("/") ? p : `/${p.replace(/^(\.\/)+/, "")}`;
}

async function fetchHtml(pathOrUrl: string, referer?: string) {
  const isAbs = /^https?:\/\//i.test(pathOrUrl);
  const url = isAbs ? pathOrUrl : `${BASE}${ensurePath(pathOrUrl)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(referer ? { Referer: referer } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} for ${url}${
        txt ? ` — ${txt.slice(0, 160)}…` : ""
      }`
    );
  }
  return res.text();
}

/* -------------------- generic table parser -------------------- */

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

function parseFirstTable(html: string): ParsedTable | null {
  const $ = cheerio.load(html);

  // Transfermarkt często ma kilka tabel; bierzemy pierwszą "pełną"
  let table = $("table.items").first();
  if (!table.length) {
    table = $("table").first();
  }
  if (!table.length) return null;

  const headers: string[] = [];
  const rows: string[][] = [];

  table.find("thead tr").first().find("th").each((_, th) => {
    const txt = $(th).text().replace(/\s+/g, " ").trim();
    headers.push(txt);
  });

  table.find("tbody tr").each((_, tr) => {
    const row: string[] = [];
    $(tr)
      .find("td")
      .each((__, td) => {
        const cell = $(td).text().replace(/\s+/g, " ").trim();
        row.push(cell);
      });
    if (row.length) rows.push(row);
  });

  if (!headers.length && !rows.length) return null;

  return { headers, rows };
}

/* -------------------- player URL generator -------------------- */

type PlayerTabKey =
  | "profile"
  | "statsCurrentSeason"
  | "statsAllSeasons"
  | "statsByCompetition"
  | "statsByClub"
  | "statsByCoach"
  | "recordAgainst"
  | "allGoals"
  | "goalsByMinute"
  | "injuryHistory"
  | "suspensionsAbsences"
  | "squadNumbers"
  | "teammates"
  | "opponents"
  | "marketValue"
  | "transfers"
  | "rumours"
  | "nationalTeam"
  | "news"
  | "achievements";

type PlayerUrls = Record<PlayerTabKey, string>;

function buildPlayerUrls(playerPath: string): {
  slug: string;
  playerId: string;
  urls: PlayerUrls;
} {
  // przykładowe ścieżki:
  // /bartosz-mrozek/profil/spieler/345452
  // /bartosz-mrozek/marktwertverlauf/spieler/345452
  const cleanPath = ensurePath(playerPath);
  const m = cleanPath.match(/^\/([^/]+)\/[^/]+\/spieler\/(\d+)/);
  if (!m) {
    throw new Error(
      `Nieoczekiwany format player_path: ${playerPath}`
    );
  }
  const slug = m[1];
  const playerId = m[2];

  const root = `/${slug}`;

  const urls: PlayerUrls = {
    profile: `${root}/profil/spieler/${playerId}`,
    statsCurrentSeason: `${root}/leistungsdaten/spieler/${playerId}`,
    statsAllSeasons: `${root}/leistungsdatendetails/spieler/${playerId}`,
    statsByCompetition: `${root}/detaillierteleistungsdaten/spieler/${playerId}`,
    statsByClub: `${root}/leistungsdatenverein/spieler/${playerId}`,
    statsByCoach: `${root}/leistungsdatentrainer/spieler/${playerId}`,
    recordAgainst: `${root}/bilanz/spieler/${playerId}`,
    allGoals: `${root}/alletore/spieler/${playerId}`,
    goalsByMinute: `${root}/torenachminute/spieler/${playerId}`,
    injuryHistory: `${root}/verletzungen/spieler/${playerId}`,
    suspensionsAbsences: `${root}/ausfaelle/spieler/${playerId}`,
    squadNumbers: `${root}/rueckennummern/spieler/${playerId}`,
    teammates: `${root}/gemeinsameSpiele/spieler/${playerId}`,
    opponents: `${root}/spieleGegeneinander/spieler/${playerId}`,
    marketValue: `${root}/marktwertverlauf/spieler/${playerId}`,
    transfers: `${root}/transfers/spieler/${playerId}`,
    rumours: `${root}/geruechte/spieler/${playerId}`,
    nationalTeam: `${root}/nationalmannschaft/spieler/${playerId}`,
    news: `${root}/news/spieler/${playerId}`,
    achievements: `${root}/erfolge/spieler/${playerId}`,
  };

  return { slug, playerId, urls };
}

/* ------------------------ GET handler ------------------------ */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    const idParam = searchParams.get("id");

    if (!path && !idParam) {
      return new Response(
        JSON.stringify({
          error:
            "Missing ?path= (np. /bartosz-mrozek/profil/spieler/345452) lub ?id=345452",
        }),
        { status: 400 }
      );
    }

    // jeśli podane samo id – zbuduj podstawowy path
    const playerPath =
      path ||
      `/spieler/profil/spieler/${encodeURIComponent(idParam as string)}`;

    const { slug, playerId, urls } = buildPlayerUrls(playerPath);

    // można ograniczyć liczbę tabów (dla wydajności) – na start bierzemy wszystkie
    const tabsToFetch: PlayerTabKey[] = [
      "profile",
      "statsCurrentSeason",
      "statsAllSeasons",
      "statsByCompetition",
      "statsByClub",
      "statsByCoach",
      "recordAgainst",
      "allGoals",
      "goalsByMinute",
      "injuryHistory",
      "suspensionsAbsences",
      "squadNumbers",
      "teammates",
      "opponents",
      "marketValue",
      "transfers",
      "rumours",
      "nationalTeam",
      "news",
      "achievements",
    ];

    const results: Array<{
      key: PlayerTabKey;
      table: ParsedTable | null;
      error?: string;
    }> = [];

    // równoległe pobieranie (uwaga na limit / throttling – w razie czego można zrobić sekwencyjnie)
    await Promise.all(
      tabsToFetch.map(async (key) => {
        const url = urls[key];
        try {
          const html = await fetchHtml(url, urls.profile);
          const table = parseFirstTable(html);
          results.push({ key, table });
        } catch (err: any) {
          results.push({
            key,
            table: null,
            error: err?.message || "Failed to fetch or parse table",
          });
        }
      })
    );

    const tables: Partial<Record<PlayerTabKey, ParsedTable | null>> = {};
    const errors: Partial<Record<PlayerTabKey, string>> = {};

    for (const r of results) {
      tables[r.key] = r.table;
      if (r.error) errors[r.key] = r.error;
    }

    return new Response(
      JSON.stringify(
        {
          slug,
          playerId,
          urls,
          tables,
          errors,
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[TM PLAYER DETAILS] Fatal error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Failed" }), {
      status: 500,
    });
  }
}
