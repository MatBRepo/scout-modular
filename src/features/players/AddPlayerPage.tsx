// src/app/(players)/players/add/AddPlayerPage.tsx
"use client";
import { useEffect, useRef, useState } from "react";
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
import type { Player } from "@/shared/types";
import {
  Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon,
  Undo, Redo, ChevronsUpDown, Check, Loader2, CheckCircle2, ChevronDown
} from "lucide-react";
import {
  loadMetrics,
  type MetricsConfig,
} from "@/shared/metrics";
import StarRating from "@/shared/ui/StarRating";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { KnownPlayerIcon, UnknownPlayerIcon } from "@/components/icons";

/* ===== Save pill (autosave indicator) ===== */
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

/* =====================================================================
   PAGE
===================================================================== */
export default function AddPlayerPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<"known" | "unknown" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // AUTOSAVE
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DRAFT_KEY = "s4s.addPlayer.draft";

  // Accordions (STEP 2): Podstawowe dane OPEN by default, Ocena closed
  const [basicOpen, setBasicOpen] = useState(true);
  const [gradeOpen, setGradeOpen] = useState(false);

  // Refs for autofocus
  const knownFirstRef = useRef<HTMLInputElement | null>(null);
  const knownLastRef  = useRef<HTMLInputElement | null>(null);
  const unknownNumRef = useRef<HTMLInputElement | null>(null);
  const unknownClubRef = useRef<HTMLInputElement | null>(null);

  // known
  const [known, setKnown] = useState({
    firstName: "",
    lastName: "",
    pos: "CM" as DetailedPos,
    age: "",
    club: "",
    birthDate: "",
    nationality: "",
  });

  // unknown
  const [unknown, setUnknown] = useState({
    jerseyNumber: "",
    club: "",
    clubCountry: "",
    pos: "CM" as DetailedPos,
    note: "",
  });

  // recommendation (unknown)
  const [recTarget, setRecTarget] = useState<string>("");
  const [recSummary, setRecSummary] = useState<string>("");

  // metrics (scale 1–5)
  const [mCfg, setMCfg] = useState<MetricsConfig>(loadMetrics());
  const [mBase, setMBase] = useState<Record<string, number>>({});
  const [mGK, setMGK] = useState<Record<string, number>>({});
  const [mDEF, setMDEF] = useState<Record<string, number>>({});
  const [mMID, setMMID] = useState<Record<string, number>>({});
  const [mATT, setMATT] = useState<Record<string, number>>({});

  /* restore tile choice */
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

  /* listen for metrics changes */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "s4s.obs.metrics") setMCfg(loadMetrics());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* autofocus when entering step 2 */
  useEffect(() => {
    if (step !== 2) return;
    const t = setTimeout(() => {
      if (choice === "known") knownFirstRef.current?.focus();
      if (choice === "unknown") unknownNumRef.current?.focus();
    }, 10);
    return () => clearTimeout(t);
  }, [step, choice]);

  /* autosave (debounced) */
  function writeDraft() {
    if (step !== 2) return;
    const draft = {
      ts: Date.now(),
      choice,
      known,
      unknown,
      recTarget,
      recSummary,
      ratings: { BASE: mBase, GK: mGK, DEF: mDEF, MID: mMID, ATT: mATT },
      posBucket: choice === "known" ? toBucket(known.pos) : choice === "unknown" ? toBucket(unknown.pos) : null,
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }
  useEffect(() => {
    if (step !== 2) return;
    setSaveStatus("saving");
    writeDraft();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step, choice,
    known.firstName, known.lastName, known.pos, known.age, known.club, known.birthDate, known.nationality,
    unknown.jerseyNumber, unknown.club, unknown.clubCountry, unknown.pos, unknown.note,
    recTarget, recSummary,
    mBase, mGK, mDEF, mMID, mATT,
  ]);

  /* validate step-1 */
  function validateStep1() {
    if (!choice) {
      setErrors({ choice: "Wybierz jedną z opcji." });
      return false;
    }
    setErrors({});
    return true;
  }

  /* derived flags */
  const bucket: BucketPos | null =
    choice === "known" ? toBucket(known.pos) :
    choice === "unknown" ? toBucket(unknown.pos) : null;

  /* ========================================= Render ========================================= */
  return (
    <div className="w-full">
      <Toolbar
        title="Dodaj zawodnika"
        right={
          step === 2 ? (
            <div className="mb-4 flex items-center gap-2">
              <SavePill state={saveStatus} />
              <Button
                className="h-10 bg-gray-900 text-white hover:bg-gray-800"
                onClick={() => {
                  setErrors({});
                  setStep(1); // back to choice
                  setBasicOpen(true);   // keep default open when returning later
                  setGradeOpen(false);
                }}
              >
                Wróć do wyboru
              </Button>
            </div>
          ) : null
        }
      />

      {/* STEP 1 — two tiles side-by-side (50/50) on ≥sm */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Known */}
            <button
              onClick={() => { setChoice("known"); setErrors({}); }}
              className={cn(
                "w-full rounded p-6 text-left shadow-sm transition bg-white dark:bg-neutral-950 ring-1",
                choice === "known"
                  ? "ring-green-800"
                  : "ring-gray-200 hover:ring-green-600/70 dark:ring-neutral-800 dark:hover:ring-green-600/50",
              )}
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded bg-transparent">
                  <KnownPlayerIcon
                    className={cn(
                      "h-10 w-10",
                      choice === "known" ? "text-green-900" : "text-black dark:text-neutral-100"
                    )}
                    strokeWidth={1.0}
                  />
                </span>
                <div className="min-w-0">
                  <div className={cn("mb-1 text-base font-semibold", choice === "known" ? "text-green-900" : "text-black dark:text-neutral-100")}>
                    Znam zawodnika
                  </div>
                  <div className={cn("text-sm", choice === "known" ? "text-green-900/80" : "text-black/70 dark:text-neutral-300")}>
                    Podaj imię i nazwisko – resztę uzupełnisz później w profilu.
                  </div>
                </div>
              </div>
            </button>

            {/* Unknown */}
            <button
              onClick={() => { setChoice("unknown"); setErrors({}); }}
              className={cn(
                "w-full rounded p-6 text-left shadow-sm transition bg-white dark:bg-neutral-950 ring-1",
                choice === "unknown"
                  ? "ring-red-800"
                  : "ring-gray-200 hover:ring-red-600/70 dark:ring-neutral-800 dark:hover:ring-red-600/50",
              )}
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded bg-transparent">
                  <UnknownPlayerIcon
                    className={cn(
                      "h-10 w-10",
                      choice === "unknown" ? "text-red-900" : "text-black dark:text-neutral-100"
                    )}
                    strokeWidth={1.0}
                  />
                </span>
                <div className="min-w-0">
                  <div className={cn("mb-1 text-base font-semibold", choice === "unknown" ? "text-red-900" : "text-black dark:text-neutral-100")}>
                    Nie znam zawodnika
                  </div>
                  <div className={cn("text-sm", choice === "unknown" ? "text-red-900/80" : "text-black/70 dark:text-neutral-300")}>
                    Zapisz numer na koszulce, klub i kraj klubu + krótką notatkę.
                  </div>
                </div>
              </div>
            </button>
          </div>

          {errors["choice"] && <p className="text-xs text-red-600">{errors["choice"]}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => history.back()} className="border-gray-300 dark:border-neutral-700">
              Anuluj
            </Button>
            <Button
              className="ml-auto bg-gray-900 text-white hover:bg-gray-800"
              onClick={() => (validateStep1() ? setStep(2) : null)}
            >
              Dalej
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — two accordions; headings with requested typography + chevron */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Podstawowe dane (OPEN by default) */}
          <Card className="w-full">
            <CardHeader className="p-0">
              <button
                type="button"
                aria-expanded={basicOpen}
                aria-controls="basic-panel"
                onClick={() => setBasicOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-t-lg px-4 py-4 text-left"
              >
                <span className="text-xl font-semibold leading-none tracking-tight">Podstawowe dane</span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", basicOpen ? "rotate-180" : "rotate-0")} />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              <Accordion type="single" collapsible value={basicOpen ? "basic" : undefined} onValueChange={(v) => setBasicOpen(v === "basic")} className="w-full">
                <AccordionItem value="basic" className="border-0">
                  <AccordionContent id="basic-panel" className="px-6 pb-6 pt-2">
                    {choice === "known" ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label>Imię <span className="text-red-600">*</span></Label>
                            <Input
                              ref={knownFirstRef}
                              value={known.firstName}
                              onChange={(e) => setKnown((d) => ({ ...d, firstName: e.target.value }))}
                              aria-invalid={!!errors["known.firstName"]}
                              className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                            {errors["known.firstName"] && <p className="text-xs text-red-600">{errors["known.firstName"]}</p>}
                          </div>
                          <div>
                            <Label>Nazwisko <span className="text-red-600">*</span></Label>
                            <Input
                              ref={knownLastRef}
                              value={known.lastName}
                              onChange={(e) => setKnown((d) => ({ ...d, lastName: e.target.value }))}
                              aria-invalid={!!errors["known.lastName"]}
                              className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                            {errors["known.lastName"] && <p className="text-xs text-red-600">{errors["known.lastName"]}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label>Kategoria pozycji</Label>
                            <Select value={known.pos} onValueChange={(v) => setKnown((d) => ({ ...d, pos: v as DetailedPos }))}>
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
                          </div>
                          <div>
                            <Label>Wiek (opcjonalnie)</Label>
                            <Input
                              type="number"
                              value={known.age}
                              onChange={(e) => setKnown((d) => ({ ...d, age: e.target.value }))}
                              className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label>Klub</Label>
                            <Input value={known.club} onChange={(e) => setKnown((d) => ({ ...d, club: e.target.value }))} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                          </div>
                          <div>
                            <Label>Narodowość</Label>
                            <CountryCombobox value={known.nationality} onChange={(val) => setKnown((d) => ({ ...d, nationality: val }))} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label>Numer na koszulce <span className="text-red-600">*</span></Label>
                            <Input
                              ref={unknownNumRef}
                              value={unknown.jerseyNumber}
                              onChange={(e) => setUnknown((d) => ({ ...d, jerseyNumber: e.target.value }))}
                              aria-invalid={!!errors["unknown.jerseyNumber"]}
                              placeholder="np. 27"
                              className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                            {errors["unknown.jerseyNumber"] && <p className="text-xs text-red-600">{errors["unknown.jerseyNumber"]}</p>}
                          </div>
                          <div>
                            <Label>Kategoria pozycji</Label>
                            <Select value={unknown.pos} onValueChange={(v) => setUnknown((d) => ({ ...d, pos: v as DetailedPos }))}>
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
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label>Aktualny klub <span className="text-red-600">*</span></Label>
                            <Input
                              ref={unknownClubRef}
                              value={unknown.club}
                              onChange={(e) => setUnknown((d) => ({ ...d, club: e.target.value }))}
                              aria-invalid={!!errors["unknown.club"]}
                              className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                            {errors["unknown.club"] && <p className="text-xs text-red-600">{errors["unknown.club"]}</p>}
                          </div>
                          <div>
                            <Label>Kraj aktualnego klubu <span className="text-red-600">*</span></Label>
                            <CountryCombobox
                              value={unknown.clubCountry}
                              onChange={(val) => setUnknown((d) => ({ ...d, clubCountry: val }))}
                              error={errors["unknown.clubCountry"]}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label>Notatka własna (opcjonalne)</Label>
                            <Input
                              value={unknown.note}
                              onChange={(e) => setUnknown((d) => ({ ...d, note: e.target.value }))}
                              placeholder="Krótka notatka…"
                              className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div className="rounded border border-dashed border-gray-300 p-4 dark:border-neutral-800">
                            <div className="mb-2 text-xs font-medium text-dark dark:text-neutral-400">Podgląd koszulki</div>
                            <div className="flex items-center justify-center">
                              <JerseyPreview number={unknown.jerseyNumber} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Ocena skauta (1–5) */}
          <Card className="w-full">
            <CardHeader className="p-0">
              <button
                type="button"
                aria-expanded={gradeOpen}
                aria-controls="grade-panel"
                onClick={() => setGradeOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-t-lg px-4 py-4 text-left"
              >
                <span className="text-xl font-semibold leading-none tracking-tight">Ocena skauta (1–5)</span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", gradeOpen ? "rotate-180" : "rotate-0")} />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              <Accordion type="single" collapsible value={gradeOpen ? "grade" : undefined} onValueChange={(v) => setGradeOpen(v === "grade")} className="w-full">
                <AccordionItem value="grade" className="border-0">
                  <AccordionContent id="grade-panel" className="px-6 pb-6 pt-2">
                    {/* No nested accordions – ONLY headers + rows */}
                    <SectionHeader>Kategorie bazowe</SectionHeader>
                    <div className="grid grid-cols-1 gap-2">
                      {mCfg.BASE.filter((m) => m.enabled).map((m) => (
                        <RatingRow key={m.id} label={m.label} value={mBase[m.key] ?? 0} onChange={(v) => setMBase((s) => ({ ...s, [m.key]: v }))} />
                      ))}
                    </div>

                    {bucket === "GK" && (
                      <>
                        <SectionHeader>Bramkarz</SectionHeader>
                        <div className="grid grid-cols-1 gap-2">
                          {mCfg.GK.filter((m) => m.enabled).map((m) => (
                            <RatingRow key={m.id} label={m.label} value={mGK[m.key] ?? 0} onChange={(v) => setMGK((s) => ({ ...s, [m.key]: v }))} />
                          ))}
                        </div>
                      </>
                    )}

                    {bucket === "DF" && (
                      <>
                        <SectionHeader>Obrońca</SectionHeader>
                        <div className="grid grid-cols-1 gap-2">
                          {mCfg.DEF.filter((m) => m.enabled).map((m) => (
                            <RatingRow key={m.id} label={m.label} value={mDEF[m.key] ?? 0} onChange={(v) => setMDEF((s) => ({ ...s, [m.key]: v }))} />
                          ))}
                        </div>
                      </>
                    )}

                    {bucket === "MF" && (
                      <>
                        <SectionHeader>Pomocnik</SectionHeader>
                        <div className="grid grid-cols-1 gap-2">
                          {mCfg.MID.filter((m) => m.enabled).map((m) => (
                            <RatingRow key={m.id} label={m.label} value={mMID[m.key] ?? 0} onChange={(v) => setMMID((s) => ({ ...s, [m.key]: v }))} />
                          ))}
                        </div>
                      </>
                    )}

                    {bucket === "FW" && (
                      <>
                        <SectionHeader>Napastnik</SectionHeader>
                        <div className="grid grid-cols-1 gap-2">
                          {mCfg.ATT.filter((m) => m.enabled).map((m) => (
                            <RatingRow key={m.id} label={m.label} value={mATT[m.key] ?? 0} onChange={(v) => setMATT((s) => ({ ...s, [m.key]: v }))} />
                          ))}
                        </div>
                      </>
                    )}

                    {choice === "unknown" && (
                      <>
                        <SectionHeader>Potencjał, ryzyka, rekomendacja</SectionHeader>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <Label>Poziom docelowy gdzie mógłby grać zawodnik</Label>
                            <Input
                              value={recTarget}
                              onChange={(e) => setRecTarget(e.target.value)}
                              placeholder="np. Ekstraklasa / 2. Bundesliga…"
                              className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <Label>Podsumowanie z własnym opisem</Label>
                            <RichTextEditor value={recSummary} onChange={setRecSummary} placeholder="Krótka rekomendacja / opis…" />
                          </div>
                        </div>
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ===== Small UI ===== */
function SectionHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  // Add mb-3 and mt-6 as requested, keep style defaults
  return <div className={cn("text-sm font-medium text-muted-foreground mt-6 mb-3", className)}>{children}</div>;
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void; }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 dark:border-neutral-800">
      <div className="min-w-0 text-sm">{label}</div>
      {/* Scale 1–5 */}
      <StarRating value={value} onChange={onChange} max={5} />
    </div>
  );
}

function JerseyPreview({ number }: { number: string }) {
  const n = (number || "").trim().slice(0, 3) || "—";
  return (
    <div className="relative mx-auto h-[220px] w-[220px] sm:h-[280px] sm:w-[280px]">
      <svg className="h-full w-full text-gray-800 dark:text-neutral-200" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M13.5867 2.30659L10.6667 1.33325C10.6667 2.0405 10.3857 2.71877 9.88565 3.21887C9.38555 3.71897 8.70727 3.99992 8.00003 3.99992C7.29278 3.99992 6.61451 3.71897 6.11441 3.21887C5.61431 2.71877 5.33336 2.0405 5.33336 1.33325L2.41336 2.30659C2.11162 2.40711 1.85575 2.6122 1.69193 2.88481C1.52811 3.15743 1.46715 3.47963 1.52003 3.79325L1.90669 6.10659C1.93208 6.26319 2.01248 6.40562 2.13345 6.50826C2.25443 6.61091 2.40804 6.66704 2.56669 6.66659H4.00003V13.3333C4.00003 14.0666 4.60003 14.6666 5.33336 14.6666H10.6667C11.0203 14.6666 11.3595 14.5261 11.6095 14.2761C11.8596 14.026 12 13.6869 12 13.3333V6.66659H13.4334C13.592 6.66704 13.7456 6.61091 13.8666 6.50826C13.9876 6.40562 14.068 6.26319 14.0934 6.10659L14.48 3.79325C14.5329 3.47963 14.4719 3.15743 14.3081 2.88481C14.1443 2.6122 13.8884 2.40711 13.5867 2.30659Z"
          stroke="currentColor"
          strokeWidth="0.33333"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="select-none text-6xl font-extrabold leading-none text-gray-900 dark:text-neutral-100">{n}</span>
      </div>
    </div>
  );
}

/* ===== RichTextEditor ===== */
function RichTextEditor({
  value, onChange, placeholder,
}: { value: string; onChange: (html: string) => void; placeholder?: string; }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, [value]);
  function exec(cmd: string, arg?: string) {
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }
  function onInput() { if (ref.current) onChange(ref.current.innerHTML); }
  function createLink() {
    const url = prompt("Wklej adres URL:");
    if (url) exec("createLink", url);
  }
  return (
    <div className="rounded border border-gray-300 dark:border-neutral-700">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 p-1 dark:border-neutral-800">
        <TButton title="Pogrubienie" onClick={() => exec("bold")} icon={<Bold className="h-4 w-4" />} />
        <TButton title="Kursywa" onClick={() => exec("italic")} icon={<Italic className="h-4 w-4" />} />
        <TButton title="Podkreślenie" onClick={() => exec("underline")} icon={<Underline className="h-4 w-4" />} />
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-neutral-800" />
        <TButton title="Lista punktowana" onClick={() => exec("insertUnorderedList")} icon={<List className="h-4 w-4" />} />
        <TButton title="Lista numerowana" onClick={() => exec("insertOrderedList")} icon={<ListOrdered className="h-4 w-4" />} />
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-neutral-800" />
        <TButton title="Wstaw link" onClick={createLink} icon={<LinkIcon className="h-4 w-4" />} />
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-neutral-800" />
        <TButton title="Cofnij" onClick={() => exec("undo")} icon={<Undo className="h-4 w-4" />} />
        <TButton title="Ponów" onClick={() => exec("redo")} icon={<Redo className="h-4 w-4" />} />
      </div>
      <div
        ref={ref}
        className="min-h[120px] w-full bg-white p-3 text-sm outline-none dark:bg-neutral-950"
        contentEditable
        onInput={onInput}
        data-placeholder={placeholder || ""}
        suppressContentEditableWarning
      />
      <style jsx>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable]:focus { outline: none; }
      `}</style>
    </div>
  );
}
function TButton({ onClick, icon, title }: { onClick: () => void; icon: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-8 items-center justify-center rounded px-2 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
    >
      {icon}
    </button>
  );
}

/* ===== Country combobox ===== */
function CountryCombobox({
  value, onChange, error,
}: { value: string; onChange: (next: string) => void; error?: string }) {
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
              "flex w-full items-center justify-between rounded border bg-white px-3 py-2 text-left text-sm dark:bg-neutral-950",
              error ? "border-red-500" : "border-gray-300 dark:border-neutral-700"
            )}
          >
            <span className={cn("flex min-w-0 items-center gap-2", !selected && "text-muted-foreground")}>
              {selected ? (<><span className="text-base leading-none">{selected.flag}</span><span className="truncate">{selected.name}</span></>) : ("Wybierz kraj")}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
