// src/lib/supabaseClient.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Custom storage: cookies for sessions, localStorage for PKCE code-verifiers
const cookieStorage = {
  getItem: (key: string) => {
    if (typeof document === "undefined") return null;

    // Use localStorage for PKCE verifiers (fixing AuthApiError: invalid request)
    if (key.includes("code-verifier")) {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    }

    // Standard cookie parsing
    const nameEQ = key + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) {
        const val = c.substring(nameEQ.length, c.length);
        try {
          return decodeURIComponent(val);
        } catch (e) {
          return val;
        }
      }
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof document === "undefined") return;

    // PKCE verifiers go to localStorage
    if (key.includes("code-verifier")) {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      return;
    }

    // Sessions go to cookies (1 year)
    const date = new Date();
    date.setTime(date.getTime() + 365 * 24 * 60 * 60 * 1000);
    const expires = "; expires=" + date.toUTCString();

    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
    const secureFlag = isSecure ? "; Secure" : "";

    document.cookie = key + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax" + secureFlag;
  },
  removeItem: (key: string) => {
    if (typeof document === "undefined") return;

    // Remove from both to be safe
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);

    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
    const secureFlag = isSecure ? "; Secure" : "";
    document.cookie = key + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax" + secureFlag;
  },
};

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

    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storage: cookieStorage,
      },
    });
  }
  return client;
}

// Aliasing for compatibility during transition
export const supabase = getSupabase();
