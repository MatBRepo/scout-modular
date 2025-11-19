// src/app/settings/ratings/page.tsx
"use client";

import { Fragment, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Plus,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from "lucide-react";

/* ---------- Types ---------- */

type RatingAspectRow = {
  id: string;
  key: string;
  label: string;
  tooltip: string | null;
  enabled: boolean;
  sort_order: number;
  group_key: string;
};

/* ---------- Group options ---------- */

const GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: "GEN", label: "Ogólne (dla wszystkich pozycji)" },
  { value: "GK", label: "Bramkarz (GK)" },
  { value: "DEF", label: "Obrońca" },
  { value: "MID", label: "Pomocnik" },
  { value: "FW", label: "Napastnik" },
];

function groupOrder(g: string): number {
  const idx = GROUP_OPTIONS.findIndex((x) => x.value === g);
  return idx === -1 ? 999 : idx;
}

/* ---------- Utils ---------- */

function slugKey(s: string) {
  const base = s.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
  return base || `rating-${Math.random().toString(36).slice(2, 7)}`;
}

function sortAspects(a: RatingAspectRow, b: RatingAspectRow) {
  // najpierw grupy, potem sort_order, potem label
  const ga = groupOrder(a.group_key);
  const gb = groupOrder(b.group_key);
  if (ga !== gb) return ga - gb;

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
      className="h-8 w-full rounded-md border border-transparent px-2 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
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

export default function RatingsSettingsPage() {
  const [rows, setRows] = useState<RatingAspectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /* ---------- Load from Supabase ---------- */
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("player_rating_aspects")
          .select("id, key, label, tooltip, enabled, sort_order, group_key")
          .order("sort_order", { ascending: true });

        if (error) throw error;
        if (!mounted) return;

        const parsed: RatingAspectRow[] = (data || []).map((r: any) => ({
          id: r.id,
          key: r.key,
          label: r.label,
          tooltip: r.tooltip ?? null,
          enabled: !!r.enabled,
          sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
          group_key: r.group_key || "GEN",
        }));

        parsed.sort(sortAspects);
        setRows(parsed);
      } catch (e: any) {
        console.error("Error loading rating aspects:", e);
        if (!mounted) return;
        setError(
          e?.message ||
            "Nie udało się pobrać konfiguracji ocen zawodnika (player_rating_aspects)."
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

  /* ---------- Local update helper ---------- */

  function updateLocal(id: string, patch: Partial<RatingAspectRow>) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const arr = [...prev];
      arr[idx] = { ...arr[idx], ...patch };
      arr.sort(sortAspects);
      return arr;
    });
  }

  /* ---------- Supabase updates ---------- */

  async function updateAspect(id: string, patch: Partial<RatingAspectRow>) {
    setSaving(true);
    setError(null);
    const supabase = getSupabase();
    try {
      // optymistycznie w UI
      updateLocal(id, patch);

      const payload: any = {};
      if (patch.label !== undefined) payload.label = patch.label;
      if (patch.key !== undefined) payload.key = patch.key;
      if (patch.tooltip !== undefined) payload.tooltip = patch.tooltip;
      if (patch.enabled !== undefined) payload.enabled = patch.enabled;
      if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order;
      if (patch.group_key !== undefined) payload.group_key = patch.group_key;

      if (Object.keys(payload).length === 0) return;

      const { error } = await supabase
        .from("player_rating_aspects")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
    } catch (e: any) {
      console.error("Error updating rating aspect:", e);
      setError("Nie udało się zaktualizować kategorii oceny. Odśwież widok.");
    } finally {
      setSaving(false);
    }
  }

  async function addAspect() {
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const maxSort =
        rows.length > 0
          ? Math.max(...rows.map((r) => r.sort_order || 0))
          : 0;
      const label = "Nowa ocena";
      const key = slugKey(label);

      const insertPayload = {
        key,
        label,
        tooltip: "",
        enabled: true,
        sort_order: maxSort + 1,
        group_key: "GEN", // domyślnie ogólne
      };

      const { data, error } = await supabase
        .from("player_rating_aspects")
        .insert(insertPayload)
        .select("id, key, label, tooltip, enabled, sort_order, group_key")
        .single();

      if (error) throw error;

      const row: RatingAspectRow = {
        id: data.id,
        key: data.key,
        label: data.label,
        tooltip: data.tooltip ?? null,
        enabled: data.enabled,
        sort_order: data.sort_order,
        group_key: data.group_key || "GEN",
      };

      setRows((prev) => {
        const arr = [...prev, row];
        arr.sort(sortAspects);
        return arr;
      });
    } catch (e: any) {
      console.error("Error adding rating aspect:", e);
      setError("Nie udało się dodać kategorii oceny.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAspect(id: string) {
    if (!confirm("Na pewno chcesz usunąć tę kategorię oceny?")) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();

      // optymistycznie w UI
      setRows((prev) => prev.filter((r) => r.id !== id));

      const { error } = await supabase
        .from("player_rating_aspects")
        .delete()
        .eq("id", id);

      if (error) throw error;
    } catch (e: any) {
      console.error("Error deleting rating aspect:", e);
      setError("Nie udało się usunąć kategorii oceny.");
    } finally {
      setSaving(false);
    }
  }

  // Fix: używamy zwykłego update, nie upsert (żeby nie wbijać nulli w NOT NULL columns)
  async function moveAspect(id: string, dir: -1 | 1) {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;

    const a = rows[idx];
    const b = rows[target];
    if (!a || !b) return;

    // optymistyczna zamiana sort_order lokalnie
    const next = [...rows];
    next[idx] = { ...b, sort_order: a.sort_order };
    next[target] = { ...a, sort_order: b.sort_order };
    next.sort(sortAspects);
    setRows(next);

    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      await Promise.all([
        supabase
          .from("player_rating_aspects")
          .update({ sort_order: b.sort_order })
          .eq("id", a.id),
        supabase
          .from("player_rating_aspects")
          .update({ sort_order: a.sort_order })
          .eq("id", b.id),
      ]);
    } catch (e: any) {
      console.error("Error reordering rating aspects:", e);
      setError("Nie udało się zmienić kolejności. Odśwież widok.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Drag & Drop ordering (within group) ---------- */

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  async function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return;

    const sourceId = draggingId;
    setDraggingId(null);

    const current = [...rows];
    const sourceRow = current.find((r) => r.id === sourceId);
    const targetRow = current.find((r) => r.id === targetId);
    if (!sourceRow || !targetRow) return;

    // Na razie pozwalamy drag & drop tylko w ramach tej samej grupy
    if (sourceRow.group_key !== targetRow.group_key) {
      return;
    }

    const groupKey = sourceRow.group_key;
    const groupRows = current
      .filter((r) => r.group_key === groupKey)
      .sort((a, b) => a.sort_order - b.sort_order);

    const ids = groupRows.map((r) => r.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;

    ids.splice(from, 1);
    ids.splice(to, 0, sourceId);

    // lokalnie ustawiamy nowe sort_order w tej grupie
    setRows((prev) => {
      const idToSort: Record<string, number> = {};
      ids.forEach((id, idx) => {
        idToSort[id] = idx + 1;
      });

      const arr = prev.map((r) =>
        r.group_key === groupKey
          ? { ...r, sort_order: idToSort[r.id] ?? r.sort_order }
          : r
      );
      arr.sort(sortAspects);
      return arr;
    });

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
            .from("player_rating_aspects")
            .update({ sort_order: u.sort_order })
            .eq("id", u.id)
        )
      );
    } catch (e: any) {
      console.error("Error reordering rating aspects (drag & drop):", e);
      setError("Nie udało się zmienić kolejności (drag & drop). Odśwież widok.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Grupowanie do widoku (nagłówki grup) ---------- */

  // upakuj w strukturę: grupy + ich wiersze
  const groupedRows = GROUP_OPTIONS.map((g) => ({
    group: g,
    items: rows
      .filter((r) => r.group_key === g.value)
      .sort(sortAspects),
  })).filter((section) => section.items.length > 0);

  /* ---------- Render ---------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Konfiguracja ocen zawodnika
          </h1>
          <p className="mt-1 text-sm text-dark dark:text-neutral-300">
            Te kategorie pojawiają się w sekcji „Ocena” przy dodawaniu/edycji
            znanego zawodnika.
          </p>
        </div>
        {saving && (
          <div className="text-xs text-dark dark:text-neutral-400">
            Zapisywanie zmian…
          </div>
        )}
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
            Ładowanie konfiguracji ocen zawodnika…
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">
              Kategorie ocen zawodnika
            </CardTitle>
            <div className="text-xs text-dark dark:text-neutral-400">
              Dodaj nowe, edytuj etykiety, klucze, opisy, grupy oraz kolejność
              (możesz przeciągać wiersze w obrębie grup).
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Button
                onClick={addAspect}
                className="bg-gray-900 text-white hover:bg-gray-800"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Dodaj kategorię
              </Button>
              
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
                  <tr>
                    <th className="w-10 p-2 text-left font-medium">#</th>
                    <th className="w-40 p-2 text-left font-medium">Grupa</th>
                    <th className="min-w-[220px] p-2 text-left font-medium">
                      Etykieta
                    </th>
                    <th className="min-w-[160px] p-2 text-left font-medium">
                      Key
                    </th>
                    <th className="min-w-[220px] p-2 text-left font-medium">
                      Tooltip
                    </th>
                    <th className="w-28 p-2 text-left font-medium">
                      Widoczna
                    </th>
                    <th className="w-28 p-2 text-left font-medium">
                      Kolejność
                    </th>
                    <th className="w-28 p-2 text-right font-medium">
                      Akcje
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let rowIndex = 0;
                    if (groupedRows.length === 0) {
                      return (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-6 text-center text-sm text-dark dark:text-neutral-400"
                          >
                            Brak kategorii ocen — dodaj pierwszą kategorię.
                          </td>
                        </tr>
                      );
                    }

                    return groupedRows.map((section) => (
                      <Fragment key={section.group.value}>
                        {/* mały nagłówek grupy */}
                        <tr className="bg-stone-50/80 dark:bg-neutral-900/70">
                          <td
                            colSpan={8}
                            className="p-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-400"
                          >
                            {section.group.label}
                          </td>
                        </tr>

                        {section.items.map((r) => {
                          rowIndex += 1;
                          const isDragging = draggingId === r.id;
                          return (
                            <tr
                              key={r.id}
                              draggable
                              onDragStart={() => handleDragStart(r.id)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDrop(r.id)}
                              className={`border-t border-gray-200 align-middle hover:bg-stone-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60 ${
                                isDragging ? "opacity-60 ring-1 ring-indigo-500" : ""
                              }`}
                            >
                              <td className="p-2 text-xs text-dark">
                                {rowIndex}
                              </td>

                              {/* Grupa */}
                              <td className="p-2">
                                <select
                                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                                  value={r.group_key || "GEN"}
                                  onChange={(e) =>
                                    updateAspect(r.id, {
                                      group_key: e.target.value,
                                    })
                                  }
                                >
                                  {GROUP_OPTIONS.map((g) => (
                                    <option key={g.value} value={g.value}>
                                      {g.label}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Label */}
                              <td className="p-2">
                                <InlineCell
                                  value={r.label}
                                  onChange={(val) =>
                                    updateAspect(r.id, { label: val })
                                  }
                                  placeholder="Etykieta kategorii…"
                                />
                              </td>

                              {/* Key */}
                              <td className="p-2">
                                <InlineCell
                                  value={r.key}
                                  onChange={(val) =>
                                    updateAspect(r.id, { key: slugKey(val) })
                                  }
                                  placeholder="krótki-klucz"
                                />
                              </td>

                              {/* Tooltip */}
                              <td className="p-2">
                                <InlineCell
                                  value={r.tooltip || ""}
                                  onChange={(val) =>
                                    updateAspect(r.id, { tooltip: val || "" })
                                  }
                                  placeholder="Opis tooltipa (opcjonalnie)…"
                                />
                              </td>

                              {/* Enabled */}
                              <td className="p-2">
                                <button
                                  onClick={() =>
                                    updateAspect(r.id, {
                                      enabled: !r.enabled,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs transition hover:bg-stone-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                  title={
                                    r.enabled
                                      ? "Ukryj kategorię w formularzu oceny"
                                      : "Pokaż kategorię w formularzu oceny"
                                  }
                                >
                                  {r.enabled ? (
                                    <ToggleRight className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <ToggleLeft className="h-4 w-4 text-gray-400" />
                                  )}
                                  {r.enabled ? "Włączona" : "Wyłączona"}
                                </button>
                              </td>

                              {/* Order buttons (fallback obok drag & drop) */}
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    className="rounded-md border border-gray-300 p-1 text-xs hover:bg-stone-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                    onClick={() => moveAspect(r.id, -1)}
                                    title="Przenieś w górę"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    className="rounded-md border border-gray-300 p-1 text-xs hover:bg-stone-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                    onClick={() => moveAspect(r.id, 1)}
                                    title="Przenieś w dół"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Delete */}
                              <td className="p-2 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-gray-300 text-red-600 hover:bg-red-50 dark:border-neutral-700 dark:hover:bg-red-900/20"
                                  onClick={() => removeAspect(r.id)}
                                  title="Usuń kategorię"
                                >
                                  Usuń
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
