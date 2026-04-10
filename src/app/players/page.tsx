// src/app/players/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MyPlayersFeature from "@/features/players/MyPlayersFeature";
import type { Player, Observation } from "@/shared/types";
import { getSupabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic"; // so there is no static prerender

export default function Page() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const scoutId = searchParams?.get("scoutId");

  // 1) Loading players + observations from Supabase
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        let playersQuery = supabase.from("players").select("*");
        let obsQuery = supabase.from("observations").select("*");

        if (scoutId) {
          playersQuery = playersQuery.eq("user_id", scoutId);
          obsQuery = obsQuery.eq("user_id", scoutId);
        }

        const [
          { data: playersData, error: playersError },
          { data: obsData, error: obsError },
        ] = await Promise.all([
          playersQuery.order("id", { ascending: true }),
          obsQuery.order("created_at", { ascending: false }),
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
          "[players/page] Error loading from Supabase:",
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
  }, [scoutId]);

  // 2) Player list change → save to Supabase
  const handleChangePlayers = async (next: Player[]) => {
    // optimistically updating UI
    setPlayers(next);

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("players")
        .upsert(next, { onConflict: "id" }); // requires PRIMARY KEY(id)

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error(
        "[players/page] Error saving players to Supabase:",
        err,
      );
      // TODO: toast/alert
    }
  };

  // 3) Handling quick observations (QuickObservation) → insert/update in Supabase
  const handleQuickAddObservation = async (obs: Observation) => {
    try {
      const supabase = getSupabase();

      const exists = observations.some((o) => o.id === obs.id);

      if (exists) {
        // UPDATE of existing observation (e.g. assigning to another player)
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
        // NEW observation (from QuickObservation or duplicate)
        // ignoring local id (Date.now()), letting DB generate its own
        const { id: _ignore, ...rest } = obs as any;

        const { data, error } = await supabase
          .from("observations")
          .insert(rest)
          .select()
          .single();

        if (error) throw error;

        // adding to the beginning of the list
        setObservations((prev) => [
          data as Observation,
          ...prev,
        ]);
      }
    } catch (err) {
      console.error(
        "[players/page] Error saving observation to Supabase:",
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
        loading={loading}
      />
    </Suspense>
  );
}
