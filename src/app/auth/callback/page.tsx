// app/auth/callback/page.tsx
"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * Komponent wewnętrzny używający useSearchParams, co wymaga Suspense w Next.js app route
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Sprawdź PKCE (code w query lub w hash - na wypadek różnych konfiguracji)
        const code = searchParams.get("code") ||
          new URLSearchParams(window.location.hash.replace("#", "")).get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[auth/callback] PKCE exchange error:", error);
            // Jeśli błąd to "code already used" lub podobny, może sesja już jest?
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              if (!cancelled) router.replace("/players");
              return;
            }
            if (!cancelled) router.replace("/?e=oauth_exchange");
            return;
          }
          if (!cancelled) router.replace("/players");
          return;
        }

        // 2) Sprawdź Implicit flow (access_token w hash)
        const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            console.error("[auth/callback] setSession error:", error);
            if (!cancelled) router.replace("/?e=oauth_setsession");
            return;
          }
          if (!cancelled) router.replace("/players");
          return;
        }

        // 3) Błędy w URL (np. error=access_denied)
        const errorMsg = searchParams.get("error") || hashParams.get("error");
        if (errorMsg) {
          console.error("[auth/callback] OAuth error from provider:", errorMsg);
          if (!cancelled) router.replace(`/?e=oauth_provider&msg=${encodeURIComponent(errorMsg)}`);
          return;
        }

        // 4) Fallback: może sesja już jest (np. detectSessionInUrl zadziałało wcześniej)
        // Dajemy krotką chwilę na ewentualną inicjalizację klienta
        await new Promise(r => setTimeout(r, 200));
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          if (!cancelled) router.replace("/players");
          return;
        }

        // 5) Nadal nic -> spróbuj ostatni raz po dłuższej chwili, może exchange jeszcze trwa
        await new Promise(r => setTimeout(r, 1000));
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (finalSession) {
          if (!cancelled) router.replace("/players");
          return;
        }

        // 6) Pustka -> wróć na login
        if (!cancelled) {
          console.warn("[auth/callback] Brak parametrów auth i brak sesji.");
          router.replace("/?e=missing_code");
        }
      } catch (e) {
        console.error("[auth/callback] Unexpected error:", e);
        if (!cancelled) router.replace("/?e=oauth_unknown");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900 dark:border-stone-700 dark:border-t-stone-100" />
        <div className="text-sm font-medium text-stone-600 dark:text-stone-400">Finalizuję logowanie…</div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm opacity-50">Ładowanie…</div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
