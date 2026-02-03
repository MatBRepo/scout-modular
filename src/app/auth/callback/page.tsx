"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = sp.get("code");
      const error = sp.get("error");
      const errorDesc = sp.get("error_description");

      if (error) {
        router.replace(`/login?e=${encodeURIComponent(error)}&d=${encodeURIComponent(errorDesc ?? "")}`);
        return;
      }

      if (!code) {
        router.replace("/login?e=missing_code");
        return;
      }

      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);

      if (exErr) {
        console.error("[auth/callback] exchange error:", exErr);
        router.replace("/login?e=oauth_exchange");
        return;
      }

      router.replace("/auth/finish");
    };

    run();
  }, [router, sp]);

  return (
    <div style={{ padding: 24 }}>
      <p>Logowanie…</p>
    </div>
  );
}
