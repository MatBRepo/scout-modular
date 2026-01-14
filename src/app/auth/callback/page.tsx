"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/shared/supabase-client";
import LoaderOverlay from "@/shared/ui/LoaderOverlay";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // wymiana code -> session (PKCE)
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch (err) {
        console.error("[AuthCallback] exchangeCodeForSession error:", err);
      } finally {
        router.replace("/");
      }
    })();
  }, [router]);

  return <LoaderOverlay text="Kończenie logowania…" />;
}
