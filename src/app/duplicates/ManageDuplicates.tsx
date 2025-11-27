// app/duplicates/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Lock,
  UserCircle2,
  Info as InfoIcon,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

/* ======================== Types ======================== */
type Role = "admin" | "scout" | "scout-agent";

type BasePlayer = {
  id: number | string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string; // YYYY-MM-DD
  pos: "GK" | "DF" | "MF" | "FW";
  age?: number;
  nationality?: string;
  status?: "active" | "trash";
  photo?: string;
};

type AllPlayer = BasePlayer & {
  scoutId: string; // who added it
  scoutName?: string; // optional display
  duplicateOf?: number | string | null; // if marked as duplicate -> keeper id
  globalId?: number | null; // canonical id in global DB (if linked/merged)
};

type GlobalPlayer = {
  id: number;
  key: string; // normalized name (see dupKey)
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  pos: "GK" | "DF" | "MF" | "FW";
  age?: number;
  nationality?: string;
  photo?: string;
  createdAt: string;
  sources: { playerId: AllPlayer["id"]; scoutId: string }[];
};

/** Dane kanoniczne, które Admin widzi/edytuje w panelu „Dane końcowe” */
type CanonicalData = {
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  pos: "GK" | "DF" | "MF" | "FW";
  age?: number;
  nationality?: string;
  photo?: string;
};

/** Raw row shape from Supabase view: players_admin_view */
type DbAllPlayerRow = {
  id: number | string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  pos: "GK" | "DF" | "MF" | "FW" | null;
  age: number | null;
  nationality: string | null;
  status: "active" | "trash" | null;
  photo: string | null;
  scout_id: string;
  scout_name: string | null;
  duplicate_of: number | string | null;
  global_id: number | null;
};

/** Raw row shape from Supabase: global_players */
type DbGlobalPlayerRow = {
  id: number;
  key: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  pos: "GK" | "DF" | "MF" | "FW" | null;
  age: number | null;
  nationality: string | null;
  photo: string | null;
  created_at: string;
  sources: { playerId: AllPlayer["id"]; scoutId: string }[] | null;
};

/* ======================== Utils ======================== */
function normalizeName(s: string) {
  return (s || "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Klucz duplikatu – *tylko* nazwa, bez daty urodzenia */
function dupKey(p: { name: string; birthDate?: string }) {
  return normalizeName(p.name);
}

function completenessScore(p: AllPlayer) {
  let s = 0;
  if (p.firstName) s += 1;
  if (p.lastName) s += 1;
  if (p.birthDate) s += 1;
  if (p.photo) s += 1;
  return s; // 0–4
}

function prettyDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function fmtTime(ts?: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

/* Mapping helpers */
function mapAllRow(r: DbAllPlayerRow): AllPlayer {
  return {
    id: r.id,
    name: r.name,
    firstName: r.first_name || undefined,
    lastName: r.last_name || undefined,
    birthDate: r.birth_date || undefined,
    pos: (r.pos as any) || "MF",
    age: r.age ?? undefined,
    nationality: r.nationality || undefined,
    status: (r.status as any) ?? "active",
    photo: r.photo || undefined,
    scoutId: r.scout_id,
    scoutName: r.scout_name || undefined,
    duplicateOf: r.duplicate_of ?? null,
    globalId: r.global_id ?? null,
  };
}

function mapGlobalRow(r: DbGlobalPlayerRow): GlobalPlayer {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    firstName: r.first_name || undefined,
    lastName: r.last_name || undefined,
    birthDate: r.birth_date || undefined,
    pos: (r.pos as any) || "MF",
    age: r.age ?? undefined,
    nationality: r.nationality || undefined,
    photo: r.photo || undefined,
    createdAt: r.created_at,
    sources: Array.isArray(r.sources) ? r.sources : [],
  };
}

/* ======================== Page ======================== */
export default function DuplicatesPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [rows, setRows] = useState<AllPlayer[]>([]);
  const [globals, setGlobals] = useState<GlobalPlayer[]>([]);
  const [q, setQ] = useState("");
  const [keeperByKey, setKeeperByKey] = useState<
    Record<string, AllPlayer["id"] | null>
  >({});
  const [canonicalByKey, setCanonicalByKey] = useState<
    Record<string, CanonicalData>
  >({});
  const [selectedDuplicatesByKey, setSelectedDuplicatesByKey] = useState<
    Record<string, AllPlayer["id"][]>
  >({});
  const [includeTrashed, setIncludeTrashed] = useState(false);
  const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(true);
  const [details, setDetails] = useState<AllPlayer | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === "admin";

  /* ---------- Auth + rola z Supabase ---------- */
  useEffect(() => {
    const run = async () => {
      setAuthLoading(true);
      try {
        const supabase = getSupabase();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setRole("scout");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError || !profile?.role) {
          setRole("scout");
          return;
        }

        const r = profile.role as Role;
        if (r === "admin" || r === "scout" || r === "scout-agent") {
          setRole(r);
        } else {
          setRole("scout");
        }
      } catch (e) {
        console.error("Error resolving role from Supabase:", e);
        setRole("scout");
      } finally {
        setAuthLoading(false);
      }
    };
    run();
  }, []);

  /* ---------- loader z Supabase (tylko dla admina) ---------- */
  const loadData = useCallback(async () => {
    if (!isAdmin) return; // nie męcz Supabase jeśli user nie jest adminem

    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();

      // 1) all players across scouts
      const { data: allData, error: allError } = await supabase
        .from("players_admin_view")
        .select("*");

      if (allError) throw allError;

      const allPlayers: AllPlayer[] = (allData || []).map((r: any) =>
        mapAllRow(r as DbAllPlayerRow)
      );
      setRows(allPlayers);

      // 2) global canonical players
      const { data: gData, error: gError } = await supabase
        .from("global_players")
        .select("*");

      if (gError) throw gError;

      const glob: GlobalPlayer[] = (gData || []).map((r: any) =>
        mapGlobalRow(r as DbGlobalPlayerRow)
      );
      setGlobals(glob);

      setLastRefreshAt(nowIso());
      // reset helper state – odświeżone dane = nowe grupy
      setKeeperByKey({});
      setCanonicalByKey({});
      setSelectedDuplicatesByKey({});
    } catch (e: any) {
      console.error("Error loading duplicates data:", e);
      setError(
        e?.message ||
          "Nie udało się pobrać danych duplikatów z Supabase (players_admin_view / global_players)."
      );
      setRows([]);
      setGlobals([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // initial load – dopiero po rozpoznaniu roli
  useEffect(() => {
    if (isAdmin && !authLoading) {
      loadData();
    }
  }, [isAdmin, authLoading, loadData]);

  // recompute groups
  const groups = useMemo(() => {
    const pool = rows.filter((p) =>
      includeTrashed ? true : (p.status ?? "active") === "active"
    );
    const map = new Map<string, AllPlayer[]>();
    for (const p of pool) {
      const key = dupKey(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    let arr = Array.from(map.entries())
      .map(([key, list]) => ({ key, list }))
      .filter((g) => g.list.length >= 2);

    if (showOnlyUnresolved) {
      arr = arr.filter((g) => {
        const marked = g.list.filter((p) => !!p.duplicateOf);
        return marked.length < g.list.length - 1;
      });
    }

    const qq = q.trim().toLowerCase();
    if (qq) {
      arr = arr.filter((g) =>
        g.list.some(
          (p) =>
            p.name.toLowerCase().includes(qq) ||
            (p.firstName || "").toLowerCase().includes(qq) ||
            (p.lastName || "").toLowerCase().includes(qq) ||
            (p.scoutName || "").toLowerCase().includes(qq)
        )
      );
    }

    arr.sort((a, b) => {
      const d = b.list.length - a.list.length;
      if (d !== 0) return d;
      const an = a.list[0]?.name?.toLowerCase() ?? "";
      const bn = b.list[0]?.name?.toLowerCase() ?? "";
      return an.localeCompare(bn);
    });

    return arr;
  }, [rows, q, includeTrashed, showOnlyUnresolved]);

  // default keeper per group based on completeness
  useEffect(() => {
    setKeeperByKey((prev) => {
      const next: Record<string, AllPlayer["id"] | null> = { ...prev };
      for (const g of groups) {
        if (!(g.key in next)) {
          const best = [...g.list].sort(
            (a, b) => completenessScore(b) - completenessScore(a)
          )[0];
          next[g.key] = best?.id ?? null;
        }
      }
      return next;
    });
  }, [groups]);

  // inicjalne „Dane końcowe” per grupa – bazujemy na keeperze (lub najlepszym rekordzie)
  useEffect(() => {
    setCanonicalByKey((prev) => {
      const next: Record<string, CanonicalData> = { ...prev };
      for (const g of groups) {
        if (!next[g.key]) {
          const keeperId = keeperByKey[g.key];
          const base =
            g.list.find((p) => p.id === keeperId) ??
            [...g.list].sort(
              (a, b) => completenessScore(b) - completenessScore(a)
            )[0];
          if (base) {
            next[g.key] = {
              name: base.name,
              firstName: base.firstName,
              lastName: base.lastName,
              birthDate: base.birthDate,
              pos: base.pos,
              age: base.age,
              nationality: base.nationality,
              photo: base.photo,
            };
          }
        }
      }
      return next;
    });
  }, [groups, keeperByKey]);

  // inicjalna lista zaznaczonych duplikatów: domyślnie wszystkie poza keeperem
  useEffect(() => {
    setSelectedDuplicatesByKey((prev) => {
      const next: Record<string, AllPlayer["id"][]> = { ...prev };
      for (const g of groups) {
        if (!next[g.key]) {
          const keeperId = keeperByKey[g.key];
          const defaults = g.list
            .filter((p) => p.id !== keeperId)
            .map((p) => p.id);
          next[g.key] = defaults;
        }
      }
      return next;
    });
  }, [groups, keeperByKey]);

  async function runRefresh() {
    await loadData();
  }

  function selectKeeper(groupKey: string, player: AllPlayer) {
    setKeeperByKey((prev) => ({ ...prev, [groupKey]: player.id }));
    setCanonicalByKey((prev) => ({
      ...prev,
      [groupKey]: {
        name: player.name,
        firstName: player.firstName,
        lastName: player.lastName,
        birthDate: player.birthDate,
        pos: player.pos,
        age: player.age,
        nationality: player.nationality,
        photo: player.photo,
      },
    }));
    setSelectedDuplicatesByKey((prev) => ({
      ...prev,
      [groupKey]: (prev[groupKey] ?? []).filter((id) => id !== player.id),
    }));
  }

  function toggleDuplicateSelection(groupKey: string, playerId: AllPlayer["id"]) {
    setSelectedDuplicatesByKey((prev) => {
      const current = new Set(prev[groupKey] ?? []);
      if (current.has(playerId)) {
        current.delete(playerId);
      } else {
        current.add(playerId);
      }
      return {
        ...prev,
        [groupKey]: Array.from(current),
      };
    });
  }

  async function markDuplicatesToKeeper(key: string) {
    const g = groups.find((x) => x.key === key);
    if (!g) return;
    const keeperId = keeperByKey[key];
    if (!keeperId) return;

    const supabase = getSupabase();
    setSaving(true);
    setError(null);

    try {
      const selectedIds = (selectedDuplicatesByKey[key] ?? []).filter(
        (id) => id !== keeperId
      );

      // jeśli nic nie zaznaczone – fallback jak dawniej: wszystkie poza keeperem
      const otherIds =
        selectedIds.length > 0
          ? selectedIds
          : g.list.filter((p) => p.id !== keeperId).map((p) => p.id);

      if (otherIds.length > 0) {
        const { error: upd1 } = await supabase
          .from("players")
          .update({ duplicate_of: keeperId as any })
          .in("id", otherIds as any[]);
        if (upd1) throw upd1;
      }

      const { error: upd2 } = await supabase
        .from("players")
        .update({ duplicate_of: null })
        .eq("id", keeperId as any);
      if (upd2) throw upd2;

      await loadData();
    } catch (e: any) {
      console.error("Error marking duplicates:", e);
      setError("Nie udało się oznaczyć duplikatów w Supabase.");
    } finally {
      setSaving(false);
    }
  }

  // helper budujący dane kanoniczne (połączone z keeperem, jeśli czegoś brakuje)
  function buildCanonicalForGroup(key: string, g: { list: AllPlayer[] }) {
    const keeperId = keeperByKey[key] ?? g.list[0].id;
    const keeper =
      g.list.find((p) => p.id === keeperId) ??
      [...g.list].sort(
        (a, b) => completenessScore(b) - completenessScore(a)
      )[0];

    const canon = canonicalByKey[key];

    const merged: CanonicalData & { name: string } = {
      name: (canon?.name || keeper.name || "").trim(),
      firstName: canon?.firstName ?? keeper.firstName,
      lastName: canon?.lastName ?? keeper.lastName,
      birthDate: canon?.birthDate ?? keeper.birthDate,
      pos: (canon?.pos ?? keeper.pos) as "GK" | "DF" | "MF" | "FW",
      age: canon?.age ?? keeper.age,
      nationality: canon?.nationality ?? keeper.nationality,
      photo: canon?.photo ?? keeper.photo,
    };

    return { keeper, merged };
  }

  async function mergeGroupToGlobal(key: string) {
    const g = groups.find((x) => x.key === key);
    if (!g || g.list.length === 0) return;

    const { keeper, merged } = buildCanonicalForGroup(key, g);

    const supabase = getSupabase();
    setSaving(true);
    setError(null);

    try {
      // check existing global by key
      let existingGlobal = globals.find((gp) => gp.key === key);
      let globalId = existingGlobal?.id;

      const newSources = g.list.map((p) => ({
        playerId: p.id,
        scoutId: p.scoutId,
      }));

      if (!existingGlobal) {
        // create new global row
        const insertPayload = {
          key,
          name: merged.name,
          first_name: merged.firstName ?? null,
          last_name: merged.lastName ?? null,
          birth_date: merged.birthDate ?? null,
          pos: merged.pos,
          age: merged.age ?? null,
          nationality: merged.nationality ?? null,
          photo: merged.photo ?? null,
          created_at: nowIso(),
          sources: newSources,
        };

        const { data, error } = await supabase
          .from("global_players")
          .insert(insertPayload)
          .select("*")
          .single();

        if (error) throw error;
        const mapped = mapGlobalRow(data as DbGlobalPlayerRow);
        globalId = mapped.id;
      } else {
        // update existing global: merge sources + keep richest fields
        const srcIds = new Set(
          (existingGlobal.sources || []).map((s) => s.playerId)
        );
        const mergedSources = [
          ...existingGlobal.sources,
          ...newSources.filter((s) => !srcIds.has(s.playerId)),
        ];

        const updatePayload = {
          name: merged.name || existingGlobal.name,
          first_name:
            merged.firstName ?? existingGlobal.firstName ?? null,
          last_name: merged.lastName ?? existingGlobal.lastName ?? null,
          birth_date:
            merged.birthDate ?? existingGlobal.birthDate ?? null,
          pos: merged.pos ?? existingGlobal.pos,
          age: merged.age ?? existingGlobal.age ?? null,
          nationality:
            merged.nationality ?? existingGlobal.nationality ?? null,
          photo: merged.photo ?? existingGlobal.photo ?? null,
          sources: mergedSources,
        };

        const { error } = await supabase
          .from("global_players")
          .update(updatePayload)
          .eq("id", existingGlobal.id);

        if (error) throw error;
        globalId = existingGlobal.id;
      }

      if (!globalId)
        throw new Error("Brak ID globalnego zawodnika po scaleniu.");

      // update all players in this group: set global_id & duplicate_of
      const allIds = g.list.map((p) => p.id);
      const otherIds = g.list
        .filter((p) => p.id !== keeper.id)
        .map((p) => p.id);

      if (allIds.length) {
        const { error: updGlobal } = await supabase
          .from("players")
          .update({ global_id: globalId as any })
          .in("id", allIds as any[]);
        if (updGlobal) throw updGlobal;
      }

      if (otherIds.length) {
        const { error: updDup } = await supabase
          .from("players")
          .update({ duplicate_of: keeper.id as any })
          .in("id", otherIds as any[]);
        if (updDup) throw updDup;
      }

      // keeper -> duplicate_of null (for sure)
      const { error: updKeeper } = await supabase
        .from("players")
        .update({ duplicate_of: null })
        .eq("id", keeper.id as any);
      if (updKeeper) throw updKeeper;

      // 🔴 NAJWAŻNIEJSZE: nadpisz dane osobowe we wszystkich rekordach players wg "Danych końcowych"
      const keeperDetails = {
        name: merged.name,
        firstName: merged.firstName ?? null,
        lastName: merged.lastName ?? null,
        birthDate: merged.birthDate ?? null,
        pos: merged.pos,
        age: merged.age ?? null,
        nationality: merged.nationality ?? null,
        photo: merged.photo ?? null,
      };

      const { error: updDetails } = await supabase
        .from("players")
        .update(keeperDetails)
        .in("id", allIds as any[]);
      if (updDetails) throw updDetails;

      await loadData();
    } catch (e: any) {
      console.error("Error merging group to global:", e);
      setError("Nie udało się scalić grupy do globalnej bazy w Supabase.");
    } finally {
      setSaving(false);
    }
  }

  async function linkGroupToExistingGlobal(key: string, globalId: number) {
    const g = groups.find((x) => x.key === key);
    if (!g || g.list.length === 0) return;

    const { keeper, merged } = buildCanonicalForGroup(key, g);

    const supabase = getSupabase();
    setSaving(true);
    setError(null);

    try {
      const existingGlobal = globals.find((gp) => gp.id === globalId);
      if (!existingGlobal)
        throw new Error("Docelowy globalny rekord nie istnieje.");

      // update sources in global row
      const srcIds = new Set(
        (existingGlobal.sources || []).map((s) => s.playerId)
      );
      const extraSources = g.list
        .filter((p) => !srcIds.has(p.id))
        .map((p) => ({ playerId: p.id, scoutId: p.scoutId }));
      const mergedSources = [...existingGlobal.sources, ...extraSources];

      const { error: updGlobal } = await supabase
        .from("global_players")
        .update({
          name: merged.name || existingGlobal.name,
          first_name:
            merged.firstName ?? existingGlobal.firstName ?? null,
          last_name:
            merged.lastName ?? existingGlobal.lastName ?? null,
          birth_date:
            merged.birthDate ?? existingGlobal.birthDate ?? null,
          pos: merged.pos ?? existingGlobal.pos,
          age: merged.age ?? existingGlobal.age ?? null,
          nationality:
            merged.nationality ?? existingGlobal.nationality ?? null,
          photo: merged.photo ?? existingGlobal.photo ?? null,
          sources: mergedSources,
        })
        .eq("id", globalId);
      if (updGlobal) throw updGlobal;

      // link all in group to this global and set duplicate_of relative to keeper
      const allIds = g.list.map((p) => p.id);
      const otherIds = g.list
        .filter((p) => p.id !== keeper.id)
        .map((p) => p.id);

      if (allIds.length) {
        const { error: updPlayers } = await supabase
          .from("players")
          .update({ global_id: globalId as any })
          .in("id", allIds as any[]);
        if (updPlayers) throw updPlayers;
      }

      if (otherIds.length) {
        const { error: updDup } = await supabase
          .from("players")
          .update({ duplicate_of: keeper.id as any })
          .in("id", otherIds as any[]);
        if (updDup) throw updDup;
      }

      const { error: updKeeper } = await supabase
        .from("players")
        .update({ duplicate_of: null })
        .eq("id", keeper.id as any);
      if (updKeeper) throw updKeeper;

      // 🔴 Nadpisz dane osobowe wg "Danych końcowych"
      const keeperDetails = {
        name: merged.name,
        firstName: merged.firstName ?? null,
        lastName: merged.lastName ?? null,
        birthDate: merged.birthDate ?? null,
        pos: merged.pos,
        age: merged.age ?? null,
        nationality: merged.nationality ?? null,
        photo: merged.photo ?? null,
      };

      const { error: updDetails } = await supabase
        .from("players")
        .update(keeperDetails)
        .in("id", allIds as any[]);
      if (updDetails) throw updDetails;

      await loadData();
    } catch (e: any) {
      console.error("Error linking group to existing global:", e);
      setError("Nie udało się powiązać grupy z istniejącym globalnym rekordem.");
    } finally {
      setSaving(false);
    }
  }

  /* ======================== Render ======================== */

  if (authLoading) {
    return (
      <div className="w-full p-4 text-sm text-dark dark:text-neutral-300">
        Ładowanie uprawnień użytkownika…
      </div>
    );
  }

  return (
    <div className="w-full  mx-auto px-3 py-4 md:px-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Duplikaty</h1>
          <p className="text-sm text-dark">
            Wykrywa tych samych zawodników dodanych przez różnych scoutów. Tylko
            dla Administratora. Dane pochodzą z{" "}
            <code className="text-[11px]">players_admin_view</code> i{" "}
            <code className="text-[11px]">global_players</code> w Supabase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="btn-soft-hover h-9 border-gray-300 text-sm dark:border-neutral-700"
            onClick={runRefresh}
            title={
              lastRefreshAt
                ? `Ostatnie odświeżenie: ${fmtTime(lastRefreshAt)}`
                : "Odśwież teraz"
            }
            disabled={loading || saving || !isAdmin}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading || saving ? "animate-spin" : ""
              }`}
            />
            {loading ? "Ładuję…" : "Odśwież"}
            {lastRefreshAt ? ` (${fmtTime(lastRefreshAt)})` : ""}
          </Button>
          <Button
            asChild
            className="btn-soft-hover h-9 bg-gray-900 text-sm text-white hover:bg-gray-800"
          >
            <Link href="/scouts" title="Lista scoutów">
              <UserCircle2 className="mr-1 h-4 w-4" />
              Scoutsi
            </Link>
          </Button>
        </div>
      </div>

      {isAdmin && groups.length > 0 && (
        <div className="mb-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-100">
          <div className="flex items-start gap-2">
            <InfoIcon className="mt-[2px] h-4 w-4" />
            <div>
              <div className="font-medium text-[12px]">
                Jak używać widoku duplikatów?
              </div>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>
                  W pierwszej kolumnie wybierz <b>keepera</b> – rekord, który
                  traktujesz jako bazowy.
                </li>
                <li>
                  W kolumnie <b>„Duplikat?”</b> możesz zaznaczyć tylko te
                  rekordy, które chcesz oznaczyć jako duplikaty keepera (może
                  być kilka, nie wszystkie).
                </li>
                <li>
                  W panelu <b>„Dane końcowe”</b> nad tabelą możesz poprawić
                  dane. Zostaną one zapisane w{" "}
                  <code>global_players</code> i <b>nadpiszą</b> rekordy{" "}
                  <code>players</code> w tej grupie.
                </li>
              </ol>
              <p className="mt-1 text-[11px] text-indigo-900/70 dark:text-indigo-200/80">
                Zmiany w „Dane końcowe” zapisują się dopiero przy scalaniu /
                powiązaniu z globalem.
              </p>
            </div>
          </div>
        </div>
      )}

      {lastRefreshAt && (
        <div className="mb-2 text-xs text-dark">
          Ostatnie odświeżenie: <b>{fmtTime(lastRefreshAt)}</b>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {!isAdmin ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <div className="mx-auto mb-2 inline-flex h-9 w-9 w-9 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium">
            Dostęp tylko dla Administratora
          </div>
          <div className="mt-1 text-xs text-dark">
            Upewnij się, że w tabeli{" "}
            <code className="text-[11px]">profiles</code> Twoja rola to{" "}
            <b>admin</b>.
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Szukaj po nazwisku lub skaucie…"
                className="w-72 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
              <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <label className="inline-flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <input
                type="checkbox"
                checked={includeTrashed}
                onChange={(e) => setIncludeTrashed(e.target.checked)}
              />
              Pokaż także „Kosz”
            </label>
            <label className="inline-flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <input
                type="checkbox"
                checked={showOnlyUnresolved}
                onChange={(e) => setShowOnlyUnresolved(e.target.checked)}
              />
              Tylko nierozwiązane
            </label>
            <div className="ml-auto text-xs md:text-sm text-dark dark:text-neutral-300">
              Grupy: <b>{groups.length}</b>
            </div>
          </div>

          {groups.length === 0 && !loading ? (
            <div className="rounded-md border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
              <div className="flex flex-wrap items-center gap-2">
                <InfoIcon className="h-4 w-4 text-dark" />
                Brak potencjalnych duplikatów na podstawie danych w{" "}
                <code className="text-[11px]">players_admin_view</code>.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g, idx) => {
                const keeperId = keeperByKey[g.key] ?? null;
                const rep = [...g.list].sort(
                  (a, b) => completenessScore(b) - completenessScore(a)
                )[0];
                const existingGlobal = globals.find(
                  (gp) => gp.key === g.key
                );
                const allLinkedToGlobal = g.list.every(
                  (p) => !!p.globalId
                );
                const canonical = canonicalByKey[g.key];
                const selectedDupIds = selectedDuplicatesByKey[g.key] ?? [];
                const selectedCount = selectedDupIds.length;

                return (
                  <div
                    key={g.key}
                    className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-neutral-800">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {rep?.name || "Nieznany"} • ur.{" "}
                          {prettyDate(rep?.birthDate)} • {g.list.length}{" "}
                          wpis(y)
                        </div>
                        <div className="mt-0.5 text-[12px] text-dark">
                          Klucz grupy:{" "}
                          <code className="rounded-md bg-stone-100 px-1 py-0.5 dark:bg-neutral-900">
                            {g.key}
                          </code>{" "}
                          {existingGlobal && (
                            <span className="ml-2 inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                              Ma globalny wpis #{existingGlobal.id}
                            </span>
                          )}
                        </div>
                        {selectedCount > 0 && (
                          <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                            Zaznaczone duplikaty: <b>{selectedCount}</b>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* merge / link to global */}
                        {existingGlobal ? (
                          <Button
                            className="btn-soft-hover h-9 bg-indigo-600 text-xs sm:text-sm text-white hover:bg-indigo-700"
                            onClick={() =>
                              linkGroupToExistingGlobal(
                                g.key,
                                existingGlobal.id
                              )
                            }
                            disabled={allLinkedToGlobal || saving}
                            title="Powiąż wszystkie rekordy z istniejącym wpisem globalnym (z nadpisaniem danych wg „Danych końcowych”)"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="hidden sm:inline">
                              Powiąż z globalnym #{existingGlobal.id}
                            </span>
                            <span className="sm:hidden">Powiąż</span>
                          </Button>
                        ) : (
                          <Button
                            className="btn-soft-hover h-9 bg-indigo-600 text-xs sm:text-sm text-white hover:bg-indigo-700"
                            onClick={() => mergeGroupToGlobal(g.key)}
                            disabled={saving}
                            title="Scal i dodaj do Globalnej bazy (z nadpisaniem danych wg „Danych końcowych”)"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="hidden sm:inline">
                              Scal i dodaj do Globalnej bazy
                            </span>
                            <span className="sm:hidden">Scal do global</span>
                          </Button>
                        )}

                        {/* classic duplicate marking to keeper */}
                        <Button
                          className="btn-soft-hover h-9 bg-emerald-600 text-xs sm:text-sm text-white hover:bg-emerald-700"
                          onClick={() => markDuplicatesToKeeper(g.key)}
                          disabled={!keeperId || saving}
                          title="Oznacz zaznaczone rekordy jako duplikaty keepera"
                        >
                          Oznacz duplikaty (keeper)
                        </Button>
                        <Button
                          variant="outline"
                          className="btn-soft-hover h-9 border-gray-300 text-xs sm:text-sm hover:bg-stone-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                          onClick={() => {
                            setKeeperByKey((prev) => ({
                              ...prev,
                              [g.key]: null,
                            }));
                            setCanonicalByKey((prev) => {
                              const copy = { ...prev };
                              delete copy[g.key];
                              return copy;
                            });
                            setSelectedDuplicatesByKey((prev) => {
                              const copy = { ...prev };
                              delete copy[g.key];
                              return copy;
                            });
                          }}
                          title="Wyczyść wybór keepera, duplikatów i dane końcowe"
                        >
                          <XCircle className="h-4 w-4" />
                          Wyczyść keepera
                        </Button>
                      </div>
                    </div>

                    {/* Panel „Dane końcowe” */}
                    {canonical && (
                      <div className="border-b border-dashed border-gray-200 bg-stone-50/70 px-3 py-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/60">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-[12px]">
                            Dane końcowe dla tej grupy
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-neutral-400">
                            Te wartości trafią do{" "}
                            <code>global_players</code> i nadpiszą{" "}
                            <code>players</code> u wszystkich scoutów w tej
                            grupie.
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div>
                            <div className="mb-1 text-[11px] font-medium">
                              Nazwa w systemie
                            </div>
                            <input
                              value={canonical.name}
                              onChange={(e) =>
                                setCanonicalByKey((prev) => ({
                                  ...prev,
                                  [g.key]: {
                                    ...prev[g.key],
                                    name: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium">
                              Imię
                            </div>
                            <input
                              value={canonical.firstName || ""}
                              onChange={(e) =>
                                setCanonicalByKey((prev) => ({
                                  ...prev,
                                  [g.key]: {
                                    ...prev[g.key],
                                    firstName: e.target.value || undefined,
                                  },
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium">
                              Nazwisko
                            </div>
                            <input
                              value={canonical.lastName || ""}
                              onChange={(e) =>
                                setCanonicalByKey((prev) => ({
                                  ...prev,
                                  [g.key]: {
                                    ...prev[g.key],
                                    lastName: e.target.value || undefined,
                                  },
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium">
                              Data ur. (YYYY-MM-DD)
                            </div>
                            <input
                              value={canonical.birthDate || ""}
                              onChange={(e) =>
                                setCanonicalByKey((prev) => ({
                                  ...prev,
                                  [g.key]: {
                                    ...prev[g.key],
                                    birthDate: e.target.value || undefined,
                                  },
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium">
                              Pozycja (GK/DF/MF/FW)
                            </div>
                            <input
                              value={canonical.pos}
                              onChange={(e) =>
                                setCanonicalByKey((prev) => ({
                                  ...prev,
                                  [g.key]: {
                                    ...prev[g.key],
                                    pos:
                                      (e.target.value as
                                        | "GK"
                                        | "DF"
                                        | "MF"
                                        | "FW") || "MF",
                                  },
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs uppercase tracking-wide dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium">
                              Wiek
                            </div>
                            <input
                              type="number"
                              value={canonical.age ?? ""}
                              onChange={(e) =>
                                setCanonicalByKey((prev) => ({
                                  ...prev,
                                  [g.key]: {
                                    ...prev[g.key],
                                    age:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium">
                              Narodowość
                            </div>
                            <input
                              value={canonical.nationality || ""}
                              onChange={(e) =>
                                setCanonicalByKey((prev) => ({
                                  ...prev,
                                  [g.key]: {
                                    ...prev[g.key],
                                    nationality: e.target.value || undefined,
                                  },
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium">
                              URL zdjęcia (opcjonalnie)
                            </div>
                            <input
                              value={canonical.photo || ""}
                              onChange={(e) =>
                                setCanonicalByKey((prev) => ({
                                  ...prev,
                                  [g.key]: {
                                    ...prev[g.key],
                                    photo: e.target.value || undefined,
                                  },
                                }))
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tabela z rekordami scoutów */}
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
                          <tr>
                            <th className="p-3 text-left font-medium">
                              Keeper
                            </th>
                            <th className="p-3 text-left font-medium">
                              Duplikat?
                            </th>
                            <th className="p-3 text-left font-medium">Scout</th>
                            <th className="p-3 text-left font-medium">
                              Nazwisko i imię
                            </th>
                            <th className="p-3 text-left font-medium">
                              Data ur.
                            </th>
                            <th className="p-3 text-left font-medium">Poz.</th>
                            <th className="p-3 text-left font-medium">
                              Status
                            </th>
                            <th className="p-3 text-left font-medium">
                              Kompletność
                            </th>
                            <th className="p-3 text-left font-medium">
                              Global
                            </th>
                            <th className="p-3 text-right font-medium">
                              Akcje
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.list
                            .slice()
                            .sort((a, b) => {
                              if (a.id === keeperId) return -1;
                              if (b.id === keeperId) return 1;
                              return (
                                completenessScore(b) - completenessScore(a)
                              );
                            })
                            .map((p) => {
                              const comp = completenessScore(p);
                              const isKeeper = p.id === keeperId;
                              const isSelectedDuplicate =
                                (selectedDuplicatesByKey[g.key] ?? []).includes(
                                  p.id
                                );

                              return (
                                <tr
                                  key={String(p.id)}
                                  className={`border-t border-gray-200 align-middle dark:border-neutral-800 ${
                                    isKeeper
                                      ? "bg-emerald-50/60 dark:bg-emerald-900/20"
                                      : "hover:bg-stone-50/60 dark:hover:bg-neutral-900/60"
                                  }`}
                                >
                                  <td className="p-3">
                                    <input
                                      type="radio"
                                      name={`keeper-${idx}`}
                                      checked={isKeeper}
                                      onChange={() => selectKeeper(g.key, p)}
                                    />
                                  </td>
                                  <td className="p-3">
                                    <input
                                      type="checkbox"
                                      disabled={isKeeper}
                                      checked={isSelectedDuplicate}
                                      onChange={() =>
                                        !isKeeper &&
                                        toggleDuplicateSelection(g.key, p.id)
                                      }
                                    />
                                  </td>
                                  <td className="p-3">
                                    <div className="font-medium text-gray-900 dark:text-neutral-100">
                                      {p.scoutName || p.scoutId}
                                    </div>
                                    <div className="text-xs text-dark">
                                      {p.scoutId}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-medium text-gray-900 dark:text-neutral-100">
                                      {p.name}
                                    </div>
                                    <div className="text-xs text-dark">
                                      {(p.firstName || "—") +
                                        " " +
                                        (p.lastName || "")}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    {prettyDate(p.birthDate)}
                                  </td>
                                  <td className="p-3">
                                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                                      {p.pos}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                        (p.status ?? "active") === "active"
                                          ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                                      }`}
                                    >
                                      {(p.status ?? "active") === "active"
                                        ? "aktywny"
                                        : "kosz"}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="w-40 rounded-md bg-gray-100 dark:bg-neutral-800">
                                      <div
                                        className={`h-2 rounded-md ${
                                          isKeeper
                                            ? "bg-emerald-500"
                                            : "bg-gray-400"
                                        }`}
                                        style={{
                                          width: `${(comp / 4) * 100}%`,
                                        }}
                                      />
                                    </div>
                                    <div className="mt-1 text-xs text-dark">
                                      {comp}/4
                                    </div>
                                  </td>
                                  <td className="p-3 text-xs">
                                    {p.globalId ? (
                                      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                                        #{p.globalId}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="btn-soft-hover h-8 border-gray-300 text-xs hover:bg-stone-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                      onClick={() => setDetails(p)}
                                      title="Podgląd szczegółów rekordu skauta"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">
                                        Szczegóły
                                      </span>
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== Details Modal ===== */}
      {details && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-neutral-800">
              <div className="text-sm font-semibold">
                Szczegóły zawodnika skauta
              </div>
              <Button
                variant="outline"
                size="sm"
                className="btn-soft-hover h-8 border-gray-300 text-xs hover:bg-stone-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                onClick={() => setDetails(null)}
              >
                Zamknij
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-dark">Scout</div>
                  <div className="font-medium">
                    {details.scoutName || details.scoutId}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-dark">ID rekordu</div>
                  <div className="font-medium">
                    #{String(details.id)}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-dark">Nazwa</div>
                  <div className="font-medium">{details.name}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Imię</div>
                  <div>{details.firstName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Nazwisko</div>
                  <div>{details.lastName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Data ur.</div>
                  <div>{prettyDate(details.birthDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Pozycja</div>
                  <div>{details.pos}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Status</div>
                  <div>{details.status ?? "active"}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Global</div>
                  <div>
                    {details.globalId ? `#${details.globalId}` : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-md bg-stone-100 p-3 text-xs leading-relaxed dark:bg-neutral-900">
                <div className="mb-1 font-medium">
                  Uwaga dot. scalania i przyszłych duplikatów
                </div>
                Po scaleniu do globalnej bazy, kolejne wpisy scoutów o tym samym
                zawodniku zostaną wykryte jako grupa o tym samym kluczu.
                Wystarczy użyć akcji <b>„Powiąż z globalnym”</b>, aby dopiąć
                nowy wpis do istniejącego rekordu globalnego.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between border-t border-gray-200 bg-stone-100 px-4 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
              <span className="text-gray-500">
                Klucz: <code>{dupKey(details)}</code>
              </span>
              <div className="text-gray-500">
                Kompletność: {completenessScore(details)}/4
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
