import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TM_BASE = process.env.TRANSFERMARKT_API_BASE || "http://localhost:8000"
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const norm = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "")

type SearchResult = {
  id: string
  name: string
  position?: string | null
  club?: { id?: string; name?: string | null } | null
  age?: number | null
  nationalities?: string[]
  marketValue?: number | null
}

const POS_MAP: Record<string, string> = {
  "goalkeeper": "GK",
  "centre-back": "CB",
  "center-back": "CB",
  "right-back": "RB",
  "left-back": "LB",
  "right wing-back": "RWB",
  "right wing back": "RWB",
  "left wing-back": "LWB",
  "left wing back": "LWB",
  "defensive midfield": "DM",
  "central midfield": "CM",
  "attacking midfield": "AM",
  "right winger": "RW",
  "left winger": "LW",
  "second striker": "CF",
  "centre-forward": "CF",
  "center-forward": "CF",
  "striker": "ST",
  // short forms that may come from search results
  "cf": "CF",
  "st": "ST",
  "rw": "RW",
  "lw": "LW",
  "cm": "CM",
  "am": "AM",
  "dm": "DM",
  "rb": "RB",
  "lb": "LB",
  "cb": "CB",
  "gk": "GK",
}
function mapPosition(input?: string | null): string | null {
  if (!input) return null
  const k = norm(input).replace(/-/g, " ")
  return POS_MAP[k] ?? input // fall back to original if unknown
}

function parseDOBFromDescription(desc?: string | null): string | null {
  if (!desc) return null
  // looks like: "* 21.08.1988" (also tolerate 21/08/1988)
  const m = desc.match(/\*\s*(\d{2})[./-](\d{2})[./-](\d{4})/)
  if (!m) return null
  const [ , dd, mm, yyyy ] = m
  return `${yyyy}-${mm}-${dd}` // ISO
}

async function tmSearchPlayers(q: string, page = 1) {
  const url = `${TM_BASE}/players/search/${encodeURIComponent(q)}?page_number=${page}`
  const r = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" })
  if (!r.ok) throw new Error(`TM search ${r.status}`)
  return r.json() as Promise<{ results: SearchResult[] }>
}

async function tmGetProfile(id: string) {
  const r = await fetch(`${TM_BASE}/players/${id}/profile`, {
    headers: { accept: "application/json" }, cache: "no-store",
  })
  if (!r.ok) throw new Error(`TM profile ${id} ${r.status}`)
  return r.json()
}

function pickCandidate(results: SearchResult[], q: string) {
  const target = norm(q)
  let best = results.find(r => norm(r.name) === target)
  if (!best) best = results.find(r => norm(r.name).includes(target))
  if (!best) best = results.find(r => (r.club?.name || "").toLowerCase() !== "retired")
  return best ?? results[0]
}

async function upsertFromProfile(supabase: any, profile: any, cand?: SearchResult) {
  const tmId = String(profile?.id ?? cand?.id ?? "")
  const fullName: string | null = profile?.name || cand?.name || null
  const dateOfBirth: string | null = parseDOBFromDescription(profile?.description)
  if (!fullName || !dateOfBirth) {
    return { error: "Missing name or date_of_birth from Transfermarkt (parsed from description)" }
  }

  const mainPos = mapPosition(profile?.position?.main ?? cand?.position ?? null)
  const mapped = {
    full_name: fullName,
    date_of_birth: dateOfBirth, // NOT NULL in your schema
    transfermarkt_player_id: tmId || null,
    transfermarkt_url: profile?.url ?? null,
    image_url: profile?.imageUrl ?? null,
    main_position: mainPos,
    dominant_foot: profile?.foot ?? null,
    height_cm: typeof profile?.height === "number" ? profile.height : null,
    country_of_birth: profile?.placeOfBirth?.country ?? null,
    current_club_name: profile?.club?.name ?? cand?.club?.name ?? null,
    contract_until: profile?.club?.contractExpires ?? null, // already ISO yyyy-MM-dd
    last_synced_at: new Date().toISOString(),
    tm_sync_status: "ok",
    tm_sync_error: null,
  }

  let playerId: string | null = null
  let imported = 0
  let matched = 0

  if (tmId) {
    const { data: existing, error: selErr } = await supabase
      .from("players")
      .select("id")
      .eq("transfermarkt_player_id", tmId)
      .maybeSingle()
    if (selErr) return { error: selErr.message }

    if (existing?.id) {
      const { error: upErr } = await supabase.from("players").update(mapped).eq("id", existing.id)
      if (upErr) return { error: upErr.message }
      playerId = existing.id
      matched = 1
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("players")
        .insert(mapped)
        .select("id")
        .single()
      if (insErr) return { error: insErr.message }
      playerId = ins?.id ?? null
      imported = 1
    }
  } else {
    // fallback insert w/o tmId (not expected here but safe)
    const { data: ins, error: insErr } = await supabase
      .from("players")
      .insert(mapped)
      .select("id")
      .single()
    if (insErr) return { error: insErr.message }
    playerId = ins?.id ?? null
    imported = 1
  }

  // raw snapshot
  if (playerId) {
// AFTER
try {
  await supabase.from("external_profiles").insert({
    player_id: playerId,
    source: "transfermarkt",
    external_id: tmId || null,
    profile_url: profile?.url ?? null,
    raw: profile,
  })
} catch (_) {
  // ignore snapshot failure
}

try {
  await supabase
    .from("tm_players_cache")
    .upsert(
      {
        transfermarkt_player_id: tmId || "",
        profile,
        market_value: profile?.marketValue != null ? { eur: profile.marketValue } : null,
      },
      { onConflict: "transfermarkt_player_id" }
    )
} catch (_) {
  // ignore cache failure
}
  }

  const { data: updated } = await supabase
    .from("players")
    .select("id, full_name, image_url, transfermarkt_url, main_position, current_club_name, current_club_country")
    .eq("id", playerId)
    .maybeSingle()

  return { imported, matched, player: updated ?? null }
}

async function handle(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch {}
  const url = new URL(req.url)
  const q = String(body?.q ?? url.searchParams.get("q") ?? "").trim()
  const tmIdExplicit = String(body?.tm_id ?? url.searchParams.get("tm_id") ?? "").trim()
  const page = Number(body?.page ?? url.searchParams.get("page") ?? 1) || 1

  try {
    let profile: any
    let cand: SearchResult | undefined

    if (tmIdExplicit) {
      profile = await tmGetProfile(tmIdExplicit)
    } else {
      if (!q) return NextResponse.json({ error: "Missing 'q' (player name)" }, { status: 400 })
      const res = await tmSearchPlayers(q, page)
      const results = Array.isArray(res?.results) ? res.results : []
      if (!results.length) return NextResponse.json({ imported: 0, matched: 0, player: null })
      cand = pickCandidate(results, q)
      const tmId = String(cand?.id ?? "")
      if (!tmId) return NextResponse.json({ error: "No candidate id" }, { status: 400 })
      profile = await tmGetProfile(tmId)
    }

    await sleep(250)
    const outcome = await upsertFromProfile(supabase, profile, cand)
    if ((outcome as any).error) return NextResponse.json(outcome, { status: 400 })
    return NextResponse.json(outcome)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Import failed" }, { status: 502 })
  }
}

export async function POST(req: Request) { return handle(req) }
export async function GET(req: Request)  { return handle(req) }
