// src/app/admin/manage/required-fields/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Toolbar } from "@/shared/ui/atoms";
import { getSupabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import { Loader2 } from "lucide-react";
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

/* ===== Definicje pól w formularzach ===== */
const FORM_DEFS: FormDef[] = [
  /* ------------------------------------------------------------------ */
  /* 1) AddPlayer – zawodnik znany                                      */
  /* ------------------------------------------------------------------ */
  {
    id: "player_basic_known",
    label: "AddPlayer – zawodnik znany",
    description:
      "Formularz używany, gdy znasz dane osobowe zawodnika (imię, nazwisko, rocznik).",
    highlight: "AddPlayerPage – tryb „Znam zawodnika”.",
    fields: [
      {
        key: "firstName",
        label: "Imię",
        description: "Np. Jan.",
      },
      {
        key: "lastName",
        label: "Nazwisko",
        description: "Np. Kowalski.",
      },
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

  /* ------------------------------------------------------------------ */
  /* 2) AddPlayer – zawodnik nieznany                                   */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* 3) AddPlayer – sekcja „Nowa obserwacja”                            */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* 4) ObservationEditor – formularz główny                            */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* 5) PlayerEditor – podstawowe (znany)                               */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* 6) PlayerEditor – podstawowe (nieznany)                            */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* 7) PlayerEditor – Rozszerzone: Profil boiskowy                     */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* 8) PlayerEditor – Rozszerzone: Status & scouting                   */
  /* ------------------------------------------------------------------ */
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
      {
        key: "leagueLevel",
        label: "Poziom rozgrywkowy obecnego klubu",
      },
      { key: "clipsLinks", label: "Linki do klipów / time-codes" },
      { key: "transfermarkt", label: "Link do Transfermarkt" },
      { key: "wyscout", label: "Link do Wyscout" },
    ],
  },

  /* ------------------------------------------------------------------ */
  /* 9) PlayerEditor – Rozszerzone: Zdrowie i statystyki                */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* 10) PlayerEditor – Kontakt & social                                */
  /* ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ */
  /* 11) PlayerEditor – Ocena                                           */
  /* ------------------------------------------------------------------ */
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

  // observations_main – domyślnie jak dotychczasowa walidacja w ObservationEditor
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
  "player_editor_basic_unknown.unknownNote": false,

  // PlayerEditor – profil boiskowy (wszystko opcjonalne domyślnie)
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

  // map: "context.fieldKey" -> required?
  const [requiredMap, setRequiredMap] = useState<Record<string, boolean>>({});

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

  const activeFormDef = FORM_DEFS.find((f) => f.id === activeForm)!;

  /* ======================== Render ======================== */

  return (
    <div className="w-full">
      <Toolbar
        title="Wymagane pola w formularzach"
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/manage")}
              className="rounded-md"
            >
              Wróć do zarządzania
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefaults}
              disabled={saving}
              className="rounded-md"
            >
              Przywróć domyślne
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-md"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Zapisuję…
                </>
              ) : (
                "Zapisz ustawienia"
              )}
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid gap-4 md:grid-cols-1">
        {/* LEFT: główna konfiguracja */}
        <Card className="rounded-md border-slate-200 dark:border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Konfiguracja wymagalności pól
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Zaznacz, które pola muszą być{" "}
              <span className="font-semibold">uzupełnione</span>, aby
              formularz mógł być zapisany (auto-zapis / utworzenie rekordu).
            </p>
            {loading && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Ładowanie konfiguracji z Supabase…
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* wybór formularza */}
            <div className="inline-flex flex-wrap gap-2 rounded-md bg-slate-50 p-1 text-xs ring-1 ring-slate-200 dark:bg-neutral-900 dark:ring-neutral-800">
              {FORM_DEFS.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => setActiveForm(form.id)}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium transition",
                    activeForm === form.id
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-neutral-800 dark:text-neutral-50 dark:ring-neutral-700"
                      : "text-slate-600 hover:bg-white/60 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
                  )}
                >
                  {form.label}
                </button>
              ))}
            </div>

            <Separator />

            {/* opis aktywnego formularza */}
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-foreground">
                {activeFormDef.label}
              </p>
              <p className="text-muted-foreground">
                {activeFormDef.description}
              </p>
              {activeFormDef.highlight && (
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                  <span className="font-semibold">Powiązanie w aplikacji:</span>{" "}
                  {activeFormDef.highlight}
                </p>
              )}
            </div>

            {/* tabela pól */}
            <div className="overflow-hidden rounded-md border border-slate-200 text-xs dark:border-neutral-800">
              <div className="grid grid-cols-[minmax(0,1.6fr),minmax(0,2.4fr),auto] bg-slate-50 px-3 py-2 font-medium text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">
                <div>Pole</div>
                <div>Opis / przeznaczenie</div>
                <div className="text-right">Wymagane</div>
              </div>

              {activeFormDef.fields.length === 0 ? (
                <div className="px-4 py-6 text-center text-[11px] text-slate-500 dark:text-neutral-400">
                  Dla tego formularza nie zdefiniowano jeszcze żadnych pól.
                  Gdy dodasz je do konfiguracji, pojawią się tutaj.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-neutral-800">
                  {activeFormDef.fields.map((field) => {
                    const key = makeKey(activeFormDef.id, field.key);
                    const required = isRequired(activeFormDef.id, field.key);
                    const defaultRequired = DEFAULT_REQUIRED[key] ?? false;
                    const isDefaultRequired = defaultRequired;
                    const changed = required !== defaultRequired;

                    return (
                      <div
                        key={field.key}
                        className="grid grid-cols-[minmax(0,1.6fr),minmax(0,2.4fr),auto] items-center bg-white px-3 py-2 text-[11px] dark:bg-neutral-950"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-neutral-50">
                            {field.label}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                            Klucz:{" "}
                            <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">
                              {field.key}
                            </code>
                          </div>
                        </div>
                        <div className="pr-3 text-[11px] text-slate-600 dark:text-neutral-300">
                          {field.description}
                        </div>

                        <div className="flex items-center justify-end gap-3">
                          <div className="text-right">
                            {changed && (
                              <div className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60">
                                Zmienione
                              </div>
                            )}
                            {isDefaultRequired && !changed && required && (
                              <div className="mt-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60">
                                Domyślnie wymagane
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={required}
                              onCheckedChange={() =>
                                toggleRequired(activeFormDef.id, field.key)
                              }
                              disabled={loading || saving}
                              className="h-4 w-4"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* info o stanie */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400">
              <span>
                Ustawienia są używane przez formularze (AddPlayer, PlayerEditor,
                Observations) do sprawdzania, które pola są obowiązkowe.
              </span>
              {isDirty && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60">
                  Masz niezapisane zmiany
                </span>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            {success && (
              <p className="text-xs text-emerald-600 dark:text-emerald-300">
                {success}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
