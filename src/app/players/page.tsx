// src/app/players/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import MyPlayersFeature from "@/features/players/MyPlayersFeature";
import type { Player, Observation } from "@/shared/types";
import { getSupabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic"; // żeby nie było statycznego prerenderu

const PLAYERS_KEY = "s4s.players";

// Jeśli chcesz – możesz tu wrzucić swój seed startowy
const seed: Player[] = []; // <-- opcjonalnie uzupełnij demo-zawodnikami

const initialObs: Observation[] = [
  {
    id: 1,
    player: "Jan Kowalski",
    match: "CLJ U19",
    date: "2025-05-02",
    time: "17:30",
    status: "final",
  },
  {
    id: 2,
    player: "Marco Rossi",
    match: "Sparing A",
    date: "2025-05-10",
    time: "12:00",
    status: "draft",
  },
  {
    id: 3,
    player: "Kacper Wójcik",
    match: "Śląsk U19 - Zagłębie",
    date: "2025-05-18",
    time: "11:00",
    status: "draft",
  },
];

export default function Page() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [observations] = useState<Observation[]>(initialObs);
  const [loading, setLoading] = useState(true);

  // 1) Ładowanie z Supabase (i jednorazowy seed jeśli pusto) + sync do localStorage
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .order("id", { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        if (data && data.length > 0) {
          // mamy już graczy w Supabase
          const loaded = data as Player[];
          setPlayers(loaded);
          // SYNC -> localStorage dla PlayerEditorPage
          try {
            localStorage.setItem(PLAYERS_KEY, JSON.stringify(loaded));
          } catch {
            // ignorujemy błąd localStorage
          }
        } else {
          // tabela pusta → zasiej seedem (jeśli zdefiniowany)
          const base = seed && seed.length ? seed : [];
          if (base.length) {
            const { data: inserted, error: insertError } = await supabase
              .from("players")
              .insert(base)
              .select("*");

            if (insertError) throw insertError;
            if (cancelled) return;

            const next = (inserted as Player[]) ?? base;
            setPlayers(next);
            try {
              localStorage.setItem(PLAYERS_KEY, JSON.stringify(next));
            } catch {}
          } else {
            // brak seeda – po prostu pusta lista
            setPlayers([]);
            try {
              localStorage.setItem(PLAYERS_KEY, JSON.stringify([]));
            } catch {}
          }
        }
      } catch (err) {
        console.error("[players/page] Błąd ładowania z Supabase:", err);
        if (!cancelled) {
          // awaryjnie przynajmniej pokaż seed w pamięci
          setPlayers(seed);
          try {
            localStorage.setItem(PLAYERS_KEY, JSON.stringify(seed));
          } catch {}
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Zmiana listy graczy → zapis do Supabase + localStorage
  const handleChangePlayers = async (next: Player[]) => {
    // optymistycznie aktualizujemy UI
    setPlayers(next);

    // SYNC -> localStorage (żeby PlayerEditorPage widział aktualną listę)
    try {
      localStorage.setItem(PLAYERS_KEY, JSON.stringify(next));
    } catch {
      // ignorujemy błędy storage
    }

    // zapis do Supabase
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
      // tu możesz dodać toast/alert
    }
  };

  return (
    <Suspense fallback={null}>
      <MyPlayersFeature
        players={players}
        observations={observations}
        onChangePlayers={handleChangePlayers}
        // jeśli MyPlayersFeature ma props `loading`, możesz go dodać:
        // loading={loading}
      />
    </Suspense>
  );
}
