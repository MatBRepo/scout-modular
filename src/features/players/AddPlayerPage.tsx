"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
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
import { User2, Shirt, Info } from "lucide-react";

import {
  loadMetrics,
  type MetricsConfig,
  type MetricGroupKey,
} from "@/shared/metrics";

import StarRating from "@/shared/ui/StarRating";

/* ----------------------------------------
   Types
----------------------------------------- */
type Pos = Player["pos"]; // "GK" | "DF" | "MF" | "FW"

/* =======================================
   Page
======================================= */
export default function AddPlayerPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<"known" | "unknown" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---- Znam zawodnika ----
  const [known, setKnown] = useState({
    firstName: "",
    lastName: "",
    pos: "MF" as Pos, // kategoria do tabeli (4-bucket)
    age: "",
    club: "",
    birthDate: "",
    nationality: "",
  });

  // ---- Nie znam zawodnika ----
  const [unknown, setUnknown] = useState({
    jerseyNumber: "", // wymagane dla „nie znany”
    club: "",         // aktualny klub
    clubCountry: "",  // kraj aktualnego klubu
    note: "",         // notatka własna (opcjonalna)
    pos: "MF" as Pos, // kategoria pozycji (dla warunkowych metryk)
  });

  /* ================= Metrics config & ratings ================= */
  const [mCfg, setMCfg] = useState<MetricsConfig>(loadMetrics());

  // Ratings (stored under meta.metricsRatings => group -> key -> 1..6)
  const [mBase, setMBase] = useState<Record<string, number>>({});
  const [mGK, setMGK] = useState<Record<string, number>>({});
  const [mDEF, setMDEF] = useState<Record<string, number>>({});
  const [mMID, setMMID] = useState<Record<string, number>>({});
  const [mATT, setMATT] = useState<Record<string, number>>({});

  // Sync with changes from “Zarządzanie”
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "s4s.obs.metrics") setMCfg(loadMetrics());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ================= Validation ================= */
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
      // unknown flow
      if (!unknown.jerseyNumber.trim()) next["unknown.jerseyNumber"] = "Podaj numer na koszulce.";
      if (!unknown.club.trim()) next["unknown.club"] = "Podaj aktualny klub.";
      if (!unknown.clubCountry.trim()) next["unknown.clubCountry"] = "Podaj kraj aktualnego klubu.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /* ================= Save ================= */
  function save() {
    const id = Date.now();
    let newPlayer: Player;

    if (choice === "known") {
      const name =
        `${known.firstName.trim()} ${known.lastName.trim()}`.trim() || "Bez nazwy";
      newPlayer = {
        id,
        name,
        pos: known.pos,
        club: known.club.trim(),
        age: known.age ? parseInt(known.age, 10) || 0 : 0,
        status: "active",
        firstName: known.firstName.trim() || undefined,
        lastName: known.lastName.trim() || undefined,
        birthDate: known.birthDate || undefined,
        nationality: known.nationality || undefined,
      };

      // Dołącz oceny metryk
      (newPlayer as any).meta = {
        ...(newPlayer as any).meta,
        metricsRatings: packRatings(),
      };
    } else {
      const labelName = `#${unknown.jerseyNumber.trim()}`;
      newPlayer = {
        id,
        name: labelName || "Szkic zawodnika",
        pos: unknown.pos, // 4-bucket (warunkuje sekcje metryk)
        club: unknown.club.trim(),
        age: 0,
        status: "active",
      };

      // wszystko istotne + oceny metryk do meta
      (newPlayer as any).meta = {
        jerseyNumber: unknown.jerseyNumber || undefined,
        clubCountry: unknown.clubCountry || undefined,
        note: unknown.note || undefined,
        metricsRatings: packRatings(),
        recommendation: {
          targetLevel: (newPlayer as any)?.meta?.recommendation?.targetLevel || "",
          summary: (newPlayer as any)?.meta?.recommendation?.summary || "",
        },
      };
    }

    try {
      const raw = localStorage.getItem("s4s.players");
      const arr: Player[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem("s4s.players", JSON.stringify([newPlayer, ...arr]));
    } catch {}

    router.push(`/players/${id}`);
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

  /* ================= UI ================= */
  return (
    <div className="w-full">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Baza zawodników", href: "/players" },
          { label: "Dodaj zawodnika" },
        ]}
      />
      <Toolbar title="Dodaj zawodnika" />

      {/* --- KROK 1 --- */}
      {step === 1 && (
        <div className="max-w space-y-3">
          {/* Znam */}
          <button
            onClick={() => { setChoice("known"); setErrors({}); }}
            className={
              "w-full rounded-lg border p-4 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-900 " +
              (choice === "known"
                ? "border-gray-900 bg-gray-900/5 dark:border-neutral-300"
                : "border-gray-300 dark:border-neutral-700")
            }
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium">
              <User2 className="h-4 w-4" />
              Znam zawodnika
            </div>
            <div className="text-xs text-gray-500">
              Uzupełnij imię i nazwisko – resztę możesz dodać później w profilu.
            </div>
          </button>

          {/* Nie znam */}
          <button
            onClick={() => { setChoice("unknown"); setErrors({}); }}
            className={
              "w-full rounded-lg border p-4 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-900 " +
              (choice === "unknown"
                ? "border-gray-900 bg-gray-900/5 dark:border-neutral-300"
                : "border-gray-300 dark:border-neutral-700")
            }
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium">
              <Shirt className="h-4 w-4" />
              Nie znam zawodnika
            </div>
            <div className="text-xs text-gray-500">
              Zanotuj numer na koszulce, klub i kraj klubu + krótką notatkę. Dodasz szczegóły później.
            </div>
          </button>

          {errors["choice"] && (
            <p className="text-xs text-red-600">{errors["choice"]}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => history.back()}
              className="border-gray-300 dark:border-neutral-700"
            >
              Anuluj
            </Button>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={() => { if (validateStep1()) setStep(2); }}
            >
              Dalej
            </Button>
          </div>
        </div>
      )}

      {/* --- KROK 2: ZNAM --- */}
      {step === 2 && choice === "known" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Podstawowe dane (wymagane) */}
          <Card>
            <CardHeader><CardTitle>Podstawowe dane</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Imię <span className="text-red-600">*</span></Label>
                  <Input
                    value={known.firstName}
                    onChange={(e) => setKnown((d) => ({ ...d, firstName: e.target.value }))}
                    aria-invalid={!!errors["known.firstName"]}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  {errors["known.firstName"] && (
                    <p className="text-xs text-red-600">{errors["known.firstName"]}</p>
                  )}
                </div>
                <div>
                  <Label>Nazwisko <span className="text-red-600">*</span></Label>
                  <Input
                    value={known.lastName}
                    onChange={(e) => setKnown((d) => ({ ...d, lastName: e.target.value }))}
                    aria-invalid={!!errors["known.lastName"]}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  {errors["known.lastName"] && (
                    <p className="text-xs text-red-600">{errors["known.lastName"]}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kategoria pozycji (tabela)</Label>
                  <Select
                    value={known.pos}
                    onValueChange={(v) => setKnown((d) => ({ ...d, pos: v as Pos }))}
                  >
                    <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GK">GK</SelectItem>
                      <SelectItem value="DF">DF</SelectItem>
                      <SelectItem value="MF">MF</SelectItem>
                      <SelectItem value="FW">FW</SelectItem>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Klub</Label>
                  <Input
                    value={known.club}
                    onChange={(e) => setKnown((d) => ({ ...d, club: e.target.value }))}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <Label>Narodowość</Label>
                  <Input
                    value={known.nationality}
                    onChange={(e) => setKnown((d) => ({ ...d, nationality: e.target.value }))}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="border-gray-300 dark:border-neutral-700">Wstecz</Button>
                <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => { if (validateStep2()) save(); }}>
                  Zapisz
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ocena skauta (1–6) – gwiazdki bazujące na „Zarządzanie” */}
          <RatingsCard
            title="Ocena skauta (1–6)"
            pos={known.pos}
            config={mCfg}
            ratings={{ BASE: mBase, GK: mGK, DEF: mDEF, MID: mMID, ATT: mATT }}
            setByGroup={{ setBASE: setMBase, setGK: setMGK, setDEF: setMDEF, setMID: setMMID, setATT: setMATT }}
          />
        </div>
      )}

      {/* --- KROK 2: NIE ZNAM --- */}
      {step === 2 && choice === "unknown" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Lewa kolumna — Pola istotne aby zapisać zawodnika "nie znanego" */}
          <Card>
            <CardHeader><CardTitle>Szkic zawodnika (nie znany)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <Label>Numer na koszulce <span className="text-red-600">*</span></Label>
                  <Input
                    value={unknown.jerseyNumber}
                    onChange={(e) => setUnknown((d) => ({ ...d, jerseyNumber: e.target.value }))}
                    aria-invalid={!!errors["unknown.jerseyNumber"]}
                    placeholder="np. 27"
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  {errors["unknown.jerseyNumber"] && (
                    <p className="text-xs text-red-600">{errors["unknown.jerseyNumber"]}</p>
                  )}
                </div>
                <div>
                  <Label>Kategoria pozycji</Label>
                  <Select
                    value={unknown.pos}
                    onValueChange={(v) => setUnknown((d) => ({ ...d, pos: v as Pos }))}
                  >
                    <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GK">GK</SelectItem>
                      <SelectItem value="DF">DF</SelectItem>
                      <SelectItem value="MF">MF</SelectItem>
                      <SelectItem value="FW">FW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Aktualny klub <span className="text-red-600">*</span></Label>
                  <Input
                    value={unknown.club}
                    onChange={(e) => setUnknown((d) => ({ ...d, club: e.target.value }))}
                    aria-invalid={!!errors["unknown.club"]}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  {errors["unknown.club"] && (
                    <p className="text-xs text-red-600">{errors["unknown.club"]}</p>
                  )}
                </div>
                <div>
                  <Label>Kraj aktualnego klubu <span className="text-red-600">*</span></Label>
                  <Input
                    value={unknown.clubCountry}
                    onChange={(e) => setUnknown((d) => ({ ...d, clubCountry: e.target.value }))}
                    aria-invalid={!!errors["unknown.clubCountry"]}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  {errors["unknown.clubCountry"] && (
                    <p className="text-xs text-red-600">{errors["unknown.clubCountry"]}</p>
                  )}
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

              {/* Preview koszulki wewnątrz tej karty */}
              <div className="mt-2 rounded-lg border border-dashed border-gray-300 p-4 dark:border-neutral-800">
                <div className="mb-2 text-xs font-medium text-gray-500 dark:text-neutral-400">
                  Podgląd koszulki
                </div>
                <div className="flex items-center justify-center">
                  <JerseyPreview number={unknown.jerseyNumber} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="border-gray-300 dark:border-neutral-700">
                  Wstecz
                </Button>
                <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => { if (validateStep2()) save(); }}>
                  Zapisz
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Prawa kolumna — Ocena + Potencjał, Ryzyka, Rekomendacja */}
          <div className="space-y-4">
            <RatingsCard
              title="Ocena skauta (1–6)"
              pos={unknown.pos}
              config={mCfg}
              ratings={{ BASE: mBase, GK: mGK, DEF: mDEF, MID: mMID, ATT: mATT }}
              setByGroup={{ setBASE: setMBase, setGK: setMGK, setDEF: setMDEF, setMID: setMMID, setATT: setMATT }}
            />

            <Card>
              <CardHeader><CardTitle>Potencjał, ryzyka, rekomendacja</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Poziom docelowy gdzie mógłby grać zawodnik</Label>
                  <Input placeholder="np. Ekstraklasa / 2. Bundesliga…" />
                </div>
                <div>
                  <Label>Podsumowanie z własnym opisem</Label>
                  <Input placeholder="Krótka rekomendacja / opis…" />
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
   Ratings Card (shared by known/unknown)
   (uses StarRating instead of sliders)
----------------------------------------- */
function RatingsCard({
  title,
  pos,
  config,
  ratings,
  setByGroup,
}: {
  title: string;
  pos: Pos;
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
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            <Info className="h-3.5 w-3.5" />
            Skala: 1–6 • Etykiety edytujesz w „Zarządzanie → Metryki”
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Accordion type="multiple" className="w-full">
          {/* BASE */}
          <AccordionItem value="base">
            <AccordionTrigger>Kategorie bazowe</AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {config.BASE.filter((m) => m.enabled).map((m) => (
                <RatingRow
                  key={m.id}
                  label={m.label}
                  value={BASE[m.key] ?? 0}
                  onChange={(v) => setBASE((s) => ({ ...s, [m.key]: v }))}
                />
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* GK */}
          {showGK && (
            <AccordionItem value="gk">
              <AccordionTrigger>Bramkarz (GK)</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {config.GK.filter((m) => m.enabled).map((m) => (
                  <RatingRow
                    key={m.id}
                    label={m.label}
                    value={GK[m.key] ?? 0}
                    onChange={(v) => setGK((s) => ({ ...s, [m.key]: v }))}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* DEF */}
          {showDEF && (
            <AccordionItem value="def">
              <AccordionTrigger>Obrońca</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {config.DEF.filter((m) => m.enabled).map((m) => (
                  <RatingRow
                    key={m.id}
                    label={m.label}
                    value={DEF[m.key] ?? 0}
                    onChange={(v) => setDEF((s) => ({ ...s, [m.key]: v }))}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* MID */}
          {showMID && (
            <AccordionItem value="mid">
              <AccordionTrigger>Pomocnik</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {config.MID.filter((m) => m.enabled).map((m) => (
                  <RatingRow
                    key={m.id}
                    label={m.label}
                    value={MID[m.key] ?? 0}
                    onChange={(v) => setMID((s) => ({ ...s, [m.key]: v }))}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          {/* ATT */}
          {showATT && (
            <AccordionItem value="att">
              <AccordionTrigger>Napastnik</AccordionTrigger>
              <AccordionContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {config.ATT.filter((m) => m.enabled).map((m) => (
                  <RatingRow
                    key={m.id}
                    label={m.label}
                    value={ATT[m.key] ?? 0}
                    onChange={(v) => setATT((s) => ({ ...s, [m.key]: v }))}
                  />
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
   Small reusable rows/components
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-neutral-800">
      <div className="min-w-0 text-sm">{label}</div>
      <StarRating value={value} onChange={onChange} max={6} />
    </div>
  );
}

function JerseyPreview({ number }: { number: string }) {
  const n = (number || "").trim().slice(0, 3) || "—";
  return (
    <div className="relative mx-auto h-[220px] w-[220px] sm:h-[280px] sm:w-[280px]">
      <svg
        className="h-full w-full text-gray-800 dark:text-neutral-200"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
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
        <span className="select-none text-6xl font-extrabold leading-none text-gray-900 dark:text-neutral-100">
          {n}
        </span>
      </div>
    </div>
  );
}
