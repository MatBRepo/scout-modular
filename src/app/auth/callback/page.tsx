"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/shared/supabase-client";
import LoaderOverlay from "@/shared/ui/LoaderOverlay";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // To wywołanie m.in. sprawi, że supabase-js sparsuje #access_token z URL
    supabase.auth
      .getSession()
      .catch((err) => {
        console.error("[AuthCallback] getSession error:", err);
      })
      .finally(() => {
        // po ogarnięciu sesji przerzucamy usera do głównej części appki
        router.replace("/");
      });
  }, [router]);

  return <LoaderOverlay text="Kończenie logowania…" />;
}
