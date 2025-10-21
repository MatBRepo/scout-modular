// src/app/admin/manage/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Player, Observation } from "@/shared/types";
import {
  Users,
  NotebookPen,
  PlusCircle,
  TrendingUp,
  Star,
  ArrowRight,
  Calendar,
  Clock,
  ShieldCheck,
  Search,
  X,
  Tv,
  Radio,
  Database,
  Activity,    // ← safe replacement for "Timeline"
  Compass,
  ChevronDown,
  Wand2,       // ← safe replacement for "Sparkles"
} from "lucide-react";

/* ---------- Types ---------- */
type KPIs = {
  playersTotal: number;
  playersKnown: number;
  playersUnknown: number;
  playersActive: number;
  playersTrash: number;
  obsTotal: number;
  obsDraft: number;
  obsFinal: number;
};

type Mode = "live" | "tv";

/* ---------- Page ---------- */
export default function Page() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [obs, setObs] = useState<Observation[]>([]);
  const [query, setQuery] = useState("");
  const [obsModeFilter, setObsModeFilter] = useState<"" | Mode>("");
  const [obsStatusFilter, setObsStatusFilter] = useState<"" | "draft" | "final">("");
  const [quickOpen, setQuickOpen] = useState(false);

  // Quick Observe form
  const [qMatch, setQMatch] = useState("");
  const [qDate, setQDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [qTime, setQTime] = useState<string>(() => new Date().toTimeString().slice(0, 5));
  const [qMode, setQMode] = useState<Mode>("live");
  const [qStatus, setQStatus] = useState<"draft" | "final">("draft");
  const [qSaving, setQSaving] = useState(false);

  // Load demo data from localStorage (if present)
  useEffect(() => {
    try {
      const pRaw = localStorage.getItem("s4s.players");
      const oRaw = localStorage.getItem("s4s.observations");
      if (pRaw) setPlayers(JSON.parse(pRaw));
      if (oRaw) setObs(JSON.parse(oRaw));
    } catch {}
  }, []);

  // Keep sidebar counters fresh when we seed/add
  const syncToLS = (p: Player[] | null, o: Observation[] | null) => {
    try {
      if (p) localStorage.setItem("s4s.players", JSON.stringify(p));
      if (o) localStorage.setItem("s4s.observations", JSON.stringify(o));
      if (p) setPlayers(p);
      if (o) setObs(o);
      // best-effort notify other listeners
      window.dispatchEvent(new StorageEvent("storage", { key: "s4s.players" }));
      window.dispatchEvent(new StorageEvent("storage", { key: "s4s.observations" }));
    } catch {}
  };

  /* ---------- KPI calc ---------- */
  const kpis: KPIs = useMemo(() => {
    const playersTotal = players.length;
    const playersKnown = players.filter((p) => (p as any).firstName || (p as any).lastName).length;
    const playersUnknown = playersTotal - playersKnown;
    const playersActive = players.filter((p) => p.status === "active").length;
    const playersTrash = players.filter((p) => p.status === "trash").length;

    const obsTotal = obs.length;
    const obsDraft = obs.filter((o) => o.status === "draft").length;
    const obsFinal = obs.filter((o) => o.status === "final").length;

    return { playersTotal, playersKnown, playersUnknown, playersActive, playersTrash, obsTotal, obsDraft, obsFinal };
  }, [players, obs]);

  /* ---------- Recent lists ---------- */
  const recentPlayers = useMemo(() => [...players].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 6), [players]);

  const recentObsRaw = useMemo(() => {
    const toDate = (o: Observation) => new Date(`${o.date}T${o.time || "00:00"}`).getTime();
    return [...obs].sort((a, b) => toDate(b) - toDate(a)).slice(0, 8);
  }, [obs]);

  // Apply dashboard filters (query / obs mode / obs status)
  const recentObs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recentObsRaw
      .filter((o) => {
        if (!q) return true;
        return (o.match || "").toLowerCase().includes(q) || (o.player || "").toLowerCase().includes(q);
      })
      .filter((o) => (obsModeFilter ? ((o as any).mode ?? "live") === obsModeFilter : true))
      .filter((o) => (obsStatusFilter ? o.status === obsStatusFilter : true));
  }, [recentObsRaw, query, obsModeFilter, obsStatusFilter]);

  const hasActiveFilters = Boolean(query || obsModeFilter || obsStatusFilter);

  /* ---------- Activity sparkline (last 8 weeks) ---------- */
  const spark = useMemo(() => {
    const buckets = Array(8).fill(0); // weeks from oldest->newest
    const now = new Date();
    obs.forEach((o) => {
      const d = new Date(`${o.date}T${o.time || "00:00"}`);
      const diffWeeks = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 3600 * 1000));
      const idxFromEnd = Math.min(7, Math.max(0, diffWeeks));
      const idx = 7 - idxFromEnd;
      buckets[idx] = (buckets[idx] || 0) + 1;
    });
    const max = Math.max(1, ...buckets);
    return { buckets, max };
  }, [obs]);

  /* ---------- Seed demo data ---------- */
  function seedDemo() {
    const demoPlayers: Player[] = [
      { id: 101, name: "Kacper Wójcik", club: "Zagłębie U19", pos: "LW", age: 18, status: "active" },
      { id: 102, name: "Michał Dziedzic", club: "Lech U19", pos: "CM", age: 17, status: "active" },
      { id: 103, name: "Adam Krupa", club: "Legia U17", pos: "CB", age: 16, status: "active" },
      { id: 104, name: "Nieznany #27", club: "Sparing — bez klubu", pos: "?", age: undefined as any, status: "active" },
      { id: 105, name: "Patryk Lis", club: "Pogoń U19", pos: "RB", age: 18, status: "trash" },
    ];
    const todayISO = new Date().toISOString().slice(0, 10);
    const y1 = addDays(todayISO, -3);
    const y2 = addDays(todayISO, -9);
    const y3 = addDays(todayISO, -17);
    const demoObs: Observation[] = [
      { id: 201, match: "Lech U19 vs Legia U19", player: "Michał Dziedzic", date: y1, time: "12:00", status: "final", ...( { mode: "live" } as any) },
      { id: 202, match: "Pogoń U19 vs Warta U19", player: "", date: todayISO, time: "15:30", status: "draft", ...( { mode: "tv" } as any) },
      { id: 203, match: "Sparing A", player: "Nieznany #27", date: y2, time: "10:30", status: "draft", ...( { mode: "live" } as any) },
      { id: 204, match: "Zagłębie U19 vs Śląsk U19", player: "Kacper Wójcik", date: y3, time: "11:00", status: "final", ...( { mode: "tv" } as any) },
    ];
    syncToLS(demoPlayers, demoObs);
  }

  /* ---------- Quick Observation add ---------- */
  function addQuickObservation() {
    if (!qMatch.trim()) return;
    setQSaving(true);
    setTimeout(() => {
      const nextId = Math.max(0, ...obs.map((o) => o.id)) + 1;
      const o: Observation = {
        id: nextId,
        match: qMatch.trim(),
        player: "",
        date: qDate,
        time: qTime,
        status: qStatus,
        ...( { mode: qMode } as any ),
      };
      const next = [o, ...obs];
      syncToLS(null, next);
      setQSaving(false);
      setQuickOpen(false);
      // reset
      setQMatch("");
      setQDate(new Date().toISOString().slice(0, 10));
      setQTime(new Date().toTimeString().slice(0, 5));
      setQMode("live");
      setQStatus("draft");
    }, 300);
  }

  return (
    <div className="space-y-6">
      {/* Header / welcome */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zarządzanie</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-neutral-300">
            Przegląd danych, szybkie akcje oraz ostatnie aktywności.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/players/new">
            <Button className="bg-gray-900 text-white hover:bg-gray-800">
              <PlusCircle className="mr-2 h-4 w-4" />
              Dodaj zawodnika
            </Button>
          </Link>
          <Button
            variant="outline"
            className="border-gray-300 dark:border-neutral-700"
            onClick={() => setQuickOpen((v) => !v)}
          >
            Szybka obserwacja
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="border-gray-300 dark:border-neutral-700"
            onClick={seedDemo}
            title="Wypełnij danymi demo (LocalStorage)"
          >
            <Database className="mr-2 h-4 w-4" />
            Seed demo
          </Button>
        </div>
      </div>

      {/* Quick observation inline */}
      {quickOpen && (
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardContent className="mt-4 grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Mecz (kto vs kto)</label>
              <Input placeholder="np. Lech U19 vs Legia U19" value={qMatch} onChange={(e) => setQMatch(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Data</label>
              <Input type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Godzina</label>
              <Input type="time" value={qTime} onChange={(e) => setQTime(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Tryb</label>
                <div className="inline-flex overflow-hidden rounded-md border dark:border-neutral-700">
                  {(["live", "tv"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setQMode(m)}
                      className={`px-3 py-1 text-sm ${
                        qMode === m ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"
                      }`}
                    >
                      {m === "live" ? "Live" : "TV"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Status</label>
                <div className="inline-flex overflow-hidden rounded-md border dark:border-neutral-700">
                  {(["draft", "final"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setQStatus(s)}
                      className={`px-3 py-1 text-sm ${
                        qStatus === s ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"
                      }`}
                    >
                      {s === "draft" ? "Szkic" : "Finalna"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="sm:col-span-5 flex items-center justify-end gap-2">
              <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setQuickOpen(false)}>
                Anuluj
              </Button>
              <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={addQuickObservation} disabled={qSaving}>
                {qSaving ? "Zapisywanie…" : "Dodaj obserwację"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart search & quick observation filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Szukaj (zawodnik, klub, mecz)…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <ChipToggle active={obsModeFilter === ""} label="Wszystkie tryby" onClick={() => setObsModeFilter("")} />
          <ChipToggle active={obsModeFilter === "live"} icon={<Radio className="h-3.5 w-3.5" />} label="Live" onClick={() => setObsModeFilter("live")} />
          <ChipToggle active={obsModeFilter === "tv"} icon={<Tv className="h-3.5 w-3.5" />} label="TV" onClick={() => setObsModeFilter("tv")} />

          <ChipToggle active={obsStatusFilter === ""} label="Wszystkie statusy" onClick={() => setObsStatusFilter("")} />
          <ChipToggle active={obsStatusFilter === "draft"} label="Szkice" color="amber" onClick={() => setObsStatusFilter("draft")} />
          <ChipToggle active={obsStatusFilter === "final"} label="Finalne" color="green" onClick={() => setObsStatusFilter("final")} />
        </div>

        <div className="ml-auto flex gap-2">
          <Link href="/players">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700">
              Otwórz listę <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/observations">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700">
              Obserwacje <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Active filter summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-neutral-400">Aktywne filtry:</span>
          {query && <ActiveFilterChip label={`Szukaj: “${query}”`} onClear={() => setQuery("")} />}
          {obsModeFilter && <ActiveFilterChip label={`Tryb: ${obsModeFilter === "live" ? "Live" : "TV"}`} onClear={() => setObsModeFilter("")} />}
          {obsStatusFilter && (
            <ActiveFilterChip label={`Status: ${obsStatusFilter === "final" ? "Finalne" : "Szkice"}`} onClear={() => setObsStatusFilter("")} />
          )}
          <button
            className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            onClick={() => {
              setQuery("");
              setObsModeFilter("");
              setObsStatusFilter("");
            }}
          >
            Wyczyść wszystko
          </button>
        </div>
      )}

      {/* KPI + Sparkline */}
      <div className="grid gap-3 lg:grid-cols-5">
        <KpiCard title="Wszyscy zawodnicy" value={kpis.playersTotal} icon={<Users className="h-4 w-4" />} hint={`${kpis.playersKnown} znanych · ${kpis.playersUnknown} nieznanych`} />
        <KpiCard title="Aktywni / Kosz" value={`${kpis.playersActive} / ${kpis.playersTrash}`} icon={<ShieldCheck className="h-4 w-4" />} hint="Zarządzaj statusami w My Players" />
        <KpiCard title="Obserwacje ogółem" value={kpis.obsTotal} icon={<NotebookPen className="h-4 w-4" />} hint={`${kpis.obsFinal} finalnych · ${kpis.obsDraft} szkiców`} />
        <KpiCard title="Trend aktywności" value={Math.min(100, 30 + kpis.obsTotal * 7) + "%"} icon={<TrendingUp className="h-4 w-4" />} hint="Szacowany wzrost aktywności" />
        <Card className="border-gray-200 transition-all hover:shadow-sm dark:border-neutral-800">
          <CardHeader className="space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-neutral-400">Aktywność 8 tyg.</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Sparkline values={spark.buckets} max={spark.max} />
            <p className="mt-2 text-[11px] text-gray-500 dark:text-neutral-400">Obserwacje na tydzień</p>
          </CardContent>
        </Card>
      </div>

      {/* Two columns: Recent players & Recent observations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent players */}
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Ostatnio dodani zawodnicy</CardTitle>
            <Link href="/players" className="text-sm text-gray-600 hover:underline dark:text-neutral-300">
              Zobacz wszystkich
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPlayers.length === 0 ? (
              <EmptyRow text="Nie dodano jeszcze zawodników." actionHref="/players/new" actionText="Dodaj zawodnika" />
            ) : (
              <ul className="divide-y divide-gray-200 text-sm dark:divide-neutral-800">
                {recentPlayers
                  .filter((p) => {
                    if (!query.trim()) return true;
                    const q = query.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q);
                  })
                  .map((p) => {
                    const known = (p as any).firstName || (p as any).lastName;
                    return (
                      <li key={p.id} className="flex items-center gap-3 py-2">
                        {/* Avatar / image placeholder */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 text-xs font-medium dark:border-neutral-800 dark:bg-neutral-900">
                          {initials(p.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/players/${p.id}`} className="truncate font-medium hover:underline">
                              {p.name}
                            </Link>
                            <span
                              className={
                                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium " +
                                (known
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200")
                              }
                            >
                              {known ? "znany" : "nieznany"}
                            </span>
                          </div>
                          <div className="truncate text-xs text-gray-500 dark:text-neutral-400">
                            {p.club || "—"} • {p.pos} • {p.age || "—"}
                          </div>
                        </div>
                        <Link href={`/players/${p.id}`}>
                          <Button size="sm" variant="outline" className="h-8 border-gray-300 dark:border-neutral-700">
                            Otwórz
                          </Button>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent observations (match-centric) */}
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Ostatnie obserwacje</CardTitle>
            <Link href="/observations" className="text-sm text-gray-600 hover:underline dark:text-neutral-300">
              Przejdź do listy
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentObs.length === 0 ? (
              <EmptyRow text="Brak obserwacji." actionHref="/observations" actionText="Otwórz obserwacje" />
            ) : (
              <ul className="divide-y divide-gray-200 text-sm dark:divide-neutral-800">
                {recentObs.map((o) => {
                  const mode = (o as any).mode ?? "live";
                  return (
                    <li key={o.id} className="flex items-center gap-3 py-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                        <Star className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{o.match || "—"}</span>
                          {/* status */}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              o.status === "final"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                            }`}
                          >
                            {o.status === "final" ? "finalna" : "szkic"}
                          </span>
                          {/* mode */}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              mode === "live"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                                : "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                            }`}
                          >
                            {mode === "live" ? "Live" : "TV"}
                          </span>
                        </div>
                        <div className="truncate text-xs text-gray-500 dark:text-neutral-400">
                          {o.player ? `Obserwowany: ${o.player} • ` : ""}
                          {o.time ? `${formatDate(o.date)} ${o.time}` : formatDate(o.date)}
                        </div>
                      </div>
                      <div className="hidden text-xs text-gray-500 sm:block dark:text-neutral-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(o.date)}</span>
                        </div>
                        {o.time && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{o.time}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline / activity feed */}
      <Card className="border-gray-200 dark:border-neutral-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Activity className="h-4 w-4" /> Ostatnie aktywności
          </CardTitle>
          <Link href="/players/global/search" className="text-sm text-gray-600 hover:underline dark:text-neutral-300">
            Odkrywaj <Compass className="ml-1 inline h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {buildActivityTimeline(players, obs).map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                  {item.type === "player" ? <Users className="h-4 w-4" /> : <NotebookPen className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <div className="truncate text-xs text-gray-500 dark:text-neutral-400">{item.subtitle}</div>
                </div>
                <div className="shrink-0 text-[11px] text-gray-500 dark:text-neutral-400">{item.when}</div>
              </li>
            ))}
            {buildActivityTimeline(players, obs).length === 0 && (
              <div className="flex items-center justify-between rounded-md border border-dashed border-gray-200 p-4 text-sm dark:border-neutral-800">
                <span className="text-gray-500 dark:text-neutral-400">Brak aktywności — dodaj zawodnika lub obserwację.</span>
                <Link href="/players/new">
                  <Button size="sm" className="bg-gray-900 text-white hover:bg-gray-800">
                    <Wand2 className="mr-2 h-4 w-4" />
                    Start
                  </Button>
                </Link>
              </div>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Shortcuts */}
      <Card className="border-gray-200 dark:border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Szybkie akcje</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/players/new">
            <Button className="bg-gray-900 text-white hover:bg-gray-800">
              <PlusCircle className="mr-2 h-4 w-4" />
              Dodaj zawodnika
            </Button>
          </Link>
          <Link href="/players">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700">
              <Users className="mr-2 h-4 w-4" />
              Otwórz My Players
            </Button>
          </Link>
          <Link href="/observations">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700">
              <NotebookPen className="mr-2 h-4 w-4" />
              Otwórz Observations
            </Button>
          </Link>
          <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setQuickOpen(true)}>
            <Radio className="mr-2 h-4 w-4" />
            Szybka obserwacja
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Small helpers (local to avoid undefined components) ---------- */

function KpiCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="border-gray-200 transition-all hover:shadow-sm dark:border-neutral-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-gray-500 dark:text-neutral-400">{title}</CardTitle>
        <div className="text-gray-500 dark:text-neutral-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyRow({ text, actionHref, actionText }: { text: string; actionHref: string; actionText: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-dashed border-gray-200 p-4 text-sm dark:border-neutral-800">
      <span className="text-gray-500 dark:text-neutral-400">{text}</span>
      <Link href={actionHref}>
        <Button size="sm" className="bg-gray-900 text-white hover:bg-gray-800">
          {actionText}
        </Button>
      </Link>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const i1 = parts[0]?.[0] ?? "";
  const i2 = parts[1]?.[0] ?? "";
  return (i1 + i2).toUpperCase();
}

function formatDate(dateISO?: string) {
  if (!dateISO) return "—";
  try {
    return new Date(dateISO).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateISO;
  }
}

/* Filter chips */
function ChipToggle({
  active,
  label,
  onClick,
  color,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  color?: "amber" | "green";
  icon?: React.ReactNode;
}) {
  const base = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition";
  const off = "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700";
  theOnColor: {
  }
  const onBlue = "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
  const onAmber = "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  const onGreen = "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  const on = color === "amber" ? onAmber : color === "green" ? onGreen : onBlue;

  return (
    <button className={`${base} ${active ? on : off}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
      {label}
      <button onClick={onClear} aria-label="Usuń filtr" className="rounded-full p-0.5 hover:bg-gray-200 dark:hover:bg-neutral-700">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/* Sparkline (simple SVG bars) */
function Sparkline({ values, max }: { values: number[]; max: number }) {
  const height = 28;
  const gap = 4;
  const barW = 10;
  const width = values.length * (barW + gap) + gap;
  return (
    <svg width={width} height={height} className="block">
      {values.map((v, i) => {
        const h = Math.round((v / max) * (height - 4)) || 2;
        const x = gap + i * (barW + gap);
        const y = height - h;
        return <rect key={i} x={x} y={y} width={barW} height={h} rx={2} className="fill-gray-300 dark:fill-neutral-700" />;
      })}
    </svg>
  );
}

/* Activity timeline builder */
function buildActivityTimeline(players: Player[], obs: Observation[]) {
  type Item = { id: string; type: "player" | "obs"; title: string; subtitle: string; when: string };
  const pItems: Item[] = players
    .slice(-6)
    .reverse()
    .map((p) => ({
      id: `p-${p.id}`,
      type: "player",
      title: `Dodano zawodnika: ${p.name}`,
      subtitle: `${p.club || "—"} • ${p.pos || "—"} • ${p.age ?? "—"}`,
      when: "ostatnio",
    }));
  const oItems: Item[] = obs.slice(0, 6).map((o) => ({
    id: `o-${o.id}`,
    type: "obs",
    title: `Obserwacja: ${o.match || "—"}`,
    subtitle: `${formatDate(o.date)} ${o.time || ""} • ${o.status === "final" ? "finalna" : "szkic"}`,
    when: "ostatnio",
  }));
  return [...oItems, ...pItems].slice(0, 8);
}

/* date util */
function addDays(iso: string, delta: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
