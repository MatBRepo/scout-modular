// src/lib/supabaseClient.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Custom cookie storage for better persistence on iOS Safari/Chrome
const cookieStorage = {
  getItem: (key: string) => {
    if (typeof document === "undefined") return null;
    const nameEQ = key + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        const val = c.substring(nameEQ.length, c.length);
        try {
          return decodeURIComponent(val);
        } catch (e) {
          return val; // Fallback to raw if decode fails
        }
      }
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof document === "undefined") return;
    const date = new Date();
    date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();

    // Use Secure only if on HTTPS (to avoid issues on localhost)
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secureFlag = isSecure ? "; Secure" : "";

    document.cookie = key + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax" + secureFlag;
  },
  removeItem: (key: string) => {
    if (typeof document === "undefined") return;
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
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
        // storage: cookieStorage, // ✅ Temporarily disabled to debug login/PKCE issues
      },
    });
  }
  return client;
}

// Aliasing for compatibility during transition
export const supabase = getSupabase();
