// src/shared/metrics.ts
import { getSupabase } from "@/lib/supabaseClient";

export type Metric = {
  id: string;        // uuid z DB
  key: string;       // krótki klucz, np. "decyzje"
  label: string;     // opis w UI
  enabled: boolean;  // czy pokazywać
};

export type MetricGroupKey = "BASE" | "GK" | "DEF" | "MID" | "ATT";

export type MetricsConfig = Record<MetricGroupKey, Metric[]>;

/** Pusty config – używany zanim dociągniemy dane z Supabase */
export const EMPTY_METRICS: MetricsConfig = {
  BASE: [],
  GK: [],
  DEF: [],
  MID: [],
  ATT: [],
};

/**
 * Sync fallback – zwraca pustą strukturę.
 * Używany tylko jako initialValue w useState.
 */
export function loadMetrics(): MetricsConfig {
  return EMPTY_METRICS;
}

/**
 * Główny loader z Supabase – *jedyna* prawdziwa konfiguracja metryk.
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

/* Opcjonalne helpery pod przyszły ekran „Zarządzanie metrykami” */

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
