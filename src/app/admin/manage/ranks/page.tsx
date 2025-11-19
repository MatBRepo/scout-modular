// src/app/admin/manage/ranks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Info,
  Loader2,
  Save,
  Sparkles,
  TriangleAlert,
  Plus,
  Minus,
} from "lucide-react";
import Link from "next/link";

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
  bronze: "Start – pierwsze aktywne profile i obserwacje.",
  silver: "Regularna praca z bazą zawodników.",
  gold: "Zaawansowany scouting i duża aktywność.",
  platinum: "Top tier – najbardziej aktywni użytkownicy.",
};

const rankBadgeClass: Record<RankKey, string> = {
  bronze:
    "bg-orange-100 text-orange-800 ring-1 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-100 dark:ring-orange-800/70",
  silver:
    "bg-slate-100 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-100 dark:ring-slate-700/70",
  gold:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800/70",
  platinum:
    "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-100 dark:ring-indigo-800/70",
};

type RankRow = {
  rank: string;
  min_score: number;
};

/* utils do przykładowego preview */
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
          "Nie udało się pobrać aktualnych progów. Używam wartości domyślnych."
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
        return "Wartości progów nie mogą być ujemne.";
      }
      if (val < prevVal) {
        return `Próg dla poziomu "${rankLabelMap[r]}" jest niższy niż dla "${prevRank && rankLabelMap[prevRank]}". Utrzymaj rosnące wartości.`;
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
    setThresholds((prev) => ({
      ...prev,
      [rank]: Number.isNaN(value) ? 0 : value,
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
    setSuccess(`Zastosowano preset: ${preset}`);
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    setError(null);
    setSuccess("Przywrócono domyślne progi (0 / 20 / 50 / 100).");
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
        setError(`Nie udało się zapisać progów: ${error.message}`);
      } else {
        setSuccess("Zmiany zostały zapisane.");

        // 🔔 powiadom sidebar (AppSidebar), że progi się zmieniły
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("rank-thresholds-updated"));
        }
      }
    } catch (e: any) {
      console.error(e);
      setError("Wystąpił nieoczekiwany błąd podczas zapisu.");
    } finally {
      setSaving(false);
    }
  };

  /* ============================= Render ============================= */

  return (
    <div className="flex h-full flex-col">
      {/* zamiast Toolbar – zwykły header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Poziomy scouta
            </h1>
            <p className="mt-1 text-sm text-dark dark:text-neutral-300">
              Ustal, od ilu punktów użytkownik otrzymuje Bronze / Silver / Gold
              / Platinum.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Domyślne
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
                Zapisuję…
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Zapisz
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2.2fr),minmax(0,1.1fr)]">
        {/* Main configuration card */}
        <Card className="border-slate-200 dark:border-neutral-800">
          <CardHeader className="pb-3 space-y-3">
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <span>Konfiguracja poziomów</span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                Bronze / Silver / Gold / Platinum:{" "}
                <span className="font-semibold text-slate-900 dark:text-neutral-50">
                  {thresholdsSummary}
                </span>
              </span>
            </CardTitle>

            {/* Krótka instrukcja */}
            <div className="flex flex-wrap items-start gap-2 rounded-md bg-stone-100 px-3 py-2 text-[11px] text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-800">
              <Info className="mt-[1px] h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <div className="space-y-0.5">
                <p>
                  <span className="font-semibold">Formuła wyniku:</span>{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[11px] dark:bg-white/10">
                    wynik = 2 × aktywni zawodnicy + obserwacje (final)
                  </code>
                </p>
                <p>
                  Wynik decyduje o poziomie (rank) widocznym w panelu oraz
                  pasku postępu.
                </p>
              </div>
            </div>

            {/* Presety */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-muted-foreground">Presety skali:</span>
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
          </CardHeader>

          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Ładowanie aktualnych progów…
              </div>
            ) : (
              <div className="space-y-3">
                {ORDER.map((rankKey) => {
                  const value = thresholds[rankKey] ?? 0;
                  return (
                    <div
                      key={rankKey}
                      className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white/70 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${rankBadgeClass[rankKey]}`}
                          >
                            {rankLabelMap[rankKey]}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {rankDescriptionMap[rankKey]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            Minimalny wynik
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => adjustValue(rankKey, -5)}
                              disabled={saving}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              id={`rank-${rankKey}`}
                              type="number"
                              min={0}
                              value={value}
                              onChange={(e) =>
                                handleChange(
                                  rankKey,
                                  Number(e.target.value)
                                )
                              }
                              className="h-7 w-20 text-center text-xs"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => adjustValue(rankKey, +5)}
                              disabled={saving}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
          </CardContent>
        </Card>

        {/* Right column – szybka ściąga + preview */}
        <Card className="border-slate-200 bg-stone-100/70 dark:border-neutral-800 dark:bg-neutral-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Info className="h-4 w-4 text-indigo-500" />
              Szybka ściąga
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div>
              <p className="mb-1 font-medium text-foreground">
                Co liczymy do wyniku?
              </p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Zawodnicy: tylko rekordy w{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[10px] dark:bg-white/10">
                    players
                  </code>{" "}
                  ze statusem{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[10px] dark:bg-white/10">
                    active
                  </code>
                  .
                </li>
                <li>
                  Obserwacje: tylko rekordy w{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[10px] dark:bg-white/10">
                    observations
                  </code>{" "}
                  ze statusem{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[10px] dark:bg-white/10">
                    final
                  </code>
                  .
                </li>
              </ul>
            </div>

            <div className="rounded-md bg-white/70 p-2.5 text-[11px] ring-1 ring-slate-200 dark:bg-neutral-950/60 dark:ring-neutral-800">
              <p className="font-medium text-foreground">
                Przykład (podgląd poziomu)
              </p>
              <p className="mt-1">
                Załóżmy:{" "}
                <strong>{samplePlayers} aktywnych zawodników</strong> i{" "}
                <strong>{sampleObs} obserwacji (final)</strong>.
              </p>
              <p className="mt-1">
                <code className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                  wynik = 2 × {samplePlayers} + {sampleObs} = {sampleScore} pkt
                </code>
              </p>
              <p className="mt-1">
                Przy aktualnych progach taki użytkownik ma poziom{" "}
                <strong>{rankLabelMap[sampleRank]}</strong>.
              </p>
            </div>

            <div>
              <p className="mb-1 font-medium text-foreground">
                Krótkie zasady
              </p>
              <ul className="list-disc space-y-1 pl-4">
                <li>Progi powinny rosnąć: Bronze ≤ Silver ≤ Gold ≤ Platinum.</li>
                <li>Bronze zwykle zostaw na 0 – każdy aktywny użytkownik.</li>
                <li>
                  Ustaw Silver/Gold/Platinum pod realną aktywność Twojego
                  zespołu.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
