// src/lib/supabaseClient.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error(
        "Brak NEXT_PUBLIC_SUPABASE_URL albo NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local"
      );
    }

    client = createClient(url, anonKey);
  }
  return client;
}
