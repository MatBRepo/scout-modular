// src/app/(players)/players/add/AddPlayerPage.tsx
"use client";

import { computePlayerProfileProgress } from "@/shared/playerProfileProgress";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import { useRouter } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";

import {
  MainPositionPitch,
  POS_DATA,
  type DetailedPos,
} from "@/shared/MainPositionPitch";

import { ToolbarFull } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import PlayerObservationsTable from "@/features/players/PlayerObservationsTable";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronsUpDown,
  Check,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import StarRating from "@/shared/ui/StarRating";
import { KnownPlayerIcon, UnknownPlayerIcon } from "@/components/icons";

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
import { format } from "date-fns";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { RadioChipGroup } from "@/components/ui/RadioChipGroup";

// NEW: RAC fields
import { NumericField } from "@/components/ui/numeric-field-rac";
import { CircularProgress } from "@/shared/ui/CircularProgress";

// header actions (global)
import { useHeaderActions } from "@/app/ClientRoot";

/* ===== ENV / defaults ===== */
const SCOUT_DEFAULT_COUNTRY =
  process.env.NEXT_PUBLIC_SCOUT_DEFAULT_COUNTRY || "";

/* ===== Positions ===== */
type BucketPos = "GK" | "DF" | "MF" | "FW";

const toBucket = (p: DetailedPos): BucketPos => {
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
  }
};

/* ===== Countries ===== */
type Country = { code: string; name: string; flag: string };
const COUNTRIES: Country[] = [
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GB", name: "England", flag: "🇬🇧" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹" },
  { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "HR", name: "Croatia", flag: "🇭🇷" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
];

/* ===== Small UI ===== */

function SavePill({
  state,
  size = "default",
}: {
  state: "idle" | "saving" | "saved";
  size?: "default" | "compact";
  mode?: "known" | "unknown" | null;
}) {
  const base =
    size === "compact"
      ? "inline-flex h-8 items-center rounded-md px-2 text-xs leading-none"
      : "inline-flex h-10 items-center rounded-md px-3 text-sm leading-none";

  const map = {
    saving: "text-amber-700 dark:text-amber-200",
    saved: "text-emerald-700 dark:text-emerald-200",
    idle: "text-gray-600 dark:text-neutral-300",
  } as const;

  if (state === "idle") {
    return null;
  }

  return (
    <>
      <span className={cn(base, map[state], "hidden md:inline-flex")} aria-live="polite">
        {state === "saving" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
            <span className="hidden md:inline">Autosaving…</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Saved</span>
          </>
        )}
      </span>

      <div className="fixed top-[57px] left-0 right-0 z-[60] h-[3px] md:hidden">
        {state === "saving" && (
          <div className="h-full w-full overflow-hidden bg-gray-500/10">
            <div className="animate-progress-saving h-full w-0" />
          </div>
        )}
        {state === "saved" && (
          <div className="h-full w-full bg-emerald-500" />
        )}
      </div>
    </>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
      {text}
    </span>
  );
}

/* Country combobox (old – np. kraj urodzenia) */
function CountryCombobox({
  value,
  onChange,
  chip,
}: {
  value: string;
  onChange: (next: string) => void;
  chip?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "relative flex w-full items-center justify-between rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm transition",
            "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-0",
            "dark:border-neutral-700 dark:bg-neutral-950",
            chip ? "pr-24" : ""
          )}
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2 truncate",
              !selected && "text-muted-foreground"
            )}
          >
            {selected ? (
              <>
                <span className="text-lg leading-none">{selected.flag}</span>
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              "Select country"
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="ml-2 h-4 w-4 shrink-0 text-muted-foreground/80"
          />
          {chip ? <Chip text={chip} /> : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          "w-[--radix-popover-trigger-width] p-0",
          "border border-gray-300 dark:border-neutral-700"
        )}
      >
        <Command>
          <CommandInput
            placeholder="Search country..."
            className={cn(
              "m-2 h-9 w-[calc(100%-1rem)] rounded-md border border-stone-200 bg-background px-3 text-sm",
              "shadow-none outline-none",
              "focus-visible: focus-visible:ring-emerald-500 focus-visible:ring-offset-0",
              "dark:border-neutral-700 dark:bg-neutral-950"
            )}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => {
                const isActive = c.name === value;
                return (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.code}`}
                    onSelect={() => {
                      onChange(c.name);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <span className="text-lg leading-none">{c.flag}</span>
                    <span className="truncate">{c.name}</span>
                    {isActive && (
                      <Check className="ml-auto h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* NOWY: CountrySearchCombobox – taki jak w PlayerEditorPage dla kraju klubu */
function CountrySearchCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm transition",
            "hover:bg:white focus-visible:outline-none focus-visible:ring-offset-0",
            "dark:border-neutral-700 dark:bg-neutral-950"
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected ? (
              <>
                <span className="text-lg leading-none">{selected.flag}</span>
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select country</span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="ml-2 h-4 w-4 shrink-0 text-muted-foreground/80"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-[--radix-popover-trigger-width] p-0",
          "border border-gray-300 dark:border-neutral-700"
        )}
      >
        <Command>
          <CommandInput
            placeholder="Search country..."
            className={cn(
              "m-2 h-9 w-[calc(100%-1rem)] rounded-md border border-stone-200 bg-background px-3 text-sm",
              "shadow-none outline-none",
              "focus-visible:outline-none focus-visible:ring-offset-0",
              "dark:border-neutral-700 dark:bg-neutral-950"
            )}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((country) => {
                const isActive = selected?.code === country.code;
                return (
                  <CommandItem
                    key={country.code}
                    value={country.name}
                    onSelect={() => {
                      onChange(country.name);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <span className="text-lg leading-none">
                      {country.flag}
                    </span>
                    <span className="truncate">{country.name}</span>
                    {isActive && (
                      <Check className="ml-auto h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* Utility: safe text-normalizer for possibly object values */
function safeText(val: any): string {
  if (val == null) return "";
  if (typeof val === "string" || typeof val === "number") return String(val);
  if (typeof val === "object") {
    if ("name" in val) return String((val as any).name);
    if ("label" in val) return String((val as any).label);
  }
  return "";
}

/* DateTime picker 24h – placeholder type for hidden code */
type DateTimeValue = {
  date: string;
  time: string;
};

/* ===== Editor-like Add page ===== */
type Choice = "known" | "unknown" | null;

type ObsRec = {
  id: number;
  match?: string | any;
  date?: string | any;
  time?: string | any;
  status?: "draft" | "final";
  mode?: "live" | "tv";
  opponentLevel?: string | any;
  players?: any[];
};

type PlayerRatings = Record<string, number>;

function getDefaultExt() {
  return {
    height: "",
    weight: "",
    dominantFoot: "",
    mainPos: "" as DetailedPos | "",
    altPositions: [] as DetailedPos[],

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

    injuryHistory: "",
    minutes365: "",
    starts365: "",
    subs365: "",
    goals365: "",

    phone: "",
    email: "",
    fb: "",
    ig: "",
    tiktok: "",
  };
}

type ExtKey = "profile" | "eligibility" | "stats365" | "contact";

export default function AddPlayerPage() {
  const router = useRouter();
  const { setActions } = useHeaderActions();

  const [playerId, setPlayerId] = useState<number | null>(null);

  const [choice, setChoice] = useState<Choice>(null);

  const [basicOpen, setBasicOpen] = useState(true);
  const [extOpen, setExtOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [club, setClub] = useState("");
  const [clubCountry, setClubCountry] = useState("");

  const [jerseyNumber, setJerseyNumber] = useState("");
  const [uNote, setUNote] = useState("");

  const [posDet, setPosDet] = useState<DetailedPos>("CM");
  const [uPosDet, setUPosDet] = useState<DetailedPos>("CM");

  const [ext, setExt] = useState(getDefaultExt);

  const [ratingConfig, setRatingConfig] = useState<RatingsConfig>(() =>
    loadRatings()
  );
  const [ratings, setRatings] = useState<PlayerRatings>({});
  const [notes, setNotes] = useState("");

  const basicRef = useRef<HTMLDivElement | null>(null);

  // default scout country – only if none set
  useEffect(() => {
    if (!SCOUT_DEFAULT_COUNTRY) return;
    setExt((prev) => {
      if (prev.birthCountry) return prev;
      return { ...prev, birthCountry: SCOUT_DEFAULT_COUNTRY };
    });
    setClubCountry((prev) => prev || SCOUT_DEFAULT_COUNTRY);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await syncRatingsFromSupabase();
      if (!cancelled) setRatingConfig(cfg);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledRatingAspects = useMemo<RatingAspect[]>(() => {
    return ratingConfig.filter((r) => r.enabled !== false);
  }, [ratingConfig]);

  // AUTOMATIC calculation of profile mode (known / unknown)
  // Known player = possesses first name or last name
  // Unknown player = lack of first name and last name, but other data exists (e.g. number, club etc.)
  useEffect(() => {
    const hasName =
      firstName.trim() !== "" && lastName.trim() !== "";

    const hasAnyOtherData =
      jerseyNumber.trim() !== "" ||
      birthYear.trim() !== "" ||
      club.trim() !== "" ||
      clubCountry.trim() !== "" ||
      uNote.trim() !== "";

    let next: Choice = null;

    if (hasName) {
      // as soon as first name or last name appears – treated as "known"
      next = "known";
    } else if (hasAnyOtherData) {
      // lack of first name/last name, but number/year/club/note exists -> "unknown"
      next = "unknown";
    } else {
      next = null;
    }

    setChoice((prev) => (prev === next ? prev : next));
  }, [
    firstName,
    lastName,
    birthYear,
    club,
    clubCountry,
    jerseyNumber,
    uNote,
  ]);


  // Name displayed in player observation table
  const playerDisplayName = useMemo(() => {
    if (choice === "known") {
      const fn = firstName.trim();
      const ln = lastName.trim();
      const full = `${fn} ${ln}`.trim();
      return full || "Unknown player";
    }
    const num = jerseyNumber.trim();
    const clubLabel = club.trim();
    if (num) {
      return `#${num} – ${clubLabel || "No club"}`;
    }
    return clubLabel || "Unknown player";
  }, [choice, firstName, lastName, jerseyNumber, club]);

  const countTruthy = (vals: Array<unknown>) =>
    vals.filter((v) => {
      if (typeof v === "number") return v > 0;
      return !!(v !== null && v !== undefined && String(v).trim() !== "");
    }).length;

  const cntBasicKnown = countTruthy([
    firstName,
    lastName,
    birthYear,
    club,
    clubCountry,
  ]);
  const cntBasicUnknown = countTruthy([
    jerseyNumber,
    club,
    clubCountry,
    uNote,
  ]);
  const badgeBasic =
    choice === "unknown"
      ? cntBasicUnknown
      : choice === "known"
        ? cntBasicKnown
        : 0;
  const basicMax =
    choice === "unknown" ? 4 : choice === "known" ? 5 : 0;

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

  const cntRatingsFilled = countTruthy(Object.values(ratings));
  const cntGradeBadge = Number(Boolean(notes)) + cntRatingsFilled;
  const cntGradeMax = 1 + enabledRatingAspects.length;

  const baseAspects = enabledRatingAspects.filter(
    (a) => (a.groupKey ?? "GEN") === "GEN"
  );
  const gkAspects = enabledRatingAspects.filter((a) => a.groupKey === "GK");
  const defAspects = enabledRatingAspects.filter((a) => a.groupKey === "DEF");
  const midAspects = enabledRatingAspects.filter((a) => a.groupKey === "MID");
  const attAspects = enabledRatingAspects.filter((a) => a.groupKey === "FW");

  const effectiveMainPos: DetailedPos | "" =
    (ext.mainPos as DetailedPos | "") || "";
  const effectiveBucket: BucketPos | null = effectiveMainPos
    ? toBucket(effectiveMainPos)
    : null;

  const [observations, setObservations] = useState<ObsRec[]>([]);
  const [obsQuery, setObsQuery] = useState("");
  const [obsSelectedId, setObsSelectedId] = useState<number | null>(null);
  const [qaMatch, setQaMatch] = useState("");
  const [qaDate, setQaDate] = useState("");
  const [qaTime, setQaTime] = useState("");
  const [qaMode, setQaMode] = useState<"live" | "tv">("live");
  const [qaStatus, setQaStatus] = useState<"draft" | "final">("draft");
  const [qaOpponentLevel, setQaOpponentLevel] = useState("");

  const [qaTeamA, setQaTeamA] = useState("");
  const [qaTeamB, setQaTeamB] = useState("");
  const QA_CONDITIONS: ("live" | "tv")[] = ["live", "tv"];

  function updateQaMatchFromTeams(a: string, b: string) {
    setQaTeamA(a);
    setQaTeamB(b);
    const composed =
      a.trim() && b.trim()
        ? `${a.trim()} vs ${b.trim()}`
        : (a + " " + b).trim();
    setQaMatch(composed);
  }

  // Loading observations from global log
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabase();

        const { data, error } = await supabase
          .from("observations")
          .select(
            "id, match, date, time, status, mode, opponentLevel, players"
          )
          .order("date", { ascending: false })
          .order("time", { ascending: false });

        if (error) {
          console.error(
            "[AddPlayerPage] Supabase load observations error:",
            error
          );
          return;
        }

        if (!cancelled && data) {
          const mapped: ObsRec[] = data.map((row: any) => ({
            id: row.id,
            match: safeText(row.match),
            date: safeText(row.date),
            time: safeText(row.time),
            status: (row.status as "draft" | "final") ?? "draft",
            mode: (row.mode as "live" | "tv") ?? "live",
            opponentLevel: safeText(row.opponentLevel),
            players: row.players ?? [],
          }));
          setObservations(mapped);
        }
      } catch (err) {
        console.error(
          "[AddPlayerPage] Supabase load observations exception:",
          err
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function addObservation() {
    const next: ObsRec = {
      id: Date.now(),
      match: qaMatch.trim() || "—",
      date: qaDate || "",
      time: qaTime || "",
      status: qaStatus,
      mode: qaMode,
      opponentLevel: qaOpponentLevel.trim() || "",
      players: [],
    };
    setObservations((prev) => [next, ...prev]);
    setQaMatch("");
    setQaDate("");
    setQaTime("");
    setQaMode("live");
    setQaStatus("draft");
    setQaOpponentLevel("");
    setQaTeamA("");
    setQaTeamB("");
  }

  const normalizedObservations = useMemo<ObsRec[]>(() => {
    return (observations || []).map((o) => ({
      ...o,
      match: safeText(o.match),
      date: safeText(o.date),
      time: safeText(o.time),
      opponentLevel: safeText(o.opponentLevel),
    }));
  }, [observations]);

  const existingFiltered = useMemo(() => {
    const q = obsQuery.trim().toLowerCase();
    const arr = [...normalizedObservations].sort((a, b) =>
      ((b.date || "") + (b.time || "")).localeCompare(
        (a.date || "") + (a.time || "")
      )
    );
    if (!q) return arr;
    return arr.filter((o) => {
      const matchText = (o.match || "").toLowerCase();
      const dateText = o.date || "";
      return matchText.includes(q) || dateText.includes(q);
    });
  }, [normalizedObservations, obsQuery]);

  const [editOpen, setEditOpen] = useState(false);
  const [editingObs, setEditingObs] = useState<ObsRec | null>(null);

  function openEditModal(o: ObsRec) {
    setEditingObs({ ...o });
    setEditOpen(true);
  }

  function saveEditedObservation() {
    if (!editingObs) return;
    const next = observations.map((o) =>
      o.id === editingObs.id ? editingObs : o
    );
    setObservations(next);
    setEditOpen(false);
  }

  const [extView, setExtView] = useState<ExtKey>("profile");

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave to Supabase – for new record: INSERT, then UPDATE as in the editor
  useEffect(() => {
    let cancelled = false;

    // Is there any meaningful input?
    const hasAnyData =
      firstName.trim() !== "" ||
      lastName.trim() !== "" ||
      birthYear.trim() !== "" ||
      jerseyNumber.trim() !== "" ||
      club.trim() !== "" ||
      clubCountry.trim() !== "";

    if (!hasAnyData) {
      setSaveState("idle");
      return;
    }

    // choice may help, but don't block immediately
    const isKnown = choice === "known";

    setSaveError(null);
    setSaveState("saving");

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      (async () => {
        try {
          const supabase = getSupabase();
          const currentYear = new Date().getFullYear();

          const isKnownX = isKnown; // or choice === "known"
          let name: string;
          let clubFinal: string;
          let posBucket: BucketPos;
          let clubCountryFinal: string | null;
          let age = 0;

          if (isKnownX) {
            const fn = firstName.trim();
            const ln = lastName.trim();
            name = `${fn} ${ln}`.trim() || "No name";
            clubFinal = club.trim();
            clubCountryFinal = clubCountry.trim() || null;
            posBucket = toBucket(posDet);

            if (birthYear.trim()) {
              const by = parseInt(birthYear.trim(), 10);
              if (!Number.isNaN(by)) {
                age = Math.max(0, currentYear - by);
              }
            }
          } else {
            const num = jerseyNumber.trim();
            const c = club.trim();
            const cc = clubCountry.trim();

            name = num ? `#${num} – ${c}` : c || "Unknown player";
            clubFinal = c;
            clubCountryFinal = cc || null;
            posBucket = toBucket(uPosDet || posDet);
          }

          const nationalityVal =
            ext.birthCountry.trim() || clubCountryFinal || null;

          const meta = {
            mode: isKnownX ? "known" : "unknown",
            extended: ext,
            ratings,
            notes,
            unknownNote: uNote || null,
            basic: {
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
              birthYear: birthYear.trim() || null,
              club: club.trim() || null,
              clubCountry: clubCountry.trim() || null,
              jerseyNumber: jerseyNumber.trim() || null,
              posDet,
              uPosDet,
            },
            observationsMeta: {
              selectedId: obsSelectedId,
              list: normalizedObservations,
            },
          };

          const basePayload: any = {
            name,
            pos: posBucket,
            club: clubFinal,
            age,
            status: "active",
            firstName: isKnownX ? firstName.trim() || null : null,
            lastName: isKnownX ? lastName.trim() || null : null,
            birthDate: isKnownX ? birthYear.trim() || null : null,
            nationality: nationalityVal,
            photo: null,
            meta,
            // tenant_id, created_by etc. if RLS requires it
          };

          let error;
          if (!playerId) {
            const { data, error: insertError } = await supabase
              .from("players")
              .insert(basePayload)
              .select("id")
              .single();

            error = insertError;
            if (!insertError && data && !cancelled) {
              setPlayerId(data.id);
            }
          } else {
            const { error: updateError } = await supabase
              .from("players")
              .update(basePayload)
              .eq("id", playerId);

            error = updateError;
          }

          if (error) {
            console.error("[AddPlayerPage] Supabase save error:", error);
            if (!cancelled) {
              setSaveState("idle");
              setSaveError("Failed to save player to Supabase.");
            }
            return;
          }

          if (!cancelled) {
            setSaveState("saved");
          }
        } catch (err) {
          console.error("[AddPlayerPage] Supabase save exception:", err);
          if (!cancelled) {
            setSaveState("idle");
            setSaveError("An error occurred while saving player to Supabase.");
          }
        }
      })();
    }, 700);

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    choice,
    firstName,
    lastName,
    birthYear,
    club,
    clubCountry,
    jerseyNumber,
    posDet,
    uPosDet,
    ext,
    ratings,
    notes,
    normalizedObservations,
    obsSelectedId,
    playerId,
    uNote,
  ]);

  // PROGRESS: global completion percent – jak w PlayerEditorPage
  const completionPercent = useMemo(() => {
    const virtualPlayer = {
      firstName,
      lastName,
      birthDate: birthYear,
      club,
      nationality: ext.birthCountry || clubCountry,
      meta: {
        mode: choice,
        basic: {
          firstName,
          lastName,
          birthYear,
          club,
          clubCountry,
          jerseyNumber,
        },
        extended: ext,
        ratings,
        notes,
        unknownNote: uNote,
      },
    };

    return computePlayerProfileProgress(virtualPlayer as any);
  }, [
    choice,
    firstName,
    lastName,
    birthYear,
    club,
    clubCountry,
    jerseyNumber,
    ext,
    ratings,
    notes,
    uNote,
  ]);

  const stepPillClass =
    "inline-flex h-6 items-center rounded-md bg-stone-100 px-2.5 text-[11px] tracking-wide text-stone-600 dark:bg-neutral-900 dark:text-neutral-200";

  // Helper to avoid infinite loop in observations onChange
  function mapTableRowsToObservations(rows: any[]): ObsRec[] {
    return (rows || []).map((o: any) => ({
      id: Number(o.id) || Date.now(),
      match: safeText(o.match),
      date: safeText(o.date),
      time: safeText(o.time),
      status: (o.status as "draft" | "final") ?? "draft",
      mode: (o.mode as "live" | "tv") ?? "live",
      opponentLevel: safeText(o.opponentLevel),
      players: o.players ?? [],
    }));
  }

  function areObsListsEqual(a: ObsRec[], b: ObsRec[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];
      if (
        x.id !== y.id ||
        safeText(x.match) !== safeText(y.match) ||
        safeText(x.date) !== safeText(y.date) ||
        safeText(x.time) !== safeText(y.time) ||
        x.status !== y.status ||
        x.mode !== y.mode ||
        safeText(x.opponentLevel) !== safeText(y.opponentLevel)
      ) {
        return false;
      }
    }
    return true;
  }

  // Header actions: Autozapis + Postęp profilu + powrót (jak w PlayerEditorPage)
  useEffect(() => {
    const node = (
      <div className="flex items-center gap-3">
        <SavePill state={saveState} size="compact" />

        {/* PROGRESS BAR (global postęp profilu) */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-2">
            <CircularProgress progress={completionPercent} size={32} strokeWidth={2} showValue />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 px-3 text-xs md:inline-flex"
          onClick={() => router.push("/players")}
        >
          Back to list
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="inline-flex h-8 w-8 p-0 md:hidden"
          aria-label="Back to list"
          onClick={() => router.push("/players")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );

    setActions(node);
    return () => {
      // No-op cleanup to prevent double re-render on every keystroke
    };
  }, [setActions, saveState, router, completionPercent]);

  const addTitle = (
    <div className="w-full">
      <div className="flex items-center gap-2 w-full">
        <h2 className="mt-1 text-xl font-semibold leading-none tracking-tight">
          {playerDisplayName === "Unknown player" ? "Add player" : playerDisplayName}
        </h2>
        {choice === "known" && (
          <span className="ml-auto inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            <KnownPlayerIcon
              className="mr-1.5 h-4 w-4 text-emerald-700"
              strokeWidth={1.4}
            />
            Known
          </span>
        )}
        {choice === "unknown" && (
          <span className="ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            <UnknownPlayerIcon
              className="mr-1.5 h-4 w-4 text-rose-700"
              strokeWidth={1.4}
            />
            Unknown
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-4">
      {/* Toolbar – title as node + status badge */}
      <ToolbarFull title={addTitle} right={null} />



      {/* Kroki 1–4 – zsynchronizowane z PlayerEditorPage */}
      <div className="space-y-4">
        {/* KROK 1 – Podstawowe informacje + Główna pozycja (pitch) */}
        <Card ref={basicRef} className="mt-1">
          <CardHeader
            className={cn(
              "group flex rounded-md items-center justify-between  border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-4 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              basicOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={basicOpen}
              aria-controls="basic-panel"
              onClick={() => setBasicOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className={stepPillClass}>Step 1 · Basic data</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Basic information
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Just fill in the fields below – the system will decide if the
                  profile is <b>named</b> or <b>anonymous</b>.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {badgeBasic}/{basicMax || "—"}
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
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={basicOpen ? "basic" : undefined}
              onValueChange={(v) => setBasicOpen(v === "basic")}
              className="w-full"
            >
              <AccordionItem value="basic" className="border-0">
                <AccordionContent id="basic-panel" className="pt-4 pb-5">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                      <div>
                        <Label className="text-sm">First name</Label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="e.g. John"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Last name</Label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="e.g. Smith"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Birth year</Label>
                        <NumericField
                          value={
                            birthYear === "" ? undefined : Number(birthYear.replace(/\D/g, ""))
                          }
                          onChange={(val) => {
                            if (val == null) {
                              setBirthYear("");
                              return;
                            }

                            const next = String(Math.max(0, val));
                            // block > 4 digits, without replacing with 9999
                            if (next.length > 4) {
                              return;
                            }

                            setBirthYear(next);
                          }}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <NumericField
                          label="Jersey number"
                          value={
                            jerseyNumber === ""
                              ? undefined
                              : Number(jerseyNumber.replace(/\D/g, ""))
                          }
                          onChange={(val) =>
                            setJerseyNumber(
                              val == null ? "" : String(val)
                            )
                          }
                          placeholder="e.g. 27"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Current club</Label>
                        <Input
                          value={club}
                          onChange={(e) => setClub(e.target.value)}
                          placeholder="e.g. Lech Poznań U19"
                        />
                      </div>
                      <div>
                        <Label className="pb-2 text-sm">
                          Club country / current club country
                        </Label>
                        <CountrySearchCombobox
                          value={clubCountry}
                          onChange={(val) => setClubCountry(val)}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <MainPositionPitch
                          value={(ext.mainPos as DetailedPos | "") || ""}
                          onChange={(pos) => {
                            setExt((s) => ({ ...s, mainPos: pos }));
                            setPosDet(pos);
                            setUPosDet(pos);
                          }}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <Label className="text-sm">
                          Own note (optional)
                        </Label>
                        <Textarea
                          value={uNote}
                          onChange={(e) => setUNote(e.target.value)}
                          placeholder="Short note about the player, scout context…"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* KROK 2 – Rozszerzone informacje */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group flex rounded-md items-center justify-between  p-0 border-gray-200 transition-colors hover:bg-stone-50/80  dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              extOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={extOpen}
              aria-controls="ext-panel"
              onClick={() => setExtOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left px-4 py-4"
            >
              <div>
                <div className={stepPillClass}>Step 2 · Pitch profile</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Extended information
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Additional sports, contract and contact data – useful in a
                  professional scouting report.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-stone-500 sm:inline">
                    Anonymous profile
                  </span>
                )}
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
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={extOpen ? "ext" : undefined}
              onValueChange={(v) => setExtOpen(v === "ext")}
              className="w-full"
            >
              <AccordionItem value="ext" className="border-0">
                <AccordionContent id="ext-panel" className="pt-4 pb-5">
                  {choice === "unknown" && (
                    <p className="mb-3 text-[11px] text-stone-500 dark:text-neutral-400">
                      You can gradually fill in this data as you get to know the
                      player better.
                    </p>
                  )}

                  <Tabs value={extView} onValueChange={(v: any) => setExtView(v)} className="w-full">
                    {/* wrapper does scroll */}
                    <div
                      className={cn(
                        "relative",
                        // if you want full width on mobile without breaking card paddings:
                        "-mx-4 px-4 md:mx-0 md:px-0",
                        "overflow-x-auto overflow-y-hidden md:overflow-visible",
                        "[-webkit-overflow-scrolling:touch]",
                        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      )}
                    >
                      <TabsList
                        className={cn(
                          // key: list should have width from content, not 100%
                          "inline-flex min-w-max",
                          "gap-1 rounded-md bg-stone-100 p-1 dark:bg-neutral-900",
                          "whitespace-nowrap"
                        )}
                      >
                        <TabsTrigger value="profile" className="flex-none">
                          Pitch profile
                        </TabsTrigger>
                        <TabsTrigger value="eligibility" className="flex-none">
                          Status &amp; scouting
                        </TabsTrigger>
                        <TabsTrigger value="stats365" className="flex-none">
                          Health and statistics
                        </TabsTrigger>
                        <TabsTrigger value="contact" className="flex-none">
                          Contact &amp; social
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="profile" className="mt-4">
                      <ExtContent view="profile" ext={ext} setExt={setExt} />
                    </TabsContent>
                    <TabsContent value="eligibility" className="mt-4">
                      <ExtContent view="eligibility" ext={ext} setExt={setExt} />
                    </TabsContent>
                    <TabsContent value="stats365" className="mt-4">
                      <ExtContent view="stats365" ext={ext} setExt={setExt} />
                    </TabsContent>
                    <TabsContent value="contact" className="mt-4">
                      <ExtContent view="contact" ext={ext} setExt={setExt} />
                    </TabsContent>
                  </Tabs>



                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* KROK 3 – Ocena */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group flex rounded-md items-center justify-between  border-gray-200  transition-colors hover:bg-stone-50/80 p-0 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              gradeOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={gradeOpen}
              aria-controls="grade-panel"
              onClick={() => setGradeOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left px-4 py-4"
            >
              <div>
                <div className={stepPillClass}>Step 3 · Rating</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Player rating
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Break down the rating into technical, mental and physical
                  categories – you configure them in the "Player ratings
                  configuration" module.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-stone-500 sm:inline">
                    Anonymous profile
                  </span>
                )}
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {cntGradeBadge}/{cntGradeMax}
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
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={gradeOpen ? "grade" : undefined}
              onValueChange={(v) => setGradeOpen(v === "grade")}
              className="w-full"
            >
              <AccordionItem value="grade" className="border-0">
                <AccordionContent id="grade-panel" className="pt-4 pb-5">
                  {choice === "unknown" && (
                    <p className="mb-3 text-[11px] text-stone-500 dark:text-neutral-400">
                      You can fill in ratings even for an anonymous profile –
                      it's important to maintain consistency with the main
                      position.
                    </p>
                  )}

                  <div className="relative">
                    <div
                      className={cn(
                        "space-y-6",
                        !effectiveMainPos && "pointer-events-none opacity-40"
                      )}
                    >
                      <div>
                        <Label className="text-sm">General notes</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Short comment about the player…"
                          className="mt-1"
                        />
                      </div>

                      <div className="space-y-6">
                        {enabledRatingAspects.length === 0 && (
                          <p className="text-xs text-stone-500 dark:text-neutral-400">
                            No rating categories configured. Add them in the
                            panel "Player ratings configuration".
                          </p>
                        )}

                        <RatingGroup 
                          title="Basic" 
                          aspects={baseAspects} 
                          ratings={ratings}
                          setRatings={setRatings}
                        />

                        {effectiveBucket === "GK" && (
                          <RatingGroup
                            title="Goalkeeper (GK)"
                            aspects={gkAspects}
                            ratings={ratings}
                            setRatings={setRatings}
                          />
                        )}
                        {effectiveBucket === "DF" && (
                          <RatingGroup
                            title="Defender (DEF)"
                            aspects={defAspects}
                            ratings={ratings}
                            setRatings={setRatings}
                          />
                        )}
                        {effectiveBucket === "MF" && (
                          <RatingGroup
                            title="Midfielder (MID)"
                            aspects={midAspects}
                            ratings={ratings}
                            setRatings={setRatings}
                          />
                        )}
                        {effectiveBucket === "FW" && (
                          <RatingGroup
                            title="Forward (ATT)"
                            aspects={attAspects}
                            ratings={ratings}
                            setRatings={setRatings}
                          />
                        )}

                        {!effectiveBucket &&
                          enabledRatingAspects.length > 0 && (
                            <p className="text-[11px] text-stone-500 dark:text-neutral-400">
                              Set the <b>Main position</b> in step 1 to
                              see additional rating categories
                              (GK/DEF/MID/ATT).
                            </p>
                          )}
                      </div>
                    </div>

                    {!effectiveMainPos && (
                      <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-white/70 px-4 text-center backdrop-blur-sm dark:bg-neutral-950/80">
                        <p className="mb-3 text-xs text-stone-700 dark:text-neutral-200 sm:text-sm">
                          To enter ratings, first fill in the player's{" "}
                          <b>Main position</b> in step 1.
                        </p>
                        <Button
                          size="sm"
                          type="button"
                          className="bg-gray-900 text-white hover:bg-gray-800"
                          onClick={() => {
                            setBasicOpen(true);
                            basicRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }}
                        >
                          Go to step 1
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* KROK 4 – Obserwacje */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group bg-[#E3E0F9] flex rounded-md items-center justify-between  border-gray-200  transition-colors hover:bg-[#D4CEFF] p-0 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              obsOpen && "bg-[#E3E0F9] dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={obsOpen}
              aria-controls="obs-panel"
              onClick={() => setObsOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left px-4 py-4"
            >
              <div>
                <div className={stepPillClass}>Step 4 · Observations</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Observations
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Add matches and assign them to the player's profile. You can
                  use the global observation log.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-stone-500 sm:inline">
                    Anonymous profile
                  </span>
                )}
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {normalizedObservations.length}
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
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={obsOpen ? "obs" : undefined}
              onValueChange={(v) => setObsOpen(v === "obs")}
            >
              <AccordionItem value="obs" className="border-0">
                <AccordionContent id="obs-panel" className="pt-4 pb-5">
                  {choice === "unknown" && (
                    <p className="mb-3 text-[11px] text-stone-500 dark:text-neutral-400">
                      You can also create observations for an anonymous profile
                      – it's important to maintain consistency of the match and
                      level.
                    </p>
                  )}

                  <div className="mb-6">
                    <PlayerObservationsTable
                      playerName={playerDisplayName}
                      observations={normalizedObservations as any}
                      onChange={(next) => {
                        const mapped = mapTableRowsToObservations(
                          next as any[]
                        );
                        setObservations((prev) =>
                          areObsListsEqual(prev, mapped) ? prev : mapped
                        );
                      }}
                    />
                  </div>

                  {false && (
                    <>
                      <div className="space-y-8">{/* ... old QA ... */}</div>
                      <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit observation</DialogTitle>
                          </DialogHeader>
                          {editingObs && (
                            <div className="space-y-4">
                              {/* ...old edit form... */}
                            </div>
                          )}
                          <DialogFooter className="mt-4">
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() => setEditOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              className="bg-gray-900 text-white hover:bg-gray-800"
                              onClick={saveEditedObservation}
                            >
                              Save changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {saveError && (
        <p className="mt-3 text-sm text-red-600">{saveError}</p>
      )}
    </div>
  );
}
    /* ===== Sub-components (moved outside to prevent re-render focus issues) ===== */

function ExtContent({
  view,
  ext,
  setExt,
}: {
  view: ExtKey;
  ext: any;
  setExt: React.Dispatch<React.SetStateAction<any>>;
}) {
  switch (view) {
    case "profile": {
      const bucketLabels: Record<BucketPos, string> = {
        GK: "Goalkeeper",
        DF: "Defense",
        MF: "Midfield",
        FW: "Attack",
      };

      const byBucket: Record<BucketPos, typeof POS_DATA> = {
        GK: [],
        DF: [],
        MF: [],
        FW: [],
      };

      POS_DATA.forEach((opt) => {
        const bucket = toBucket(opt.value as DetailedPos);
        byBucket[bucket] = [...byBucket[bucket], opt];
      });

      // We don't show the goalkeeper in alternative positions
      const bucketOrder: BucketPos[] = ["DF", "MF", "FW"];

      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label className="text-sm">Height (cm)</Label>
              <NumericField
                value={ext.height === "" ? undefined : Number(ext.height)}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    height: val == null ? "" : String(val),
                  }))
                }
                placeholder="e.g. 182"
              />
            </div>

            <div>
              <Label className="text-sm">Weight (kg)</Label>
              <NumericField
                value={ext.weight === "" ? undefined : Number(ext.weight)}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    weight: val == null ? "" : String(val),
                  }))
                }
                placeholder="e.g. 76"
              />
            </div>

            <div>
              <Label className="text-sm">Dominant foot</Label>
              <Select
                value={ext.dominantFoot || undefined}
                onValueChange={(val) =>
                  setExt((s) => ({ ...s, dominantFoot: val }))
                }
              >
                <SelectTrigger className="w-full border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">Right (R)</SelectItem>
                  <SelectItem value="L">Left (L)</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm">Alternative positions</Label>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {bucketOrder.map((bucket) => {
                const group = byBucket[bucket];
                if (!group.length) return null;

                return (
                  <div key={bucket} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-400">
                      {bucketLabels[bucket]}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {group.map((opt) => {
                        const checked = ext.altPositions.includes(opt.value);
                        const itemId = `alt-pos-${opt.value}`;

                        return (
                          <div
                            key={opt.value}
                            className={cn(
                              "relative flex w-full items-start gap-2 rounded-md border border-input p-3 text-xs shadow-xs outline-none",
                              "has-[data-state=checked]:border-[#000000] has-[data-state=checked]:bg-primary/5"
                            )}
                          >
                            <Checkbox
                              id={itemId}
                              aria-describedby={`${itemId}-description`}
                              className="order-1 mt-0.5 after:absolute after:inset-0"
                              checked={checked}
                              onCheckedChange={(next) => {
                                const isChecked = Boolean(next);
                                setExt((s) => {
                                  const current = s.altPositions;
                                  const nextPositions = isChecked
                                    ? [...current, opt.value]
                                    : current.filter((x) => x !== opt.value);
                                  return {
                                    ...s,
                                    altPositions: nextPositions,
                                  };
                                });
                              }}
                            />
                            <div className="grid grow gap-1">
                              <Label
                                htmlFor={itemId}
                                className="text-xs font-medium text-foreground"
                              >
                                {opt.code}{" "}
                                <span className="font-normal text-muted-foreground text-[11px] leading-[inherit]">
                                  ({opt.name})
                                </span>
                              </Label>
                              <p
                                className="text-[11px] text-muted-foreground"
                                id={`${itemId}-description`}
                              >
                                {opt.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    case "eligibility":
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <RadioChipGroup
                legend="English language proficiency"
                layout="grid-2"
                value={
                  ext.english === true
                    ? "yes"
                    : ext.english === false
                      ? "no"
                      : ""
                }
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    english:
                      val === "yes" ? true : val === "no" ? false : null,
                  }))
                }
              />
            </div>
            <div>
              <RadioChipGroup
                legend="EU Passport"
                layout="grid-2"
                value={
                  ext.euPassport === true
                    ? "yes"
                    : ext.euPassport === false
                      ? "no"
                      : ""
                }
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    euPassport:
                      val === "yes" ? true : val === "no" ? false : null,
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-sm">Country of birth</Label>
              <CountryCombobox
                value={ext.birthCountry}
                onChange={(val) =>
                  setExt((s) => ({ ...s, birthCountry: val }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <Label className="text-sm">Contract status</Label>
              <Input
                value={ext.contractStatus}
                onChange={(e) =>
                  setExt((s) => ({
                    ...s,
                    contractStatus: e.target.value,
                  }))
                }
                placeholder="e.g. until 2027, free agent…"
              />
            </div>
            <div>
              <Label className="text-sm">Management agency</Label>
              <Input
                value={ext.agency}
                onChange={(e) =>
                  setExt((s) => ({ ...s, agency: e.target.value }))
                }
                placeholder="e.g. XYZ Management"
              />
            </div>
            <div>
              <Label className="text-sm">Release clause</Label>
              <Input
                value={ext.releaseClause}
                onChange={(e) =>
                  setExt((s) => ({
                    ...s,
                    releaseClause: e.target.value,
                  }))
                }
                placeholder="Amount, clause, notes…"
              />
            </div>
            <div>
              <Label className="text-sm">
                League level of the current club
              </Label>
              <Input
                value={ext.leagueLevel}
                onChange={(e) =>
                  setExt((s) => ({ ...s, leagueLevel: e.target.value }))
                }
                placeholder="e.g. Premier League, U19 CLJ, 3rd league…"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">Clip links / time-codes</Label>
              <Textarea
                value={ext.clipsLinks}
                onChange={(e) =>
                  setExt((s) => ({ ...s, clipsLinks: e.target.value }))
                }
                placeholder="List of links (one per line)…"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <Label className="text-sm">Transfermarkt link</Label>
                <Input
                  value={ext.transfermarkt}
                  onChange={(e) =>
                    setExt((s) => ({
                      ...s,
                      transfermarkt: e.target.value,
                    }))
                  }
                  placeholder="https://www.transfermarkt…"
                />
              </div>
              <div>
                <Label className="text-sm">Wyscout link</Label>
                <Input
                  value={ext.wyscout}
                  onChange={(e) =>
                    setExt((s) => ({ ...s, wyscout: e.target.value }))
                  }
                  placeholder="https://platform.wyscout…"
                />
              </div>
            </div>
          </div>
        </div>
      );

    case "stats365":
      return (
        <div className="space-y-5">
          <div>
            <Label className="text-sm">
              Injury history (if available)
            </Label>
            <Textarea
              value={ext.injuryHistory}
              onChange={(e) =>
                setExt((s) => ({
                  ...s,
                  injuryHistory: e.target.value,
                }))
              }
              placeholder="Short description of injuries, breaks, surgeries…"
              className="mt-1"
            />
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            <div>
              <NumericField
                label="Minutes in the last 365 days"
                value={
                  ext.minutes365 === ""
                    ? undefined
                    : Number(ext.minutes365)
                }
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    minutes365: val == null ? "" : String(val),
                  }))
                }
                placeholder="0"
              />
            </div>

            <div>
              <NumericField
                label="Matches as a starter"
                value={
                  ext.starts365 === ""
                    ? undefined
                    : Number(ext.starts365)
                }
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    starts365: val == null ? "" : String(val),
                  }))
                }
                placeholder="0"
              />
            </div>

            <div>
              <NumericField
                label="Matches as a substitute"
                value={
                  ext.subs365 === "" ? undefined : Number(ext.subs365)
                }
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    subs365: val == null ? "" : String(val),
                  }))
                }
                placeholder="0"
              />
            </div>

            <div>
              <NumericField
                label="Goals in the last 365 days"
                value={
                  ext.goals365 === "" ? undefined : Number(ext.goals365)
                }
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    goals365: val == null ? "" : String(val),
                  }))
                }
                placeholder="0"
              />
            </div>
          </div>
        </div>
      );

    case "contact":
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <Label className="text-sm">Contact phone</Label>
              <Input
                value={ext.phone}
                onChange={(e) =>
                  setExt((s) => ({ ...s, phone: e.target.value }))
                }
                placeholder="+48…"
              />
            </div>
            <div>
              <Label className="text-sm">Contact email</Label>
              <Input
                type="email"
                value={ext.email}
                onChange={(e) =>
                  setExt((s) => ({ ...s, email: e.target.value }))
                }
                placeholder="mail@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label className="text-sm">FB link</Label>
              <Input
                value={ext.fb}
                onChange={(e) =>
                  setExt((s) => ({ ...s, fb: e.target.value }))
                }
                placeholder="https://facebook.com/…"
              />
            </div>
            <div>
              <Label className="text-sm">Link IG</Label>
              <Input
                value={ext.ig}
                onChange={(e) =>
                  setExt((s) => ({ ...s, ig: e.target.value }))
                }
                placeholder="https://instagram.com/…"
              />
            </div>
            <div>
              <Label className="text-sm">Link TikTok</Label>
              <Input
                value={ext.tiktok}
                onChange={(e) =>
                  setExt((s) => ({ ...s, tiktok: e.target.value }))
                }
                placeholder="https://tiktok.com/@…"
              />
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function RatingRow({ 
  aspect, 
  value, 
  onChange 
}: { 
  aspect: RatingAspect; 
  value: number; 
  onChange: (v: number) => void;
}) {
  const hasTooltip = !!aspect.tooltip;

  return (
    <div className="flex w-full max-w-[320px] flex-col justify-between rounded-md border border-stone-200 bg-white/90 p-3 text-xs shadow-sm transition-shadow dark:border-neutral-700 dark:bg-neutral-950/80">
      <div className="mb-2 flex items-start gap-1 flex-1">
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-medium">
              {aspect.label}
            </span>
            {hasTooltip && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-snug">
                    {aspect.tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {aspect.tooltip && (
            <p className="mt-1 text-[11px] text-stone-500 dark:text-neutral-400">
              {aspect.tooltip}
            </p>
          )}
        </div>
      </div>
      <div className="mt-1">
        <StarRating
          max={5}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function RatingGroup({
  title,
  aspects,
  ratings,
  setRatings,
}: {
  title: string;
  aspects: RatingAspect[];
  ratings: PlayerRatings;
  setRatings: React.Dispatch<React.SetStateAction<PlayerRatings>>;
}) {
  if (!aspects.length) return null;
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
        <span className="h-1.5 w-1.5 rounded-md bg-stone-500" />
        {title}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {aspects.map((aspect) => (
          <RatingRow 
            key={aspect.id} 
            aspect={aspect} 
            value={ratings[aspect.key] ?? 0}
            onChange={(v) =>
              setRatings((prev) => ({
                ...prev,
                [aspect.key]: v,
              }))
            }
          />
        ))}
      </div>
    </div>
  );
}
