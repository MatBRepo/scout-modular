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

  // 1) Ładowanie graczy + obserwacji z Supabase
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        const [
          { data: playersData, error: playersError },
          { data: obsData, error: obsError },
        ] = await Promise.all([
          supabase
            .from("players")
            .select("*")
            .order("id", { ascending: true }),
          supabase
            .from("observations")
            .select("*") // pełne dane, żeby MyPlayersFeature miał dostęp do players[], user_id itd.
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
        console.error(
          "[players/page] Błąd ładowania z Supabase:",
          err,
        );
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
      console.error(
        "[players/page] Błąd zapisu graczy do Supabase:",
        err,
      );
      // TODO: toast/alert
    }
  };

  // 3) Obsługa szybkich obserwacji (QuickObservation) → insert/update w Supabase
  const handleQuickAddObservation = async (obs: Observation) => {
    try {
      const supabase = getSupabase();

      const exists = observations.some((o) => o.id === obs.id);

      if (exists) {
        // UPDATE istniejącej obserwacji (np. przypisanie do innego zawodnika)
        const { id, ...rest } = obs as any;

        const { data, error } = await supabase
          .from("observations")
          .update(rest)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        setObservations((prev) =>
          prev.map((o) =>
            o.id === id ? (data as Observation) : o,
          ),
        );
      } else {
        // NOWA obserwacja (z QuickObservation lub duplikat)
        // ignorujemy lokalne id (Date.now()), pozwalamy DB wygenerować swoje
        const { id: _ignore, ...rest } = obs as any;

        const { data, error } = await supabase
          .from("observations")
          .insert(rest)
          .select()
          .single();

        if (error) throw error;

        // dodajemy na początek listy
        setObservations((prev) => [
          data as Observation,
          ...prev,
        ]);
      }
    } catch (err) {
      console.error(
        "[players/page] Błąd zapisu obserwacji w Supabase:",
        err,
      );
      // TODO: toast/alert
    }
  };

  return (
    <Suspense fallback={null}>
      <MyPlayersFeature
        players={players}
        observations={observations}
        onChangePlayers={handleChangePlayers}
        onQuickAddObservation={handleQuickAddObservation}
        // jeśli w przyszłości chcesz, możesz dodać prop `loading`
        // loading={loading}
      />
    </Suspense>
  );
}
