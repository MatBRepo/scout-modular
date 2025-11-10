"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// REMOVED: Crumb
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
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Player } from "@/shared/types";
import {
  UserCheck,
  Search,
  Info,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import {
  loadMetrics,
  type MetricsConfig,
  type MetricGroupKey,
} from "@/shared/metrics";
import StarRating from "@/shared/ui/StarRating";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/* ----------------------------------------
   Position options (detailed)
----------------------------------------- */
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

const posByValue = (v?: DetailedPos) => POS_DATA.find((p) => p.value === v);

/* ----------------------------------------
   Countries (flags)
----------------------------------------- */
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

/* =====================================================================
   PAGE
===================================================================== */
export default function AddPlayerPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<"known" | "unknown" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs for autofocus / error scroll
  const knownFirstRef = useRef<HTMLInputElement | null>(null);
  const knownLastRef  = useRef<HTMLInputElement | null>(null);
  const unknownNumRef = useRef<HTMLInputElement | null>(null);
  const unknownClubRef = useRef<HTMLInputElement | null>(null);

  // ratings accordion open groups
  const [openAccordions, setOpenAccordions] = useState<string[]>(["base"]);

  // known
  const [known, setKnown] = useState({
    firstName: "",
    lastName: "",
    pos: "CM" as DetailedPos,
    age: "",
    club: "",
    birthDate: "",
    nationality: "", // country name
  });

  // unknown
  const [unknown, setUnknown] = useState({
    jerseyNumber: "",
    club: "",
    clubCountry: "", // country name
    pos: "CM" as DetailedPos,
    note: "",
  });

  // recommendation (unknown)
  const [recTarget, setRecTarget] = useState<string>("");
  const [recSummary, setRecSummary] = useState<string>(""); // html WYSIWYG

  // metrics
  const [mCfg, setMCfg] = useState<MetricsConfig>(loadMetrics());
  const [mBase, setMBase] = useState<Record<string, number>>({});
  const [mGK, setMGK] = useState<Record<string, number>>({});
  const [mDEF, setMDEF] = useState<Record<string, number>>({});
  const [mMID, setMMID] = useState<Record<string, number>>({});
  const [mATT, setMATT] = useState<Record<string, number>>({});

  // restore tile choice
  useEffect(() => {
    try {
      const saved = localStorage.getItem("s4s.addPlayer.choice");
      if (saved === "known" || saved === "unknown") setChoice(saved);
    } catch {}
  }, []);

  // persist choice
  useEffect(() => {
    if (choice) {
      try { localStorage.setItem("s4s.addPlayer.choice", choice); } catch {}
    }
  }, [choice]);

  // listen for metrics changes from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "s4s.obs.metrics") setMCfg(loadMetrics());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // auto-open rating groups for chosen detailed position
  useEffect(() => {
    const bucket = choice === "known" ? toBucket(known.pos) : choice === "unknown" ? toBucket(unknown.pos) : null;
    const groups = new Set<string>(["base"]);
    if (bucket === "GK") groups.add("gk");
    if (bucket === "DF") groups.add("def");
    if (bucket === "MF") groups.add("mid");
    if (bucket === "FW") groups.add("att");
    setOpenAccordions(Array.from(groups));
  }, [choice, known.pos, unknown.pos]);

  // autofocus when entering step 2
  useEffect(() => {
    if (step !== 2) return;
    const t = setTimeout(() => {
      if (choice === "known") knownFirstRef.current?.focus();
      if (choice === "unknown") unknownNumRef.current?.focus();
    }, 10);
    return () => clearTimeout(t);
  }, [step, choice]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (step === 1) {
        if (e.key === "Enter" && choice) {
          e.preventDefault();
          if (validateStep1()) setStep(2);
        }
      } else if (step === 2) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
          e.preventDefault();
          if (validateStep2()) save();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setStep(1);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, choice, known, unknown]);

  /* validation */
  function validateStep1() {
    if (!choice) {
      setErrors({ choice: "Wybierz jedną z opcji." });
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep2() {
    const next: Record<string, string> = {};
    if (choice === "known") {
      if (!known.firstName.trim()) next["known.firstName"] = "Imię jest wymagane.";
      if (!known.lastName.trim()) next["known.lastName"] = "Nazwisko jest wymagane.";
    } else {
      if (!unknown.jerseyNumber.trim()) next["unknown.jerseyNumber"] = "Podaj numer na koszulce.";
      if (!unknown.club.trim()) next["unknown.club"] = "Podaj aktualny klub.";
      if (!unknown.clubCountry.trim()) next["unknown.clubCountry"] = "Wybierz kraj aktualnego klubu.";
    }
    setErrors(next);

    // scroll to first error
    const keys = Object.keys(next);
    if (keys.length) {
      const k = keys[0];
      if (k === "known.firstName") knownFirstRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (k === "known.lastName")  knownLastRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (k === "unknown.jerseyNumber") unknownNumRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (k === "unknown.club") unknownClubRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return keys.length === 0;
  }

  /* save */
  const routerRef = useRef(router);
  function save() {
    const id = Date.now();
    let newPlayer: Player;

    if (choice === "known") {
      const name = `${known.firstName.trim()} ${known.lastName.trim()}`.trim() || "Bez nazwy";
      newPlayer = {
        id,
        name,
        pos: toBucket(known.pos) as unknown as Player["pos"],
        club: known.club.trim(),
        age: known.age ? parseInt(known.age, 10) || 0 : 0,
        status: "active",
        firstName: known.firstName.trim() || undefined,
        lastName: known.lastName.trim() || undefined,
        birthDate: known.birthDate || undefined,
        nationality: known.nationality || undefined,
      };
      (newPlayer as any).meta = {
        ...(newPlayer as any).meta,
        metricsRatings: packRatings(),
        detailedPos: known.pos,
      };
    } else {
      const labelName = `#${unknown.jerseyNumber.trim()}`;
      newPlayer = {
        id,
        name: labelName || "Szkic zawodnika",
        pos: toBucket(unknown.pos) as unknown as Player["pos"],
        club: unknown.club.trim(),
        age: 0,
        status: "active",
      };
      (newPlayer as any).meta = {
        jerseyNumber: unknown.jerseyNumber || undefined,
        clubCountry: unknown.clubCountry || undefined,
        note: unknown.note || undefined,
        detailedPos: unknown.pos,
        metricsRatings: packRatings(),
        recommendation: {
          targetLevel: recTarget,
          summary: recSummary,
        },
      };
    }

    try {
      const raw = localStorage.getItem("s4s.players");
      const arr: Player[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem("s4s.players", JSON.stringify([newPlayer, ...arr]));
    } catch {}

    routerRef.current.push(`/players/${id}`);
  }

  function packRatings() {
    const out: Record<MetricGroupKey, Record<string, number>> = {
      BASE: { ...mBase },
      GK: { ...mGK },
      DEF: { ...mDEF },
      MID: { ...mMID },
      ATT: { ...mATT },
    };
    return out;
  }

  /* UI */
  return (
    <div className="w-full">
      {/* REMOVED Crumb */}
      <Toolbar title="Dodaj zawodnika" />

      {/* STEP 1 — clean tiles with very subtle gradients; colors only on borders & icons */}
      {step === 1 && (
        <div className="max-w space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Known */}
            <button
              onClick={() => {
                setChoice("known");
                setErrors({});
              }}
              className={cn(
                "group w-full rounded p-6 sm:p-7 text-left shadow-sm transition bg-white dark:bg-neutral-950",
                "ring-1",
                choice === "known"
                  ? "ring-blue-500"
                  : "ring-gray-200 hover:ring-blue-400 dark:ring-neutral-800 dark:hover:ring-blue-500/60",
                // ultra-subtle radial gradient accent (top-left) without filling the tile with color
                "bg-[radial-gradient(30rem_30rem_at_0%_0%,theme(colors.blue.500)/6%,transparent_60%)]"
              )}
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded bg-transparent">
                  <UserCheck className={cn("h-12 w-12", choice === "known" ? "text-blue-600" : "text-blue-500")} />
                </span>
                <div className="min-w-0">
                  <div className="mb-1 text-base font-semibold">Znam zawodnika</div>
                  <div className="text-sm text-muted-foreground">
                    Podaj imię i nazwisko – resztę uzupełnisz później w profilu.
                  </div>
                </div>
              </div>
            </button>

            {/* Unknown */}
            <button
              onClick={() => {
                setChoice("unknown");
                setErrors({});
              }}
              className={cn(
                "group w-full rounded p-6 sm:p-7 text-left shadow-sm transition bg-white dark:bg-neutral-950",
                "ring-1",
                choice === "unknown"
                  ? "ring-emerald-500"
                  : "ring-gray-200 hover:ring-emerald-400 dark:ring-neutral-800 dark:hover:ring-emerald-500/60",
                "bg-[radial-gradient(30rem_30rem_at_100%_0%,theme(colors.emerald.500)/6%,transparent_60%)]"
              )}
            >
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded bg-transparent">
                  <Search className={cn("h-12 w-12", choice === "unknown" ? "text-emerald-600" : "text-emerald-500")} />
                </span>
                <div className="min-w-0">
                  <div className="mb-1 text-base font-semibold">Nie znam zawodnika</div>
                  <div className="text-sm text-muted-foreground">
                    Zapisz numer na koszulce, klub i kraj klubu + krótką notatkę.
                  </div>
                </div>
              </div>
            </button>
          </div>

          {errors["choice"] && <p className="text-xs text-red-600">{errors["choice"]}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => history.back()}
              className="border-gray-300 dark:border-neutral-700"
            >
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

      {/* STEP 2 — KNOWN */}
      {step === 2 && choice === "known" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Podstawowe dane</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    Imię <span className="text-red-600">*</span>
                  </Label>
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
                  <Label>
                    Nazwisko <span className="text-red-600">*</span>
                  </Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 lg:col-span-1">
                  <Label>Kategoria pozycji</Label>
                  <Select value={known.pos} onValueChange={(v) => setKnown((d) => ({ ...d, pos: v as DetailedPos }))}>
                    <SelectTrigger className="w-full justify-start border-gray-300 dark:border-neutral-700 dark:bg-neutral-950 [&>svg]:ml-auto">
                      <SelectValue placeholder="Wybierz pozycję" />
                    </SelectTrigger>
                    <SelectContent>
                      {POS_DATA.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="text-left">
                            <div className="font-medium">
                              {opt.code}: {opt.name}
                            </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Klub</Label>
                  <Input value={known.club} onChange={(e) => setKnown((d) => ({ ...d, club: e.target.value }))} className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                </div>
                <div>
                  <Label>Narodowość</Label>
                  <CountryCombobox value={known.nationality} onChange={(val) => setKnown((d) => ({ ...d, nationality: val }))} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="border-gray-300 dark:border-neutral-700">
                  Wstecz
                </Button>
                <Button className="ml-auto bg-gray-900 text-white hover:bg-gray-800" onClick={() => (validateStep2() ? save() : null)}>
                  Zapisz
                </Button>
              </div>
            </CardContent>
          </Card>

          <RatingsCard
            title="Ocena skauta (1–6)"
            pos={toBucket(known.pos)}
            config={mCfg}
            ratings={{ BASE: mBase, GK: mGK, DEF: mDEF, MID: mMID, ATT: mATT }}
            setByGroup={{ setBASE: setMBase, setGK: setMGK, setDEF: setMDEF, setMID: setMMID, setATT: setMATT }}
            open={openAccordions}
            onOpenChange={setOpenAccordions}
          />
        </div>
      )}

      {/* STEP 2 — UNKNOWN */}
      {step === 2 && choice === "unknown" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Szkic zawodnika (nie znany)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    Numer na koszulce <span className="text-red-600">*</span>
                  </Label>
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
                            <div className="font-medium">
                              {opt.code}: {opt.name}
                            </div>
                            <div className="text-xs text-muted-foreground">{opt.desc}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    Aktualny klub <span className="text-red-600">*</span>
                  </Label>
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
                  <Label>
                    Kraj aktualnego klubu <span className="text-red-600">*</span>
                  </Label>
                  <CountryCombobox
                    value={unknown.clubCountry}
                    onChange={(val) => setUnknown((d) => ({ ...d, clubCountry: val }))}
                    error={errors["unknown.clubCountry"]}
                  />
                </div>
              </div>

              <div>
                <Label>Notatka własna (opcjonalne)</Label>
                <Input
                  value={unknown.note}
                  onChange={(e) => setUnknown((d) => ({ ...d, note: e.target.value }))}
                  placeholder="Krótka notatka…"
                  className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>

              <div className="mt-2 rounded border border-dashed border-gray-300 p-4 dark:border-neutral-800">
                <div className="mb-2 text-xs font-medium text-dark dark:text-neutral-400">Podgląd koszulki</div>
                <div className="flex items-center justify-center">
                  <JerseyPreview number={unknown.jerseyNumber} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="border-gray-300 dark:border-neutral-700">
                  Wstecz
                </Button>
                <Button className="ml-auto bg-gray-900 text-white hover:bg-gray-800" onClick={() => (validateStep2() ? save() : null)}>
                  Zapisz
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <RatingsCard
              title="Ocena skauta (1–6)"
              pos={toBucket(unknown.pos)}
              config={mCfg}
              ratings={{ BASE: mBase, GK: mGK, DEF: mDEF, MID: mMID, ATT: mATT }}
              setByGroup={{ setBASE: setMBase, setGK: setMGK, setDEF: setMDEF, setMID: setMMID, setATT: setMATT }}
              open={openAccordions}
              onOpenChange={setOpenAccordions}
            />
            <Card>
              <CardHeader>
                <CardTitle>Potencjał, ryzyka, rekomendacja</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------
   Ratings Card
----------------------------------------- */
function RatingsCard({
  title,
  pos,
  config,
  ratings,
  setByGroup,
  open,
  onOpenChange,
}: {
  title: string;
  pos: BucketPos;
  config: MetricsConfig;
  ratings: {
    BASE: Record<string, number>;
    GK: Record<string, number>;
    DEF: Record<string, number>;
    MID: Record<string, number>;
    ATT: Record<string, number>;
  };
  setByGroup: {
    setBASE: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setGK: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setDEF: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setMID: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setATT: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  };
  open: string[];
  onOpenChange: (v: string[]) => void;
}) {
  const { BASE, GK, DEF, MID, ATT } = ratings;
  const { setBASE, setGK, setDEF, setMID, setATT } = setByGroup;

  const showGK = pos === "GK";
  const showDEF = pos === "DF";
  const showMID = pos === "MF";
  const showATT = pos === "FW";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{title}</span>
          <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            <Info className="h-3.5 w-3.5" />
            Skala: 1–6 • Etykiety edytujesz w „Zarządzanie → Metryki”
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Accordion
          type="multiple"
          className="w-full"
          value={open}
          onValueChange={(v) => onOpenChange(v as string[])}
        >
          <AccordionItem value="base">
            <AccordionTrigger>Kategorie bazowe</AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {config.BASE.filter((m) => m.enabled).map((m) => (
                <RatingRow key={m.id} label={m.label} value={BASE[m.key] ?? 0} onChange={(v) => setBASE((s) => ({ ...s, [m.key]: v }))} />
              ))}
            </AccordionContent>
          </AccordionItem>

          {showGK && (
            <AccordionItem value="gk">
              <AccordionTrigger>Bramkarz (GK)</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {config.GK.filter((m) => m.enabled).map((m) => (
                  <RatingRow key={m.id} label={m.label} value={GK[m.key] ?? 0} onChange={(v) => setGK((s) => ({ ...s, [m.key]: v }))} />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {showDEF && (
            <AccordionItem value="def">
              <AccordionTrigger>Obrońca</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {config.DEF.filter((m) => m.enabled).map((m) => (
                  <RatingRow key={m.id} label={m.label} value={DEF[m.key] ?? 0} onChange={(v) => setDEF((s) => ({ ...s, [m.key]: v }))} />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {showMID && (
            <AccordionItem value="mid">
              <AccordionTrigger>Pomocnik</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {config.MID.filter((m) => m.enabled).map((m) => (
                  <RatingRow key={m.id} label={m.label} value={MID[m.key] ?? 0} onChange={(v) => setMID((s) => ({ ...s, [m.key]: v }))} />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {showATT && (
            <AccordionItem value="att">
              <AccordionTrigger>Napastnik</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {config.ATT.filter((m) => m.enabled).map((m) => (
                  <RatingRow key={m.id} label={m.label} value={ATT[m.key] ?? 0} onChange={(v) => setATT((s) => ({ ...s, [m.key]: v }))} />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------
   Small reusable
----------------------------------------- */
function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 dark:border-neutral-800">
      <div className="min-w-0 text-sm">{label}</div>
      <StarRating value={value} onChange={onChange} max={6} />
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

/* ----------------------------------------
   RichTextEditor – lightweight WYSIWYG
----------------------------------------- */
function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  function exec(cmd: string, arg?: string) {
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function onInput() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

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
        [contenteditable]:focus {
          outline: none;
        }
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

/* ----------------------------------------
   CountryCombobox – flags + search
----------------------------------------- */
function CountryCombobox({
  value,
  onChange,
  error,
}: {
  value: string; // country name
  onChange: (next: string) => void;
  error?: string;
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
              "flex w-full items-center justify-between rounded border bg-white px-3 py-2 text-left text-sm dark:bg-neutral-950",
              error ? "border-red-500" : "border-gray-300 dark:border-neutral-700"
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
                      onSelect={() => {
                        onChange(c.name); // zmień na c.code jeśli wolisz ISO
                        setOpen(false);
                      }}
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
