// src/app/admin/manage/ranks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Save,
  Sparkles,
  TriangleAlert,
  Plus,
  Minus,
  Info,
} from "lucide-react";

type RankKey = "bronze" | "silver" | "gold" | "platinum";

const DEFAULT_THRESHOLDS: Record<RankKey, number> = {
  bronze: 0,
  silver: 20,
  gold: 50,
  platinum: 100,
};

const LIGHT_THRESHOLDS: Record<RankKey, number> = {
  bronze: 0,
  silver: 10,
  gold: 25,
  platinum: 40,
};

const STANDARD_THRESHOLDS: Record<RankKey, number> = {
  bronze: 0,
  silver: 20,
  gold: 50,
  platinum: 100,
};

const INTENSIVE_THRESHOLDS: Record<RankKey, number> = {
  bronze: 0,
  silver: 40,
  gold: 80,
  platinum: 150,
};

const ORDER: RankKey[] = ["bronze", "silver", "gold", "platinum"];

const rankLabelMap: Record<RankKey, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const rankDescriptionMap: Record<RankKey, string> = {
  bronze: "Start – first active profiles and observations.",
  silver: "Regular work with the player database.",
  gold: "Advanced scouting and high activity.",
  platinum: "Top tier – the most active users.",
};

const rankBadgeClass: Record<RankKey, string> = {
  bronze:
    "bg-orange-100 text-orange-800 ring-1 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-100 dark:ring-orange-800/70",
  silver:
    "bg-stone-100 text-stone-800 ring-1 ring-stone-200 dark:bg-stone-800/40 dark:text-stone-100 dark:ring-stone-700/70",
  gold:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800/70",
  platinum:
    "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-100 dark:ring-indigo-800/70",
};

type RankRow = {
  rank: string;
  min_score: number;
};

/* utils for sample preview */
function calcScore(players: number, observations: number) {
  return players * 2 + observations;
}
function calcRankFromThresholds(
  score: number,
  thresholds: Record<RankKey, number>
): RankKey {
  if (score >= thresholds.platinum) return "platinum";
  if (score >= thresholds.gold) return "gold";
  if (score >= thresholds.silver) return "silver";
  return "bronze";
}

/* shared layout tokens – consistent with Observations table */
const cellPad = "p-1";
const rowH = "h-10";

export default function RankSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [thresholds, setThresholds] = useState<Record<RankKey, number>>(
    DEFAULT_THRESHOLDS
  );

  /* ============================= Load from Supabase ============================= */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("rank_thresholds")
        .select("rank, min_score");

      if (cancelled) return;

      if (error) {
        console.error("rank_thresholds load error", error);
        setError(
          "Failed to fetch current thresholds. Using default values."
        );
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setThresholds(DEFAULT_THRESHOLDS);
        setLoading(false);
        return;
      }

      const next = { ...DEFAULT_THRESHOLDS };
      for (const row of data as RankRow[]) {
        const r = row.rank as RankKey;
        if (ORDER.includes(r)) {
          next[r] = row.min_score ?? DEFAULT_THRESHOLDS[r];
        }
      }
      setThresholds(next);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================= Derived validation & preview ============================= */

  const validationMessage = useMemo(() => {
    let prevVal = -Infinity;
    let prevRank: RankKey | null = null;

    for (const r of ORDER) {
      const val = thresholds[r] ?? 0;
      if (val < 0) {
        return "Threshold values cannot be negative.";
      }
      if (val < prevVal) {
        return `Threshold for "${rankLabelMap[r]}" is lower than for "${prevRank && rankLabelMap[prevRank]}". Please maintain increasing values.`;
      }
      prevVal = val;
      prevRank = r;
    }

    return null;
  }, [thresholds]);

  // mały przykład: 15 aktywnych + 30 obserwacji
  const samplePlayers = 15;
  const sampleObs = 30;
  const sampleScore = calcScore(samplePlayers, sampleObs);
  const sampleRank = calcRankFromThresholds(sampleScore, thresholds);

  const thresholdsSummary = `${thresholds.bronze} / ${thresholds.silver} / ${thresholds.gold} / ${thresholds.platinum}`;

  /* ============================= Handlers ============================= */

  const handleChange = (rank: RankKey, value: number) => {
    const safe = Number.isNaN(value) ? 0 : Math.max(0, value);
    setThresholds((prev) => ({
      ...prev,
      [rank]: safe,
    }));
    setError(null);
    setSuccess(null);
  };

  const adjustValue = (rank: RankKey, delta: number) => {
    setThresholds((prev) => {
      const current = prev[rank] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [rank]: next };
    });
    setError(null);
    setSuccess(null);
  };

  const applyPreset = (preset: "light" | "standard" | "intensive") => {
    if (preset === "light") setThresholds(LIGHT_THRESHOLDS);
    if (preset === "standard") setThresholds(STANDARD_THRESHOLDS);
    if (preset === "intensive") setThresholds(INTENSIVE_THRESHOLDS);
    setError(null);
    setSuccess(`Applied preset: ${preset}`);
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    setError(null);
    setSuccess("Restored default thresholds (0 / 20 / 50 / 100).");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();

      const rows = ORDER.map((r) => ({
        rank: r,
        min_score: thresholds[r],
      }));

      const { error } = await supabase
        .from("rank_thresholds")
        .upsert(rows, { onConflict: "rank" });

      if (error) {
        console.error("rank_thresholds save error", error);
        setError(`Failed to save thresholds: ${error.message}`);
      } else {
        setSuccess("Changes have been saved.");

        // 🔔 notify sidebar (AppSidebar) that thresholds changed
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("rank-thresholds-updated"));
        }
      }
    } catch (e: any) {
      console.error(e);
      setError("An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  /* ============================= Render ============================= */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Scout Levels
          </h1>
          <p className="mt-1 text-sm text-dark dark:text-neutral-300">
            Set the point thresholds for Bronze / Silver / Gold / Platinum levels.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Default
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2.1fr),minmax(0,1.1fr)]">
        {/* LEFT: thresholds table – style like Observations table */}
        <div className="space-y-3">
          {/* Summary + presets */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Set the minimum point score required for a user to reach a given
              level.
            </div>
            <span className="rounded-md bg-white px-2 py-0.5 text-[11px] text-stone-700 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
              Bronze / Silver / Gold / Platinum:{" "}
              <span className="font-semibold text-stone-900 dark:text-neutral-50">
                {thresholdsSummary}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Scale presets:</span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 rounded-md px-2 text-[11px]"
                onClick={() => applyPreset("light")}
                disabled={saving}
              >
                Light
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-6 rounded-md px-2 text-[11px]"
                onClick={() => applyPreset("standard")}
                disabled={saving}
              >
                Standard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 rounded-md px-2 text-[11px]"
                onClick={() => applyPreset("intensive")}
                disabled={saving}
              >
                Intensive
              </Button>
            </div>
          </div>

          {/* TABLE CARD */}
          <div
            className="
              mt-1 w-full overflow-x-auto rounded-md border border-gray-200 bg-white p-0 shadow-sm
              dark:border-neutral-700 dark:bg-neutral-950
            "
          >
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-gray-600 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:text-neutral-300">
                <tr>
                  <th className={`${cellPad} text-left font-medium`}>
                    Level
                  </th>
                  <th className={`${cellPad} hidden text-left font-medium sm:table-cell`}>
                    Description
                  </th>
                  <th className={`${cellPad} text-right font-medium`}>
                    Minimum score
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className={`${cellPad} ${rowH} text-center text-sm text-muted-foreground`}
                    >
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading current thresholds…
                      </div>
                    </td>
                  </tr>
                ) : (
                  ORDER.map((rankKey, idx) => {
                    const value = thresholds[rankKey] ?? 0;
                    return (
                      <tr
                        key={rankKey}
                        className={`group border-t transition-colors duration-150 ${rowH}
                          ${
                            idx % 2 === 1
                              ? "bg-stone-100/40 dark:bg-neutral-900/30"
                              : "bg-transparent"
                          }
                          border-gray-200 hover:bg-stone-100/70 dark:border-neutral-800 dark:hover:bg-neutral-900/60`}
                      >
                        {/* Level */}
                        <td className={`${cellPad} align-center`}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${rankBadgeClass[rankKey]}`}
                            >
                              {rankLabelMap[rankKey]}
                            </span>
                          </div>
                        </td>

                        {/* Description – hidden on very small screens */}
                        <td
                          className={`${cellPad} hidden align-center sm:table-cell`}
                        >
                          <span className="text-[11px] text-muted-foreground">
                            {rankDescriptionMap[rankKey]}
                          </span>
                        </td>

                        {/* Minimum score + +/- buttons */}
                        <td
                          className={`${cellPad} align-center text-right`}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 border-gray-300 dark:border-neutral-700"
                              onClick={() => adjustValue(rankKey, -5)}
                              disabled={saving}
                              aria-label={`Decrease ${rankLabelMap[rankKey]} threshold`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              id={`rank-${rankKey}`}
                              type="number"
                              min={0}
                              value={value}
                              onChange={(e) =>
                                handleChange(rankKey, Number(e.target.value))
                              }
                              className="h-7 w-20 border-gray-300 text-center text-xs dark:border-neutral-700"
                              inputMode="numeric"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 border-gray-300 dark:border-neutral-700"
                              onClick={() => adjustValue(rankKey, +5)}
                              disabled={saving}
                              aria-label={`Increase ${rankLabelMap[rankKey]} threshold`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Messages under table */}
          {validationMessage && (
            <div className="!mt-1 inline-flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              <TriangleAlert className="mt-[1px] h-3.5 w-3.5 shrink-0" />
              <span>{validationMessage}</span>
            </div>
          )}

          {error && (
            <div className="mt-1 inline-flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
              <TriangleAlert className="mt-[1px] h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-1 inline-flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
              <Sparkles className="mt-[1px] h-3.5 w-3.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* RIGHT: info & preview in a simple card */}
        <div>
          <Card className="overflow-hidden border-gray-200 shadow-sm dark:border-neutral-800">
            <CardContent className="border-gray-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-dark ring-1 ring-gray-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-dark dark:text-neutral-50">
                    How does the ranking work?
                  </div>
                  <div className="mt-0.5 text-[11px] text-dark/70 dark:text-neutral-400">
                    A quick guide to point logic and a visual level example for
                    sample activity.
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground">
                <div>
                  <p className="mb-1 font-medium text-foreground">
                    What counts towards the score?
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>
                      Players: only records in{" "}
                      <code className="rounded bg-black/5 px-1 py-0.5 text-[10px] dark:bg-white/10">
                        players
                      </code>{" "}
                      with status{" "}
                      <code className="rounded bg-black/5 px-1 py-0.5 text-[10px] dark:bg-white/10">
                        active
                      </code>
                      .
                    </li>
                    <li>
                      Observations: only records in{" "}
                      <code className="rounded bg-black/5 px-1 py-0.5 text-[10px] dark:bg-white/10">
                        observations
                      </code>{" "}
                      with status{" "}
                      <code className="rounded bg-black/5 px-1 py-0.5 text-[10px] dark:bg-white/10">
                        final
                      </code>
                      .
                    </li>
                  </ul>
                </div>

                <div className="rounded-md bg-white/80 p-2.5 text-[11px] ring-1 ring-stone-200 dark:bg-neutral-950/70 dark:ring-neutral-800">
                  <p className="font-medium text-foreground">
                    Example (level preview)
                  </p>
                  <p className="mt-1">
                    Assume: <strong>{samplePlayers} active players</strong> and{" "}
                    <strong>{sampleObs} observations (final)</strong>.
                  </p>
                  <p className="mt-1">
                    <code className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                      score = 2 × {samplePlayers} + {sampleObs} = {sampleScore}{" "}
                      pts
                    </code>
                  </p>
                  <p className="mt-1">
                    With the current thresholds, such a user has{" "}
                    <strong>{rankLabelMap[sampleRank]}</strong> level.
                  </p>
                </div>

                <div>
                  <p className="mb-1 font-medium text-foreground">
                    Short rules
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>
                      Thresholds should be increasing: Bronze ≤ Silver ≤ Gold ≤
                      Platinum.
                    </li>
                    <li>
                      Usually leave Bronze at 0 – every active user.
                    </li>
                    <li>
                      Set Silver/Gold/Platinum based on your team's real
                      activity.
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
