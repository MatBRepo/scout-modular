// src/app/(players)/players/[id]/PlayerEditorPage.tsx
"use client";
import { computePlayerProfileProgress } from "@/shared/playerProfileProgress";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import { useParams, useRouter } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";

import { Toolbar } from "@/shared/ui/atoms";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { RadioChipGroup } from "@/components/ui/RadioChipGroup";

// RAC fields
import { BirthDatePicker } from "@/components/ui/birthdate-picker-rac";
import { NumericField } from "@/components/ui/numeric-field-rac";

// header actions (global)
import { useHeaderActions } from "@/app/ClientRoot";

/* ===== ENV / defaults ===== */
const SCOUT_DEFAULT_COUNTRY =
  process.env.NEXT_PUBLIC_SCOUT_DEFAULT_COUNTRY || "";

/* ===== Positions ===== */
type BucketPos = "GK" | "DF" | "MF" | "FW";
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

const POS_LAYOUT: Record<DetailedPos, { top: string; left: string }> = {
  GK: { top: "50%", left: "10%" },

  LB: { top: "22.3%", left: "24.1%" },
  CB: { top: "50%", left: "24.1%" },
  RB: { top: "78%", left: "24.1%" },

  CDM: { top: "50%", left: "36.95%" },
  CM: { top: "50%", left: "49.83%" },
  CAM: { top: "50%", left: "63.05%" },

  LW: { top: "22.3%", left: "63.05%" },
  RW: { top: "78%", left: "63.05%" },

  ST: { top: "50%", left: "76.27%" },
};

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

/* ===== Small UI ===== */

function SavePill({
  state,
  size = "compact",
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
    <span className={cn(base, map[state])} aria-live="polite">
      {state === "saving" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
          <span className="hidden md:inline">Autozapis…</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Zapisano</span>
        </>
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

/* Country combobox (old – still used in other fields, e.g. birth country) */
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
          aria-expanded={open}
          className={cn(
            "relative flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm dark:bg-neutral-950",
            "border-gray-300 dark:border-neutral-700",
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
                <span className="text-base leading-none">{selected.flag}</span>
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
          <CommandInput
            placeholder="Szukaj kraju…"
            className="border-0 bg-transparent px-3 py-2 text-sm shadow-none focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
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
  );
}

/* NOWY: CountrySearchCombobox – taki jak w AddPlayerPage */
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
            "flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition",
            "hover:bg:white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-0",
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
              <span className="text-muted-foreground">Wybierz kraj</span>
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
            placeholder="Szukaj kraju..."
            className={cn(
              "m-2 h-9 w-[calc(100%-1rem)] rounded-md border border-slate-200 bg-background px-3 text-sm",
              "shadow-none outline-none",
              "focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:ring-offset-0",
              "dark:border-neutral-700 dark:bg-neutral-950"
            )}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>Brak wyników.</CommandEmpty>
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

/* Boisko – główna pozycja (nowy wygląd jak w AddPlayerPage) */
function MainPositionPitch({
  value,
  onChange,
}: {
  value: DetailedPos | "";
  onChange: (next: DetailedPos) => void;
}) {
  const [hovered, setHovered] = useState<DetailedPos | null>(null);

  const activeKey = (hovered || value || null) as DetailedPos | null;
  const activeMeta = activeKey
    ? POS_DATA.find((p) => p.value === activeKey) ?? null
    : null;

  return (
    <section className="mt-2 mb-2 bg-transparent border-none dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-medium text-foreground text-sm">
            Boisko – główna pozycja
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
            Kliknij na znacznik na boisku, aby ustawić główną pozycję zawodnika.
          </p>
        </div>
        {activeMeta && (
          <span className="inline-flex items-center self-start rounded bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700  ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
            {activeMeta.code} · {activeMeta.name}
          </span>
        )}
      </div>

      <div className="mx-auto w-full max-w-[700px] rounded border-none bg-transparent">
        <div className="relative w-full overflow-hidden rounded-[20px] bg-[#248604] aspect-[4/3] sm:aspect-[590/350]">
          <svg
            viewBox="0 0 590 350"
            className="pointer-events-none absolute inset-0 h-full w-full p-2 sm:p-3"
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="geometricPrecision"
          >
            <rect
              x="2"
              y="2"
              width="586"
              height="346"
              rx="0"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />

            <rect
              x="18.5139"
              y="16.2588"
              width="274.939"
              height="317.482"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="18.5139"
              y="79.2017"
              width="104.178"
              height="192.55"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="18.5139"
              y="112.58"
              width="47.2579"
              height="124.839"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="8.66235"
              y="112.58"
              width="10.0408"
              height="124.839"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />

            <path
              d="M31.7444 15.2588C31.7444 21.5792 25.9524 26.7031 18.8079 26.7031C18.3711 26.7031 17.9395 26.6819 17.5139 26.6445V15.2588H31.7444Z"
              fill="white"
              fillOpacity="0.1"
            />
            <path
              d="M17.5139 322.344C24.7684 322.344 30.6497 327.39 30.6497 333.614C30.6497 333.995 30.6262 334.37 30.5833 334.741L17.5139 334.741L17.5139 322.344Z"
              fill="white"
              fillOpacity="0.1"
            />

            <rect
              x="-1"
              y="1"
              width="278.223"
              height="317.482"
              transform="matrix(-1 0 0 1 570.486 15.2588)"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="-1"
              y="1"
              width="104.178"
              height="192.55"
              transform="matrix(-1 0 0 1 570.486 78.2017)"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="-1"
              y="1"
              width="47.2579"
              height="124.839"
              transform="matrix(-1 0 0 1 570.486 111.58)"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="-1"
              y="1"
              width="10.0408"
              height="124.839"
              transform="matrix(-1 0 0 1 580.338 111.58)"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />

            <path
              d="M558.256 15.2588C558.256 21.5792 564.048 26.7031 571.192 26.7031C571.629 26.7031 572.06 26.6819 572.486 26.6445V15.2588H558.256Z"
              fill="white"
              fillOpacity="0.1"
            />
            <path
              d="M572.486 322.344C565.232 322.344 559.35 327.39 559.35 333.614C559.35 333.995 559.374 334.37 559.417 334.741L572.486 334.741L572.486 322.344Z"
              fill="white"
              fillOpacity="0.1"
            />

            <path
              d="M122 106.618C139.904 124.296 151 148.852 151 176C151 203.148 139.903 227.703 122 245.381V106.618Z"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <path
              d="M468 106.618C450.096 124.296 439 148.852 439 176C439 203.148 450.097 227.703 468 245.381V106.618Z"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />

            <line
              x1="295"
              y1="16"
              x2="295"
              y2="334"
              stroke="white"
              strokeWidth="1.5"
            />

            <circle cx="496" cy="174" r="1" fill="white" />
            <circle cx="94" cy="174" r="1" fill="white" />
          </svg>

          {POS_DATA.map((pos) => {
            const layout = POS_LAYOUT[pos.value];
            if (!layout) return null;
            const isSelected = value === pos.value;

            return (
              <button
                key={pos.value}
                type="button"
                className={cn(
                  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm transition-transform duration-150",
                  "h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9",
                  isSelected
                    ? "border-emerald-500 bg-white text-black shadow-[0_0_0_2px_rgba(16,185,129,0.7)]"
                    : "border-white/80 bg-black text-white hover:scale-[1.05] hover:bg-black/90"
                )}
                style={{ top: layout.top, left: layout.left }}
                onClick={() => onChange(pos.value)}
                onMouseEnter={() => setHovered(pos.value)}
                onMouseLeave={() =>
                  setHovered((prev) => (prev === pos.value ? null : prev))
                }
              >
                {pos.code}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 text-center text-[11px] leading-relaxed text-slate-600 dark:text-neutral-300 sm:text-left">
        {activeMeta ? (
          <>
            <span className="font-semibold">
              {activeMeta.code} – {activeMeta.name}
            </span>
            <span className="ml-1.5 text-slate-600 dark:text-neutral-300">
              {activeMeta.desc}
            </span>
          </>
        ) : (
          <span>
            Najedź na znacznik i kliknij, aby wybrać główną pozycję zawodnika.
          </span>
        )}
      </div>
    </section>
  );
}

/* ===== Editor page ===== */
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

export default function PlayerEditorPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { setActions } = useHeaderActions();

  const initialId = params?.id ? Number(params.id) : NaN;
  const [playerId, setPlayerId] = useState<number | null>(
    Number.isNaN(initialId) ? null : initialId
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // domyślny kraj scouta – tylko jeśli nic nie ma
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

  const enabledRatingAspects = useMemo<RatingAspect[]>(
    () => ratingConfig.filter((r) => r.enabled !== false),
    [ratingConfig]
  );

  // Ładowanie zawodnika z Supabase do edycji
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .eq("id", playerId)
          .single();

        if (error) {
          console.error("[PlayerEditorPage] load error:", error);
          if (!cancelled) {
            setLoadError("Nie udało się załadować zawodnika.");
          }
          return;
        }

        if (!cancelled && data) {
          const meta = data.meta || {};
          const basicMeta = meta.basic || {};
          const extended = meta.extended || {};
          const mode: Choice =
            meta.mode === "unknown"
              ? "unknown"
              : meta.mode === "known"
              ? "known"
              : data.firstName || data.lastName
              ? "known"
              : "unknown";

          setChoice(mode);

          // Pola wspólne dla obu trybów
          setFirstName(basicMeta.firstName ?? data.firstName ?? "");
          setLastName(basicMeta.lastName ?? data.lastName ?? "");
          setBirthYear(basicMeta.birthYear ?? data.birthDate ?? "");
          setJerseyNumber(basicMeta.jerseyNumber ?? "");
          setClub(basicMeta.club ?? data.club ?? "");
          setClubCountry(
            basicMeta.clubCountry ??
              extended.birthCountry ??
              data.nationality ??
              ""
          );
          setUNote(meta.unknownNote ?? "");

const mergedExt = {
  ...getDefaultExt(),
  ...(extended || {}),
};

const mainPos: DetailedPos =
  (mergedExt.mainPos as DetailedPos | "") ||
  (basicMeta.posDet as DetailedPos | "") ||
  "CM";

// Zapisujemy mainPos również w extended, żeby boisko i Ocena widziały tę wartość
const mergedWithMainPos = { ...mergedExt, mainPos };

setExt(mergedWithMainPos);
setPosDet(mainPos);
setUPosDet(mainPos);

          setRatings(meta.ratings || {});
          setNotes(meta.notes || "");

          const obsMeta = meta.observationsMeta || {};
          setObservations(obsMeta.list || []);
          setObsSelectedId(obsMeta.selectedId ?? null);
        }
      } catch (err) {
        console.error("[PlayerEditorPage] load exception:", err);
        if (!cancelled) {
          setLoadError("Wystąpił błąd podczas ładowania zawodnika.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  // AUTOMATYCZNE wyliczanie trybu profilu (known / unknown) na podstawie pól
  useEffect(() => {
const hasPersonal =
  firstName.trim() !== "" && lastName.trim() !== "";


    const hasAnon =
      jerseyNumber.trim() !== "" ||
      uNote.trim() !== "" ||
      (!hasPersonal &&
        (club.trim() !== "" || clubCountry.trim() !== ""));

    let next: Choice;
    if (hasPersonal && !hasAnon) {
      next = "known";
    } else if (!hasPersonal && hasAnon) {
      next = "unknown";
    } else if (hasPersonal && hasAnon) {
      next = "known";
    } else {
      next = null;
    }

    setChoice((prev) => (prev === next ? prev : next));
  }, [firstName, lastName, birthYear, club, clubCountry, jerseyNumber, uNote]);

  // Nazwa wyświetlana w tabeli obserwacji zawodnika
  const playerDisplayName = useMemo(() => {
    if (choice === "known") {
      const fn = firstName.trim();
      const ln = lastName.trim();
      const full = `${fn} ${ln}`.trim();
      return full || "Nieznany zawodnik";
    }
    const num = jerseyNumber.trim();
    const clubLabel = club.trim();
    if (num) {
      return `#${num} – ${clubLabel || "Bez klubu"}`;
    }
    return clubLabel || "Nieznany zawodnik";
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

  // Ładowanie obserwacji z globalnego dziennika
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
            "[PlayerEditorPage] Supabase load observations error:",
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
          "[PlayerEditorPage] Supabase load observations exception:",
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

  /* ===== ExtContent – skopiowane style z AddPlayerPage ===== */
  function ExtContent({ view }: { view: ExtKey }) {
    switch (view) {
      case "profile":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label className="text-sm">Wzrost (cm)</Label>
                <NumericField
                  value={ext.height === "" ? undefined : Number(ext.height)}
                  onChange={(val) =>
                    setExt((s) => ({
                      ...s,
                      height: val == null ? "" : String(val),
                    }))
                  }
                  placeholder="np. 182"
                />
              </div>

              <div>
                <Label className="text-sm">Waga (kg)</Label>
                <NumericField
                  value={ext.weight === "" ? undefined : Number(ext.weight)}
                  onChange={(val) =>
                    setExt((s) => ({
                      ...s,
                      weight: val == null ? "" : String(val),
                    }))
                  }
                  placeholder="np. 76"
                />
              </div>

              <div>
                <Label className="text-sm">Dominująca noga</Label>
                <Select
                  value={ext.dominantFoot || undefined}
                  onValueChange={(val) =>
                    setExt((s) => ({ ...s, dominantFoot: val }))
                  }
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-1">
              <div>
                <Label className="text-sm">Pozycje alternatywne</Label>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {POS_DATA.map((opt) => {
                    const checked = ext.altPositions.includes(opt.value);
                    const itemId = `alt-pos-${opt.value}`;

                    return (
                      <div
                        key={opt.value}
                        className={cn(
                          "relative flex w-full items-start gap-2 rounded-md border border-input p-3 text-xs shadow-xs outline-none",
                          "has-[data-state=checked]:border-primary/60 has-[data-state=checked]:bg-primary/5"
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
                              return { ...s, altPositions: nextPositions };
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
            </div>
          </div>
        );

      case "eligibility":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <RadioChipGroup
                  legend="Znajomość języka angielskiego"
                  layout="grid-2"
                  value={
                    ext.english === true
                      ? "yes"
                      : ext.english === false
                      ? "no"
                      : ""
                  }
                  options={[
                    { value: "yes", label: "Tak" },
                    { value: "no", label: "Nie" },
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
                  legend="Paszport UE"
                  layout="grid-2"
                  value={
                    ext.euPassport === true
                      ? "yes"
                      : ext.euPassport === false
                      ? "no"
                      : ""
                  }
                  options={[
                    { value: "yes", label: "Tak" },
                    { value: "no", label: "Nie" },
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
                <Label className="text-sm">Kraj urodzenia</Label>
                <CountryCombobox
                  value={ext.birthCountry}
                  onChange={(val) =>
                    setExt((s) => ({ ...s, birthCountry: val }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm">Status kontraktu</Label>
                <Input
                  value={ext.contractStatus}
                  onChange={(e) =>
                    setExt((s) => ({
                      ...s,
                      contractStatus: e.target.value,
                    }))
                  }
                  placeholder="np. do 2027, wolny agent…"
                />
              </div>
              <div>
                <Label className="text-sm">Agencja menadżerska</Label>
                <Input
                  value={ext.agency}
                  onChange={(e) =>
                    setExt((s) => ({ ...s, agency: e.target.value }))
                  }
                  placeholder="np. XYZ Management"
                />
              </div>
              <div>
                <Label className="text-sm">Klauzula wykupu</Label>
                <Input
                  value={ext.releaseClause}
                  onChange={(e) =>
                    setExt((s) => ({
                      ...s,
                      releaseClause: e.target.value,
                    }))
                  }
                  placeholder="Kwota, zapis, uwagi…"
                />
              </div>
              <div>
                <Label className="text-sm">
                  Poziom rozgrywkowy obecnego klubu
                </Label>
                <Input
                  value={ext.leagueLevel}
                  onChange={(e) =>
                    setExt((s) => ({ ...s, leagueLevel: e.target.value }))
                  }
                  placeholder="np. Ekstraklasa, CLJ U19, 3 liga…"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm">Linki do klipów / time-codes</Label>
                <Textarea
                  value={ext.clipsLinks}
                  onChange={(e) =>
                    setExt((s) => ({ ...s, clipsLinks: e.target.value }))
                  }
                  placeholder="Lista linków (po jednym w linii)…"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm">Link do Transfermarkt</Label>
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
                  <Label className="text-sm">Link do Wyscout</Label>
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
                Historia urazów (jeśli dostępna)
              </Label>
              <Textarea
                value={ext.injuryHistory}
                onChange={(e) =>
                  setExt((s) => ({
                    ...s,
                    injuryHistory: e.target.value,
                  }))
                }
                placeholder="Krótki opis kontuzji, przerw, operacji…"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div>
                <NumericField
                  label="Minuty w ostatnich 365 dniach"
                  value={
                    ext.minutes365 === "" ? undefined : Number(ext.minutes365)
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
                  label="Mecze jako starter"
                  value={
                    ext.starts365 === "" ? undefined : Number(ext.starts365)
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
                  label="Mecze jako rezerwowy"
                  value={ext.subs365 === "" ? undefined : Number(ext.subs365)}
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
                  label="Gole w ostatnich 365 dniach"
                  value={ext.goals365 === "" ? undefined : Number(ext.goals365)}
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm">Telefon kontaktowy</Label>
                <Input
                  value={ext.phone}
                  onChange={(e) =>
                    setExt((s) => ({ ...s, phone: e.target.value }))
                  }
                  placeholder="+48…"
                />
              </div>
              <div>
                <Label className="text-sm">E-mail kontaktowy</Label>
                <Input
                  type="email"
                  value={ext.email}
                  onChange={(e) =>
                    setExt((s) => ({ ...s, email: e.target.value }))
                  }
                  placeholder="mail@przyklad.pl"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label className="text-sm">Link FB</Label>
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
    }
  }

  function RatingRow({ aspect }: { aspect: RatingAspect }) {
    const val = ratings[aspect.key] ?? 0;
    const hasTooltip = !!aspect.tooltip;

    return (
      <div className="flex w-full max-w-[320px] flex-col justify-between rounded-md border border-slate-200 bg-white/90 p-3 text-xs shadow-sm transition-shadow dark:border-neutral-700 dark:bg-neutral-950/80">
        <div className="mb-2 flex items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-medium">
                {aspect.label}
              </span>
              {hasTooltip && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 text-[10px] text-slate-600 hover:bg-stone-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
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
            {aspect.tooltip && (
              <p className="mt-1 line-clamp-3 text-[11px] text-slate-500 dark:text-neutral-400">
                {aspect.tooltip}
              </p>
            )}
          </div>
        </div>
        <div className="mt-1">
          <StarRating
            max={5}
            value={val}
            onChange={(v) =>
              setRatings((prev) => ({
                ...prev,
                [aspect.key]: v,
              }))
            }
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
        <div className="flex flex-wrap gap-3">
          {aspects.map((aspect) => (
            <RatingRow key={aspect.id} aspect={aspect} />
          ))}
        </div>
      </div>
    );
  }

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autozapis do Supabase (update istniejącego zawodnika)
  useEffect(() => {
    let cancelled = false;

    if (!playerId) {
      setSaveState("idle");
      return;
    }

    // Jeżeli kompletnie brak danych bazowych – nie zapisujemy
    const hasAnyBasic =
      firstName.trim() ||
      lastName.trim() ||
      birthYear.trim() ||
      jerseyNumber.trim() ||
      club.trim() ||
      clubCountry.trim();

    if (!hasAnyBasic) {
      setSaveState("idle");
      return;
    }

    setSaveError(null);
    setSaveState("saving");

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      (async () => {
        try {
          const supabase = getSupabase();
          const currentYear = new Date().getFullYear();

          const isKnownX = choice === "known";
          let name: string;
          let clubFinal: string;
          let posBucket: BucketPos;
          let clubCountryFinal: string;
          let age = 0;

          if (isKnownX) {
const fn = firstName.trim();
const ln = lastName.trim();
const fullName = `${fn} ${ln}`.trim();
name = fullName || "Nieznany zawodnik";
            clubFinal = club.trim();
            clubCountryFinal = clubCountry.trim();
            posBucket = toBucket(posDet || "CM");

            if (birthYear.trim()) {
              const by = parseInt(birthYear.trim(), 10);
              if (!Number.isNaN(by)) {
                age = Math.max(0, currentYear - by);
              }
            }
          } else {
            const num = jerseyNumber.trim();
            clubFinal = club.trim();
            clubCountryFinal = clubCountry.trim();
            name = num
              ? `#${num} – ${clubFinal || "Bez klubu"}`
              : clubFinal || "Nieznany zawodnik";
            posBucket = toBucket(uPosDet || posDet || "CM");
          }

          const nationalityVal =
            ext.birthCountry.trim() || clubCountryFinal || null;

          const meta = {
            mode: choice,
            extended: ext,
            ratings,
            notes,
            unknownNote: uNote || null,
            basic: {
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
              birthYear: birthYear.trim() || null,
              club: clubFinal,
              clubCountry: clubCountryFinal || null,
              jerseyNumber: jerseyNumber.trim() || null,
              posDet,
              uPosDet,
            },
            observationsMeta: {
              selectedId: obsSelectedId,
              list: normalizedObservations,
            },
          };

          const updatePayload: any = {
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
          };

          const { error } = await supabase
            .from("players")
            .update(updatePayload)
            .eq("id", playerId);

          if (error) {
            console.error("[PlayerEditorPage] Supabase update error:", error);
            if (!cancelled) {
              setSaveState("idle");
              setSaveError(
                "Nie udało się zaktualizować zawodnika w Supabase."
              );
            }
            return;
          }

          if (!cancelled) {
            setSaveState("saved");
          }
        } catch (err) {
          console.error("[PlayerEditorPage] Supabase save exception:", err);
          if (!cancelled) {
            setSaveState("idle");
            setSaveError(
              "Wystąpił błąd podczas zapisu zawodnika do Supabase."
            );
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


 // PROGRESS: global completion percent – wspólny algorytm jak w tabeli
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
    "inline-flex h-6 items-center rounded-md bg-stone-100 px-2.5 text-[11px] tracking-wide text-slate-600 dark:bg-neutral-900 dark:text-neutral-200";

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

  // Header actions like in AddPlayerPage + PROGRESS BAR
  useEffect(() => {
    const node = (
      <div className="flex items-center gap-3">
        <SavePill state={saveState} size="compact" />

        {/* PROGRESS BAR (global postęp profilu) */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="hidden text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:inline">
            Postęp profilu
          </span>
          <div className="flex items-center gap-2">
            <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-slate-700 dark:text-neutral-200">
              {completionPercent}%
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 px-3 text-xs md:inline-flex"
          onClick={() => router.push("/players")}
        >
          Wróć do listy
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="inline-flex h-8 w-8 p-0 md:hidden"
          aria-label="Wróć do listy"
          onClick={() => router.push("/players")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );

    setActions(node);
    return () => {
      setActions(null);
    };
  }, [setActions, saveState, router, completionPercent]);

  if (!playerId) {
    return (
      <div className="w-full space-y-4">
        <Toolbar title="Edycja zawodnika" right={null} />
        <p className="text-sm text-red-600">
          Brak poprawnego identyfikatora zawodnika w adresie URL.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Toolbar title="Edycja zawodnika" right={null} />

      {loading && (
        <Card className="border-dashed border-slate-300 bg-slate-50/80 dark:border-neutral-800 dark:bg-neutral-950/60">
          <CardContent className="px-4 py-6 text-sm text-slate-600 dark:text-neutral-300">
            Ładowanie danych zawodnika…
          </CardContent>
        </Card>
      )}

      {loadError && (
        <p className="text-sm text-red-600">{loadError}</p>
      )}

      {/* KROK 0 – tryb profilu (ustalany automatycznie na podstawie pól) */}
      <Card className="border-dashed border-slate-300 bg-gradient-to-r from-slate-50 to-white dark:border-neutral-800 dark:from-neutral-950 dark:to-neutral-950">
        <CardHeader className="group hidden items-center justify-between  border-slate-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:flex md:px-4 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
          <div className="flex w-full items-center justify-between gap-3">
            <div>
              <div className={stepPillClass}>Krok 0 · Tryb profilu</div>
              <h2 className="mt-1 hidden text-base font-semibold tracking-tight md:block">
                Tryb przechowywania danych zawodnika
              </h2>
              <p className="mt-1 hidden text-xs text-slate-500 dark:text-neutral-400 md:block">
                System automatycznie określa, czy profil jest <b>pełny</b> czy{" "}
                <b>anonimowy</b> na podstawie uzupełnionych pól – Ty po prostu
                wypełniasz dane.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 py-4 md:px-4">
          <div className="grid grid-cols-2 gap-3">
            <div
              className={cn(
                "cursor-default rounded-lg p-4 text-left border bg-white dark:bg-neutral-950 ",
                choice === "known"
                  ? "ring-emerald-600/80 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40"
                  : "ring-gray-200 dark:ring-neutral-800"
              )}
            >
              <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/80 border border-emerald-100 dark:border-neutral-700 dark:bg-neutral-900">
                  <KnownPlayerIcon
                    className={cn(
                      "h-7 w-7",
                      choice === "known"
                        ? "text-emerald-800"
                        : "text-black dark:text-neutral-100"
                    )}
                    strokeWidth={1.0}
                  />
                </span>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "mb-1 text-sm font-semibold",
                      choice === "known"
                        ? "text-emerald-900"
                        : "text-black dark:text-neutral-100"
                    )}
                  >
                    Pełne dane zawodnika
                  </div>
                  <div
                    className={cn(
                      "text-xs leading-relaxed",
                      choice === "known"
                        ? "text-emerald-900/80"
                        : "text-black/70 dark:text-neutral-300"
                    )}
                  >
                    Imię, nazwisko, rok urodzenia, klub i kraj – profil{" "}
                    <b>imienny</b>.
                  </div>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "cursor-default rounded-lg p-4 text-left border bg-white dark:bg-neutral-950 ",
                choice === "unknown"
                  ? "ring-rose-600/80 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/40"
                  : "ring-gray-200 dark:ring-neutral-800"
              )}
            >
              <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/80 border border-rose-100 dark:border-neutral-700 dark:bg-neutral-900">
                  <UnknownPlayerIcon
                    className={cn(
                      "h-7 w-7",
                      choice === "unknown"
                        ? "text-rose-900"
                        : "text-black dark:text-neutral-100"
                    )}
                    strokeWidth={1.0}
                  />
                </span>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "mb-1 text-sm font-semibold",
                      choice === "unknown"
                        ? "text-rose-900"
                        : "text-black dark:text-neutral-100"
                    )}
                  >
                    Profil anonimowy
                  </div>
                  <div
                    className={cn(
                      "text-xs leading-relaxed",
                      choice === "unknown"
                        ? "text-rose-900/80"
                        : "text-black/70 dark:text-neutral-300"
                    )}
                  >
                    Numer, klub i kraj – gdy nie podajesz danych osobowych.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kroki 1–4 – identyczny layout jak w AddPlayerPage */}
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
                <div className={stepPillClass}>Krok 1 · Dane bazowe</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Podstawowe informacje
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  Wypełnij po prostu pola poniżej – system sam zdecyduje, czy
                  profil jest <b>imienny</b> czy <b>anonimowy</b>.
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
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-sm">Imię</Label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="np. Jan"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Nazwisko</Label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="np. Kowalski"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Rok urodzenia</Label>
                        <BirthDatePicker
                          value={birthYear}
                          onChange={(val: string | null | undefined) =>
                            setBirthYear(val || "")
                          }
                        />
                      </div>
                      <div>
                        <NumericField
                          label="Numer na koszulce"
                          value={
                            jerseyNumber === ""
                              ? undefined
                              : Number(jerseyNumber)
                          }
                          onChange={(val) =>
                            setJerseyNumber(
                              val == null ? "" : String(val)
                            )
                          }
                          placeholder="np. 27"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Aktualny klub</Label>
                        <Input
                          value={club}
                          onChange={(e) => setClub(e.target.value)}
                          placeholder="np. Lech Poznań U19"
                        />
                      </div>
                      <div>
                        <Label className="pb-2 text-sm">
                          Kraj klubu / aktualnego klubu
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
                          Notatka własna (opcjonalne)
                        </Label>
                        <Textarea
                          value={uNote}
                          onChange={(e) => setUNote(e.target.value)}
                          placeholder="Krótka notatka o zawodniku, kontekst skauta…"
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
              "group flex rounded-md items-center justify-between  border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-4 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              extOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={extOpen}
              aria-controls="ext-panel"
              onClick={() => setExtOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className={stepPillClass}>Krok 2 · Profil boiskowy</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Rozszerzone informacje
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  Dodatkowe dane sportowe, kontraktowe i kontaktowe – przydatne
                  w profesjonalnym scouting report.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-slate-500 sm:inline">
                    Profil anonimowy
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
                    <p className="mb-3 text-[11px] text-slate-500 dark:text-neutral-400">
                      Możesz stopniowo uzupełniać te dane, gdy będziesz
                      poznawać zawodnika lepiej.
                    </p>
                  )}

                  <div className="md:hidden">
                    <Label className="mb-1 block text-sm">Sekcja</Label>
                    <select
                      value={extView}
                      onChange={(e) =>
                        setExtView(e.target.value as ExtKey)
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    >
                      <option value="profile">Profil boiskowy</option>
                      <option value="eligibility">
                        Status &amp; scouting
                      </option>
                      <option value="stats365">Zdrowie i statystyki</option>
                      <option value="contact">
                        Kontakt &amp; social
                      </option>
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
                      <TabsList className="inline-flex w-auto gap-1 rounded-md bg-stone-100 p-1 dark:bg-neutral-900">
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

        {/* KROK 3 – Ocena */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group flex rounded-md items-center justify-between  border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-4 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              gradeOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={gradeOpen}
              aria-controls="grade-panel"
              onClick={() => setGradeOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className={stepPillClass}>Krok 3 · Ocena</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Ocena zawodnika
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  Rozbij ocenę na kategorie techniczne, mentalne i fizyczne –{" "}
                  konfigurujesz je w module „Konfiguracja ocen zawodnika”.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-slate-500 sm:inline">
                    Profil anonimowy
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
                    <p className="mb-3 text-[11px] text-slate-500 dark:text-neutral-400">
                      Możesz wypełniać oceny nawet dla profilu anonimowego –
                      ważna jest zachowana spójność z główną pozycją.
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
                        <Label className="text-sm">Notatki ogólne</Label>
                        <Input
                          placeholder="Krótki komentarz o zawodniku…"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div className="space-y-6">
                        {enabledRatingAspects.length === 0 && (
                          <p className="text-xs text-slate-500 dark:text-neutral-400">
                            Brak skonfigurowanych kategorii ocen. Dodaj je w
                            panelu „Konfiguracja ocen zawodnika”.
                          </p>
                        )}

                        <RatingGroup title="Podstawowe" aspects={baseAspects} />

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
                              Ustaw <b>Główną pozycję</b> w kroku 1, aby
                              zobaczyć dodatkowe kategorie oceny
                              (GK/DEF/MID/ATT).
                            </p>
                          )}
                      </div>
                    </div>

                    {!effectiveMainPos && (
                      <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-white/70 px-4 text-center backdrop-blur-sm dark:bg-neutral-950/80">
                        <p className="mb-3 text-xs text-slate-700 dark:text-neutral-200 sm:text-sm">
                          Aby wprowadzić oceny, najpierw uzupełnij{" "}
                          <b>Główną pozycję</b> zawodnika w kroku 1.
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
                          Przejdź do kroku 1
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
              "group flex rounded-md items-center justify-between  border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-4 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              obsOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={obsOpen}
              aria-controls="obs-panel"
              onClick={() => setObsOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className={stepPillClass}>Krok 4 · Obserwacje</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Obserwacje
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  Dodawaj mecze i przypisuj je do profilu zawodnika. Możesz
                  korzystać z globalnego dziennika obserwacji.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-slate-500 sm:inline">
                    Profil anonimowy
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
                    <p className="mb-3 text-[11px] text-slate-500 dark:text-neutral-400">
                      Możesz tworzyć obserwacje również dla profilu anonimowego
                      – ważne, by zachować spójność meczu i poziomu.
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
                      <div className="space-y-8">{/* ... stary QA ... */}</div>
                      <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edytuj obserwację</DialogTitle>
                          </DialogHeader>
                          {editingObs && (
                            <div className="space-y-4">
                              {/* ...stary formularz edycji... */}
                            </div>
                          )}
                          <DialogFooter className="mt-4">
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() => setEditOpen(false)}
                            >
                              Anuluj
                            </Button>
                            <Button
                              type="button"
                              className="bg-gray-900 text-white hover:bg-gray-800"
                              onClick={saveEditedObservation}
                            >
                              Zapisz zmiany
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
