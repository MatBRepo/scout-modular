// src/app/admin/manage/required-fields/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ToolbarFull } from "@/shared/ui/atoms";
import { getSupabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
          <span className="hidden md:inline">Saving settings…</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="hidden md:inline">Settings saved</span>
        </>
      )}
    </span>
  );
}

/* ===== Field definitions in forms ===== */
const FORM_DEFS: FormDef[] = [
  {
    id: "player_basic_known",
    label: "AddPlayer – known player",
    description:
      "Form used when you know the player's personal details (first name, last name, birth year).",
    highlight: "AddPlayerPage – \"I know the player\" mode.",
    fields: [
      { key: "firstName", label: "First Name", description: "E.g. John." },
      { key: "lastName", label: "Last Name", description: "E.g. Doe." },
      {
        key: "birthYear",
        label: "Birth Year",
        description: "E.g. 2005. Used to calculate age.",
      },
      {
        key: "club",
        label: "Current Club",
        description: "The player's current club name.",
      },
      {
        key: "clubCountry",
        label: "Current Club Country",
        description: "E.g. Poland, Germany…",
      },
      {
        key: "jerseyNumber",
        label: "Jersey Number",
        description:
          "Optional – can be made required if you always want to have a number.",
      },
    ],
  },
  {
    id: "player_basic_unknown",
    label: "AddPlayer – unknown player",
    description:
      "Form used when you don't know the player's personal details (observation by number / club).",
    highlight: "AddPlayerPage – \"I don't know the player\" mode.",
    fields: [
      {
        key: "jerseyNumber_unknown",
        label: "Jersey Number",
        description: "E.g. 27.",
      },
      {
        key: "uClub",
        label: "Current Club",
        description: "The player's club name.",
      },
      {
        key: "uClubCountry",
        label: "Current Club Country",
        description: "E.g. Poland, England…",
      },
      {
        key: "uNote",
        label: "Own Note",
        description:
          "Short description of the player / observation context. Can be optional.",
      },
    ],
  },
  {
    id: "observation_new",
    label: "AddPlayer – \"New Observation\" section",
    description:
      "The \"New Observation\" section inside the add player form.",
    highlight: "\"Observations\" panel in AddPlayerPage.",
    fields: [
      {
        key: "match",
        label: "Match",
        description: "Match text, e.g. \"Lech U19 vs Wisla U19\".",
      },
      {
        key: "date",
        label: "Match Date",
        description: "Date field, used for sorting and preview.",
      },
      {
        key: "time",
        label: "Match Time",
        description: "Optional – useful for precise logging.",
      },
      {
        key: "opponentLevel",
        label: "Opponent Level",
        description: "E.g. CLJ U17, 3rd division, top academy…",
      },
      {
        key: "mode",
        label: "Mode (Live / TV)",
        description: "Whether the observation was live or from TV / video.",
      },
      {
        key: "status",
        label: "Status (Draft / Final)",
        description: "You can force a status to always be selected.",
      },
    ],
  },
  {
    id: "observations_main",
    label: "ObservationEditor – main form",
    description:
      "Configuration of field requirements in the main observation form.",
    highlight:
      "Used in ObservationEditor (observation view – teams, date, players etc.).",
    fields: [
      {
        key: "teamA",
        label: "Team A",
        description: "First team in the match.",
      },
      {
        key: "teamB",
        label: "Team B",
        description: "Second team in the match.",
      },
      {
        key: "reportDate",
        label: "Match Date",
        description: "Date used for sorting and reports.",
      },
      {
        key: "time",
        label: "Match Time",
        description: "Match start time (optional).",
      },
      {
        key: "conditions",
        label: "Match Mode (Live / TV)",
        description: "Whether the observation was live or from a broadcast.",
      },
      {
        key: "competition",
        label: "League / Tournament",
        description: "Competition name (e.g. CLJ U19, Polish Cup).",
      },
      {
        key: "players",
        label: "Player List",
        description:
          "Whether at least one player is required in the observation.",
      },
      {
        key: "note",
        label: "General Note",
        description: "Textual note for the entire observation.",
      },
    ],
  },
  {
    id: "player_editor_basic_known",
    label: "PlayerEditor – basic (known)",
    description:
      "Basic section in the player editor – when the profile is known (first name, last name).",
    highlight: "PlayerEditorPage – \"Basic Information\" section (known).",
    fields: [
      {
        key: "firstName",
        label: "First Name",
        description: "`firstName` field from PlayerEditor (known player).",
      },
      {
        key: "lastName",
        label: "Last Name",
        description: "`lastName` field from PlayerEditor (known player).",
      },
      {
        key: "birthYear",
        label: "Birth Year",
        description: "ext.birthYear – birth year used for age.",
      },
      {
        key: "club",
        label: "Current Club",
        description: "`club` field from PlayerEditor.",
      },
      {
        key: "clubCountry",
        label: "Current Club Country",
        description: "ext.clubCountry – player's club country.",
      },
      {
        key: "jerseyNumber",
        label: "Jersey Number",
        description: "ext.jerseyNumber – jersey number (optional).",
      },
    ],
  },
  {
    id: "player_editor_basic_unknown",
    label: "PlayerEditor – basic (unknown)",
    description:
      "Basic section in the editor when the profile is treated as unknown (lack of first/last name).",
    highlight:
      "PlayerEditorPage – \"Basic Information\" section (unknown profile).",
    fields: [
      {
        key: "jerseyNumber",
        label: "Jersey Number",
        description: "ext.jerseyNumber – number by which you recognize the player.",
      },
      {
        key: "club",
        label: "Current Club",
        description: "`club` field from PlayerEditor.",
      },
      {
        key: "clubCountry",
        label: "Current Club Country",
        description: "ext.clubCountry – player's club country.",
      },
      {
        key: "unknownNote",
        label: "Own Note (unknown)",
        description:
          "ext.unknownNote – description for unknown profile.",
      },
    ],
  },
  {
    id: "player_editor_ext_profile",
    label: "PlayerEditor – on-pitch profile",
    description:
      "\"On-pitch Profile\" tab in the Extended Information section (height, weight, positions).",
    highlight: "PlayerEditorPage – ExtContent(view=\"profile\").",
    fields: [
      { key: "height", label: "Height (cm)" },
      { key: "weight", label: "Weight (kg)" },
      { key: "dominantFoot", label: "Dominant Foot" },
      { key: "mainPos", label: "Main Position" },
      {
        key: "altPositions",
        label: "Alternative Positions",
        description: "List of alternative positions (ext.altPositions).",
      },
    ],
  },
  {
    id: "player_editor_ext_eligibility",
    label: "PlayerEditor – status & scouting",
    description:
      "\"Status & scouting\" tab – EU passport, contract, agency, links.",
    highlight: "PlayerEditorPage – ExtContent(view=\"eligibility\").",
    fields: [
      { key: "english", label: "English Proficiency" },
      { key: "euPassport", label: "EU Passport" },
      { key: "birthCountry", label: "Birth Country" },
      { key: "contractStatus", label: "Contract Status" },
      { key: "agency", label: "Management Agency" },
      { key: "releaseClause", label: "Release Clause" },
      { key: "leagueLevel", label: "Current Club League Level" },
      { key: "clipsLinks", label: "Clip Links / Time-codes" },
      { key: "transfermarkt", label: "Transfermarkt Link" },
      { key: "wyscout", label: "Wyscout Link" },
    ],
  },
  {
    id: "player_editor_ext_stats365",
    label: "PlayerEditor – health & statistics",
    description:
      "\"Health & statistics\" tab – injury history, minutes, goals, etc.",
    highlight: "PlayerEditorPage – ExtContent(view=\"stats365\").",
    fields: [
      { key: "injuryHistory", label: "Injury History" },
      { key: "minutes365", label: "Minutes in last 365 days" },
      { key: "starts365", label: "Matches as starter" },
      { key: "subs365", label: "Matches as substitute" },
      { key: "goals365", label: "Goals in last 365 days" },
    ],
  },
  {
    id: "player_editor_contact",
    label: "PlayerEditor – contact & social",
    description:
      "\"Contact & social\" tab – phone, email, and social links.",
    highlight: "PlayerEditorPage – ExtContent(view=\"contact\").",
    fields: [
      { key: "phone", label: "Contact Phone" },
      { key: "email", label: "Contact Email" },
      { key: "fb", label: "FB Link" },
      { key: "ig", label: "IG Link" },
      { key: "tiktok", label: "TikTok Link" },
    ],
  },
  {
    id: "player_editor_grade",
    label: "PlayerEditor – rating",
    description:
      "\"Rating\" tab – target level and summary. Categories 1–5 are configured separately in the ratings panel.",
    highlight: "PlayerEditorPage – \"Rating\" section.",
    fields: [
      {
        key: "notes",
        label: "Target Level (notes)",
        description:
          "grade.notes / meta.targetLevel field – target level description.",
      },
      {
        key: "finalComment",
        label: "Summary (finalComment)",
        description:
          "grade.finalComment / meta.finalSummary field – final recommendation.",
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
    label: "Adding a player",
    items: ["player_basic_known", "player_basic_unknown", "observation_new"],
  },
  {
    id: "observations",
    label: "Observations",
    items: ["observations_main"],
  },
  {
    id: "player_basic",
    label: "Player Editor – Basic",
    items: ["player_editor_basic_known", "player_editor_basic_unknown"],
  },
  {
    id: "player_ext",
    label: "Player Editor – Extended",
    items: [
      "player_editor_ext_profile",
      "player_editor_ext_eligibility",
      "player_editor_ext_stats365",
      "player_editor_contact",
      "player_editor_grade",
    ],
  },
];

/* ===== Default requirements (fallback if nothing in database) ===== */

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

  // PlayerEditor – basic (known)
  "player_editor_basic_known.firstName": true,
  "player_editor_basic_known.lastName": true,
  "player_editor_basic_known.birthYear": true,
  "player_editor_basic_known.club": true,
  "player_editor_basic_known.clubCountry": true,
  "player_editor_basic_known.jerseyNumber": false,

  // PlayerEditor – basic (unknown)
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

  // "Active" form for global header purposes
  const [activeForm, setActiveForm] =
    useState<FormContext>("player_basic_known");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [requiredMap, setRequiredMap] = useState<Record<string, boolean>>({});

  // Accordion: first open by default, rest closed
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({
    addPlayer: true,
    observations: false,
    player_basic: false,
    player_ext: false,
  });

  // Tabs: which form is active in each group
  const [activeByGroup, setActiveByGroup] = useState<
    Record<string, FormContext>
  >({
    addPlayer: "player_basic_known",
    observations: "observations_main",
    player_basic: "player_editor_basic_known",
    player_ext: "player_editor_ext_profile",
  });

  const toggleGroupOpen = (id: string) => {
    setGroupsOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setActiveInGroup = (groupId: string, ctx: FormContext) => {
    setActiveByGroup((prev) => ({ ...prev, [groupId]: ctx }));
    setActiveForm(ctx);
  };

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
            "Failed to fetch configuration from Supabase – using default values."
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
          "An unexpected error occurred while fetching configuration."
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
    setSuccess("Restored default field requirements configuration.");
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
        setError("Failed to save configuration. Please try again.");
      } else {
        setSuccess("Field requirements configuration has been saved.");

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("required-fields-updated"));
        }
      }
    } catch (e) {
      console.error("[RequiredFieldsPage] exception while save:", e);
      setError("An unexpected error occurred while saving.");
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

  /* ======================== Render ======================== */

  const headerTitle = (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-xl font-semibold leading-none tracking-tight">
        Field Requirements in Forms
      </h2>
      <p className=" text-xs text-muted-foreground py-3">
        Set which fields in AddPlayer, PlayerEditor, and Observations must be
        filled before saving (including auto-save). These settings are global
        for the entire application.
      </p>
    </div>
  );

  const headerRight = (
    <div className="flex items-center gap-3">
      <SavePill state={saveState} size="compact" />

      <span className="hidden text-xs text-muted-foreground md:inline">
        {isDirty ? "You have unsaved changes" : "All changes saved"}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push("/admin/manage")}
        className="hidden h-8 rounded-md px-3 text-xs sm:inline-flex"
      >
        Back to management
      </Button>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="inline-flex h-8 w-8 rounded-md p-0 sm:hidden"
          aria-label="Back to management"
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
          Default
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
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <ToolbarFull title={headerTitle} right={headerRight} />

      {/* small status like in PlayerEditor – chips on the right, no gradients */}
      <Card className="rounded-md border border-stone-200 bg-card px-4 py-3 text-sm dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground sm:text-sm">
            The active requirement configuration affects validation in AddPlayer,
            PlayerEditor, and ObservationEditor.
          </p>
          <div className="flex flex-col items-end text-xs text-muted-foreground sm:text-sm">
            <span>
              Active form:{" "}
              <span className="font-medium text-foreground">
                {activeFormDef.label}
              </span>
            </span>
            <span className="mt-0.5 text-[10px]">
              {activeStats.required} of {activeStats.total} fields marked as{" "}
              <span className="font-medium text-foreground">required</span>
            </span>
            {activeStats.changed > 0 && (
              <span className="mt-0.5 inline-flex items-center rounded-md border border-amber-300 bg-background px-1.5 py-0.5 text-[10px] text-amber-800 dark:border-amber-500/70 dark:text-amber-200">
                Changed {activeStats.changed} fields relative to defaults
              </span>
            )}
          </div>
        </div>
      </Card>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading configuration from Supabase…
        </p>
      )}

      {/* ====================== SECTIONS (accordions) + TABS ====================== */}
      <div className="space-y-4">
        {FORM_GROUPS.map((group) => {
          const groupOpen = groupsOpen[group.id] ?? false;
          const groupActiveForm =
            activeByGroup[group.id] ?? group.items[0] ?? activeForm;

          // calculate required / total in the whole section (for accordion header)
          let groupTotal = 0;
          let groupRequired = 0;
          for (const ctx of group.items) {
            const form = FORM_DEF_BY_ID[ctx];
            for (const field of form.fields) {
              groupTotal += 1;
              const key = makeKey(form.id, field.key);
              const currentRequired =
                requiredMap[key] ?? DEFAULT_REQUIRED[key] ?? false;
              if (currentRequired) groupRequired += 1;
            }
          }

          return (
            <Card
              key={group.id}
              className="rounded-md border border-stone-200 bg-card dark:border-neutral-800"
            >
              <CardHeader
                className={cn(
                  "group flex items-center justify-between rounded-md border-b border-transparent p-0 transition-colors hover:bg-stone-50/80 dark:hover:bg-neutral-900/60",
                  groupOpen && "bg-stone-100/80 dark:bg-neutral-900/70"
                )}
              >
                <button
                  type="button"
                  aria-expanded={groupOpen}
                  onClick={() => toggleGroupOpen(group.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <div className={stepPillClass}>
                      Section · {group.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold leading-none tracking-tight">
                      Forms in this section
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select one of the forms (tabs below) to set its field
                      requirements.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pl-4">
                    <div className="flex flex-col items-end text-xs text-muted-foreground">
                      <span>
                        Required in section:{" "}
                        <span className="font-medium text-foreground">
                          {groupRequired}/{groupTotal}
                        </span>
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 transition-transform",
                        groupOpen ? "rotate-180" : "rotate-0"
                      )}
                    />
                  </div>
                </button>
              </CardHeader>

              {groupOpen && (
                <CardContent className="px-3 py-3 md:px-4">
                  <Tabs
                    value={groupActiveForm}
                    onValueChange={(value) =>
                      setActiveInGroup(group.id, value as FormContext)
                    }
                  >
                    {/* Tabs – form tiles (AddPlayer – known / unknown / etc.) */}
                    <TabsList className="flex flex-wrap gap-2 rounded-md bg-transparent p-0">
                      {group.items.map((ctx) => {
                        const form = FORM_DEF_BY_ID[ctx];

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

                        const isActive = groupActiveForm === ctx;

                        return (
                          <TabsTrigger
                            key={ctx}
                            value={ctx}
                            className={cn(
                              "flex min-w-[220px] max-w-xs flex-1 flex-col items-stretch justify-start rounded-md border bg-background px-3 py-2 text-left text-sm font-normal outline-none transition",
                              isActive
                                ? "border-stone-900 text-foreground dark:border-neutral-100"
                                : "border-stone-200 text-stone-700 hover:border-stone-300 dark:border-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-700"
                            )}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="line-clamp-1 font-medium">
                                {form.label}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-stone-200 px-2 py-0.5 text-[10px] text-stone-600 dark:border-neutral-700 dark:text-neutral-300">
                                {requiredCount}/{total} required
                              </span>
                            </div>
                            {form.highlight && (
                              <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                                {form.highlight}
                              </p>
                            )}
                            {changed && (
                              <span className="mt-0.5 text-[9px] text-amber-700 dark:text-amber-300">
                                • Changed relative to defaults
                              </span>
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    {/* Content dla każdego formularza w grupie */}
                    {group.items.map((ctx) => {
                      const form = FORM_DEF_BY_ID[ctx];

                      let total = form.fields.length;
                      let requiredCount = 0;
                      let changedCount = 0;

                      for (const field of form.fields) {
                        const key = makeKey(form.id, field.key);
                        const currentRequired =
                          requiredMap[key] ?? DEFAULT_REQUIRED[key] ?? false;
                        const defaultRequired =
                          DEFAULT_REQUIRED[key] ?? false;

                        if (currentRequired) requiredCount += 1;
                        if (currentRequired !== defaultRequired)
                          changedCount += 1;
                      }

                      return (
                        <TabsContent
                          key={ctx}
                          value={ctx}
                          className="mt-3 space-y-3"
                        >
                          {/* Header "Step 2" for a specific form */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-col gap-0.5">
                              <div className={stepPillClass}>
                                Step 2 · Field requirements
                              </div>
                              <div className="mt-1 text-sm font-semibold leading-none tracking-tight">
                                {form.label}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {form.description}
                              </p>
                              {form.highlight && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    App association:
                                  </span>{" "}
                                  {form.highlight}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                              <span>
                                Required fields:{" "}
                                <span className="font-medium text-foreground">
                                  {requiredCount}/{total}
                                </span>
                              </span>
                              {changedCount > 0 && (
                                <span className="text-[10px]">
                                  Changed:{" "}
                                  <span className="font-medium text-foreground">
                                    {changedCount}
                                  </span>
                                </span>
                              )}
                              <div className="mt-1 flex gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={loading || saving}
                                  onClick={() => setAllInForm(ctx, true)}
                                  className="h-7 rounded-md px-2 text-[10px]"
                                >
                                  All required
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={loading || saving}
                                  onClick={() => setAllInForm(ctx, false)}
                                  className="h-7 rounded-md px-2 text-[10px]"
                                >
                                  All optional
                                </Button>
                              </div>
                            </div>
                          </div>

                          <Separator className="my-1" />

                          {/* Field list – tiles like mini-ExtContent */}
                          <div className="space-y-1.5">
                            {form.fields.length === 0 ? (
                              <div className="rounded-md border border-dashed border-stone-200 bg-background px-4 py-6 text-center text-sm text-muted-foreground dark:border-neutral-800">
                                No fields defined for this form.
                              </div>
                            ) : (
                              form.fields.map((field) => {
                                const key = makeKey(form.id, field.key);
                                const required = isRequired(form.id, field.key);
                                const defaultRequired =
                                  DEFAULT_REQUIRED[key] ?? false;
                                const isDefaultRequired = defaultRequired;
                                const changed =
                                  required !== defaultRequired;

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
                                          {required
                                            ? "Required"
                                            : "Optional"}
                                        </span>
                                        {changed && (
                                          <span className="rounded-md border border-amber-300 px-1.5 py-0.5 text-[9px] text-amber-800 dark:border-amber-500/70 dark:text-amber-200">
                                            Changed
                                          </span>
                                        )}
                                        {isDefaultRequired &&
                                          !changed &&
                                          required && (
                                            <span className="rounded-md border border-stone-300 px-1.5 py-0.5 text-[9px] text-stone-600 dark:border-neutral-600 dark:text-neutral-300">
                                              Required by default
                                            </span>
                                          )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                        <span>
                                          Key:{" "}
                                          <code className="rounded-md bg-muted px-1 py-0.5">
                                            {field.key}
                                          </code>
                                        </span>
                                        {field.description && (
                                          <span>{field.description}</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Minimalist "switch" */}
                                    <div className="flex flex-col items-end gap-1">
                                      <button
                                        type="button"
                                        disabled={loading || saving}
                                        onClick={() =>
                                          toggleRequired(form.id, field.key)
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
                                          ? "Set as optional"
                                          : "Set as required"}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* info + global status / errors / success */}
      <div className="space-y-2 text-xs text-muted-foreground sm:text-sm">
        <p>
          These settings are used by the AddPlayer, PlayerEditor, and
          Observations forms to verify requirements before saving (including
          auto-save).
        </p>
        {isDirty && (
          <span className="inline-flex items-center rounded-md border border-amber-300 bg-background px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-500/70 dark:text-amber-200">
            You have unsaved changes – click "Save".
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
    </div>
  );
}
