"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Observation, Player } from "@/shared/types";
import {
  Users,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FileEdit,
  Loader2,
  CheckCircle2,
  PlayCircle,
  Monitor,
  Search,
} from "lucide-react";
import StarRating from "@/shared/ui/StarRating";
import { loadMetrics, type MetricsConfig } from "@/shared/metrics";
import { AddPlayerIcon } from "@/components/icons";

/* ------------ Types ------------ */
type Mode = "live" | "tv";
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
  contextNote?: string;
  note?: string;
  players?: ObsPlayer[];
  __listMeta?: {
    id: number;
    status: "draft" | "final";
    bucket: "active" | "trash";
    time: string;
    player: string;
  };
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

function isNumberLike(value: string) {
  return /^[0-9]{1,3}$/.test(value.trim());
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
    <section className="w-full rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-neutral-50">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400">
              {description}
            </p>
          ) : null}
        </div>
        {right}
      </div>
      <div className="space-y-4 sm:space-y-5">{children}</div>
    </section>
  );
}

/* 🔁 SavePill – jak w AddPlayerPage.tsx */
function SavePill({ state }: { state: "idle" | "saving" | "saved" }) {
  const base =
    "inline-flex h-10 items-center rounded border px-3 text-sm leading-none";
  const map = {
    saving:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100",
    saved:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100",
    idle:
      "border-gray-300 bg-white text-gray-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200",
  } as const;
  return (
    <span className={`${base} ${map[state]}`} aria-live="polite">
      {state === "saving" ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Zapisywanie…
        </>
      ) : state === "saved" ? (
        <>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Zapisano
        </>
      ) : (
        "—"
      )}
    </span>
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
      className="group flex flex-wrap items-center justify-between gap-3 rounded border border-stone-200 bg-stone-50/90 px-3 py-2 text-xs shadow-sm transition hover:bg-stone-100 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
      title={label}
    >
      <div className="w-full break-words pr-2 text-[12px] text-gray-700 dark:text-neutral-300">
        {label}
      </div>
      <div className="shrink-0">
        <StarRating
          value={value ?? 0}
          onChange={onChange}
          /* @ts-ignore */
          max={6}
        />
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
  /** Freeze the first `initial` to avoid mid-edit resets. */
  const frozenInitialRef = useRef<XO>(initial);

  const [o, setO] = useState<XO>(() => {
    const base = frozenInitialRef.current;
    const meta = base.__listMeta ?? {
      id: base.id ?? 0,
      status: (base as any).status ?? "draft",
      bucket: "active" as const,
      time: (base as any).time ?? "",
      player: (base as any).player ?? "",
    };
    return {
      conditions: "live",
      ...base,
      __listMeta: meta,
    };
  });

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  useEffect(() => {
    try {
      setAllPlayers(JSON.parse(localStorage.getItem("s4s.players") || "[]"));
    } catch {}
  }, []);

  const [metrics, setMetrics] = useState<MetricsConfig>(loadMetrics());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "s4s.obs.metrics") {
        setMetrics(loadMetrics());
      }
      if (e.key === "s4s.players") {
        try {
          setAllPlayers(JSON.parse(localStorage.getItem("s4s.players") || "[]"));
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function setField<K extends keyof XO>(key: K, val: XO[K]) {
    setO((prev) => ({ ...prev, [key]: val }));
  }

  function setMeta<K extends keyof NonNullable<XO["__listMeta"]>>(
    key: K,
    val: NonNullable<XO["__listMeta"]>[K]
  ) {
    setO((prev) => ({
      ...prev,
      __listMeta: { ...(prev.__listMeta as any), [key]: val },
    }));
  }

  function addPlayerKnown(name: string, shirtNo?: string) {
    const p: ObsPlayer = {
      id: crypto.randomUUID(),
      type: "known",
      name: name.trim(),
      shirtNo: shirtNo,
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

  function addPlayerUnknownFromNumber(no: string) {
    const n = no.trim();
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
  const [teamA, setTeamA] = useState(o.teamA ?? "");
  const [teamB, setTeamB] = useState(o.teamB ?? "");

  useEffect(() => {
    setTeamA(o.teamA ?? "");
    setTeamB(o.teamB ?? "");
  }, [o.teamA, o.teamB]);

  function updateMatchFromTeams(a: string, b: string) {
    setTeamA(a);
    setTeamB(b);
    setField("teamA", a);
    setField("teamB", b);
    const composed =
      a.trim() && b.trim()
        ? `${a.trim()} vs ${b.trim()}`
        : (a + " " + b).trim();
    setField("match", composed);
  }

  const headerMeta = `${fmtDateHuman(
    o.reportDate || (o as any).date,
    o.__listMeta?.time || (o as any).time
  )} • ${(o.players?.length ?? 0)} zawodników`;

  /* Autosave – idle → saving → saved */
  const [saveState, setSaveState] =
    useState<"idle" | "saving" | "saved">("idle");
  const draftKey = useMemo(
    () => `s4s.observations.editor.draft.${o.id || "new"}`,
    [o.id]
  );
  const tRef = useRef<number | null>(null);

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

  /* Quick add – jedno pole, jeden przycisk */
  const [quickInput, setQuickInput] = useState("");
  const filteredPlayers = useMemo(() => {
    const q = quickInput.trim().toLowerCase();
    if (!q || isNumberLike(q)) return [];
    return allPlayers
      .filter((p: any) => p.status === "active")
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.club || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [allPlayers, quickInput]);

  function addPlayerFromInput(source?: Player) {
    if (source) {
      addPlayerKnown(source.name || "", (source as any).shirtNo);
      setQuickInput("");
      return;
    }

    const raw = quickInput.trim();
    if (!raw) return;

    if (isNumberLike(raw)) {
      addPlayerUnknownFromNumber(raw);
      setQuickInput("");
      return;
    }

    const found = allPlayers.find(
      (p) => (p.name || "").toLowerCase() === raw.toLowerCase()
    );
    if (found && found.name) {
      addPlayerKnown(found.name, (found as any).shirtNo);
    } else {
      const p: ObsPlayer = {
        id: crypto.randomUUID(),
        type: "unknown",
        name: raw,
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
    setQuickInput("");
  }

  /** Accordion: only one details row open at a time */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const CONDITIONS: Mode[] = ["live", "tv"];

  /* Modal: dodanie zawodnika do bazy */
  const [promotePlayer, setPromotePlayer] = useState<ObsPlayer | null>(null);
  const [newPlayerClub, setNewPlayerClub] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] =
    useState<PositionKey | "">("");

function handlePromotePlayerSave() {
  if (!promotePlayer) return;
  const rawName = (promotePlayer.name || "").replace(/^#/, "").trim();
  if (!rawName) {
    setPromotePlayer(null);
    return;
  }

  const exists = allPlayers.some(
    (p) => (p.name || "").toLowerCase() === rawName.toLowerCase()
  );
  if (exists) {
    setPromotePlayer(null);
    return;
  }

const base: Partial<Player> = {
  id: Date.now(), // number – pasuje do Player.id
  status: "active" as any,
  name: rawName,
  club: newPlayerClub.trim() || undefined,
  // ✅ używamy pola, które faktycznie istnieje w Player, np. "pos"
  pos: (newPlayerPosition || promotePlayer.position) as any,
};

const player = base as unknown as Player;

const next = [...allPlayers, player];
setAllPlayers(next);
try {
  localStorage.setItem("s4s.players", JSON.stringify(next));
  window.dispatchEvent(new StorageEvent("storage", { key: "s4s.players" }));
} catch {}

  setPromotePlayer(null);
  setNewPlayerClub("");
  setNewPlayerPosition("");
}

  const status = o.__listMeta?.status ?? "draft";

  /* Render */
  return (
    <div className="w-full">
      {/* TOP BAR */}
      <Toolbar
        title={
          <div className="mb-3 flex flex-col gap-1">
            <span className="text-lg font-semibold">
              Mecz:&nbsp;{o.match || "—"}
            </span>
            <span className="text-xs text-dark dark:text-neutral-300">
              {headerMeta}
            </span>
          </div>
        }
        right={
          <div className="mb-4 flex w-full items-center gap-3 md:flex-nowrap">
            {/* 1) Ładny switcher Szkic / Finalna */}
            <div className="inline-flex h-10 items-center rounded border border-slate-300 bg-white p-0.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => setMeta("status", "draft")}
                className={`inline-flex h-8 items-center gap-1 rounded px-3 py-1 font-medium transition ${
                  status === "draft"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                Szkic
              </button>
              <button
                type="button"
                onClick={() => setMeta("status", "final")}
                className={`inline-flex h-8 items-center gap-1 rounded px-3 py-1 font-medium transition ${
                  status === "final"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                Finalna
              </button>
            </div>

            {/* 2) Po prawej: Zapisano + Wróć do listy */}
            <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
              <SavePill state={saveState} />
              <Button
                className="h-10 bg-gray-900 text-white hover:bg-gray-800"
                onClick={() => {
                  handleSave();
                  onClose();
                }}
              >
                Wróć do listy
              </Button>
            </div>
          </div>
        }
      />

      <div className="mt-4 space-y-6">
        {/* 1) Informacje ogólne */}
        <Section
          title="Informacje ogólne"
          description="Wpisz drużyny — pole „Mecz” składa się automatycznie."
        >
          {/* Mecz (readonly) */}
          <div>
            <Label className="text-sm">Mecz</Label>
            <Input
              value={o.match || ""}
              readOnly
              className="mt-1 h-9 cursor-not-allowed bg-gray-50/80 text-sm dark:bg-neutral-900"
              placeholder="Wpisz drużyny — pole „Mecz” składa się automatycznie."
            />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
              Ustaw drużyny poniżej. Ta nazwa meczu generuje się sama.
            </p>
          </div>

          {/* Drużyna A / B + VS z linią */}
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <Label className="text-sm">Drużyna A</Label>
              <Input
                value={teamA}
                onChange={(e) => updateMatchFromTeams(e.target.value, teamB)}
                placeholder="np. U19 Liga"
              />
            </div>

            {/* separator z linią i „vs” */}
            <div className="relative flex items-center justify-center md:h-full">
              <div className="h-px w-10/12 bg-slate-200 md:h-full md:w-px" />
              <div className="absolute rounded bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm dark:bg-neutral-900 dark:text-neutral-200">
                vs
              </div>
            </div>

            <div>
              <Label className="text-sm">Drużyna B</Label>
              <Input
                value={teamB}
                onChange={(e) => updateMatchFromTeams(teamA, e.target.value)}
                placeholder="np. Legia U19"
              />
            </div>
          </div>

          {/* Data / Godzina */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm">Data meczu</Label>
              <Input
                type="date"
                value={o.reportDate ?? ""}
                onChange={(e) => setField("reportDate", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">Godzina meczu</Label>
              <Input
                type="time"
                value={o.__listMeta?.time ?? ""}
                onChange={(e) => setMeta("time", e.target.value)}
              />
            </div>
          </div>

          {/* Tryb meczu Live / TV – lepsze kafelki */}
          <div>
            <Label className="text-sm">Tryb meczu</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {CONDITIONS.map((mode) => {
                const isActive = (o.conditions ?? "live") === mode;
                const isLive = mode === "live";

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setField("conditions", mode)}
                    className={[
                      "flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs transition",
                      isActive
                        ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 dark:border-indigo-400 dark:bg-indigo-900/30 dark:ring-indigo-500/60"
                        : "border-gray-200 bg-white hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      {isLive ? (
                        <PlayCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                      ) : (
                        <Monitor className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                      )}
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-800 dark:text-neutral-50">
                          {isLive ? "Live" : "TV"}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-neutral-400">
                          {isLive
                            ? "Na żywo z boiska"
                            : "Transmisja / wideo"}
                        </div>
                      </div>
                    </div>
                    {isActive && (
                      <span className="ml-2 h-2 w-2 rounded bg-indigo-500 shadow-[0_0_0_4px_rgba(79,70,229,0.25)] dark:bg-indigo-300" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
              Mecz: {(o.conditions ?? "live") === "live" ? "Live (boisko)" : "TV / wideo"}
            </p>
          </div>

          {/* Liga/turniej */}
          <div>
            <Label className="text-sm">Liga / turniej</Label>
            <Input
              value={o.competition ?? ""}
              onChange={(e) => setField("competition", e.target.value)}
              placeholder="np. CLJ U19, Puchar Polski"
            />
          </div>
        </Section>

        {/* 2) Zawodnicy */}
        <Section
          title="Zawodnicy"
          description="Jeden input – numer lub nazwisko, dropdown z wynikami i szczegóły pod wierszem zawodnika."
          right={
            <span className="inline-flex h-8 items-center gap-1 rounded bg-indigo-50 px-2 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200">
              <Users className="h-3.5 w-3.5" /> {o.players?.length ?? 0} zapisanych
            </span>
          }
        >
          {/* Searcher + jeden przycisk */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Label className="text-sm">Numer lub nazwisko zawodnika</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPlayerFromInput();
                    }
                  }}
                  placeholder="np. 9 lub Piotr Nowak"
                  className="pl-8 pr-24"
                />
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                  Dodaj zawodnika
                </div>
              </div>

              {/* Dropdown z wynikami wyszukiwania */}
              {filteredPlayers.length > 0 && (
                <div className="absolute left-0 right-0 top-[100%] z-20 mt-1 rounded border border-gray-200 bg-white text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-950">
                  {filteredPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-neutral-800"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addPlayerFromInput(p)}
                    >
                      <span>{p.name}</span>
                      {p.club && (
                        <span className="text-[11px] text-gray-500 dark:text-neutral-400">
                          {p.club}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="mt-1 h-10 border-gray-300 dark:border-neutral-700 sm:mt-6"
              onClick={() => addPlayerFromInput()}
              disabled={!quickInput.trim()}
              title="Dodaj zawodnika"
            >
              Dodaj
            </Button>
          </div>

          {/* Tabela zawodników */}
          <div className="w-full overflow-x-auto rounded border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-dark dark:bg-neutral-900 dark:text-neutral-300">
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

                  const pos = p.position;
                  const showGK = pos === "GK";
                  const showDEF = pos === "CB" || pos === "LB" || pos === "RB";
                  const showMID =
                    pos === "CMD" || pos === "CM" || pos === "CAM";
                  const showATT = pos === "LW" || pos === "RW" || pos === "ST";

                  const normalizedName = (p.name || "").replace(/^#/, "").trim();
                  const inBase =
                    !!normalizedName &&
                    allPlayers.some(
                      (bp) =>
                        (bp.name || "").toLowerCase() ===
                        normalizedName.toLowerCase()
                    );

                  return (
                    <Fragment key={p.id}>
                      {/* Wiersz główny */}
                      <tr className="border-t border-gray-200 align-middle hover:bg-stone-50/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
                        <td className="p-2 sm:p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 sm:mt-1" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-900 dark:text-neutral-100">
                                {p.type === "known"
                                  ? p.name ?? "—"
                                  : p.name ?? `#${p.shirtNo ?? ""}`}
                              </div>
                              <div className="text-[11px] text-dark dark:text-neutral-400">
                                {p.type === "known" ? "znany" : "nieznany"}
                              </div>
                              {p.shirtNo && (
                                <div className="mt-0.5 text-[11px] text-stone-700 dark:text-stone-200">
                                  Nr: {p.shirtNo}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-2 sm:p-3">
                          <label className="sr-only" htmlFor={`pos-${p.id}`}>
                            Pozycja
                          </label>
                          <select
                            id={`pos-${p.id}`}
                            value={p.position ?? ""}
                            onChange={(e) =>
                              updatePlayer(p.id, {
                                position: (e.target.value ||
                                  undefined) as PositionKey | undefined,
                              })
                            }
                            className="w-[11rem] rounded border border-gray-300 bg-white p-2 text-xs sm:text-sm dark:border-neutral-700 dark:bg-neutral-950"
                            title={
                              p.position
                                ? `${p.position} — ${POS_INFO[p.position]}`
                                : "Wybierz pozycję"
                            }
                          >
                            <option value="">— wybierz pozycję —</option>
                            {POSITIONS.map((posKey) => (
                              <option key={posKey} value={posKey}>
                                {posKey} — {POS_INFO[posKey]}
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
                          <div className="inline-flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                            <div className="inline-flex items-center gap-1 sm:gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-gray-300 dark:border-neutral-700"
                                onClick={() =>
                                  setExpandedId((cur) =>
                                    cur === p.id ? null : p.id
                                  )
                                }
                                title={
                                  isOpen
                                    ? "Ukryj szczegóły"
                                    : "Pokaż szczegóły"
                                }
                              >
                                {isOpen ? (
                                  <>
                                    <ChevronUp className="mr-1 h-4 w-4" />
                                    <span className="hidden sm:inline">
                                      Szczegóły
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="mr-1 h-4 w-4" />
                                    <span className="hidden sm:inline">
                                      Szczegóły
                                    </span>
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

                            {/* Dodaj do bazy – tylko jeśli NIE istnieje w bazie */}
                            {!inBase && normalizedName && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-fit rounded border-black bg-black px-3  text-white hover:bg-zinc-900 hover:text-white dark:border-black dark:bg-black dark:hover:bg-zinc-900"
                                onClick={() => {
                                  setPromotePlayer(p);
                                  setNewPlayerClub("");
                                  setNewPlayerPosition(p.position ?? "");
                                }}
                              >
                                <AddPlayerIcon
                                  className="mr-1.5 h-7 w-7"
                                  strokeColorAll="#ffffff"
                                />
                                Dodaj do mojej bazy
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Szczegóły POD wierszem zawodnika */}
                      {isOpen && (
                        <tr>
                          <td
                            colSpan={5}
                            className="border-t border-gray-200 bg-stone-50/80 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/70"
                          >
                            <div className="space-y-4">
                              <Group title="Kategorie bazowe">
                                {metrics.BASE.filter((m) => m.enabled).map(
                                  (m) => (
                                    <MetricItem
                                      key={m.id}
                                      label={m.label}
                                      value={p.base?.[m.key]}
                                      onChange={(v) =>
                                        updateMetric("base", m.id, m.key, v, p)
                                      }
                                    />
                                  )
                                )}
                              </Group>

                              {showGK && (
                                <Group title="Bramkarz (GK)">
                                  {metrics.GK.filter((m) => m.enabled).map(
                                    (m) => (
                                      <MetricItem
                                        key={m.id}
                                        label={m.label}
                                        value={p.gk?.[m.key]}
                                        onChange={(v) =>
                                          updateMetric(
                                            "gk",
                                            m.id,
                                            m.key,
                                            v,
                                            p
                                          )
                                        }
                                      />
                                    )
                                  )}
                                </Group>
                              )}

                              {showDEF && (
                                <Group title="Obrońca (CB/FB/WB)">
                                  {metrics.DEF.filter((m) => m.enabled).map(
                                    (m) => (
                                      <MetricItem
                                        key={m.id}
                                        label={m.label}
                                        value={p.def?.[m.key]}
                                        onChange={(v) =>
                                          updateMetric(
                                            "def",
                                            m.id,
                                            m.key,
                                            v,
                                            p
                                          )
                                        }
                                      />
                                    )
                                  )}
                                </Group>
                              )}

                              {showMID && (
                                <Group title="Pomocnik (6/8/10)">
                                  {metrics.MID.filter((m) => m.enabled).map(
                                    (m) => (
                                      <MetricItem
                                        key={m.id}
                                        label={m.label}
                                        value={p.mid?.[m.key]}
                                        onChange={(v) =>
                                          updateMetric(
                                            "mid",
                                            m.id,
                                            m.key,
                                            v,
                                            p
                                          )
                                        }
                                      />
                                    )
                                  )}
                                </Group>
                              )}

                              {showATT && (
                                <Group title="Napastnik (9/7/11)">
                                  {metrics.ATT.filter((m) => m.enabled).map(
                                    (m) => (
                                      <MetricItem
                                        key={m.id}
                                        label={m.label}
                                        value={p.att?.[m.key]}
                                        onChange={(v) =>
                                          updateMetric(
                                            "att",
                                            m.id,
                                            m.key,
                                            v,
                                            p
                                          )
                                        }
                                      />
                                    )
                                  )}
                                </Group>
                              )}

                              {/* Notatka indywidualna – w osobnej karcie */}
                              <div className="mt-2 rounded border border-stone-200 bg-white/90 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-700 dark:text-neutral-200">
                                  Notatka do zawodnika
                                </div>
                                <Textarea
                                  value={p.note ?? ""}
                                  onChange={(e) =>
                                    updatePlayer(p.id, { note: e.target.value })
                                  }
                                  placeholder="Notatka o zawodniku…"
                                  className="min-h-[80px] bg-white/90 text-sm dark:bg-neutral-950"
                                />
                                <p className="mt-1 text-[11px] text-stone-500 dark:text-neutral-400">
                                  Wewnętrzna notatka – widoczna tylko w tej obserwacji.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {(o.players ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-sm text-dark dark:text-neutral-400"
                    >
                      Brak zawodników — wpisz numer lub nazwisko i kliknij
                      „Dodaj”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 3) Notatka do obserwacji */}
        <Section
          title="Notatka do obserwacji"
          description="Krótki opis, kontekst, obserwacje ogólne."
        >
          <div className="space-y-2">
            <Label className="text-sm">Notatka tekstowa</Label>
            <Textarea
              value={o.note ?? ""}
              onChange={(e) => setField("note", e.target.value)}
              placeholder="Krótka notatka…"
              className="min-h-[140px]"
            />
            <div className="inline-flex items-center gap-1 text-xs text-dark dark:text-neutral-400">
              <FileEdit className="h-3.5 w-3.5" /> Notatka dot. całej obserwacji.
            </div>
          </div>
        </Section>
      </div>

{/* Modal: dodaj zawodnika do bazy */}
{promotePlayer && (
  <>
    {/* tło */}
    <div
      className="fixed inset-0 z-[110] bg-black/40"
      onClick={() => setPromotePlayer(null)}
    />

    {/* modal wycentrowany w oknie */}
    <div
      className="fixed left-1/2 top-1/2 z-[111] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 max-h-[80vh] overflow-y-auto"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Dodaj zawodnika do bazy
        </h2>
        <button
          className="rounded p-1 text-dark hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
          onClick={() => setPromotePlayer(null)}
        >
          ✕
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <Label className="text-xs">Imię i nazwisko</Label>
          <Input
            className="mt-1"
            value={(promotePlayer.name || "").replace(/^#/, "").trim()}
            readOnly
          />
          <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
            Nazwa z obserwacji – edycję zrobisz później w „Mojej bazie”.
          </p>
        </div>

        <div>
          <Label className="text-xs">Klub (opcjonalnie)</Label>
          <Input
            className="mt-1"
            value={newPlayerClub}
            onChange={(e) => setNewPlayerClub(e.target.value)}
            placeholder="np. Lech U19"
          />
        </div>

        <div>
          <Label className="text-xs">Domyślna pozycja (opcjonalnie)</Label>
          <select
            className="mt-1 w-full rounded border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            value={newPlayerPosition}
            onChange={(e) =>
              setNewPlayerPosition(
                (e.target.value || "") as PositionKey | ""
              )
            }
          >
            <option value="">— bez pozycji —</option>
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos} — {POS_INFO[pos]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          className="border-gray-300 dark:border-neutral-700"
          onClick={() => setPromotePlayer(null)}
        >
          Anuluj
        </Button>
        <Button
          className="bg-gray-900 text-white hover:bg-gray-800"
          onClick={handlePromotePlayerSave}
        >
          Dodaj do mojej bazy
        </Button>
      </div>
    </div>
  </>
)}

    </div>
  );
}

/* Lokalny helper dla grup metryk */
function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded border border-stone-200 bg-white/95 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
          <span className="h-1.5 w-1.5 rounded bg-stone-500" />
          {title}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

export default ObservationEditor;
