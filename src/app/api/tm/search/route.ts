// src/app/api/tm/search/route.ts
import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = "https://www.transfermarkt.com";

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseEuroToInt(s?: string | null) {
  if (!s) return null;
  const raw = s.replace(/[€\s]/g, "").toLowerCase();
  if (!raw || raw === "-") return null;
  let mult = 1, num = raw;
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const url = `${BASE}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(q)}`;

  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Find the table that contains "Search results for players"
    // Usually it's the first table with class .items, or looked up by header
    let $table = $("table.items").first();

    // Ensure we are looking at players table if there are multiple
    // TM search structure varies, but usually first table.items is players if matches found.
    // Sometimes there is a header "Search results for players" before it.
    const header = $(".table-header").filter((_, el) => $(el).text().includes("players")).first();
    if (header.length) {
      $table = header.next(".responsive-table").find("table.items");
      if (!$table.length) $table = header.next("table.items");
    }

    const items: any[] = [];

    $table.find("> tbody > tr").each((_, tr) => {
      const $tr = $(tr);
      if ($tr.find("td").length < 3) return; // skip headers/empty

      // Columns in search results are unpredictable, but usually:
      // 0: Avatar (img-vat) -> .row-badge
      // 1: Name + Club + Position (.hauptlink)
      // 2: Age
      // 3: Nationality
      // 4: Market Value

      /* Avatar */
      const $avatarCell = $tr.find("td.zentriert").eq(0);
      const avatar = $avatarCell.find("img").attr("src") || $avatarCell.find("img").attr("data-src") || null;

      /* Name & ID */
      const $nameCell = $tr.find("td.hauptlink").first();
      const $nameLink = $nameCell.find("a").first();
      const name = $nameLink.text().trim();
      const href = $nameLink.attr("href") || "";
      const m = href.match(/\/spieler\/(\d+)/);
      const tm_id = m ? m[1] : null;

      if (!tm_id || !name) return;

      /* Club */
      const $clubImg = $tr.find("td.zentriert").eq(1).find("img"); // sometimes club icon is here
      const clubName = $clubImg.attr("title") || $tr.find("img.tiny_wappen").attr("title") || null;

      /* Age */
      const ageText = $tr.find("td.zentriert").eq(2).text().trim();
      const age = parseInt(ageText, 10) || null;

      /* Nationality */
      const natImgs = $tr.find("td.zentriert").eq(3).find("img.flaggenrahmen");
      const nationality = natImgs.length ? natImgs.attr("title") : null;

      /* Market Value */
      const mvText = $tr.find("td.rechts.hauptlink").text().trim();
      const mv = parseEuroToInt(mvText);

      // Try to get position (often regular text in name cell or below name)
      // TM search layout is tricky. Sometimes position is in small text.

      items.push({
        tm_id,
        name,
        current_club_name: clubName,
        age,
        nationality,
        market_value_eur: mv,
        image_url: avatar,
        profile_url: href,
        // fields required by frontend but hard to get from search list:
        position_main: null,
        height_cm: null,
        dominant_foot: null,
        first_name: null,
        last_name: null,
        date_of_birth: null
      });
    });

    // Provide default empty fields for compatibility
    const mapped = items.map(it => ({
      ...it,
      first_name: it.name.split(" ")[0],
      last_name: it.name.split(" ").slice(1).join(" "),
      date_of_birth: null,
    }));

    return NextResponse.json({ items: mapped });
  } catch (e: any) {
    console.error("TM Search Error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
