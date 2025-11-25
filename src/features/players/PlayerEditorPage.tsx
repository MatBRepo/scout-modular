// src/app/(players)/players/[id]/PlayerEditorPage.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";

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
  ChevronDown, ChevronLeft
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

// NEW: import header actions context from ClientRoot
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
  GK: { top: "50%", left: "8%" },
  LB: { top: "30%", left: "24%" },
  CB: { top: "50%", left: "26%" },
  RB: { top: "70%", left: "24%" },
  CDM: { top: "50%", left: "40%" },
  CM: { top: "50%", left: "55%" },
  CAM: { top: "50%", left: "68%" },
  LW: { top: "30%", left: "68%" },
  RW: { top: "70%", left: "68%" },
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
          <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
          {/* text hidden on mobile, visible md+ */}
          <span className="hidden md:inline">Autozapis…</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-4 w-4 md:mr-2" />
          {/* text hidden on mobile, visible md+ */}
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

/* DateTime picker 24h – placeholder type for hidden code */
type DateTimeValue = {
  date: string;
  time: string;
};

const PITCH_SVG = `
<svg width="100%" height="100%" viewBox="0 0 590 350" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="590" height="350" rx="15" fill="#248604"/>
<rect x="18.5139" y="16.2588" width="274.939" height="317.482" stroke="white" stroke-width="2"/>
<rect x="18.5139" y="79.2017" width="104.178" height="192.55" stroke="white" stroke-width="2"/>
<rect x="18.5139" y="112.58" width="47.2579" height="124.839" stroke="white" stroke-width="2"/>
<rect x="8.66235" y="112.58" width="10.0408" height="124.839" stroke="white" stroke-width="2"/>
<mask id="path-6-inside-1_6055_2662" fill="white">
<path d="M31.7444 15.2588C31.7444 21.5792 25.9524 26.7031 18.8079 26.7031C18.3711 26.7031 17.9395 26.6819 17.5139 26.6445V15.2588H31.7444Z"/>
</mask>
<path d="M31.7444 15.2588C31.7444 21.5792 25.9524 26.7031 18.8079 26.7031C18.3711 26.7031 17.9395 26.6819 17.5139 26.6445V15.2588H31.7444Z" fill="white" fill-opacity="0.1"/>
<path d="M31.7444 15.2588L33.7444 15.2588L33.7444 13.2588H31.7444V15.2588ZM18.8079 26.7031V28.7031H18.8079L18.8079 26.7031ZM17.5139 26.6445H15.5139V28.4765L17.3389 28.6369L17.5139 26.6445ZM17.5139 15.2588V13.2588H15.5139V15.2588H17.5139ZM31.7444 15.2588L29.7444 15.2588C29.7444 20.2513 25.0853 24.7031 18.8079 24.7031L18.8079 26.7031L18.8079 28.7031C26.8196 28.7031 33.7444 22.9071 33.7444 15.2588L31.7444 15.2588ZM18.8079 26.7031V24.7031C18.4358 24.7031 18.0629 24.6851 17.689 24.6522L17.5139 26.6445L17.3389 28.6369C17.8162 28.6788 18.3065 28.7031 18.8079 28.7031V26.7031ZM17.5139 26.6445H19.5139V15.2588H17.5139H15.5139V26.6445H17.5139ZM17.5139 15.2588V17.2588H31.7444V15.2588V13.2588H17.5139V15.2588Z" fill="white" mask="url(#path-6-inside-1_6055_2662)"/>
<mask id="path-8-inside-2_6055_2662" fill="white">
<path d="M17.5139 322.344C24.7684 322.344 30.6497 327.39 30.6497 333.614C30.6497 333.995 30.6262 334.37 30.5833 334.741L17.5139 334.741L17.5139 322.344Z"/>
</mask>
<path d="M17.5139 322.344C24.7684 322.344 30.6497 327.39 30.6497 333.614C30.6497 333.995 30.6262 334.37 30.5833 334.741L17.5139 334.741L17.5139 322.344Z" fill="white" fill-opacity="0.1"/>
<path d="M17.5139 322.344L17.5139 320.344L15.5139 320.344L15.5139 322.344L17.5139 322.344ZM30.6497 333.614L32.6497 333.614L32.6497 333.614L30.6497 333.614ZM30.5833 334.741L30.5833 336.741L32.3651 336.741L32.57 334.971L30.5833 334.741ZM17.5139 334.741L15.5139 334.741L15.5139 336.741L17.5139 336.741L17.5139 334.741ZM17.5139 322.344L17.5139 324.344C23.9622 324.344 28.6497 328.771 28.6497 333.614L30.6497 333.614L32.6497 333.614C32.6497 326.009 25.5746 320.344 17.5139 320.344L17.5139 322.344ZM30.6497 333.614L28.6497 333.614C28.6497 333.912 28.6313 334.211 28.5965 334.511L30.5833 334.741L32.57 334.971C32.6211 334.53 32.6497 334.077 32.6497 333.614L30.6497 333.614ZM30.5833 334.741L30.5833 332.741L17.5139 332.741L17.5139 334.741L17.5139 336.741L30.5833 336.741L30.5833 334.741ZM17.5139 334.741L19.5139 334.741L19.5139 322.344L17.5139 322.344L15.5139 322.344L15.5139 334.741L17.5139 334.741Z" fill="white" mask="url(#path-8-inside-2_6055_2662)"/>
<!-- (rest of your SVG unchanged, from previous message) -->
<circle cx="496" cy="174" r="1" fill="white"/>
<circle cx="94" cy="174" r="1" fill="white"/>
</svg>
`;



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
  const { setActions } = useHeaderActions(); // NEW: get header actions setter

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

          if (mode === "known") {
            setFirstName(basicMeta.firstName ?? data.firstName ?? "");
            setLastName(basicMeta.lastName ?? data.lastName ?? "");
            setBirthYear(basicMeta.birthYear ?? data.birthDate ?? "");
            setClub(basicMeta.club ?? data.club ?? "");
            setClubCountry(
              basicMeta.clubCountry ??
                extended.birthCountry ??
                data.nationality ??
                ""
            );
            setJerseyNumber(basicMeta.jerseyNumber ?? "");
          } else {
            setJerseyNumber(basicMeta.jerseyNumber ?? "");
            setUClub(basicMeta.club ?? data.club ?? "");
            setUClubCountry(
              basicMeta.clubCountry ??
                extended.birthCountry ??
                data.nationality ??
                ""
            );
            setUNote(meta.unknownNote ?? "");
          }

          const mergedExt = {
            ...getDefaultExt(),
            ...(extended || {}),
          };
          setExt(mergedExt);

          const mainPos =
            (mergedExt.mainPos as DetailedPos | "") ||
            (basicMeta.posDet as DetailedPos | "") ||
            "CM";
          setPosDet(mainPos || "CM");
          setUPosDet(mainPos || "CM");

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
    // Dane osobowe = tylko imię / nazwisko / rok urodzenia
    const hasPersonal =
      firstName.trim() !== "" ||
      lastName.trim() !== "" ||
      birthYear.trim() !== "";

    // Dane anonimowe = numer + klub + kraj (mogą być z "known" pól lub z u*)
    const hasAnon =
      jerseyNumber.trim() !== "" ||
      uClub.trim() !== "" ||
      uClubCountry.trim() !== "" ||
      (!hasPersonal &&
        (club.trim() !== "" || clubCountry.trim() !== "")) ||
      uNote.trim() !== "";

    let next: Choice;
    if (hasPersonal && !hasAnon) {
      next = "known";
    } else if (!hasPersonal && hasAnon) {
      next = "unknown";
    } else if (hasPersonal && hasAnon) {
      // jeśli wypełnione oba zestawy pól – preferuj pełne dane
      next = "known";
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
    uClub,
    uClubCountry,
    uNote,
  ]);

  // Nazwa wyświetlana w tabeli obserwacji zawodnika
  const playerDisplayName = useMemo(() => {
    if (choice === "known") {
      const fn = firstName.trim();
      const ln = lastName.trim();
      const full = `${fn} ${ln}`.trim();
      return full || "Nieznany zawodnik";
    }
    const num = jerseyNumber.trim();
    const clubLabel = (uClub || club || "").trim();
    if (num) {
      return `#${num} – ${clubLabel || "Bez klubu"}`;
    }
    return clubLabel || "Nieznany zawodnik";
  }, [choice, firstName, lastName, jerseyNumber, uClub, club]);

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
                        className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 text-[10px] text-slate-600 hover:bg-slate-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
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

  // Autozapis do Supabase
  useEffect(() => {
    let cancelled = false;

    if (!choice || !playerId) {
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
      !!(uClub.trim() || club.trim()) &&
      !!(uClubCountry.trim() || clubCountry.trim());

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
            const c = uClub.trim() || club.trim();
            const cc = uClubCountry.trim() || clubCountry.trim();

            name = num ? `#${num} – ${c}` : c || "Nieznany zawodnik";
            clubFinal = c;
            posBucket = toBucket(uPosDet || posDet);
            clubCountryFinal = cc;
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

// NEW: push "Zapisano / Wróć do listy" into global header via ClientRoot
useEffect(() => {
  const node = (
    <div className="flex items-center gap-2">
      <SavePill state={saveState} size="compact" />

      {/* Desktop / tablet: text button */}
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 px-3 text-xs md:inline-flex"
        onClick={() => router.push("/players")}
      >
        Wróć do listy
      </Button>

      {/* Mobile: round back arrow */}
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
}, [setActions, saveState, router]);


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
      {/* Toolbar już BEZ lokalnych akcji – wszystko w globalnym headerze */}
      <Toolbar
        title="Edycja zawodnika"
        right={null}
      />

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
<CardHeader className="group flex items-center justify-between border-b border-slate-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60 hidden md:block">
  <div className="flex w-full items-center justify-between gap-3 hidden md:block">
    <div className="hidden md:block">
      <div className={stepPillClass}>Krok 0 · Tryb profilu</div>
      <h2 className="mt-1 text-base font-semibold tracking-tight hidden md:block">
        Tryb przechowywania danych zawodnika
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400 hidden md:block">
        System automatycznie określa, czy profil jest <b>pełny</b> czy{" "}
        <b>anonimowy</b> na podstawie uzupełnionych pól – Ty po prostu
        wypełniasz dane.
      </p>
    </div>
  </div>
</CardHeader>

<CardContent className="px-4 py-4 md:px-6">
  <div className="grid grid-cols-2 gap-3">
    <div
      className={cn(
        "cursor-default rounded-lg p-4 text-left shadow-sm bg-white dark:bg-neutral-950 ring-1",
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
        "cursor-default rounded-lg p-4 text-left shadow-sm bg-white dark:bg-neutral-950 ring-1",
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

      {/* Kroki 1–4 – zawsze dostępne; tryb profilu wyliczany automatycznie */}
      <div className="space-y-4">
        {/* KROK 1 – Podstawowe informacje + Główna pozycja (pitch) */}
        <Card ref={basicRef} className="mt-1">
          <CardHeader
            className={cn(
              "group flex items-center justify-between border-b border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
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
                        <Input
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={birthYear}
                          onChange={(e) => setBirthYear(e.target.value)}
                          placeholder="np. 2006"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">
                          Numer na koszulce
                          <span className="ml-1 text-[11px] text-slate-400">
                            (może być użyty także w profilu anonimowym)
                          </span>
                        </Label>
                        <Input
                          value={jerseyNumber}
                          onChange={(e) => setJerseyNumber(e.target.value)}
                          placeholder="np. 27"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">
                          Aktualny klub (imienny)
                        </Label>
                        <Input
                          value={club}
                          onChange={(e) => setClub(e.target.value)}
                          placeholder="np. Lech Poznań U19"
                        />
                      </div>
                      <div>
                        <Label className="text-sm pb-2">
                          Kraj aktualnego klubu (imienny)
                        </Label>
                        <CountryCombobox
                          value={clubCountry}
                          onChange={(val) => setClubCountry(val)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">
                          Aktualny klub (gdy anonimowo)
                        </Label>
                        <Input
                          value={uClub}
                          onChange={(e) => setUClub(e.target.value)}
                          placeholder="np. Klub bez danych osobowych"
                        />
                      </div>
                      <div>
                        <Label className="text-sm pb-2">
                          Kraj aktualnego klubu (gdy anonimowo)
                        </Label>
                        <CountryCombobox
                          value={uClubCountry}
                          onChange={(val) => setUClubCountry(val)}
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

                      <div className="md:col-span-2">
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
              "group flex items-center justify-between border-b border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
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
          <CardHeader
            className={cn(
              "group flex items-center justify-between border-b border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
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
                  Rozbij ocenę na kategorie techniczne, mentalne i fizyczne –
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
              "group flex items-center justify-between border-b border-gray-200 px-4 py-4 transition-colors hover:bg-stone-50/80 md:px-6 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
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
                      Możesz tworzyć obserwacje również dla profilu
                      anonimowego – ważne, by zachować spójność meczu i
                      poziomu.
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

                  {/* Stary, ukryty UI dodawania/edytowania obserwacji – zostawiony jako dead-code dla TS */}
                  {false && (
                    <>
                      <div className="space-y-8">{/* ... */}</div>
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
