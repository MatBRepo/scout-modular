// src/lib/supabaseClient.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function resolveAppEnv(): "prod" | "dev" {
  const explicit = process.env.NEXT_PUBLIC_APP_ENV?.toLowerCase();
  if (explicit === "prod" || explicit === "production") return "prod";
  if (explicit === "dev" || explicit === "development" || explicit === "local") return "dev";

  const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV?.toLowerCase();
  if (vercel === "production") return "prod";
  if (vercel === "preview" || vercel === "development") return "dev";

  if (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.hostname)) {
    return "dev";
  }
  return "prod";
}

function readPublicSupabaseEnv() {
  const bucket = resolveAppEnv();
  const url =
    (bucket === "dev" ? process.env.NEXT_PUBLIC_SUPABASE_URL_DEV : process.env.NEXT_PUBLIC_SUPABASE_URL_PROD) ||
    process.env.NEXT_PUBLIC_SUPABASE_URL; // legacy fallback

  const anon =
    (bucket === "dev"
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD) ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // legacy fallback

  return { url, anon, bucket };
}

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const { url, anon, bucket } = readPublicSupabaseEnv();

  // 🔒 Always guard: never call createClient with missing values
  if (!url || !anon) {
    throw new Error(
      [
        `Supabase public envs missing for "${bucket}".`,
        `Define one of the following pairs:`,
        `  DEV:  NEXT_PUBLIC_SUPABASE_URL_DEV + NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV`,
        `  PROD: NEXT_PUBLIC_SUPABASE_URL_PROD + NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD`,
        `or legacy (both envs shared):`,
        `  NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY`,
        ``,
        `Tip: .env.local at project root, then restart dev server.`,
      ].join("\n")
    );
  }

  _client = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { "x-application-name": "entrisoScouting" } },
  });
  return _client;
}
