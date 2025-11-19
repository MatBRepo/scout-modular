// src/shared/ratings.ts
import { getSupabase } from "@/lib/supabaseClient";

export type RatingGroupKey = "GEN" | "GK" | "DF" | "MF" | "FW" | string;

export type RatingAspect = {
  id: string;          // uuid z tabeli
  key: string;         // np. "phys_attrs"
  label: string;       // np. "Atrybuty fizyczne (1–5)"
  tooltip?: string | null;
  enabled: boolean;
  sort_order: number;
  groupKey: RatingGroupKey;
};

export type RatingsConfig = RatingAspect[];

export const EMPTY_RATINGS: RatingsConfig = [];

/** Sync fallback – używany jako initialValue w useState. */
export function loadRatings(): RatingsConfig {
  return EMPTY_RATINGS;
}

/** Główne pobranie konfiguracji ocen z Supabase. */
export async function syncRatingsFromSupabase(): Promise<RatingsConfig> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("player_rating_aspects")
      .select("id, key, label, tooltip, enabled, sort_order, group_key")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[ratings] Supabase error:", error);
      return EMPTY_RATINGS;
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      tooltip: row.tooltip,
      enabled: row.enabled ?? true,
      sort_order: row.sort_order ?? 0,
      groupKey: (row.group_key as RatingGroupKey) ?? "GEN",
    }));
  } catch (e) {
    console.error("[ratings] syncRatingsFromSupabase exception:", e);
    return EMPTY_RATINGS;
  }
}

/** Na przyszłość – edycja konfiguracji z UI. */
export async function saveRatings(cfg: RatingsConfig) {
  const supabase = getSupabase();
  const payload = cfg.map((a) => ({
    id: a.id,
    key: a.key,
    label: a.label,
    tooltip: a.tooltip ?? null,
    enabled: a.enabled,
    sort_order: a.sort_order ?? 0,
    group_key: a.groupKey ?? "GEN",
  }));

  const { data, error } = await supabase
    .from("player_rating_aspects")
    .upsert(payload, { onConflict: "id" })
    .select("*");

  if (error) {
    console.error("[ratings] saveRatings Supabase error:", error);
  }
  return { data, error };
}

export function slugRatingKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export function safeRatingId(a?: RatingAspect): string {
  if (a?.id) return a.id;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
