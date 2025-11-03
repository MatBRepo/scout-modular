// src/features/observations/ObservationEditor.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Observation, Player } from "@/shared/types";
import {
  FileEdit,
  Info,
  Users,
  ListPlus,
  Hash,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import StarRating from "@/shared/ui/StarRating";
import { loadMetrics, MetricsConfig } from "@/shared/metrics";

/* ------------ Types ------------ */
type Mode = "live" | "wideo" | "mix";
type OpponentLevel = "niski" | "średni" | "wysoki";
type PositionKey =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "CMD"
  | "CM"
  | "CAM"
  | "LW"
  | "RW"
  | "ST";

type ObsPlayer = {
  id: string;
  type: "known" | "unknown";
  name?: string;
  shirtNo?: string;

  /** Single selected position */
  position?: PositionKey;
  minutes?: number;
  overall?: number; // 1..6 stars

  base?: Record<string, number>;
  gk?: Record<string, number>;
  def?: Record<string, number>;
  mid?: Record<string, number>;
  att?: Record<string, number>;

  note?: string;
};

export type XO = Observation & {
  reportDate?: string;
  competition?: string;
  teamA?: string;
  teamB?: string;
  conditions?: Mode;
  opponent?: OpponentLevel;
  contextNote?: string;
  note?: string;
  players?: ObsPlayer[];
};

/* ------------- Utils ------------- */
function fmtDateHuman(date?: string, time?: string) {
  try {
    const d = date ? new Date(date) : null;
    if (!d) return "—";
    const dd = d.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return time ? `${dd}, ${time}` : dd;
  } catch {
    return "—";
  }
}
function parseTeams(match?: string): { a: string; b: string } {
  if (!match) return { a: "", b: "" };
  const parts = match.split(/ *vs *| *VS *| *Vs *| – | - | v\. /i);
  if (parts.length >= 2) return { a: parts[0].trim(), b: parts[1].trim() };
  return { a: match.trim(), b: "" };
}
function chip(txt: string) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
      {txt}
    </span>
  );
}

/* ------------- Small atoms ------------- */
function Section({
  title,
  description,
  right,
  children,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
            {title}
          </div>
          {description ? (
            <div className="text-xs text-gray-500 dark:text-neutral-400">
              {description}
            </div>
          ) : null}
        </div>
        {right}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Helper({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-200 dark:ring-slate-700">
      <Info className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

/** Compact metric item (no hooks). */
function MetricItem({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
      title={label}
    >
      <div className="break-words pr-2 text-[12px] text-gray-700 dark:text-neutral-300">
        {label}
      </div>
      <div className="shrink-0">
        <StarRating value={value ?? 0} onChange={onChange} /* @ts-ignore */ max={6} />
      </div>
    </div>
  );
}

/* ========================= Editor ========================= */
export function ObservationEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: XO;
  onSave: (o: XO) => void;
  onClose: () => void;
}) {
  /** Freeze the first `initial` to avoid mid-edit resets / hook reorder symptoms. */
  const frozenInitialRef = useRef<XO>(initial);
  const [o, setO] = useState<XO>(frozenInitialRef.current);

  const [tab, setTab] = useState<"basic" | "players" | "notes">("basic");
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  useEffect(() => {
    try {
      setAllPlayers(JSON.parse(localStorage.getItem("s4s.players") || "[]"));
    } catch {}
  }, []);

  const [metrics, setMetrics] = useState<MetricsConfig>(loadMetrics());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "s4s.obs.metrics") setMetrics(loadMetrics());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function set<K extends keyof XO>(key: K, val: XO[K]) {
    setO((prev) => ({ ...prev, [key]: val }));
  }

  function addKnownPlayer(name: string) {
    const p: ObsPlayer = {
      id: crypto.randomUUID(),
      type: "known",
      name: name.trim(),
      position: undefined,
      overall: 3,
      base: {},
      gk: {},
      def: {},
      mid: {},
      att: {},
    };
    setO((prev) => ({ ...prev, players: [...(prev.players ?? []), p] }));
  }
  function addUnknownQuick(shirtNo: string) {
    const n = shirtNo.trim();
    if (!n) return;
    const p: ObsPlayer = {
      id: crypto.randomUUID(),
      type: "unknown",
      shirtNo: n,
      name: `#${n}`,
      position: undefined,
      overall: 3,
      base: {},
      gk: {},
      def: {},
      mid: {},
      att: {},
    };
    setO((prev) => ({ ...prev, players: [...(prev.players ?? []), p] }));
  }
  function updatePlayer(id: string, patchPartial: Partial<ObsPlayer>) {
    setO((prev) => ({
      ...prev,
      players: (prev.players ?? []).map((p) =>
        p.id === id ? ({ ...p, ...patchPartial } as ObsPlayer) : p
      ),
    }));
  }
  function updateMetric(
    group: keyof ObsPlayer,
    _id: string,
    key: string,
    value: number,
    player: ObsPlayer
  ) {
    setO((prev) => {
      const players = (prev.players ?? []).map((p) => {
        if (p.id !== player.id) return p;
        const g = (p as any)[group] ?? {};
        return { ...p, [group]: { ...g, [key]: value } } as ObsPlayer;
      });
      return { ...prev, players };
    });
  }

  /** Positions: single-select + human labels */
  const POSITIONS: PositionKey[] = [
    "GK",
    "CB",
    "LB",
    "RB",
    "CMD",
    "CM",
    "CAM",
    "LW",
    "RW",
    "ST",
  ];
  const POS_INFO: Record<PositionKey, string> = {
    GK: "Bramkarz",
    CB: "Środkowy obrońca",
    LB: "Lewy obrońca",
    RB: "Prawy obrońca",
    CMD: "Defensywny pomocnik (6)",
    CM: "Środkowy pomocnik (8)",
    CAM: "Ofensywny pomocnik (10)",
    LW: "Lewy skrzydłowy (11)",
    RW: "Prawy skrzydłowy (7)",
    ST: "Środkowy napastnik (9)",
  };

  function removePlayer(id: string) {
    setO((prev) => ({
      ...prev,
      players: (prev.players ?? []).filter((p) => p.id !== id),
    }));
  }

  /* Team vs Team */
  const initialTeams = useMemo(() => parseTeams(o.match), []); // seed once
  const [teamA, setTeamA] = useState(initialTeams.a);
  const [teamB, setTeamB] = useState(initialTeams.b);
  useEffect(() => {
    const { a, b } = parseTeams(o.match);
    setTeamA(a);
    setTeamB(b);
  }, [o.match]);
  function updateMatchFromTeams(a: string, b: string) {
    setTeamA(a);
    setTeamB(b);
    const composed =
      a.trim() && b.trim()
        ? `${a.trim()} vs ${b.trim()}`
        : (a + " " + b).trim();
    set("match", composed);
  }

  const headerMeta = `${fmtDateHuman(o.date, o.time)} • ${
    o.players?.length ?? 0
  } zawodn.`;

  /* Autosave */
  const [saveState, setSaveState] =
    useState<"idle" | "saving" | "saved">("idle");
  const draftKey = useMemo(
    () => `s4s.observations.editor.draft.${o.id || "new"}`,
    [o.id]
  );
  const tRef = useRef<number | null>(null);

  // one-time load from draft (no early return)
  const loadedDraftOnce = useRef(false);
  useEffect(() => {
    if (loadedDraftOnce.current) return;
    loadedDraftOnce.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) setO((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSaveState("saving");
    if (tRef.current) window.clearTimeout(tRef.current);
    // @ts-ignore
    tRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ ...o, _ts: Date.now() })
        );
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 800);
      } catch {
        setSaveState("idle");
      }
    }, 600);
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [o, draftKey]);

  function handleSave() {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    onSave(o);
  }

  /* Quick add */
  const [quickInput, setQuickInput] = useState("");
  const knownMatches = useMemo(() => {
    const q = quickInput.trim().toLowerCase();
    if (!q) return [];
    return allPlayers
      .filter((p) => p.status === "active")
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.club || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [allPlayers, quickInput]);

  /** Accordion: only one details row open at a time */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const OPPONENT_LEVELS: OpponentLevel[] = ["niski", "średni", "wysoki"];
  const CONDITIONS: Mode[] = ["live", "wideo", "mix"];

  /* Render */
  return (
    <div className="w-full">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Obserwacje", href: "/observations" },
          { label: o.id ? "Edycja" : "Nowa" },
        ]}
      />

      <Toolbar
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Mecz: {o.match || "—"}</span>
            <span className="text-xs text-gray-500">{headerMeta}</span>
          </div>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            {saveState !== "idle" && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                  saveState === "saving"
                    ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/50"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-800/50"
                }`}
              >
                {saveState === "saving" ? "Zapisywanie…" : "Zapisano"}
              </span>
            )}
            <Button
              variant="outline"
              className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
              onClick={onClose}
            >
              Anuluj
            </Button>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring focus-visible:ring-indigo-500/60"
              onClick={handleSave}
            >
              Zapisz
            </Button>
          </div>
        }
      />

      <Card className="mt-4 border-gray-300 dark:border-neutral-700">
        <CardHeader className="border-b border-gray-200 pb-0 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg sm:text-xl">Formularz obserwacji</CardTitle>
            <Helper>Podstawowe dane + zawodnicy + notatki</Helper>
          </div>

          <div className="sticky top-0 z-[5] -mx-6 mt-4 border-b border-gray-200 bg-white/90 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="py-3">
              <TabsList className="flex w-full justify-start gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-neutral-900">
                <TabsTrigger
                  value="basic"
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-700 transition data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-neutral-100"
                >
                  Podstawowe
                </TabsTrigger>
                <TabsTrigger
                  value="players"
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-700 transition data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-neutral-100"
                >
                  Zawodnicy
                  {o.players?.length ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                      {o.players.length}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-700 transition data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-neutral-100"
                >
                  Notatki
                </TabsTrigger>
              </TabsList>

              <CardContent className="space-y-6 px-3 py-6 sm:px-0">
                {/* BASIC */}
                <TabsContent value="basic" className="space-y-6">
                  <Section
                    title="Informacje ogólne"
                    description="Czas, liga/turniej i kontekst."
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label>Data raportu</Label>
                        <Input
                          type="date"
                          value={o.reportDate ?? ""}
                          onChange={(e) => set("reportDate", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Mecz jakiej ligi/turnieju</Label>
                        <Input
                          value={o.competition ?? ""}
                          onChange={(e) => set("competition", e.target.value)}
                          placeholder="np. CLJ U19, Puchar"
                        />
                      </div>
                      <div>
                        <Label>Poziom rywala</Label>
                        <select
                          value={o.opponent ?? ""}
                          onChange={(e) =>
                            set("opponent", e.target.value as OpponentLevel)
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                        >
                          <option value="">— wybierz —</option>
                          {["niski", "średni", "wysoki"].map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Warunki obserwacji</Label>
                        <select
                          value={o.conditions ?? "live"}
                          onChange={(e) =>
                            set("conditions", e.target.value as Mode)
                          }
                          className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                        >
                          {(["live", "wideo", "mix"] as const).map((x) => (
                            <option key={x} value={x}>
                              {x === "wideo" ? "Wideo" : x === "mix" ? "Mix" : "Live"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Uwagi kontekstowe</Label>
                        <Textarea
                          value={o.contextNote ?? ""}
                          onChange={(e) => set("contextNote", e.target.value)}
                          placeholder="Krótki kontekst (warunki, cel)…"
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  </Section>

                  <Section
                    title="Mecz"
                    description="Wpisz drużyny — pole „Mecz” składa się automatycznie."
                  >
                    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                      <div>
                        <Label>Drużyna A</Label>
                        <Input
                          value={teamA}
                          onChange={(e) =>
                            updateMatchFromTeams(e.target.value, teamB)
                          }
                          placeholder="np. Lech U19"
                        />
                      </div>
                      <div className="hidden select-none items-end justify-center pb-2 text-sm text-gray-500 sm:flex">
                        vs
                      </div>
                      <div>
                        <Label>Drużyna B</Label>
                        <Input
                          value={teamB}
                          onChange={(e) =>
                            updateMatchFromTeams(teamA, e.target.value)
                          }
                          placeholder="np. Legia U19"
                        />
                      </div>
                      <div className="sm:hidden text-center text-sm text-gray-500">
                        vs
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label>Data meczu</Label>
                        <Input
                          type="date"
                          value={o.date ?? ""}
                          onChange={(e) => set("date", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Godzina meczu</Label>
                        <Input
                          type="time"
                          value={o.time ?? ""}
                          onChange={(e) => set("time", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-neutral-400">
                      Mecz: <span className="font-medium">{o.match || "—"}</span>
                      <span className="ml-2">{chip(o.conditions ?? "live")}</span>
                      {o.opponent ? (
                        <span className="ml-2">{chip(`Rywal: ${o.opponent}`)}</span>
                      ) : null}
                    </div>
                  </Section>
                </TabsContent>

                {/* PLAYERS */}
                <TabsContent value="players" className="space-y-4">
                  <Section
                    title="Zawodnicy"
                    description="Szybkie dodawanie i zwięzła edycja."
                    right={
                      <span className="hidden items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 md:inline-flex dark:bg-indigo-900/30 dark:text-indigo-200">
                        <Users className="h-3.5 w-3.5" /> {o.players?.length ?? 0} zapisanych
                      </span>
                    }
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Input
                          value={quickInput}
                          onChange={(e) => setQuickInput(e.target.value)}
                          placeholder='Imię i nazwisko lub wpisz "#27" (nieznany)'
                          className="pr-24"
                        />
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                          Szybkie dodawanie
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="border-gray-300 dark:border-neutral-700"
                          onClick={() => {
                            if (!quickInput.trim()) return;
                            quickInput.startsWith("#")
                              ? addUnknownQuick(quickInput.replace(/^#/, ""))
                              : addKnownPlayer(quickInput);
                            setQuickInput("");
                          }}
                          disabled={!quickInput.trim()}
                          title="Dodaj zawodnika"
                        >
                          <ListPlus className="mr-1 h-4 w-4" /> Dodaj
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gray-300 dark:border-neutral-700"
                          onClick={() => {
                            if (!quickInput.trim()) return;
                            addUnknownQuick(quickInput.replace(/^#/, ""));
                            setQuickInput("");
                          }}
                          disabled={!quickInput.trim()}
                          title="Dodaj nieznanego (#)"
                        >
                          <Hash className="mr-1 h-4 w-4" /> #Numer
                        </Button>
                      </div>
                    </div>
                    {knownMatches.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {knownMatches.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              if (p.name) addKnownPlayer(p.name);
                              setQuickInput("");
                            }}
                            className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                          >
                            {p.name} {p.club ? `• ${p.club}` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </Section>

                  <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
                        <tr className="text-xs sm:text-sm">
                          <th className="p-2 text-left font-medium sm:p-3">Zawodnik</th>
                          <th className="p-2 text-left font-medium sm:p-3">Pozycja</th>
                          <th className="p-2 text-left font-medium sm:p-3">Minuty</th>
                          <th className="p-2 text-left font-medium sm:p-3">Ocena</th>
                          <th className="p-2 text-right font-medium sm:p-3">Akcje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(o.players ?? []).map((p) => {
                          const isOpen = expandedId === p.id;
                          return (
                            <tr
                              key={p.id}
                              className="border-t border-gray-200 align-middle hover:bg-gray-50/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                            >
                              <td className="p-2 sm:p-3">
                                <div className="flex items-start gap-2">
                                  <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 sm:mt-1" />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-gray-900 dark:text-neutral-100">
                                      {p.type === "known"
                                        ? p.name ?? "—"
                                        : p.name ?? `#${p.shirtNo ?? ""}`}
                                    </div>
                                    <div className="text-[11px] text-gray-500 dark:text-neutral-400">
                                      {p.type === "known" ? "znany" : "nieznany"}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Position — SELECT (single) with readable labels */}
                              <td className="p-2 sm:p-3">
                                <label className="sr-only" htmlFor={`pos-${p.id}`}>
                                  Pozycja
                                </label>
                                <select
                                  id={`pos-${p.id}`}
                                  value={p.position ?? ""}
                                  onChange={(e) =>
                                    updatePlayer(p.id, {
                                      position: (e.target.value || undefined) as
                                        | PositionKey
                                        | undefined,
                                    })
                                  }
                                  className="w-[11rem] rounded-md border border-gray-300 bg-white p-2 text-xs sm:text-sm dark:border-neutral-700 dark:bg-neutral-950"
                                  title={
                                    p.position
                                      ? `${p.position} — ${POS_INFO[p.position]}`
                                      : "Wybierz pozycję"
                                  }
                                >
                                  <option value="">— wybierz pozycję —</option>
                                  {POSITIONS.map((pos) => (
                                    <option key={pos} value={pos}>
                                      {pos} — {POS_INFO[pos]}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="p-2 sm:p-3">
                                <Input
                                  type="number"
                                  min={0}
                                  max={120}
                                  value={p.minutes ?? ""}
                                  onChange={(e) =>
                                    updatePlayer(p.id, {
                                      minutes:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    })
                                  }
                                  placeholder="min"
                                  className="h-8 w-16 sm:w-20"
                                />
                              </td>

                              <td className="p-2 sm:p-3">
                                <StarRating
                                  value={p.overall ?? 0}
                                  onChange={(v) => updatePlayer(p.id, { overall: v })}
                                  /* @ts-ignore */
                                  max={6}
                                />
                              </td>

                              <td className="p-2 text-right sm:p-3">
                                <div className="inline-flex items-center gap-1 sm:gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-gray-300 dark:border-neutral-700"
                                    onClick={() =>
                                      setExpandedId((cur) => (cur === p.id ? null : p.id))
                                    }
                                    title={isOpen ? "Ukryj szczegóły" : "Pokaż szczegóły"}
                                  >
                                    {isOpen ? (
                                      <>
                                        <ChevronUp className="mr-1 h-4 w-4" />
                                        <span className="hidden sm:inline">Szczegóły</span>
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="mr-1 h-4 w-4" />
                                        <span className="hidden sm:inline">Szczegóły</span>
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-gray-300 text-red-600 dark:border-neutral-700"
                                    onClick={() => removePlayer(p.id)}
                                    title="Usuń zawodnika"
                                  >
                                    Usuń
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {(o.players ?? []).length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-6 text-center text-sm text-gray-500 dark:text-neutral-400"
                            >
                              Brak zawodników — dodaj kogoś powyżej.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Details — only the expandedId is shown */}
                    {(o.players ?? []).map((p) => {
                      if (expandedId !== p.id) return null;

                      const pos = p.position;
                      const showGK = pos === "GK";
                      const showDEF = pos === "CB" || pos === "LB" || pos === "RB";
                      const showMID = pos === "CMD" || pos === "CM" || pos === "CAM";
                      const showATT = pos === "LW" || pos === "RW" || pos === "ST";

                      const Group = ({
                        title,
                        children,
                      }: {
                        title: string;
                        children: React.ReactNode;
                      }) => (
                        <div className="mt-3">
                          <div className="sticky left-0 top-0 z-[1] mb-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800">
                            {title}
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                            {children}
                          </div>
                        </div>
                      );

                      return (
                        <div
                          key={p.id}
                          className="border-t border-gray-200 p-3 text-sm dark:border-neutral-800"
                        >
                          {/* BASE – compact metric grid */}
                          <Group title="Kategorie bazowe">
                            {metrics.BASE.filter((m) => m.enabled).map((m) => (
                              <MetricItem
                                key={m.id}
                                label={m.label}
                                value={p.base?.[m.key]}
                                onChange={(v) =>
                                  updateMetric("base", m.id, m.key, v, p)
                                }
                              />
                            ))}
                          </Group>

                          {/* GK */}
                          {showGK && (
                            <Group title="Bramkarz (GK)">
                              {metrics.GK.filter((m) => m.enabled).map((m) => (
                                <MetricItem
                                  key={m.id}
                                  label={m.label}
                                  value={p.gk?.[m.key]}
                                  onChange={(v) =>
                                    updateMetric("gk", m.id, m.key, v, p)
                                  }
                                />
                              ))}
                            </Group>
                          )}

                          {/* DEF */}
                          {showDEF && (
                            <Group title="Obrońca (CB/FB/WB)">
                              {metrics.DEF.filter((m) => m.enabled).map((m) => (
                                <MetricItem
                                  key={m.id}
                                  label={m.label}
                                  value={p.def?.[m.key]}
                                  onChange={(v) =>
                                    updateMetric("def", m.id, m.key, v, p)
                                  }
                                />
                              ))}
                            </Group>
                          )}

                          {/* MID */}
                          {showMID && (
                            <Group title="Pomocnik (6/8/10)">
                              {metrics.MID.filter((m) => m.enabled).map((m) => (
                                <MetricItem
                                  key={m.id}
                                  label={m.label}
                                  value={p.mid?.[m.key]}
                                  onChange={(v) =>
                                    updateMetric("mid", m.id, m.key, v, p)
                                  }
                                />
                              ))}
                            </Group>
                          )}

                          {/* ATT */}
                          {showATT && (
                            <Group title="Napastnik (9/7/11)">
                              {metrics.ATT.filter((m) => m.enabled).map((m) => (
                                <MetricItem
                                  key={m.id}
                                  label={m.label}
                                  value={p.att?.[m.key]}
                                  onChange={(v) =>
                                    updateMetric("att", m.id, m.key, v, p)
                                  }
                                />
                              ))}
                            </Group>
                          )}

                          {/* Note */}
                          <div className="mt-4">
                            <div className="mb-1 text-xs text-gray-500 dark:text-neutral-400">
                              Notatka do zawodnika
                            </div>
                            <Textarea
                              value={p.note ?? ""}
                              onChange={(e) =>
                                updatePlayer(p.id, { note: e.target.value })
                              }
                              placeholder="Notatka o zawodniku…"
                              className="min-h-[80px]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* NOTES */}
                <TabsContent value="notes" className="space-y-6">
                  <Section
                    title="Notatka do obserwacji"
                    description="Krótki opis, kontekst, obserwacje ogólne."
                  >
                    <div className="space-y-2">
                      <Label>Notatka tekstowa</Label>
                      <Textarea
                        value={o.note ?? ""}
                        onChange={(e) => set("note", e.target.value)}
                        placeholder="Krótka notatka…"
                        className="min-h-[140px]"
                      />
                      <div className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-400">
                        <FileEdit className="h-3.5 w-3.5" /> Notatka dot. całej
                        obserwacji.
                      </div>
                    </div>
                  </Section>
                </TabsContent>
              </CardContent>
            </Tabs>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
