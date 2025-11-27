// app/api/admin/tm/scrape/stream/route.ts
import type { NextRequest } from "next/server"
import * as cheerio from "cheerio"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function HEAD() {
  return new Response(null, { status: 200 })
}

type SseEvent = {
  phase?: "init" | "fetch" | "parse" | "save" | "done" | "error"
  message?: string
  progress?: number // 0..1
  counts?: { comps?: number; clubs?: number; players?: number; skipped?: number }
  done?: boolean
  error?: string
}

const BASE = "https://www.transfermarkt.com"
const MAX_FETCH_RETRIES = 4
const BASE_DELAY_MS = 1200
const JITTER_MS = 800
const BETWEEN_CLUB_MS = 1300
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.transfermarkt.com/",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server: bypass RLS
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const path = (searchParams.get("path") || "").trim()
  const season = (searchParams.get("season") || "").trim()

  if (!path) return Response.json({ error: "Missing ?path=" }, { status: 400 })
  if (!season) return Response.json({ error: "Missing ?season=" }, { status: 400 })

  const isCountryIndex = /\/wettbewerbe\/national\/wettbewerbe\/\d+\/?$/.test(path)
  const isCompStartseite = /\/startseite\/wettbewerb\/[^/?#]+/i.test(path)
  const isCompCode = /\/wettbewerb\/[^/?#]+/i.test(path)

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: SseEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      const close = () => controller.close()

      ;(async () => {
        try {
          send({ phase: "init", message: "Starting…", progress: 0 })

          // Branch: Country index -> discover competitions -> process each
          if (isCountryIndex) {
            const idxUrl = new URL(path, BASE)
            send({ phase: "fetch", message: `Fetching competitions index: ${idxUrl}`, progress: 0.02 })
            const idxHtml = await fetchHtmlWithRetry(idxUrl.toString())
            const comps = extractCompetitionsFromCountry(idxHtml)

            if (!comps.length) {
              throw new Error("No competitions found on country index page")
            }

            send({
              phase: "parse",
              message: `Found ${comps.length} competitions`,
              progress: 0.05,
              counts: { comps: comps.length, clubs: 0, players: 0, skipped: 0 },
            })

            let totalClubs = 0
            let totalPlayers = 0
            let skippedClubs = 0

            // Progress slices per competition
            for (let i = 0; i < comps.length; i++) {
              const comp = comps[i]
              const sliceStart = 0.05 + (0.90 - 0.05) * (i / comps.length)
              const sliceEnd = 0.05 + (0.90 - 0.05) * ((i + 1) / comps.length)

              const {
                clubsFound,
                playersSaved,
                clubsSkipped,
              } = await scrapeOneCompetition({
                startseitePath: comp.startseitePath,
                competitionCode: comp.code,
                season,
                send,
                sliceStart,
                sliceEnd,
              })

              totalClubs += clubsFound
              totalPlayers += playersSaved
              skippedClubs += clubsSkipped
            }

            send({
              phase: "done",
              message: `Finished all competitions · clubs: ${totalClubs} · players: ${totalPlayers} · skipped clubs: ${skippedClubs}`,
              progress: 1,
              counts: { comps: comps.length, clubs: totalClubs, players: totalPlayers, skipped: skippedClubs },
              done: true,
            })
            close()
            return
          }

          // Branch: Single competition (either /startseite/wettbewerb/PL2 or /wettbewerb/PL2)
          if (isCompStartseite || isCompCode) {
            const norm = normalizeCompetitionStartseite(path)
            const competitionCode = norm.match(/\/wettbewerb\/([^/?#]+)/i)?.[1] ?? null
            if (!competitionCode) throw new Error("Could not extract competition code")

            const { clubsFound, playersSaved, clubsSkipped } = await scrapeOneCompetition({
              startseitePath: norm,
              competitionCode,
              season,
              send,
              sliceStart: 0.02,
              sliceEnd: 0.95,
            })

            send({
              phase: "done",
              message: `Finished ${competitionCode} · clubs: ${clubsFound} · players: ${playersSaved} · skipped clubs: ${clubsSkipped}`,
              progress: 1,
              counts: { comps: 1, clubs: clubsFound, players: playersSaved, skipped: clubsSkipped },
              done: true,
            })
            close()
            return
          }

          throw new Error("Unsupported path format. Pass a country index or competition URL.")
        } catch (err: any) {
          const msg = err?.message || String(err)
          send({ phase: "error", message: msg, error: msg, progress: 1, done: true })
          close()
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

/* ---------------- Core flows ---------------- */

async function scrapeOneCompetition(args: {
  startseitePath: string
  competitionCode: string
  season: string
  send: (payload: SseEvent) => void
  sliceStart: number
  sliceEnd: number
}) {
  const { startseitePath, competitionCode, season, send, sliceStart, sliceEnd } = args

  const compUrl = withSearch(new URL(startseitePath, BASE), { saison_id: season })
  send({
    phase: "fetch",
    message: `Fetching competition: ${compUrl}`,
    progress: lerp(sliceStart, sliceEnd, 0.05),
    counts: { comps: 1, clubs: 0, players: 0, skipped: 0 },
  })

  const html = await fetchHtmlWithRetry(compUrl.toString())
  const clubs = extractClubsFromCompetitionStartseite(html, season)

  if (!clubs.length) {
    throw new Error(`No clubs found on competition page: ${compUrl}`)
  }

  // Upsert clubs early (so UI shows names & links correctly)
  const now = new Date().toISOString()
  await supabase.from("tm_clubs").upsert(
    clubs.map((c) => ({
      competition_code: competitionCode,
      season_id: Number(season),
      tm_club_id: c.id,
      name: c.name,
      profile_path: c.profilePath,
      kader_path: c.kaderPath,
      squad_size: c.squadSize ?? null,
      avg_age: c.avgAge10 ?? null, // stored as tenths of a year (e.g., 24.9 => 249)
      foreigners: c.foreigners ?? null,
      avg_market_value_eur: c.avgMarketValueEur ?? null,
      total_market_value_eur: c.totalMarketValueEur ?? null,
      scraped_at: now,
    })) as any,
    { onConflict: "season_id,tm_club_id" }
  )

  send({
    phase: "parse",
    message: `Found ${clubs.length} clubs in ${competitionCode}`,
    progress: lerp(sliceStart, sliceEnd, 0.1),
    counts: { comps: 1, clubs: clubs.length, players: 0, skipped: 0 },
  })

  let doneClubs = 0
  let skippedClubs = 0
  let totalPlayers = 0

  for (const club of clubs) {
    await sleep(BETWEEN_CLUB_MS + Math.floor(Math.random() * 700))

    const pBefore = lerp(sliceStart, sliceEnd, 0.1 + 0.8 * (doneClubs / clubs.length))
    send({
      phase: "fetch",
      message: `Fetching roster: ${new URL(club.kaderPath, BASE)}`,
      progress: pBefore,
      counts: { comps: 1, clubs: doneClubs, players: totalPlayers, skipped: skippedClubs },
    })

    try {
      const rosterHtml = await fetchHtmlWithRetry(new URL(club.kaderPath, BASE).toString())
      const players = parseRosterPlayers(rosterHtml)

      if (players.length) {
        // Upsert tm_players (master)
        await supabase.from("tm_players").upsert(
          players.map((p) => ({
            tm_player_id: p.id,
            name: p.name,
            profile_path: p.profilePath,
            photo_url: p.photoUrl ?? null,
          })) as any,
          { onConflict: "tm_player_id" }
        )

        // Upsert tm_squad_players (season snapshot)
        await supabase.from("tm_squad_players").upsert(
          players.map((p) => ({
            season_id: Number(season),
            tm_club_id: club.id,
            tm_player_id: p.id,
            name: p.name,
            position: p.position ?? null,
            nationality: p.nationalities, // text[] in Supabase
            dob: p.dob ?? null,
            height_cm: p.heightCm ?? null,
            foot: p.foot ?? null,
            joined: p.joined ?? null,
            contract_end: p.contractEnd ?? null,
            market_value_eur: p.marketValueEur ?? null,
            profile_path: p.profilePath,
            photo_url: p.photoUrl ?? null,
          })) as any,
          { onConflict: "season_id,tm_club_id,tm_player_id" }
        )
      }

      totalPlayers += players.length
      doneClubs += 1

      const pAfter = lerp(sliceStart, sliceEnd, 0.1 + 0.8 * (doneClubs / clubs.length))
      send({
        phase: "parse",
        message: `Parsed ${players.length} players · ${club.name}`,
        progress: pAfter,
        counts: { comps: 1, clubs: doneClubs, players: totalPlayers, skipped: skippedClubs },
      })
    } catch (err: any) {
      skippedClubs += 1
      doneClubs += 1
      const msg = (err?.message || String(err)).slice(0, 180)
      const pAfter = lerp(sliceStart, sliceEnd, 0.1 + 0.8 * (doneClubs / clubs.length))
      send({
        phase: "error",
        message: `Skipping ${club.name}: ${msg}`,
        progress: pAfter,
        counts: { comps: 1, clubs: doneClubs, players: totalPlayers, skipped: skippedClubs },
      })
    }
  }

  // finish slice
  send({
    phase: "save",
    message: `Finished ${competitionCode}: clubs ${doneClubs} · players ${totalPlayers} · skipped clubs ${skippedClubs}`,
    progress: lerp(sliceStart, sliceEnd, 0.99),
    counts: { comps: 1, clubs: doneClubs, players: totalPlayers, skipped: skippedClubs },
  })

  return {
    clubsFound: doneClubs,
    playersSaved: totalPlayers,
    clubsSkipped: skippedClubs,
  }
}

/* ---------------- Parsers ---------------- */

function extractCompetitionsFromCountry(html: string): Array<{
  code: string
  name: string
  startseitePath: string
}> {
  const $ = cheerio.load(html)
  const comps: Array<{ code: string; name: string; startseitePath: string }> = []

  $("table.items > tbody > tr").each((_, tr) => {
    const $tr = $(tr)
    if ($tr.hasClass("extrarow")) return // skip section headers

    // Competition name cell contains inline-table with two <a>, the second is the text link
    const nameA = $tr.find("td.hauptlink table.inline-table a[href*='/startseite/wettbewerb/']").last()
    const href = nameA.attr("href") || ""
    const name = nameA.text().trim()
    const code = href.match(/\/wettbewerb\/([^/?#]+)/i)?.[1] || ""

    if (!href || !name || !code) return
    comps.push({
      code,
      name,
      startseitePath: href, // e.g. /betclic-1-liga/startseite/wettbewerb/PL2
    })
  })

  // de-dup by code
  const seen = new Set<string>()
  return comps.filter((c) => (seen.has(c.code) ? false : (seen.add(c.code), true)))
}

function extractClubsFromCompetitionStartseite(
  html: string,
  season: string
): Array<{
  id: number
  name: string
  profilePath: string
  kaderPath: string
  squadSize?: number | null
  avgAge10?: number | null
  foreigners?: number | null
  avgMarketValueEur?: number | null
  totalMarketValueEur?: number | null
}> {
  const $ = cheerio.load(html)
  const clubs: Array<{
    id: number
    name: string
    profilePath: string
    kaderPath: string
    squadSize?: number | null
    avgAge10?: number | null
    foreigners?: number | null
    avgMarketValueEur?: number | null
    totalMarketValueEur?: number | null
  }> = []

  $("table.items > tbody > tr").each((_, tr) => {
    const $tr = $(tr)
    if ($tr.hasClass("extrarow")) return

    const tds = $tr.children("td")
    if (tds.length < 3) return // need at least name + a couple metrics

    // Club name anchor lives in the 2nd cell (inline-table)
    const nameA = $(tds.get(1)).find("a[href*='/startseite/verein/']").first()
    const profilePath = nameA.attr("href") || ""
    const name = nameA.text().trim()
    const id = Number(profilePath.match(/\/verein\/(\d+)/)?.[1] || NaN)
    if (!id || !name) return

    // Kader link, or synthesize from profile
    let kaderPath =
      $tr.find("a[href*='/kader/verein/']").first().attr("href") ||
      profilePath.replace("/startseite/verein/", "/kader/verein/")
    kaderPath = ensureSeasonPlusInKaderPath(kaderPath, season)

    // Common columns (present for PL2L)
    const squadSize = toInt($(tds.get(2)).text())
    const avgAge10 = toAgeTenths($(tds.get(3)).text())
    const foreigners = toInt($(tds.get(4)).text())

    // Optional market value columns (present for some leagues like PL2)
    const avgMarketValueEur =
      tds.length > 5 ? parseMarketValue($(tds.get(5)).text().trim()) : null
    const totalMarketValueEur =
      tds.length > 6 ? parseMarketValue($(tds.get(6)).text().trim()) : null

    clubs.push({
      id,
      name,
      profilePath,
      kaderPath,
      squadSize,
      avgAge10,
      foreigners,
      avgMarketValueEur,
      totalMarketValueEur,
    })
  })

  // Fallback: sometimes TM includes a hidden .keys list with anchors
  if (!clubs.length) {
    $(".keys span").each((_, sp) => {
      const anchorHtml = $(sp).text() // this is literal "<a ...>Name</a>"
      const $a = cheerio.load(anchorHtml)("a[href*='/startseite/verein/']").first()
      const profilePath = $a.attr("href") || ""
      const name = $a.text().trim()
      const id = Number(profilePath.match(/\/verein\/(\d+)/)?.[1] || NaN)
      if (!id || !name) return
      const kaderPath = ensureSeasonPlusInKaderPath(
        profilePath.replace("/startseite/verein/", "/kader/verein/"),
        season
      )
      clubs.push({ id, name, profilePath, kaderPath })
    })
  }

  // de-dup by id
  const seen = new Set<number>()
  return clubs.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
}


/* ---------------- Utilities ---------------- */

function withSearch(u: URL, params: Record<string, string>) {
  const url = new URL(u.toString())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url
}

function normalizeCompetitionStartseite(path: string) {
  // Accept /wettbewerb/PL2 or /betclic-1-liga/startseite/wettbewerb/PL2
  if (/\/startseite\/wettbewerb\//i.test(path)) return path
  const code = path.match(/\/wettbewerb\/([^/?#]+)/i)?.[1]
  if (!code) return path
  return `/startseite/wettbewerb/${code}`
}

function ensureSeasonPlusInKaderPath(href: string, season: string) {
  let p = href
  if (!/\/kader\/verein\//.test(p)) {
    p = p.replace("/startseite/verein/", "/kader/verein/")
  }
  if (!/\/saison_id\//.test(p)) {
    p = p.replace(/\/kader\/verein\/(\d+)/, `/kader/verein/$1/saison_id/${season}`)
  } else {
    p = p.replace(/(\/saison_id\/)\d+/, `$1${season}`)
  }
  if (!/\/plus\/1/.test(p)) {
    p = p.replace(/\/?$/, "/plus/1")
  }
  return p
}

async function fetchHtmlWithRetry(url: string, attempts = MAX_FETCH_RETRIES): Promise<string> {
  let lastErr: any = null
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, cache: "no-store" })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`HTTP ${res.status} for ${url} — ${txt.slice(0, 120)}`)
      }
      return res.text()
    } catch (err) {
      lastErr = err
      const wait = BASE_DELAY_MS * Math.pow(1.7, i) + Math.floor(Math.random() * JITTER_MS)
      await sleep(wait)
    }
  }
  throw lastErr || new Error(`Failed to fetch after ${attempts} attempts: ${url}`)
}

type ParsedPlayer = {
  id: number
  name: string
  position?: string
  nationalities: string[]
  dob?: string | null
  heightCm?: number | null
  foot?: string | null
  joined?: string | null
  contractEnd?: string | null
  marketValueEur?: number | null
  profilePath: string
  photoUrl?: string | null
}

function parseRosterPlayers(html: string): ParsedPlayer[] {
  const $ = cheerio.load(html)
  const players: ParsedPlayer[] = []

  $("table.items > tbody > tr").each((_, tr) => {
    const $tr = $(tr)
    const tds = $tr.find("td")
    if (tds.length < 5) return

    // name + profile
    const posTd = $(tds.get(1))
    const nameA = posTd.find(".hauptlink a[href*='/profil/spieler/']").first()
    const name = nameA.text().trim()
    const profilePath = nameA.attr("href") || ""
    const id = Number(profilePath.match(/\/spieler\/(\d+)/)?.[1] || NaN)
    if (!name || !id) return

    const position = posTd.find("table.inline-table tr").eq(1).find("td").text().trim() || undefined

    const img = posTd.find("img").first()
    let photo = img.attr("data-src") || img.attr("src") || null
    if (photo && photo.startsWith("/")) photo = new URL(photo, BASE).toString()

    const dob = parseGermanDate($(tds.get(2)).text().trim())

    const nats: string[] = []
    $(tds.get(3)).find("img[alt]").each((_, flag) => {
      const alt = $(flag).attr("alt")?.trim()
      if (alt) nats.push(alt)
    })

    const heightCm = parseHeightCm($(tds.get(4)).text().trim())
    const foot = ($(tds.get(5)).text().trim() || null) || null
    const joined = parseGermanDate($(tds.get(6)).text().trim())
    const contractEnd = parseGermanDate($(tds.get(8)).text().trim())
    const marketValueEur = parseMarketValue($(tds.get(9)).text().trim())

    players.push({
      id,
      name,
      position,
      nationalities: nats,
      dob,
      heightCm,
      foot,
      joined,
      contractEnd,
      marketValueEur,
      profilePath,
      photoUrl: photo,
    })
  })

  return players
}

/* ---------------- Small parsers ---------------- */

function parseGermanDate(s: string): string | null {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/)
  if (!m) return null
  const [_, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

function parseHeightCm(s: string): number | null {
  const compact = s.replace(/\s/g, "")
  const m = compact.match(/(\d)[,.](\d{2})m/i)
  if (!m) return null
  const cm = Number(m[1]) * 100 + Number(m[2])
  return Number.isFinite(cm) ? cm : null
}

function parseMarketValue(s: string): number | null {
  if (!s || s === "-" || s === "—") return null
  const compact = s.replace(/\s/g, "")
  const m = compact.match(/€([\d.,]+)([mk])?/i)
  if (!m) return null
  const num = parseFloat(m[1].replace(",", "."))
  const unit = (m[2] || "").toLowerCase()
  if (unit === "m") return Math.round(num * 1_000_000)
  if (unit === "k") return Math.round(num * 1_000)
  return Math.round(num)
}

function toInt(s: string): number | null {
  const m = s.replace(/[^\d]/g, "")
  if (!m) return null
  const v = parseInt(m, 10)
  return Number.isFinite(v) ? v : null
}

function toAgeTenths(s: string): number | null {
  // "24.9 Years" -> 249
  const m = s.match(/(\d{1,2})(?:[.,](\d))?/)
  if (!m) return null
  const whole = parseInt(m[1], 10)
  const dec = m[2] ? parseInt(m[2], 10) : 0
  const val = whole * 10 + dec
  return Number.isFinite(val) ? val : null
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
