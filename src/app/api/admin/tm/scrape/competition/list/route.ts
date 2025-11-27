/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE = "https://www.transfermarkt.com";

/* -------------------- helpers: HTTP -------------------- */
function ensurePath(p?: string | null) {
  if (!p) return "/";
  if (p.startsWith("http")) return p; // full URL
  return p.startsWith("/") ? p : `/${p.replace(/^(\.\/)+/, "")}`;
}

async function fetchHtml(pathOrUrl: string, referer?: string) {
  const isAbs = /^https?:\/\//i.test(pathOrUrl);
  const url = isAbs ? pathOrUrl : `${BASE}${ensurePath(pathOrUrl)}`;

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
      `HTTP ${res.status} for ${url}${
        txt ? ` — ${txt.slice(0, 160)}…` : ""
      }`
    );
  }
  return res.text();
}

/* -------------------- helpers: parsing -------------------- */

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

  const f = parseFloat(num.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(f) ? Math.round(f * mult) : null;
}

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

const clean = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

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

/* -------------------- types -------------------- */

type CompetitionRow = {
  country_id: string;
  season_id: number;
  tier_label: string | null;
  code: string;
  name: string;
  profile_path: string;
  // aliases:
  path: string | null;
  url_path: string | null;
  href: string | null;

  clubs_count: number | null;
  players_count: number | null;
  avg_age: number | null;
  foreigners_pct: number | null;
  goals_per_match: number | null;
  forum_path: string | null;
  total_value_eur: number | null;

  // added when details=1
  clubs?: ClubRow[];
  clubs_error?: string;
};

type ClubRow = {
  competition_code: string;
  season_id: number;
  tm_club_id: number | null;
  name: string;
  profile_path: string;
  squad_size: number | null;
  avg_age: number | null;
  foreigners: number | null;
  avg_market_value_eur: number | null;
  total_market_value_eur: number | null;

  roster_path?: string | null;

  players?: PlayerRow[];
  players_error?: string;
};

type PlayerRow = {
  season_id: number;
  tm_club_id: number;
  tm_player_id: number;
  number: string | null;
  name: string;
  player_path: string;
  position: string | null;
  age: number | null;
  nationalities: string[];
  height_cm: number | null;
  foot: string | null;
  date_of_birth: string | null;
  contract_until: string | null;
};

type FlatClubPlayerRow = {
  competition_code: string;
  competition_name: string;
  country_id: string;
  season_id: number;
  tier_label: string | null;

  club_tm_id: number | null;
  club_name: string;
  club_profile_path: string;

  tm_player_id: number;
  player_name: string;
  player_path: string;

  number: string | null;
  position: string | null;
  age: number | null;
  nationalities: string[];
  height_cm: number | null;
  foot: string | null;
  date_of_birth: string | null;
  contract_until: string | null;
};

/* ---------------- competitions ---------------- */

function parseCompetitionsDetailed(
  html: string,
  countryId: string,
  seasonId: number
): CompetitionRow[] {
  const $ = cheerio.load(html);
  const rows: CompetitionRow[] = [];
  let tier: string | null = null;

  $("table.items > tbody > tr").each((_, tr) => {
    const $tr = $(tr);

    // tier separator row
    if ($tr.find("td.extrarow").length) {
      tier = $tr.text().trim().replace(/\s+/g, " ");
      return;
    }

    const tds = $tr.find("> td");
    if (!tds.length) return;

    const $nameCell = $tr.find("td.hauptlink").first();
    if (!$nameCell.length) return;

    const $inline = $nameCell.find("table.inline-table td").eq(1);
    const $a =
      $inline.find("a[href*='/wettbewerb/']").first() ||
      $nameCell.find("a[href*='/wettbewerb/']").first();
    if (!$a.length) return;

    const name = $a.text().trim();
    const profile_path = $a.attr("href") || "";
    const m = profile_path.match(/\/wettbewerb\/([^/?#]+)/i);
    const code = m ? m[1] : null;

    if (!code || !name) return;

    const clubs_count = parseIntLoose($(tds[1]).text().trim());
    const players_count = parseIntLoose($(tds[2]).text().trim());
    const avg_age = parseFloatEU($(tds[3]).text().trim());
    const foreigners_pct =
      parseFloat(
        $(tds[4]).text().trim().replace("%", "").replace(",", ".")
      ) || null;
    const goals_per_match = parseFloatEU($(tds[5]).text().trim());
    const forum_path = $(tds[6]).find("a").attr("href") || null;
    const total_value_eur = parseEuroToInt($(tds[7]).text().trim());

    rows.push({
      country_id: countryId,
      season_id: seasonId,
      tier_label: tier,
      code,
      name,
      profile_path,
      // aliases
      path: profile_path,
      url_path: profile_path,
      href: profile_path,

      clubs_count,
      players_count,
      avg_age,
      foreigners_pct,
      goals_per_match,
      forum_path,
      total_value_eur,
    });
  });

  return rows;
}

/* ---------------- clubs from competition ---------------- */

function parseClubsFromCompetition(
  html: string,
  competitionCode: string,
  seasonId: number
): ClubRow[] {
  const $ = cheerio.load(html);
  const rows: ClubRow[] = [];

  $("table.items > tbody > tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("> td");
    if (!tds.length) return;

    const $nameCell = $tr.find("td.hauptlink").first();
    if (!$nameCell.length) return;

    const $a =
      $nameCell.find("a[href*='/verein/']").first() ||
      $nameCell.find("a").first();
    if (!$a.length) return;

    const name = clean($a.text());
    const profile_path = $a.attr("href") || "";
    const idMatch = profile_path.match(/\/verein\/(\d+)/);
    const tm_club_id = idMatch ? parseInt(idMatch[1], 10) : null;

    if (!name) return;

    const squad_size = parseIntLoose(tds.eq(2).text());
    const avg_age = parseFloatEU(tds.eq(3).text());
    const foreigners = parseIntLoose(tds.eq(4).text());
    const avg_market_value_eur = parseEuroToInt(tds.eq(5).text());
    const totalText =
      tds.eq(6).text() || tds.eq(6).find("a").text() || "";
    const total_market_value_eur = parseEuroToInt(totalText);

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
  });

  return rows;
}

/* ---------------- players from roster (+1) ---------------- */

function parsePlayersFromRoster(
  html: string,
  seasonId: number,
  tm_club_id: number
): PlayerRow[] {
  const $ = cheerio.load(html);
  const rows: PlayerRow[] = [];

  $("table.items > tbody > tr").each((_, tr) => {
    const $tr = $(tr);

    const $playerCell = $tr.find("td.hauptlink").first();
    if (!$playerCell.length) return;

    const $nameA =
      $playerCell.find("a[href*='/spieler/']").first() ||
      $playerCell.find("a").first();
    if (!$nameA.length) return;

    const name = clean($nameA.text());
    const player_path = $nameA.attr("href") || "";
    const idm = player_path.match(/\/spieler\/(\d+)/);
    const tm_player_id = idm ? parseInt(idm[1], 10) : null;
    if (!tm_player_id || !name) return;

    const tds = $tr.find("> td");

    // shirt number
    const number =
      clean($tr.find(".rn_nummer").first().text()) || null;

    // position – inline-table second row
    const positionText = clean(
      $playerCell
        .find("table.inline-table tr")
        .eq(1)
        .find("td")
        .last()
        .text()
    );
    const position = positionText || null;

    // DOB + age
    const dobAge = clean(tds.eq(2).text());
    const date_of_birth = parseDateEUtoISO(dobAge);
    const age = parseIntLoose(
      (dobAge.match(/\((\d+)\)/)?.[1]) || ""
    );

    // nationalities
    const natCell = tds.eq(3);
    const nationalities: string[] = [];
    natCell.find("img").each((_, im) => {
      const alt = $(im).attr("alt");
      if (alt) nationalities.push(clean(alt));
    });

    // height
    const height_cm = parseHeightCm(clean(tds.eq(4).text()));

    // foot
    const footText = clean(tds.eq(5).text());
    const foot = footText || null;

    // contract until
    const contractText = clean(tds.eq(8).text()) || null;
    const contract_until = parseDateEUtoISO(contractText || undefined);

    rows.push({
      season_id: seasonId,
      tm_club_id,
      tm_player_id,
      number,
      name,
      player_path,
      position,
      age: Number.isFinite(age) ? (age as number) : null,
      nationalities,
      height_cm,
      foot,
      date_of_birth: date_of_birth || null,
      contract_until: contract_until || null,
    });
  });

  return rows;
}

/* ---------------- Supabase (optional cache) ---------------- */

function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRole || anon;
  if (!url || !key) {
    console.warn(
      "[TM SCRAPER] Supabase env missing – running without cache."
    );
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Table proposal (run manually in Supabase if you want cache):
 *
 * CREATE TABLE public.tm_flat_snapshots (
 *   id bigserial PRIMARY KEY,
 *   country text NOT NULL,
 *   season int NOT NULL,
 *   competitions_count int NOT NULL,
 *   clubs_count int NOT NULL,
 *   players_count int NOT NULL,
 *   rows jsonb NOT NULL,
 *   downloaded_at timestamptz NOT NULL DEFAULT now(),
 *   UNIQUE(country, season)
 * );
 */

/* ------------------------ GET handler ------------------------ */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country");
    const seasonStr = searchParams.get("season");
    const details = searchParams.get("details") === "1";
    const flat = searchParams.get("flat") === "1";
    const refresh = searchParams.get("refresh") === "1";

    if (!country || !seasonStr) {
      return new Response(
        JSON.stringify({ error: "Missing ?country= and/or ?season=" }),
        { status: 400 }
      );
    }

    const season = parseInt(seasonStr, 10);
    if (!Number.isFinite(season)) {
      return new Response(
        JSON.stringify({ error: "Invalid season" }),
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // 1) TRY CACHE (only for details=1 & flat=1 & refresh != 1)
    if (supabase && details && flat && !refresh) {
      try {
        const { data, error } = await supabase
          .from("tm_flat_snapshots")
          .select("*")
          .eq("country", country)
          .eq("season", season)
          .maybeSingle();

        if (!error && data) {
          return new Response(
            JSON.stringify({
              details: true,
              competitionsCount: data.competitions_count,
              clubsCount: data.clubs_count,
              playersCount: data.players_count,
              rows: data.rows as FlatClubPlayerRow[],
              cached: true,
              downloadedAt: data.downloaded_at,
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
      } catch (err) {
        console.warn(
          "[TM SCRAPER] Failed to read cache from tm_flat_snapshots:",
          (err as any)?.message
        );
      }
    }

    // 2) SCRAPE FRESH FROM TM
    const url = `${BASE}/wettbewerbe/national/wettbewerbe/${encodeURIComponent(
      country
    )}/saison_id/${season}/plus/1`;

    const html = await fetchHtml(url);
    const competitions = parseCompetitionsDetailed(html, country, season);

    if (!details) {
      // simple: competitions only
      return new Response(
        JSON.stringify({
          competitions,
          details: false,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // details = 1 -> load clubs + players
    for (const comp of competitions) {
      try {
        const compHtml = await fetchHtml(comp.profile_path, url);
        const clubs = parseClubsFromCompetition(
          compHtml,
          comp.code,
          comp.season_id
        );

        for (const club of clubs) {
          try {
            if (!club.tm_club_id) {
              club.players = [];
              continue;
            }

            const m = (club.profile_path as string).match(
              /\/verein\/(\d+)(?:\/saison_id\/(\d+))?/i
            );
            const id = m ? m[1] : String(club.tm_club_id);
            const seasonForClub = m?.[2] || String(comp.season_id);
            const rosterPath = `/kader/verein/${id}/saison_id/${seasonForClub}/plus/1`;
            club.roster_path = rosterPath;

            const rosterHtml = await fetchHtml(
              rosterPath,
              comp.profile_path
            );
            const players = parsePlayersFromRoster(
              rosterHtml,
              comp.season_id,
              club.tm_club_id
            );
            club.players = players;
          } catch (err: any) {
            club.players = [];
            club.players_error =
              err?.message || "Failed to load players";
          }
        }

        (comp as CompetitionRow).clubs = clubs;
      } catch (err: any) {
        (comp as CompetitionRow).clubs_error =
          err?.message || "Failed to load clubs / players";
      }
    }

    // 3) FLAT TABLE
    if (flat) {
      const rows: FlatClubPlayerRow[] = [];

      for (const comp of competitions) {
        const clubs = comp.clubs || [];
        for (const club of clubs) {
          const players = club.players || [];
          for (const p of players) {
            rows.push({
              competition_code: comp.code,
              competition_name: comp.name,
              country_id: comp.country_id,
              season_id: comp.season_id,
              tier_label: comp.tier_label,

              club_tm_id: club.tm_club_id,
              club_name: club.name,
              club_profile_path: club.profile_path,

              tm_player_id: p.tm_player_id,
              player_name: p.name,
              player_path: p.player_path,

              number: p.number,
              position: p.position,
              age: p.age,
              nationalities: p.nationalities,
              height_cm: p.height_cm,
              foot: p.foot,
              date_of_birth: p.date_of_birth,
              contract_until: p.contract_until,
            });
          }
        }
      }

      const clubsSet = new Set<string>();
      for (const comp of competitions) {
        (comp.clubs || []).forEach((club) => {
          clubsSet.add(`${comp.code}:${club.name}`);
        });
      }

      // 4) SAVE TO CACHE IF POSSIBLE
      let downloadedAt: string | null = null;

      if (supabase) {
        try {
          const nowIso = new Date().toISOString();
          const { error } = await supabase
            .from("tm_flat_snapshots")
            .upsert(
              {
                country,
                season,
                competitions_count: competitions.length,
                clubs_count: clubsSet.size,
                players_count: rows.length,
                rows,
                downloaded_at: nowIso,
              },
              { onConflict: "country,season" }
            );
          if (error) {
            console.warn(
              "[TM SCRAPER] Failed to upsert tm_flat_snapshots:",
              error.message
            );
          } else {
            downloadedAt = nowIso;
          }
        } catch (err) {
          console.warn(
            "[TM SCRAPER] Exception while upserting cache:",
            (err as any)?.message
          );
        }
      }

      return new Response(
        JSON.stringify({
          details: true,
          competitionsCount: competitions.length,
          clubsCount: clubsSet.size,
          playersCount: rows.length,
          rows,
          cached: false,
          downloadedAt,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // fallback: full tree
    return new Response(
      JSON.stringify({
        competitions,
        details: true,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    console.error("[TM SCRAPER] Fatal error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Failed" }),
      { status: 500 }
    );
  }
}
