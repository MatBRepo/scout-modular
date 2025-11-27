/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const BASE = "https://www.transfermarkt.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* -------- lazy Supabase client (safer for Vercel) -------- */

let _supabase: SupabaseClient | null = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL; // fallback if you used different name
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  _supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

/* ---------------- SSE helpers ---------------- */

const encoder = new TextEncoder();

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

function send(
  controller: ReadableStreamDefaultController<Uint8Array>,
  payload: any
) {
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
  );
}

function ping(controller: ReadableStreamDefaultController<Uint8Array>) {
  controller.enqueue(encoder.encode(`: ping\n\n`));
}

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
const clean = (s?: string | null) =>
  (s ?? "").replace(/\s+/g, " ").trim();

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

/* ---------------- competition clubs from /startseite/wettbewerb/PL2 ---------------- */

function parseClubs(html: string, competitionCode: string, seasonId: number) {
  const $ = cheerio.load(html);
  const rows: any[] = [];
  $("table.items > tbody > tr").each((_, tr) => {
    const tds = $(tr).find("> td");
    if (tds.length < 7) return;

    // Col 0/1 = club name + link
    const $nameCell = $(tds[1]);
    const $a = $nameCell.find("a").first();
    const name = clean($a.text());
    const profile_path = $a.attr("href") || "";
    const idMatch = profile_path.match(/\/verein\/(\d+)/);
    const tm_club_id = idMatch ? parseInt(idMatch[1], 10) : null;

    // Stats columns
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
    if (tds.length < 10) return; // plus/1 table has many cols

    const number = clean($(tds[0]).find(".rn_nummer").text()) || null;

    // player cell (image + name + position)
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

    // Date of birth / Age
    const dobAge = clean($(tds[2]).text());
    const date_of_birth = parseDateEUtoISO(dobAge);
    const age = parseIntLoose(dobAge.match(/\((\d+)\)/)?.[1] || "");

    // Nationalities
    const natImgs = $(tds[3]).find("img");
    const nationalities: string[] = [];
    natImgs.each((_, im) => {
      const alt = $(im).attr("alt");
      if (alt) nationalities.push(clean(alt));
    });

    // Height, Foot
    const height_cm = parseHeightCm(clean($(tds[4]).text()));
    const foot = clean($(tds[5]).text()) || null;

    // Joined, Signed from
    const joined_on = parseDateEUtoISO(clean($(tds[6]).text()));
    const $signedFrom = $(tds[7]).find("a").first();
    const signed_from_name =
      clean($signedFrom.attr("title") || $signedFrom.text()) || null;
    const signed_from_path = $signedFrom.attr("href") || null;
    const signed_from_id = signed_from_path?.match(/\/verein\/(\d+)/)?.[1]
      ? parseInt(signed_from_path!.match(/\/verein\/(\d+)/)![1], 10)
      : null;

    // Contract
    const contract_until_text = clean($(tds[8]).text()) || null;
    const contract_until = parseDateEUtoISO(contract_until_text || undefined); // best-effort

    // Market value
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

      // new from plus/1:
      date_of_birth: date_of_birth || null,
      height_cm,
      foot,
      joined_on,
      signed_from_name,
      signed_from_id,
      signed_from_path,
    });
  });

  // only keep valid players
  return rows.filter((r) => r.tm_player_id && r.name);
}

/* ---------------- player profile ---------------- */

function parsePlayerProfile(html: string) {
  const $ = cheerio.load(html);
  const data: any = {};

  const h1 = clean($("h1").first().text());
  if (h1) data.name = h1;

  // high-res portrait if available
  const pic =
    $("img[data-src*='/portrait/'], img[src*='/portrait/']").attr(
      "data-src"
    ) ||
    $("img[data-src*='/header/'], img[src*='/header/']").attr(
      "data-src"
    ) ||
    $("img[src*='/portrait/']").attr("src") ||
    null;
  if (pic) data.portrait_url = pic.startsWith("http") ? pic : `${BASE}${pic}`;

  // generic label -> value extraction
  const grab = (label: string) => {
    // look for a <tr><th>Label</th><td>Value</td>
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
    data.date_of_birth =
      parseDateEUtoISO(dateOfBirth) || clean(dateOfBirth);
  }

  const heightText =
    $('span[itemprop="height"]').text() || grab("Height:");
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
  $('.data-header__box .data-header__items img[title]').each(
    (_, im) => {
      const t = $(im).attr("title");
      if (t) nats.push(clean(t));
    }
  );
  if (nats.length) data.nationalities = nats;

  // current club, agent, contract
  const currClub = grab("Current club:") || grab("Club:");
  if (currClub) data.current_club = currClub;
  const agent = grab("Player agent:");
  if (agent) data.agent = agent;
  const contract =
    grab("Contract expires:") || grab("Contract until:");
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

/* ---------------- db helpers ---------------- */

async function upsert(table: string, rows: any[], onConflict: string) {
  if (!rows.length) return;
  const supabase = getSupabase();
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw error;
}

/**
 * Build row for public.global_players
 */
function buildGlobalPlayerRow(
  p: any,
  club: any,
  seasonId: number,
  profile: any | null
) {
  const fullName: string = p.name || profile?.name || "";
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ") || null;

  const primaryNat =
    (profile?.nationalities?.[0] as string | undefined) ||
    (Array.isArray(p.nationalities) ? p.nationalities[0] : undefined) ||
    null;

  const birthDate =
    (profile?.date_of_birth as string | undefined) ||
    (p.date_of_birth as string | undefined) ||
    null;

  const photo =
    (profile?.portrait_url as string | undefined) ||
    (p.image_url as string | undefined) ||
    null;

  const key = `tm:${p.tm_player_id}`;
  const ext_id = String(p.tm_player_id);

  const metaTm = {
    tm_player_id: p.tm_player_id,
    tm_club_id: club.tm_club_id,
    tm_club_name: club.name,
    season_id: seasonId,
    player_path: p.player_path,
    image_url: p.image_url,
    nationalities: profile?.nationalities || p.nationalities || [],
    height_cm: profile?.height_cm ?? p.height_cm ?? null,
    foot: profile?.foot ?? p.foot ?? null,
    market_value_eur:
      profile?.market_value_eur ?? p.market_value_eur ?? null,
    contract_until_text:
      profile?.contract_until_text ?? p.contract_until ?? null,
  };

  const sourcesEntry = {
    source: "tm",
    ext_id,
    club: club.name,
    tm_club_id: club.tm_club_id,
    season_id: seasonId,
    href: p.player_path,
  };

  return {
    key,
    name: fullName,
    first_name: firstName || null,
    last_name: lastName,
    birth_date: birthDate,
    pos: p.position || profile?.main_position || "UNK",
    age: Number.isFinite(p.age) ? p.age : null,
    photo,
    club: club.name,
    nationality: primaryNat,
    source: "tm",
    ext_id,
    sources: [sourcesEntry],
    meta: { tm: metaTm },
    added_at: new Date().toISOString(),
  };
}

/* ---------------- handler ---------------- */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  const seasonId = parseInt(searchParams.get("season") || "2025", 10);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`: connected\n\n`));
      send(controller, {
        phase: "init",
        message: "Starting…",
        progress: 0,
      });

      const hb = setInterval(() => ping(controller), 15000);

      const finish = (err?: string) => {
        try {
          send(controller, { done: true, error: err || undefined });
        } catch {}
        clearInterval(hb);
        try {
          controller.close();
        } catch {}
      };

      try {
        // ensure Supabase env is present early (nice error if missing)
        getSupabase();

        if (!path) throw new Error("Missing ?path=");

        // derive competition code from path
        const codeMatch = path.match(/\/wettbewerb\/([^/?#]+)/i);
        const competitionCode = codeMatch ? codeMatch[1] : null;
        if (!competitionCode)
          throw new Error("Could not parse competition code from path");

        // 1) clubs from competition page
        const compHtml = await fetchHtml(path);
        const clubs = parseClubs(compHtml, competitionCode, seasonId);

        await upsert(
          "tm_clubs",
          clubs,
          "competition_code,season_id,tm_club_id"
        );

        send(controller, {
          phase: "clubs",
          message: `Found ${clubs.length} clubs`,
          progress: 0.2,
          counts: { clubs: clubs.length },
        });

        // 2) players per club (+ profile details)
        const expectedPlayers = Math.max(
          1,
          clubs.reduce((a, c) => a + (c.squad_size || 0), 0)
        );
        let playersSeen = 0;

        for (const club of clubs) {
          // Build roster path with plus/1 to expose more columns
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

          // upsert basic squad rows
          await upsert(
            "tm_squad_players",
            players,
            "season_id,tm_club_id,tm_player_id"
          );
          playersSeen += players.length;

          // fetch & cache detailed player profiles (gentle rate)
          for (const p of players) {
            try {
              const profileHtml = await fetchHtml(p.player_path);
              const profile = parsePlayerProfile(profileHtml);
              // keep the best portrait we find
              if (!profile.portrait_url && p.image_url)
                profile.portrait_url = p.image_url;

              // 2a) cache raw TM profile
              await upsert(
                "tm_players_cache",
                [
                  {
                    transfermarkt_player_id: String(
                      p.tm_player_id
                    ),
                    profile,
                    market_value: null,
                  },
                ],
                "transfermarkt_player_id"
              );

              // 2b) upsert into global_players (source = tm)
              const globalRow = buildGlobalPlayerRow(
                p,
                club,
                seasonId,
                profile
              );
              await upsert("global_players", [globalRow], "key");

              await sleep(180); // be gentle
            } catch {
              // ignore single profile failures
              await sleep(120);
            }
          }

          const progressVal = Math.min(
            1,
            0.2 + 0.8 * (playersSeen / expectedPlayers)
          );
          send(controller, {
            phase: "players",
            message: `${club.name}: ${players.length} players scraped (+ profiles)`,
            progress: progressVal,
            counts: { players: playersSeen },
            last: { type: "club", name: club.name },
          });
          await sleep(200);
        }

        send(controller, {
          phase: "done",
          message: "Scrape finished",
          progress: 1,
        });
        finish();
      } catch (e: any) {
        send(controller, {
          phase: "error",
          message: e?.message || "Scrape failed",
          progress: 1,
        });
        finish(e?.message || "Scrape failed");
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
