"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  NotebookPen,
  RefreshCw,
  Search,
  Users,
  Filter,
  MapPin,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabaseClient";
import type { Player, Observation } from "@/shared/types";

/* ============================== Types ============================== */

type Rank = "bronze" | "silver" | "gold" | "platinum";

type Scout = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  region?: string;
  role: "scout" | "scout-agent";
  playersCount: number;
  observationsCount: number;
  lastActive?: string;
  note?: string;
  playersCompleteness?: number | null;
  active?: boolean | null;
  avgObsPerPlayer?: number | null;
  activity01?: number | null;

  _kpi?: number;
  _avgCompleteness?: number;
  _activity?: number;
  _vol01?: number;
  _avgObsPerPlayer?: number;
  _rankBand?: Rank;
  _position?: number;
  _delta?: number;
};

type DbScoutRow = {
  id: string;
  name: string | null;
  role: string | null;
  players_count: number | null;
  observations_count: number | null;
  last_active: string | null;
  email: string | null;
  phone: string | null;
  region: string | null;
  note: string | null;
  players_completeness: number | null;
  active: boolean | null;

  obs_14: number | null;
  players_14: number | null;
  avg_obs_per_player: number | null;
  activity_01: number | null;
};

/* =============================== Utils ============================= */

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    const t = date.getTime();
    if (!Number.isFinite(t) || t <= 0) return "—";
    return date.toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtTimeShort(iso?: string | null) {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    const t = date.getTime();
    if (!Number.isFinite(t) || t <= 0) return "—";
    return date.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function daysSince(iso?: string) {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t <= 0) return 999;
  const diff = Date.now() - t;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function calcRankBand(players: number, obs: number): Rank {
  const score = players * 2 + obs;
  if (score >= 100) return "platinum";
  if (score >= 50) return "gold";
  if (score >= 20) return "silver";
  return "bronze";
}
function rankLabel(r: Rank) {
  if (r === "platinum") return "Platinum";
  if (r === "gold") return "Gold";
  if (r === "silver") return "Silver";
  return "Bronze";
}
function rankPillCls(r: Rank) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1";
  if (r === "platinum")
    return `${base} bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-800/70`;
  if (r === "gold")
    return `${base} bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/70`;
  if (r === "silver")
    return `${base} bg-stone-100 text-stone-800 ring-stone-200 dark:bg-stone-800/40 dark:text-stone-200 dark:ring-stone-700/70`;
  return `${base} bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:ring-orange-800/70`;
}

function computeActivity01FromLastActive(lastActive?: string) {
  const d = daysSince(lastActive);
  const span = 14;
  return clamp01(1 - d / span);
}

function computeKpi(s: Scout) {
  const compRaw =
    typeof s.playersCompleteness === "number" ? s.playersCompleteness : 0;
  const comp = clamp01(compRaw);

  const act =
    typeof s.activity01 === "number"
      ? clamp01(s.activity01)
      : computeActivity01FromLastActive(s.lastActive);

  const volRaw =
    typeof s.avgObsPerPlayer === "number"
      ? s.avgObsPerPlayer
      : s.playersCount > 0
      ? s.observationsCount / s.playersCount
      : 0;

  const vol01 = clamp01(volRaw / 10);

  if (s.playersCount === 0 && s.observationsCount === 0) {
    return { kpi: 0, comp01: comp, act01: act, vol01, volRaw };
  }

  const score01 = 0.5 * comp + 0.3 * act + 0.2 * vol01;
  const kpi = Math.round(score01 * 200);
  return { kpi, comp01: comp, act01: act, vol01, volRaw };
}

function mapRowToScout(row: DbScoutRow): Scout {
  const playersCount = row.players_count ?? 0;
  const observationsCount = row.observations_count ?? 0;

  const playersCompleteness =
    typeof row.players_completeness === "number" && playersCount > 0
      ? row.players_completeness
      : 0;

  const normalizedRole: Scout["role"] =
    row.role === "scout-agent" ? "scout-agent" : "scout";

  return {
    id: row.id,
    name: row.name || "Bez nazwy",
    email: row.email || undefined,
    phone: row.phone || undefined,
    region: row.region || undefined,
    role: normalizedRole,
    playersCount,
    observationsCount,
    lastActive: row.last_active ?? undefined,
    note: row.note ?? undefined,
    playersCompleteness,
    active: row.active ?? null,
    avgObsPerPlayer: row.avg_obs_per_player ?? null,
    activity01: row.activity_01 ?? null,
  };
}

/* ========================== Small UI pieces ========================== */

function PositionPill({ pos, delta }: { pos: number; delta: number }) {
  const deltaColor =
    delta > 0
      ? "text-emerald-600"
      : delta < 0
      ? "text-rose-600"
      : "text-gray-400";
  const deltaTxt =
    delta === 0 ? "→" : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-sm font-semibold dark:bg-neutral-800">
        {pos}
      </div>
      <div className={`inline-flex items-center text-xs ${deltaColor}`}>
        {deltaTxt}
      </div>
    </div>
  );
}

function TinyBar({
  value,
  className,
  title,
}: {
  value: number;
  className: string;
  title: string;
}) {
  return (
    <div
      title={title}
      className="mt-0.5 h-1.5 w-20 rounded-full bg-gray-100 dark:bg-neutral-800"
    >
      <div
        className={`h-1.5 rounded-full ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, Math.round(value)))}%` }}
      />
    </div>
  );
}

function KpiCell({
  kpi,
  comp01,
  act01,
  vol01,
  avgObsPerPlayer,
}: {
  kpi: number;
  comp01: number;
  act01: number;
  vol01: number;
  avgObsPerPlayer?: number;
}) {
  const avgLabel =
    typeof avgObsPerPlayer === "number"
      ? `${avgObsPerPlayer.toFixed(1)} / zawodnika`
      : `${Math.round(vol01 * 100)}%`;

  return (
    <div className="space-y-1">
      <div className="text-lg font-semibold leading-none">{kpi}</div>
      <div className="grid grid-cols-3 gap-2 text-[10px] text-dark">
        <div>
          <div className="flex flex-wrap items-center justify-between">
            <span>Comp</span>
            <span>{Math.round(comp01 * 100)}%</span>
          </div>
          <TinyBar
            value={comp01 * 100}
            className="bg-indigo-500"
            title="Śr. kompletność profili"
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between">
            <span>Akt</span>
            <span>{Math.round(act01 * 100)}%</span>
          </div>
          <TinyBar
            value={act01 * 100}
            className="bg-emerald-500"
            title="Aktywność (ostatnie 14 dni)"
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between">
            <span>Śr. wolumen</span>
            <span>{avgLabel}</span>
          </div>
          <TinyBar
            value={vol01 * 100}
            className="bg-stone-500"
            title="Średni wolumen obserwacji względem zawodników"
          />
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: Scout["role"] }) {
  const label = role === "scout-agent" ? "Scout-agent" : "Scout";
  const cls =
    role === "scout-agent"
      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-100"
      : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function ActivityTag({
  lastActive,
  activity01,
}: {
  lastActive?: string;
  activity01?: number | null;
}) {
  const act =
    typeof activity01 === "number"
      ? clamp01(activity01)
      : computeActivity01FromLastActive(lastActive);
  const days = daysSince(lastActive);

  let label = "Brak aktywności";
  let dotCls = "bg-gray-400";
  if (act > 0.66) {
    label = "Bardzo aktywny";
    dotCls = "bg-emerald-500";
  } else if (act > 0.33) {
    label = "Aktywny";
    dotCls = "bg-amber-400";
  } else if (act > 0) {
    label = "Rzadko aktywny";
    dotCls = "bg-orange-500";
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-dark dark:bg-neutral-900 dark:text-neutral-300">
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      <span>{label}</span>
      {isFinite(days) && days < 999 && (
        <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
          ({days === 0 ? "dzisiaj" : `${days} dni temu`})
        </span>
      )}
    </span>
  );
}

const stepPillClass =
  "inline-flex h-6 items-center rounded-md bg-stone-100 px-2.5 text-[11px] tracking-wide text-stone-600 dark:bg-neutral-900 dark:text-neutral-200";

/* ================================ Page ================================ */

export default function ScoutsAdminPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Scout[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState(""); // global search
  const [nameQ, setNameQ] = useState(""); // only by name
  const [region, setRegion] = useState("");
  const [minPlayers, setMinPlayers] = useState<number | "">("");
  const [minObs, setMinObs] = useState<number | "">("");
  const [roleFilter, setRoleFilter] = useState<"all" | "scout" | "scout-agent">(
    "all"
  );
  const [onlyActive14, setOnlyActive14] = useState(false);

  const [sortKey, setSortKey] = useState<
    "position" | "name" | "kpi" | "players" | "obs" | "lastActive" | "rank"
  >("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  // accordions
  const [listOpen, setListOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);

  // which scout has “Details” open
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchScouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("scouts_admin_view")
        .select("*");

      if (error) throw error;
      const mapped: Scout[] =
        ((data as DbScoutRow[] | null) ?? []).map(mapRowToScout);
      setRows(mapped);

      const stamp = new Date().toISOString();
      setLastRefresh(stamp);
    } catch (e: any) {
      console.error("Error fetching scouts:", e);
      setError(
        e?.message || "Nie udało się pobrać listy scoutów z Supabase."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScouts();
  }, [fetchScouts]);

  function doRefresh() {
    fetchScouts();
  }

  const enriched = useMemo(() => {
    const base = rows.map((s) => {
      const { kpi, comp01, act01, vol01, volRaw } = computeKpi(s);
      const rankBand = calcRankBand(s.playersCount, s.observationsCount);
      return {
        ...s,
        _kpi: kpi,
        _avgCompleteness: comp01,
        _activity: act01,
        _vol01: vol01,
        _avgObsPerPlayer: volRaw,
        _rankBand: rankBand,
      };
    });

    const ranked = [...base].sort((a, b) => {
      if ((b._kpi ?? 0) !== (a._kpi ?? 0))
        return (b._kpi as number) - (a._kpi as number);
      return daysSince(a.lastActive) - daysSince(b.lastActive);
    });

    return ranked.map((s, i) => ({
      ...s,
      _position: i + 1,
      _delta: 0,
    }));
  }, [rows]);

  const summary = useMemo(() => {
    const totalScouts = enriched.length;
    const totalPlayers = enriched.reduce(
      (acc, s) => acc + (s.playersCount || 0),
      0
    );
    const totalObs = enriched.reduce(
      (acc, s) => acc + (s.observationsCount || 0),
      0
    );
    const active14 = enriched.filter((s) => {
      const act =
        typeof s.activity01 === "number"
          ? clamp01(s.activity01)
          : computeActivity01FromLastActive(s.lastActive);
      return act > 0;
    }).length;
    return { totalScouts, totalPlayers, totalObs, active14 };
  }, [enriched]);

  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (q.trim()) c++;
    if (nameQ.trim()) c++;
    if (region.trim()) c++;
    if (minPlayers !== "") c++;
    if (minObs !== "") c++;
    if (roleFilter !== "all") c++;
    if (onlyActive14) c++;
    return c;
  }, [q, nameQ, region, minPlayers, minObs, roleFilter, onlyActive14]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const nameFilter = nameQ.trim().toLowerCase();

    const list = enriched.filter((r) => {
      const matchesGlobal = !qq
        ? true
        : [r.name, r.email, r.phone, r.region, r.role]
            .filter(Boolean)
            .map((x) => String(x).toLowerCase())
            .some((x) => x.includes(qq));

      const matchesName = !nameFilter
        ? true
        : r.name.toLowerCase().includes(nameFilter);

      const matchesRegion = region
        ? (r.region || "").toLowerCase().includes(region.toLowerCase())
        : true;

      const pOK =
        minPlayers === "" ? true : r.playersCount >= Number(minPlayers);
      const oOK =
        minObs === "" ? true : r.observationsCount >= Number(minObs);

      const roleOK =
        roleFilter === "all" ? true : r.role === roleFilter;

      const act =
        typeof r.activity01 === "number"
          ? clamp01(r.activity01)
          : computeActivity01FromLastActive(r.lastActive);
      const activeOK = !onlyActive14 ? true : act > 0;

      return (
        matchesGlobal &&
        matchesName &&
        matchesRegion &&
        pOK &&
        oOK &&
        roleOK &&
        activeOK
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "position")
        return (((a._position as number) - (b._position as number)) || 0) * dir;
      if (sortKey === "kpi")
        return (((a._kpi as number) - (b._kpi as number)) || 0) * dir;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "players")
        return (a.playersCount - b.playersCount) * dir;
      if (sortKey === "obs")
        return (a.observationsCount - b.observationsCount) * dir;
      if (sortKey === "rank") {
        const order: Rank[] = ["bronze", "silver", "gold", "platinum"];
        return (
          order.indexOf(a._rankBand as Rank) -
          order.indexOf(b._rankBand as Rank)
        ) * dir;
      }
      const ad = a.lastActive || "";
      const bd = b.lastActive || "";
      return (ad < bd ? -1 : ad > bd ? 1 : 0) * dir;
    });
  }, [
    enriched,
    q,
    nameQ,
    region,
    minPlayers,
    minObs,
    sortKey,
    sortDir,
    roleFilter,
    onlyActive14,
  ]);

  const resetFilters = () => {
    setRegion("");
    setMinPlayers("");
    setMinObs("");
    setQ("");
    setNameQ("");
    setRoleFilter("all");
    setOnlyActive14(false);
  };

  return (
    <div className="w-full space-y-4">
      <Toolbar
        title="Lista scoutów"
        subtitle="Zobacz aktywność i jakość pracy scoutów oraz szybko podejrzyj listę ich zawodników i obserwacji."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {/* search cluster desktop (global) */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Szukaj po nazwisku, e-mailu, regionie…"
                  className="w-72 max-w-full pl-8"
                />
              </div>
              {q && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground hover:bg-muted"
                  onClick={() => setQ("")}
                >
                  Wyczyść
                </Button>
              )}
            </div>

            {/* Mobile filters toggle */}
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1 border-gray-300 text-xs dark:border-neutral-700 sm:hidden"
              onClick={() => setFiltersOpenMobile((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              Filtry
              {activeFiltersCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* REFRESH */}
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1 border-gray-300 text-xs dark:border-neutral-700"
              onClick={doRefresh}
              title={
                lastRefresh
                  ? `Ostatnie odświeżenie: ${fmtDate(lastRefresh)}`
                  : "Odśwież teraz z Supabase"
              }
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Ładuję…" : "Odśwież"}
              {lastRefresh && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {fmtTimeShort(lastRefresh)}
                </span>
              )}
            </Button>
          </div>
        }
      />

      {/* Search bar on mobile (global) */}
      <div className="sm:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj scouta…"
            className="w-full pl-8"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* ========== SEK CJA 1 – LISTA SCOUTÓW (filtry + tabela/karty + Details inline) ========== */}
      <Card className="mt-1">
        <CardHeader
          className={cn(
            "group flex items-center justify-between rounded-md border-gray-200 p-0 transition-colors hover:bg-stone-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
            listOpen && "bg-stone-100 dark:bg-neutral-900/70"
          )}
        >
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls="scouts-list-panel"
            onClick={() => setListOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-4 text-left"
          >
            <div>
              <div className={stepPillClass}>Sekcja 1 · Lista scoutów</div>
              <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                Ranking i szczegóły pracy scoutów
              </div>
              <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                Filtry, KPI oraz szybki wgląd w listę zawodników i obserwacji
                bez opuszczania tabeli.
              </p>
            </div>
            <div className="flex items-center gap-3 pl-4">
              <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                {summary.totalScouts} scoutów
              </span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 transition-transform",
                  listOpen ? "rotate-180" : "rotate-0"
                )}
              />
            </div>
          </button>
        </CardHeader>
        <CardContent className="px-3 py-0 md:px-4">
          <Accordion
            type="single"
            collapsible
            value={listOpen ? "list" : undefined}
            onValueChange={(v) => setListOpen(v === "list")}
            className="w-full"
          >
            <AccordionItem value="list" className="border-0">
              <AccordionContent id="scouts-list-panel" className="pt-4 pb-4">
                {/* Filters (w tym search by name) */}
                <div className="mb-4">
                  <Card className="border-gray-200 shadow-sm dark:border-neutral-800">
                    <CardContent
                      className={cn(
                        "grid gap-3 p-3 transition-[grid-template-rows,opacity]",
                        filtersOpenMobile
                          ? "grid-rows-[1fr] opacity-100 sm:grid-rows-[1fr]"
                          : "grid-rows-[0fr] opacity-0 sm:grid-rows-[1fr] sm:opacity-100"
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                          <div>
                            <Label className="mb-1 block text-xs text-muted-foreground">
                              Nazwisko / imię (tylko po nazwie)
                            </Label>
                            <Input
                              value={nameQ}
                              onChange={(e) => setNameQ(e.target.value)}
                              placeholder="np. Kowalski"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs text-muted-foreground">
                              Region
                            </Label>
                            <Input
                              value={region}
                              onChange={(e) => setRegion(e.target.value)}
                              placeholder="np. Mazowsze…"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs text-muted-foreground">
                              Min. zawodników
                            </Label>
                            <Input
                              type="number"
                              value={minPlayers}
                              onChange={(e) =>
                                setMinPlayers(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value)
                                )
                              }
                              placeholder="—"
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs text-muted-foreground">
                              Min. obserwacji
                            </Label>
                            <Input
                              type="number"
                              value={minObs}
                              onChange={(e) =>
                                setMinObs(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value)
                                )
                              }
                              placeholder="—"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="inline-flex flex-wrap gap-1">
                            <Button
                              variant={
                                roleFilter === "all" ? "default" : "outline"
                              }
                              className="h-7 px-2 text-[11px]"
                              onClick={() => setRoleFilter("all")}
                            >
                              Wszyscy
                            </Button>
                            <Button
                              variant={
                                roleFilter === "scout"
                                  ? "default"
                                  : "outline"
                              }
                              className="h-7 px-2 text-[11px]"
                              onClick={() => setRoleFilter("scout")}
                            >
                              Scout
                            </Button>
                            <Button
                              variant={
                                roleFilter === "scout-agent"
                                  ? "default"
                                  : "outline"
                              }
                              className="h-7 px-2 text-[11px]"
                              onClick={() => setRoleFilter("scout-agent")}
                            >
                              Scout-agent
                            </Button>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-gray-300 text-gray-900"
                                checked={onlyActive14}
                                onChange={(e) =>
                                  setOnlyActive14(e.target.checked)
                                }
                              />
                              <span>Tylko aktywni 14 dni</span>
                            </label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-[11px] text-muted-foreground hover:bg-muted"
                              onClick={resetFilters}
                            >
                              Resetuj filtry
                            </Button>
                          </div>
                        </div>

                        {activeFiltersCount > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground">
                              Aktywne filtry ({activeFiltersCount}):
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {q.trim() && (
                                <Chip
                                  label={
                                    `Szukaj (globalnie): “${q.trim()}` + "”"
                                  }
                                />
                              )}
                              {nameQ.trim() && (
                                <Chip label={`Nazwa: ${nameQ}`} />
                              )}
                              {region.trim() && (
                                <Chip label={`Region: ${region}`} />
                              )}
                              {minPlayers !== "" && (
                                <Chip
                                  label={`Min. zawodników: ${minPlayers}`}
                                />
                              )}
                              {minObs !== "" && (
                                <Chip
                                  label={`Min. obserwacji: ${minObs}`}
                                />
                              )}
                              {roleFilter !== "all" && (
                                <Chip
                                  label={
                                    roleFilter === "scout"
                                      ? "Rola: Scout"
                                      : "Rola: Scout-agent"
                                  }
                                />
                              )}
                              {onlyActive14 && (
                                <Chip label="Tylko aktywni 14 dni" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Mobile: cards + inline Details */}
                <div className="space-y-2 md:hidden">
                  {filtered.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-gray-200 bg-white/70 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/70 dark:ring-white/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <PositionPill
                          pos={s._position as number}
                          delta={s._delta as number}
                        />
                        <div className="flex flex-col items-end gap-1">
                          <RoleBadge role={s.role} />
                          <ActivityTag
                            lastActive={s.lastActive}
                            activity01={s.activity01}
                          />
                          <span className={rankPillCls(s._rankBand as Rank)}>
                            {rankLabel(s._rankBand as Rank)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 font-medium text-gray-900 dark:text-neutral-100">
                        {s.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-dark dark:text-neutral-400">
                        {s.email && <span className="truncate">{s.email}</span>}
                        {s.phone && <span>• {s.phone}</span>}
                        {s.region && <span>• {s.region}</span>}
                      </div>

                      <div className="mt-3">
                        <KpiCell
                          kpi={s._kpi as number}
                          comp01={s._avgCompleteness as number}
                          act01={s._activity as number}
                          vol01={s._vol01 as number}
                          avgObsPerPlayer={s._avgObsPerPlayer as number}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-3 text-xs text-dark dark:text-neutral-400">
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {s.playersCount}
                        </div>
                        <div className="flex items-center gap-1">
                          <NotebookPen className="h-3.5 w-3.5" />{" "}
                          {s.observationsCount}
                        </div>
                        <div className="text-right">
                          {fmtDate(s.lastActive)}
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          className="bg-gray-900 text-xs text-white hover:bg-gray-800"
                          onClick={() =>
                            setExpandedId((prev) =>
                              prev === s.id ? null : s.id
                            )
                          }
                        >
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Szczegóły
                        </Button>
                      </div>

                      {expandedId === s.id && (
                        <div className="mt-3">
                          <InlineScoutDetails scout={s} />
                        </div>
                      )}
                    </div>
                  ))}
                  {filtered.length === 0 && !loading && (
                    <div className="rounded-xl border border-gray-200 p-4 text-center text-sm text-dark dark:border-neutral-800 dark:text-neutral-400">
                      Brak wyników dla bieżących filtrów.
                    </div>
                  )}
                </div>

                {/* Desktop: table + inline Details row */}
                <div className="hidden w-full overflow-x-auto rounded-xl border border-gray-200 bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/70 dark:ring-white/5 md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-100/80 text-dark dark:bg-neutral-900/80 dark:text-neutral-300">
                      <tr>
                        {[
                          { key: "position", label: "Pozycja" },
                          { key: "name", label: "Scout" },
                          { key: "kpi", label: "KPI" },
                          { key: "players", label: "Zawodnicy" },
                          { key: "obs", label: "Obserwacje" },
                          { key: "lastActive", label: "Ostatnio aktywny" },
                          { key: "rank", label: "Ranga" },
                          { key: "actions", label: "Akcje", right: true },
                        ].map((c) => {
                          const active =
                            sortKey === (c.key as any) && c.key !== "actions";
                          return (
                            <th
                              key={c.key}
                              className={`px-3 py-2 text-[11px] font-medium uppercase tracking-wide ${
                                c.right ? "text-right" : "text-left"
                              }`}
                            >
                              {c.key === "actions" ? (
                                c.label
                              ) : (
                                <button
                                  className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-neutral-100"
                                  onClick={() => {
                                    if (active)
                                      setSortDir((d) =>
                                        d === "asc" ? "desc" : "asc"
                                      );
                                    setSortKey(c.key as any);
                                  }}
                                >
                                  {c.label}
                                  {active ? (
                                    sortDir === "asc" ? (
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    )
                                  ) : null}
                                </button>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/80 dark:divide-neutral-800/80">
                      {filtered.map((s) => (
                        <React.Fragment key={s.id}>
                          <tr className="align-top transition-colors hover:bg-stone-50/80 dark:hover:bg-neutral-900/70">
                            {/* Sticky position column */}
                            <td className="sticky left-0 z-[1] bg-white/90 px-3 py-3 dark:bg-neutral-950/95">
                              <PositionPill
                                pos={s._position as number}
                                delta={s._delta as number}
                              />
                            </td>

                            {/* Scout */}
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-neutral-100">
                                    {s.name}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-dark dark:text-neutral-400">
                                    {s.email && (
                                      <span className="inline-flex items-center gap-1">
                                        <Mail className="h-3.5 w-3.5" />{" "}
                                        {s.email}
                                      </span>
                                    )}
                                    {s.phone && (
                                      <span className="inline-flex items-center gap-1">
                                        • {s.phone}
                                      </span>
                                    )}
                                    {s.region && (
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" />
                                        {s.region}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <RoleBadge role={s.role} />
                                  <ActivityTag
                                    lastActive={s.lastActive}
                                    activity01={s.activity01}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* KPI */}
                            <td className="px-3 py-3">
                              <KpiCell
                                kpi={s._kpi as number}
                                comp01={s._avgCompleteness as number}
                                act01={s._activity as number}
                                vol01={s._vol01 as number}
                                avgObsPerPlayer={
                                  s._avgObsPerPlayer as number
                                }
                              />
                            </td>

                            {/* Raw counts */}
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-4 w-4" /> {s.playersCount}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1">
                                <NotebookPen className="h-4 w-4" />{" "}
                                {s.observationsCount}
                              </span>
                            </td>

                            {/* Last active */}
                            <td className="px-3 py-3 text-sm text-dark dark:text-neutral-300">
                              {fmtDate(s.lastActive)}
                            </td>

                            {/* Rank band */}
                            <td className="px-3 py-3">
                              <span className={rankPillCls(s._rankBand as Rank)}>
                                {rankLabel(s._rankBand as Rank)}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="h-8 bg-gray-900 text-xs text-white hover:bg-gray-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedId((prev) =>
                                      prev === s.id ? null : s.id
                                    );
                                  }}
                                >
                                  <ExternalLink className="mr-1 h-4 w-4" />
                                 Szczegóły
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {expandedId === s.id && (
                            <tr className="bg-stone-50/60 dark:bg-neutral-900/60">
                              <td colSpan={8} className="px-4 pb-4 pt-0">
                                <InlineScoutDetails scout={s} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {filtered.length === 0 && !loading && (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-5 text-center text-sm text-dark dark:text-neutral-400"
                          >
                            Brak wyników dla bieżących filtrów.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* ========== SEK CJA 2 – PODSUMOWANIE PANELU SCOUTÓW (osobny akordeon) ========== */}
      <Card className="mt-1">
        <CardHeader
          className={cn(
            "group flex items-center justify-between rounded-md border-gray-200 p-0 transition-colors hover:bg-stone-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
            summaryOpen && "bg-stone-100 dark:bg-neutral-900/70"
          )}
        >
          <button
            type="button"
            aria-expanded={summaryOpen}
            aria-controls="summary-panel"
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-4 text-left"
          >
            <div>
              <div className={stepPillClass}>Sekcja 2 · Podsumowanie</div>
              <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                Podsumowanie panelu scoutów
              </div>
              <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                Krótki rzut oka na łączną liczbę scoutów, zawodników i
                obserwacji w systemie.
              </p>
            </div>
            <div className="flex items-center gap-3 pl-4">
              {lastRefresh && (
                <div className="hidden items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-gray-200 backdrop-blur-sm dark:bg-neutral-900/80 dark:text-neutral-300 dark:ring-neutral-700 md:inline-flex">
                  <CalendarClock className="h-3 w-3" />
                  <span>Ostatnia synchronizacja:</span>
                  <span className="font-medium">
                    {fmtTimeShort(lastRefresh)}
                  </span>
                </div>
              )}
              <ChevronDown
                className={cn(
                  "h-5 w-5 transition-transform",
                  summaryOpen ? "rotate-180" : "rotate-0"
                )}
              />
            </div>
          </button>
        </CardHeader>
        <CardContent className="px-4 py-0 md:px-4">
          <Accordion
            type="single"
            collapsible
            value={summaryOpen ? "summary" : undefined}
            onValueChange={(v) => setSummaryOpen(v === "summary")}
            className="w-full"
          >
            <AccordionItem value="summary" className="border-0">
              <AccordionContent id="summary-panel" className="pt-4 pb-5">
                <div className="mb-2 md:hidden">
                  {lastRefresh && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-gray-200 backdrop-blur-sm dark:bg-neutral-900/80 dark:text-neutral-300 dark:ring-neutral-700">
                      <CalendarClock className="h-3 w-3" />
                      <span>Ostatnia synchronizacja:</span>
                      <span className="font-medium">
                        {fmtTimeShort(lastRefresh)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
                  <SummaryTile
                    label="Scoutów"
                    value={summary.totalScouts}
                    hint="Łączna liczba aktywnych profili w systemie"
                  />
                  <SummaryTile
                    label="Aktywnych 14 dni"
                    value={summary.active14}
                    hint="Scoutów z aktywnością w ostatnich 14 dniach"
                  />
                  <SummaryTile
                    label="Zawodników"
                    value={summary.totalPlayers}
                    hint="Zawodników przypisanych do scoutów"
                  />
                  <SummaryTile
                    label="Obserwacji"
                    value={summary.totalObs}
                    hint="Łączna liczba obserwacji w systemie"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================ Small helpers ============================ */

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg bg-white/70 p-2 text-xs ring-1 ring-gray-100 dark:bg-neutral-950/60 dark:ring-neutral-800">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-neutral-50">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-700">
      {label}
    </span>
  );
}

/* =========== Inline “Details” – lists of players & observations =========== */

function InlineScoutDetails({ scout }: { scout: Scout }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabase();

        const { data: playerRows, error: playersError } = await supabase
          .from("players")
          .select("*")
          .eq("user_id", scout.id);

        if (playersError) throw playersError;

        const { data: obsRows, error: obsError } = await supabase
          .from("observations")
          .select("*")
          .eq("user_id", scout.id);

        if (obsError) throw obsError;

        if (!mounted) return;
        setPlayers((playerRows || []) as Player[]);
        setObservations((obsRows || []) as Observation[]);
      } catch (e: any) {
        console.error("[InlineScoutDetails] load error:", e);
        if (!mounted) return;
        setError(
          e?.message ||
            "Nie udało się pobrać listy zawodników i obserwacji z Supabase."
        );
        setPlayers([]);
        setObservations([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [scout.id]);

  return (
    <div className="mt-2 rounded-xl border border-dashed border-gray-300 bg-stone-50/80 p-3 text-xs text-dark shadow-sm dark:border-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-200">
      {loading && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Ładuję listę zawodników i obserwacji…
        </p>
      )}
      {error && (
        <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}
      {!loading && !error && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Zawodnicy i obserwacje przypisane do tego scouta (dane z Supabase).
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {/* Players */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Zawodnicy ({players.length})
            </span>
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/60">
            <table className="w-full text-[11px]">
              <thead className="bg-stone-100 text-[10px] uppercase tracking-wide text-muted-foreground dark:bg-neutral-900">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Zawodnik</th>
                  <th className="px-2 py-1 text-left font-medium">Klub</th>
                  <th className="px-2 py-1 text-left font-medium">Poz.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {players.map((p, idx) => (
                  <tr key={String((p as any).id ?? idx)}>
                    <td className="px-2 py-1">{(p as any).name}</td>
                    <td className="px-2 py-1">
                      {(p as any).club || "—"}
                    </td>
                    <td className="px-2 py-1">
                      {(p as any).pos || "—"}
                    </td>
                  </tr>
                ))}
                {players.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-2 text-[11px] text-muted-foreground"
                    >
                      Brak zawodników dla tego scouta.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Observations */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <NotebookPen className="h-3.5 w-3.5" />
              Obserwacje ({observations.length})
            </span>
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/60">
            <table className="w-full text-[11px]">
              <thead className="bg-stone-100 text-[10px] uppercase tracking-wide text-muted-foreground dark:bg-neutral-900">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Mecz</th>
                  <th className="px-2 py-1 text-left font-medium">Zawodnik</th>
                  <th className="px-2 py-1 text-left font-medium">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {observations.map((o, idx) => (
                  <tr key={String((o as any).id ?? idx)}>
                    <td className="px-2 py-1">
                      {(o as any).match || "—"}
                    </td>
                    <td className="px-2 py-1">
                      {(o as any).player || "—"}
                    </td>
                    <td className="px-2 py-1">
                      {(o as any).date || "—"}
                    </td>
                  </tr>
                ))}
                {observations.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-2 text-[11px] text-muted-foreground"
                    >
                      Brak obserwacji powiązanych z tym scoutem.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
