import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TM_BASE = process.env.TRANSFERMARKT_API_BASE || "http://localhost:8000"
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const deaccent = (s = "") => s.normalize("NFD").replace(/\p{Diacritic}/gu, "")

async function searchPlayerByName(q: string) {
  const r = await fetch(`${TM_BASE}/players/search/${encodeURIComponent(q)}`, {
    headers: { accept: "application/json" },
  })
  if (!r.ok) return []
  return r.json()
}

async function getPlayerProfile(id: string) {
  const r = await fetch(`${TM_BASE}/players/${id}/profile`, { headers: { accept: "application/json" } })
  if (!r.ok) return null
  return r.json()
}

function buildQueries(fullName: string, club?: string | null) {
  const orig = (fullName || "").trim()
  const ascii = deaccent(orig)
  const parts = ascii.split(/\s+/).filter(Boolean)

  const q = new Set<string>()
  if (orig) q.add(orig)
  if (ascii && ascii !== orig) q.add(ascii)
  if (parts.length >= 2) {
    q.add(parts.join(" "))
    q.add(`${parts.at(-1)} ${parts[0]}`)    // “Zielinski Piotr”
  }
  if (parts.length >= 1) q.add(parts.at(-1)!) // last name only
  if (club) q.add(`${ascii} ${deaccent(club)}`)

  return [...q]
}

function pickCandidate(cands: any[], name: string, dob?: string | null) {
  const norm = (s: string) => deaccent(s).toLowerCase().replace(/[^a-z0-9]/g, "")
  const needle = norm(name)
  // exact normalized
  let best = cands.find(c => norm(c?.name || c?.playerName || "") === needle)
  // contains
  if (!best) best = cands.find(c => norm(c?.name || c?.playerName || "").includes(needle))
  // DoB
  if (!best && dob) best = cands.find(c => (c?.birthDate || c?.dateOfBirth || "").startsWith(dob))
  return best || cands?.[0]
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const scope = (url.searchParams.get("scope") || "missing") as "missing" | "all"

  const baseSel = supabase
    .from("players")
    .select("id, full_name, date_of_birth, main_position, current_club_name, current_club_country, image_url, transfermarkt_player_id")
    .order("created_at", { ascending: false })

  const { data: players, error: selErr } =
    scope === "all" ? await baseSel : await baseSel.is("transfermarkt_player_id", null)

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 })
  if (!players?.length) return NextResponse.json({ scope, scanned: 0, matched: 0, updated: 0, notFound: 0 })

  let scanned = 0, matched = 0, updated = 0, notFound = 0
  const errors: Array<{ id: string, msg: string }> = []

  for (const p of players) {
    scanned++
    try {
      let results: any[] = []
      for (const q of buildQueries(p.full_name, p.current_club_name)) {
        results = await searchPlayerByName(q)
        if (Array.isArray(results) && results.length) break
        await sleep(500) // gentle throttle
      }

      if (!Array.isArray(results) || !results.length) {
        notFound++
        await supabase.from("players").update({
          tm_sync_status: "not_found",
          tm_sync_error: null,
          last_synced_at: new Date().toISOString(),
        }).eq("id", p.id)
        continue
      }

      const cand = pickCandidate(results, p.full_name, p.date_of_birth as any)
      const tmId = String(cand?.id ?? cand?.playerId ?? "").trim()
      if (!tmId) throw new Error("no candidate id")

      const profile = await getPlayerProfile(tmId)
      await sleep(300)

      const mapped: Record<string, any> = {
        transfermarkt_player_id: tmId,
        transfermarkt_url: profile?.profileUrl || cand?.profileUrl || cand?.url || null,
        image_url: profile?.image || cand?.image || p.image_url || null,
        main_position: profile?.position || profile?.mainPosition || p.main_position || null,
        current_club_name: profile?.club?.name || profile?.currentClub?.name || p.current_club_name || null,
        current_club_country: profile?.club?.country || profile?.currentClub?.country || p.current_club_country || null,
        last_synced_at: new Date().toISOString(),
        tm_sync_status: "ok",
        tm_sync_error: null,
      }

      // optional: cache raw + audit external profile
      await supabase.from("tm_players_cache").upsert({
        transfermarkt_player_id: tmId,
        profile,
        cached_at: new Date().toISOString(),
      })

      await supabase.from("external_profiles").insert({
        player_id: p.id,
        source: "transfermarkt",
        external_id: tmId,
        profile_url: mapped.transfermarkt_url,
        raw: profile,
      })

      const { error: upErr } = await supabase.from("players").update(mapped).eq("id", p.id)
      if (upErr) throw upErr

      matched++; updated++;
    } catch (e: any) {
      errors.push({ id: p.id, msg: e?.message || String(e) })
      await supabase.from("players").update({
        tm_sync_status: "error",
        tm_sync_error: e?.message || String(e),
        last_synced_at: new Date().toISOString(),
      }).eq("id", p.id)
      await sleep(600)
      continue
    }
  }

  return NextResponse.json({ scope, scanned, matched, updated, notFound, errors })
}
