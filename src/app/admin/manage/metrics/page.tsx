// src/app/settings/metrics/page.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabaseClient";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  ChevronDown,
  Plus,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Ruler,
} from "lucide-react";

/* ---------- Types ---------- */

export type MetricGroupKey = "BASE" | "GK" | "DEF" | "MID" | "ATT";

type MetricRow = {
  id: string;
  group_key: MetricGroupKey;
  key: string;
  label: string;
  enabled: boolean;
  sort_order: number;
};

type GroupedMetrics = Record<MetricGroupKey, MetricRow[]>;

/* ---------- Constant labels ---------- */

const GROUP_LABEL: Record<MetricGroupKey, string> = {
  BASE: "Kategorie bazowe",
  GK: "Bramkarz (GK)",
  DEF: "Obrońca (CB/FB/WB)",
  MID: "Pomocnik (6/8/10)",
  ATT: "Napastnik (9/7/11)",
};

/* ---------- Default metrics (z Twojego opisu) ---------- */

type DefaultMetric = {
  group_key: MetricGroupKey;
  key: string;
  label: string;
  sort_order: number;
};

const DEFAULT_METRICS: DefaultMetric[] = [
  // KATEGORIE BAZOWE (BASE)
  {
    group_key: "BASE",
    key: "base_decisions_pressure",
    label:
      "Decyzje pod presją — wybór i szybkość decyzji w 1–2 s, minimalizacja strat.",
    sort_order: 1,
  },
  {
    group_key: "BASE",
    key: "base_first_touch_retention",
    label:
      "Pierwszy kontakt & utrzymanie — jakość przyjęcia, kierunkowe przyjęcie, ochrona piłki.",
    sort_order: 2,
  },
  {
    group_key: "BASE",
    key: "base_progression",
    label:
      "Progresja gry — przesuwanie akcji do przodu: podaniem, prowadzeniem lub ruchem (praktyczny „meter gain”).",
    sort_order: 3,
  },
  {
    group_key: "BASE",
    key: "base_off_ball",
    label:
      "Gra bez piłki (skanowanie, pozycjonowanie, pressing) — skan przed przyjęciem, ustawienie między liniami, reakcja po stracie (5 s).",
    sort_order: 4,
  },
  {
    group_key: "BASE",
    key: "base_duels_intensity",
    label:
      "Pojedynki & intensywność — 1v1 w ziemi/powietrzu, determinacja, doskok, powroty.",
    sort_order: 5,
  },
  {
    group_key: "BASE",
    key: "base_dynamics_workrate",
    label:
      "Dynamika & tempo pracy — szybkość pierwszych kroków, przyspieszenie, powtarzalność sprintów.",
    sort_order: 6,
  },

  // BRAMKARZ (GK)
  {
    group_key: "GK",
    key: "gk_shot_stopping",
    label: "Shot-stopping & 1v1 — czas reakcji, skracanie kątów.",
    sort_order: 1,
  },
  {
    group_key: "GK",
    key: "gk_aerial",
    label: "Gra w powietrzu & wyjścia — ocena dośrodkowań, timing, chwyt.",
    sort_order: 2,
  },
  {
    group_key: "GK",
    key: "gk_build_up",
    label:
      "Gra nogami & budowanie — decyzje w krótkiej budowie, długie wznowienia.",
    sort_order: 3,
  },

  // OBROŃCA (DEF)
  {
    group_key: "DEF",
    key: "def_1v1_defending",
    label: "1v1 w defensywie — pozycja ciała, timing, bezfaulowość.",
    sort_order: 1,
  },
  {
    group_key: "DEF",
    key: "def_aerial",
    label: "Gra w powietrzu — pozycjonowanie, wygrane główki.",
    sort_order: 2,
  },
  {
    group_key: "DEF",
    key: "def_build_up_press",
    label:
      "Wyprowadzenie pod pressingiem — odwaga, łamanie linii, diagonale.",
    sort_order: 3,
  },
  {
    group_key: "DEF",
    key: "def_crossing_runs",
    label:
      "Dośrodkowanie & wejścia (FB/WB) — jakość i wybór strefy.",
    sort_order: 4,
  },

  // POMOCNIK (MID)
  {
    group_key: "MID",
    key: "mid_press_resistance",
    label:
      "Odporność na pressing / obrót — gra półobrotem, wyjście z presji.",
    sort_order: 1,
  },
  {
    group_key: "MID",
    key: "mid_creation",
    label:
      "Kreacja / ostatnie podanie — jakość i timing zagrań kluczowych.",
    sort_order: 2,
  },
  {
    group_key: "MID",
    key: "mid_tempo_control",
    label:
      "Kontrola tempa — przyspieszanie/zwalnianie rytmu, wybór trzeciego człowieka.",
    sort_order: 3,
  },

  // NAPASTNIK (ATT)
  {
    group_key: "ATT",
    key: "att_movement_line",
    label:
      "Ruch na linii / atak przestrzeni — timing startów, utrzymanie pozycji spalonego.",
    sort_order: 1,
  },
  {
    group_key: "ATT",
    key: "att_finishing",
    label:
      "Wykończenie — techniki strzału (P/L/głowa), spokój w polu karnym.",
    sort_order: 2,
  },
  {
    group_key: "ATT",
    key: "att_link_play",
    label:
      "Łączenie gry / gra na ścianę — zgrywanie, podwójne akcje ze „szóstką”/„dziesiątką”.",
    sort_order: 3,
  },
];

/* ---------- Utils ---------- */

function slugKey(s: string) {
  const base = s.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
  return base || `metric-${Math.random().toString(36).slice(2, 7)}`;
}

function sortMetrics(a: MetricRow, b: MetricRow) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.label.localeCompare(b.label);
}

/* ---------- Inline cell ---------- */

function InlineCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  function commit() {
    const v = local.trim();
    if (v !== value) onChange(v);
  }

  return (
    <input
      className="h-8 w-full rounded-md border border-transparent bg-white px-2 text-sm outline-none focus:border-indigo-500 dark:bg-neutral-950 dark:focus:border-indigo-400"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setLocal(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/* ==================================
 *           PAGE
 * ================================== */

export default function MetricsSettingsPage() {
  const [groups, setGroups] = useState<GroupedMetrics>({
    BASE: [],
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DnD: które id z której grupy przeciągamy
  const [dragging, setDragging] = useState<{
    group: MetricGroupKey;
    id: string;
  } | null>(null);

  /* ---------- Load from Supabase ---------- */
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("obs_metrics")
          .select("id, group_key, key, label, enabled, sort_order")
          .order("group_key", { ascending: true })
          .order("sort_order", { ascending: true });

        if (error) throw error;
        if (!mounted) return;

        const next: GroupedMetrics = {
          BASE: [],
          GK: [],
          DEF: [],
          MID: [],
          ATT: [],
        };

        (data || []).forEach((row: any) => {
          const g = row.group_key as MetricGroupKey;
          if (!next[g]) return;
          next[g].push({
            id: row.id,
            group_key: g,
            key: row.key,
            label: row.label,
            enabled: !!row.enabled,
            sort_order:
              typeof row.sort_order === "number" ? row.sort_order : 0,
          });
        });

        (Object.keys(next) as MetricGroupKey[]).forEach((g) => {
          next[g] = next[g].sort(sortMetrics);
        });

        setGroups(next);
      } catch (e: any) {
        console.error("Error loading metrics:", e);
        if (!mounted) return;
        setError(
          e?.message || "Nie udało się pobrać metryk z Supabase (obs_metrics)."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- Common helpers ---------- */

  function updateLocalMetric(
    group: MetricGroupKey,
    id: string,
    patch: Partial<MetricRow>
  ) {
    setGroups((prev) => {
      const arr = prev[group];
      const idx = arr.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      const nextArr = [...arr];
      nextArr[idx] = { ...nextArr[idx], ...patch };
      nextArr.sort(sortMetrics);
      return { ...prev, [group]: nextArr };
    });
  }

  async function updateMetric(
    group: MetricGroupKey,
    id: string,
    patch: Partial<MetricRow>
  ) {
    setSaving(true);
    setError(null);
    const supabase = getSupabase();
    try {
      updateLocalMetric(group, id, patch);

      const payload: any = {};
      if (patch.label !== undefined) payload.label = patch.label;
      if (patch.key !== undefined) payload.key = patch.key;
      if (patch.enabled !== undefined) payload.enabled = patch.enabled;
      if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order;

      if (Object.keys(payload).length === 0) return;

      const { error } = await supabase
        .from("obs_metrics")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
    } catch (e: any) {
      console.error("Error updating metric:", e);
      setError("Nie udało się zaktualizować metryki. Odśwież stronę.");
    } finally {
      setSaving(false);
    }
  }

  async function addMetric(group: MetricGroupKey) {
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const current = groups[group];
      const maxSort =
        current.length > 0
          ? Math.max(...current.map((m) => m.sort_order || 0))
          : 0;
      const label = "Nowa metryka";
      const key = slugKey(label);

      const insertPayload = {
        group_key: group,
        label,
        key,
        enabled: true,
        sort_order: maxSort + 1,
      };

      const { data, error } = await supabase
        .from("obs_metrics")
        .insert(insertPayload)
        .select("id, group_key, key, label, enabled, sort_order")
        .single();

      if (error) throw error;

      const row: MetricRow = {
        id: data.id,
        group_key: data.group_key,
        key: data.key,
        label: data.label,
        enabled: data.enabled,
        sort_order: data.sort_order,
      };

      setGroups((prev) => {
        const arr = [...prev[group], row].sort(sortMetrics);
        return { ...prev, [group]: arr };
      });
    } catch (e: any) {
      console.error("Error adding metric:", e);
      setError("Nie udało się dodać metryki.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMetric(group: MetricGroupKey, id: string) {
    if (!confirm("Na pewno chcesz usunąć tę metrykę?")) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      setGroups((prev) => {
        const arr = prev[group].filter((m) => m.id !== id);
        return { ...prev, [group]: arr };
      });

      const { error } = await supabase
        .from("obs_metrics")
        .delete()
        .eq("id", id);

      if (error) throw error;
    } catch (e: any) {
      console.error("Error deleting metric:", e);
      setError("Nie udało się usunąć metryki.");
    } finally {
      setSaving(false);
    }
  }

  // Naprawa reorder: używamy update zamiast upsert (żeby nie pchać nulli w NOT NULL)
  async function moveMetric(
    group: MetricGroupKey,
    id: string,
    dir: -1 | 1
  ) {
    const arr = groups[group];
    const idx = arr.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;

    const a = arr[idx];
    const b = arr[target];

    const nextArr = [...arr];
    nextArr[idx] = { ...b, sort_order: a.sort_order };
    nextArr[target] = { ...a, sort_order: b.sort_order };

    setGroups((prev) => ({
      ...prev,
      [group]: nextArr.sort(sortMetrics),
    }));

    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      await Promise.all([
        supabase
          .from("obs_metrics")
          .update({ sort_order: b.sort_order })
          .eq("id", a.id),
        supabase
          .from("obs_metrics")
          .update({ sort_order: a.sort_order })
          .eq("id", b.id),
      ]);
    } catch (e: any) {
      console.error("Error reordering metrics:", e);
      setError("Nie udało się zmienić kolejności. Odśwież widok.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Drag & Drop ordering (within group) ---------- */

  function handleDragStart(group: MetricGroupKey, id: string) {
    setDragging({ group, id });
  }

  function handleDragEnd() {
    setDragging(null);
  }

  async function handleDrop(group: MetricGroupKey, targetId: string) {
    if (!dragging || dragging.group !== group) return;
    const sourceId = dragging.id;
    if (sourceId === targetId) {
      setDragging(null);
      return;
    }

    const arr = groups[group];
    const ids = arr.map((m) => m.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) {
      setDragging(null);
      return;
    }

    ids.splice(from, 1);
    ids.splice(to, 0, sourceId);

    // lokalnie nadajemy nowe sort_order w tej grupie
    setGroups((prev) => {
      const idToSort: Record<string, number> = {};
      ids.forEach((id, idx) => {
        idToSort[id] = idx + 1;
      });

      const updatedGroup = prev[group]
        .map((m) => ({
          ...m,
          sort_order: idToSort[m.id] ?? m.sort_order,
        }))
        .sort(sortMetrics);

      return { ...prev, [group]: updatedGroup };
    });

    setDragging(null);

    // zapis do Supabase
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const updates = ids.map((id, idx) => ({
        id,
        sort_order: idx + 1,
      }));

      await Promise.all(
        updates.map((u) =>
          supabase
            .from("obs_metrics")
            .update({ sort_order: u.sort_order })
            .eq("id", u.id)
        )
      );
    } catch (e: any) {
      console.error("Error reordering metrics (drag & drop):", e);
      setError(
        "Nie udało się zmienić kolejności (drag & drop). Odśwież widok."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Seed domyślnych metryk ---------- */

  async function seedDefaults() {
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();

      const existingKeys = new Set(
        (Object.values(groups) as MetricRow[][])
          .flat()
          .map((m) => m.key)
      );

      const toInsert = DEFAULT_METRICS.filter(
        (m) => !existingKeys.has(m.key)
      ).map((m) => ({
        group_key: m.group_key,
        key: m.key,
        label: m.label,
        enabled: true,
        sort_order: m.sort_order,
      }));

      if (toInsert.length === 0) {
        setError(
          "Wszystkie domyślne metryki są już w bazie (na podstawie key)."
        );
        return;
      }

      const { data, error } = await supabase
        .from("obs_metrics")
        .insert(toInsert)
        .select("id, group_key, key, label, enabled, sort_order");

      if (error) throw error;

      const inserted: MetricRow[] = (data || []).map((row: any) => ({
        id: row.id,
        group_key: row.group_key as MetricGroupKey,
        key: row.key,
        label: row.label,
        enabled: !!row.enabled,
        sort_order:
          typeof row.sort_order === "number" ? row.sort_order : 0,
      }));

      setGroups((prev) => {
        const next: GroupedMetrics = { ...prev };
        inserted.forEach((m) => {
          const g = m.group_key;
          next[g] = [...(next[g] || []), m].sort(sortMetrics);
        });
        return next;
      });
    } catch (e: any) {
      console.error("Error seeding default metrics:", e);
      setError(
        "Nie udało się załadować domyślnych metryk. Sprawdź logi / konsolę."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Render ---------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            Konfiguracja metryk (obserwacje)
          </h1>
          <p className="mt-1 text-sm text-dark dark:text-neutral-300">
            Definiuj pola używane w arkuszu obserwacji S4S. Metryki można
            włączać/wyłączać, edytować i zmieniać ich kolejność (strzałkami
            lub drag & drop).
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {saving && (
            <div className="text-xs text-dark dark:text-neutral-400">
              Zapisywanie zmian…
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-gray-300 text-xs dark:border-neutral-700"
            onClick={seedDefaults}
          >
            Załaduj domyślne metryki S4S
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertCircle className="mt-[1px] h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardContent className="p-4 text-sm text-dark dark:text-neutral-400">
            Ładowanie metryk z Supabase…
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(Object.keys(GROUP_LABEL) as MetricGroupKey[]).map((g) => {
            const arr = groups[g] || [];
            const activeCount = arr.filter((m) => m.enabled).length;

            return (
              <InterfaceSection
                key={g}
                icon={<Ruler className="h-4 w-4" />}
                title={GROUP_LABEL[g]}
                description="Dodawaj / edytuj pola, włączaj/wyłączaj i zmieniaj kolejność w obrębie grupy."
                badge={
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] text-dark ring-1 ring-gray-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
                    {activeCount}/{arr.length} aktywnych
                  </span>
                }
                defaultOpen={g === "BASE"}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => addMetric(g)}
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj metrykę
                  </Button>
                </div>

                <div className="w-full overflow-x-auto rounded-md border border-gray-200 bg-white text-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="bg-stone-100 text-[11px] uppercase tracking-wide text-dark dark:bg-neutral-900 dark:text-neutral-300">
                      <tr>
                        <th className="w-10 p-2 text-left font-medium">#</th>
                        <th className="min-w-[260px] p-2 text-left font-medium">
                          Etykieta
                        </th>
                        <th className="min-w-[160px] p-2 text-left font-medium">
                          Key
                        </th>
                        <th className="w-32 p-2 text-left font-medium">
                          Widoczna
                        </th>
                        <th className="w-32 p-2 text-left font-medium">
                          Kolejność
                        </th>
                        <th className="w-28 p-2 text-right font-medium">
                          Akcje
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {arr.map((m, index) => {
                        const isDragging =
                          dragging &&
                          dragging.group === g &&
                          dragging.id === m.id;
                        return (
                          <tr
                            key={m.id}
                            draggable
                            onDragStart={() => handleDragStart(g, m.id)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(g, m.id)}
                            className={`border-t border-gray-200 align-middle hover:bg-stone-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60 ${
                              isDragging
                                ? "opacity-60 ring-1 ring-indigo-500"
                                : ""
                            }`}
                          >
                            <td className="p-2 text-xs text-dark dark:text-neutral-300">
                              {index + 1}
                            </td>

                            <td className="p-2">
                              <InlineCell
                                value={m.label}
                                onChange={(val) =>
                                  updateMetric(g, m.id, { label: val })
                                }
                                placeholder="Etykieta metryki…"
                              />
                            </td>
                            <td className="p-2">
                              <InlineCell
                                value={m.key}
                                onChange={(val) =>
                                  updateMetric(g, m.id, {
                                    key: slugKey(val),
                                  })
                                }
                                placeholder="krótki-klucz"
                              />
                            </td>

                            <td className="p-2">
                              <button
                                onClick={() =>
                                  updateMetric(g, m.id, {
                                    enabled: !m.enabled,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-stone-50 px-2 py-1 text-xs transition hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                                title={
                                  m.enabled
                                    ? "Wyłącz metrykę"
                                    : "Włącz metrykę"
                                }
                              >
                                {m.enabled ? (
                                  <ToggleRight className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4 text-gray-400" />
                                )}
                                {m.enabled ? "Włączona" : "Wyłączona"}
                              </button>
                            </td>

                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <button
                                  className="rounded-md border border-gray-300 p-1 text-xs hover:bg-stone-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                  onClick={() => moveMetric(g, m.id, -1)}
                                  disabled={index === 0}
                                  title="Przenieś w górę"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className="rounded-md border border-gray-300 p-1 text-xs hover:bg-stone-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                  onClick={() => moveMetric(g, m.id, 1)}
                                  disabled={index === arr.length - 1}
                                  title="Przenieś w dół"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>

                            <td className="p-2 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-gray-300 text-xs text-red-600 hover:bg-red-50 dark:border-neutral-700 dark:hover:bg-red-900/20"
                                onClick={() => removeMetric(g, m.id)}
                                title="Usuń metrykę"
                              >
                                Usuń
                              </Button>
                            </td>
                          </tr>
                        );
                      })}

                      {arr.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-6 text-center text-sm text-dark dark:text-neutral-400"
                          >
                            Brak metryk w tej grupie — dodaj pierwszą
                            metrykę lub użyj przycisku{" "}
                            <button
                              type="button"
                              className="underline"
                              onClick={seedDefaults}
                            >
                              domyślnych metryk S4S
                            </button>
                            .
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </InterfaceSection>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ======================= Interface section (accordion) ======================= */

function InterfaceSection({
  icon,
  title,
  description,
  badge,
  defaultOpen = true,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden border-gray-200 shadow-sm dark:border-neutral-800">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 bg-stone-50/70 px-4 py-3 text-left hover:bg-stone-100/80 dark:bg-neutral-950/70 dark:hover:bg-neutral-900/80"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-dark ring-1 ring-gray-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-dark dark:text-neutral-50">
              {title}
            </div>
            {description && (
              <div className="mt-0.5 text-[11px] text-dark/70 dark:text-neutral-400">
                {description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <ChevronDown
            className={`h-4 w-4 text-dark/70 transition-transform dark:text-neutral-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          {children}
        </div>
      )}
    </Card>
  );
}
