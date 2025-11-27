// src/app/api/tm/search/route.ts
import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
}

function absolutize(href?: string) {
  if (!href) return null
  return href.startsWith("http") ? href : `https://www.transfermarkt.com${href}`
}

function metersToCm(m?: string | null) {
  if (!m) return undefined
  const num = parseFloat(m.replace(",", "."))
  if (!isFinite(num)) return undefined
  return Math.round(num * 100)
}

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim()
}

// dd.mm.yyyy or dd/mm/yyyy -> yyyy-mm-dd
function toISODate(s?: string | null) {
  if (!s) return undefined
  const m = s.match(/(\d{2})[./-](\d{2})[./-](\d{4})/)
  if (!m) return undefined
  const [_, d, mo, y] = m
  return `${y}-${mo}-${d}`
}

// Extract with tolerant regexes in EN/DE
function extractProfileFields(html: string) {
  const $ = cheerio.load(html)

  // Try a reliable image first
  const ogImg = $('meta[property="og:image"]').attr("content") || undefined
  const image_url = ogImg?.startsWith("http") ? ogImg : ogImg ? `https:${ogImg}` : undefined

  const body = normalizeText($("body").text() || "")

  // Date of birth
  const dob =
    toISODate(
      (body.match(/Date of birth:\s*([\d./-]{8,10})/i)?.[1] ||
        body.match(/Geburtsdatum:\s*([\d./-]{8,10})/i)?.[1]) ?? undefined
    ) || undefined

  // Place/country of birth (best-effort, often only city is present)
  const pob =
    (body.match(/Place of birth:\s*([A-Za-zÀ-ÿ .'\-–]+)/i)?.[1] ||
      body.match(/Geburtsort:\s*([A-Za-zÀ-ÿ .'\-–]+)/i)?.[1])?.trim()

  // Height
  const height_m =
    (body.match(/Height:\s*([12][.,]\d{2})\s*m/i)?.[1] ||
      body.match(/Größe:\s*([12][.,]\d{2})\s*m/i)?.[1]) ?? null
  const height_cm = metersToCm(height_m)

  // Weight
  const weight_kg_s =
    (body.match(/Weight:\s*(\d{2,3})\s*kg/i)?.[1] ||
      body.match(/Gewicht:\s*(\d{2,3})\s*kg/i)?.[1]) ?? null
  const weight_kg = weight_kg_s ? parseInt(weight_kg_s, 10) : undefined

  // Dominant foot
  const foot =
    (body.match(/(Preferred|Strong)?\s*Foot:\s*(left|right|both)/i)?.[2] ||
      body.match(/(Beidfüßig|Links|Rechts)füßig/i)?.[1]) || undefined
  const dominant_foot =
    foot?.toLowerCase() === "links"
      ? "left"
      : foot?.toLowerCase() === "rechts"
      ? "right"
      : foot?.toLowerCase() === "beid"
      ? "both"
      : foot?.toLowerCase()

  // Main position
  const position_main =
    (body.match(/Main position:\s*([A-Za-z\- ]+)/i)?.[1] ||
      body.match(/Hauptposition:\s*([A-Za-z\- ]+)/i)?.[1])?.trim()

  // Current club (stop before typical following labels to avoid swallowing whole lines)
  const currentClubRegex =
    /Current club:\s*([A-Za-z0-9 .,'\-–&/]+?)(?=\s*(?:Joined|Contract|Most games|Youth clubs|Age|Citizenship|Player agent|Market value|Date of birth|Place of birth|Height|Weight|Foot|Main position|Second position|Nationality|Position):)/i
  const currentClubRegexDE =
    /Aktueller Verein:\s*([A-Za-z0-9 .,'\-–&/]+?)(?=\s*(?:Seit|Vertrag|Meiste Spiele|Jugendvereine|Alter|Staatsangehörigkeit|Berater|Marktwert|Geburtsdatum|Geburtsort|Größe|Gewicht|Fuß|Hauptposition|Nebenposition|Nationalität|Position):)/i
  const current_club_name =
    (body.match(currentClubRegex)?.[1] || body.match(currentClubRegexDE)?.[1])?.trim()

  // Country of birth (very best-effort): look for a flag alt text near "Place of birth"
  let country_of_birth: string | undefined
  try {
    const pobLabel =
      $("th,td,span,div")
        .filter((_, el) => /Place of birth|Geburtsort/i.test($(el).text()))
        .first()
        .closest("tr") || undefined
    const flagAlt = pobLabel?.find("img[alt]").attr("alt")
    if (flagAlt) country_of_birth = flagAlt.trim()
  } catch {}

  return {
    date_of_birth: dob,
    image_url,
    height_cm,
    weight_kg,
    dominant_foot,
    position_main,
    current_club_name,
    country_of_birth: country_of_birth || pob, // fallback to city/region text if no flag alt
  }
}

async function enrichCandidate(profile_url: string) {
  try {
    const res = await fetch(profile_url, { headers: HEADERS, cache: "no-store" })
    if (!res.ok) return {}
    const html = await res.text()
    return extractProfileFields(html)
  } catch {
    return {}
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get("q") || "").trim()
    const first = (searchParams.get("first") || "").trim()
    if (!q) {
      return NextResponse.json({ items: [] })
    }

    const query = [first, q].filter(Boolean).join(" ")
    const url = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}`

    const res = await fetch(url, { headers: HEADERS, cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream TM error ${res.status}` }, { status: 502 })
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    const seen = new Set<string>()
    const baseItems: Array<{
      tm_id?: string
      name: string
      profile_url: string
      image_url?: string | null
      date_of_birth?: string
    }> = []

    // Player profile anchors
    $("a[href*='/profil/spieler/']").each((_, a) => {
      const $a = $(a)
      const name = $a.text().trim()
      const href = $a.attr("href") || ""
      const profile_url = absolutize(href)
      if (!name || !profile_url) return
      if (seen.has(profile_url)) return
      seen.add(profile_url)

      // try to capture id
      const idMatch = profile_url.match(/spieler\/(\d+)/)
      const tm_id = idMatch?.[1]

      // image near row (fallback; will be replaced by og:image once enriched)
      let image_url: string | null = null
      const $row = $a.closest("tr")
      if ($row.length) {
        const img = $row.find("img").first().attr("src")
        image_url = img ? (img.startsWith("http") ? img : `https:${img}`) : null
      }

      // try a quick DoB from the row
      const extraText = normalizeText($row.text() || "")
      const matchDob = extraText.match(/\b(\d{2}\.\d{2}\.\d{4})\b/) // 21.08.1988
      const date_of_birth = matchDob ? toISODate(matchDob[1]) : undefined

      baseItems.push({ tm_id, name, profile_url, image_url, date_of_birth })
    })

    // Be gentle: enrich only the first N
    const N = 8
    const slice = baseItems.slice(0, N)
    const enriched = await Promise.all(
      slice.map(async (it) => {
        const extra = await enrichCandidate(it.profile_url)
        return { ...it, ...extra }
      })
    )

    // If there were more items than N, append the rest without enrichment
    const items = enriched.concat(baseItems.slice(N))

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 })
  }
}
