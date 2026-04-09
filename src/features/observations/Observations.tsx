// src/features/observations/Observations.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Crumb, Toolbar, GrayTag } from "@/shared/ui/atoms";
import type { Observation } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ListFilter,
  Pencil,
  PlusCircle,
  Trash2,
  Undo2,
  PlayCircle,
  Monitor,
  CheckCircle2,
  X,
  Calendar as CalendarIcon,
  ChevronUp,
  ChevronDown,
  Columns as ColumnsIcon,
  EllipsisVertical,
  FileDown,
  FileSpreadsheet,
  Users,
  MoveHorizontal,
  ChevronRight as ChevronRightIcon,
  Search,
  XCircle,
} from "lucide-react";
import { ObservationEditor } from "./ObservationEditor";
import type { XO as EditorXO } from "./ObservationEditor";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AddObservationIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/* -------------------------------- helpers -------------------------------- */

function lockBodyScroll() {
  // remember scroll position
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

  // optional: compensation for "disappearing" scrollbar (desktop/tablet)
  const scrollbarW = window.innerWidth - document.documentElement.clientWidth;

  document.body.dataset.scrollLock = "1";
  document.body.dataset.scrollY = String(scrollY);

  // key trick for iOS: position: fixed on body + top:-scrollY
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";

  if (scrollbarW > 0) {
    document.body.style.paddingRight = `${scrollbarW}px`;
  }
}

function unlockBodyScroll() {
  if (document.body.dataset.scrollLock !== "1") return;

  const scrollY = Number(document.body.dataset.scrollY || "0");

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";

  delete document.body.dataset.scrollLock;
  delete document.body.dataset.scrollY;

  // restore scroll
  window.scrollTo(0, scrollY);
}

function useIsMobile(maxPx = 640) {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${maxPx - 1}px)`);
    const on = (e: MediaQueryListEvent | MediaQueryList) =>
      setIs((e as any).matches ?? mq.matches);
    setIs(mq.matches);
    mq.addEventListener?.("change", on as any);
    return () => mq.removeEventListener?.("change", on as any);
  }, [maxPx]);
  return is;
}

function Portal({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.getElementById("portal-root"));
  }, []);
  return el ? createPortal(children, el) : null;
}

/* -------- anchored layer (desktop popovers) -------- */

function useAnchoredRect(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean
) {
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const compute = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom, left: r.left, width: r.width, height: r.height });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    compute();
    const on = () => compute();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [open, compute]);

  return rect;
}

function AnchoredPopover({
  anchorRef,
  open,
  onClose,
  children,
  className,
  width = 0,
  gap = 8,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  width?: number;
  gap?: number;
}) {
  const rect = useAnchoredRect(anchorRef, open);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !rect) return null;

  const left = Math.max(
    8,
    Math.min(rect.left, window.innerWidth - 8 - (width || rect.width))
  );
  const top = rect.top + gap;
  const w = width || rect.width;

  return (
    <Portal>
      <div className="fixed inset-0 z-[199]" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={className}
        style={{
          position: "fixed",
          top,
          left,
          width: w,
          zIndex: 200,
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

/* -------------------------------- Types -------------------------------- */

type Bucket = "active" | "trash";
type Mode = "live" | "tv";

type PositionKey = string;

type ObsPlayer = {
  id: string;
  type: "known" | "unknown";
  name?: string;
  shirtNo?: string;
  minutes?: number;
  position?: PositionKey;
  overall?: number;

  // metrics from ObservationEditor
  base?: Record<string, number>;
  gk?: Record<string, number>;
  def?: Record<string, number>;
  mid?: Record<string, number>;
  att?: Record<string, number>;

  note?: string;
};

type XO = Observation & {
  bucket?: Bucket;
  mode?: Mode;
  voiceUrl?: string | null;
  note?: string;
  players?: ObsPlayer[];
};

const DEFAULT_COLS = {
  select: true,
  match: true,
  date: true,
  time: true,
  mode: true,
  status: true, // using this for "League/Competition" column
  players: true,
  actions: true,
};
type ColKey = keyof typeof DEFAULT_COLS;

const COL_EN: Record<ColKey, string> = {
  select: "#",
  match: "Match",
  date: "Date",
  time: "Time",
  mode: "Mode",
  status: "League",
  players: "Players",
  actions: "Actions",
};

type SortKey = "match" | "date" | "time" | "mode" | "status" | "players";
type SortDir = "asc" | "desc";

const UI_KEY = "s4s.observations.ui";
const SEED_FLAG = "s4s.observations.demoSeeded";
const HINT_DISMISS_KEY = "s4s.observations.scrollHintDismissed";

/* shared layout tokens */
const controlH = "h-9";
const cellPad = "p-1";
const rowH = "h-10";

/* infinite scroll config */
const INITIAL_VISIBLE = 50;
const STEP_VISIBLE = 50;

/* ----------------------------- Small helpers ---------------------------- */

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function splitMatch(match?: string): { teamA?: string; teamB?: string } {
  if (!match) return {};
  const [a, b] = match.split(/vs|VS| Vs | v\. | – | - /i).map((x) => x.trim());
  if (!a || !b) return { teamA: match };
  return { teamA: a, teamB: b };
}

/* ---------------------------- Adapters (safe) --------------------------- */
function toEditorXO(row: XO): EditorXO {
  const { teamA, teamB } = splitMatch(row.match);

  const players = (row.players ?? []).map((p: any) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    shirtNo: p.shirtNo,
    minutes: p.minutes,
    position: p.position,
    overall: p.overall,

    // keep all metrics
    base: p.base ?? {},
    gk: p.gk ?? {},
    def: p.def ?? {},
    mid: p.mid ?? {},
    att: p.att ?? {},

    note: p.note,
  }));

  const editorObj: any = {
    id: row.id,
    match: row.match ?? "",            
    reportDate: row.date || "",
    competition: row.competition ?? "",
    teamA: teamA || "",
    teamB: teamB || "",
    conditions: row.mode ?? "live",    
    contextNote: row.note ?? "",
    note: row.note ?? "",
    players,
    __listMeta: {
      id: row.id,
      status: row.status,
      bucket: row.bucket ?? "active",
      time: row.time ?? "",
      player: row.player ?? "",
    },
  };

  return editorObj as EditorXO;
}

function fromEditorXO(e: EditorXO, prev?: XO): XO {
  const anyE: any = e;
  const teamA = anyE.teamA ?? "";
  const teamB = anyE.teamB ?? "";
  const match =
    teamA && teamB
      ? `${teamA} vs ${teamB}`
      : teamA || teamB || (prev?.match ?? "");

  const players: ObsPlayer[] = (anyE.players ?? []).map((p: any) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    shirtNo: p.shirtNo,
    minutes: p.minutes,
    position: p.position as PositionKey,
    overall: p.overall,

    // transfer metrics from editor
    base: p.base ?? {},
    gk: p.gk ?? {},
    def: p.def ?? {},
    mid: p.mid ?? {},
    att: p.att ?? {},

    note: p.note,
  }));

  const meta = anyE.__listMeta || {};

  const listRow: XO = {
    id: meta.id ?? prev?.id ?? 0,
    player: meta.player ?? prev?.player ?? "",
    match,
    date: anyE.reportDate ?? prev?.date ?? "",
    time: meta.time ?? prev?.time ?? "",
    status: meta.status ?? prev?.status ?? "draft",
    bucket: meta.bucket ?? prev?.bucket ?? "active",

    // match mode from editor -> list
    mode: (anyE.conditions ?? prev?.mode ?? "live") as Mode,

    competition: anyE.competition ?? prev?.competition ?? null,
    note: anyE.note ?? anyE.contextNote ?? prev?.note ?? "",
    voiceUrl: prev?.voiceUrl ?? null,
    players,
  };

  return listRow;
}

/* =============================== Feature ================================ */

export default function ObservationsFeature({
  data,
  onChange,
  loading,
}: {
  data: Observation[];
  onChange: (next: Observation[]) => void;
  loading?: boolean;
}) {
  const isMobile = useIsMobile();

  const rows: XO[] = useMemo(() => {
    return (data as XO[]).map((o) => ({
      bucket: "active",
      mode: "live",
      players: [],
      ...o,
    }));
  }, [data]);

  const [pageMode, setPageMode] = useState<"list" | "editor">("list");
  const [editing, setEditing] = useState<XO | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // anchors
  const filtersBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);

  // CHIPS overflow
  const chipsMoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const [chipsOpen, setChipsOpen] = useState(false);
  const chipsHoverTimer = useRef<number | null>(null);

  // search ref
  const searchRef = useRef<HTMLInputElement | null>(null);

  // table scroll hint (horiz)
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // infinite scroll sentinel
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    const dismissed = localStorage.getItem(HINT_DISMISS_KEY) === "1";
    const el = tableWrapRef.current;
    const hasOverflow = el ? el.scrollWidth > el.clientWidth + 8 : false;
    setShowScrollHint(isMobile && !dismissed && hasOverflow);

    if (!el) return;
    const onScroll = () => {
      if (el.scrollLeft > 0 && !dismissed) {
        setShowScrollHint(false);
        localStorage.setItem(HINT_DISMISS_KEY, "1");
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true } as any);
    return () => el.removeEventListener("scroll", onScroll as any);
  }, [isMobile]);

  useEffect(() => {
    if (searchParams?.get("create") === "1") {
      addNew();
      const sp = new URLSearchParams(searchParams);
      sp.delete("create");
      const qs = sp.toString();
      router.replace(qs ? `/observations?${qs}` : "/observations", {
        scroll: false,
      });
    }
    try {
      const already = localStorage.getItem(SEED_FLAG);
      if ((data?.length ?? 0) === 0 && !already) {
        const demo: XO[] = [];
        onChange(demo as unknown as Observation[]);
        localStorage.setItem(SEED_FLAG, "1");
        setEditing(demo[0]);
        setPageMode("editor");
      }
    } catch { }
  }, [searchParams]);

  // Filters + state
  const [scope, setScope] = useState<Bucket>("active");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false); 
  const [moreOpen, setMoreOpen] = useState(false);

  const [matchFilter, setMatchFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<Mode | "">("");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<Observation["status"] | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [visibleCols, setVisibleCols] = useState({ ...DEFAULT_COLS });

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (isMobile && filtersOpen) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
    if (isMobile && !filtersOpen) {
      unlockBodyScroll();
    }
  }, [isMobile, filtersOpen]);

  useEffect(() => {
    const anySheetOpen = filtersOpen || moreOpen || colsOpen;

    if (isMobile && anySheetOpen) {
      lockBodyScroll();
      return () => unlockBodyScroll();
    }
    if (isMobile && !anySheetOpen) unlockBodyScroll();
  }, [isMobile, filtersOpen, moreOpen, colsOpen]);

  // MASS SELECTION
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  // inline status note 
  const [statusNote, setStatusNote] = useState<Record<number, string>>({});
  function flashStatus(id: number, nextStatus: Observation["status"]) {
    setStatusNote((prev) => ({
      ...prev,
      [id]: "",
    }));
    window.setTimeout(() => {
      setStatusNote((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 1800);
  }

  // inline confirm for move-to-trash
  const [confirmTrashId, setConfirmTrashId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u.scope) setScope(u.scope);
      if (u.q) setQ(u.q);
      if (u.matchFilter) setMatchFilter(u.matchFilter);
      if (u.modeFilter) setModeFilter(u.modeFilter);
      if (u.lifecycleFilter) setLifecycleFilter(u.lifecycleFilter);
      if (u.dateFrom) setDateFrom(u.dateFrom);
      if (u.dateTo) setDateTo(u.dateTo);
      if (u.visibleCols) setVisibleCols({ ...DEFAULT_COLS, ...u.visibleCols });
      if (u.sortKey) setSortKey(u.sortKey);
      if (u.sortDir) setSortDir(u.sortDir);
    } catch { }
  }, []);

  useEffect(() => {
    try {
      const u = {
        scope,
        q,
        matchFilter,
        modeFilter,
        lifecycleFilter,
        dateFrom,
        dateTo,
        visibleCols,
        sortKey,
        sortDir,
      };
      localStorage.setItem(UI_KEY, JSON.stringify(u));
    } catch { }
  }, [
    scope,
    q,
    matchFilter,
    modeFilter,
    lifecycleFilter,
    dateFrom,
    dateTo,
    visibleCols,
    sortKey,
    sortDir,
  ]);

  // Shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || (e as any).isComposing;
      if (!typing) {
        if (e.key === "/") {
          e.preventDefault();
          searchRef.current?.focus();
          return;
        } else if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          addNew();
          return;
        } else if (e.key.toLowerCase() === "e") {
          e.preventDefault();
          exportCSV();
          return;
        }
      }
      if (e.key === "Escape") {
        setFiltersOpen(false);
        setColsOpen(false);
        setMoreOpen(false);
        setChipsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    let base = rows
      .filter((r) => (r.bucket ?? "active") === scope)
      .filter((r) =>
        !q
          ? true
          : (r.match ?? "").toLowerCase().includes(q.toLowerCase()) ||
          r.players?.some(
            (p) =>
              (p.name ?? `#${p.shirtNo ?? ""}`)
                .toLowerCase()
                .includes(q.toLowerCase())
          ) === true
      )
      .filter((r) =>
        matchFilter
          ? (r.match ?? "").toLowerCase().includes(matchFilter.toLowerCase())
          : true
      )
      .filter((r) => (modeFilter ? (r.mode ?? "live") === modeFilter : true))
      .filter((r) => (lifecycleFilter ? r.status === lifecycleFilter : true))
      .filter((r) => (dateFrom ? (r.date ?? "") >= dateFrom : true))
      .filter((r) => (dateTo ? (r.date ?? "") <= dateTo : true));

    const dir = sortDir === "asc" ? 1 : -1;
    base.sort((a, b) => {
      const av = (() => {
        switch (sortKey) {
          case "match":
            return (a.match ?? "").toLowerCase();
          case "date":
            return a.date ?? "";
          case "time":
            return a.time ?? "";
          case "mode":
            return a.mode ?? "live";
          case "status":
            return (a.competition ?? "").toLowerCase();
          case "players":
            return a.players?.length ?? 0;
        }
      })();
      const bv = (() => {
        switch (sortKey) {
          case "match":
            return (b.match ?? "").toLowerCase();
          case "date":
            return b.date ?? "";
          case "time":
            return b.time ?? "";
          case "mode":
            return b.mode ?? "live";
          case "status":
            return (b.competition ?? "").toLowerCase();
          case "players":
            return b.players?.length ?? 0;
        }
      })();

      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      const aStr = String(av);
      const bStr = String(bv);
      return aStr < bStr ? -1 * dir : aStr > bStr ? 1 * dir : 0;
    });

    return base;
  }, [
    rows,
    scope,
    q,
    matchFilter,
    modeFilter,
    lifecycleFilter,
    dateFrom,
    dateTo,
    sortKey,
    sortDir,
  ]);

  // Keep selection sane after filters
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(filtered.map((r) => r.id));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      if (next.size === prev.size) {
        let same = true;
        for (const id of prev) {
          if (!next.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [filtered]);

  const allChecked =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id as number));
  const someChecked =
    !allChecked && filtered.some((r) => selected.has(r.id as number));

  function addNew() {
    setEditing({
      id: 0,
      player: "",
      match: "",
      date: "",
      time: "",
      status: "draft",
      bucket: "active",
      mode: "live",
      competition: null, 
      note: "",
      voiceUrl: null,
      players: [],
    });
    setPageMode("editor");
  }

  function save(obs: XO) {
    const exists = rows.some((x) => x.id === obs.id);

    const next: XO[] = exists
      ? rows.map((x) => (x.id === obs.id ? obs : x))
      : [obs, ...rows];

    onChange(next as unknown as Observation[]);
    setPageMode("list");
    setEditing(null);
  }

  function moveToTrash(id: number) {
    const next = rows.map((x) =>
      x.id === id ? { ...x, bucket: "trash" as Bucket } : x
    );
    onChange(next as unknown as Observation[]);
    setConfirmTrashId((prev) => (prev === id ? null : prev));
  }

  function restoreFromTrash(id: number) {
    const next = rows.map((x) =>
      x.id === id ? { ...x, bucket: "active" as Bucket } : x
    );
    onChange(next as unknown as Observation[]);
  }

  function deletePerm(id: number) {
    const next = rows.filter((x) => x.id !== id);
    onChange(next as unknown as Observation[]);
  }

  function exportCSV() {
    const header = "ID,Match,Date,Time,Mode,Status,Players\n";
    const body = rows
      .map(
        (r) =>
          `${r.id},"${r.match}",${r.date},${r.time},${r.mode},${r.status},${r.players?.length || 0}`
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `observations_${new Date().toISOString()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const [activeTab, setActiveTab] = useState<Bucket>("active");
  useEffect(() => {
    setScope(activeTab);
  }, [activeTab]);

  const counts = useMemo(() => {
    return {
      active: rows.filter((r) => (r.bucket ?? "active") === "active").length,
      trash: rows.filter((r) => r.bucket === "trash").length,
    };
  }, [rows]);

  const hasFilter =
    matchFilter || modeFilter || lifecycleFilter || dateFrom || dateTo;

  if (pageMode === "editor" && editing) {
    return (
      <ObservationEditor
        initial={toEditorXO(editing)}
        onSave={(e) => save(fromEditorXO(e, editing))}
        onClose={() => {
          setPageMode("list");
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-0">
      <Toolbar
        title="Observation Log"
        subtitle="Manage match scoutings, voice notes, and advanced technical reports."
        right={
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 sm:flex">
              <GrayTag className="hidden h-5 items-center gap-1 rounded px-1.5 text-[10px] sm:flex">
                <Users className="h-3 w-3" />
                {counts.active} total
              </GrayTag>
            </div>
            <Button
              size="sm"
              onClick={addNew}
              className="flex h-8 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-xs font-semibold text-stone-50 transition-all hover:bg-stone-800 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              <AddObservationIcon className="h-4 w-4" />
              <span>New Scouting</span>
            </Button>
          </div>
        }
      />

      <div className="mb-4 mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-9 items-center gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-900">
          <button
            onClick={() => setActiveTab("active")}
            className={cn(
              "flex h-7 items-center gap-2 rounded-md px-3 text-xs font-medium transition-all",
              activeTab === "active"
                ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-300"
            )}
          >
            All Scouting
            <span className="opacity-50">{counts.active}</span>
          </button>
          <button
            onClick={() => setActiveTab("trash")}
            className={cn(
              "flex h-7 items-center gap-2 rounded-md px-3 text-xs font-medium transition-all",
              activeTab === "trash"
                ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50"
                : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-300"
            )}
          >
            Archive
            <span className="opacity-50">{counts.trash}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by match or player..."
              className="h-9 w-full border-stone-200 bg-white pl-9 text-xs dark:border-stone-800 dark:bg-stone-950 sm:text-sm"
            />
          </div>
          <Button
            ref={filtersBtnRef}
            size="sm"
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "h-9 gap-2 border-stone-200 text-xs font-medium dark:border-stone-800",
              hasFilter && "bg-stone-100 dark:bg-stone-900 ring-1 ring-stone-900/10"
            )}
          >
            <ListFilter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasFilter && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-stone-900 text-[10px] text-white dark:bg-stone-50 dark:text-stone-900">
                !
              </span>
            )}
          </Button>
          <Button
            ref={moreBtnRef}
            size="sm"
            variant="outline"
            className="h-9 w-9 border-stone-200 p-0 text-stone-500 dark:border-stone-800"
            onClick={() => setMoreOpen(!moreOpen)}
          >
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* --- Filter Layer (Mobile Fullscreen / Desktop Anchored) --- */}
      {isMobile ? (
        <Portal>
          <div
            className={cn(
              "fixed inset-0 z-[1000] flex flex-col bg-white transition-all duration-300 dark:bg-stone-950",
              filtersOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
            )}
          >
            <div className="flex items-center justify-between border-b p-4 dark:border-stone-800">
              <h3 className="text-sm font-bold uppercase tracking-widest">Filters</h3>
              <Button size="icon" variant="ghost" onClick={() => setFiltersOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 tablet-safe-bottom">
              <FilterForm
                match={matchFilter}
                setMatch={setMatchFilter}
                mode={modeFilter}
                setMode={setModeFilter}
                lc={lifecycleFilter}
                setLc={setLifecycleFilter}
                from={dateFrom}
                setFrom={setDateFrom}
                to={dateTo}
                setTo={setDateTo}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t p-4 dark:border-stone-800">
              <Button
                variant="outline"
                onClick={() => {
                  setMatchFilter("");
                  setModeFilter("");
                  setLifecycleFilter("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear all
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Apply</Button>
            </div>
          </div>
        </Portal>
      ) : (
        <AnchoredPopover
          anchorRef={filtersBtnRef}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          width={280}
          className="rounded-lg border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-800 dark:bg-stone-950/95 dark:backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Advanced Filters</h4>
            <Button
              variant="ghost"
              className="h-auto p-0 text-[10px] text-stone-400 hover:text-stone-900"
              onClick={() => {
                setMatchFilter("");
                setModeFilter("");
                setLifecycleFilter("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear
            </Button>
          </div>
          <FilterForm
            match={matchFilter}
            setMatch={setMatchFilter}
            mode={modeFilter}
            setMode={setModeFilter}
            lc={lifecycleFilter}
            setLc={setLifecycleFilter}
            from={dateFrom}
            setFrom={setDateFrom}
            to={dateTo}
            setTo={setDateTo}
          />
        </AnchoredPopover>
      )}

      {/* --- Column Select + Export Actions --- */}
      <AnchoredPopover
        anchorRef={moreBtnRef}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        width={200}
        className="rounded-lg border border-stone-200 bg-white p-1 shadow-xl dark:border-stone-800 dark:bg-stone-950/95 dark:backdrop-blur"
      >
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">View & Actions</div>
        <button
          onClick={() => {
            setColsOpen(true);
            setMoreOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs hover:bg-stone-50 dark:hover:bg-stone-900"
        >
          <ColumnsIcon className="h-3.5 w-3.5" />
          Edit Columns
        </button>
        <button
          onClick={() => {
            exportCSV();
            setMoreOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs hover:bg-stone-50 dark:hover:bg-stone-900"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export to CSV
        </button>
        <button
          onClick={() => {
            alert("Excel export requires additional premium library.");
            setMoreOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs hover:bg-stone-50 dark:hover:bg-stone-900"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Export to Excel
        </button>
      </AnchoredPopover>

      {/* --- Column Selector Modal --- */}
      <Dialog open={colsOpen} onOpenChange={setColsOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Configure Columns</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {(Object.keys(DEFAULT_COLS) as ColKey[]).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${k}`}
                  checked={visibleCols[k]}
                  onCheckedChange={(v) => setVisibleCols((prev) => ({ ...prev, [k]: !!v }))}
                />
                <Label htmlFor={`col-${k}`} className="text-sm font-medium">
                  {COL_EN[k]}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                setColsOpen(false);
                setMoreOpen(false);
              }}
            >
              Save layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Main Table Container --- */}
      <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950">
        <div ref={tableWrapRef} className="overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50 dark:border-stone-900 dark:bg-stone-900/30">
                {visibleCols.select && (
                  <th className={cn("text-center", cellPad, "w-10")}>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={allChecked}
                        ref={(ref: any) => {
                          if (ref) ref.indeterminate = someChecked;
                        }}
                        onCheckedChange={(val) => {
                          const next = new Set<number>(selected);
                          if (val) filtered.forEach((r) => next.add(r.id as number));
                          else filtered.forEach((r) => next.delete(r.id as number));
                          setSelected(next);
                          setIsMultiSelect(next.size > 0);
                        }}
                      />
                    </div>
                  </th>
                )}
                {visibleCols.match && <SortTh k="match" label={COL_EN.match} cur={sortKey} dir={sortDir} on={setSortKey} onDir={setSortDir} />}
                {visibleCols.date && <SortTh k="date" label={COL_EN.date} cur={sortKey} dir={sortDir} on={setSortKey} onDir={setSortDir} />}
                {visibleCols.time && <SortTh k="time" label={COL_EN.time} cur={sortKey} dir={sortDir} on={setSortKey} onDir={setSortDir} />}
                {visibleCols.mode && <SortTh k="mode" label={COL_EN.mode} cur={sortKey} dir={sortDir} on={setSortKey} onDir={setSortDir} />}
                {visibleCols.status && <SortTh k="status" label={COL_EN.status} cur={sortKey} dir={sortDir} on={setSortKey} onDir={setSortDir} />}
                {visibleCols.players && <SortTh k="players" label={COL_EN.players} cur={sortKey} dir={sortDir} on={setSortKey} onDir={setSortDir} />}
                {visibleCols.actions && <th className={cn("font-semibold text-stone-500", cellPad, "text-right")}></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50 dark:divide-stone-900">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-50 dark:bg-stone-900">
                        <Search className="h-6 w-6 text-stone-300" />
                      </div>
                      <p className="text-sm font-medium text-stone-500">No recordings found.</p>
                      <button onClick={addNew} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                        Create first observation &rarr;
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.slice(0, visibleCount).map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      "group h-12 transition-colors",
                      selected.has(r.id as number) ? "bg-indigo-50/30 dark:bg-indigo-950/20" : "hover:bg-stone-50/40 dark:hover:bg-stone-900/20"
                    )}
                  >
                    {visibleCols.select && (
                      <td className={cn("text-center", cellPad)}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={selected.has(r.id as number)}
                            onCheckedChange={(val) => {
                              const next = new Set<number>(selected);
                              if (val) next.add(r.id as number);
                              else next.delete(r.id as number);
                              setSelected(next);
                              setIsMultiSelect(next.size > 0);
                            }}
                          />
                        </div>
                      </td>
                    )}
                    {visibleCols.match && (
                      <td className={cn(cellPad)}>
                        <div
                          className="flex cursor-pointer flex-col group/match"
                          onClick={() => {
                            setEditing(r);
                            setPageMode("editor");
                          }}
                        >
                          <span className="font-semibold text-stone-900 group-hover/match:text-indigo-600 dark:text-stone-100 dark:group-hover/match:text-indigo-400">
                            {r.match || "Unnamed Match"}
                          </span>
                          {r.note && <span className="max-w-[240px] truncate text-[10.5px] text-stone-400">{r.note}</span>}
                        </div>
                      </td>
                    )}
                    {visibleCols.date && <td className={cn(cellPad, "text-stone-600 dark:text-stone-400 tabular-nums")}>{fmtDate(r.date)}</td>}
                    {visibleCols.time && <td className={cn(cellPad, "text-stone-500 tabular-nums")}>{r.time || "—"}</td>}
                    {visibleCols.mode && (
                      <td className={cn(cellPad)}>
                        <div className="flex">
                          <span
                            className={cn(
                              "flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              r.mode === "tv"
                                ? "bg-stone-100 text-stone-500 dark:bg-stone-900"
                                : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
                            )}
                          >
                            {r.mode === "tv" ? <Monitor className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
                            {r.mode === "tv" ? "TV / Tape" : "In-Person"}
                          </span>
                        </div>
                      </td>
                    )}
                    {visibleCols.status && (
                      <td className={cn(cellPad)}>
                        <span className="text-xs font-medium text-stone-500">{r.competition || "Unspecified League"}</span>
                      </td>
                    )}
                    {visibleCols.players && (
                      <td className={cn(cellPad)}>
                        <div className="group/chips relative flex items-center">
                          <div className="hide-scrollbar flex items-center gap-1 overflow-hidden transition-all duration-300">
                            {(r.players ?? []).slice(0, 3).map((p, idx) => (
                              <PlayerChip key={p.id ?? idx} p={p} />
                            ))}
                            {(r.players?.length ?? 0) > 3 && (
                              <button
                                className="flex h-6 items-center rounded-md bg-stone-50 px-2 text-[10px] font-bold text-stone-400 hover:bg-stone-100 dark:bg-stone-900 dark:hover:bg-stone-800"
                                onMouseEnter={(e) => {
                                  chipsMoreBtnRef.current = e.currentTarget;
                                  setChipsOpen(true);
                                }}
                              >
                                +{(r.players?.length ?? 0) - 3}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleCols.actions && (
                      <td className={cn(cellPad, "text-right")}>
                        <div className="flex items-center justify-end gap-1 px-2 opacity-0 group-hover:opacity-100">
                          {scope === "trash" ? (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-stone-400 hover:text-indigo-600"
                                      onClick={() => restoreFromTrash(r.id as number)}
                                    >
                                      <Undo2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Restore</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-stone-400 hover:text-rose-600"
                                      onClick={() => deletePerm(r.id as number)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete permanently</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          ) : (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-stone-400 hover:bg-white hover:text-indigo-600 dark:hover:bg-stone-900"
                                      onClick={() => {
                                        setEditing(r);
                                        setPageMode("editor");
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit report</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <div className="relative">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={cn(
                                    "h-8 w-8 transition-colors",
                                    confirmTrashId === r.id
                                      ? "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30"
                                      : "text-stone-400 hover:bg-white hover:text-stone-600 dark:hover:bg-stone-900"
                                  )}
                                  onClick={() => setConfirmTrashId(confirmTrashId === r.id ? null : (r.id as number))}
                                >
                                  {confirmTrashId === r.id ? <CheckCircle2 className="h-4 w-4" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                                {confirmTrashId === r.id && (
                                  <div
                                    className="absolute bottom-full right-0 mb-2 w-32 animate-in fade-in slide-in-from-bottom-1"
                                    onClick={() => moveToTrash(r.id as number)}
                                  >
                                    <div className="rounded bg-rose-600 px-2 py-1 text-center text-[10px] font-bold text-white shadow-lg">Confirm Delete</div>
                                    <div className="mx-auto h-0 w-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-rose-600" />
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- Scroll Hint --- */}
        {showScrollHint && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-stone-900/80 px-4 py-2 text-white backdrop-blur animate-in fade-in zoom-in slide-in-from-bottom-2">
            <MoveHorizontal className="h-4 w-4 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Slide left to see more</span>
          </div>
        )}
      </div>

      {visibleCount < filtered.length && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          <Button
            variant="ghost"
            className="flex items-center gap-2 rounded-full px-6 text-xs text-stone-400 hover:bg-stone-50"
            onClick={() => setVisibleCount((p) => p + STEP_VISIBLE)}
          >
            <ChevronDown className="h-4 w-4" />
            Show more recordings
          </Button>
        </div>
      )}

      {/* --- Batch Actions Overlay --- */}
      {isMultiSelect && (
        <div className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-4 rounded-full bg-stone-900 px-6 py-3 text-white shadow-2xl transition-all animate-in slide-in-from-bottom-10 dark:bg-white dark:text-stone-900">
          <div className="flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {selected.size} selected
          </div>
          <div className="h-4 w-px bg-white/20 dark:bg-stone-900/20" />
          <div className="flex items-center gap-2">
            {scope === "trash" ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs font-bold text-white hover:bg-white/10 dark:text-stone-900 dark:hover:bg-stone-900/10"
                  onClick={() => {
                    const next = rows.map((x) => (selected.has(x.id as number) ? { ...x, bucket: "active" as Bucket } : x));
                    onChange(next as unknown as Observation[]);
                    setSelected(new Set());
                    setIsMultiSelect(false);
                  }}
                >
                  Restore
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-rose-600 text-xs font-bold text-white hover:bg-rose-700"
                  onClick={() => {
                    const next = rows.filter((x) => !selected.has(x.id as number));
                    onChange(next as unknown as Observation[]);
                    setSelected(new Set());
                    setIsMultiSelect(false);
                  }}
                >
                  Delete permanently
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs font-bold text-white hover:bg-white/10 dark:text-stone-900 dark:hover:bg-stone-900/10"
                  onClick={() => {
                    const next = rows.map((x) => (selected.has(x.id as number) ? { ...x, status: "final" as Observation["status"] } : x));
                    onChange(next as unknown as Observation[]);
                    setSelected(new Set());
                    setIsMultiSelect(false);
                  }}
                >
                  Mark as Final
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-rose-600 text-xs font-bold text-white hover:bg-rose-700"
                  onClick={() => {
                    const next = rows.map((x) => (selected.has(x.id as number) ? { ...x, bucket: "trash" as Bucket } : x));
                    onChange(next as unknown as Observation[]);
                    setSelected(new Set());
                    setIsMultiSelect(false);
                  }}
                >
                  Archive records
                </Button>
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white/50 hover:text-white dark:text-stone-900/50 dark:hover:text-stone-900"
              onClick={() => {
                setSelected(new Set());
                setIsMultiSelect(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* --- Chips More Popover --- */}
      <AnchoredPopover
        anchorRef={chipsMoreBtnRef}
        open={chipsOpen}
        onClose={() => setChipsOpen(false)}
        width={300}
        className="rounded-lg border border-stone-200 bg-white/95 p-2 shadow-2xl backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/95"
      >
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Other Players</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setChipsOpen(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 p-1">
          {/* content managed by hovering row id logic if needed, but for now we simplify */}
        </div>
      </AnchoredPopover>
    </div>
  );
}

/* -------------------------------- Atoms -------------------------------- */

function SortTh({
  k,
  label,
  cur,
  dir,
  on,
  onDir,
}: {
  k: SortKey;
  label: string;
  cur: SortKey;
  dir: SortDir;
  on: (k: SortKey) => void;
  onDir: (d: SortDir) => void;
}) {
  const active = cur === k;
  return (
    <th className={cn("select-none font-semibold text-stone-500", cellPad)}>
      <button
        onClick={() => {
          if (active) onDir(dir === "asc" ? "desc" : "asc");
          else {
            on(k);
            onDir(k === "date" ? "desc" : "asc");
          }
        }}
        className="flex items-center gap-1 hover:text-stone-900 dark:hover:text-stone-100"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-indigo-500" />
          ) : (
            <ChevronDown className="h-3 w-3 text-indigo-500" />
          )
        ) : (
          <MoveHorizontal className="h-3 w-3 opacity-0 group-hover:opacity-30" />
        )}
      </button>
    </th>
  );
}

function PlayerChip({ p }: { p: ObsPlayer }) {
  const isKnown = p.type === "known";
  const name = p.name || `Player #${p.shirtNo || "?"}`;
  return (
    <div
      className={cn(
        "flex h-6 flex-shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
        isKnown
          ? "border-indigo-100 bg-indigo-50/50 text-indigo-700 dark:border-indigo-900/30 dark:bg-indigo-900/20 dark:text-indigo-300"
          : "border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400"
      )}
    >
      {isKnown ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      <span className="truncate">{name}</span>
      {p.shirtNo && <span className="opacity-50">#{p.shirtNo}</span>}
    </div>
  );
}

function FilterForm({
  match,
  setMatch,
  mode,
  setMode,
  lc,
  setLc,
  from,
  setFrom,
  to,
  setTo,
}: {
  match: string;
  setMatch: (v: string) => void;
  mode: Mode | "";
  setMode: (v: Mode | "") => void;
  lc: Observation["status"] | "";
  setLc: (v: Observation["status"] | "") => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-stone-500">Match Name</Label>
        <Input placeholder="e.g. Barcelona vs Real..." value={match} onChange={(e) => setMatch(e.target.value)} className="h-9 text-xs" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-stone-500">Mode</Label>
          <div className="grid grid-cols-2 gap-1 rounded bg-stone-100 p-0.5 dark:bg-stone-900">
            <button
              onClick={() => setMode("live")}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-bold transition-all",
                mode === "live" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50" : "text-stone-400 hover:text-stone-900"
              )}
            >
              LIVE
            </button>
            <button
              onClick={() => setMode("tv")}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-bold transition-all",
                mode === "tv" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-50" : "text-stone-400 hover:text-stone-900"
              )}
            >
              TV
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-stone-500">Status</Label>
          <select
            value={lc}
            onChange={(e) => setLc(e.target.value as any)}
            className="h-7 w-full rounded border border-stone-200 bg-white px-1 text-[10px] font-bold dark:border-stone-800 dark:bg-stone-950"
          >
            <option value="">ALL</option>
            <option value="draft">DRAFT</option>
            <option value="final">FINAL</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-stone-500">Date Range</Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <CalendarIcon className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-400" />
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 pl-7 text-[10px] uppercase" />
          </div>
          <span className="text-stone-300">&rarr;</span>
          <div className="relative flex-1">
            <CalendarIcon className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-400" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 pl-7 text-[10px] uppercase" />
          </div>
        </div>
      </div>
    </div>
  );
}
