"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/shared/supabase-client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Finalizuję logowanie…");

  useEffect(() => {
    const run = async () => {
      const code = params.get("code");
      const error = params.get("error");
      const errorDesc = params.get("error_description");

      if (error) {
        setMsg("Błąd logowania: " + (errorDesc || error));
        // możesz przekierować na login z parametrem
        router.replace(`/login?e=${encodeURIComponent(error)}`);
        return;
      }

      if (!code) {
        // jeśli nie ma code – to znaczy, że redirect nie poszedł jak trzeba
        router.replace("/login?e=missing_code");
        return;
      }

      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);

      if (exErr) {
        console.error("[auth/callback] exchange error:", exErr);
        router.replace("/login?e=oauth_exchange");
        return;
      }

      // po sukcesie
      router.replace("/auth/finish"); // albo "/"
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm opacity-80">{msg}</div>
    </div>
  );
}
