// src/shared/hooks/useRankUpModal.tsx
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy, Sparkles, ArrowUpRight } from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";

/* ==== Types & helpers (spójne z AppSidebar) ==== */
type Rank = "bronze" | "silver" | "gold" | "platinum";

const DEFAULT_RANK_THRESHOLDS: Record<Rank, number> = {
  bronze: 0,
  silver: 20,
  gold: 50,
  platinum: 100,
};

const RANK_ORDER: Rank[] = ["bronze", "silver", "gold", "platinum"];

const calcScore = (players: number, observations: number) =>
  players * 2 + observations;

function calcRank(
  players: number,
  observations: number,
  thresholds: Record<Rank, number>
) {
  const score = calcScore(players, observations);

  if (score >= thresholds.platinum)
    return { rank: "platinum" as Rank, score };
  if (score >= thresholds.gold)
    return { rank: "gold" as Rank, score };
  if (score >= thresholds.silver)
    return { rank: "silver" as Rank, score };
  return { rank: "bronze" as Rank, score };
}

const rankLabel = (r: Rank) =>
  r === "platinum"
    ? "Platinum"
    : r === "gold"
    ? "Gold"
    : r === "silver"
    ? "Silver"
    : "Bronze";

const rankSubtitle: Record<Rank, string> = {
  bronze: "Pierwsze kroki w systemie",
  silver: "Regularna praca w bazie",
  gold: "Zaawansowany poziom scoutingu",
  platinum: "Top tier – elita użytkowników",
};

function rankTrophyColor(r: Rank) {
  switch (r) {
    case "platinum":
      return "text-indigo-400";
    case "gold":
      return "text-amber-400";
    case "silver":
      return "text-slate-300";
    default:
      return "text-orange-400";
  }
}

function compareRank(a: Rank, b: Rank) {
  return RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b);
}

/* ==== Modal state type ==== */
type RankUpInfo = {
  fromRank: Rank;
  toRank: Rank;
  score: number;
  playersCount: number;
  obsCount: number;
};

/* ==== Hook ==== */
export function useRankUpModal() {
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [thresholds, setThresholds] = useState<Record<Rank, number>>(
    DEFAULT_RANK_THRESHOLDS
  );

  const [baselineRank, setBaselineRank] = useState<Rank | null>(null);
  const [baselineScore, setBaselineScore] = useState<number>(0);
  const [info, setInfo] = useState<RankUpInfo | null>(null);

  /* ---- Initial load: thresholds + current rank ---- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = getSupabase();
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        setInitialLoaded(true);
        return;
      }

      // 1) thresholds
      const { data: thData } = await supabase
        .from("rank_thresholds")
        .select("rank, min_score");

      let localThresh: Record<Rank, number> = {
        ...DEFAULT_RANK_THRESHOLDS,
      };

      if (thData) {
        for (const row of thData as { rank: string; min_score: number }[]) {
          const r = row.rank as Rank;
          if (RANK_ORDER.includes(r)) {
            localThresh[r] = row.min_score ?? DEFAULT_RANK_THRESHOLDS[r];
          }
        }
      }

      // 2) counts (tylko "pełne"): players.active + observations.final
      const [playersRes, obsRes] = await Promise.all([
        supabase
          .from("players")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "active"),
        supabase
          .from("observations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "final"),
      ]);

      if (cancelled) return;

      const playersCount = playersRes.count ?? 0;
      const obsCount = obsRes.count ?? 0;

      const { rank, score } = calcRank(
        playersCount,
        obsCount,
        localThresh
      );

      setThresholds(localThresh);
      setBaselineRank(rank);
      setBaselineScore(score);
      setInitialLoaded(true);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Check after change (np. po dodaniu zawodnika / obserwacji) ---- */
  const checkRankAfterChange = useCallback(async () => {
    const supabase = getSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    const [playersRes, obsRes] = await Promise.all([
      supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("observations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "final"),
    ]);

    const playersCount = playersRes.count ?? 0;
    const obsCount = obsRes.count ?? 0;
    const { rank: newRank, score: newScore } = calcRank(
      playersCount,
      obsCount,
      thresholds
    );

    // jeśli już znamy baseline rank i nowy jest wyższy -> pokaż popup
    if (baselineRank && compareRank(newRank, baselineRank) > 0) {
      setInfo({
        fromRank: baselineRank,
        toRank: newRank,
        score: newScore,
        playersCount,
        obsCount,
      });
    }

    setBaselineRank(newRank);
    setBaselineScore(newScore);
  }, [baselineRank, thresholds]);

  const closeModal = () => setInfo(null);

  /* ---- Modal component ---- */
  function RankUpModal() {
    return (
      <AnimatePresence>
        {info && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Card */}
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950 p-4 text-slate-50 shadow-2xl">
                {/* Glow */}
                <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen">
                  <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-indigo-500/30 blur-3xl" />
                  <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-amber-500/30 blur-3xl" />
                </div>

                <div className="relative space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900/80 ring-2 ring-indigo-500/70">
                      <motion.div
                        initial={{ rotate: -6, scale: 0.9 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 260,
                          damping: 18,
                        }}
                      >
                        <Trophy
                          className={`h-7 w-7 drop-shadow ${rankTrophyColor(
                            info.toRank
                          )}`}
                        />
                      </motion.div>
                      <motion.div
                        className="pointer-events-none absolute -top-1 -right-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black shadow"
                        initial={{ scale: 0, opacity: 0, y: -4 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 }}
                      >
                        + rank
                      </motion.div>
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900/80 px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-neutral-700/80">
                        <Sparkles className="h-3 w-3 text-amber-300" />
                        <span>Gratulacje! Awans na nowy poziom</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-sm font-semibold">
                        <span>Osiągnąłeś poziom</span>
                        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-indigo-200 ring-1 ring-indigo-500/40">
                          {rankLabel(info.toRank)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {rankSubtitle[info.toRank]} – Twoja aktywność w
                        systemie rośnie, więc odblokowujesz wyższy poziom
                        zaufania i jakości danych.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-xl bg-neutral-900/80 p-3 ring-1 ring-neutral-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Poprzedni poziom</span>
                      <span className="font-medium text-slate-100">
                        {rankLabel(info.fromRank)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Nowy poziom</span>
                      <span className="font-semibold text-amber-200">
                        {rankLabel(info.toRank)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-4 text-[11px] text-slate-300">
                      <div>
                        <span className="text-slate-400">Aktualny wynik: </span>
                        <span className="font-semibold">{info.score} pkt</span>
                      </div>
                      <div className="flex gap-3">
                        <span>
                          🧍‍♂️ {info.playersCount}{" "}
                          <span className="text-slate-400 text-[10px]">
                            aktywnych
                          </span>
                        </span>
                        <span>
                          📝 {info.obsCount}{" "}
                          <span className="text-slate-400 text-[10px]">
                            obserwacji
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-300">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex items-center gap-1 rounded-full bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-neutral-700/80 hover:bg-neutral-800"
                    >
                      Zamknij
                    </button>
                    <a
                      href="/players"
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-200 hover:text-indigo-100"
                    >
                      Zobacz progres w panelu
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return {
    RankUpModal,
    checkRankAfterChange,
    initialLoaded,
  };
}
