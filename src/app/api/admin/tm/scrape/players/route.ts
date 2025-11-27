// app/api/admin/tm/scrape/players/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from "cheerio";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

/* ---------------- helpers jak w stream ---------------- */
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

/* ---------------- player profile ---------------- */
function parsePlayerProfile(html: string) {
  const $ = cheerio.load(html);
  const data: any = {};

  const h1 = clean($("h1").first().text());
  if (h1) data.name = h1;

  const pic =
    $("img[data-src*='/portrait/'], img[src*='/portrait/']").attr("data-src") ||
    $("img[data-src*='/header/'], img[src*='/header/']").attr("data-src") ||
    $("img[src*='/portrait/']").attr("src") ||
    null;
  if (pic) data.portrait_url = pic.startsWith("http") ? pic : `${BASE}${pic}`;

  const grab = (label: string) => {
    const th = $(`th:contains("${label}")`).first();
    if (th.length) return clean(th.next("td").text());
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
  $('.data-header__box .data-header__items img[title]').each((_, im) => {
    const t = $(im).attr("title");
    if (t) nats.push(clean(t));
  });
  if (nats.length) data.nationalities = nats;

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
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict });
  if (error) throw error;
}

/* ---------------- build global_players row ---------------- */
function buildGlobalPlayerRow(
  p: any,
  club: { tm_club_id: number; name: string },
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

type IncomingPlayer = {
  tm_player_id: number;
  tm_club_id: number;
  club_name: string;
  name: string;
  position: string | null;
  age: number | null;
  nationalities: string[];
  player_path: string;
  image_url: string | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const seasonId = parseInt(body?.season || "2025", 10);
    const players: IncomingPlayer[] = body?.players || [];

    if (!Array.isArray(players) || !players.length) {
      return NextResponse.json(
        { error: "Brak zawodników w payloadzie" },
        { status: 400 }
      );
    }

    const results: { tm_player_id: number; ok: boolean; error?: string }[] =
      [];

    for (const p of players) {
      if (!p.tm_player_id || !p.player_path) {
        results.push({
          tm_player_id: p.tm_player_id,
          ok: false,
          error: "Brak tm_player_id lub player_path",
        });
        continue;
      }

      try {
        const profileHtml = await fetchHtml(p.player_path);
        const profile = parsePlayerProfile(profileHtml);
        if (!profile.portrait_url && p.image_url) {
          profile.portrait_url = p.image_url;
        }

        await upsert(
          "tm_players_cache",
          [
            {
              transfermarkt_player_id: String(p.tm_player_id),
              profile,
              market_value: null,
            },
          ],
          "transfermarkt_player_id"
        );

        const club = {
          tm_club_id: p.tm_club_id,
          name: p.club_name,
        };

        const globalRow = buildGlobalPlayerRow(
          p,
          club,
          seasonId,
          profile
        );

        await upsert("global_players", [globalRow], "key");

        results.push({ tm_player_id: p.tm_player_id, ok: true });
      } catch (e: any) {
        results.push({
          tm_player_id: p.tm_player_id,
          ok: false,
          error: e?.message || "Scrape failed",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Scrape players failed" },
      { status: 500 }
    );
  }
}
