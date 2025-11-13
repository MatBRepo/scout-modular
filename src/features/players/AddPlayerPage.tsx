// src/app/(players)/players/add/AddPlayerPage.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronsUpDown, Check, Loader2, CheckCircle2, ChevronDown, Search,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import StarRating from "@/shared/ui/StarRating";
import { KnownPlayerIcon, UnknownPlayerIcon } from "@/components/icons";

/* ===== Positions ===== */
type BucketPos = "GK" | "DF" | "MF" | "FW";
type DetailedPos = "GK" | "CB" | "LB" | "RB" | "CDM" | "CM" | "CAM" | "LW" | "RW" | "ST";

const POS_DATA: Array<{ value: DetailedPos; code: string; name: string; desc: string }> = [
  { value: "GK", code: "GK", name: "Bramkarz", desc: "Odbicia, gra na linii, wyjścia i gra nogami." },
  { value: "CB", code: "CB", name: "Środkowy obrońca", desc: "Gra w powietrzu, ustawienie, wyprowadzenie." },
  { value: "LB", code: "LB", name: "Lewy obrońca", desc: "Obrona strony, dośrodkowania, wsparcie ataku." },
  { value: "RB", code: "RB", name: "Prawy obrońca", desc: "Obrona strony, dośrodkowania, wsparcie ataku." },
  { value: "CDM", code: "CDM", name: "Śr. pomocnik defensywny", desc: "Odbiór, asekuracja, pierwsze podanie." },
  { value: "CM", code: "CM", name: "Środkowy pomocnik", desc: "Równowaga defensywa/kreacja." },
  { value: "CAM", code: "CAM", name: "Ofensywny pomocnik", desc: "Ostatnie podanie, kreacja, strzał." },
  { value: "LW", code: "LW", name: "Lewy pomocnik/skrzydłowy", desc: "1v1, dośrodkowania, zejścia do strzału." },
  { value: "RW", code: "RW", name: "Prawy pomocnik/skrzydłowy", desc: "1v1, dośrodkowania, zejścia do strzału." },
  { value: "ST", code: "ST", name: "Napastnik", desc: "Wykończenie, gra tyłem, ruch w polu karnym." },
];

const toBucket = (p: DetailedPos): BucketPos => {
  switch (p) {
    case "GK": return "GK";
    case "CB":
    case "LB":
    case "RB": return "DF";
    case "CDM":
    case "CM":
    case "CAM":
    case "LW":
    case "RW": return "MF";
    case "ST": return "FW";
  }
};

/* ===== Countries ===== */
type Country = { code: string; name: string; flag: string };
const COUNTRIES: Country[] = [
  { code: "PL", name: "Polska", flag: "🇵🇱" }, { code: "DE", name: "Niemcy", flag: "🇩🇪" },
  { code: "GB", name: "Anglia", flag: "🇬🇧" }, { code: "ES", name: "Hiszpania", flag: "🇪🇸" },
  { code: "IT", name: "Włochy", flag: "🇮🇹" }, { code: "FR", name: "Francja", flag: "🇫🇷" },
  { code: "NL", name: "Holandia", flag: "🇳🇱" }, { code: "PT", name: "Portugalia", flag: "🇵🇹" },
  { code: "SE", name: "Szwecja", flag: "🇸🇪" }, { code: "NO", name: "Norwegia", flag: "🇳🇴" },
  { code: "DK", name: "Dania", flag: "🇩🇰" }, { code: "BE", name: "Belgia", flag: "🇧🇪" },
  { code: "CH", name: "Szwajcaria", flag: "🇨🇭" }, { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "CZ", name: "Czechy", flag: "🇨🇿" }, { code: "SK", name: "Słowacja", flag: "🇸🇰" },
  { code: "UA", name: "Ukraina", flag: "🇺🇦" }, { code: "LT", name: "Litwa", flag: "🇱🇹" },
  { code: "LV", name: "Łotwa", flag: "🇱🇻" }, { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "HU", name: "Węgry", flag: "🇭🇺" }, { code: "RO", name: "Rumunia", flag: "🇷🇴" },
  { code: "HR", name: "Chorwacja", flag: "🇭🇷" }, { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SI", name: "Słowenia", flag: "🇸🇮" }, { code: "GR", name: "Grecja", flag: "🇬🇷" },
  { code: "TR", name: "Turcja", flag: "🇹🇷" }, { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "BR", name: "Brazylia", flag: "🇧🇷" }, { code: "AR", name: "Argentyna", flag: "🇦🇷" },
];

/* ===== Small UI ===== */
function SavePill({ state }: { state: "idle" | "saving" | "saved" }) {
  const base = "inline-flex h-10 items-center rounded border px-3 text-sm leading-none";
  const map = {
    saving: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100",
    saved:  "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100",
    idle:   "border-gray-300 bg-white text-gray-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200",
  } as const;
  return (
    <span className={`${base} ${map[state]}`} aria-live="polite">
      {state === "saving" ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Zapisywanie…</>) :
       state === "saved"  ? (<><CheckCircle2 className="mr-2 h-4 w-4" />Zapisano</>) : ("—")}
    </span>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-stone-100 px-2 py-0.5 text-[10px] opacity-80 dark:border-neutral-700 dark:bg-neutral-800">
      {text}
    </span>
  );
}

/* Country combobox with optional chip inside the trigger */
function CountryCombobox({
  value, onChange, error, chip,
}: { value: string; onChange: (next: string) => void; error?: string; chip?: string }) {
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
              "relative flex w-full items-center justify-between rounded border bg-white px-3 py-2 text-left text-sm dark:bg-neutral-950",
              error ? "border-red-500" : "border-gray-300 dark:border-neutral-700",
              chip ? "pr-24" : ""
            )}
          >
            <span className={cn("flex min-w-0 items-center gap-2", !selected && "text-muted-foreground")}>
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
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
                      onSelect={() => { onChange(c.name); setOpen(false); }}
                    >
                      <span className="mr-2 text-base">{c.flag}</span>
                      <span className="mr-2">{c.name}</span>
                      <span className={cn("ml-auto", active ? "opacity-100" : "opacity-0")}>
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

/* ===== Add page ===== */
type Choice = "known" | "unknown" | null;

type ObsRec = {
  id: number;
  match?: string;
  date?: string;
  time?: string;
  status?: "draft" | "final";
  mode?: "live" | "tv";
  opponentLevel?: string;
  players?: string[];
};

export default function AddPlayerPage() {
  const router = useRouter();

  /* Choice (switcher) */
  const [choice, setChoice] = useState<Choice>("known");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("s4s.addPlayer.choice");
      if (saved === "known" || saved === "unknown") setChoice(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (choice) {
      try { localStorage.setItem("s4s.addPlayer.choice", choice); } catch {}
    }
  }, [choice]);

  /* Accordions */
  const [basicOpen, setBasicOpen] = useState(true);
  const [extOpen, setExtOpen]     = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [obsOpen, setObsOpen]     = useState(false);

  /* Known */
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [posDet,    setPosDet]    = useState<DetailedPos>("CM");
  const [age,       setAge]       = useState<number | "">("");
  const [club,      setClub]      = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");

  /* Unknown */
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [uClub,        setUClub]        = useState("");
  const [uClubCountry, setUClubCountry] = useState("");
  const [uPosDet,      setUPosDet]      = useState<DetailedPos>("CM");
  const [uNote,        setUNote]        = useState("");

  /* Extended (optional) */
  const [ext, setExt] = useState({
    teamLevel: "",
    height: "", weight: "", body: "",
    email: "", phone: "", agent: "",
    contractUntil: "", clause: "", status: "",
    matches: "", goals: "", assists: "",
  });

  /* Grade (optional) */
  const RATING_KEYS = [
    "Motoryka – szybkość, wytrzymałość",
    "Siła, pojedynki, zwinność",
    "Technika",
    "Gra z piłką",
    "Gra bez piłki",
    "Stałe fragmenty",
    "Faza defensywna",
    "Faza ofensywna",
    "Fazy przejściowe",
    "Postawa (mentalność)",
  ] as const;
  const [ratings, setRatings] = useState<Record<(typeof RATING_KEYS)[number], number>>(
    () => Object.fromEntries(RATING_KEYS.map((k) => [k, 0])) as any
  );
  const [notes, setNotes] = useState("");

  /* Save pill (draft autosave) */
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!choice) {
      setSaveStatus("idle");
      return;
    }

    setSaveStatus("saving");
    const draft = {
      choice,
      known: { firstName, lastName, posDet, age, club, birthDate, nationality },
      unknown: { jerseyNumber, uClub, uClubCountry, uPosDet, uNote },
      meta: { ext, ratings, notes },
    };
    try { localStorage.setItem("s4s.addPlayerDraft.v2", JSON.stringify(draft)); } catch {}
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 450);
  }, [
    choice,
    firstName, lastName, posDet, age, club, birthDate, nationality,
    jerseyNumber, uClub, uClubCountry, uPosDet, uNote,
    ext, ratings, notes,
  ]);

  /* Counters for badges (like editor) */
  const countTruthy = (vals: Array<unknown>) => vals.filter((v) => {
    if (typeof v === "number") return v > 0;
    return !!(v !== null && v !== undefined && String(v).trim() !== "");
  }).length;

  const cntBasicKnown   = countTruthy([firstName, lastName, club, age, birthDate, nationality]);
  const cntBasicUnknown = countTruthy([jerseyNumber, uClub, uClubCountry, uPosDet]);
  const badgeBasic = (choice === "unknown") ? cntBasicUnknown : cntBasicKnown;

  const cntClub    = countTruthy([(choice === "unknown" ? uClub : club), (ext.teamLevel)]);
  const cntPhys    = countTruthy([ext.height, ext.weight, ext.body]);
  const cntContact = countTruthy([ext.email, ext.phone, ext.agent]);
  const cntContract= countTruthy([ext.contractUntil, ext.clause, ext.status]);
  const cntStats   = countTruthy([ext.matches, ext.goals, ext.assists]);
  const totalExt   = cntClub + cntPhys + cntContact + cntContract + cntStats;
  const totalExtMax= 2 + 3 + 3 + 3 + 3;

  /* Observations (local) */
  const [observations, setObservations] = useState<ObsRec[]>([]);
  const [obsQuery, setObsQuery] = useState("");
  const [obsSelectedId, setObsSelectedId] = useState<number | null>(null);
  const [qaMatch, setQaMatch] = useState("");
  const [qaDate, setQaDate] = useState("");
  const [qaTime, setQaTime] = useState("");
  const [qaMode, setQaMode] = useState<"live" | "tv">("live");
  const [qaStatus, setQaStatus] = useState<"draft" | "final">("draft");
  const [qaOpponentLevel, setQaOpponentLevel] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("s4s.observations");
      const arr: ObsRec[] = raw ? JSON.parse(raw) : [];
      setObservations(Array.isArray(arr) ? arr : []);
    } catch { setObservations([]); }
  }, []);

  function bumpSaving() {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 450);
  }
  function persistObservations(next: ObsRec[]) {
    bumpSaving();
    setObservations(next);
    try { localStorage.setItem("s4s.observations", JSON.stringify(next)); } catch {}
  }
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
    persistObservations([next, ...observations]);
    setQaMatch(""); setQaDate(""); setQaTime(""); setQaMode("live"); setQaStatus("draft"); setQaOpponentLevel("");
  }

  const existingFiltered = useMemo(() => {
    const q = obsQuery.trim().toLowerCase();
    const arr = [...observations].sort((a, b) =>
      ((b.date || "") + (b.time || "")).localeCompare((a.date || "") + (a.time || ""))
    );
    if (!q) return arr;
    return arr.filter(
      (o) =>
        (o.match || "").toLowerCase().includes(q) ||
        (o.date || "").includes(q)
    );
  }, [observations, obsQuery]);

  /* Editing observation in modal */
  const [editOpen, setEditOpen] = useState(false);
  const [editingObs, setEditingObs] = useState<ObsRec | null>(null);

  function openEditModal(o: ObsRec) {
    setEditingObs({ ...o });
    setEditOpen(true);
  }

  function saveEditedObservation() {
    if (!editingObs) return;
    const next = observations.map((o) => (o.id === editingObs.id ? editingObs : o));
    persistObservations(next);
    setEditOpen(false);
  }

  /* Ext tabs – controlled & mobile-friendly */
  type ExtKey = "club" | "physical" | "contact" | "contract" | "stats";
  const [extView, setExtView] = useState<ExtKey>("club");

  function ExtContent({ view }: { view: ExtKey }) {
    switch (view) {
      case "club":
        return (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label className="text-sm">Klub</Label>
              <Input
                value={choice === "unknown" ? uClub : club}
                onChange={(e) => choice === "unknown" ? setUClub(e.target.value) : setClub(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">Drużyna/Rocznik</Label>
              <Input
                placeholder="U19 / Rezerwy…"
                value={ext.teamLevel}
                onChange={(e) => setExt((s) => ({ ...s, teamLevel: e.target.value }))}
              />
            </div>
          </div>
        );
      case "physical":
        return (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label className="text-sm">Wzrost (cm)</Label>
              <Input type="number" value={ext.height} onChange={(e) => setExt((s) => ({ ...s, height: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Waga (kg)</Label>
              <Input type="number" value={ext.weight} onChange={(e) => setExt((s) => ({ ...s, weight: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Budowa</Label>
              <Input value={ext.body} onChange={(e) => setExt((s) => ({ ...s, body: e.target.value }))} />
            </div>
          </div>
        );
      case "contact":
        return (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label className="text-sm">E-mail</Label>
              <Input type="email" value={ext.email} onChange={(e) => setExt((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Telefon</Label>
              <Input value={ext.phone} onChange={(e) => setExt((s) => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-sm">Agent</Label>
              <Input value={ext.agent} onChange={(e) => setExt((s) => ({ ...s, agent: e.target.value }))} />
            </div>
          </div>
        );
      case "contract":
        return (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label className="text-sm">Do kiedy</Label>
              <Input type="date" value={ext.contractUntil} onChange={(e) => setExt((s) => ({ ...s, contractUntil: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Kara/klauzula</Label>
              <Input value={ext.clause} onChange={(e) => setExt((s) => ({ ...s, clause: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Status</Label>
              <Input value={ext.status} onChange={(e) => setExt((s) => ({ ...s, status: e.target.value }))} />
            </div>
          </div>
        );
      case "stats":
        return (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label className="text-sm">Mecze</Label>
              <Input type="number" value={ext.matches} onChange={(e) => setExt((s) => ({ ...s, matches: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Gole</Label>
              <Input type="number" value={ext.goals} onChange={(e) => setExt((s) => ({ ...s, goals: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Asysty</Label>
              <Input type="number" value={ext.assists} onChange={(e) => setExt((s) => ({ ...s, assists: e.target.value }))} />
            </div>
          </div>
        );
    }
  }

  /* ========================================= UI ========================================= */
  return (
    <div className="w-full">
      <Toolbar
        title="Dodaj zawodnika"
        right={
          <div className="mb-4 flex w-full items-center gap-2 sm:gap-3 md:flex-nowrap justify-end">
            <SavePill state={saveStatus} />
            <div className="ml-auto md:ml-0">
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

      {/* Switcher: Zawodnik znany / nieznany */}
      <div className="mb-4 mt-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          Tryb dodawania zawodnika
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Znam zawodnika */}
          <button
            type="button"
            onClick={() => setChoice("known")}
            className={cn(
              "w-full rounded p-4 text-left shadow-sm transition bg-white dark:bg-neutral-950 ring-1",
              choice === "known"
                ? "ring-green-800"
                : "ring-gray-200 hover:ring-green-600/70 dark:ring-neutral-800 dark:hover:ring-green-600/50",
            )}
          >
            <div className="flex items-start gap-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent">
                <KnownPlayerIcon
                  className={cn("h-8 w-8", choice === "known" ? "text-green-900" : "text-black dark:text-neutral-100")}
                  strokeWidth={1.0}
                />
              </span>
              <div className="min-w-0">
                <div className={cn("mb-1 text-sm font-semibold", choice === "known" ? "text-green-900" : "text-black dark:text-neutral-100")}>
                  Znam zawodnika
                </div>
                <div className={cn("text-xs", choice === "known" ? "text-green-900/80" : "text-black/70 dark:text-neutral-300")}>
                  Podaj imię i/lub nazwisko – resztę uzupełnisz później w profilu.
                </div>
              </div>
            </div>
          </button>

          {/* Nie znam zawodnika */}
          <button
            type="button"
            onClick={() => setChoice("unknown")}
            className={cn(
              "w-full rounded p-4 text-left shadow-sm transition bg-white dark:bg-neutral-950 ring-1",
              choice === "unknown"
                ? "ring-red-800"
                : "ring-gray-200 hover:ring-red-600/70 dark:ring-neutral-800 dark:hover:ring-red-600/50",
            )}
          >
            <div className="flex items-start gap-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-transparent">
                <UnknownPlayerIcon
                  className={cn("h-8 w-8", choice === "unknown" ? "text-red-900" : "text-black dark:text-neutral-100")}
                  strokeWidth={1.0}
                />
              </span>
              <div className="min-w-0">
                <div className={cn("mb-1 text-sm font-semibold", choice === "unknown" ? "text-red-900" : "text-black dark:text-neutral-100")}>
                  Nie znam zawodnika
                </div>
                <div className={cn("text-xs", choice === "unknown" ? "text-red-900/80" : "text-black/70 dark:text-neutral-300")}>
                  Zapisz numer, klub i/lub kraj klubu — szczegóły dodasz później.
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* All accordions in one view */}
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
              <div className="text-xl font-semibold leading-none tracking-tight">Podstawowe informacje</div>
              <div className="flex items-center gap-3">
                <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">{badgeBasic}</span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", basicOpen ? "rotate-180" : "rotate-0")} />
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
                  {choice === "unknown" ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-sm">Numer na koszulce</Label>
                        <div className="relative">
                          <Input
                            className="pr-24"
                            value={jerseyNumber}
                            onChange={(e) => setJerseyNumber(e.target.value)}
                            placeholder="np. 27"
                          />
                          <Chip text="Wymagane" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Pozycja</Label>
                        <Select value={uPosDet} onValueChange={(v) => setUPosDet(v as DetailedPos)}>
                          <SelectTrigger className="w-full justify-start border-gray-300 dark:border-neutral-700 dark:bg-neutral-950 [&>svg]:ml-auto">
                            <SelectValue placeholder="Wybierz pozycję" />
                          </SelectTrigger>
                          <SelectContent>
                            {POS_DATA.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="text-left">
                                  <div className="font-medium">{opt.code}: {opt.name}</div>
                                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-[11px] text-dark">
                          Zapisze się jako <b>{toBucket(uPosDet)}</b> w polu <code>pos</code>.
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm">Aktualny klub</Label>
                        <div className="relative">
                          <Input className="pr-24" value={uClub} onChange={(e) => setUClub(e.target.value)} />
                          <Chip text="Wymagane" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Kraj aktualnego klubu</Label>
                        <CountryCombobox
                          value={uClubCountry}
                          onChange={(val) => setUClubCountry(val)}
                          chip="Wymagane"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Notatka (opcjonalnie)</Label>
                        <Input
                          value={uNote}
                          onChange={(e) => setUNote(e.target.value)}
                          placeholder="Krótka notatka…"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-sm">Imię</Label>
                        <div className="relative">
                          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="pr-24" />
                          <Chip text="Wymagane" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Nazwisko</Label>
                        <div className="relative">
                          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="pr-24" />
                          <Chip text="Wymagane" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Pozycja</Label>
                        <Select value={posDet} onValueChange={(v) => setPosDet(v as DetailedPos)}>
                          <SelectTrigger className="w-full justify-start border-gray-300 dark:border-neutral-700 dark:bg-neutral-950 [&>svg]:ml-auto">
                            <SelectValue placeholder="Wybierz pozycję" />
                          </SelectTrigger>
                          <SelectContent>
                            {POS_DATA.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="text-left">
                                  <div className="font-medium">{opt.code}: {opt.name}</div>
                                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-[11px] text-dark">
                          Zapisze się jako <b>{toBucket(posDet)}</b> w polu <code>pos</code>.
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm">Wiek</Label>
                        <Input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Klub</Label>
                        <Input value={club} onChange={(e) => setClub(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-sm">Narodowość</Label>
                        <CountryCombobox value={nationality} onChange={(val) => setNationality(val)} />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm">Data urodzenia</Label>
                        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                      </div>
                    </div>
                  )}
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
              <div className="text-xl font-semibold leading-none tracking-tight">Rozszerzone informacje</div>
              <div className="flex items-center gap-3">
                <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">
                  {cntClub + cntPhys + cntContact + cntContract + cntStats}/{totalExtMax}
                </span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", extOpen ? "rotate-180" : "rotate-0")} />
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
                  {/* Mobile: Select; Desktop: Tabs */}
                  <div className="md:hidden">
                    <Label className="mb-1 block text-sm">Sekcja</Label>
                    <select
                      value={extView}
                      onChange={(e) => setExtView(e.target.value as any)}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    >
                      <option value="club">Klub</option>
                      <option value="physical">Fizyczne</option>
                      <option value="contact">Kontakt</option>
                      <option value="contract">Kontrakt</option>
                      <option value="stats">Statystyki</option>
                    </select>
                    <div className="mt-4">
                      <ExtContent view={extView} />
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <Tabs value={extView} onValueChange={(v: any) => setExtView(v)} className="w-full">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="club">Klub</TabsTrigger>
                        <TabsTrigger value="physical">Fizyczne</TabsTrigger>
                        <TabsTrigger value="contact">Kontakt</TabsTrigger>
                        <TabsTrigger value="contract">Kontrakt</TabsTrigger>
                        <TabsTrigger value="stats">Statystyki</TabsTrigger>
                      </TabsList>

                      <TabsContent value="club" className="mt-4">
                        <ExtContent view="club" />
                      </TabsContent>
                      <TabsContent value="physical" className="mt-4">
                        <ExtContent view="physical" />
                      </TabsContent>
                      <TabsContent value="contact" className="mt-4">
                        <ExtContent view="contact" />
                      </TabsContent>
                      <TabsContent value="contract" className="mt-4">
                        <ExtContent view="contract" />
                      </TabsContent>
                      <TabsContent value="stats" className="mt-4">
                        <ExtContent view="stats" />
                      </TabsContent>
                    </Tabs>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* --- Ocena (opcjonalne) --- */}
        <Card className="mt-3">
          <CardHeader className="flex items-center justify-between border-b border-gray-200 px-4 py-5 md:px-6 dark:border-neutral-800">
            <button
              type="button"
              aria-expanded={gradeOpen}
              aria-controls="grade-panel"
              onClick={() => setGradeOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="text-xl font-semibold leading-none tracking-tight">Ocena</div>
              <div className="flex items-center gap-3">
                <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">
                  {Number(Boolean(notes)) + countTruthy(Object.values(ratings))}/{1 + 10}
                </span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", gradeOpen ? "rotate-180" : "rotate-0")} />
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
                  <Tabs defaultValue="notes" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="notes">Notatki</TabsTrigger>
                      <TabsTrigger value="aspects">Oceny</TabsTrigger>
                    </TabsList>

                    <TabsContent value="notes" className="mt-4 space-y-3">
                      <Input
                        placeholder="Krótki komentarz…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </TabsContent>

                    <TabsContent value="aspects" className="mt-4">
                      <div className="space-y-3">
                        {RATING_KEYS.map((k) => (
                          <div key={k} className="flex items-center justify-between gap-3">
                            <Label className="text-sm">{k}</Label>
                            <StarRating
                              max={5}
                              value={ratings[k] ?? 0}
                              onChange={(v) => setRatings((s) => ({ ...s, [k]: v }))}
                            />
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* --- Obserwacje (FULL module) --- */}
        <Card className="mt-3">
          <CardHeader className="flex items-center justify-between border-b border-gray-200 px-4 py-5 md:px-6 dark:border-neutral-800">
            <button
              type="button"
              aria-expanded={obsOpen}
              aria-controls="obs-panel"
              onClick={() => setObsOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="text-xl font-semibold leading-none tracking-tight">Obserwacje</div>
              <div className="flex items-center gap-3">
                <span className="rounded border px-2 py-0.5 text-xs text-muted-foreground">{observations.length}</span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", obsOpen ? "rotate-180" : "rotate-0")} />
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
                    {/* improved segmented control style */}
                    <TabsList className="mb-3 inline-flex w-full max-w-md items-center justify-between rounded bg-gray-100 p-1 shadow-inner dark:bg-neutral-900">
                      <TabsTrigger
                        value="new"
                        className="flex-1 rounded px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
                      >
                        Nowa obserwacja
                      </TabsTrigger>
                      <TabsTrigger
                        value="existing"
                        className="flex-1 rounded px-4 py-2 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
                      >
                        Istniejące
                      </TabsTrigger>
                    </TabsList>
                    <p className="mb-4 text-xs text-slate-500 dark:text-neutral-400">
                      Dodaj nową obserwację tego zawodnika lub przypisz istniejącą z Twojego dziennika.
                    </p>

                    {/* NEW */}
                    <TabsContent value="new" className="mt-2 space-y-4">
                      <div>
                        <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-neutral-100">Mecz</div>
                        <div className="mb-3 text-xs text-dark dark:text-neutral-400">
                          Wpisz drużyny — pole „Mecz” składa się automatycznie.
                        </div>

                        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                          <div>
                            <Label>Drużyna A</Label>
                            <Input
                              value={qaMatch.split(/ *vs */i)[0] || ""}
                              onChange={(e) => {
                                const b = (qaMatch.split(/ *vs */i)[1] || "").trim();
                                const a = e.target.value;
                                setQaMatch(a && b ? `${a} vs ${b}` : (a + " " + b).trim());
                              }}
                              placeholder="np. Lech U19"
                              className="mt-1"
                            />
                          </div>
                          <div className="hidden select-none items-end justify-center pb-2 text-sm text-dark sm:flex">
                            vs
                          </div>
                          <div>
                            <Label>Drużyna B</Label>
                            <Input
                              value={(qaMatch.split(/ *vs */i)[1] || "").trim()}
                              onChange={(e) => {
                                const a = (qaMatch.split(/ *vs */i)[0] || "").trim();
                                const b = e.target.value;
                                setQaMatch(a && b ? `${a} vs ${b}` : (a + " " + b).trim());
                              }}
                              placeholder="np. Wisła U19"
                              className="mt-1"
                            />
                          </div>
                          <div className="sm:hidden text-center text-sm text-dark">vs</div>
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
                              onChange={(e) => setQaOpponentLevel(e.target.value)}
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
                                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60",
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
                                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60",
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
                                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60",
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
                                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60",
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

                        <div className="mt-4 text-xs text-dark dark:text-neutral-300 space-y-1">
                          <div>
                            Mecz: <span className="font-medium">{qaMatch || "—"}</span>
                            <span className="ml-2 inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                              {qaMode === "tv" ? "TV" : "Live"}
                            </span>
                          </div>
                          {qaOpponentLevel && (
                            <div className="text-[11px] text-slate-600 dark:text-neutral-400">
                              Poziom przeciwnika: <span className="font-medium">{qaOpponentLevel}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="sticky bottom-0 mt-1 -mx-4 border-t border-gray-200 bg-white/90 px-4 py-5 md:-mx-6 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            className="bg-gray-900 text-white hover:bg-gray-800"
                            onClick={addObservation}
                            disabled={!qaMatch.trim() || !qaDate.trim()}
                          >
                            Dodaj obserwację tego zawodnika
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    {/* EXISTING */}
                    <TabsContent value="existing" className="mt-2 space-y-3">
                      <div className="flex flex-col gap-2 rounded border border-gray-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
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
                          Wybierz obserwację z listy, aby podejrzeć szczegóły lub ją edytować.
                        </p>
                      </div>

                      <div className="max-h-80 overflow-auto rounded border border-gray-200 dark:border-neutral-700">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
                            <tr>
                              <th className="p-2 text-left font-medium">#</th>
                              <th className="p-2 text-left font-medium">Mecz</th>
                              <th className="p-2 text-left font-medium">Data</th>
                              <th className="p-2 text-left font-medium">Poziom</th>
                              <th className="p-2 text-left font-medium">Tryb</th>
                              <th className="p-2 text-left font-medium">Status</th>
                              <th className="p-2 text-right font-medium">Akcje</th>
                            </tr>
                          </thead>
                          <tbody>
                            {existingFiltered.map((o, idx) => (
                              <tr
                                key={o.id}
                                className={cn(
                                  "border-t border-gray-200 transition-colors hover:bg-stone-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
                                  idx % 2
                                    ? "bg-stone-100/40 dark:bg-neutral-900/30"
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
                                <td className="p-2">{[o.date || "—", o.time || ""].filter(Boolean).join(" ")}</td>
                                <td className="p-2 text-xs">
                                  {o.opponentLevel || <span className="text-slate-400">—</span>}
                                </td>
                                <td className="p-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                                      o.mode === "tv"
                                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                    )}
                                  >
                                    {o.mode === "tv" ? "TV" : "Live"}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                                      o.status === "final"
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                    )}
                                  >
                                    {o.status === "final" ? "Finalna" : "Szkic"}
                                  </span>
                                </td>
                                <td className="p-2 text-right">
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
                                </td>
                              </tr>
                            ))}
                            {existingFiltered.length === 0 && (
                              <tr>
                                <td colSpan={7} className="p-6 text-center text-sm text-dark dark:text-neutral-400">
                                  Brak obserwacji dla podanych kryteriów.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* EDIT MODAL */}
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edytuj obserwację</DialogTitle>
                      </DialogHeader>
                      {editingObs && (
                        <div className="space-y-3">
                          <div>
                            <Label>Mecz</Label>
                            <Input
                              value={editingObs.match || ""}
                              onChange={(e) =>
                                setEditingObs((prev) => prev ? { ...prev, match: e.target.value } : prev)
                              }
                              className="mt-1"
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <Label>Data</Label>
                              <Input
                                type="date"
                                value={editingObs.date || ""}
                                onChange={(e) =>
                                  setEditingObs((prev) => prev ? { ...prev, date: e.target.value } : prev)
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Godzina</Label>
                              <Input
                                type="time"
                                value={editingObs.time || ""}
                                onChange={(e) =>
                                  setEditingObs((prev) => prev ? { ...prev, time: e.target.value } : prev)
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Poziom przeciwnika</Label>
                              <Input
                                value={editingObs.opponentLevel || ""}
                                onChange={(e) =>
                                  setEditingObs((prev) => prev ? { ...prev, opponentLevel: e.target.value } : prev)
                                }
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <Label className="text-sm">Tryb</Label>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  type="button"
                                  variant={editingObs.mode === "live" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() =>
                                    setEditingObs((prev) => prev ? { ...prev, mode: "live" } : prev)
                                  }
                                >
                                  Live
                                </Button>
                                <Button
                                  type="button"
                                  variant={editingObs.mode === "tv" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() =>
                                    setEditingObs((prev) => prev ? { ...prev, mode: "tv" } : prev)
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
                                  variant={editingObs.status === "draft" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() =>
                                    setEditingObs((prev) => prev ? { ...prev, status: "draft" } : prev)
                                  }
                                >
                                  Szkic
                                </Button>
                                <Button
                                  type="button"
                                  variant={editingObs.status === "final" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() =>
                                    setEditingObs((prev) => prev ? { ...prev, status: "final" } : prev)
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
    </div>
  );
}
