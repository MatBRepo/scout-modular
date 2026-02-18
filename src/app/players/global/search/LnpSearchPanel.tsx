"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronRight,
  Filter,
  Layers,
  MapPin,
  Trophy,
  History,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/shared/supabase-client";

/* ======================= TYPES & MODELS ======================= */

type GlobalPlayer = {
  id: string;
  name: string;
  club?: string;
  pos?: string;
  age?: number;
  nationality?: string;
  source?: string;
  extId?: string;
  meta?: Record<string, any>;
};

type Sex = "Male" | "Female";
type LnpSeason = { id: string; name: string; isCurrent?: boolean };
type LnpLeague = { group?: string; league: string; league_id: string };
type LnpPlay = { id: string; name: string };
type LnpTeam = { team: string; team_id: string };
type LnpPlayer = {
  player_id: string;
  firstname?: string;
  lastname?: string;
  name?: string | null;
  number?: string | number | null;
  position?: string | null;
  club?: string | null;
};

const STORAGE_KEY = "s4s.global.players";
const LNP_BASE = (process.env.NEXT_PUBLIC_LNP_BASE || "").trim() || "/api/lnp";

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const dedupeKey = (p: Pick<GlobalPlayer, "name" | "club" | "extId">) =>
  (p.extId?.trim() || "").toLowerCase() ||
  [p.name?.trim().toLowerCase() || "", p.club?.trim().toLowerCase() || ""].join("::");

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal, cache: "no-store" });
  if (!r.ok) {
    let txt = await r.text().catch(() => "");
    try { const j = JSON.parse(txt); if (j?.detail) txt = String(j.detail); } catch { }
    throw new Error(txt || `HTTP ${r.status}`);
  }
  return (await r.json()) as T;
}

/* ===================== MAIN COMPONENT ======================= */

export default function LnpSearchPanel() {
  const [sex, setSex] = useState<Sex>("Male");
  const [seasons, setSeasons] = useState<LnpSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  const [leagues, setLeagues] = useState<LnpLeague[]>([]);
  const [leagueId, setLeagueId] = useState<string>("");
  const [plays, setPlays] = useState<LnpPlay[]>([]);
  const [playId, setPlayId] = useState<string>("");
  const [teams, setTeams] = useState<LnpTeam[]>([]);
  const [teamId, setTeamId] = useState<string>("");

  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  const [q, setQ] = useState("");
  const [onlyNew, setOnlyNew] = useState(true);
  const [db, setDb] = useState<GlobalPlayer[]>([]);

  const [loading, setLoading] = useState({ seasons: false, leagues: false, plays: false, teams: false, players: false });
  const [saving, setSaving] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const caches = useRef({
    leagues: new Map<string, LnpLeague[]>(),
    plays: new Map<string, LnpPlay[]>(),
    teams: new Map<string, LnpTeam[]>(),
    players: new Map<string, GlobalPlayer[]>()
  });

  const ctrls = useRef<Record<string, AbortController | null>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDb(JSON.parse(raw));
    } catch { }
  }, []);

  const persist = (next: GlobalPlayer[]) => {
    setDb(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const abort = (k: string) => {
    ctrls.current[k]?.abort();
    ctrls.current[k] = null;
  };

  // 1. Seasons
  useEffect(() => {
    abort("seasons");
    const ac = new AbortController();
    ctrls.current.seasons = ac;
    setLoading(l => ({ ...l, seasons: true }));
    setSeasonId("");
    setLeagueId("");
    setPlayId("");
    setTeamId("");

    fetchJson<LnpSeason[]>(`${LNP_BASE}/seasons?sex=${sex}`, ac.signal)
      .then(list => {
        const sorted = (list || []).sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));
        setSeasons(sorted);
        if (sorted[0]) setSeasonId(sorted[0].id);
      })
      .catch(e => e.name !== "AbortError" && toast.error("Błąd pobierania sezonów"))
      .finally(() => setLoading(l => ({ ...l, seasons: false })));
  }, [sex, refreshNonce]);

  // 2. Leagues
  useEffect(() => {
    if (!seasonId) return;
    abort("leagues");
    const ac = new AbortController();
    ctrls.current.leagues = ac;
    setLoading(l => ({ ...l, leagues: true }));
    setLeagueId("");
    setPlayId("");
    setTeamId("");

    const key = `${sex}|${seasonId}`;
    if (caches.current.leagues.has(key)) {
      setLeagues(caches.current.leagues.get(key)!);
      setLoading(l => ({ ...l, leagues: false }));
      return;
    }

    fetchJson<LnpLeague[]>(`${LNP_BASE}/leagues?sex=${sex}&seasonId=${seasonId}`, ac.signal)
      .then(list => {
        caches.current.leagues.set(key, list);
        setLeagues(list);
      })
      .catch(e => e.name !== "AbortError" && toast.error("Błąd pobierania lig"))
      .finally(() => setLoading(l => ({ ...l, leagues: false })));
  }, [seasonId]);

  // 3. Plays
  useEffect(() => {
    if (!leagueId) return;
    abort("plays");
    const ac = new AbortController();
    ctrls.current.plays = ac;
    setLoading(l => ({ ...l, plays: true }));
    setPlayId("");
    setTeamId("");

    const key = `${sex}|${seasonId}|${leagueId}`;
    if (caches.current.plays.has(key)) {
      setPlays(caches.current.plays.get(key)!);
      setLoading(l => ({ ...l, plays: false }));
      return;
    }

    fetchJson<LnpPlay[]>(`${LNP_BASE}/plays?sex=${sex}&seasonId=${seasonId}&leagueId=${leagueId}`, ac.signal)
      .then(list => {
        caches.current.plays.set(key, list);
        setPlays(list);
      })
      .catch(e => e.name !== "AbortError" && toast.error("Błąd pobierania rozgrywek"))
      .finally(() => setLoading(l => ({ ...l, plays: false })));
  }, [leagueId]);

  // 4. Teams
  useEffect(() => {
    if (!playId) return;
    abort("teams");
    const ac = new AbortController();
    ctrls.current.teams = ac;
    setLoading(l => ({ ...l, teams: true }));
    setTeamId("");

    const key = `${sex}|${playId}`;
    if (caches.current.teams.has(key)) {
      setTeams(caches.current.teams.get(key)!);
      setLoading(l => ({ ...l, teams: false }));
      return;
    }

    fetchJson<LnpTeam[]>(`${LNP_BASE}/teams?sex=${sex}&playId=${playId}`, ac.signal)
      .then(list => {
        caches.current.teams.set(key, list);
        setTeams(list);
      })
      .catch(e => e.name !== "AbortError" && toast.error("Błąd pobierania drużyn"))
      .finally(() => setLoading(l => ({ ...l, teams: false })));
  }, [playId]);

  // 5. Players
  useEffect(() => {
    if (!teamId) return;
    abort("players");
    const ac = new AbortController();
    ctrls.current.players = ac;
    setLoading(l => ({ ...l, players: true }));

    const key = `${sex}|${teamId}`;
    if (caches.current.players.has(key)) {
      setPlayers(caches.current.players.get(key)!);
      setLoading(l => ({ ...l, players: false }));
      return;
    }

    fetchJson<LnpPlayer[]>(`${LNP_BASE}/players?sex=${sex}&teamId=${teamId}`, ac.signal)
      .then(list => {
        const mapped = (list || []).map(p => ({
          id: uid(),
          name: p.name || `${p.firstname} ${p.lastname}`.trim(),
          club: p.club || undefined,
          pos: p.position || undefined,
          source: "lnp",
          extId: String(p.player_id),
          meta: { ...p, sex, seasonId, leagueId, playId, teamId }
        }));
        caches.current.players.set(key, mapped);
        setPlayers(mapped);
      })
      .catch(e => e.name !== "AbortError" && toast.error("Błąd pobierania zawodników"))
      .finally(() => setLoading(l => ({ ...l, players: false })));
  }, [teamId]);

  const filtered = useMemo(() => {
    let list = [...players];
    const qLower = q.trim().toLowerCase();
    if (qLower) list = list.filter(p => p.name.toLowerCase().includes(qLower));
    if (onlyNew) {
      const inLocal = new Set(db.map(dedupeKey));
      list = list.filter(p => !inLocal.has(dedupeKey(p)));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [players, q, onlyNew, db]);

  const saveToSupabase = async (items: GlobalPlayer[]) => {
    if (!items.length) return;
    setSaving(true);
    try {
      const payloads = items.map(p => ({
        key: `lnp:${p.extId}`,
        name: p.name,
        pos: p.pos || "UNK",
        club: p.club || null,
        source: "lnp",
        ext_id: p.extId,
        meta: p.meta,
        added_at: new Date().toISOString()
      }));
      const { error } = await supabase.from("global_players").upsert(payloads, { onConflict: "key" });
      if (error) throw error;
      toast.success(`Zapisano ${payloads.length} zawodników`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addLocal = (p: GlobalPlayer) => {
    if (db.some(x => dedupeKey(x) === dedupeKey(p))) {
      toast.info("Już w bazie");
      return;
    }
    persist([p, ...db]);
    toast.success("Dodano lokalnie");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <aside className="space-y-6 lg:col-span-4">
        <div>
          <Card className="rounded overflow-hidden border-stone-200/60 bg-white/70 shadow-xl backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/70">
            <div className="bg-stone-900 px-4 py-3 dark:bg-white flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white dark:text-black flex items-center gap-2">
                <Layers className="h-4 w-4" /> Kaskada LNP
              </h3>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded text-white dark:text-black hover:bg-white/20" onClick={() => setRefreshNonce(n => n + 1)}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2">
                {["Male", "Female"].map(s => (
                  <Button
                    key={s}
                    variant={sex === s ? "default" : "outline"}
                    className={`h-9 text-xs rounded ${sex === s ? "bg-stone-900 text-white dark:bg-white dark:text-black" : "bg-white/50"}`}
                    onClick={() => setSex(s as Sex)}
                  >
                    {s === "Male" ? "Mężczyźni" : "Kobiety"}
                  </Button>
                ))}
              </div>

              {[
                { label: "Sezon", val: seasonId, set: setSeasonId, list: seasons, loading: loading.seasons, icon: Calendar },
                { label: "Liga", val: leagueId, set: setLeagueId, list: leagues.map(l => ({ id: l.league_id, name: l.league })), loading: loading.leagues, icon: Trophy },
                { label: "Rozgrywki", val: playId, set: setPlayId, list: plays, loading: loading.plays, icon: Trophy },
                { label: "Drużyna", val: teamId, set: setTeamId, list: teams.map(t => ({ id: t.team_id, name: t.team })), loading: loading.teams, icon: MapPin }
              ].map((step, i) => (
                <div key={i} className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-stone-400 flex items-center gap-2">
                    <step.icon className="h-3 w-3" /> {step.label}
                  </Label>
                  <div className="relative">
                    <select
                      className="w-full h-9 rounded border border-stone-200 bg-white/50 px-3 py-1.5 text-xs focus:ring-2 focus:ring-stone-500 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900/50"
                      value={step.val}
                      onChange={(e) => step.set(e.target.value)}
                      disabled={step.loading || (i > 0 && !seasons.length)}
                    >
                      <option value="">Wybierz...</option>
                      {step.list.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    {step.loading && <Loader2 className="absolute right-8 top-2.5 h-4 w-4 animate-spin text-stone-400" />}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded border-stone-200/60 bg-white/70 shadow-lg backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/70 p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Statystyki importu</div>
            <div className="h-8 w-8 rounded bg-stone-100 flex items-center justify-center text-[10px] font-bold">{db.length}</div>
          </div>
          <Button className="w-full h-9 rounded bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 text-xs" onClick={() => saveToSupabase(db)} disabled={saving || !db.length}>
            <Database className="mr-2 h-3.5 w-3.5" /> Zapisz lokalną bazę
          </Button>
        </Card>
      </aside>

      <main className="space-y-4 lg:col-span-8 md:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-stone-200/60 bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-stone-900 flex items-center justify-center text-white dark:bg-white dark:text-black">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-stone-400">ZAWODNICY LNP</div>
              <div className="text-lg font-black">{filtered.length} <span className="text-xs font-normal text-stone-400">/ {players.length}</span></div>
            </div>
          </div>
          <div className="flex flex-1 max-w-xs relative ml-4">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder="Filtruj listę..."
              className="h-9 rounded border-stone-200 bg-white/50 pl-9 text-xs"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded border bg-white/50">
              <Checkbox id="only-new-lnp" checked={onlyNew} onCheckedChange={v => setOnlyNew(!!v)} />
              <Label htmlFor="only-new-lnp" className="text-[10px] font-bold cursor-pointer">TYLKO NOWI</Label>
            </div>
            <Button size="sm" className="h-9 rounded bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 text-xs" onClick={() => saveToSupabase(filtered)} disabled={saving || !filtered.length}>
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Database className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded border border-stone-200/60 bg-white/70 shadow-xl backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/70">
          <table className="w-full text-sm">
            <thead className="bg-stone-100/80 backdrop-blur-md dark:bg-neutral-900/80 border-b">
              <tr className="text-left text-[10px] font-bold uppercase text-stone-400">
                <th className="p-4 w-12"><Checkbox /></th>
                <th className="p-4">Nazwisko i imię</th>
                <th className="p-4">Klub</th>
                <th className="p-4">Pozycja</th>
                <th className="p-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-900">
              {filtered.map((p, idx) => {
                const inDb = db.some(x => dedupeKey(x) === dedupeKey(p));
                return (
                  <tr
                    key={p.id}
                    className={`group hover:bg-stone-50/50 dark:hover:bg-neutral-900/50 transition-colors ${inDb ? "bg-emerald-50/20" : ""}`}
                  >
                    <td className="p-4"><Checkbox checked={inDb} disabled /></td>
                    <td className="p-4 font-bold">{p.name}</td>
                    <td className="p-4 text-xs font-medium text-stone-600 dark:text-stone-400">{p.club || "—"}</td>
                    <td className="p-4">
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase">{p.pos || "—"}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded text-stone-400 hover:text-stone-900" onClick={() => addLocal(p)} disabled={inDb}>
                          {inDb ? <CopyCheck className="h-4 w-4 text-emerald-600" /> : <Users className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded text-stone-400 hover:text-emerald-600" onClick={() => saveToSupabase([p])}>
                          <Database className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading.players && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-xs text-stone-400 italic">
                    {teamId ? "Brak zawodników spełniających filtry." : "Wybierz drużynę w panelu bocznym."}
                  </td>
                </tr>
              )}
              {loading.players && (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-stone-200" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

