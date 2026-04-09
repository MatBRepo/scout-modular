"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

/* ===== FORM CONTEXTS – identical to RequiredFieldsPage ===== */

export type FormContext =
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

/* ===== Default Requirements – IDENTICAL to RequiredFieldsPage ===== */

export const DEFAULT_REQUIRED: Record<string, boolean> = {
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

  // observation_new (AddPlayer – observation section)
  "observation_new.match": true,
  "observation_new.date": true,
  "observation_new.time": false,
  "observation_new.opponentLevel": false,
  "observation_new.mode": false,
  "observation_new.status": false,

  // observations_main (ObservationEditor)
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
  "player_editor_basic_unknown.unknownNote": false,

  // PlayerEditor – field profile
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

  // PlayerEditor – health & stats
  "player_editor_ext_stats365.injuryHistory": false,
  "player_editor_ext_stats365.minutes365": false,
  "player_editor_ext_stats365.starts365": false,
  "player_editor_ext_stats365.subs365": false,
  "player_editor_ext_stats365.goals365": false,

  // PlayerEditor – contact & social
  "player_editor_contact.phone": false,
  "player_editor_contact.email": false,
  "player_editor_contact.fb": false,
  "player_editor_contact.ig": false,
  "player_editor_contact.tiktok": false,

  // PlayerEditor – rating
  "player_editor_grade.notes": false,
  "player_editor_grade.finalComment": false,
};

/* ===== Key Helper ===== */

export function makeKey(context: FormContext | string, fieldKey: string) {
  return `${context}.${fieldKey}`;
}

type DbRow = {
  context: string;
  field_key: string;
  required: boolean;
};

/* ===========================================================
 *  useRequiredFields – hook used in AddPlayer / ObservationEditor
 * ========================================================= */

export function useRequiredFields() {
  const [requiredMap, setRequiredMap] = useState<Record<string, boolean>>(
    () => ({ ...DEFAULT_REQUIRED })
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("field_requirements")
          .select("context, field_key, required");

        if (cancelled) return;

        if (error) {
          console.error("[useRequiredFields] load error", error);
          // fallback to defaults
          setRequiredMap({ ...DEFAULT_REQUIRED });
        } else if (!data || data.length === 0) {
          // no rows → also fallback
          setRequiredMap({ ...DEFAULT_REQUIRED });
        } else {
          const next: Record<string, boolean> = { ...DEFAULT_REQUIRED };
          for (const row of data as DbRow[]) {
            const key = makeKey(row.context, row.field_key);
            next[key] = !!row.required;
          }
          setRequiredMap(next);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[useRequiredFields] exception while load:", e);
          setRequiredMap({ ...DEFAULT_REQUIRED });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Listen for event from RequiredFieldsPage
    const handleUpdated = () => {
      load();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("required-fields-updated", handleUpdated);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("required-fields-updated", handleUpdated);
      }
    };
  }, []);

  const isRequiredField = useCallback(
    (context: FormContext | string, fieldKey: string) => {
      const key = makeKey(context, fieldKey);
      if (key in requiredMap) return requiredMap[key];
      return DEFAULT_REQUIRED[key] ?? false;
    },
    [requiredMap]
  );

  return { isRequiredField, loading };
}
