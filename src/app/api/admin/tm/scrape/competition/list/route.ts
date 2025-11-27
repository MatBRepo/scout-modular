/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

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

/* ---------------- competitions (działający parser) ---------------- */

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

    // inline-table z nazwą rozgrywek
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
    const totalText = tds.eq(6).text() || tds.eq(6).find("a").text() || "";
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
    const number = clean($tr.find(".rn_nummer").first().text()) || null;

    // position – inline-table second row
    const positionText = clean(
      $playerCell.find("table.inline-table tr").eq(1).find("td").last().text()
    );
    const position = positionText || null;

    // DOB + age
    const dobAge = clean(tds.eq(2).text());
    const date_of_birth = parseDateEUtoISO(dobAge);
    const age = parseIntLoose((dobAge.match(/\((\d+)\)/)?.[1]) || "");

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

/* ---------------- Supabase admin client (cache) ---------------- */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const supabaseAdmin =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      })
    : null;

if (!supabaseAdmin) {
  console.warn(
    "[TM SCRAPER] Supabase cache disabled – missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

/* --------- cache: odczyt z tm_flat_competition_players --------- */

async function loadFromCache(country: string, season: number) {
  if (!supabaseAdmin) return null;

  const { data: rows, error } = await supabaseAdmin
    .from("tm_flat_competition_players")
    .select("*")
    .eq("country_id", country)
    .eq("season_id", season)
    .order("id", { ascending: true });

  if (error || !rows || rows.length === 0) return null;

  const compSet = new Set<string>();
  const clubSet = new Set<string>();

  for (const r of rows as any[]) {
    if (r.competition_code) compSet.add(r.competition_code);
    const clubKey = `${r.competition_code || ""}::${
      r.club_tm_id ?? r.club_name ?? ""
    }`;
    clubSet.add(clubKey);
  }

  const competitionsCount = compSet.size;
  const clubsCount = clubSet.size;
  const playersCount = rows.length;
  const downloadedAt: string | null =
    ((rows[0] as any).downloaded_at as string | null) ?? null;

  return {
    cached: true as const,
    competitionsCount,
    clubsCount,
    playersCount,
    rows: rows as FlatClubPlayerRow[],
    downloadedAt,
  };
}

/* ------------ scrap + zapis do tm_flat_competition_players ------------ */

async function scrapeAndCache(country: string, season: number) {
  const url = `${BASE}/wettbewerbe/national/wettbewerbe/${encodeURIComponent(
    country
  )}/saison_id/${season}/plus/1`;

  const html = await fetchHtml(url);
  const competitions = parseCompetitionsDetailed(html, country, season);

  if (!competitions.length) {
    throw new Error(`Brak rozgrywek dla kraju=${country}, sezon=${season}`);
  }

  const flatRows: FlatClubPlayerRow[] = [];
  const clubsSet = new Set<string>();

  for (const comp of competitions) {
    try {
      const compHtml = await fetchHtml(comp.profile_path, url);
      const clubs = parseClubsFromCompetition(
        compHtml,
        comp.code,
        comp.season_id
      );

      for (const club of clubs) {
        clubsSet.add(`${comp.code}:${club.name}`);

        try {
          if (!club.tm_club_id) continue;

          const profilePath = club.profile_path || "";
          let rosterPath: string;

          if (/\/kader\/verein\//i.test(profilePath)) {
            rosterPath = profilePath;
          } else if (/\/startseite\/verein\//i.test(profilePath)) {
            rosterPath = profilePath.replace(
              "/startseite/verein",
              "/kader/verein"
            );
          } else {
            const m = profilePath.match(
              /\/verein\/(\d+)(?:\/saison_id\/(\d+))?/i
            );
            const id = m ? m[1] : String(club.tm_club_id);
            const seasonForClub = m?.[2] || String(comp.season_id);
            rosterPath = `/kader/verein/${id}/saison_id/${seasonForClub}`;
          }

          if (!/\/plus\/1\/?$/.test(rosterPath)) {
            rosterPath = rosterPath.replace(/\/?$/, "/plus/1");
          }

          const rosterHtml = await fetchHtml(rosterPath, comp.profile_path);
          const players = parsePlayersFromRoster(
            rosterHtml,
            comp.season_id,
            club.tm_club_id!
          );

          for (const p of players) {
            flatRows.push({
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
        } catch (err: any) {
          console.error(
            "[TM SCRAPER] Błąd przy klubie",
            club.name,
            err?.message
          );
        }
      }
    } catch (err: any) {
      console.error(
        "[TM SCRAPER] Błąd przy rozgrywkach",
        comp.name,
        err?.message
      );
    }
  }

  const competitionsCount = competitions.length;
  const clubsCount = clubsSet.size;
  const playersCount = flatRows.length;
  const downloadedAt = new Date().toISOString();

  if (supabaseAdmin) {
    // wyczyść stare rekordy
    const { error: delErr } = await supabaseAdmin
      .from("tm_flat_competition_players")
      .delete()
      .eq("country_id", country)
      .eq("season_id", season);
    if (delErr) {
      console.error(
        "[tm_flat_competition_players] delete error:",
        delErr.message
      );
    }

    // insert w chunkach
    const chunkSize = 1000;
    for (let i = 0; i < flatRows.length; i += chunkSize) {
      const chunk = flatRows.slice(i, i + chunkSize);
      const { error: insErr } = await supabaseAdmin
        .from("tm_flat_competition_players")
        .insert(chunk);
      if (insErr) {
        console.error(
          "[tm_flat_competition_players] insert error:",
          insErr.message
        );
        // nie przerywam całości – dane i tak wrócą w odpowiedzi
        break;
      }
    }

    const { error: metaErr } = await supabaseAdmin
      .from("tm_cached_scrapes")
      .insert({
        country_id: country,
        season_id: season,
        rows_json: flatRows,
        competitions_count: competitionsCount,
        clubs_count: clubsCount,
        players_count: playersCount,
        downloaded_at: downloadedAt,
      });
    if (metaErr) {
      console.error("[tm_cached_scrapes] insert error:", metaErr.message);
    }
  }

  return {
    cached: false as const,
    competitionsCount,
    clubsCount,
    playersCount,
    rows: flatRows,
    downloadedAt,
  };
}

/* ------------------------ GET handler ------------------------ */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country") || "135";
    const seasonStr = searchParams.get("season") || "2025";
    const refreshParam = searchParams.get("refresh");

    const season = parseInt(seasonStr, 10);
    if (!Number.isFinite(season)) {
      return new Response(JSON.stringify({ error: "Invalid season" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const refresh =
      refreshParam === "1" ||
      refreshParam === "true" ||
      refreshParam === "yes";

    // 1) cache FIRST (jeśli nie refresh)
    if (!refresh) {
      const cached = await loadFromCache(country, season);
      if (cached) {
        return new Response(
          JSON.stringify({
            details: true,
            cached: true,
            competitionsCount: cached.competitionsCount,
            clubsCount: cached.clubsCount,
            playersCount: cached.playersCount,
            rows: cached.rows,
            downloadedAt: cached.downloadedAt,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 2) brak cache albo refresh=1 => scrap + zapis (jeśli Supabase dostępne)
    const scraped = await scrapeAndCache(country, season);

    return new Response(
      JSON.stringify({
        details: true,
        cached: scraped.cached,
        competitionsCount: scraped.competitionsCount,
        clubsCount: scraped.clubsCount,
        playersCount: scraped.playersCount,
        rows: scraped.rows,
        downloadedAt: scraped.downloadedAt,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[TM SCRAPER competition/list] Fatal error:", e);
    return new Response(
      JSON.stringify({
        error: e?.message || "Nieznany błąd TM competition/list",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}
