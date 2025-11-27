// src/app/admin/manage/required-fields/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ToolbarFull } from "@/shared/ui/atoms";
import { getSupabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";

import { ChevronDown, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FormContext =
  | "player_basic_known"
  | "player_basic_unknown"
  | "observation_new"
  | "observations_main"
  | "player_editor_basic_known"
  | "player_editor_basic_unknown"
  | "player_editor_ext_profile"
  | "player_editor_ext_eligibility"
  | "player_editor_ext_stats365"
  | "player_editor_contact"
  | "player_editor_grade";

type FieldDef = {
  key: string;
  label: string;
  description?: string;
};

type FormDef = {
  id: FormContext;
  label: string;
  description: string;
  highlight?: string;
  fields: FieldDef[];
};

/* ======================= UI helpers ======================= */

const stepPillClass =
  "inline-flex h-6 items-center rounded-md bg-stone-100 px-2.5 text-[11px] tracking-wide text-stone-600 dark:bg-neutral-900 dark:text-neutral-200";

type SaveState = "idle" | "saving" | "saved";

function SavePill({
  state,
  size = "compact",
}: {
  state: SaveState;
  size?: "default" | "compact";
}) {
  const base =
    size === "compact"
      ? "inline-flex h-8 items-center rounded-md px-2 text-xs leading-none"
      : "inline-flex h-9 items-center rounded-md px-3 text-sm leading-none";

  const map = {
    saving: "text-amber-700 dark:text-amber-200",
    saved: "text-emerald-700 dark:text-emerald-200",
    idle: "text-gray-600 dark:text-neutral-300",
  } as const;

  if (state === "idle") return null;

  return (
    <span className={cn(base, map[state])} aria-live="polite">
      {state === "saving" ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin md:mr-1.5" />
          <span className="hidden md:inline">Zapisuję ustawienia…</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="hidden md:inline">Zapisano ustawienia</span>
        </>
      )}
    </span>
  );
}

/* ===== Definicje pól w formularzach ===== */
const FORM_DEFS: FormDef[] = [
  {
    id: "player_basic_known",
    label: "AddPlayer – zawodnik znany",
    description:
      "Formularz używany, gdy znasz dane osobowe zawodnika (imię, nazwisko, rocznik).",
    highlight: "AddPlayerPage – tryb „Znam zawodnika”.",
    fields: [
      { key: "firstName", label: "Imię", description: "Np. Jan." },
      { key: "lastName", label: "Nazwisko", description: "Np. Kowalski." },
      {
        key: "birthYear",
        label: "Rok urodzenia",
        description: "Np. 2005. Używane do wyliczania wieku.",
      },
      {
        key: "club",
        label: "Aktualny klub",
        description: "Nazwa aktualnego klubu zawodnika.",
      },
      {
        key: "clubCountry",
        label: "Kraj aktualnego klubu",
        description: "Np. Polska, Niemcy…",
      },
      {
        key: "jerseyNumber",
        label: "Numer na koszulce",
        description:
          "Opcjonalne – można uczynić wymaganym, jeśli chcesz zawsze mieć numer.",
      },
    ],
  },
  {
    id: "player_basic_unknown",
    label: "AddPlayer – zawodnik nieznany",
    description:
      "Formularz, gdy nie znasz danych osobowych zawodnika (obserwacja po numerze / klubie).",
    highlight: "AddPlayerPage – tryb „Nie znam zawodnika”.",
    fields: [
      {
        key: "jerseyNumber_unknown",
        label: "Numer na koszulce",
        description: "Np. 27.",
      },
      {
        key: "uClub",
        label: "Aktualny klub",
        description: "Nazwa klubu zawodnika.",
      },
      {
        key: "uClubCountry",
        label: "Kraj aktualnego klubu",
        description: "Np. Polska, Anglia…",
      },
      {
        key: "uNote",
        label: "Notatka własna",
        description:
          "Krótki opis zawodnika / kontekstu obserwacji. Może być opcjonalna.",
      },
    ],
  },
  {
    id: "observation_new",
    label: "AddPlayer – sekcja „Nowa obserwacja”",
    description:
      "Sekcja „Nowa obserwacja” wewnątrz formularza dodawania zawodnika.",
    highlight: "Panel „Obserwacje” w AddPlayerPage.",
    fields: [
      {
        key: "match",
        label: "Mecz",
        description: "Tekst meczu, np. „Lech U19 vs Wisła U19”.",
      },
      {
        key: "date",
        label: "Data meczu",
        description: "Pole typu data, używane do sortowania i podglądu.",
      },
      {
        key: "time",
        label: "Godzina meczu",
        description: "Opcjonalne – przydatne do dokładnego logowania.",
      },
      {
        key: "opponentLevel",
        label: "Poziom przeciwnika",
        description: "Np. CLJ U17, 3 liga, top akademia…",
      },
      {
        key: "mode",
        label: "Tryb (Live / TV)",
        description: "Czy obserwacja była na żywo, czy z TV / wideo.",
      },
      {
        key: "status",
        label: "Status (Szkic / Finalna)",
        description: "Możesz wymusić, aby zawsze był wybrany status.",
      },
    ],
  },
  {
    id: "observations_main",
    label: "ObservationEditor – formularz główny",
    description:
      "Konfiguracja wymagalności pól w głównym formularzu obserwacji.",
    highlight:
      "Używane w ObservationEditor (widok obserwacji – drużyny, data, zawodnicy itd.).",
    fields: [
      {
        key: "teamA",
        label: "Drużyna A",
        description: "Pierwsza drużyna w meczu.",
      },
      {
        key: "teamB",
        label: "Drużyna B",
        description: "Druga drużyna w meczu.",
      },
      {
        key: "reportDate",
        label: "Data meczu",
        description: "Data używana do sortowania i raportów.",
      },
      {
        key: "time",
        label: "Godzina meczu",
        description: "Godzina rozpoczęcia meczu (opcjonalna).",
      },
      {
        key: "conditions",
        label: "Tryb meczu (Live / TV)",
        description: "Czy obserwacja była na żywo, czy z transmisji.",
      },
      {
        key: "competition",
        label: "Liga / turniej",
        description: "Nazwa rozgrywek (np. CLJ U19, Puchar Polski).",
      },
      {
        key: "players",
        label: "Lista zawodników",
        description:
          "Czy wymagany jest co najmniej jeden zawodnik w obserwacji.",
      },
      {
        key: "note",
        label: "Notatka ogólna",
        description: "Tekstowa notatka do całej obserwacji.",
      },
    ],
  },
  {
    id: "player_editor_basic_known",
    label: "PlayerEditor – podstawowe (znany)",
    description:
      "Podstawowa sekcja w edytorze zawodnika – gdy profil jest znany (imię, nazwisko).",
    highlight: "PlayerEditorPage – sekcja „Podstawowe informacje” (znany).",
    fields: [
      {
        key: "firstName",
        label: "Imię",
        description: "Pole `firstName` z PlayerEditor (znany zawodnik).",
      },
      {
        key: "lastName",
        label: "Nazwisko",
        description: "Pole `lastName` z PlayerEditor (znany zawodnik).",
      },
      {
        key: "birthYear",
        label: "Rok urodzenia",
        description: "ext.birthYear – rok urodzenia używany do wieku.",
      },
      {
        key: "club",
        label: "Aktualny klub",
        description: "Pole `club` z PlayerEditor.",
      },
      {
        key: "clubCountry",
        label: "Kraj aktualnego klubu",
        description: "ext.clubCountry – kraj klubu zawodnika.",
      },
      {
        key: "jerseyNumber",
        label: "Numer na koszulce",
        description: "ext.jerseyNumber – numer na koszulce (opcjonalnie).",
      },
    ],
  },
  {
    id: "player_editor_basic_unknown",
    label: "PlayerEditor – podstawowe (nieznany)",
    description:
      "Podstawowa sekcja w edytorze, gdy profil jest traktowany jako nieznany (brak imienia/nazwiska).",
    highlight:
      "PlayerEditorPage – sekcja „Podstawowe informacje” (profil nieznany).",
    fields: [
      {
        key: "jerseyNumber",
        label: "Numer na koszulce",
        description: "ext.jerseyNumber – numer, po którym rozpoznajesz gracza.",
      },
      {
        key: "club",
        label: "Aktualny klub",
        description: "Pole `club` z PlayerEditor.",
      },
      {
        key: "clubCountry",
        label: "Kraj aktualnego klubu",
        description: "ext.clubCountry – kraj klubu zawodnika.",
      },
      {
        key: "unknownNote",
        label: "Notatka własna (nieznany)",
        description:
          "ext.unknownNote – opis zawodnika dla profilu nieznanego.",
      },
    ],
  },
  {
    id: "player_editor_ext_profile",
    label: "PlayerEditor – profil boiskowy",
    description:
      "Zakładka „Profil boiskowy” w sekcji Rozszerzone informacje (wzrost, waga, pozycje).",
    highlight: "PlayerEditorPage – ExtContent(view=\"profile\").",
    fields: [
      { key: "height", label: "Wzrost (cm)" },
      { key: "weight", label: "Waga (kg)" },
      { key: "dominantFoot", label: "Dominująca noga" },
      { key: "mainPos", label: "Główna pozycja" },
      {
        key: "altPositions",
        label: "Pozycje alternatywne",
        description: "Lista pozycji alternatywnych (ext.altPositions).",
      },
    ],
  },
  {
    id: "player_editor_ext_eligibility",
    label: "PlayerEditor – status & scouting",
    description:
      "Zakładka „Status & scouting” – paszport UE, kontrakt, agencja, linki.",
    highlight: "PlayerEditorPage – ExtContent(view=\"eligibility\").",
    fields: [
      { key: "english", label: "Znajomość języka angielskiego" },
      { key: "euPassport", label: "Paszport UE" },
      { key: "birthCountry", label: "Kraj urodzenia" },
      { key: "contractStatus", label: "Status kontraktu" },
      { key: "agency", label: "Agencja menadżerska" },
      { key: "releaseClause", label: "Klauzula wykupu" },
      { key: "leagueLevel", label: "Poziom rozgrywkowy obecnego klubu" },
      { key: "clipsLinks", label: "Linki do klipów / time-codes" },
      { key: "transfermarkt", label: "Link do Transfermarkt" },
      { key: "wyscout", label: "Link do Wyscout" },
    ],
  },
  {
    id: "player_editor_ext_stats365",
    label: "PlayerEditor – zdrowie i statystyki",
    description:
      "Zakładka „Zdrowie i statystyki” – historia urazów, minuty, gole itd.",
    highlight: "PlayerEditorPage – ExtContent(view=\"stats365\").",
    fields: [
      { key: "injuryHistory", label: "Historia urazów" },
      { key: "minutes365", label: "Minuty w ostatnich 365 dniach" },
      { key: "starts365", label: "Mecze jako starter" },
      { key: "subs365", label: "Mecze jako rezerwowy" },
      { key: "goals365", label: "Gole w ostatnich 365 dniach" },
    ],
  },
  {
    id: "player_editor_contact",
    label: "PlayerEditor – kontakt & social",
    description:
      "Zakładka „Kontakt & social” – telefon, e-mail i linki do sociali.",
    highlight: "PlayerEditorPage – ExtContent(view=\"contact\").",
    fields: [
      { key: "phone", label: "Telefon kontaktowy" },
      { key: "email", label: "E-mail kontaktowy" },
      { key: "fb", label: "Link FB" },
      { key: "ig", label: "Link IG" },
      { key: "tiktok", label: "Link TikTok" },
    ],
  },
  {
    id: "player_editor_grade",
    label: "PlayerEditor – ocena",
    description:
      "Zakładka „Ocena” – poziom docelowy i podsumowanie. Kategorie 1–5 są konfigurowane osobno w panelu ocen.",
    highlight: "PlayerEditorPage – sekcja „Ocena”.",
    fields: [
      {
        key: "notes",
        label: "Poziom docelowy (notes)",
        description:
          "Pole grade.notes / meta.targetLevel – opis docelowego poziomu.",
      },
      {
        key: "finalComment",
        label: "Podsumowanie (finalComment)",
        description:
          "Pole grade.finalComment / meta.finalSummary – końcowa rekomendacja.",
      },
    ],
  },
];

const FORM_DEF_BY_ID: Record<FormContext, FormDef> = FORM_DEFS.reduce(
  (acc, form) => {
    acc[form.id] = form;
    return acc;
  },
  {} as Record<FormContext, FormDef>
);

const FORM_GROUPS: { id: string; label: string; items: FormContext[] }[] = [
  {
    id: "addPlayer",
    label: "Dodawanie zawodnika",
    items: ["player_basic_known", "player_basic_unknown", "observation_new"],
  },
  {
    id: "observations",
    label: "Obserwacje",
    items: ["observations_main"],
  },
  {
    id: "player_basic",
    label: "Edytor zawodnika – podstawowe",
    items: ["player_editor_basic_known", "player_editor_basic_unknown"],
  },
  {
    id: "player_ext",
    label: "Edytor zawodnika – rozszerzone",
    items: [
      "player_editor_ext_profile",
      "player_editor_ext_eligibility",
      "player_editor_ext_stats365",
      "player_editor_contact",
      "player_editor_grade",
    ],
  },
];

/* ===== Domyślne wymagalności (fallback, jeśli nie ma nic w bazie) ===== */

const DEFAULT_REQUIRED: Record<string, boolean> = {
  // player_basic_known (AddPlayer)
  "player_basic_known.firstName": true,
  "player_basic_known.lastName": true,
  "player_basic_known.birthYear": true,
  "player_basic_known.club": true,
  "player_basic_known.clubCountry": true,
  "player_basic_known.jerseyNumber": false,

  // player_basic_unknown (AddPlayer)
  "player_basic_unknown.jerseyNumber_unknown": true,
  "player_basic_unknown.uClub": true,
  "player_basic_unknown.uClubCountry": true,
  "player_basic_unknown.uNote": false,

  // observation_new (AddPlayer – sekcja obserwacji)
  "observation_new.match": true,
  "observation_new.date": true,
  "observation_new.time": false,
  "observation_new.opponentLevel": false,
  "observation_new.mode": false,
  "observation_new.status": false,

  // observations_main
  "observations_main.teamA": true,
  "observations_main.teamB": true,
  "observations_main.reportDate": true,
  "observations_main.time": false,
  "observations_main.conditions": false,
  "observations_main.competition": false,
  "observations_main.players": true,
  "observations_main.note": false,

  // PlayerEditor – podstawowe (znany)
  "player_editor_basic_known.firstName": true,
  "player_editor_basic_known.lastName": true,
  "player_editor_basic_known.birthYear": true,
  "player_editor_basic_known.club": true,
  "player_editor_basic_known.clubCountry": true,
  "player_editor_basic_known.jerseyNumber": false,

  // PlayerEditor – podstawowe (nieznany)
  "player_editor_basic_unknown.jerseyNumber": true,
  "player_editor_basic_unknown.club": true,
  "player_editor_basic_unknown.clubCountry": true,
  "player_editor_basic_unknown.unknownNote": true,

  // PlayerEditor – profil boiskowy
  "player_editor_ext_profile.height": false,
  "player_editor_ext_profile.weight": false,
  "player_editor_ext_profile.dominantFoot": false,
  "player_editor_ext_profile.mainPos": false,
  "player_editor_ext_profile.altPositions": false,

  // PlayerEditor – status & scouting
  "player_editor_ext_eligibility.english": false,
  "player_editor_ext_eligibility.euPassport": false,
  "player_editor_ext_eligibility.birthCountry": false,
  "player_editor_ext_eligibility.contractStatus": false,
  "player_editor_ext_eligibility.agency": false,
  "player_editor_ext_eligibility.releaseClause": false,
  "player_editor_ext_eligibility.leagueLevel": false,
  "player_editor_ext_eligibility.clipsLinks": false,
  "player_editor_ext_eligibility.transfermarkt": false,
  "player_editor_ext_eligibility.wyscout": false,

  // PlayerEditor – zdrowie i statystyki
  "player_editor_ext_stats365.injuryHistory": false,
  "player_editor_ext_stats365.minutes365": false,
  "player_editor_ext_stats365.starts365": false,
  "player_editor_ext_stats365.subs365": false,
  "player_editor_ext_stats365.goals365": false,

  // PlayerEditor – kontakt & social
  "player_editor_contact.phone": false,
  "player_editor_contact.email": false,
  "player_editor_contact.fb": false,
  "player_editor_contact.ig": false,
  "player_editor_contact.tiktok": false,

  // PlayerEditor – ocena
  "player_editor_grade.notes": false,
  "player_editor_grade.finalComment": false,
};

type DbRow = {
  context: string;
  field_key: string;
  required: boolean;
};

function makeKey(context: FormContext, fieldKey: string) {
  return `${context}.${fieldKey}`;
}

export default function RequiredFieldsPage() {
  const router = useRouter();

  const [activeForm, setActiveForm] =
    useState<FormContext>("player_basic_known");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [requiredMap, setRequiredMap] = useState<Record<string, boolean>>({});

  // accordions
  const [contextsOpen, setContextsOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);

  /* ======================== Load config from Supabase ======================== */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("field_requirements")
          .select("context, field_key, required");

        if (cancelled) return;

        if (error) {
          console.error("[RequiredFieldsPage] load error", error);
          setRequiredMap({ ...DEFAULT_REQUIRED });
          setError(
            "Nie udało się pobrać konfiguracji z Supabase – użyto wartości domyślnych."
          );
        } else if (!data || data.length === 0) {
          setRequiredMap({ ...DEFAULT_REQUIRED });
        } else {
          const next: Record<string, boolean> = { ...DEFAULT_REQUIRED };
          for (const row of data as DbRow[]) {
            const ctx = row.context as FormContext;
            const key = makeKey(ctx, row.field_key);
            next[key] = !!row.required;
          }
          setRequiredMap(next);
        }
      } catch (e) {
        console.error("[RequiredFieldsPage] exception while load:", e);
        setRequiredMap({ ...DEFAULT_REQUIRED });
        setError(
          "Wystąpił nieoczekiwany błąd podczas pobierania konfiguracji."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ======================== Derived helpers ======================== */

  const isDirty = useMemo(() => {
    const allKeys = new Set<string>([
      ...Object.keys(DEFAULT_REQUIRED),
      ...Object.keys(requiredMap),
    ]);
    for (const key of allKeys) {
      if ((requiredMap[key] ?? false) !== (DEFAULT_REQUIRED[key] ?? false)) {
        return true;
      }
    }
    return false;
  }, [requiredMap]);

  const saveState: SaveState = saving
    ? "saving"
    : success && !isDirty
    ? "saved"
    : "idle";

  function isRequired(context: FormContext, fieldKey: string) {
    const key = makeKey(context, fieldKey);
    if (key in requiredMap) return requiredMap[key];
    return DEFAULT_REQUIRED[key] ?? false;
  }

  function toggleRequired(context: FormContext, fieldKey: string) {
    const key = makeKey(context, fieldKey);
    setRequiredMap((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? DEFAULT_REQUIRED[key] ?? false),
    }));
    setError(null);
    setSuccess(null);
  }

  function setAllInForm(context: FormContext, value: boolean) {
    const form = FORM_DEF_BY_ID[context];
    if (!form) return;
    setRequiredMap((prev) => {
      const next = { ...prev };
      for (const field of form.fields) {
        const key = makeKey(context, field.key);
        next[key] = value;
      }
      return next;
    });
    setError(null);
    setSuccess(null);
  }

  function handleResetToDefaults() {
    setRequiredMap({ ...DEFAULT_REQUIRED });
    setError(null);
    setSuccess("Przywrócono domyślną konfigurację wymagalności pól.");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();

      const rows: DbRow[] = [];
      for (const form of FORM_DEFS) {
        for (const field of form.fields) {
          const k = makeKey(form.id, field.key);
          const required = requiredMap[k] ?? DEFAULT_REQUIRED[k] ?? false;
          rows.push({
            context: form.id,
            field_key: field.key,
            required,
          });
        }
      }

      const { error } = await supabase
        .from("field_requirements")
        .upsert(rows, { onConflict: "context,field_key" });

      if (error) {
        console.error("[RequiredFieldsPage] save error", error);
        setError("Nie udało się zapisać konfiguracji. Spróbuj ponownie.");
      } else {
        setSuccess("Konfiguracja wymagalności pól została zapisana.");

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("required-fields-updated"));
        }
      }
    } catch (e) {
      console.error("[RequiredFieldsPage] exception while save:", e);
      setError("Wystąpił nieoczekiwany błąd podczas zapisu.");
    } finally {
      setSaving(false);
    }
  }

  const activeFormDef = FORM_DEF_BY_ID[activeForm];

  const activeStats = useMemo(() => {
    if (!activeFormDef) {
      return { total: 0, required: 0, changed: 0 };
    }
    let total = activeFormDef.fields.length;
    let required = 0;
    let changed = 0;

    for (const field of activeFormDef.fields) {
      const key = makeKey(activeFormDef.id, field.key);
      const currentRequired =
        requiredMap[key] ?? DEFAULT_REQUIRED[key] ?? false;
      const defaultRequired = DEFAULT_REQUIRED[key] ?? false;

      if (currentRequired) required += 1;
      if (currentRequired !== defaultRequired) changed += 1;
    }

    return { total, required, changed };
  }, [activeFormDef, requiredMap]);

  /* ======================== Header layout (jak PlayerEditorPage) ======================== */

  const headerTitle = (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-xl font-semibold leading-none tracking-tight">
        Wymagalność pól w formularzach
      </h2>
      <p className="max-w-xl text-xs text-muted-foreground">
        Ustal, które pola w AddPlayer, PlayerEditor i Observations muszą być
        wypełnione przed zapisem (w tym w auto-zapisie). Ustawienia są globalne
        dla całej aplikacji.
      </p>
    </div>
  );

  const headerRight = (
    <div className="flex items-center gap-3">
      <SavePill state={saveState} size="compact" />

      <span className="hidden text-xs text-muted-foreground md:inline">
        {isDirty ? "Masz niezapisane zmiany" : "Wszystkie zmiany zapisane"}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push("/admin/manage")}
        className="hidden h-8 rounded-md px-3 text-xs sm:inline-flex"
      >
        Wróć do zarządzania
      </Button>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="inline-flex h-8 w-8 rounded-md p-0 sm:hidden"
          aria-label="Wróć do zarządzania"
          onClick={() => router.push("/admin/manage")}
        >
          ←
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetToDefaults}
          disabled={saving || loading}
          className="h-8 rounded-md px-3 text-xs"
        >
          Domyślne
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving || loading || !isDirty}
          className="h-8 rounded-md px-3 text-xs"
        >
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Zapisuję…
            </>
          ) : (
            "Zapisz"
          )}
        </Button>
      </div>
    </div>
  );

  /* ======================== Render ======================== */

  return (
    <div className="w-full space-y-4">
      <ToolbarFull title={headerTitle} right={headerRight} />

      {/* mały status jak w PlayerEditor – chipy po prawej, bez gradientów */}
      <Card className="rounded-md border border-stone-200 bg-card px-4 py-3 text-sm dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Aktywna konfiguracja wymagalności wpływa na walidację w AddPlayer,
            PlayerEditor oraz ObservationEditor.
          </p>
          <div className="flex flex-col items-end text-xs text-muted-foreground sm:text-sm">
            <span>
              Aktywny formularz:{" "}
              <span className="font-medium text-foreground">
                {activeFormDef.label}
              </span>
            </span>
            <span className="mt-0.5 text-[10px]">
              {activeStats.required} z {activeStats.total} pól oznaczonych jako{" "}
              <span className="font-medium text-foreground">wymagane</span>
            </span>
            {activeStats.changed > 0 && (
              <span className="mt-0.5 inline-flex items-center rounded-md border border-amber-300 bg-background px-1.5 py-0.5 text-[10px] text-amber-800 dark:border-amber-500/70 dark:text-amber-200">
                Zmieniono {activeStats.changed} pól względem domyślnych
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,260px),minmax(0,1fr)]">
        {/* LEFT: KROK 1 – wybór kontekstu formularza (akordeon jak w PlayerEditorPage) */}
        <Card className="h-full rounded-md border border-stone-200 bg-card dark:border-neutral-800">
          <CardHeader
            className={cn(
              "group flex items-center justify-between rounded-md border-b border-transparent p-0 transition-colors hover:bg-stone-50/80 dark:hover:bg-neutral-900/60",
              contextsOpen && "bg-stone-100/80 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={contextsOpen}
              aria-controls="contexts-panel"
              onClick={() => setContextsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <div className={stepPillClass}>Krok 1 · Wybór formularza</div>
                <div className="mt-1 text-sm font-semibold leading-none tracking-tight">
                  Konteksty formularzy
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Wybierz formularz (AddPlayer, PlayerEditor, Observations),
                  dla którego chcesz skonfigurować wymagalność pól.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    contextsOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-3 py-0">
            <Accordion
              type="single"
              collapsible
              value={contextsOpen ? "contexts" : undefined}
              onValueChange={(v) => setContextsOpen(v === "contexts")}
              className="w-full"
            >
              <AccordionItem value="contexts" className="border-0">
                <AccordionContent
                  id="contexts-panel"
                  className="px-1 pt-3 pb-4"
                >
                  <div className="space-y-3">
                    {FORM_GROUPS.map((group, groupIndex) => (
                      <div key={group.id} className="space-y-1.5">
                        <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-stone-500 dark:text-neutral-500">
                          {group.label}
                        </p>
                        <div className="space-y-1">
                          {group.items.map((ctx) => {
                            const form = FORM_DEF_BY_ID[ctx];
                            const isActive = activeForm === ctx;

                            let total = form.fields.length;
                            let requiredCount = 0;
                            let changed = false;

                            for (const field of form.fields) {
                              const key = makeKey(form.id, field.key);
                              const currentRequired =
                                requiredMap[key] ??
                                DEFAULT_REQUIRED[key] ??
                                false;
                              const defaultRequired =
                                DEFAULT_REQUIRED[key] ?? false;
                              if (currentRequired) requiredCount += 1;
                              if (currentRequired !== defaultRequired) {
                                changed = true;
                              }
                            }

                            return (
                              <button
                                key={ctx}
                                type="button"
                                onClick={() => setActiveForm(ctx)}
                                className={cn(
                                  "flex w-full flex-col rounded-md border px-2.5 py-2 text-left text-sm transition",
                                  isActive
                                    ? "border-stone-900 bg-background dark:border-neutral-100"
                                    : "border-stone-200 bg-background hover:border-stone-300 dark:border-neutral-800 dark:hover:border-neutral-700"
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      "line-clamp-1 font-medium",
                                      isActive
                                        ? "text-foreground"
                                        : "text-stone-700 dark:text-neutral-200"
                                    )}
                                  >
                                    {form.label}
                                  </span>
                                  <span className="inline-flex items-center rounded-md border border-stone-200 px-2 py-0.5 text-[10px] text-stone-600 dark:border-neutral-700 dark:text-neutral-300">
                                    {requiredCount}/{total} wymagane
                                  </span>
                                </div>
                                {form.highlight && (
                                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                                    {form.highlight}
                                  </p>
                                )}
                                {changed && (
                                  <span className="mt-1 inline-flex items-center text-[9px] text-amber-700 dark:text-amber-300">
                                    • Zmieniono względem domyślnych
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {groupIndex < FORM_GROUPS.length - 1 && (
                          <Separator className="my-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* RIGHT: KROK 2 – szczegóły aktywnego formularza (akordeon jak w PlayerEditorPage) */}
        <Card className="rounded-md border border-stone-200 bg-card dark:border-neutral-800">
          <CardHeader
            className={cn(
              "group flex items-center justify-between rounded-md border-b border-transparent p-0 transition-colors hover:bg-stone-50/80 dark:hover:bg-neutral-900/60",
              detailsOpen && "bg-stone-100/80 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={detailsOpen}
              aria-controls="details-panel"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <div className={stepPillClass}>Krok 2 · Wymagalność pól</div>
                <div className="mt-1 text-sm font-semibold leading-none tracking-tight">
                  {activeFormDef.label}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeFormDef.description}
                </p>
                {activeFormDef.highlight && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Powiązanie w aplikacji:
                    </span>{" "}
                    {activeFormDef.highlight}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 pl-4 text-xs text-muted-foreground">
                <span>
                  Wymagane pola:{" "}
                  <span className="font-medium text-foreground">
                    {activeStats.required}/{activeStats.total}
                  </span>
                </span>
                {activeStats.changed > 0 && (
                  <span className="text-[10px]">
                    Zmienione:{" "}
                    <span className="font-medium text-foreground">
                      {activeStats.changed}
                    </span>
                  </span>
                )}
                <div className="mt-1 hidden gap-1 sm:flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || saving}
                    onClick={() => setAllInForm(activeForm, true)}
                    className="h-7 rounded-md px-2 text-[10px]"
                  >
                    Wszystko wymagane
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || saving}
                    onClick={() => setAllInForm(activeForm, false)}
                    className="h-7 rounded-md px-2 text-[10px]"
                  >
                    Wszystko opcjonalne
                  </Button>
                </div>
                <ChevronDown
                  className={cn(
                    "mt-1 h-5 w-5 transition-transform",
                    detailsOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
            {/* mobile quick actions under header */}
            <div className="flex w-full items-center justify-end gap-1 border-t border-stone-200 px-4 py-2 text-[10px] text-muted-foreground dark:border-neutral-800 sm:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || saving}
                onClick={() => setAllInForm(activeForm, true)}
                className="h-7 rounded-md px-2 text-[10px]"
              >
                Wszystko wymagane
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || saving}
                onClick={() => setAllInForm(activeForm, false)}
                className="h-7 rounded-md px-2 text-[10px]"
              >
                Wszystko opcjonalne
              </Button>
            </div>

            {loading && (
              <p className="w-full px-4 pb-2 text-xs text-muted-foreground">
                <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                Ładowanie konfiguracji z Supabase…
              </p>
            )}
          </CardHeader>

          <CardContent className="px-3 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={detailsOpen ? "details" : undefined}
              onValueChange={(v) => setDetailsOpen(v === "details")}
              className="w-full"
            >
              <AccordionItem value="details" className="border-0">
                <AccordionContent
                  id="details-panel"
                  className="space-y-4 pt-3 pb-4"
                >
                  {/* Lista pól – kafelki jak mini-ExtContent */}
                  <div className="space-y-2">
                    {activeFormDef.fields.length === 0 ? (
                      <div className="rounded-md border border-dashed border-stone-200 bg-background px-4 py-6 text-center text-sm text-muted-foreground dark:border-neutral-800">
                        Dla tego formularza nie zdefiniowano żadnych pól.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {activeFormDef.fields.map((field) => {
                          const key = makeKey(activeFormDef.id, field.key);
                          const required = isRequired(
                            activeFormDef.id,
                            field.key
                          );
                          const defaultRequired =
                            DEFAULT_REQUIRED[key] ?? false;
                          const isDefaultRequired = defaultRequired;
                          const changed = required !== defaultRequired;

                          return (
                            <div
                              key={field.key}
                              className="flex items-start justify-between gap-3 rounded-md border border-stone-200 bg-background px-3 py-2 text-sm shadow-xs dark:border-neutral-800"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-medium text-foreground">
                                    {field.label}
                                  </span>
                                  <span className="rounded-md border border-stone-200 px-1.5 py-0.5 text-[9px] text-stone-600 dark:border-neutral-700 dark:text-neutral-300">
                                    {required ? "Wymagane" : "Opcjonalne"}
                                  </span>
                                  {changed && (
                                    <span className="rounded-md border border-amber-300 px-1.5 py-0.5 text-[9px] text-amber-800 dark:border-amber-500/70 dark:text-amber-200">
                                      Zmienione
                                    </span>
                                  )}
                                  {isDefaultRequired &&
                                    !changed &&
                                    required && (
                                      <span className="rounded-md border border-stone-300 px-1.5 py-0.5 text-[9px] text-stone-600 dark:border-neutral-600 dark:text-neutral-300">
                                        Domyślnie wymagane
                                      </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                  <span>
                                    Klucz:{" "}
                                    <code className="rounded-md bg-muted px-1 py-0.5">
                                      {field.key}
                                    </code>
                                  </span>
                                  {field.description && (
                                    <span>{field.description}</span>
                                  )}
                                </div>
                              </div>

                              {/* Minimalistyczny „switch” */}
                              <div className="flex flex-col items-end gap-1">
                                <button
                                  type="button"
                                  disabled={loading || saving}
                                  onClick={() =>
                                    toggleRequired(
                                      activeFormDef.id,
                                      field.key
                                    )
                                  }
                                  className={cn(
                                    "relative inline-flex h-5 w-9 cursor-pointer items-center rounded-md border px-0.5 transition",
                                    required
                                      ? "border-stone-900 bg-stone-900"
                                      : "border-stone-300 bg-background dark:border-neutral-700"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "inline-block h-[14px] w-[14px] rounded-full bg-white transition-transform",
                                      required
                                        ? "translate-x-3.5"
                                        : "translate-x-0"
                                    )}
                                  />
                                </button>
                                <span className="text-[10px] text-muted-foreground">
                                  {required
                                    ? "Ustaw jako opcjonalne"
                                    : "Ustaw jako wymagane"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* info + błędy / sukces */}
                  <div className="space-y-2 text-xs text-muted-foreground sm:text-sm">
                    <p>
                      Te ustawienia są używane przez formularze AddPlayer,
                      PlayerEditor i Observations do weryfikacji wymagalności
                      przed zapisem (w tym auto-zapis).
                    </p>
                    {isDirty && (
                      <span className="inline-flex items-center rounded-md border border-amber-300 bg-background px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-500/70 dark:text-amber-200">
                        Masz niezapisane zmiany – kliknij „Zapisz”.
                      </span>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-md border border-red-500/40 bg-background px-3 py-2 text-sm text-red-700 dark:border-red-500/50 dark:text-red-200">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="rounded-md border border-emerald-500/40 bg-background px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-200">
                      {success}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
