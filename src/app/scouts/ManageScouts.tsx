"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
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
  UserPlus,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
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
    return date.toLocaleString("en-GB", {
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
    return date.toLocaleTimeString("en-GB", {
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
    name: row.name || "Unnamed",
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
      className="mt-1 h-1 w-full min-w-[60px] max-w-[100px] rounded-full bg-gray-100 dark:bg-neutral-800"
    >
      <div
        className={`h-1 rounded-full ${className}`}
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
      ? `${avgObsPerPlayer.toFixed(1)} / pl.`
      : `${Math.round(vol01 * 100)}%`;

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <div className="text-sm font-bold leading-none">{kpi}</div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[9px] uppercase tracking-wider text-stone-700 dark:text-neutral-400">
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <span>Comp</span>
            <span className="font-medium text-stone-900 dark:text-neutral-200">{Math.round(comp01 * 100)}%</span>
          </div>
          <TinyBar
            value={comp01 * 100}
            className="bg-indigo-500"
            title="Avg profile completeness"
          />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <span>Act</span>
            <span className="font-medium text-stone-900 dark:text-neutral-200">{Math.round(act01 * 100)}%</span>
          </div>
          <TinyBar
            value={act01 * 100}
            className="bg-emerald-500"
            title="Activity (last 14 days)"
          />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <span className="font-medium text-stone-900 dark:text-neutral-200">{avgLabel}</span>
          </div>
          <TinyBar
            value={vol01 * 100}
            className="bg-stone-500"
            title="Average observation volume relative to players"
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

  let label = "No activity";
  let dotCls = "bg-gray-400";
  if (act > 0.66) {
    label = "Very active";
    dotCls = "bg-emerald-500";
  } else if (act > 0.33) {
    label = "Active";
    dotCls = "bg-amber-400";
  } else if (act > 0) {
    label = "Rarely active";
    dotCls = "bg-orange-500";
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-900 dark:bg-neutral-900 dark:text-neutral-300">
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      <span>{label}</span>
      {isFinite(days) && days < 999 && (
        <span className="text-[9px] text-neutral-500 dark:text-neutral-400">
          ({days === 0 ? "today" : `${days} d. ago`})
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
        e?.message || "Failed to fetch scouts list from Supabase."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* --- Invite Scout logic --- */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error("Please provide both name and email.");
      return;
    }

    setInviting(true);
    try {
      const res = await fetch("/api/admin/invite-scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: "scout",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error while sending invitation.");

      toast.success(data.mailSent
        ? "Invitation sent successfully!"
        : "Invitation created (email not sent - missing configuration).");

      if (!data.mailSent && data.link) {
        // Fallback: copy link if email failed
        navigator.clipboard.writeText(data.link);
        toast.info("Link copied to clipboard.");
      }

      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      fetchScouts(); // refresh list
    } catch (err: any) {
      console.error("Invite error:", err);
      toast.error(err.message || "Failed to invite scout.");
    } finally {
      setInviting(false);
    }
  };

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
        title="Scouts List"
        subtitle="Monitor activity and performance quality, and quickly view their players and observations."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {/* INVITE SCOUT BUTTON + MODAL */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="flex items-center gap-1 bg-gray-900 text-xs text-white hover:bg-gray-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite Scout
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleInvite}>
                  <DialogHeader>
                    <DialogTitle>Invite New Scout</DialogTitle>
                    <DialogDescription>
                      Enter the scout's name and email to generate a link and send an invitation email.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name and Surname</Label>
                      <Input
                        id="name"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="e.g. John Smith"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="e.g. john@example.com"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={inviting}>
                      {inviting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        "Send Invitation"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <span className="h-4 w-px bg-gray-200 dark:bg-neutral-800 mx-1 hidden sm:block" />

            {/* search cluster desktop (global) */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, email, region…"
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
                  Clear
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
              Filters
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
                  ? `Last refresh: ${fmtDate(lastRefresh)}`
                  : "Refresh from Supabase"
              }
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Loading…" : "Refresh"}
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
      <div className="px-1 sm:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search scouts…"
            className="w-full pl-8"
          />
        </div>
      </div>

      {/* Accordion Statistics / Summary */}
      <Card className="overflow-hidden border-stone-200 dark:border-neutral-800">
        <CardHeader
          onClick={() => setSummaryOpen(!summaryOpen)}
          className="flex cursor-pointer select-none flex-row items-center justify-between bg-stone-50/50 px-4 py-3 hover:bg-stone-50 dark:bg-neutral-900/50 dark:hover:bg-neutral-900"
        >
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-900 dark:text-neutral-200">
              Scouting Statistics
            </h3>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-stone-400 transition-transform duration-200",
              summaryOpen ? "rotate-180" : "rotate-0"
            )}
          />
        </CardHeader>
        {summaryOpen && (
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500 dark:text-neutral-400">
                  Total Scouts
                </p>
                <p className="text-2xl font-bold text-stone-900 dark:text-white">
                  {summary.totalScouts}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500 dark:text-neutral-400">
                  Total Players
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-stone-900 dark:text-white">
                    {summary.totalPlayers}
                  </p>
                  <span className="text-xs text-stone-400">
                    ({(summary.totalPlayers / (summary.totalScouts || 1)).toFixed(1)} / sc)
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500 dark:text-neutral-400">
                  Observations
                </p>
                <p className="text-2xl font-bold text-stone-900 dark:text-white">
                  {summary.totalObs}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500 dark:text-neutral-400">
                  Active (14d)
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.active14}
                  </p>
                  <span className="text-xs text-stone-400">
                    ({Math.round((summary.active14 / (summary.totalScouts || 1)) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Container: Filters (Desktop Left/Mobile Toggle) + List */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* FILTERS PANEL */}
        <div
          className={cn(
            "w-full shrink-0 space-y-4 lg:w-64",
            !filtersOpenMobile && "hidden lg:block",
            filtersOpenMobile && "block"
          )}
        >
          <Card className="border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <CardHeader className="px-4 py-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-900/70 dark:text-neutral-400">
                  Advanced Filters
                </h4>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    onClick={resetFilters}
                    className="h-auto p-0 text-[10px] text-rose-500 hover:bg-transparent hover:text-rose-600"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5 px-4 pb-6">
              {/* Filter: Only Active 14d */}
              <div
                className="flex cursor-pointer items-center justify-between rounded-md border border-transparent bg-stone-50 px-3 py-2 transition-colors hover:bg-stone-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                onClick={() => setOnlyActive14(!onlyActive14)}
              >
                <span className="text-xs font-medium text-stone-700 dark:text-neutral-300">
                  Only active (14d)
                </span>
                <div
                  className={cn(
                    "flex h-4 w-8 items-center rounded-full p-0.5 transition-colors",
                    onlyActive14 ? "bg-emerald-500" : "bg-gray-300 dark:bg-neutral-700"
                  )}
                >
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full bg-white transition-transform",
                      onlyActive14 ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </div>
              </div>

              {/* Filter: Name */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-stone-500">
                  Filter by name
                </Label>
                <div className="relative">
                  <Users className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  <Input
                    value={nameQ}
                    onChange={(e) => setNameQ(e.target.value)}
                    placeholder="e.g. Smith…"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>

              {/* Filter: Role */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-stone-500">
                  Role
                </Label>
                <div className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1 dark:bg-neutral-900">
                  <button
                    onClick={() => setRoleFilter("all")}
                    className={cn(
                      "rounded px-2 py-1.5 text-[10px] font-bold transition-all",
                      roleFilter === "all"
                        ? "bg-white text-stone-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                        : "text-stone-500 hover:text-stone-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                    )}
                  >
                    ALL
                  </button>
                  <button
                    onClick={() => setRoleFilter("scout")}
                    className={cn(
                      "rounded px-2 py-1.5 text-[10px] font-bold transition-all",
                      roleFilter === "scout"
                        ? "bg-white text-stone-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                        : "text-stone-500 hover:text-stone-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                    )}
                  >
                    SCOUT
                  </button>
                </div>
              </div>

              {/* Filter: Region */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-stone-500">
                  Region / Location
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  <Input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="e.g. Warsaw…"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>

              {/* Filter: Minimums */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-stone-500">
                    Min. Players
                  </Label>
                  <Input
                    type="number"
                    value={minPlayers}
                    onChange={(e) =>
                      setMinPlayers(
                        e.target.value === "" ? "" : parseInt(e.target.value)
                      )
                    }
                    placeholder="0"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-stone-500">
                    Min. Obs
                  </Label>
                  <Input
                    type="number"
                    value={minObs}
                    onChange={(e) =>
                      setMinObs(
                        e.target.value === "" ? "" : parseInt(e.target.value)
                      )
                    }
                    placeholder="0"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SCOUTS LIST AREA */}
        <div className="flex-1 space-y-4">
          <Card className="border-stone-200 dark:border-neutral-800">
            <CardHeader
              onClick={() => setListOpen(!listOpen)}
              className="flex cursor-pointer select-none flex-row items-center justify-between bg-stone-50/30 px-4 py-3 hover:bg-stone-50 dark:bg-neutral-900/30 dark:hover:bg-neutral-900"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-stone-500" />
                <h3 className="text-sm font-semibold text-stone-900 dark:text-neutral-200">
                  Scouts Ranking / Table ({filtered.length})
                </h3>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-stone-400 transition-transform duration-200",
                  listOpen ? "rotate-180" : "rotate-0"
                )}
              />
            </CardHeader>
            {listOpen && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50/50 dark:border-neutral-800 dark:bg-neutral-900/50">
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400">
                          <button
                            onClick={() => {
                              if (sortKey === "position")
                                setSortDir(sortDir === "asc" ? "desc" : "asc");
                              else {
                                setSortKey("position");
                                setSortDir("asc");
                              }
                            }}
                            className="flex items-center gap-1 hover:text-stone-900 dark:hover:text-neutral-200"
                          >
                            Pos
                            {sortKey === "position" && (
                              <span className="text-[8px]">
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400">
                          <button
                            onClick={() => {
                              if (sortKey === "name")
                                setSortDir(sortDir === "asc" ? "desc" : "asc");
                              else {
                                setSortKey("name");
                                setSortDir("asc");
                              }
                            }}
                            className="flex items-center gap-1 hover:text-stone-900 dark:hover:text-neutral-200"
                          >
                            Scout
                            {sortKey === "name" && (
                              <span className="text-[8px]">
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400">
                          <button
                            onClick={() => {
                              if (sortKey === "kpi")
                                setSortDir(sortDir === "asc" ? "desc" : "asc");
                              else {
                                setSortKey("kpi");
                                setSortDir("desc");
                              }
                            }}
                            className="flex items-center gap-1 hover:text-stone-900 dark:hover:text-neutral-200"
                          >
                            KPI Summary
                            {sortKey === "kpi" && (
                              <span className="text-[8px]">
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400 hidden sm:table-cell">
                          <button
                            onClick={() => {
                              if (sortKey === "players")
                                setSortDir(sortDir === "asc" ? "desc" : "asc");
                              else {
                                setSortKey("players");
                                setSortDir("desc");
                              }
                            }}
                            className="flex items-center gap-1 hover:text-stone-900 dark:hover:text-neutral-200"
                          >
                            Stats
                            {sortKey === "players" && (
                              <span className="text-[8px]">
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-neutral-400">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
                      {filtered.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-12 text-center text-sm text-stone-400"
                          >
                            {loading ? "Loading scouts…" : "No scouts found matching current filters."}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((s) => (
                          <React.Fragment key={s.id}>
                            <tr
                              className={cn(
                                "group transition-colors",
                                expandedId === s.id
                                  ? "bg-indigo-50/30 dark:bg-indigo-950/20"
                                  : "hover:bg-stone-50/50 dark:hover:bg-neutral-900/30"
                              )}
                            >
                              <td className="px-4 py-4">
                                <PositionPill
                                  pos={s._position ?? 0}
                                  delta={s._delta ?? 0}
                                />
                              </td>
                              <td className="px-4 py-4 min-w-[200px]">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-stone-900 dark:text-neutral-200">
                                      {s.name}
                                    </span>
                                    <RoleBadge role={s.role} />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <ActivityTag
                                      lastActive={s.lastActive}
                                      activity01={s.activity01}
                                    />
                                    <span className={rankPillCls(s._rankBand || "bronze")}>
                                      {rankLabel(s._rankBand || "bronze")}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <KpiCell
                                  kpi={s._kpi ?? 0}
                                  comp01={s._avgCompleteness ?? 0}
                                  act01={s._activity ?? 0}
                                  vol01={s._vol01 ?? 0}
                                  avgObsPerPlayer={s._avgObsPerPlayer ?? 0}
                                />
                              </td>
                              <td className="px-4 py-4 hidden sm:table-cell">
                                <div className="flex flex-col gap-1 text-xs">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-stone-500">Players:</span>
                                    <span className="font-semibold text-stone-900 dark:text-neutral-300">
                                      {s.playersCount}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-stone-500">Observations:</span>
                                    <span className="font-semibold text-stone-900 dark:text-neutral-300">
                                      {s.observationsCount}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-8 px-2 text-xs font-semibold",
                                    expandedId === s.id
                                      ? "text-indigo-600 dark:text-indigo-400"
                                      : "text-stone-500 hover:text-stone-900 dark:hover:text-neutral-100"
                                  )}
                                  onClick={() =>
                                    setExpandedId(expandedId === s.id ? null : s.id)
                                  }
                                >
                                  {expandedId === s.id ? "Hide" : "Details"}
                                </Button>
                              </td>
                            </tr>

                            {/* DETAILS PANEL (expanded) */}
                            {expandedId === s.id && (
                              <tr className="bg-stone-50/50 dark:bg-neutral-900/50">
                                <td colSpan={5} className="px-4 pb-6 pt-2">
                                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                    {/* Left: Contact & Info */}
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                          Contact Information
                                        </h4>
                                        <div className="space-y-1.5 text-sm">
                                          <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-stone-400" />
                                            {s.email ? (
                                              <a
                                                href={`mailto:${s.email}`}
                                                className="text-indigo-600 hover:underline dark:text-indigo-400"
                                              >
                                                {s.email}
                                              </a>
                                            ) : (
                                              <span className="italic text-stone-400">
                                                No email
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-stone-400" />
                                            <span className="text-stone-600 dark:text-neutral-300">
                                              Region: {s.region || "Not specified"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Note box */}
                                      <div className="space-y-2">
                                        <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                          <NotebookPen className="h-3 w-3" />
                                          Internal Notes
                                        </h4>
                                        <div className="rounded-md border border-stone-200 bg-white p-3 text-xs italic text-stone-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                                          {s.note || "No administrative notes for this scout."}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Middle: Expanded Stats */}
                                    <div className="space-y-4 md:col-span-2">
                                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                        Contribution & Performance Details
                                      </h4>
                                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                        <div className="rounded-md border border-stone-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                                          <div className="text-[10px] font-medium text-stone-400">
                                            Profile Accuracy
                                          </div>
                                          <div className="mt-1 text-lg font-bold text-stone-900 dark:text-white">
                                            {Math.round((s._avgCompleteness || 0) * 100)}%
                                          </div>
                                        </div>
                                        <div className="rounded-md border border-stone-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                                          <div className="text-[10px] font-medium text-stone-400">
                                            Obs Quality Index
                                          </div>
                                          <div className="mt-1 text-lg font-bold text-stone-900 dark:text-white">
                                            {(s._avgObsPerPlayer || 0).toFixed(1)}
                                            <span className="ml-1 text-[10px] font-normal text-stone-400">
                                              / pl
                                            </span>
                                          </div>
                                        </div>
                                        <div className="rounded-md border border-stone-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                                          <div className="text-[10px] font-medium text-stone-400">
                                            Rank Experience
                                          </div>
                                          <div className="mt-1 text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                            {s.playersCount * 2 + s.observationsCount} xp
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 border-gray-300 text-[11px] dark:border-neutral-700"
                                          onClick={() => router.push(`/players?scoutId=${s.id}`)}
                                        >
                                          <Users className="mr-1.5 h-3.5 w-3.5" />
                                          View Players
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 border-gray-300 text-[11px] dark:border-neutral-700"
                                          onClick={() => router.push(`/observations?scoutId=${s.id}`)}
                                        >
                                          <Search className="mr-1.5 h-3.5 w-3.5" />
                                          View Observations
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
