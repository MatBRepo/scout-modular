// /app/scouts/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  Moon,
  NotebookPen,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Sun,
  Users,
} from "lucide-react";

/* ============================== Types ============================== */

type Role = "admin" | "scout" | "scout-agent";
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
  lastActive?: string; // ISO
  note?: string;
  /** optional: ids of players the scout owns (from s4s.players) */
  playerIds?: number[];
};

/* ============================= Storage ============================= */

const STORAGE_SCOUTS = "s4s.admin.scouts";
const STORAGE_LAST_REFRESH = "s4s.admin.scouts.lastRefresh";
const STORAGE_POSITIONS = "s4s.admin.scouts.positions"; // { [id]: positionNumber }

/* =============================== Utils ============================= */

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function daysSince(iso?: string) {
  if (!iso) return 999;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** rank by (players*2 + observations) only — used for the color band label */
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
    return `${base} bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:ring-slate-700/70`;
  return `${base} bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:ring-orange-800/70`;
}

/** crude completeness calculator for a set of player records found in localStorage */
function computePlayersCompleteness(playerIds?: number[]): number {
  try {
    const raw = localStorage.getItem("s4s.players");
    const arr: any[] = raw ? JSON.parse(raw) : [];
    const subset = Array.isArray(playerIds)
      ? arr.filter((p) => playerIds.includes(p.id))
      : arr;
    if (subset.length === 0) return 0.45; // safe default
    const keys = [
      "firstName",
      "lastName",
      "pos",
      "age",
      "club",
      "birthDate",
      "nationality",
      "photo",
    ];
    const scores = subset.map((p) => {
      const filled = keys.reduce((acc, k) => acc + (p?.[k] ? 1 : 0), 0);
      return filled / keys.length;
    });
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  } catch {
    return 0.45;
  }
}

/** activity 0..1 based on lastActive, linearly down to 0 after 14 days */
function computeActivity01(lastActive?: string) {
  const d = daysSince(lastActive);
  const span = 14;
  return clamp01(1 - d / span);
}

/** overall KPI mixes: volume, completeness, activity. Weight to taste. */
function computeKpi(s: Scout) {
  const comp = computePlayersCompleteness(s.playerIds);
  const act = computeActivity01(s.lastActive);
  const vol = clamp01(s.observationsCount / Math.max(1, s.playersCount * 2)); // rough
  // Blend to a 0..1 score, then scale to 0..200 range for a bolder number
  const score01 = 0.45 * comp + 0.35 * act + 0.20 * vol;
  const kpi = Math.round(score01 * 200);
  return { kpi, comp01: comp, act01: act, vol01: vol };
}

/* ========================== Small UI pieces ========================== */

function PositionPill({ pos, delta }: { pos: number; delta: number }) {
  const deltaColor =
    delta > 0
      ? "text-emerald-600"
      : delta < 0
      ? "text-rose-600"
      : "text-gray-400";
  const deltaTxt = delta === 0 ? "→" : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold dark:bg-neutral-800">
        {pos}
      </div>
      <div className={`inline-flex items-center text-xs ${deltaColor}`}>{deltaTxt}</div>
    </div>
  );
}

function TinyBar({
  value,
  className,
  title,
}: {
  value: number; // 0..100
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
}: {
  kpi: number;
  comp01: number;
  act01: number;
  vol01: number;
}) {
  return (
    <div>
      <div className="text-base font-semibold leading-none">{kpi}</div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[10px] text-gray-500">
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
            <span>Vol</span>
            <span>{Math.round(vol01 * 100)}%</span>
          </div>
          <TinyBar
            value={vol01 * 100}
            className="bg-slate-500"
            title="Wolumen obserwacji względem zawodników"
          />
        </div>
      </div>
    </div>
  );
}

/* ================================ Page ================================ */

export default function ScoutsAdminPage() {
  const router = useRouter();

  // role + data
  const [role, setRole] = useState<Role>("scout");
  const [rows, setRows] = useState<Scout[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  // ui state
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [minPlayers, setMinPlayers] = useState<number | "">("");
  const [minObs, setMinObs] = useState<number | "">("");
  const [sortKey, setSortKey] = useState<
    "position" | "name" | "kpi" | "players" | "obs" | "lastActive" | "rank"
  >("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [detail, setDetail] = useState<Scout | null>(null);

  // load role & last refresh
  useEffect(() => {
    try {
      const saved = localStorage.getItem("s4s.role");
      if (saved === "admin" || saved === "scout" || saved === "scout-agent") {
        setRole(saved);
      }
      const lr = localStorage.getItem(STORAGE_LAST_REFRESH);
      if (lr) setLastRefresh(lr);
    } catch {}
  }, []);

  // seed or load scouts
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SCOUTS);
      if (raw) {
        setRows(JSON.parse(raw));
      } else {
        const now = new Date();
        const seed: Scout[] = [
          {
            id: uid(),
            name: "Anna Nowak",
            email: "anna.nowak@example.com",
            phone: "+48 600 000 111",
            region: "Wielkopolska",
            role: "scout",
            playersCount: 22,
            observationsCount: 18,
            lastActive: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
            note: "Specjalizacja: U19/U17",
          },
          {
            id: uid(),
            name: "Marek Kowalczyk",
            email: "marek.k@example.com",
            phone: "+48 600 000 222",
            region: "Mazowsze",
            role: "scout-agent",
            playersCount: 8,
            observationsCount: 7,
            lastActive: new Date(now.getTime() - 1000 * 60 * 60 * 26).toISOString(),
            note: "Aktywny w CLJ i rezerwach",
          },
          {
            id: uid(),
            name: "Joanna Wiśniewska",
            email: "joanna.w@example.com",
            phone: "+48 600 000 333",
            region: "Dolnośląskie",
            role: "scout",
            playersCount: 41,
            observationsCount: 75,
            lastActive: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
            note: "Silny fokus na U15-U17",
          },
          {
            id: uid(),
            name: "Piotr Zielony",
            email: "piotr.z@example.com",
            phone: "+48 600 000 444",
            region: "Zachodniopomorskie",
            role: "scout",
            playersCount: 15,
            observationsCount: 8,
            lastActive: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
          },
        ];
        localStorage.setItem(STORAGE_SCOUTS, JSON.stringify(seed));
        setRows(seed);
      }
    } catch {
      setRows([]);
    }
  }, []);

  function persist(next: Scout[]) {
    setRows(next);
    try {
      localStorage.setItem(STORAGE_SCOUTS, JSON.stringify(next));
    } catch {}
  }

  function doRefresh() {
    try {
      const raw = localStorage.getItem(STORAGE_SCOUTS);
      setRows(raw ? JSON.parse(raw) : []);
    } catch {}
    const stamp = new Date().toISOString();
    setLastRefresh(stamp);
    try {
      localStorage.setItem(STORAGE_LAST_REFRESH, stamp);
    } catch {}
  }

  // Enrich with KPI + rank band, then compute positions & deltas
  const enriched = useMemo(() => {
    // compute KPI & rank band
    const base = rows.map((s) => {
      const { kpi, comp01, act01, vol01 } = computeKpi(s);
      const rankBand = calcRankBand(s.playersCount, s.observationsCount);
      return { ...s, _kpi: kpi, _avgCompleteness: comp01, _activity: act01, _vol: vol01, _rankBand: rankBand };
    });

    // sort for ranking (primary by KPI desc, then by lastActive recency asc)
    const ranked = [...base].sort((a, b) => {
      if (b._kpi !== a._kpi) return b._kpi - a._kpi;
      return daysSince(a.lastActive) - daysSince(b.lastActive);
    });

    // assign current positions
    const withPos = ranked.map((s, i) => ({ ...s, _position: i + 1 }));

    // compute deltas vs previous snapshot
    let prev: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(STORAGE_POSITIONS);
      prev = raw ? JSON.parse(raw) : {};
    } catch {}
    const withDelta = withPos.map((s) => {
      const prevPos = prev[s.id];
      const delta = typeof prevPos === "number" ? prevPos - (s._position as number) : 0;
      return { ...s, _delta: delta };
    });

    // persist current positions for next time
    const snapshot: Record<string, number> = {};
    withDelta.forEach((s) => {
      snapshot[s.id] = s._position as number;
    });
    try {
      localStorage.setItem(STORAGE_POSITIONS, JSON.stringify(snapshot));
    } catch {}

    return withDelta;
  }, [rows]);

  // Filters + sort
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = enriched.filter((r) => {
      const matchesQ = !qq
        ? true
        : [r.name, r.email, r.phone, r.region, r.role]
            .filter(Boolean)
            .map((x) => String(x).toLowerCase())
            .some((x) => x.includes(qq));
      const matchesRegion = region
        ? (r.region || "").toLowerCase().includes(region.toLowerCase())
        : true;
      const pOK = minPlayers === "" ? true : r.playersCount >= Number(minPlayers);
      const oOK = minObs === "" ? true : r.observationsCount >= Number(minObs);
      return matchesQ && matchesRegion && pOK && oOK;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "position") return ((a._position as number) - (b._position as number)) * dir;
      if (sortKey === "kpi") return ((a._kpi as number) - (b._kpi as number)) * dir;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "players") return (a.playersCount - b.playersCount) * dir;
      if (sortKey === "obs") return (a.observationsCount - b.observationsCount) * dir;
      if (sortKey === "rank") {
        const order: Rank[] = ["bronze", "silver", "gold", "platinum"];
        return (order.indexOf(a._rankBand as Rank) - order.indexOf(b._rankBand as Rank)) * dir;
      }
      // lastActive
      const ad = a.lastActive || "";
      const bd = b.lastActive || "";
      return (ad < bd ? -1 : ad > bd ? 1 : 0) * dir;
    });
  }, [enriched, q, region, minPlayers, minObs, sortKey, sortDir]);

  const isAdmin = role === "admin";

  if (!isAdmin) {
    return (
      <div className="w-full">
        <Crumb items={[{ label: "Start", href: "/" }, { label: "Scouts" }]} />
        <Card className="border-rose-200 dark:border-rose-900/50">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="h-5 w-5" />
              Brak uprawnień
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-neutral-300">
              Lista scoutów jest dostępna wyłącznie dla roli <b>Admin</b>.
            </p>
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => router.push("/")}
            >
              Wróć do kokpitu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Scouts" }]} />

      <Toolbar
        title="Scouts (podgląd – Admin)"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Szukaj po nazwisku, e-mailu, regionie…"
                className="w-72"
              />
              {q && (
                <Button
                  variant="outline"
                  className="border-gray-300 dark:border-neutral-700"
                  onClick={() => setQ("")}
                >
                  Wyczyść
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={doRefresh}
              title={
                lastRefresh
                  ? `Ostatnio odświeżono: ${fmtDate(lastRefresh)}`
                  : "Odśwież ze storage"
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Odśwież
            </Button>

            {lastRefresh && (
              <span className="text-xs text-gray-500 dark:text-neutral-400">
                Ostatnie odświeżenie: {fmtDate(lastRefresh)}
              </span>
            )}
          </div>
        }
      />

      {/* Filters row */}
      <Card className="mb-3 border-gray-200 dark:border-neutral-800">
        <CardContent className="grid grid-cols-1 gap-3 p-3 md:grid-cols-4">
          <div>
            <Label className="text-xs">Region</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="np. Mazowsze…"
            />
          </div>
          <div>
            <Label className="text-xs">Min. zawodników</Label>
            <Input
              type="number"
              value={minPlayers}
              onChange={(e) =>
                setMinPlayers(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="—"
            />
          </div>
          <div>
            <Label className="text-xs">Min. obserwacji</Label>
            <Input
              type="number"
              value={minObs}
              onChange={(e) =>
                setMinObs(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="—"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => {
                setRegion("");
                setMinPlayers("");
                setMinObs("");
                setQ("");
              }}
            >
              Resetuj
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ======= Responsive list: cards on mobile, table on desktop ======= */}

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="rounded-md border border-gray-200 p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60"
            onClick={() => setDetail(s)}
            role="button"
          >
            <div className="flex items-start justify-between gap-3">
              <PositionPill pos={s._position as number} delta={s._delta as number} />
              <span className={rankPillCls(s._rankBand as Rank)}>
                {rankLabel(s._rankBand as Rank)}
              </span>
            </div>

            <div className="mt-2 font-medium text-gray-900 dark:text-neutral-100">
              {s.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-gray-600 dark:text-neutral-400">
              {s.email && <span className="truncate">{s.email}</span>}
              {s.phone && <span>• {s.phone}</span>}
              {s.region && <span>• {s.region}</span>}
            </div>

            <div className="mt-3">
              <KpiCell
                kpi={s._kpi as number}
                comp01={s._avgCompleteness as number}
                act01={s._activity as number}
                vol01={s._vol as number}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 text-xs">
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {s.playersCount}
              </div>
              <div className="flex items-center gap-1">
                <NotebookPen className="h-3.5 w-3.5" /> {s.observationsCount}
              </div>
              <div className="text-right text-gray-500">{fmtDate(s.lastActive)}</div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-gray-300 dark:border-neutral-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetail(s);
                }}
              >
                Podgląd
              </Button>
              <Button
                size="sm"
                className="bg-gray-900 text-white hover:bg-gray-800"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/scouts/${s.id}`);
                }}
              >
                Profil
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-md border border-gray-200 p-4 text-center text-sm text-gray-500 dark:border-neutral-800 dark:text-neutral-400">
            Brak wyników dla bieżących filtrów.
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-800 md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
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
                    className={`p-3 ${c.right ? "text-right" : "text-left"} font-medium`}
                  >
                    {c.key === "actions" ? (
                      c.label
                    ) : (
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={() => {
                          if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          setSortKey(c.key as any);
                        }}
                      >
                        {c.label}
                        {active ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        ) : null}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-gray-50/40 dark:[&>tr:nth-child(even)]:bg-neutral-900/40">
            {filtered.map((s) => (
              <tr
                key={s.id}
                className="border-t border-gray-200 align-top transition-colors hover:bg-gray-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                onClick={() => setDetail(s)}
              >
                {/* Sticky position column */}
                <td className="sticky left-0 z-[1] bg-white p-3 dark:bg-neutral-950">
                  <PositionPill pos={s._position as number} delta={s._delta as number} />
                </td>

                {/* Scout */}
                <td className="p-3">
                  <div className="font-medium text-gray-900 dark:text-neutral-100">
                    {s.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-gray-600 dark:text-neutral-400">
                    {s.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {s.email}
                      </span>
                    )}
                    {s.phone && <span className="inline-flex items-center gap-1">• {s.phone}</span>}
                    {s.region && <span className="inline-flex items-center gap-1">• {s.region}</span>}
                  </div>
                </td>

                {/* KPI */}
                <td className="p-3">
                  <KpiCell
                    kpi={s._kpi as number}
                    comp01={s._avgCompleteness as number}
                    act01={s._activity as number}
                    vol01={s._vol as number}
                  />
                </td>

                {/* Raw counts */}
                <td className="p-3">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" /> {s.playersCount}
                  </span>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1">
                    <NotebookPen className="h-4 w-4" /> {s.observationsCount}
                  </span>
                </td>

                {/* Last active */}
                <td className="p-3">{fmtDate(s.lastActive)}</td>

                {/* Rank band */}
                <td className="p-3">
                  <span className={rankPillCls(s._rankBand as Rank)}>
                    {rankLabel(s._rankBand as Rank)}
                  </span>
                </td>

                {/* Actions */}
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-gray-300 dark:border-neutral-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(s);
                      }}
                    >
                      Podgląd
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 bg-gray-900 text-white hover:bg-gray-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/scouts/${s.id}`);
                      }}
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Profil
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-5 text-center text-sm text-gray-500 dark:text-neutral-400"
                >
                  Brak wyników dla bieżących filtrów.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview drawer */}
      {detail && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-3 flex flex-wrap items-center justify-between">
              <div className="text-sm font-semibold">{detail.name}</div>
              <Button
                variant="outline"
                className="h-8 border-gray-300 dark:border-neutral-700"
                onClick={() => setDetail(null)}
              >
                Zamknij
              </Button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info
                  label="E-mail"
                  value={detail.email || "—"}
                  icon={<Mail className="h-4 w-4" />}
                />
                <Info label="Telefon" value={detail.phone || "—"} />
                <Info label="Region" value={detail.region || "—"} />
                <Info
                  label="Ostatnio aktywny"
                  value={fmtDate(detail.lastActive)}
                  icon={<CalendarClock className="h-4 w-4" />}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Info
                  label="Zawodnicy"
                  value={String(detail.playersCount)}
                  icon={<Users className="h-4 w-4" />}
                />
                <Info
                  label="Obserwacje"
                  value={String(detail.observationsCount)}
                  icon={<NotebookPen className="h-4 w-4" />}
                />
              </div>
              <div className="rounded-md border border-gray-200 p-3 dark:border-neutral-800">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  KPI
                </div>
                <KpiCell
                  kpi={(detail as any)._kpi ?? 0}
                  comp01={(detail as any)._avgCompleteness ?? 0}
                  act01={(detail as any)._activity ?? 0}
                  vol01={(detail as any)._vol ?? 0}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  onClick={() => {
                    const id = detail.id;
                    setDetail(null);
                    router.push(`/scouts/${id}`);
                  }}
                >
                  <ExternalLink className="mr-1 h-4 w-4" /> Przejdź do profilu
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-300 dark:border-neutral-700"
                  onClick={() => setDetail(null)}
                >
                  Zamknij
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Small helpers ============================ */

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-gray-200 p-2 dark:border-neutral-800">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400">
        {icon} {label}
      </div>
      <div className="text-sm text-gray-800 dark:text-neutral-100">{value}</div>
    </div>
  );
}
