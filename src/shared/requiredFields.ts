// src/shared/requiredFields.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

/* ================== Typy & helpery ================== */

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

export type RequiredMap = Record<string, boolean>;

export function makeFieldKey(context: FormContext, fieldKey: string) {
  return `${context}.${fieldKey}`;
}

/* ================== Domyślne wymagalności ================== */

export const DEFAULT_REQUIRED: RequiredMap = {
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

const STORAGE_KEY = "s4s.fieldRequirements";

let inMemoryMap: RequiredMap | null = null;
let loadingPromise: Promise<RequiredMap> | null = null;

type DbRow = {
  context: string;
  field_key: string;
  required: boolean;
};

/* ================== Fetch z Supabase + cache ================== */

async function fetchFromSupabase(): Promise<RequiredMap> {
  const base: RequiredMap = { ...DEFAULT_REQUIRED };

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("field_requirements")
      .select("context, field_key, required");

    if (error || !data) {
      console.warn("[requiredFields] using DEFAULT_REQUIRED (load error)", error);
      return base;
    }

    for (const row of data as DbRow[]) {
      const ctx = row.context as FormContext;
      const key = makeFieldKey(ctx, row.field_key);
      base[key] = !!row.required;
    }

    return base;
  } catch (err) {
    console.error("[requiredFields] exception while load:", err);
    return base;
  }
}

export async function loadRequiredMap(): Promise<RequiredMap> {
  if (inMemoryMap) return inMemoryMap;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    // 1) spróbuj z localStorage
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as RequiredMap;
          inMemoryMap = { ...DEFAULT_REQUIRED, ...parsed };
          return inMemoryMap;
        }
      } catch (e) {
        console.warn("[requiredFields] localStorage parse error:", e);
      }
    }

    // 2) Supabase + fallback
    const fromDb = await fetchFromSupabase();
    inMemoryMap = fromDb;

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fromDb));
      } catch {
        /* ignore */
      }
    }

    return inMemoryMap!;
  })();

  return loadingPromise;
}

/* ================== Hook do użycia w formularzach ================== */

export function useRequiredFields() {
  const [map, setMap] = useState<RequiredMap | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RequiredMap;
      return { ...DEFAULT_REQUIRED, ...parsed };
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(!map);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const loaded = await loadRequiredMap();
      if (!cancelled) {
        setMap(loaded);
        setLoading(false);
      }
    }

    if (!map) {
      load();
    }

    function handleUpdated() {
      load();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("required-fields-updated", handleUpdated);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("required-fields-updated", handleUpdated);
      }
    };
  }, [map]);

  const isRequiredField = useCallback(
    (context: FormContext, fieldKey: string) => {
      const key = makeFieldKey(context, fieldKey);
      const source = map || DEFAULT_REQUIRED;
      return source[key] ?? DEFAULT_REQUIRED[key] ?? false;
    },
    [map]
  );

  return {
    requiredMap: map || DEFAULT_REQUIRED,
    loading,
    isRequiredField,
  };
}
