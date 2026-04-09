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

  // 1) Loading from Supabase – only observations of the current user
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        // First we fetch the logged in user
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData?.user;
        if (!user) {
          // no logged in user – loading nothing
          if (!cancelled) {
            setUserId(null);
            setObservations([]);
          }
          return;
        }

        if (cancelled) return;
        setUserId(user.id);

        // Only records for this user
        const { data, error } = await supabase
          .from("observations")
          .select("*")
          .eq("user_id", user.id)
          .order("id", { ascending: true });

        if (error) throw error;
        if (cancelled) return;

        setObservations((data ?? []) as Observation[]);
      } catch (err) {
        console.error("[observations/page] Error loading from Supabase:", err);
        if (!cancelled) {
          // in case of error show an empty list
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

  // 2) Save to Supabase (no localStorage)
  const handleChange = async (next: Observation[]) => {
    // optimistically updating UI
    setObservations(next);

    if (!userId) {
      console.warn(
        "[observations/page] Missing userId – skipping save to Supabase."
      );
      return;
    }

    try {
      const supabase = getSupabase();

      // Ensuring that every record has the correct user_id of the current user
      const payload = (next as any[]).map((row) => ({
        ...row,
        user_id: row.user_id ?? userId,
      }));

      const { error } = await supabase
        .from("observations")
        .upsert(payload, { onConflict: "id" }); // PRIMARY KEY (id) required

      if (error) throw error;
    } catch (err) {
      console.error("[observations/page] Error saving to Supabase:", err);
      // TODO: toast / komunikat w UI
    }
  };

  return (
    <Suspense fallback={null}>
      <ObservationsFeature
        data={observations}
        onChange={handleChange}
        loading={loading}
      />
    </Suspense>
  );
}
