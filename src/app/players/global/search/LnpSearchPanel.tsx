"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

import {
  Search,
  RefreshCw,
  Users,
  CheckCircle2,
  XCircle,
  CopyCheck,
  Database,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { supabase } from "@/shared/supabase-client";

/* ======================= Typy & stałe ======================= */

type GlobalPlayer = {
  id: string; // UI uid
  name: string;
  club?: string;
  pos?: "GK" | "DF" | "MF" | "FW" | string;
  age?: number;
  nationality?: string;
  source?: string;
  extId?: string;
  meta?: Record<string, any>;
};

type ScraperId = "tm" | "lnp";

const STORAGE_KEY = "s4s.global.players";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const dedupeKey = (p: Pick<GlobalPlayer, "name" | "club" | "extId">) =>
  (p.extId?.trim() || "").toLowerCase() ||
  [p.name?.trim().toLowerCase() || "", p.club?.trim().toLowerCase() || ""].join("::");

function labelForSource(id?: ScraperId | string) {
  if (id === "lnp") return "LNP";
  if (id === "tm") return "Transfermarkt";
  return String(id || "Źródło");
}

/* ======================= LNP API models ======================= */

type Sex = "Male" | "Female";

type LnpSeason = { id: string; name: string; isCurrent?: boolean };
type LnpLeague = { group?: string; league: string; league_id: string };
type LnpPlay = { id: string; name: string };
type LnpTeam = { team: string; team_id: string; points?: any };
type LnpPlayer = {
  player_id: string;
  firstname?: string;
  lastname?: string;
  name?: string | null;
  number?: string | number | null;
  position?: string | null;
  club?: string | null;
};

const LNP_BASE =
  (process.env.NEXT_PUBLIC_LNP_BASE || "").trim() || "/api/lnp"; // <- można ustawić w .env

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    signal,
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!r.ok) {
    let txt = await r.text().catch(() => "");
    // FastAPI często zwraca {"detail": "..."}
    try {
      const j = JSON.parse(txt);
      if (j?.detail) txt = String(j.detail);
    } catch {
      // ignore
    }
    throw new Error(txt || `HTTP ${r.status}`);
  }

  return (await r.json()) as T;
}

/* ======================= debounce helper ======================= */
function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/* ===================== LNP – kaskadowy panel ======================= */

export default function LnpSearchPanel() {
  // selectors
  const [sex, setSex] = useState<Sex>("Male");

  const [seasons, setSeasons] = useState<LnpSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");

  const [leagues, setLeagues] = useState<LnpLeague[]>([]);
  const [leagueId, setLeagueId] = useState<string>("");

  const [plays, setPlays] = useState<LnpPlay[]>([]);
  const [playId, setPlayId] = useState<string>("");

  const [teams, setTeams] = useState<LnpTeam[]>([]);
  const [teamId, setTeamId] = useState<string>("");

  // players + UI
  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 220);

  const [onlyNew, setOnlyNew] = useState(true);

  // local db
  const [db, setDb] = useState<GlobalPlayer[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // loading/errors per step
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [loadingPlays, setLoadingPlays] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  const [errSeasons, setErrSeasons] = useState<string | null>(null);
  const [errLeagues, setErrLeagues] = useState<string | null>(null);
  const [errPlays, setErrPlays] = useState<string | null>(null);
  const [errTeams, setErrTeams] = useState<string | null>(null);
  const [errPlayers, setErrPlayers] = useState<string | null>(null);

  // saving to Supabase
  const [saving, setSaving] = useState(false);

  // refresh trigger (real refresh, no hacks)
  const [refreshNonce, setRefreshNonce] = useState(0);

  // cache (żeby nie dociągać przy cofnięciu)
  const leaguesCache = useRef(new Map<string, LnpLeague[]>()); // key: sex|seasonId
  const playsCache = useRef(new Map<string, LnpPlay[]>()); // key: sex|seasonId|leagueId
  const teamsCache = useRef(new Map<string, LnpTeam[]>()); // key: sex|playId
  const playersCache = useRef(new Map<string, GlobalPlayer[]>()); // key: sex|teamId

  // abort controllers per step (fixes random abort/races)
  const ctrls = useRef<{
    seasons?: AbortController | null;
    leagues?: AbortController | null;
    plays?: AbortController | null;
    teams?: AbortController | null;
    players?: AbortController | null;
  }>({});

  const abortStep = (k: keyof typeof ctrls.current) => {
    try {
      ctrls.current[k]?.abort();
    } catch {}
    ctrls.current[k] = null;
  };

  /* ---------------- local storage init ---------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setDb(raw ? JSON.parse(raw) : []);
    } catch {
      setDb([]);
    }
  }, []);

  function persist(next: GlobalPlayer[]) {
    setDb(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  /* ---------------- reset cascade helpers ---------------- */
  function resetFromSeason() {
    setLeagueId("");
    setPlays([]);
    setPlayId("");
    setTeams([]);
    setTeamId("");
    setPlayers([]);
    setQ("");
  }
  function resetFromLeague() {
    setPlays([]);
    setPlayId("");
    setTeams([]);
    setTeamId("");
    setPlayers([]);
    setQ("");
  }
  function resetFromPlay() {
    setTeams([]);
    setTeamId("");
    setPlayers([]);
    setQ("");
  }
  function resetFromTeam() {
    setPlayers([]);
    setQ("");
  }

  /* ---------------- load seasons (on sex change / refresh) ---------------- */
  useEffect(() => {
    abortStep("seasons");
    const ac = new AbortController();
    ctrls.current.seasons = ac;

    void (async () => {
      setLoadingSeasons(true);
      setErrSeasons(null);
      setStatusMsg(null);

      // reset cascade
      setSeasons([]);
      setSeasonId("");
      resetFromSeason();
      setLeagues([]);
      setPlays([]);
      setTeams([]);
      setPlayers([]);

      try {
        const list = await fetchJson<LnpSeason[]>(
          `${LNP_BASE}/seasons?sex=${encodeURIComponent(sex)}`,
          ac.signal
        );

        const sorted = [...(list || [])].sort((a, b) => {
          const acur = a.isCurrent ? 1 : 0;
          const bcur = b.isCurrent ? 1 : 0;
          if (acur !== bcur) return bcur - acur;
          return (a.name || "").localeCompare(b.name || "", "pl");
        });

        setSeasons(sorted);

        const cur = sorted.find((s) => s.isCurrent);
        if (cur?.id) setSeasonId(cur.id);
        else if (sorted[0]?.id) setSeasonId(sorted[0].id);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErrSeasons(e?.message || "Nie udało się pobrać sezonów");
      } finally {
        setLoadingSeasons(false);
      }
    })();

    return () => abortStep("seasons");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, refreshNonce]);

  /* ---------------- load leagues when season changes ---------------- */
  useEffect(() => {
    if (!seasonId) return;

    abortStep("leagues");
    const ac = new AbortController();
    ctrls.current.leagues = ac;

    void (async () => {
      setLoadingLeagues(true);
      setErrLeagues(null);
      setStatusMsg(null);
      resetFromSeason();
      setLeagues([]);

      const cacheKey = `${sex}|${seasonId}`;
      const cached = leaguesCache.current.get(cacheKey);
      if (cached) {
        setLeagues(cached);
        setLoadingLeagues(false);
        return;
      }

      try {
        const list = await fetchJson<LnpLeague[]>(
          `${LNP_BASE}/leagues?sex=${encodeURIComponent(sex)}&seasonId=${encodeURIComponent(seasonId)}`,
          ac.signal
        );
        const normalized = (list || []).filter((x) => x?.league_id && x?.league);
        leaguesCache.current.set(cacheKey, normalized);
        setLeagues(normalized);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErrLeagues(e?.message || "Nie udało się pobrać lig");
      } finally {
        setLoadingLeagues(false);
      }
    })();

    return () => abortStep("leagues");
  }, [sex, seasonId]);

  /* ---------------- load plays when league changes ---------------- */
  useEffect(() => {
    if (!seasonId || !leagueId) return;

    abortStep("plays");
    const ac = new AbortController();
    ctrls.current.plays = ac;

    void (async () => {
      setLoadingPlays(true);
      setErrPlays(null);
      setStatusMsg(null);
      resetFromLeague();
      setPlays([]);

      const cacheKey = `${sex}|${seasonId}|${leagueId}`;
      const cached = playsCache.current.get(cacheKey);
      if (cached) {
        setPlays(cached);
        setLoadingPlays(false);
        return;
      }

      try {
        const list = await fetchJson<LnpPlay[]>(
          `${LNP_BASE}/plays?sex=${encodeURIComponent(sex)}&seasonId=${encodeURIComponent(
            seasonId
          )}&leagueId=${encodeURIComponent(leagueId)}`,
          ac.signal
        );
        const normalized = (list || []).filter((x) => x?.id && x?.name);
        playsCache.current.set(cacheKey, normalized);
        setPlays(normalized);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErrPlays(e?.message || "Nie udało się pobrać rozgrywek (play)");
      } finally {
        setLoadingPlays(false);
      }
    })();

    return () => abortStep("plays");
  }, [sex, seasonId, leagueId]);

  /* ---------------- load teams when play changes ---------------- */
  useEffect(() => {
    if (!playId) return;

    abortStep("teams");
    const ac = new AbortController();
    ctrls.current.teams = ac;

    void (async () => {
      setLoadingTeams(true);
      setErrTeams(null);
      setStatusMsg(null);
      resetFromPlay();
      setTeams([]);

      const cacheKey = `${sex}|${playId}`;
      const cached = teamsCache.current.get(cacheKey);
      if (cached) {
        setTeams(cached);
        setLoadingTeams(false);
        return;
      }

      try {
        const list = await fetchJson<LnpTeam[]>(
          `${LNP_BASE}/teams?sex=${encodeURIComponent(sex)}&playId=${encodeURIComponent(playId)}`,
          ac.signal
        );
        const normalized = (list || []).filter((x) => x?.team_id && x?.team);
        teamsCache.current.set(cacheKey, normalized);
        setTeams(normalized);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErrTeams(e?.message || "Nie udało się pobrać drużyn");
      } finally {
        setLoadingTeams(false);
      }
    })();

    return () => abortStep("teams");
  }, [sex, playId]);

  /* ---------------- load players when team changes ---------------- */
  useEffect(() => {
    if (!teamId) return;

    abortStep("players");
    const ac = new AbortController();
    ctrls.current.players = ac;

    void (async () => {
      setLoadingPlayers(true);
      setErrPlayers(null);
      setStatusMsg(null);
      resetFromTeam();

      const cacheKey = `${sex}|${teamId}`;
      const cached = playersCache.current.get(cacheKey);
      if (cached) {
        setPlayers(cached);
        setLoadingPlayers(false);
        return;
      }

      try {
        const list = await fetchJson<LnpPlayer[]>(
          `${LNP_BASE}/players?sex=${encodeURIComponent(sex)}&teamId=${encodeURIComponent(teamId)}`,
          ac.signal
        );

        const mapped: GlobalPlayer[] = (list || []).map((p) => {
          const fullName =
            (p.name && p.name.trim()) ||
            [p.firstname || "", p.lastname || ""].join(" ").trim() ||
            "—";

          return {
            id: uid(),
            name: fullName,
            club: p.club || undefined,
            pos: p.position || undefined,
            source: "lnp",
            extId: p.player_id ? String(p.player_id) : undefined,
            meta: {
              // kontekst kaskady
              teamId,
              playId,
              leagueId,
              seasonId,
              sex,
              // dane surowe
              number: p.number ?? null,
              firstName: p.firstname ?? null,
              lastName: p.lastname ?? null,
            },
          };
        });

        playersCache.current.set(cacheKey, mapped);
        setPlayers(mapped);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErrPlayers(e?.message || "Nie udało się pobrać zawodników");
        setPlayers([]);
      } finally {
        setLoadingPlayers(false);
      }
    })();

    return () => abortStep("players");
  }, [sex, seasonId, leagueId, playId, teamId]);

  /* ===================== Local DB ops ===================== */

  function addOneToLocal(p: GlobalPlayer) {
    const key = dedupeKey(p);
    const exists = db.find((x) => dedupeKey(x) === key);
    if (exists) {
      setStatusMsg(`Pominięto (już w lokalnej bazie): ${p.name}${p.club ? " • " + p.club : ""}`);
      return;
    }
    persist([{ ...p, id: uid() }, ...db]);
    setStatusMsg(`Dodano do lokalnej bazy: ${p.name}${p.club ? " • " + p.club : ""}`);
  }

  function addAllToLocal(list: GlobalPlayer[]) {
    const seen = new Set(db.map((p) => dedupeKey(p)));
    const fresh = list.filter((p) => {
      const k = dedupeKey(p);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (!fresh.length) {
      setStatusMsg("Brak nowych rekordów do dodania do lokalnej bazy.");
      return;
    }

    persist([...fresh.map((p) => ({ ...p, id: uid() })), ...db]);
    setStatusMsg(`Dodano ${fresh.length} rekordów do lokalnej bazy.`);
  }

  /* ====================== SAVE LNP -> Supabase ====================== */

  const mapLnpToPayload = (p: GlobalPlayer) => {
    const ext = (p.extId || "").trim();
    const key = ext ? `lnp:${ext}` : `lnp:${dedupeKey(p)}`;

    const first_name = (p.meta?.firstName || "").toString().trim() || null;
    const last_name = (p.meta?.lastName || "").toString().trim() || null;

    return {
      key,
      name: p.name,
      first_name,
      last_name,
      pos: p.pos || "UNK",
      age: typeof p.age === "number" ? p.age : null,
      club: p.club ?? null,
      nationality: p.nationality ?? null,
      source: "lnp",
      ext_id: ext ? ext : null,
      birth_date: null,
      meta: p.meta ?? {},
      added_at: new Date().toISOString(),
    };
  };

  const saveManyToSupabase = async (list: GlobalPlayer[]) => {
    if (!list.length) {
      toast.message("Brak zawodników do zapisu.");
      return;
    }

    setSaving(true);
    try {
      const payload = list.map(mapLnpToPayload);
      const { error } = await supabase.from("global_players").upsert(payload, { onConflict: "key" });
      if (error) throw error;

      toast.success(`Zapisano ${payload.length} zawodników (LNP) do global_players`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Błąd zapisu do Supabase: ${e?.message || "nieznany błąd"}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSingleToSupabase = async (p: GlobalPlayer) => {
    setSaving(true);
    try {
      const payload = [mapLnpToPayload(p)];
      const { error } = await supabase.from("global_players").upsert(payload, { onConflict: "key" });
      if (error) throw error;

      toast.success(`Zapisano zawodnika (LNP): ${p.name}`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Błąd zapisu zawodnika: ${e?.message || "nieznany błąd"}`);
    } finally {
      setSaving(false);
    }
  };

  const saveLocalDbToSupabase = async () => {
    if (!db.length) {
      toast.message("Lokalna baza jest pusta.");
      return;
    }
    await saveManyToSupabase(db);
  };

  /* ===================== Filtering players ===================== */

  const filteredPlayers = useMemo(() => {
    const tokens = qDebounced.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = [...players];

    if (tokens.length) {
      list = list.filter((p) => {
        const hay = `${p.name} ${p.club || ""} ${p.pos || ""} ${p.nationality || ""}`
          .toLowerCase()
          .replace(/\s+/g, " ");
        return tokens.every((t) => hay.includes(t));
      });
    }

    if (onlyNew) {
      const inLocal = new Set(db.map((p) => dedupeKey(p)));
      list = list.filter((p) => !inLocal.has(dedupeKey(p)));
    }

    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pl"));
    return list;
  }, [players, qDebounced, onlyNew, db]);

  const selectedSeason = seasons.find((s) => s.id === seasonId);
  const selectedLeague = leagues.find((l) => l.league_id === leagueId);
  const selectedPlay = plays.find((p) => p.id === playId);
  const selectedTeam = teams.find((t) => t.team_id === teamId);

  const canSearch = !!teamId && !loadingPlayers && players.length > 0;

  const refreshCascade = () => {
    // abort in-flight fetches
    abortStep("seasons");
    abortStep("leagues");
    abortStep("plays");
    abortStep("teams");
    abortStep("players");

    // clear caches
    leaguesCache.current.clear();
    playsCache.current.clear();
    teamsCache.current.clear();
    playersCache.current.clear();

    // clear UI selections
    setSeasons([]);
    setSeasonId("");
    resetFromSeason();
    setLeagues([]);
    setPlays([]);
    setTeams([]);
    setPlayers([]);
    setQ("");
    setStatusMsg("Odświeżam kaskadę…");

    // trigger re-fetch
    setRefreshNonce((n) => n + 1);
  };

  return (
    <div className="space-y-4">
      {/* STEP 1: Context (cascade) */}
      <Card className="border-gray-200 bg-white/80 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-neutral-800">
          <div>
            <div className="inline-flex h-6 items-center rounded-md bg-stone-100 px-2.5 text-[11px] font-medium uppercase tracking-wide text-stone-600 dark:bg-neutral-900 dark:text-neutral-200">
              LNP · Kaskada (Sezon → Liga → Play → Drużyna)
            </div>

            <div className="mt-2 text-sm font-semibold leading-none tracking-tight">
              Wybierz kontekst i dopiero potem wyszukuj zawodników
            </div>

            <p className="mt-1 text-[11px] text-stone-500 dark:text-neutral-400">
              Dzięki kaskadzie pobieramy tylko to, co potrzebne. Wyniki możesz zapisać lokalnie lub od razu do{" "}
              <code className="text-[11px]">global_players</code>.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-[11px]">
            <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
              <Users className="mr-1 h-3 w-3" />
              Lokalna baza: {db.length}
            </span>

            <Button
              className="h-7 gap-1 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-500"
              onClick={() => void saveLocalDbToSupabase()}
              disabled={saving || db.length === 0}
              title="Zapisz całą lokalną bazę do global_players"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> …
                </>
              ) : (
                <>
                  <Database className="h-3 w-3" /> Zapisz lokalną bazę
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-3 sm:p-4">
          {/* sex */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">Płeć</Label>
              <select
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-[11px] dark:border-neutral-700 dark:bg-neutral-900"
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-[11px]"
                onClick={refreshCascade}
                disabled={loadingSeasons}
                title="Odśwież kaskadę (przeładowuje dane)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Odśwież kaskadę
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {/* Season */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Sezon</Label>
              <div className="relative">
                <select
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12px] dark:border-neutral-700 dark:bg-neutral-900"
                  value={seasonId}
                  onChange={(e) => setSeasonId(e.target.value)}
                  disabled={loadingSeasons || seasons.length === 0}
                >
                  {seasons.length === 0 && <option value="">—</option>}
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.isCurrent ? "★ " : ""}
                      {s.name}
                    </option>
                  ))}
                </select>

                {loadingSeasons && (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                )}
              </div>

              {errSeasons && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" />
                  {errSeasons}
                </div>
              )}
            </div>

            {/* League */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Liga</Label>
              <div className="relative">
                <select
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12px] dark:border-neutral-700 dark:bg-neutral-900"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  disabled={!seasonId || loadingLeagues || leagues.length === 0}
                >
                  {!seasonId && <option value="">Wybierz sezon…</option>}
                  {seasonId && leagues.length === 0 && <option value="">—</option>}
                  {leagues.map((l) => (
                    <option key={l.league_id} value={l.league_id}>
                      {l.group ? `[${l.group}] ` : ""}
                      {l.league}
                    </option>
                  ))}
                </select>

                {loadingLeagues && (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                )}
              </div>

              {errLeagues && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" />
                  {errLeagues}
                </div>
              )}
            </div>

            {/* Play */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Rozgrywki (play)</Label>
              <div className="relative">
                <select
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12px] dark:border-neutral-700 dark:bg-neutral-900"
                  value={playId}
                  onChange={(e) => setPlayId(e.target.value)}
                  disabled={!leagueId || loadingPlays || plays.length === 0}
                >
                  {!leagueId && <option value="">Wybierz ligę…</option>}
                  {leagueId && plays.length === 0 && <option value="">—</option>}
                  {plays.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {loadingPlays && (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                )}
              </div>

              {errPlays && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" />
                  {errPlays}
                </div>
              )}
            </div>

            {/* Team */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Drużyna</Label>
              <div className="relative">
                <select
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12px] dark:border-neutral-700 dark:bg-neutral-900"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  disabled={!playId || loadingTeams || teams.length === 0}
                >
                  {!playId && <option value="">Wybierz play…</option>}
                  {playId && teams.length === 0 && <option value="">—</option>}
                  {teams.map((t) => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.team}
                    </option>
                  ))}
                </select>

                {loadingTeams && (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                )}
              </div>

              {errTeams && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" />
                  {errTeams}
                </div>
              )}
            </div>
          </div>

          {/* context preview */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center rounded-md bg-stone-50 px-2 py-1 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-800">
              Sezon:{" "}
              <b className="ml-1 text-stone-700 dark:text-neutral-200">{selectedSeason?.name || "—"}</b>
            </span>
            <span className="inline-flex items-center rounded-md bg-stone-50 px-2 py-1 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-800">
              Liga:{" "}
              <b className="ml-1 text-stone-700 dark:text-neutral-200">{selectedLeague?.league || "—"}</b>
            </span>
            <span className="inline-flex items-center rounded-md bg-stone-50 px-2 py-1 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-800">
              Play: <b className="ml-1 text-stone-700 dark:text-neutral-200">{selectedPlay?.name || "—"}</b>
            </span>
            <span className="inline-flex items-center rounded-md bg-stone-50 px-2 py-1 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-800">
              Drużyna:{" "}
              <b className="ml-1 text-stone-700 dark:text-neutral-200">{selectedTeam?.team || "—"}</b>
            </span>

            {statusMsg && (
              <span className="inline-flex items-center rounded-md bg-stone-50 px-2 py-1 text-[11px] text-stone-700 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
                {statusMsg}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* STEP 2: Players + Search */}
      <Card className="border-gray-200 bg-white/80 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-neutral-800">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <span>Zawodnicy (LNP)</span>
              <span className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700">
                {filteredPlayers.length} / {players.length}
              </span>
            </CardTitle>

            <p className="mt-1 text-[11px] text-stone-500 dark:text-neutral-400">
              Szukasz po już pobranej liście zawodników (z wybranej drużyny). Zapisz lokalnie albo bezpośrednio do{" "}
              <code className="text-[11px]">global_players</code>.
            </p>

            {errPlayers && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                {errPlayers}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <Button
              className="h-8 gap-1.5 bg-emerald-600 px-3 text-[11px] text-white hover:bg-emerald-500"
              onClick={() => void saveManyToSupabase(filteredPlayers)}
              disabled={saving || filteredPlayers.length === 0}
              title="Zapisz wszystkich widocznych zawodników do global_players"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Zapisywanie…
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5" />
                  Zapisz widocznych
                </>
              )}
            </Button>

            {loadingPlayers && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
                <Loader2 className="h-3 w-3 animate-spin" />
                Pobieranie zawodników…
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:max-w-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={canSearch ? "Nazwisko, klub, pozycja…" : "Wybierz drużynę, aby pobrać zawodników…"}
                    disabled={!teamId || loadingPlayers}
                    className="h-8 w-full rounded-md border border-stone-200 pl-8 text-sm"
                  />
                </div>

                <Button
                  variant="outline"
                  className="h-8 border-gray-300 px-3 text-xs dark:border-neutral-700"
                  onClick={() => setQ("")}
                  disabled={!q || !teamId || loadingPlayers}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Wyczyść
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-stone-50 px-2 py-1 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-800">
                <Checkbox
                  id="only-new"
                  checked={onlyNew}
                  onCheckedChange={(v) => setOnlyNew(Boolean(v))}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor="only-new" className="cursor-pointer leading-none">
                  Pokaż tylko nowych (vs lokalna baza)
                </Label>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => {
                  setPlayers([]);
                  setQ("");
                  setStatusMsg("Wyczyszczono listę zawodników (UI).");
                }}
                disabled={!players.length}
                title="Wyczyść listę zawodników (tylko UI)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Wyczyść listę
              </Button>
            </div>
          </div>

          <PlayersTable
            rows={filteredPlayers}
            dbKeys={new Set(db.map(dedupeKey))}
            saving={saving}
            onAddOne={addOneToLocal}
            onAddAll={() => addAllToLocal(filteredPlayers)}
            onSaveOne={(p) => void saveSingleToSupabase(p)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/* ===================== Table ===================== */

function PlayersTable({
  rows,
  dbKeys,
  saving,
  onAddOne,
  onAddAll,
  onSaveOne,
}: {
  rows: GlobalPlayer[];
  dbKeys: Set<string>;
  saving: boolean;
  onAddOne: (p: GlobalPlayer) => void;
  onAddAll: () => void;
  onSaveOne: (p: GlobalPlayer) => void;
}) {
  return (
    <Card className="border-gray-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/80">
      <CardHeader className="flex flex-row items-center justify-between gap-3 py-2.5">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span>Wyniki: LNP</span>
            <span className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700">
              {rows.length} rekordów
            </span>
          </CardTitle>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-8 bg-gray-900 px-3 text-xs text-white hover:bg-gray-800"
            onClick={onAddAll}
            disabled={rows.length === 0}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Dodaj wszystkie (lokalnie)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-stone-100 text-[11px] font-medium text-stone-700 shadow-sm dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="w-[32px] px-2 py-2.5" />
                <th className="p-2.5 text-left">Zawodnik</th>
                <th className="p-2.5 text-left">Klub</th>
                <th className="p-2.5 text-left hidden sm:table-cell">Pozycja</th>
                <th className="p-2.5 text-left hidden md:table-cell">Źródło</th>
                <th className="p-2.5 text-right">Akcje</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const inDb = dbKeys.has(dedupeKey(r));
                const rowClass = inDb
                  ? "bg-emerald-50/60 text-stone-700 dark:bg-emerald-950/25 dark:text-neutral-100"
                  : "hover:bg-stone-50 dark:hover:bg-neutral-900";

                return (
                  <tr
                    key={`${r.id}-${r.source}-${r.extId || ""}`}
                    className={`border-t border-gray-200 transition-colors dark:border-neutral-800 ${rowClass}`}
                  >
                    <td className="px-2 py-2.5 align-middle">
                      <div className="flex justify-center">
                        <Checkbox className="h-3.5 w-3.5" disabled />
                      </div>
                    </td>

                    <td className="p-2.5">
                      <div className="font-medium text-gray-900 dark:text-neutral-100">{r.name || "—"}</div>
                      {r.nationality && <div className="mt-0.5 text-[11px] text-muted-foreground">{r.nationality}</div>}
                      {r.extId && <div className="mt-0.5 text-[11px] text-muted-foreground">ID: {r.extId}</div>}
                    </td>

                    <td className="p-2.5 text-sm text-stone-800 dark:text-neutral-200">{r.club || "—"}</td>

                    <td className="p-2.5 hidden text-sm text-stone-800 dark:text-neutral-200 sm:table-cell">
                      {r.pos ? (
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800 ring-1 ring-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700">
                          {r.pos}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="hidden p-2.5 text-[12px] text-muted-foreground md:table-cell">
                      {labelForSource(r.source)}
                    </td>

                    <td className="p-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 border-gray-300 px-2 text-[11px] dark:border-neutral-700"
                          onClick={() => onAddOne(r)}
                          disabled={inDb}
                          title={inDb ? "Już w lokalnej bazie" : "Dodaj do lokalnej bazy"}
                        >
                          {inDb ? (
                            <>
                              <CopyCheck className="h-3.5 w-3.5" /> W bazie
                            </>
                          ) : (
                            <>
                              <Users className="h-3.5 w-3.5" /> Dodaj
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          className="h-7 gap-1 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-500"
                          title="Zapisz do global_players"
                          onClick={() => onSaveOne(r)}
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> …
                            </>
                          ) : (
                            <>
                              <Database className="h-3.5 w-3.5" /> Zapisz
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-5 text-center text-sm text-muted-foreground">
                    Brak wyników. Wybierz kontekst (sezon/liga/play/drużyna), aby pobrać zawodników.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
