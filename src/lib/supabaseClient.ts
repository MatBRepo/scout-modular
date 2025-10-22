// src/lib/supabaseClient.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/** Browser-only singleton. Uses ONLY NEXT_PUBLIC_* envs. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // This blows up loudly if Vercel env vars are missing
    throw new Error(
      "Supabase misconfigured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Project → Settings → Environment Variables, then redeploy."
    );
  }

  _client = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { "x-application-name": "entrisoScouting" } },
  });
  return _client;
}
