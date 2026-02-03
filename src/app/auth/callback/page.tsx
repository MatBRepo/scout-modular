// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/shared/supabase-client";

function getHashParams() {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash?.replace(/^#/, "") || "";
  const params = new URLSearchParams(hash);
  const out: Record<string, string> = {};
  params.forEach((v, k) => (out[k] = v));
  return out;
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) PKCE flow: ?code=...
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[auth/callback] exchangeCodeForSession error:", error);
            if (!cancelled) router.replace(`/login?e=oauth_exchange`);
            return;
          }
          if (!cancelled) router.replace("/players");
          return;
        }

        // 2) Implicit flow: #access_token=...&refresh_token=...
        const hash = getHashParams();
        const access_token = hash["access_token"];
        const refresh_token = hash["refresh_token"];

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            console.error("[auth/callback] setSession error:", error);
            if (!cancelled) router.replace(`/login?e=oauth_setsession`);
            return;
          }
          if (!cancelled) router.replace("/players");
          return;
        }

        // 3) Fallback: może sesja już jest
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          if (!cancelled) router.replace("/players");
          return;
        }

        // 4) Nadal nic -> wróć na login z info
        if (!cancelled) router.replace("/login?e=missing_code");
      } catch (e) {
        console.error("[auth/callback] unexpected:", e);
        if (!cancelled) router.replace("/login?e=oauth_unknown");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm opacity-80">Finalizuję logowanie…</div>
    </div>
  );
}
