// src/app/(players)/players/[id]/PlayerEditorPage.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toolbar } from "@/shared/ui/atoms";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronsUpDown,
  Check,
  ChevronDown,
  Search,
} from "lucide-react";
import type { Player, Observation } from "@/shared/types";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import StarRating from "@/shared/ui/StarRating";
import {
  loadRatings,
  syncRatingsFromSupabase,
  type RatingsConfig,
  type RatingAspect,
} from "@/shared/ratings";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { getSupabase } from "@/lib/supabaseClient";

/* ============================== Positions ============================== */
type Pos = Player["pos"];

type DetailedPos =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "CDM"
  | "CM"
  | "CAM"
  | "LW"
  | "RW"
  | "ST";

const POS_DATA: Array<{
  value: DetailedPos;
  code: string;
  name: string;
  desc: string;
}> = [
  {
    value: "GK",
    code: "GK",
    name: "Bramkarz",
    desc: "Odbicia, gra na linii, wyjścia i gra nogami.",
  },
  {
    value: "CB",
    code: "CB",
    name: "Środkowy obrońca",
    desc: "Gra w powietrzu, ustawienie, wyprowadzenie.",
  },
  {
    value: "LB",
    code: "LB",
    name: "Lewy obrońca",
    desc: "Obrona strony, dośrodkowania, wsparcie ataku.",
  },
  {
    value: "RB",
    code: "RB",
    name: "Prawy obrońca",
    desc: "Obrona strony, dośrodkowania, wsparcie ataku.",
  },
  {
    value: "CDM",
    code: "CDM",
    name: "Śr. pomocnik defensywny",
    desc: "Odbiór, asekuracja, pierwsze podanie.",
  },
  {
    value: "CM",
    code: "CM",
    name: "Środkowy pomocnik",
    desc: "Równowaga defensywa/kreacja.",
  },
  {
    value: "CAM",
    code: "CAM",
    name: "Ofensywny pomocnik",
    desc: "Ostatnie podanie, kreacja, strzał.",
  },
  {
    value: "LW",
    code: "LW",
    name: "Lewy pomocnik/skrzydłowy",
    desc: "1v1, dośrodkowania, zejścia do strzału.",
  },
  {
    value: "RW",
    code: "RW",
    name: "Prawy pomocnik/skrzydłowy",
    desc: "1v1, dośrodkowania, zejścia do strzału.",
  },
  {
    value: "ST",
    code: "ST",
    name: "Napastnik",
    desc: "Wykończenie, gra tyłem, ruch w polu karnym.",
  },
];

const toBucket = (p: DetailedPos): Pos => {
  switch (p) {
    case "GK":
      return "GK";
    case "CB":
    case "LB":
    case "RB":
      return "DF";
    case "CDM":
    case "CM":
    case "CAM":
    case "LW":
    case "RW":
      return "MF";
    case "ST":
      return "FW";
    default:
      return "MF";
  }
};

function detailedFromBucket(pos?: Pos): DetailedPos {
  switch (pos) {
    case "GK":
      return "GK";
    case "DF":
      return "CB";
    case "MF":
      return "CM";
    case "FW":
      return "ST";
    default:
      return "CM";
  }
}

/* ============================== Countries ============================== */
type Country = { code: string; name: string; flag: string };
const COUNTRIES: Country[] = [
  { code: "PL", name: "Polska", flag: "🇵🇱" },
  { code: "DE", name: "Niemcy", flag: "🇩🇪" },
  { code: "GB", name: "Anglia", flag: "🇬🇧" },
  { code: "ES", name: "Hiszpania", flag: "🇪🇸" },
  { code: "IT", name: "Włochy", flag: "🇮🇹" },
  { code: "FR", name: "Francja", flag: "🇫🇷" },
  { code: "NL", name: "Holandia", flag: "🇳🇱" },
  { code: "PT", name: "Portugalia", flag: "🇵🇹" },
  { code: "SE", name: "Szwecja", flag: "🇸🇪" },
  { code: "NO", name: "Norwegia", flag: "🇳🇴" },
  { code: "DK", name: "Dania", flag: "🇩🇰" },
  { code: "BE", name: "Belgia", flag: "🇧🇪" },
  { code: "CH", name: "Szwajcaria", flag: "🇨🇭" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "CZ", name: "Czechy", flag: "🇨🇿" },
  { code: "SK", name: "Słowacja", flag: "🇸🇰" },
  { code: "UA", name: "Ukraina", flag: "🇺🇦" },
  { code: "LT", name: "Litwa", flag: "🇱🇹" },
  { code: "LV", name: "Łotwa", flag: "🇱🇻" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "HU", name: "Węgry", flag: "🇭🇺" },
  { code: "RO", name: "Rumunia", flag: "🇷🇴" },
  { code: "HR", name: "Chorwacja", flag: "🇭🇷" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SI", name: "Słowenia", flag: "🇸🇮" },
  { code: "GR", name: "Grecja", flag: "🇬🇷" },
  { code: "TR", name: "Turcja", flag: "🇹🇷" },
  { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "BR", name: "Brazylia", flag: "🇧🇷" },
  { code: "AR", name: "Argentyna", flag: "🇦🇷" },
];

/* ============================== Small UI ============================== */
function SavePill({ state }: { state: "idle" | "saving" | "saved" }) {
  const base =
    "inline-flex h-10 items-center rounded-md border px-3 text-sm leading-none";
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
          Autozapis…
        </>
      ) : state === "saved" ? (
        <>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Zapisano
        </>
      ) : (
        "Czeka na uzupełnienie danych"
      )}
    </span>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
      {text}
    </span>
  );
}

/* Country combobox */
function CountryCombobox({
  value,
  onChange,
  error,
  chip,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string;
  chip?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.name === value);
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            className={cn(
              "relative flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm dark:bg-neutral-950",
              error
                ? "border-red-500"
                : "border-gray-300 dark:border-neutral-700",
              chip ? "pr-24" : ""
            )}
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-2",
                !selected && "text-muted-foreground"
              )}
            >
              {selected ? (
                <>
                  <span className="text-base leading-none">
                    {selected.flag}
                  </span>
                  <span className="truncate">{selected.name}</span>
                </>
              ) : (
                "Wybierz kraj"
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            {chip ? <Chip text={chip} /> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command shouldFilter>
            <CommandInput placeholder="Szukaj kraju…" />
            <CommandList>
              <CommandEmpty>Brak wyników.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => {
                  const active = c.name === value;
                  return (
                    <CommandItem
                      key={c.code}
                      value={`${c.name} ${c.code}`}
                      onSelect={() => {
                        onChange(c.name);
                        setOpen(false);
                      }}
                    >
                      <span className="mr-2 text-base">{c.flag}</span>
                      <span className="mr-2">{c.name}</span>
                      <span
                        className={cn(
                          "ml-auto",
                          active ? "opacity-100" : "opacity-0"
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

/* ============================== Types / ObsRec ============================== */
type ObsRec = Omit<Observation, "player"> & {
  player?: string;
  players?: string[];
  mode?: "live" | "tv";
  opponentLevel?: string;
};

/* ===== Ratings map stored on player.meta (key -> value) ===== */
type RatingMap = Record<string, number>;

/* ============================== Page ============================== */
export default function PlayerEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const [p, setP] = useState<Player | null>(null);

  const originalRef = useRef<Player | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accordions
  const [basicOpen, setBasicOpen] = useState(true);
  const [extOpen, setExtOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);

  // Extended tabs
  type ExtKey = "profile" | "eligibility" | "stats365" | "contact";
  const [extView, setExtView] = useState<ExtKey>("profile");

  // Local extended fields (meta.ext)
  const [ext, setExt] = useState(() => ({
    // Basic helpers
    birthYear: "",
    clubCountry: "",
    jerseyNumber: "",
    unknownNote: "",

    // Tab 1 – Profil boiskowy
    height: "",
    weight: "",
    dominantFoot: "",
    mainPos: "" as DetailedPos | "",
    altPositions: [] as DetailedPos[],

    // Tab 2 – Status & scouting
    english: null as null | boolean,
    euPassport: null as null | boolean,
    birthCountry: "",
    contractStatus: "",
    agency: "",
    releaseClause: "",
    leagueLevel: "",
    clipsLinks: "",
    transfermarkt: "",
    wyscout: "",

    // Tab 3 – Zdrowie i statystyki
    injuryHistory: "",
    minutes365: "",
    starts365: "",
    subs365: "",
    goals365: "",

    // Tab 4 – Kontakt & social
    phone: "",
    email: "",
    fb: "",
    ig: "",
    tiktok: "",
  }));

  // highlight głównej pozycji
  const [highlightMainPos, setHighlightMainPos] = useState(false);

  useEffect(() => {
    if (ext.mainPos) setHighlightMainPos(false);
  }, [ext.mainPos]);

  /* ---------- Ratings config z Supabase ---------- */
  const [ratingCfg, setRatingCfg] = useState<RatingsConfig>(() =>
    loadRatings()
  );

  const enabledRatingAspects = useMemo<RatingAspect[]>(
    () => ratingCfg.filter((a) => a.enabled !== false),
    [ratingCfg]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await syncRatingsFromSupabase();
      if (!cancelled) setRatingCfg(cfg);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Grade state
  const [ratings, setRatings] = useState<RatingMap>({});
  const [grade, setGrade] = useState({ notes: "", finalComment: "" });

  // --- Grupy aspektów wg groupKey z Supabase ---
  const baseAspects = enabledRatingAspects.filter(
    (a) => (a.groupKey ?? "GEN") === "GEN"
  );
  const gkAspects = enabledRatingAspects.filter((a) => a.groupKey === "GK");
  const defAspects = enabledRatingAspects.filter((a) => a.groupKey === "DEF");
  const midAspects = enabledRatingAspects.filter((a) => a.groupKey === "MID");
  const attAspects = enabledRatingAspects.filter((a) => a.groupKey === "FW");

  // Pozycja główna dla oceny
  const effectiveMainPos: DetailedPos | "" =
    (ext.mainPos as DetailedPos | "") || "";
  const effectiveBucket: Pos | null = effectiveMainPos
    ? toBucket(effectiveMainPos)
    : null;

  /* ------------------------------ Observations ------------------------------ */
  const [observations, setObservations] = useState<ObsRec[]>([]);
  const [obsQuery, setObsQuery] = useState("");
  const [obsSelectedId, setObsSelectedId] = useState<number | null>(null);

  // quick-new fields
  const [qaMatch, setQaMatch] = useState("");
  const [qaDate, setQaDate] = useState("");
  const [qaTime, setQaTime] = useState("");
  const [qaMode, setQaMode] = useState<"live" | "tv">("live");
  const [qaStatus, setQaStatus] = useState<ObsRec["status"]>("draft");
  const [qaOpponentLevel, setQaOpponentLevel] = useState("");

  /* ------------------------------ Helpers ------------------------------ */
  function bumpSaving() {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 450);
  }

const normalize = (arr: ObsRec[]) =>
  arr.map((o) => {
    const rawPlayers = Array.isArray(o.players)
      ? o.players
      : o.player && String(o.player).trim()
      ? [o.player]
      : [];

    // Zamień obiekty { id, name, ... } na stringi z name
    const playersArray = rawPlayers
      .map((pl: any) => {
        if (!pl) return null;
        if (typeof pl === "string") return pl;
        if (typeof pl === "object" && "name" in pl) return String(pl.name);
        return null;
      })
      .filter((x): x is string => !!x && x.trim() !== "");

    const unique = Array.from(new Set(playersArray));
    return { ...o, players: unique };
  });


  async function fetchObservations() {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("observations")
        .select("id, player, match, date, time, status, mode, players, payload")
        .order("date", { ascending: false })
        .order("time", { ascending: false });

      if (error) {
        console.error("Błąd wczytywania obserwacji", error);
        return;
      }

      const rows = (data ?? []) as any[];

      const mapped: ObsRec[] = normalize(
        rows.map((row) => ({
          id: row.id,
          player: row.player ?? undefined,
          match: row.match ?? "",
          date: row.date ?? "",
          time: row.time ?? "",
          status: (row.status as ObsRec["status"]) ?? "draft",
          mode: (row.mode as "live" | "tv") ?? "live",
          opponentLevel:
            (row.payload && (row.payload as any).opponentLevel) || "",
          players:
            Array.isArray(row.players) && row.players.length
              ? row.players.filter(Boolean)
              : row.player
              ? [row.player]
              : [],
        }))
      );

      setObservations(mapped);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchObservations();
  }, []);

  const playerObs = useMemo(() => {
    if (!p) return [];
    return [...observations]
      .filter((o) => (o.players ?? []).includes(p.name))
      .sort((a, b) =>
        ((b.date || "") + (b.time || "")).localeCompare(
          (a.date || "") + (a.time || "")
        )
      );
  }, [observations, p]);

  const existingFiltered = useMemo(() => {
    const q = obsQuery.trim().toLowerCase();
    const arr = [...observations]
      .filter((o) => o.players && o.players.length > 0)
      .sort((a, b) =>
        ((b.date || "") + (b.time || "")).localeCompare(
          (a.date || "") + (a.time || "")
        )
      );
    if (!q) return arr;
    return arr.filter(
      (o) =>
        (o.match || "").toLowerCase().includes(q) ||
        (o.players || []).some((n) => (n || "").toLowerCase().includes(q)) ||
        (o.date || "").includes(q)
    );
  }, [observations, obsQuery]);

  async function addObservationForPlayer() {
    if (!p) return;
    bumpSaving();
    try {
      const supabase = getSupabase();
      const payload: any = {};
      if (qaOpponentLevel.trim()) {
        payload.opponentLevel = qaOpponentLevel.trim();
      }

      const { error } = await supabase.from("observations").insert([
        {
          player: p.name,
          match: qaMatch.trim() || null,
          date: qaDate || null,
          time: qaTime || null,
          status: qaStatus,
          mode: qaMode,
          players: [p.name],
          bucket: "active",
          payload,
        },
      ]);

      if (error) {
        console.error("Błąd dodawania obserwacji", error);
      } else {
        await fetchObservations();
        setQaMatch("");
        setQaDate("");
        setQaTime("");
        setQaMode("live");
        setQaStatus("draft");
        setQaOpponentLevel("");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function duplicateExistingToThisPlayer() {
    if (!p || obsSelectedId == null) return;
    const base = observations.find((o) => o.id === obsSelectedId);
    if (!base) return;

    bumpSaving();
    try {
      const supabase = getSupabase();
      const payload: any = {};
      if (base.opponentLevel) {
        payload.opponentLevel = base.opponentLevel;
      }

      const { error } = await supabase.from("observations").insert([
        {
          player: p.name,
          match: base.match ?? null,
          date: base.date ?? null,
          time: base.time ?? null,
          status: base.status,
          mode: base.mode ?? "live",
          players: [p.name],
          bucket: "active",
          payload,
        },
      ]);

      if (error) {
        console.error("Błąd kopiowania obserwacji", error);
      } else {
        await fetchObservations();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function reassignExistingToThisPlayer() {
    if (!p || obsSelectedId == null) return;
    const base = observations.find((o) => o.id === obsSelectedId);
    if (!base) return;

    bumpSaving();
    try {
      const supabase = getSupabase();
      const updatedPlayers = Array.from(
        new Set([...(base.players ?? []), p.name])
      );

      const { error } = await supabase
        .from("observations")
        .update({ players: updatedPlayers })
        .eq("id", obsSelectedId);

      if (error) {
        console.error("Błąd przypisywania obserwacji", error);
      } else {
        await fetchObservations();
      }
    } catch (err) {
      console.error(err);
    }
  }

  /* ------------------------------ Player persistence (Supabase) ------------------------------ */

  async function savePlayerToSupabase(updated: Player) {
    try {
      const supabase = getSupabase();
      const patch: any = {
        name: updated.name,
        pos: updated.pos,
        club: updated.club,
        age: (updated as any).age,
        status: (updated as any).status,
        firstName: (updated as any).firstName ?? null,
        lastName: (updated as any).lastName ?? null,
        birthDate: (updated as any).birthDate ?? null,
        nationality: (updated as any).nationality ?? null,
        photo: (updated as any).photo ?? null,
        meta: (updated as any).meta ?? {},
      };

      const { error } = await supabase
        .from("players")
        .update(patch)
        .eq("id", (updated as any).id);

      if (error) {
        console.error("Błąd zapisu zawodnika", error);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function saveBasic(next: Partial<Player>) {
    if (!p) return;
    const updated = { ...p, ...next } as Player;
    bumpSaving();
    setP(updated);
    void savePlayerToSupabase(updated);
  }

  function saveMetaPatch(patch: any) {
    if (!p) return;
    const prevMeta: any = (p as any).meta ?? {};
    const updated = {
      ...(p as any),
      meta: { ...prevMeta, ...patch },
    } as Player;
    bumpSaving();
    setP(updated);
    void savePlayerToSupabase(updated);
  }

  function saveExtPatch(patch: Partial<typeof ext>) {
    if (!p) return;
    const prevMeta: any = (p as any).meta ?? {};
    const prevExt: any = prevMeta.ext ?? {};
    const nextExt = { ...prevExt, ...patch };
    saveMetaPatch({ ext: nextExt });
  }

  function updateDetailedPos(sel: DetailedPos) {
    if (!p) return;
    const prevMeta: any = (p as any).meta ?? {};
    const updated: Player = {
      ...(p as any),
      pos: toBucket(sel) as Pos,
      meta: { ...prevMeta, detailedPos: sel },
    } as Player;
    bumpSaving();
    setP(updated);
    void savePlayerToSupabase(updated);
  }

  const currentDetailedPos: DetailedPos | null = useMemo(() => {
    if (!p) return null;
    const metaPos =
      ((p as any).meta?.detailedPos as DetailedPos | undefined) ?? undefined;
    return metaPos ?? detailedFromBucket(p.pos);
  }, [p]);

  /* ------------------------------ Load player from Supabase ------------------------------ */
  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .eq("id", Number(id))
          .maybeSingle();

        if (cancelled) return;

        if (error || !data) {
          console.error("Nie udało się pobrać zawodnika", error);
          setP(null);
          originalRef.current = null;
          return;
        }

        const found = data as Player;
        setP(found);
        originalRef.current = structuredClone(found);

        const meta: any = (found as any).meta ?? {};
        const extPrev: any = meta.ext ?? {};

        setExt((prev) => ({
          ...prev,
          birthYear: extPrev.birthYear ?? "",
          clubCountry: extPrev.clubCountry ?? "",
          jerseyNumber: extPrev.jerseyNumber ?? "",
          unknownNote: extPrev.unknownNote ?? "",

          height: extPrev.height ?? "",
          weight: extPrev.weight ?? "",
          dominantFoot: extPrev.dominantFoot ?? "",
          mainPos: extPrev.mainPos ?? meta.detailedPos ?? "",
          altPositions: Array.isArray(extPrev.altPositions)
            ? extPrev.altPositions
            : [],

          english:
            typeof extPrev.english === "boolean" ? extPrev.english : null,
          euPassport:
            typeof extPrev.euPassport === "boolean"
              ? extPrev.euPassport
              : null,
          birthCountry: extPrev.birthCountry ?? "",
          contractStatus: extPrev.contractStatus ?? "",
          agency: extPrev.agency ?? "",
          releaseClause: extPrev.releaseClause ?? "",
          leagueLevel: extPrev.leagueLevel ?? "",
          clipsLinks: extPrev.clipsLinks ?? "",
          transfermarkt: extPrev.transfermarkt ?? "",
          wyscout: extPrev.wyscout ?? "",

          injuryHistory: extPrev.injuryHistory ?? "",
          minutes365: extPrev.minutes365 ?? "",
          starts365: extPrev.starts365 ?? "",
          subs365: extPrev.subs365 ?? "",
          goals365: extPrev.goals365 ?? "",

          phone: extPrev.phone ?? "",
          email: extPrev.email ?? "",
          fb: extPrev.fb ?? "",
          ig: extPrev.ig ?? "",
          tiktok: extPrev.tiktok ?? "",
        }));

        setGrade({
          notes: meta.notes ?? "",
          finalComment: meta.finalComment ?? "",
        });

        const rPrev: RatingMap = meta.ratings ?? {};
        setRatings(rPrev);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setP(null);
          originalRef.current = null;
        }
      }
    }

    loadPlayer();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const isUnknown = useMemo(
    () => (p ? !(p as any).firstName && !(p as any).lastName : false),
    [p]
  );

  const firstName = (p as any)?.firstName ?? "";
  const lastName = (p as any)?.lastName ?? "";
  const isKnown = !!(firstName || lastName);

  function cancelToOriginal() {
    const orig = originalRef.current;
    if (!orig) return;
    setSaveStatus("saving");
    const cloned = structuredClone(orig);
    setP(cloned);
    void savePlayerToSupabase(cloned);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 450);
  }

  function manualSave() {
    if (!p) return;
    bumpSaving();
    void savePlayerToSupabase(p);
  }

  if (!p) {
    return (
      <div className="w-full">
        <Card className="mt-3">
          <CardContent className="px-4 py-4 md:px-6">
            Nie znaleziono zawodnika.
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ------------------------------ Counters ------------------------------ */
  const countTruthy = (vals: Array<unknown>) =>
    vals.filter((v) => {
      if (typeof v === "number") return v > 0;
      return !!(
        v !== null &&
        v !== undefined &&
        String(v).trim() !== ""
      );
    }).length;

  // Basic
  const cntBasicKnown = countTruthy([
    firstName,
    lastName,
    ext.birthYear,
    p.club,
    ext.clubCountry,
  ]);
  const cntBasicUnknown = countTruthy([
    ext.jerseyNumber,
    p.club,
    ext.clubCountry,
    ext.unknownNote,
  ]);
  const cntBasic = isKnown ? cntBasicKnown : cntBasicUnknown;
  const basicMax = isKnown ? 5 : 4;

  // Tabs – ext
  const cntProfile = countTruthy([
    ext.height,
    ext.weight,
    ext.dominantFoot,
    ext.mainPos,
    ext.altPositions?.length ? 1 : "",
  ]);

  const cntEligibility = countTruthy([
    ext.english ? "yes" : "",
    ext.euPassport ? "yes" : "",
    ext.birthCountry,
    ext.contractStatus,
    ext.agency,
    ext.releaseClause,
    ext.leagueLevel,
    ext.clipsLinks,
    ext.transfermarkt,
    ext.wyscout,
  ]);

  const cntStats365 = countTruthy([
    ext.injuryHistory,
    ext.minutes365,
    ext.starts365,
    ext.subs365,
    ext.goals365,
  ]);

  const cntContact = countTruthy([
    ext.phone,
    ext.email,
    ext.fb,
    ext.ig,
    ext.tiktok,
  ]);

  const totalExt = cntProfile + cntEligibility + cntStats365 + cntContact;
  const totalExtMax = 5 + 10 + 5 + 5;

  // Ocena
  const cntNotes = countTruthy([grade.notes]);
  const cntAspects = countTruthy(
    enabledRatingAspects.map((a) => ratings[a.key] ?? 0)
  );
  const cntFinal = countTruthy([grade.finalComment]);
  const totalGrade = cntNotes + cntAspects + cntFinal;
  const totalGradeMax = 1 + enabledRatingAspects.length + 1;

  /* ---------- Ocena helpery ---------- */
  function RatingRow({ aspect }: { aspect: RatingAspect }) {
    const val = ratings[aspect.key] ?? 0;
    const hasTooltip = !!aspect.tooltip;
    return (
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-[65%]">
          <div className="flex items-center gap-1">
            <span className="text-sm">{aspect.label}</span>
            {hasTooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-600 hover:bg-slate-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                      i
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-snug">
                    {aspect.tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div className="mt-1 sm:mt-0">
          <StarRating
            max={5}
            value={val}
            onChange={(v) => {
              const next = {
                ...ratings,
                [aspect.key]: v,
              };
              setRatings(next);
              saveMetaPatch({ ratings: next });
            }}
          />
        </div>
      </div>
    );
  }

  function RatingGroup({
    title,
    aspects,
  }: {
    title: string;
    aspects: RatingAspect[];
  }) {
    if (!aspects.length) return null;
    return (
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
          <span className="h-1.5 w-1.5 rounded-md bg-stone-500" />
          {title}
        </div>
        <div className="space-y-3">
          {aspects.map((aspect) => (
            <RatingRow key={aspect.id} aspect={aspect} />
          ))}
        </div>
      </div>
    );
  }

  /* ------------------------------ ExtContent (tabs) ------------------------------ */
  function ExtContent({ view }: { view: ExtKey }) {
    switch (view) {
      case "profile":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label className="text-sm">Wzrost (cm)</Label>
                <Input
                  type="number"
                  value={ext.height}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, height: v }));
                    saveExtPatch({ height: v });
                  }}
                />
              </div>
              <div>
                <Label className="text-sm">Waga (kg)</Label>
                <Input
                  type="number"
                  value={ext.weight}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, weight: v }));
                    saveExtPatch({ weight: v });
                  }}
                />
              </div>
              <div>
                <Label className="text-sm">Dominująca noga</Label>
                <Select
                  value={ext.dominantFoot || undefined}
                  onValueChange={(val) => {
                    setExt((s) => ({ ...s, dominantFoot: val }));
                    saveExtPatch({ dominantFoot: val });
                  }}
                >
                  <SelectTrigger className="w-full border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                    <SelectValue placeholder="Wybierz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R">Prawa (R)</SelectItem>
                    <SelectItem value="L">Lewa (L)</SelectItem>
                    <SelectItem value="Both">Obunożny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div
                className={cn(
                  highlightMainPos &&
                    "rounded-md bg-indigo-50/60 p-2 ring-2 ring-indigo-500/80 dark:bg-indigo-950/30"
                )}
              >
                <Label className="text-sm">Główna pozycja</Label>
                <Select
                  value={ext.mainPos || (currentDetailedPos ?? undefined)}
                  onValueChange={(v) => {
                    const val = v as DetailedPos;
                    setExt((s) => ({ ...s, mainPos: val }));
                    saveExtPatch({ mainPos: val });
                    updateDetailedPos(val);
                  }}
                >
                  <SelectTrigger className="mt-1 w-full justify-start border-gray-300 dark:border-neutral-700 dark:bg-neutral-950 [&>svg]:ml-auto">
                    <SelectValue placeholder="Wybierz pozycję" />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_DATA.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="text-left">
                          <div className="font-medium">
                            {opt.code}: {opt.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {opt.desc}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-neutral-400">
                  Ta pozycja steruje dodatkowymi kategoriami oceny
                  (GK/DEF/MID/ATT).
                </p>
              </div>

              <div>
                <Label className="text-sm">Pozycje alternatywne</Label>
                <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {POS_DATA.map((opt) => {
                    const checked = ext.altPositions.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs",
                          checked
                            ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                            : "border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-950"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={checked}
                          onChange={() => {
                            setExt((s) => {
                              const current = s.altPositions;
                              const next = checked
                                ? current.filter((x) => x !== opt.value)
                                : [...current, opt.value];
                              const upd = { ...s, altPositions: next };
                              saveExtPatch({ altPositions: next });
                              return upd;
                            });
                          }}
                        />
                        <span>{opt.code}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case "eligibility":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label className="text-sm">
                  Znajomość języka angielskiego
                </Label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExt((s) => ({ ...s, english: true }));
                      saveExtPatch({ english: true });
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02]",
                      ext.english === true
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-stone-100 text-gray-800 hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    )}
                  >
                    Tak
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExt((s) => ({ ...s, english: false }));
                      saveExtPatch({ english: false });
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02]",
                      ext.english === false
                        ? "bg-rose-600 text-white hover:bg-rose-700"
                        : "bg-stone-100 text-gray-800 hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    )}
                  >
                    Nie
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-sm">Paszport UE</Label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExt((s) => ({ ...s, euPassport: true }));
                      saveExtPatch({ euPassport: true });
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02]",
                      ext.euPassport === true
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-stone-100 text-gray-800 hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    )}
                  >
                    Tak
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExt((s) => ({ ...s, euPassport: false }));
                      saveExtPatch({ euPassport: false });
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02]",
                      ext.euPassport === false
                        ? "bg-rose-600 text-white hover:bg-rose-700"
                        : "bg-stone-100 text-gray-800 hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    )}
                  >
                    Nie
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-sm">Kraj urodzenia</Label>
                <CountryCombobox
                  value={ext.birthCountry}
                  onChange={(val) => {
                    setExt((s) => ({ ...s, birthCountry: val }));
                    saveExtPatch({ birthCountry: val });
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className="text-sm">Status kontraktu</Label>
                <Input
                  value={ext.contractStatus}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, contractStatus: v }));
                    saveExtPatch({ contractStatus: v });
                  }}
                  placeholder="np. do 2027, wolny agent…"
                />
              </div>
              <div>
                <Label className="text-sm">Agencja menadżerska</Label>
                <Input
                  value={ext.agency}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, agency: v }));
                    saveExtPatch({ agency: v });
                  }}
                  placeholder="np. XYZ Management"
                />
              </div>
              <div>
                <Label className="text-sm">Klauzula wykupu</Label>
                <Input
                  value={ext.releaseClause}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, releaseClause: v }));
                    saveExtPatch({ releaseClause: v });
                  }}
                  placeholder="Kwota, zapis, uwagi…"
                />
              </div>
              <div>
                <Label className="text-sm">
                  Poziom rozgrywkowy obecnego klubu
                </Label>
                <Input
                  value={ext.leagueLevel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, leagueLevel: v }));
                    saveExtPatch({ leagueLevel: v });
                  }}
                  placeholder="np. Ekstraklasa, CLJ U19, 3 liga…"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-sm">Linki do klipów / time-codes</Label>
                <Textarea
                  value={ext.clipsLinks}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, clipsLinks: v }));
                    saveExtPatch({ clipsLinks: v });
                  }}
                  placeholder="Lista linków (po jednym w linii)…"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-sm">Link do Transfermarkt</Label>
                  <Input
                    value={ext.transfermarkt}
                    onChange={(e) => {
                      const v = e.target.value;
                      setExt((s) => ({ ...s, transfermarkt: v }));
                      saveExtPatch({ transfermarkt: v });
                    }}
                    placeholder="https://www.transfermarkt…"
                  />
                </div>
                <div>
                  <Label className="text-sm">Link do Wyscout</Label>
                  <Input
                    value={ext.wyscout}
                    onChange={(e) => {
                      const v = e.target.value;
                      setExt((s) => ({ ...s, wyscout: v }));
                      saveExtPatch({ wyscout: v });
                    }}
                    placeholder="https://platform.wyscout…"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "stats365":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Historia urazów (jeśli dostępna)</Label>
              <Textarea
                value={ext.injuryHistory}
                onChange={(e) => {
                  const v = e.target.value;
                  setExt((s) => ({ ...s, injuryHistory: v }));
                  saveExtPatch({ injuryHistory: v });
                }}
                placeholder="Krótki opis kontuzji, przerw, operacji…"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div>
                <Label className="text-sm">
                  Minuty w ostatnich 365 dniach
                </Label>
                <Input
                  type="number"
                  value={ext.minutes365}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, minutes365: v }));
                    saveExtPatch({ minutes365: v });
                  }}
                />
              </div>
              <div>
                <Label className="text-sm">Mecze jako starter</Label>
                <Input
                  type="number"
                  value={ext.starts365}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, starts365: v }));
                    saveExtPatch({ starts365: v });
                  }}
                />
              </div>
              <div>
                <Label className="text-sm">Mecze jako rezerwowy</Label>
                <Input
                  type="number"
                  value={ext.subs365}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, subs365: v }));
                    saveExtPatch({ subs365: v });
                  }}
                />
              </div>
              <div>
                <Label className="text-sm">
                  Gole w ostatnich 365 dniach
                </Label>
                <Input
                  type="number"
                  value={ext.goals365}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, goals365: v }));
                    saveExtPatch({ goals365: v });
                  }}
                />
              </div>
            </div>
          </div>
        );

      case "contact":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className="text-sm">Telefon kontaktowy</Label>
                <Input
                  value={ext.phone}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, phone: v }));
                    saveExtPatch({ phone: v });
                  }}
                  placeholder="+48…"
                />
              </div>
              <div>
                <Label className="text-sm">E-mail kontaktowy</Label>
                <Input
                  type="email"
                  value={ext.email}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, email: v }));
                    saveExtPatch({ email: v });
                  }}
                  placeholder="mail@przyklad.pl"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label className="text-sm">Link FB</Label>
                <Input
                  value={ext.fb}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, fb: v }));
                    saveExtPatch({ fb: v });
                  }}
                  placeholder="https://facebook.com/…"
                />
              </div>
              <div>
                <Label className="text-sm">Link IG</Label>
                <Input
                  value={ext.ig}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, ig: v }));
                    saveExtPatch({ ig: v });
                  }}
                  placeholder="https://instagram.com/…"
                />
              </div>
              <div>
                <Label className="text-sm">Link TikTok</Label>
                <Input
                  value={ext.tiktok}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExt((s) => ({ ...s, tiktok: v }));
                    saveExtPatch({ tiktok: v });
                  }}
                  placeholder="https://tiktok.com/@…"
                />
              </div>
            </div>
          </div>
        );
    }
  }

  /* ============================== Render ============================== */
  return (
    <div className="w-full">
      <Toolbar
        title={`Profil: ${p.name}`}
        right={
          <div className="mb-4 flex w-full items-center gap-2 sm:gap-3 md:flex-nowrap justify-end">
            <SavePill state={saveStatus} />
            <div className="ml-auto md:ml-0 flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 border-gray-300 dark:border-amber-800"
                onClick={cancelToOriginal}
              >
                Cofnij zmiany
              </Button>
              <Button
                className="h-10 bg-gray-900 text-white hover:bg-gray-800"
                onClick={() => router.push("/players")}
              >
                Wróć do listy
              </Button>
            </div>
          </div>
        }
      />

      {isUnknown && (
        <div className="mb-4 mt-2 rounded-md-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-1 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">
                  Edytujesz nieznanego zawodnika
                </div>
                <div className="opacity-90">
                  Aby zapisać profil jako <b>nieznany</b>, wystarczy numer na
                  koszulce, aktualny klub, kraj klubu i krótka notatka
                  (opcjonalnie). Jeśli uzupełnisz <b>imię</b> lub{" "}
                  <b>nazwisko</b>, profil zostanie traktowany jako{" "}
                  <b>znany</b> (wtedy kluczowe są: imię, nazwisko, rok
                  urodzenia, klub i kraj klubu).
                </div>
              </div>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2 justify-end sm:justify-normal sm:ml-4">
              <Button
                variant="outline"
                className="h-9 border-amber-300 dark:border-amber-800"
                onClick={cancelToOriginal}
              >
                Anuluj zmiany
              </Button>
              <Button
                className="h-9 bg-gray-900 text-white hover:bg-gray-800"
                onClick={manualSave}
              >
                Zapisz jako nieznany
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* --- Podstawowe informacje --- */}
        <Card className="mt-3">
          <CardHeader className="flex items-center justify-between border-b border-gray-200 px-4 py-5 md:px-6 dark:border-neutral-800">
            <button
              type="button"
              aria-expanded={basicOpen}
              aria-controls="basic-panel"
              onClick={() => setBasicOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="text-xl font-semibold leading-none tracking-tight">
                Podstawowe informacje
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {cntBasic}/{basicMax}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    basicOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-6">
            <Accordion
              type="single"
              collapsible
              value={basicOpen ? "basic" : undefined}
              onValueChange={(v) => setBasicOpen(v === "basic")}
              className="w-full"
            >
              <AccordionItem value="basic" className="border-0">
                <AccordionContent id="basic-panel" className="pt-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Imię / Nazwisko */}
                    <div>
                      <Label className="text-sm">Imię</Label>
                      <div className="relative">
                        <Input
                          value={firstName}
                          onChange={(e) =>
                            saveBasic({
                              firstName: e.target.value,
                              name: `${e.target.value} ${lastName}`.trim(),
                            } as any)
                          }
                          className={
                            isKnown && !firstName ? "pr-24" : undefined
                          }
                        />
                        {isKnown && !firstName && <Chip text="Wymagane" />}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Nazwisko</Label>
                      <div className="relative">
                        <Input
                          value={lastName}
                          onChange={(e) =>
                            saveBasic({
                              lastName: e.target.value,
                              name: `${firstName} ${e.target.value}`.trim(),
                            } as any)
                          }
                          className={
                            isKnown && !lastName ? "pr-24" : undefined
                          }
                        />
                        {isKnown && !lastName && <Chip text="Wymagane" />}
                      </div>
                    </div>

                    {/* Rok urodzenia / Numer na koszulce */}
                    <div>
                      <Label className="text-sm">Rok urodzenia</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={ext.birthYear}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExt((s) => ({ ...s, birthYear: v }));
                            saveExtPatch({ birthYear: v });
                          }}
                          className={
                            isKnown && !ext.birthYear ? "pr-24" : undefined
                          }
                        />
                        {isKnown && !ext.birthYear && <Chip text="Wymagane" />}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Numer na koszulce</Label>
                      <div className="relative">
                        <Input
                          value={ext.jerseyNumber}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExt((s) => ({ ...s, jerseyNumber: v }));
                            saveExtPatch({ jerseyNumber: v });
                          }}
                          className={
                            !isKnown && !ext.jerseyNumber ? "pr-24" : undefined
                          }
                        />
                        {!isKnown && !ext.jerseyNumber && (
                          <Chip text="Wymagane" />
                        )}
                      </div>
                    </div>

                    {/* Klub / kraj klubu */}
                    <div>
                      <Label className="text-sm">Aktualny klub</Label>
                      <div className="relative">
                        <Input
                          value={p.club}
                          onChange={(e) => saveBasic({ club: e.target.value })}
                          className={!p.club ? "pr-24" : undefined}
                        />
                        {!p.club && <Chip text="Wymagane" />}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm pb-2">
                        Kraj aktualnego klubu
                      </Label>
                      <CountryCombobox
                        value={ext.clubCountry}
                        onChange={(val) => {
                          setExt((s) => ({ ...s, clubCountry: val }));
                          saveExtPatch({ clubCountry: val });
                        }}
                        chip={!ext.clubCountry ? "Wymagane" : undefined}
                      />
                    </div>

                    {/* Notatka */}
                    <div className="md:col-span-2">
                      <Label className="text-sm">
                        Notatka własna (dla nieznanego profilu)
                      </Label>
                      <Textarea
                        value={ext.unknownNote}
                        onChange={(e) => {
                          const v = e.target.value;
                          setExt((s) => ({ ...s, unknownNote: v }));
                          saveExtPatch({ unknownNote: v });
                        }}
                        placeholder="Krótki opis zawodnika, wyróżniki, informacje z meczu…"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* --- Rozszerzone informacje --- */}
        <Card className="mt-3">
          <CardHeader className="flex items-center justify-between border-b border-gray-200 px-4 py-5 md:px-6 dark:border-neutral-800">
            <button
              type="button"
              aria-expanded={extOpen}
              aria-controls="ext-panel"
              onClick={() => setExtOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="text-xl font-semibold leading-none tracking-tight">
                Rozszerzone informacje
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {totalExt}/{totalExtMax}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    extOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-6">
            <Accordion
              type="single"
              collapsible
              value={extOpen ? "ext" : undefined}
              onValueChange={(v) => setExtOpen(v === "ext")}
              className="w-full"
            >
              <AccordionItem value="ext" className="border-0">
                <AccordionContent id="ext-panel" className="pt-4">
                  {/* Mobile: select; desktop: Tabs */}
                  <div className="md:hidden">
                    <Label className="mb-1 block text-sm">Sekcja</Label>
                    <select
                      value={extView}
                      onChange={(e) => setExtView(e.target.value as ExtKey)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    >
                      <option value="profile">Profil boiskowy</option>
                      <option value="eligibility">
                        Status &amp; scouting
                      </option>
                      <option value="stats365">Zdrowie i statystyki</option>
                      <option value="contact">Kontakt &amp; social</option>
                    </select>
                    <div className="mt-4">
                      <ExtContent view={extView} />
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <Tabs
                      value={extView}
                      onValueChange={(v: any) => setExtView(v)}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="profile">
                          Profil boiskowy
                        </TabsTrigger>
                        <TabsTrigger value="eligibility">
                          Status &amp; scouting
                        </TabsTrigger>
                        <TabsTrigger value="stats365">
                          Zdrowie i statystyki
                        </TabsTrigger>
                        <TabsTrigger value="contact">
                          Kontakt &amp; social
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="profile" className="mt-4">
                        <ExtContent view="profile" />
                      </TabsContent>
                      <TabsContent value="eligibility" className="mt-4">
                        <ExtContent view="eligibility" />
                      </TabsContent>
                      <TabsContent value="stats365" className="mt-4">
                        <ExtContent view="stats365" />
                      </TabsContent>
                      <TabsContent value="contact" className="mt-4">
                        <ExtContent view="contact" />
                      </TabsContent>
                    </Tabs>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* --- Ocena --- */}
        <Card className="mt-3">
          <CardHeader className="flex items-center justify-between border-b border-gray-200 px-4 py-5 md:px-6 dark:border-neutral-800">
            <button
              type="button"
              aria-expanded={gradeOpen}
              aria-controls="grade-panel"
              onClick={() => setGradeOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="text-xl font-semibold leading-none tracking-tight">
                Ocena
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {totalGrade}/{totalGradeMax}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    gradeOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-6">
            <Accordion
              type="single"
              collapsible
              value={gradeOpen ? "grade" : undefined}
              onValueChange={(v) => setGradeOpen(v === "grade")}
              className="w-full"
            >
              <AccordionItem value="grade" className="border-0">
                <AccordionContent id="grade-panel" className="pt-4">
                  {isUnknown && (
                    <p className="mb-3 text-[11px] text-slate-500 dark:text-neutral-400">
                      Dla nieznanych profili ocena jest opcjonalna – możesz ją
                      uzupełnić, gdy będziesz mieć więcej informacji o
                      zawodniku.
                    </p>
                  )}

                  <div className="relative">
                    {/* Główna treść */}
                    <div
                      className={cn(
                        "space-y-5",
                        !effectiveMainPos && "pointer-events-none opacity-40"
                      )}
                    >
                      {/* Poziom docelowy */}
                      <div>
                        <Label className="text-sm">
                          Poziom docelowy – gdzie mógłby grać zawodnik
                        </Label>
                        <Textarea
                          placeholder='Np. "Ekstraklasa top 8", "CLJ U19 czołowy zespół", "II liga – górna połowa"…'
                          value={grade.notes}
                          onChange={(e) => {
                            const v = e.target.value;
                            setGrade((s) => ({ ...s, notes: v }));
                            saveMetaPatch({ targetLevel: v, notes: v });
                          }}
                          className="mt-1"
                        />
                      </div>

                      {/* Oceny 1–5 */}
                      <div className="space-y-5">
                        {enabledRatingAspects.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-neutral-400">
                            Brak skonfigurowanych kategorii ocen. Dodaj je w
                            panelu <b>„Konfiguracja ocen zawodnika”</b>.
                          </p>
                        ) : (
                          <>
                            <RatingGroup
                              title="Podstawowe"
                              aspects={baseAspects}
                            />

                            {effectiveBucket === "GK" && (
                              <RatingGroup
                                title="Bramkarz (GK)"
                                aspects={gkAspects}
                              />
                            )}
                            {effectiveBucket === "DF" && (
                              <RatingGroup
                                title="Obrońca (DEF)"
                                aspects={defAspects}
                              />
                            )}
                            {effectiveBucket === "MF" && (
                              <RatingGroup
                                title="Pomocnik (MID)"
                                aspects={midAspects}
                              />
                            )}
                            {effectiveBucket === "FW" && (
                              <RatingGroup
                                title="Napastnik (ATT)"
                                aspects={attAspects}
                              />
                            )}

                            {!effectiveBucket &&
                              enabledRatingAspects.length > 0 && (
                                <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                                  Ustaw <b>Główną pozycję</b> w sekcji
                                  „Rozszerzone informacje”, aby zobaczyć
                                  dodatkowe kategorie oceny (GK/DEF/MID/ATT).
                                </p>
                              )}
                          </>
                        )}
                      </div>

                      {/* Podsumowanie */}
                      <div>
                        <Label className="text-sm">
                          Podsumowanie – opis zawodnika, mocne/słabe strony,
                          ryzyka, rekomendacja
                        </Label>
                        <Textarea
                          placeholder="Swobodny opis zawodnika, mocne / słabe strony, kluczowe ryzyka, rekomendacja (TAK / NIE / OBSERWOWAĆ)…"
                          value={grade.finalComment}
                          onChange={(e) => {
                            const v = e.target.value;
                            setGrade((s) => ({ ...s, finalComment: v }));
                            saveMetaPatch({
                              finalSummary: v,
                              finalComment: v,
                            });
                          }}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Overlay blokujący, jeśli nie wybrano Głównej pozycji */}
                    {!effectiveMainPos && (
                      <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-white/70 px-4 text-center backdrop-blur-sm dark:bg-neutral-950/80">
                        <p className="mb-3 text-xs sm:text-sm text-slate-700 dark:text-neutral-200">
                          Aby wprowadzić oceny i poziom docelowy, najpierw
                          uzupełnij <b>Główną pozycję</b> w sekcji
                          „Rozszerzone informacje”.
                        </p>
                        <Button
                          size="sm"
                          type="button"
                          className="bg-gray-900 text-white hover:bg-gray-800"
                          onClick={() => {
                            setExtOpen(true);
                            setExtView("profile");
                            setHighlightMainPos(true);
                          }}
                        >
                          Uzupełnij Główną pozycję
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* --- Obserwacje --- */}
        <Card className="mt-3">
          <CardHeader className="flex items-center justify-between border-b border-gray-200 px-4 py-5 md:px-6 dark:border-neutral-800">
            <button
              type="button"
              aria-expanded={obsOpen}
              aria-controls="obs-panel"
              onClick={() => setObsOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="text-xl font-semibold leading-none tracking-tight">
                Obserwacje
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {playerObs.length}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    obsOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>

          <CardContent className="px-4 py-0 md:px-6">
            <Accordion
              type="single"
              collapsible
              value={obsOpen ? "obs" : undefined}
              onValueChange={(v) => setObsOpen(v === "obs")}
            >
              <AccordionItem value="obs" className="border-0">
                <AccordionContent id="obs-panel" className="pt-4">
                  <Tabs defaultValue="new" className="w-full">
                    {/* segmented control */}
                    <TabsList className="mb-3 inline-flex w-full max-w-md items-center justify-between rounded-md bg-gray-100 p-1 shadow-inner dark:bg-neutral-900">
                      <TabsTrigger
                        value="new"
                        className="flex-1 rounded-md px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
                      >
                        Nowa obserwacja
                      </TabsTrigger>
                      <TabsTrigger
                        value="existing"
                        className="flex-1 rounded-md px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
                      >
                        Istniejące
                      </TabsTrigger>
                    </TabsList>
                    <p className="mb-4 text-xs text-slate-500 dark:text-neutral-400">
                      Dodaj nową obserwację tego zawodnika lub przypisz
                      istniejącą z Twojego dziennika.
                    </p>

                    {/* NEW */}
                    <TabsContent value="new" className="mt-2 space-y-4">
                      <div>
                        <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-neutral-100">
                          Mecz
                        </div>
                        <div className="mb-3 text-xs text-slate-700 dark:text-neutral-400">
                          Wpisz drużyny — pole „Mecz” składa się automatycznie.
                        </div>

                        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                          <div>
                            <Label>Drużyna A</Label>
                            <Input
                              value={qaMatch.split(/ *vs */i)[0] || ""}
                              onChange={(e) => {
                                const b =
                                  (qaMatch.split(/ *vs */i)[1] || "").trim();
                                const a = e.target.value;
                                setQaMatch(
                                  a && b ? `${a} vs ${b}` : (a + " " + b).trim()
                                );
                              }}
                              placeholder="np. Lech U19"
                              className="mt-1"
                            />
                          </div>
                          <div className="hidden select-none items-end justify-center pb-2 text-sm text-slate-800 dark:text-neutral-200 sm:flex">
                            vs
                          </div>
                          <div>
                            <Label>Drużyna B</Label>
                            <Input
                              value={
                                (qaMatch.split(/ *vs */i)[1] || "").trim()
                              }
                              onChange={(e) => {
                                const a =
                                  (qaMatch.split(/ *vs */i)[0] || "").trim();
                                const b = e.target.value;
                                setQaMatch(
                                  a && b ? `${a} vs ${b}` : (a + " " + b).trim()
                                );
                              }}
                              placeholder="np. Wisła U19"
                              className="mt-1"
                            />
                          </div>
                          <div className="sm:hidden text-center text-sm text-slate-800 dark:text-neutral-200">
                            vs
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <Label>Data meczu</Label>
                            <Input
                              type="date"
                              value={qaDate}
                              onChange={(e) => setQaDate(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Godzina meczu</Label>
                            <Input
                              type="time"
                              value={qaTime}
                              onChange={(e) => setQaTime(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label>Poziom przeciwnika</Label>
                            <Input
                              value={qaOpponentLevel}
                              onChange={(e) =>
                                setQaOpponentLevel(e.target.value)
                              }
                              placeholder="np. CLJ U17, 3 liga, top akademia…"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-sm">Tryb</Label>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => setQaMode("live")}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60",
                                  qaMode === "live"
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                    : "bg-stone-100 text-gray-800 hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                                )}
                                type="button"
                                aria-pressed={qaMode === "live"}
                              >
                                Live
                              </button>
                              <button
                                onClick={() => setQaMode("tv")}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60",
                                  qaMode === "tv"
                                    ? "bg-violet-600 text-white hover:bg-violet-700"
                                    : "bg-stone-100 text-gray-800 hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                                )}
                                type="button"
                                aria-pressed={qaMode === "tv"}
                              >
                                TV
                              </button>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm">Status</Label>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => setQaStatus("draft")}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60",
                                  qaStatus === "draft"
                                    ? "bg-amber-600 text-white hover:bg-amber-700"
                                    : "bg-stone-100 text-gray-800 hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                                )}
                                type="button"
                                aria-pressed={qaStatus === "draft"}
                              >
                                Szkic
                              </button>
                              <button
                                onClick={() => setQaStatus("final")}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60",
                                  qaStatus === "final"
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-stone-100 text-gray-800 hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                                )}
                                type="button"
                                aria-pressed={qaStatus === "final"}
                              >
                                Finalna
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-1 text-xs text-slate-800 dark:text-neutral-300">
                          <div>
                            Mecz:{" "}
                            <span className="font-medium">
                              {qaMatch || "—"}
                            </span>
                            <span className="ml-2 inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                              {qaMode === "tv" ? "TV" : "Live"}
                            </span>
                          </div>
                          {qaOpponentLevel && (
                            <div className="text-[11px] text-slate-600 dark:text-neutral-400">
                              Poziom przeciwnika:{" "}
                              <span className="font-medium">
                                {qaOpponentLevel}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="sticky bottom-0 mt-1 -mx-4 border-t border-gray-200 bg-white/90 px-4 py-5 md:-mx-6 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            className="bg-gray-900 text-white hover:bg-gray-800"
                            onClick={addObservationForPlayer}
                            disabled={!qaMatch.trim() || !qaDate.trim()}
                          >
                            Dodaj obserwację tego zawodnika
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    {/* EXISTING */}
                    <TabsContent value="existing" className="mt-2 space-y-3">
                      <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 opacity-70" />
                          <Input
                            value={obsQuery}
                            onChange={(e) => setObsQuery(e.target.value)}
                            placeholder="Szukaj po meczu, zawodniku, dacie…"
                            className="flex-1 border-0 focus-visible:ring-0"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                          Wybierz obserwację z listy, aby przypisać ją do tego
                          profilu lub skopiować.
                        </p>
                      </div>

                      <div className="max-h-80 overflow-auto rounded-md border border-gray-200 dark:border-neutral-700">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-stone-100 text-slate-900 dark:bg-neutral-900 dark:text-neutral-300">
                            <tr>
                              <th className="p-2 text-left font-medium">#</th>
                              <th className="p-2 text-left font-medium">
                                Mecz
                              </th>
                              <th className="p-2 text-left font-medium">
                                Zawodnicy
                              </th>
                              <th className="p-2 text-left font-medium">
                                Data
                              </th>
                              <th className="p-2 text-left font-medium">
                                Poziom
                              </th>
                              <th className="p-2 text-left font-medium">
                                Tryb
                              </th>
                              <th className="p-2 text-left font-medium">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {existingFiltered.map((o, idx) => (
                              <tr
                                key={o.id}
                                className={cn(
                                  "cursor-pointer border-t border-gray-200 transition-colors hover:bg-stone-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
                                  idx % 2
                                    ? "bg-stone-100/40 dark:bg-neutral-900/30"
                                    : "",
                                  obsSelectedId === o.id
                                    ? "bg-blue-50/60 dark:bg-blue-900/20"
                                    : ""
                                )}
                                onClick={() => setObsSelectedId(o.id)}
                              >
                                <td className="p-2">
                                  <input
                                    type="radio"
                                    name="obsPick"
                                    checked={obsSelectedId === o.id}
                                    onChange={() => setObsSelectedId(o.id)}
                                  />
                                </td>
                                <td className="p-2">{o.match || "—"}</td>
<td className="p-2">
  {(o.players ?? []).length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {(o.players ?? []).map((n: any, i) => {
        const label =
          typeof n === "string"
            ? n
            : n && typeof n === "object" && "name" in n
            ? String(n.name)
            : "";

        if (!label) return null;

        return (
          <span
            key={`${o.id}-pl-${i}`}
            className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
          >
            {label}
          </span>
        );
      })}
    </div>
  ) : (
    "—"
  )}
</td>

                                <td className="p-2">
                                  {[o.date || "—", o.time || ""]
                                    .filter(Boolean)
                                    .join(" ")}
                                </td>
                                <td className="p-2 text-xs">
                                  {o.opponentLevel || (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                                      (o as any).mode === "tv"
                                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                    )}
                                  >
                                    {(o as any).mode === "tv" ? "TV" : "Live"}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                                      o.status === "final"
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                    )}
                                  >
                                    {o.status === "final"
                                      ? "Finalna"
                                      : "Szkic"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {existingFiltered.length === 0 && (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="p-6 text-center text-sm text-slate-900 dark:text-neutral-400"
                                >
                                  Brak obserwacji dla podanych kryteriów.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-800 dark:text-neutral-400">
                          Wybierz rekord i wybierz akcję.
                        </div>
                        <div className="flex items-center gap-2">
                         
                          <Button
                            className="bg-gray-900 text-white hover:bg-gray-800"
                            disabled={obsSelectedId == null}
                            onClick={reassignExistingToThisPlayer}
                          >
                            Przypisz do zawodnika
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
