// src/app/players/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import MyPlayersFeature from "@/features/players/MyPlayersFeature";
import type { Player, Observation } from "@/shared/types";
import { getSupabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic"; // żeby nie było statycznego prerenderu

export default function Page() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  // 1) Ładowanie graczy + obserwacji wyłącznie z Supabase
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        const [
          { data: playersData, error: playersError },
          { data: obsData, error: obsError },
        ] = await Promise.all([
          supabase.from("players").select("*").order("id", { ascending: true }),
          supabase
            .from("observations")
            .select("id, player, match, date, time, status")
            .order("created_at", { ascending: false }),
        ]);

        if (cancelled) return;

        if (playersError) {
          throw playersError;
        }
        if (obsError) {
          throw obsError;
        }

        setPlayers((playersData ?? []) as Player[]);
        setObservations((obsData ?? []) as Observation[]);
      } catch (err) {
        console.error("[players/page] Błąd ładowania z Supabase:", err);
        if (!cancelled) {
          setPlayers([]);
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

  // 2) Zmiana listy graczy → zapis do Supabase
  const handleChangePlayers = async (next: Player[]) => {
    // optymistycznie aktualizujemy UI
    setPlayers(next);

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("players")
        .upsert(next, { onConflict: "id" }); // wymaga PRIMARY KEY(id)

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error("[players/page] Błąd zapisu do Supabase:", err);
      // tu możesz dorzucić toast/alert
    }
  };

  return (
    <Suspense fallback={null}>
      <MyPlayersFeature
        players={players}
        observations={observations}
        onChangePlayers={handleChangePlayers}
        // jeśli MyPlayersFeature obsługuje loading, możesz odkomentować:
        // loading={loading}
      />
    </Suspense>
  );
}
