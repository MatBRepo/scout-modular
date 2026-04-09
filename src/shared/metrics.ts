// src/shared/metrics.ts
import { getSupabase } from "@/lib/supabaseClient";

export type Metric = {
  id: string;        // uuid from DB
  key: string;       // short key, e.g. "decisions"
  label: string;     // description in UI
  enabled: boolean;  // whether to show
};

export type MetricGroupKey = "BASE" | "GK" | "DEF" | "MID" | "ATT";

export type MetricsConfig = Record<MetricGroupKey, Metric[]>;

/** Empty config – used before fetching data from Supabase */
export const EMPTY_METRICS: MetricsConfig = {
  BASE: [],
  GK: [],
  DEF: [],
  MID: [],
  ATT: [],
};

/**
 * Sync fallback – returns empty structure.
 * Used only as initialValue in useState.
 */
export function loadMetrics(): MetricsConfig {
  return EMPTY_METRICS;
}

/**
 * Main loader from Supabase – *the only* true metrics configuration.
 */
export async function syncMetricsFromSupabase(): Promise<MetricsConfig> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("obs_metrics")
      .select("id, group_key, key, label, enabled, sort_order")
      .order("group_key", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[metrics] Supabase error:", error);
      return EMPTY_METRICS;
    }

    const cfg: MetricsConfig = {
      BASE: [],
      GK: [],
      DEF: [],
      MID: [],
      ATT: [],
    };

    (data ?? []).forEach((row: any) => {
      const g = row.group_key as MetricGroupKey;
      if (!g || !(g in cfg)) return;
      cfg[g].push({
        id: row.id,
        key: row.key,
        label: row.label,
        enabled: row.enabled ?? true,
      });
    });

    return cfg;
  } catch (e) {
    console.error("[metrics] syncMetricsFromSupabase exception:", e);
    return EMPTY_METRICS;
  }
}

/* Optional helpers for future "Metrics Management" screen */

export async function upsertMetric(metric: {
  id?: string;
  group_key: MetricGroupKey;
  key: string;
  label: string;
  enabled?: boolean;
  sort_order?: number;
}) {
  const supabase = getSupabase();
  const payload = {
    group_key: metric.group_key,
    key: metric.key,
    label: metric.label,
    enabled: metric.enabled ?? true,
    sort_order: metric.sort_order ?? 0,
  };

  if (metric.id) {
    return supabase
      .from("obs_metrics")
      .update(payload)
      .eq("id", metric.id)
      .select("*")
      .single();
  } else {
    return supabase.from("obs_metrics").insert(payload).select("*").single();
  }
}

export async function deleteMetric(id: string) {
  const supabase = getSupabase();
  return supabase.from("obs_metrics").delete().eq("id", id);
}

/**
 * saveMetrics – compatible with current code:
 * takes the whole config and synchronizes it with the obs_metrics table in Supabase.
 * 
 * UI calls (setAndSave) remain unchanged – only the backend changed.
 */
export async function saveMetrics(cfg: MetricsConfig): Promise<void> {
  try {
    const supabase = getSupabase();

    // 1. Get current IDs from the database
    const { data: existing, error: existingError } = await supabase
      .from("obs_metrics")
      .select("id");

    if (existingError) {
      console.error("[metrics] saveMetrics – load existing error:", existingError);
      return;
    }

    const existingIds = new Set<string>(
      (existing ?? []).map((row: any) => row.id as string)
    );

    // 2. Flatten the new configuration to a list of rows
    const rows: {
      id: string;
      group_key: MetricGroupKey;
      key: string;
      label: string;
      enabled: boolean;
      sort_order: number;
    }[] = [];

    (Object.keys(cfg) as MetricGroupKey[]).forEach((groupKey) => {
      cfg[groupKey].forEach((m, index) => {
        rows.push({
          id: m.id,
          group_key: groupKey,
          key: m.key,
          label: m.label,
          enabled: m.enabled,
          sort_order: index,
        });
      });
    });

    const newIds = new Set<string>(rows.map((r) => r.id).filter(Boolean));

    // 3. Delete metrics that are no longer in the config
    const idsToDelete = [...existingIds].filter((id) => !newIds.has(id));
    if (idsToDelete.length) {
      await supabase.from("obs_metrics").delete().in("id", idsToDelete);
    }

    // 4. Upsert the whole list (new + existing)
    if (rows.length) {
      await supabase
        .from("obs_metrics")
        .upsert(rows, { onConflict: "id" });
    }
  } catch (e) {
    console.error("[metrics] saveMetrics exception:", e);
  }
}
