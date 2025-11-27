/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";

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
  // aliases your UI might already use:
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

/** Płaski wiersz: rozgrywki + klub + zawodnik
 * idealny pod jedną tabelę w UI
 */
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
    if (tds.length < 8) return;

    const $nameCell = $(tds[0]);
    const $inline = $nameCell.find("table.inline-table td").eq(1);
    const $a = $inline.find("a").first();

    const name = $a.text().trim();
    const profile_path = $a.attr("href") || "";
    const m = profile_path.match(/\/wettbewerb\/([^/?#]+)/i);
    const code = m ? m[1] : null;

    if (!code || !name) return;

    const clubs_count = parseIntLoose($(tds[1]).text().trim());
    const players_count = parseIntLoose($(tds[2]).text().trim());
    const avg_age = parseFloatEU($(tds[3]).text().trim());
    // foreigners cell like "23.9 %"
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
    const tds = $(tr).find("> td");
    if (tds.length < 7) return;

    // Col 1 = club name + link (index 0 is pos)
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

    if (!name) return;

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
    const tds = $(tr).find("> td");
    if (tds.length < 10) return; // plus/1 table has many cols

    const number = clean($(tds[0]).find(".rn_nummer").text()) || null;

    // player cell (image + name + position)
    const $playerCell = $(tds[1]);
    const $nameA = $playerCell.find("a").first();
    const name = clean($nameA.text());
    const player_path = $nameA.attr("href") || "";
    const idm = player_path.match(/\/spieler\/(\d+)/);
    const tm_player_id = idm ? parseInt(idm[1], 10) : null;

    if (!tm_player_id || !name) return;

    const position =
      clean(
        $playerCell
          .find("table.inline-table tr")
          .eq(1)
          .find("td")
          .last()
          .text()
      ) || null;

    // Date of birth / Age
    const dobAge = clean($(tds[2]).text());
    const date_of_birth = parseDateEUtoISO(dobAge);
    const age = parseIntLoose((dobAge.match(/\((\d+)\)/)?.[1]) || "");

    // Nationalities
    const natImgs = $(tds[3]).find("img");
    const nationalities: string[] = [];
    natImgs.each((_, im) => {
      const alt = $(im).attr("alt");
      if (alt) nationalities.push(clean(alt));
    });

    // Height
    const height_cm = parseHeightCm(clean($(tds[4]).text()));

    // Foot
    const foot = clean($(tds[5]).text()) || null;

    // Contract
    const contract_until_text = clean($(tds[8]).text()) || null;
    const contract_until = parseDateEUtoISO(contract_until_text || undefined);

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

/* ------------------------ GET handler ------------------------ */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country");
    const seasonStr = searchParams.get("season");
    const details = searchParams.get("details") === "1"; // pobieraj kluby + zawodników
    const flat = searchParams.get("flat") === "1"; // zwróć płaską tabelę

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

    // detailed competitions table (includes season stats)
    const url = `${BASE}/wettbewerbe/national/wettbewerbe/${encodeURIComponent(
      country
    )}/saison_id/${season}/plus/1`;

    const html = await fetchHtml(url);
    const competitions = parseCompetitionsDetailed(html, country, season);

    // Jeśli nie chcemy detali, zwracamy tylko rozgrywki (jak wcześniej)
    if (!details) {
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

    // details = 1 -> doładowujemy kluby + zawodników
    for (const comp of competitions) {
      try {
        const compHtml = await fetchHtml(comp.profile_path, url);
        const clubs = parseClubsFromCompetition(
          compHtml,
          comp.code,
          comp.season_id
        );

        // for each club, load roster + players
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
            club.players_error = err?.message || "Failed to load players";
          }
        }

        (comp as CompetitionRow).clubs = clubs;
      } catch (err: any) {
        (comp as CompetitionRow).clubs_error =
          err?.message || "Failed to load clubs / players";
      }
    }

    // Jeśli flat=1 -> budujemy płaską tabelę: competition + club + player
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

      return new Response(
        JSON.stringify({
          details: true,
          competitionsCount: competitions.length,
          clubsCount: clubsSet.size,
          playersCount: rows.length,
          rows, // ← idealne pod jedną „piękną tabelę”
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Domyślnie (details=1, flat!=1) – pełne drzewko competitions -> clubs -> players
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
    return new Response(
      JSON.stringify({ error: e?.message || "Failed" }),
      { status: 500 }
    );
  }
}
