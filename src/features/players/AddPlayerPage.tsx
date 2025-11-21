// src/app/(players)/players/add/AddPlayerPage.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Search,
  AlertTriangle,
  Lock,
  PlayCircle,
  Monitor,
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
  // Bramkarz – przy lewej bramce, w środku wysokości
  GK: { top: "50%", left: "8%" },

  // Obrona – przed bramkarzem
  LB: { top: "30%", left: "24%" }, // lewy obrońca
  CB: { top: "50%", left: "26%" }, // środkowy
  RB: { top: "70%", left: "24%" }, // prawy obrońca

  // Defensywny pomocnik – między obroną a środkiem
  CDM: { top: "50%", left: "40%" },

  // Środkowy pomocnik – środek boiska
  CM: { top: "50%", left: "55%" },

  // Ofensywny pomocnik – między pomocą a atakiem
  CAM: { top: "50%", left: "68%" },

  // Skrzydłowi – szeroko, na wysokości CAM
  LW: { top: "30%", left: "68%" },
  RW: { top: "70%", left: "68%" },

  // Napastnik – blisko prawej bramki, centralnie
  ST: { top: "50%", left: "86%" },
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
    <span className={cn(base, map[state])} aria-live="polite">
      {state === "saving" ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Autozapis…
        </>
      ) : (
        <>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Zapisano
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

/* Country combobox */
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

/* DateTime picker 24h – używany do daty/godziny meczu */
type DateTimeValue = {
  date: string;
  time: string;
};

function DateTimePicker24h({
  value,
  onChange,
  placeholder = "Data i godzina meczu",
}: {
  value: DateTimeValue;
  onChange: (value: DateTimeValue) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateObj, setDateObj] = useState<Date | undefined>(() => {
    if (value.date) {
      const d = new Date(`${value.date}T${value.time || "12:00"}:00`);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  });

  useEffect(() => {
    if (!value.date) {
      setDateObj(undefined);
      return;
    }
    const d = new Date(`${value.date}T${value.time || "12:00"}:00`);
    if (!Number.isNaN(d.getTime())) {
      setDateObj(d);
    }
  }, [value.date, value.time]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const handleCombinedChange = (next: Date | undefined) => {
    if (!next) {
      setDateObj(undefined);
      onChange({ date: "", time: "" });
      return;
    }
    setDateObj(next);
    const iso = next.toISOString();
    const dateStr = iso.slice(0, 10);
    const timeStr = iso.slice(11, 16);
    onChange({ date: dateStr, time: timeStr });
  };

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) {
      handleCombinedChange(undefined);
      return;
    }
    const base = dateObj ?? new Date();
    const next = new Date(selected);
    next.setHours(base.getHours());
    next.setMinutes(base.getMinutes());
    handleCombinedChange(next);
  };

  const handleTimeChange = (type: "hour" | "minute", raw: string) => {
    const base = dateObj ?? new Date();
    const next = new Date(base);
    const val = parseInt(raw, 10);
    if (Number.isNaN(val)) return;
    if (type === "hour") {
      next.setHours(val);
    } else {
      next.setMinutes(val);
    }
    handleCombinedChange(next);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal border-gray-300 dark:border-neutral-700",
            !dateObj && "text-muted-foreground"
          )}
        >
          <CalendarDaysIcon className="mr-2 h-4 w-4" />
          {dateObj ? (
            format(dateObj, "dd.MM.yyyy HH:mm")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-y-0 sm:divide-x">
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex p-2 sm:flex-col">
                {hours.map((hour) => (
                  <Button
                    key={hour}
                    size="icon"
                    variant={
                      dateObj && dateObj.getHours() === hour
                        ? "default"
                        : "ghost"
                    }
                    className="aspect-square shrink-0 sm:w-full"
                    onClick={() => handleTimeChange("hour", hour.toString())}
                  >
                    {hour.toString().padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex p-2 sm:flex-col">
                {minutes.map((minute) => (
                  <Button
                    key={minute}
                    size="icon"
                    variant={
                      dateObj && dateObj.getMinutes() === minute
                        ? "default"
                        : "ghost"
                    }
                    className="aspect-square shrink-0 sm:w-full"
                    onClick={() => handleTimeChange("minute", minute.toString())}
                  >
                    {minute.toString().padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* Boisko – główna pozycja */
/* Boisko – główna pozycja */
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
    <section className="mt-5 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            Boisko – główna pozycja
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
            Kliknij na znacznik na boisku, aby ustawić główną pozycję zawodnika.
          </p>
        </div>
        {activeMeta && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
            {activeMeta.code} · {activeMeta.name}
          </span>
        )}
      </div>

      <div className="mx-auto max-h-[300px] max-w-[560px] overflow-hidden rounded-xl border border-emerald-500/40 bg-[radial-gradient(circle_at_0%_50%,#14532d_0,#166534_35%,#052e16_90%)] p-3">
        <TooltipProvider delayDuration={0}>
          <div className="relative h-[220px] w-full rounded-[20px] border border-white/40">
            {/* Środkowa linia – poziomo */}
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/40" />

            {/* Koło środkowe */}
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />

            {/* Pole karne LEWE */}
            <div className="absolute left-0 top-1/2 h-36 w-28 -translate-y-1/2 border-y border-r border-white/40" />
            {/* Małe pole bramkowe LEWE */}
            <div className="absolute left-0 top-1/2 h-20 w-14 -translate-y-1/2 border-y border-r border-white/40" />

            {/* Pole karne PRAWE */}
            <div className="absolute right-0 top-1/2 h-36 w-28 -translate-y-1/2 border-y border-l border-white/40" />
            {/* Małe pole bramkowe PRAWE */}
            <div className="absolute right-0 top-1/2 h-20 w-14 -translate-y-1/2 border-y border-l border-white/40" />

            {/* Znaczniki pozycji */}
            {POS_DATA.map((pos) => {
              const layout = POS_LAYOUT[pos.value];
              if (!layout) return null;
              const isSelected = value === pos.value;

              return (
                <Tooltip key={pos.value}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "group absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-semibold text-white shadow-sm transition-transform",
                        isSelected
                          ? "border-emerald-300 bg-emerald-500/90 shadow-[0_0_0_4px_rgba(16,185,129,0.45)]"
                          : "border-white/70 bg-white/10 hover:scale-[1.03] hover:bg-white/25"
                      )}
                      style={{ top: layout.top, left: layout.left }}
                      onClick={() => onChange(pos.value)}
                      onMouseEnter={() => setHovered(pos.value)}
                      onMouseLeave={() =>
                        setHovered((prev) => (prev === pos.value ? null : prev))
                      }
                    >
                      <span className="pointer-events-none">{pos.code}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="center"
                    className="max-w-xs border-none bg-slate-900/95 px-3 py-2 text-left text-[11px] text-slate-100 shadow-lg"
                  >
                    <div className="text-xs font-semibold">
                      {pos.code} · {pos.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {pos.desc}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>


      <div className="mt-3 text-[11px] leading-relaxed text-slate-600 dark:text-neutral-300">
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
            Najedź na znacznik, aby zobaczyć szczegółowy opis pozycji i kliknij,
            aby ją wybrać jako główną.
          </span>
        )}
      </div>
    </section>
  );
}


/* ===== Add page ===== */
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

export default function AddPlayerPage() {
  const router = useRouter();

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
  const [uClub, setUClub] = useState("");
  const [uClubCountry, setUClubCountry] = useState("");
  const [uNote, setUNote] = useState("");

  const [posDet, setPosDet] = useState<DetailedPos>("CM");
  const [uPosDet, setUPosDet] = useState<DetailedPos>("CM");

  const [ext, setExt] = useState(getDefaultExt);

  const [ratingConfig, setRatingConfig] = useState<RatingsConfig>(() =>
    loadRatings()
  );
  const [ratings, setRatings] = useState<PlayerRatings>({});
  const [notes, setNotes] = useState("");

  const [headerHeight, setHeaderHeight] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const basicRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('header[role="banner"]');
    if (header) {
      setHeaderHeight(header.offsetHeight);
    }

    const handleResize = () => {
      const h = document.querySelector<HTMLElement>('header[role="banner"]');
      if (h) setHeaderHeight(h.offsetHeight);
    };
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // domyślny kraj scouta (jeśli ustawiony w env)
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
    uClub,
    uClubCountry,
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

  // Ładowanie obserwacji z Supabase (globalny dziennik obserwacji)
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

  // Normalizujemy obserwacje tak, żeby pola tekstowe na pewno były stringami
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

  type ExtKey = "profile" | "eligibility" | "stats365" | "contact";
  const [extView, setExtView] = useState<ExtKey>("profile");

  function ExtContent({ view }: { view: ExtKey }) {
    switch (view) {
      case "profile":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label className="text-sm">Wzrost (cm)</Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={ext.height}
                  onChange={(e) =>
                    setExt((s) => ({ ...s, height: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-sm">Waga (kg)</Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={ext.weight}
                  onChange={(e) =>
                    setExt((s) => ({ ...s, weight: e.target.value }))
                  }
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm">Pozycje alternatywne</Label>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
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
                          onChange={() =>
                            setExt((s) => {
                              const current = s.altPositions;
                              const next = checked
                                ? current.filter((x) => x !== opt.value)
                                : [...current, opt.value];
                              return { ...s, altPositions: next };
                            })
                          }
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
                <Label className="text-sm">
                  Minuty w ostatnich 365 dniach
                </Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={ext.minutes365}
                  onChange={(e) =>
                    setExt((s) => ({
                      ...s,
                      minutes365: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-sm">Mecze jako starter</Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={ext.starts365}
                  onChange={(e) =>
                    setExt((s) => ({
                      ...s,
                      starts365: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-sm">Mecze jako rezerwowy</Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={ext.subs365}
                  onChange={(e) =>
                    setExt((s) => ({
                      ...s,
                      subs365: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-sm">
                  Gole w ostatnich 365 dniach
                </Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={ext.goals365}
                  onChange={(e) =>
                    setExt((s) => ({
                      ...s,
                      goals365: e.target.value,
                    }))
                  }
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

  const [playerId, setPlayerId] = useState<number | null>(null);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!choice) {
      setSaveState("idle");
      return;
    }

    const isKnown = choice === "known";
    const knownValid =
      isKnown &&
      !!firstName.trim() &&
      !!lastName.trim() &&
      !!birthYear.trim() &&
      !!club.trim() &&
      !!clubCountry.trim();

    const unknownValid =
      !isKnown &&
      !!jerseyNumber.trim() &&
      !!uClub.trim() &&
      !!uClubCountry.trim();

    if (!knownValid && !unknownValid) {
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
            name = `${fn} ${ln}`.trim() || "Bez imienia";
            clubFinal = club.trim();
            posBucket = toBucket(posDet);
            clubCountryFinal = clubCountry.trim();
            if (birthYear.trim()) {
              const by = parseInt(birthYear.trim(), 10);
              if (!Number.isNaN(by)) {
                age = Math.max(0, currentYear - by);
              }
            }
          } else {
            const num = jerseyNumber.trim();
            const c = uClub.trim();
            name = num ? `#${num} – ${c}` : c || "Nieznany zawodnik";
            clubFinal = c;
            posBucket = toBucket(uPosDet);
            clubCountryFinal = uClubCountry.trim();
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

          if (!playerId) {
            const insertPayload: any = {
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

            const { data, error } = await supabase
              .from("players")
              .insert(insertPayload)
              .select("id")
              .single();

            if (error) {
              console.error("[AddPlayerPage] Supabase insert error:", error);
              if (!cancelled) {
                setSaveState("idle");
                setSaveError(
                  "Nie udało się zapisać zawodnika do Supabase (insert)."
                );
              }
              return;
            }

            if (!cancelled && data?.id) {
              setPlayerId(data.id);
              setSaveState("saved");
            }
          } else {
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
              console.error("[AddPlayerPage] Supabase update error:", error);
              if (!cancelled) {
                setSaveState("idle");
                setSaveError(
                  "Nie udało się zaktualizować zawodnika w Supabase (update)."
                );
              }
              return;
            }

            if (!cancelled) {
              setSaveState("saved");
            }
          }
        } catch (err) {
          console.error("[AddPlayerPage] Supabase save exception:", err);
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
    uClub,
    uClubCountry,
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

  const stepPillClass =
    "inline-flex h-6 items-center rounded-md bg-slate-100 px-2.5 text-[11px] tracking-wide text-slate-600 dark:bg-neutral-900 dark:text-neutral-200";

  const hasChoice = !!choice;

  /* ========================================= UI ========================================= */
  return (
    <div className="w-full space-y-4">
      {/* Sticky mini actions under header when scroll */}
      <div
        className={cn(
          "pointer-events-none sticky z-30 flex justify-end transition-all duration-200",
          isScrolled ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        )}
        style={{ top: headerHeight || 64 }}
      >
        <div className="pointer-events-auto mr-2 mt-2 border-none flex items-center gap-2 rounded-full bg-none px-2 py-1   dark:bg-neutral-950/90 dark:ring-neutral-800">
          <SavePill state={saveState} size="compact" />
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => router.push("/players")}
          >
            Wróć do listy
          </Button>
        </div>
      </div>

      <Toolbar
        title="Dodaj zawodnika"
        right={
          <div className="flex w-full items-center justify-end gap-2 sm:gap-3 md:flex-nowrap">
            <SavePill state={saveState} />
            <Button
              variant="outline"
              className="h-10"
              onClick={() => router.push("/players")}
            >
              Wróć do listy
            </Button>
          </div>
        }
      />

      {/* KROK 0 – tryb dodawania */}
      <Card className="border-dashed border-slate-300 bg-gradient-to-r from-slate-50 to-white dark:border-neutral-800 dark:from-neutral-950 dark:to-neutral-950">
        <CardHeader className="group flex items-center justify-between border-b border-slate-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
          <div className="flex w-full items-center justify-between gap-3">
            <div>
              <div className={stepPillClass}>Krok 0 · Tryb</div>
              <h2 className="mt-1 text-base font-semibold tracking-tight">
                Wybierz sposób dodania zawodnika
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                Najpierw zdecyduj, czy znasz dane osobowe zawodnika, czy
                zapisujesz go roboczo jako anonimowego.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-4 md:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setChoice("known")}
              className={cn(
                "w-full rounded-lg p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md bg-white dark:bg-neutral-950 ring-1",
                choice === "known"
                  ? "ring-emerald-600/80 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40"
                  : "ring-gray-200 hover:ring-emerald-600/70 dark:ring-neutral-800 dark:hover:ring-emerald-600/60"
              )}
            >
              <div className="flex items-start gap-4">
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
                    Znam zawodnika
                  </div>
                  <div
                    className={cn(
                      "text-xs leading-relaxed",
                      choice === "known"
                        ? "text-emerald-900/80"
                        : "text-black/70 dark:text-neutral-300"
                    )}
                  >
                    Imię, nazwisko, rok urodzenia, klub i kraj klubu. To baza
                    pod pełny profil i raporty.
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setChoice("unknown")}
              className={cn(
                "w-full rounded-lg p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md bg-white dark:bg-neutral-950 ring-1",
                choice === "unknown"
                  ? "ring-rose-600/80 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/40"
                  : "ring-gray-200 hover:ring-rose-600/70 dark:ring-neutral-800 dark:hover:ring-rose-600/60"
              )}
            >
              <div className="flex items-start gap-4">
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
                    Nie znam zawodnika
                  </div>
                  <div
                    className={cn(
                      "text-xs leading-relaxed",
                      choice === "unknown"
                        ? "text-rose-900/80"
                        : "text-black/70 dark:text-neutral-300"
                    )}
                  >
                    Szybki zapis: numer, klub, kraj klubu. Idealne, gdy
                    dopiero „łapiesz” zawodnika w trakcie meczu.
                  </div>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Wrapper na kroki 1–4 z blokadą, gdy brak wyboru trybu */}
      <div className="relative">
        <div
          className={cn(
            "space-y-4",
            !hasChoice && "pointer-events-none opacity-40 blur-[5px]"
          )}
        >
          {/* KROK 1 – Podstawowe informacje */}
          <Card ref={basicRef} className="mt-1">
            <CardHeader className="group flex items-center justify-between border-b border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
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
                    Minimum, które uruchamia autozapis do Twojej bazy
                    zawodników.
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                    {badgeBasic}/{basicMax}
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
                  <AccordionContent id="basic-panel" className="pt-4 pb-5">
                    {choice === "unknown" ? (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <Label className="text-sm">
                              Numer na koszulce
                            </Label>
                            <div className="relative">
                              <Input
                                className={cn(!jerseyNumber && "pr-24")}
                                value={jerseyNumber}
                                onChange={(e) =>
                                  setJerseyNumber(e.target.value)
                                }
                                placeholder="np. 27"
                              />
                              {!jerseyNumber && <Chip text="Wymagane" />}
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm">Aktualny klub</Label>
                            <div className="relative">
                              <Input
                                value={uClub}
                                onChange={(e) => setUClub(e.target.value)}
                                className={cn(!uClub && "pr-24")}
                              />
                              {!uClub && <Chip text="Wymagane" />}
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm pb-2">
                              Kraj aktualnego klubu
                            </Label>
                            <CountryCombobox
                              value={uClubCountry}
                              onChange={(val) => setUClubCountry(val)}
                              chip={!uClubCountry ? "Wymagane" : undefined}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-sm">
                              Notatka własna (opcjonalne)
                            </Label>
                            <Textarea
                              value={uNote}
                              onChange={(e) => setUNote(e.target.value)}
                              placeholder="Krótka notatka z meczu, charakterystyka…"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <MainPositionPitch
                          value={(ext.mainPos as DetailedPos | "") || ""}
                          onChange={(pos) => {
                            setExt((s) => ({ ...s, mainPos: pos }));
                            setUPosDet(pos);
                            setPosDet(pos);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <Label className="text-sm">Imię</Label>
                            <div className="relative">
                              <Input
                                value={firstName}
                                onChange={(e) =>
                                  setFirstName(e.target.value)
                                }
                                className={cn(!firstName && "pr-24")}
                              />
                              {!firstName && <Chip text="Wymagane" />}
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm">Nazwisko</Label>
                            <div className="relative">
                              <Input
                                value={lastName}
                                onChange={(e) =>
                                  setLastName(e.target.value)
                                }
                                className={cn(!lastName && "pr-24")}
                              />
                              {!lastName && <Chip text="Wymagane" />}
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm">Rok urodzenia</Label>
                            <div className="relative">
                              <Input
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={birthYear}
                                onChange={(e) =>
                                  setBirthYear(e.target.value)
                                }
                                className={cn(!birthYear && "pr-24")}
                              />
                              {!birthYear && <Chip text="Wymagane" />}
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm">
                              Numer na koszulce
                            </Label>
                            <Input
                              value={jerseyNumber}
                              onChange={(e) =>
                                setJerseyNumber(e.target.value)
                              }
                              placeholder="opcjonalne"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Aktualny klub</Label>
                            <div className="relative">
                              <Input
                                value={club}
                                onChange={(e) => setClub(e.target.value)}
                                className={cn(!club && "pr-24")}
                              />
                              {!club && <Chip text="Wymagane" />}
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm pb-2">
                              Kraj aktualnego klubu
                            </Label>
                            <CountryCombobox
                              value={clubCountry}
                              onChange={(val) => setClubCountry(val)}
                              chip={!clubCountry ? "Wymagane" : undefined}
                            />
                          </div>
                        </div>

                        <MainPositionPitch
                          value={(ext.mainPos as DetailedPos | "") || ""}
                          onChange={(pos) => {
                            setExt((s) => ({ ...s, mainPos: pos }));
                            setPosDet(pos);
                            setUPosDet(pos);
                          }}
                        />
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* KROK 2 – Rozszerzone informacje */}
          <Card className="mt-1">
            <CardHeader className="group flex items-center justify-between border-b border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
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
                    Opcjonalne, ale bardzo pomocne przy analizie potencjału
                    i raportach długoterminowych.
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  {choice === "unknown" && (
                    <span className="hidden text-[11px] text-slate-500 sm:inline">
                      Nieznany zawodnik
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
            <CardContent className="px-4 py-0 md:px-6">
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
                        Możesz wrócić do tego kroku po dodaniu zawodnika. Teraz
                        skup się na podstawowych danych.
                      </p>
                    )}

                    {/* Mobile: Select; Desktop: Tabs */}
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
                        <TabsList className="inline-flex w-auto gap-1 rounded-md bg-slate-100 p-1 dark:bg-neutral-900">
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
            <CardHeader className="group flex items-center justify-between border-b border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
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
                    Wypełnij oceny dopiero, gdy masz ustawioną Główną pozycję
                    w kroku 1.
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  {choice === "unknown" && (
                    <span className="hidden text-[11px] text-slate-500 sm:inline">
                      Nieznany zawodnik
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
            <CardContent className="px-4 py-0 md:px-6">
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
                        Możesz wypełnić oceny, gdy będziesz mieć więcej danych
                        o zawodniku (np. po kilku meczach).
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
            <CardHeader className="group flex items-center justify-between border-b border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
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
                    Dodawaj mecze, w których zawodnik był obserwowany, oraz
                    przypisuj je do profilu.
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  {choice === "unknown" && (
                    <span className="hidden text-[11px] text-slate-500 sm:inline">
                      Nieznany zawodnik
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
            <CardContent className="px-4 py-0 md:px-6">
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
                        Możesz zacząć od zapisania meczu, w którym zauważyłeś
                        zawodnika. Obserwacje zawsze da się rozbudować później.
                      </p>
                    )}

                    <div className="space-y-8">
                     {/* Nowa obserwacja */}
<section className="space-y-4 rounded-md border border-gray-200 bg-white/90 px-3 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
  <div className="flex items-center justify-between gap-2">
    <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">
      <span className="h-1.5 w-1.5 rounded-md bg-slate-500" />
      Nowa obserwacja
    </div>
    <span className="text-[11px] text-slate-500 dark:text-neutral-400">
      Ustaw drużyny, datę, tryb i poziom przeciwnika – poniższy „scoreboard”
      złoży mecz automatycznie.
    </span>
  </div>

  {/* SCOREBOARD PREVIEW */}
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
    <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
      <div className="flex items-center gap-4 text-center md:text-left">
        <div className="min-w-[120px]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Drużyna A
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-neutral-50">
            {qaTeamA || "Nie ustawiono"}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[11px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-neutral-950 dark:text-neutral-100 dark:ring-neutral-700">
          VS
        </div>
        <div className="min-w-[120px]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Drużyna B
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-neutral-50">
            {qaTeamB || "Nie ustawiono"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 dark:text-neutral-300">
        {qaDate && (
          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200 dark:bg-neutral-950 dark:ring-neutral-700">
            {qaDate}
          </span>
        )}
        {qaTime && (
          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200 dark:bg-neutral-950 dark:ring-neutral-700">
            {qaTime}
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200 dark:bg-neutral-950 dark:ring-neutral-700">
          {qaMode === "live" ? "Live (boisko)" : "TV / wideo"}
        </span>
        {qaOpponentLevel && (
          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200 dark:bg-neutral-950 dark:ring-neutral-700">
            Poziom: {qaOpponentLevel}
          </span>
        )}
      </div>
    </div>
    <p className="mt-2 text-[11px] text-slate-500 dark:text-neutral-400">
      Nazwa meczu do zapisu:{" "}
      <span className="font-medium text-slate-800 dark:text-neutral-50">
        {qaMatch || "uzupełni się automatycznie po wpisaniu obu drużyn"}
      </span>
      .
    </p>
  </div>

  {/* Drużyny – wejścia */}
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
      <Label className="text-sm">Drużyna A</Label>
      <Input
        className="mt-1"
        value={qaTeamA}
        onChange={(e) => updateQaMatchFromTeams(e.target.value, qaTeamB)}
        placeholder="np. Lech U19"
      />
      <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">
        Wpisz nazwę gospodarzy lub drużyny, którą obserwujesz „bliżej”.
      </p>
    </div>

    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
      <Label className="text-sm">Drużyna B</Label>
      <Input
        className="mt-1"
        value={qaTeamB}
        onChange={(e) => updateQaMatchFromTeams(qaTeamA, e.target.value)}
        placeholder="np. Wisła U19"
      />
      <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">
        Wpisz nazwę rywala – vs wyświetli się w „scoreboardzie” powyżej.
      </p>
    </div>
  </div>

  {/* Data + godzina – DateTimePicker */}
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div className="md:col-span-2">
      <Label className="text-sm">Data i godzina meczu</Label>
      <div className="mt-1">
        <DateTimePicker24h
          value={{ date: qaDate, time: qaTime }}
          onChange={({ date, time }) => {
            setQaDate(date);
            setQaTime(time);
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
        Ustaw precyzyjnie dzień i godzinę meczu. To pomaga później filtrować
        obserwacje.
      </p>
    </div>
  </div>

  {/* Tryb meczu */}
  <div>
    <Label className="text-sm">Tryb meczu</Label>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {QA_CONDITIONS.map((mode) => {
        const isActive = qaMode === mode;
        const isLive = mode === "live";
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setQaMode(mode)}
            className={cn(
              "flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs transition",
              isActive
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 dark:border-indigo-400 dark:bg-indigo-900/30 dark:ring-indigo-500/60"
                : "border-gray-200 bg-white hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            )}
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
                  {isLive ? "Na żywo z boiska" : "Transmisja / wideo"}
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
  </div>

  {/* Poziom przeciwnika */}
  <div>
    <Label className="text-sm">Poziom przeciwnika</Label>
    <Input
      value={qaOpponentLevel}
      onChange={(e) => setQaOpponentLevel(e.target.value)}
      placeholder="np. CLJ U17, 3 liga, top akademia…"
      className="mt-1"
    />
    <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
      Krótka informacja o poziomie rywala – pomaga w późniejszej analizie.
    </p>
  </div>

  {/* Sticky przycisk dodawania */}
  <div className="sticky bottom-0 mt-1 -mx-3 border-t border-gray-200 bg-white/90 px-3 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80">
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-slate-500 dark:text-neutral-400">
        Do zapisu wymagane są: dwie drużyny i data meczu.
      </p>
      <Button
        className="bg-gray-900 text-white hover:bg-gray-800"
        onClick={addObservation}
        disabled={
          !qaTeamA.trim() || !qaTeamB.trim() || !qaDate.trim()
        }
      >
        Dodaj obserwację tego zawodnika
      </Button>
    </div>
  </div>
</section>


                      {/* Istniejące obserwacje */}
                      <section className="space-y-3 rounded-md border border-gray-200 bg-white/90 px-3 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
                        <div className="flex items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">
                            <span className="h-1.5 w-1.5 rounded-md bg-slate-500" />
                            Istniejące obserwacje
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                            Wyszukaj i przypisz obserwację z dziennika.
                          </span>
                        </div>

                        <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 opacity-70" />
                            <Input
                              value={obsQuery}
                              onChange={(e) => setObsQuery(e.target.value)}
                              placeholder="Szukaj po meczu lub dacie…"
                              className="flex-1 border-0 focus-visible:ring-0"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                            Wybierz obserwację z listy, aby podejrzeć szczegóły
                            lub ją edytować.
                          </p>
                        </div>

                     <div className="max-h-80 space-y-2 overflow-auto">
  {(() => {
    const list = existingFiltered;
    if (list.length === 0) {
      return (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-slate-500 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
          Brak obserwacji dla podanych kryteriów. Zapisz nową lub zmień
          filtr wyszukiwania.
        </div>
      );
    }

    return list.map((o) => {
      const selected = obsSelectedId === o.id;
      const matchLabel = o.match || "Bez nazwy meczu";

      const dateTime = [o.date || "—", o.time || ""]
        .filter(Boolean)
        .join(" · ");

      return (
        <button
          key={o.id}
          type="button"
          onClick={() => setObsSelectedId(o.id)}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition",
            selected
              ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200 dark:border-emerald-500/80 dark:bg-emerald-900/20 dark:ring-emerald-700/70"
              : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
          )}
        >
          {/* pseudo-radio */}
          <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center">
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border",
                selected
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
              )}
            >
              {selected && (
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-300" />
              )}
            </span>
          </div>

          {/* main content */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-50">
                {matchLabel}
              </p>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                {dateTime || "Brak daty"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              {o.opponentLevel && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
                  Poziom: {o.opponentLevel}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  o.mode === "tv"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                )}
              >
                {o.mode === "tv" ? "TV" : "Live"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  o.status === "final"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                )}
              >
                {o.status === "final" ? "Finalna" : "Szkic"}
              </span>
            </div>
          </div>

          {/* action */}
          <div className="ml-2 flex flex-shrink-0 items-center">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(o);
              }}
            >
              Edytuj
            </Button>
          </div>
        </button>
      );
    });
  })()}
</div>

                      </section>
                    </div>

                    {/* EDIT MODAL */}
                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edytuj obserwację</DialogTitle>
                        </DialogHeader>
                        {editingObs && (
                          <div className="space-y-4">
                            <div>
                              <Label>Mecz</Label>
                              <Input
                                value={safeText(editingObs.match) || ""}
                                onChange={(e) =>
                                  setEditingObs((prev) =>
                                    prev
                                      ? { ...prev, match: e.target.value }
                                      : prev
                                  )
                                }
                                className="mt-1"
                              />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <Label>Data i godzina meczu</Label>
                                <div className="mt-1">
                                  <DateTimePicker24h
                                    value={{
                                      date:
                                        safeText(editingObs.date) || "",
                                      time:
                                        safeText(editingObs.time) || "",
                                    }}
                                    onChange={({ date, time }) =>
                                      setEditingObs((prev) =>
                                        prev
                                          ? { ...prev, date, time }
                                          : prev
                                      )
                                    }
                                    placeholder="Data i godzina meczu"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label>Poziom przeciwnika</Label>
                                <Input
                                  value={
                                    safeText(editingObs.opponentLevel) || ""
                                  }
                                  onChange={(e) =>
                                    setEditingObs((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            opponentLevel: e.target.value,
                                          }
                                        : prev
                                    )
                                  }
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <Label className="text-sm">Tryb</Label>
                                <div className="mt-2 flex gap-2">
                                  <Button
                                    type="button"
                                    variant={
                                      editingObs.mode === "live"
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() =>
                                      setEditingObs((prev) =>
                                        prev
                                          ? { ...prev, mode: "live" }
                                          : prev
                                      )
                                    }
                                  >
                                    Live
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={
                                      editingObs.mode === "tv"
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() =>
                                      setEditingObs((prev) =>
                                        prev
                                          ? { ...prev, mode: "tv" }
                                          : prev
                                      )
                                    }
                                  >
                                    TV
                                  </Button>
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm">Status</Label>
                                <div className="mt-2 flex gap-2">
                                  <Button
                                    type="button"
                                    variant={
                                      editingObs.status === "draft"
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() =>
                                      setEditingObs((prev) =>
                                        prev
                                          ? { ...prev, status: "draft" }
                                          : prev
                                      )
                                    }
                                  >
                                    Szkic
                                  </Button>

                                  <Button
                                    type="button"
                                    variant={
                                      editingObs.status === "final"
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() =>
                                      setEditingObs((prev) =>
                                        prev
                                          ? { ...prev, status: "final" }
                                          : prev
                                      )
                                    }
                                  >
                                    Finalna
                                  </Button>
                                </div>
                              </div>
                            </div>
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {!hasChoice && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex max-w-xs flex-col items-center gap-2 rounded-md bg-none px-4 py-3 text-center dark:border-neutral-700 dark:bg-neutral-950/95">
              <Lock className="h-6 w-6 text-slate-900 dark:text-neutral-50" />
              <p className="leading-snug text-sm text-slate-900 dark:text-neutral-50">
                Wybierz sposób dodania zawodnika w <b>Kroku 0</b>, aby
                odblokować kolejne kroki.
              </p>
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <p className="mt-3 text-sm text-red-600">{saveError}</p>
      )}
    </div>
  );
}
