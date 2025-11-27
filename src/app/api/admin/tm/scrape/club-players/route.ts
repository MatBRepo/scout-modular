import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { createClient } from "@/lib/supabase/server" // your server-side (service role) client

const ORIGIN = "https://www.transfermarkt.com"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

function abs(url?: string | null) {
  if (!url) return null
  if (url.startsWith("http")) return url
  return `${ORIGIN}${url}`
}

function textClean(s?: string | null) {
  return (s ?? "").replace(/\s+/g, " ").trim() || null
}

function parseEuro(v: string | null) {
  if (!v) return null
  // Examples: "€350k", "€1.20m", "€50k", "-" 
  const m = v.replace(/[€,\s]/g, "").toLowerCase() // "350k" | "1.20m" | "-"
  if (m === "-" || !m) return null
  if (m.endsWith("m")) return Math.round(parseFloat(m) * 1_000_000)
  if (m.endsWith("k")) return Math.round(parseFloat(m) * 1_000)
  const num = Number(m)
  return Number.isFinite(num) ? num : null
}

function parseHeightMeters(v: string | null) {
  // "1,91m" -> 1.91
  if (!v) return null
  const m = v.replace(",", ".").replace(/[^\d.]/g, "")
  const n = parseFloat(m)
  return Number.isFinite(n) ? n : null
}

function parseDateDMY(v: string | null) {
  // "30.06.2026" -> "2026-06-30"
  if (!v) return null
  const m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo}-${d}`
}

function pickImage($img: cheerio.Cheerio<any>) {
  // Prefer real src; if it's a transparent gif, use data-src.
  const src = $img.attr("src") || ""
  const data = $img.attr("data-src") || ""
  const real = src.startsWith("http") && !src.startsWith("data:") ? src : (data || null)
  if (!real) return null
  // Optionally bump quality: "portrait/medium" -> "portrait/header"
  return real.replace("/portrait/medium/", "/portrait/header/")
}

function getAgeFromCell(val: string | null) {
  // cell like: "21.03.1996 (29)"
  if (!val) return null
  const m = val.match(/\((\d+)\)/)
  return m ? Number(m[1]) : null
}

function getPlayerIdFromPath(path: string | null) {
  if (!path) return null
  const m = path.match(/\/spieler\/(\d+)/)
  return m ? Number(m[1]) : null
}

function readNationalities($td: cheerio.Cheerio<any>) {
  const list: string[] = []
  $td.find("img[title]").each((_i, el) => {
    const t = (el.attribs?.title || "").trim()
    if (t) list.push(t)
  })
  return list
}

export async function GET(req: NextRequest) {
  // Expect ?path=/arka-gdynia/kader/verein/6107/saison_id/2025/plus/1
  // and ?season_id=2025&tm_club_id=6107 (redundant but useful for keys)
  const { searchParams } = new URL(req.url)
  const path = searchParams.get("path")
  const seasonId = Number(searchParams.get("season_id"))
  const tmClubId = Number(searchParams.get("tm_club_id"))

  if (!path) return NextResponse.json({ error: "Missing ?path" }, { status: 400 })

  // Fetch the squad page
  const resp = await fetch(abs(path)!, {
    headers: {
      "user-agent": UA,
      "accept-language": "en-US,en;q=0.9",
      "accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "upgrade-insecure-requests": "1",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "referer": ORIGIN,
    },
  })

  if (!resp.ok) {
    const html = await resp.text().catch(() => "")
    return NextResponse.json(
      { error: `HTTP ${resp.status}`, snippet: html.slice(0, 300) },
      { status: resp.status }
    )
  }

  const html = await resp.text()
  const $ = cheerio.load(html)

  // Find the main players table
  const $rows = $("table.items > tbody > tr")
  if ($rows.length === 0) {
    return NextResponse.json({ error: "No player rows found" }, { status: 404 })
  }

  const players: any[] = []

  $rows.each((_i, tr) => {
    const $tr = $(tr)
    const $tds = $tr.children("td")

    if ($tds.length < 10) return

    // # (shirt)
    const number = textClean($tds.eq(0).find(".rn_nummer").text())

    // The "player" cell has an inner inline-table
    const $playerCell = $tds.eq(1)
    const $img = $playerCell.find("table.inline-table img").first()
    const imgUrl = pickImage($img)

    const $nameA = $playerCell.find("table.inline-table td.hauptlink a").first()
    const name = textClean($nameA.text())
    const playerPath = $nameA.attr("href") ? abs($nameA.attr("href")!) : null
    const tmPlayerId = getPlayerIdFromPath($nameA.attr("href") || null)

    // Position is usually the second row, second cell text
    const position = textClean(
      $playerCell.find("table.inline-table tr").eq(1).find("td").last().text()
    )

    // Date of birth / (Age)
    const dobAge = textClean($tds.eq(2).text())
    const dateOfBirth = parseDateDMY(dobAge?.split(" ")[0] || null)
    const age = getAgeFromCell(dobAge)

    // Nationalities: read titles from flag imgs
    const nationalities = readNationalities($tds.eq(3))

    // Height
    const height_m = parseHeightMeters(textClean($tds.eq(4).text()))

    // Foot
    const foot = textClean($tds.eq(5).text())

    // Joined (date)
    const joined = parseDateDMY(textClean($tds.eq(6).text()))

    // Signed from (club)
    const $signedFrom = $tds.eq(7).find("a").first()
    const signed_from_name = textClean($signedFrom.attr("title") || $signedFrom.text())
    const signed_from_path = $signedFrom.attr("href") ? abs($signedFrom.attr("href")!) : null

    // Contract until (date)
    const contract_until = parseDateDMY(textClean($tds.eq(8).text()))

    // Market value (numeric EUR)
    const mvStr = textClean($tds.eq(9).text())
    const market_value_eur = parseEuro(mvStr)

    if (!tmPlayerId || !name) return

    players.push({
      season_id: seasonId || Number((path.match(/saison_id\/(\d+)/) || [])[1] || 0) || null,
      tm_club_id: tmClubId || Number((path.match(/verein\/(\d+)/) || [])[1] || 0) || null,
      tm_player_id: tmPlayerId,
      number,
      name,
      player_path: playerPath,
      position,
      age,
      date_of_birth: dateOfBirth,
      nationalities,
      height_m,
      foot,
      joined,
      signed_from_name,
      signed_from_path,
      contract_until,
      market_value_eur,
      image_url: imgUrl,
    })
  })

  // Upsert
  const supabase = await createClient()
if (players.length) {
    const { error } = await supabase
      .from("tm_squad_players")
      .upsert(players, { onConflict: "season_id,tm_club_id,tm_player_id" })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ count: players.length, players })
}
