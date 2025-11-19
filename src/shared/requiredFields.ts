// src/shared/requiredFields.ts
import { getSupabase } from "@/lib/supabaseClient";

export type FormContext = "observation_editor" | "player_editor";

export type ObservationFieldKey =
  | "teamA"
  | "teamB"
  | "reportDate"
  | "time"
  | "conditions"
  | "competition"
  | "players"
  | "note";

export type PlayerFieldKey =
  | "name"
  | "club"
  | "mainPosition"
  | "age"
  | "foot"
  | "status"
  | "summary";

export type FieldKey = ObservationFieldKey | PlayerFieldKey;

export type FieldDef = {
  context: FormContext;
  key: FieldKey;
  label: string;
  group?: string;
  defaultRequired: boolean;
};

export const FIELD_DEFS: FieldDef[] = [
  /* ========== OBSERVATION EDITOR ========== */
  {
    context: "observation_editor",
    key: "teamA",
    label: "Drużyna A",
    group: "match",
    defaultRequired: true,
  },
  {
    context: "observation_editor",
    key: "teamB",
    label: "Drużyna B",
    group: "match",
    defaultRequired: true,
  },
  {
    context: "observation_editor",
    key: "reportDate",
    label: "Data meczu",
    group: "match",
    defaultRequired: true,
  },
  {
    context: "observation_editor",
    key: "time",
    label: "Godzina meczu",
    group: "match",
    defaultRequired: false,
  },
  {
    context: "observation_editor",
    key: "conditions",
    label: "Tryb meczu (live/TV)",
    group: "match",
    defaultRequired: false,
  },
  {
    context: "observation_editor",
    key: "competition",
    label: "Liga / turniej",
    group: "match",
    defaultRequired: false,
  },
  {
    context: "observation_editor",
    key: "players",
    label: "Lista zawodników",
    group: "players",
    defaultRequired: true,
  },
  {
    context: "observation_editor",
    key: "note",
    label: "Notatka do obserwacji",
    group: "notes",
    defaultRequired: false,
  },

  /* ========== PLAYER EDITOR (przykładowe pola) ========== */
  {
    context: "player_editor",
    key: "name",
    label: "Imię i nazwisko",
    group: "main",
    defaultRequired: true,
  },
  {
    context: "player_editor",
    key: "club",
    label: "Klub",
    group: "main",
    defaultRequired: false,
  },
  {
    context: "player_editor",
    key: "mainPosition",
    label: "Główna pozycja",
    group: "main",
    defaultRequired: true,
  },
  {
    context: "player_editor",
    key: "age",
    label: "Wiek",
    group: "bio",
    defaultRequired: false,
  },
  {
    context: "player_editor",
    key: "foot",
    label: "Preferowana noga",
    group: "bio",
    defaultRequired: false,
  },
  {
    context: "player_editor",
    key: "status",
    label: "Status (aktywny/archiwalny)",
    group: "meta",
    defaultRequired: true,
  },
  {
    context: "player_editor",
    key: "summary",
    label: "Podsumowanie / opis",
    group: "notes",
    defaultRequired: false,
  },
];

/** Domyślna mapa wymagalności (bez Supabase) */
export function getDefaultRequiredMap(
  context: FormContext
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const def of FIELD_DEFS.filter((f) => f.context === context)) {
    map[def.key] = def.defaultRequired;
  }
  return map;
}

/**
 * Ładuje z Supabase aktualną konfigurację pól dla kontekstu.
 * Jeżeli w Supabase nie ma wpisów dla danego kontekstu – seeduje
 * wartości domyślne z FIELD_DEFS i zwraca domyślną mapę.
 */
export async function loadRequiredMap(
  context: FormContext
): Promise<Record<string, boolean>> {
  const supabase = getSupabase();
  const defaults = getDefaultRequiredMap(context);

  const { data, error } = await supabase
    .from("form_fields")
    .select("field_key, required")
    .eq("context", context);

  if (error) {
    console.error("[requiredFields] Błąd select z form_fields:", error);
    return defaults;
  }

  // brak rekordów -> seed z FIELD_DEFS
  if (!data || data.length === 0) {
    const seedRows = FIELD_DEFS.filter((f) => f.context === context).map(
      (f) => ({
        context,
        field_key: f.key,
        label: f.label,
        group: f.group ?? null,
        required: f.defaultRequired,
      })
    );

    const { error: seedError } = await supabase
      .from("form_fields")
      .upsert(seedRows, {
        onConflict: "context,field_key",
      });

    if (seedError) {
      console.error("[requiredFields] Błąd seed form_fields:", seedError);
    }

    return defaults;
  }

  const map: Record<string, boolean> = { ...defaults };
  for (const row of data as { field_key: string; required: boolean }[]) {
    map[row.field_key] = !!row.required;
  }

  return map;
}
