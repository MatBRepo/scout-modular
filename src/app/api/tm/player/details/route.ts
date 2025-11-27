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

/* -------------------- generic helpers for parsing -------------------- */

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
  // “1,86m” -> 186
  if (!s) return null;
  const m = s.match(/(\d)[,\.](\d{2})\s*m/i);
  if (m) {
    const cm = parseInt(m[1] + m[2], 10);
    return Number.isFinite(cm) ? cm : null;
  }
  return parseIntLoose(s);
}

function parseDateEUtoISO(s?: string | null) {
  // “07.04.2004 (21)” -> 2004-04-07
  if (!s) return null;
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
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

/* ---------------- player profile parser (CHEERIO) ---------------- */

function parsePlayerProfile(html: string) {
  const $ = cheerio.load(html);
  const data: any = {};

  const h1 = clean($("h1").first().text());
  if (h1) data.name = h1;

  // high-res portrait if available
  const pic =
    $("img[data-src*='/portrait/'], img[src*='/portrait/']").attr("data-src") ||
    $("img[data-src*='/header/'], img[src*='/header/']").attr("data-src") ||
    $("img[src*='/portrait/']").attr("src") ||
    null;
  if (pic) data.portrait_url = pic.startsWith("http") ? pic : `${BASE}${pic}`;

  // generic label -> value extraction
  const grab = (label: string) => {
    // <tr><th>Label</th><td>Value</td>
    const th = $(`th:contains("${label}")`).first();
    if (th.length) return clean(th.next("td").text());
    // fallback search in definition lists
    const dl = $(`.data-header__list dd:contains("${label}")`).first();
    return dl.length ? clean(dl.text()) : null;
  };

  const dateOfBirth =
    $('span[itemprop="birthDate"]').attr("data-date") ||
    grab("Date of birth:");
  if (dateOfBirth) {
    data.date_of_birth = parseDateEUtoISO(dateOfBirth) || clean(dateOfBirth);
  }

  const heightText = $('span[itemprop="height"]').text() || grab("Height:");
  if (heightText) data.height_cm = parseHeightCm(heightText);

  const footText = grab("Foot:") || grab("Preferred foot:");
  if (footText) data.foot = clean(footText).toLowerCase();

  // positions, nationalities
  const mainPos = $('div:contains("Main position:")').next().text();
  if (clean(mainPos)) data.main_position = clean(mainPos);
  const otherPosItems: string[] = [];
  $('div:contains("Other position(s):")')
    .next()
    .find("li")
    .each((_, li) => {
      const t = clean($(li).text());
      if (t) otherPosItems.push(t);
    });
  if (otherPosItems.length) data.other_positions = otherPosItems;

  const nats: string[] = [];
  $(".data-header__box .data-header__items img[title]").each((_, im) => {
    const t = $(im).attr("title");
    if (t) nats.push(clean(t));
  });
  if (nats.length) data.nationalities = nats;

  // current club, agent, contract
  const currClub = grab("Current club:") || grab("Club:");
  if (currClub) data.current_club = currClub;
  const agent = grab("Player agent:");
  if (agent) data.agent = agent;
  const contract = grab("Contract expires:") || grab("Contract until:");
  if (contract) {
    data.contract_until_text = contract;
    const iso = parseDateEUtoISO(contract);
    if (iso) data.contract_until = iso;
  }

  // market value (current)
  const mv = clean(
    $(
      ".data-header__box .data-header__market-value-wrapper .data-header__market-value"
    ).text()
  );
  if (mv) data.market_value_eur = parseEuroToInt(mv);

  return data;
}

/* ---------------- player URL generator ---------------- */

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
    throw new Error(`Nieoczekiwany format player_path: ${playerPath}`);
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

    let profile: any | null = null;

    // równoległe pobieranie (uwaga na limit / throttling – w razie czego można zrobić sekwencyjnie)
    await Promise.all(
      tabsToFetch.map(async (key) => {
        const url = urls[key];
        try {
          const html = await fetchHtml(url, urls.profile);
          const table = parseFirstTable(html);

          if (key === "profile") {
            try {
              profile = parsePlayerProfile(html);
            } catch (e: any) {
              // profile parsing is best-effort; don't break whole request
              console.error(
                "[TM PLAYER DETAILS] Failed to parse profile meta:",
                e?.message || e
              );
            }
          }

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
          profile, // <--- NEW: structured meta (name, portrait, positions, MV, etc.)
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
