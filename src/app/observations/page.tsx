// src/app/observations/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import ObservationsFeature from "@/features/observations/Observations";
import type { Observation } from "@/shared/types";
import { getSupabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function ObservationsPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // 1) Ładowanie z Supabase – tylko obserwacje bieżącego użytkownika
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        // Najpierw pobieramy zalogowanego usera
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData?.user;
        if (!user) {
          // brak zalogowanego usera – nic nie ładujemy
          if (!cancelled) {
            setUserId(null);
            setObservations([]);
          }
          return;
        }

        if (cancelled) return;
        setUserId(user.id);

        // Tylko rekordy tego usera
        const { data, error } = await supabase
          .from("observations")
          .select("*")
          .eq("user_id", user.id)
          .order("id", { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        setObservations((data ?? []) as Observation[]);
      } catch (err) {
        console.error("[observations/page] Błąd ładowania z Supabase:", err);
        if (!cancelled) {
          // w razie błędu pokaż pustą listę
          setObservations([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Zapis do Supabase (bez localStorage)
  const handleChange = async (next: Observation[]) => {
    // optymistycznie aktualizujemy UI
    setObservations(next);

    if (!userId) {
      console.warn(
        "[observations/page] Brak userId – pomijam zapis do Supabase."
      );
      return;
    }

    try {
      const supabase = getSupabase();

      // Upewniamy się, że każdy rekord ma user_id bieżącego użytkownika
      const payload = (next as any[]).map((row) => ({
        ...row,
        user_id: row.user_id ?? userId,
      }));

      const { error } = await supabase
        .from("observations")
        .upsert(payload, { onConflict: "id" }); // wymagany PRIMARY KEY (id)

      if (error) throw error;
    } catch (err) {
      console.error("[observations/page] Błąd zapisu do Supabase:", err);
      // TODO: toast / komunikat w UI
    }
  };

  if (loading) {
    // możesz wrzucić spinner / skeleton
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ObservationsFeature data={observations} onChange={handleChange} />
    </Suspense>
  );
}
