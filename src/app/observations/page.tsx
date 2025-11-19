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

  // 1) Ładowanie z Supabase
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        const { data, error } = await supabase
          .from("observations")
          .select("*")
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

    try {
      const supabase = getSupabase();

      // next to tak naprawdę XO[] z ObservationsFeature (ma dodatkowe pola),
      // więc traktujemy je jako any – Supabase upsertuje pełne rekordy.
      const { error } = await supabase
        .from("observations")
        .upsert(next as any[], { onConflict: "id" }); // wymagany PRIMARY KEY (id)

      if (error) throw error;
    } catch (err) {
      console.error("[observations/page] Błąd zapisu do Supabase:", err);
      // w przyszłości można tu dorzucić toast / baner
    }
  };

  if (loading) {
    // możesz tu wrzucić skeleton / spinner, na razie prosto:
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ObservationsFeature data={observations} onChange={handleChange} />
    </Suspense>
  );
}
