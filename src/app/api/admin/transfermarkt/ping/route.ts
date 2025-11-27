// src/app/api/admin/transfermarkt/ping/route.ts
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const base = process.env.TRANSFERMARKT_API_BASE || "undefined"
  try {
    const r = await fetch(`${base}/players/search/Robert`, { headers: { accept: "application/json" } })
    const ok = r.ok
    const json = ok ? await r.json().catch(() => []) : null
    return NextResponse.json({
      base,
      ok,
      status: r.status,
      sampleCount: Array.isArray(json) ? json.length : 0,
    })
  } catch (e: any) {
    return NextResponse.json({ base, ok: false, error: e?.message || String(e) }, { status: 502 })
  }
}
