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
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
} from "lucide-react";
import { ObservationEditor } from "./ObservationEditor";
import type { XO as EditorXO } from "./ObservationEditor";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/* -------------------------------- helpers -------------------------------- */

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
type TabKey = "active" | "draft" | "final";

type PositionKey = string;

type ObsPlayer = {
  id: string;
  type: "known" | "unknown";
  name?: string;
  shirtNo?: string;
  minutes?: number;
  position?: PositionKey;
  overall?: number;
  voiceUrl?: string | null;
  note?: string;
  ratings?: { off: number; def: number; tech: number; motor: number };
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
  status: true,
  players: true,
  actions: true,
};
type ColKey = keyof typeof DEFAULT_COLS;

const COL_PL: Record<ColKey, string> = {
  select: "#",
  match: "Mecz",
  date: "Data",
  time: "Godzina",
  mode: "Tryb",
  status: "Status",
  players: "Zawodnicy",
  actions: "Akcje",
};

type SortKey = "match" | "date" | "time" | "mode" | "status" | "players";
type SortDir = "asc" | "desc";

const UI_KEY = "s4s.observations.ui";
const SEED_FLAG = "s4s.observations.demoSeeded";
const HINT_DISMISS_KEY = "s4s.observations.scrollHintDismissed";

/* ----------------------------- Small helpers ---------------------------- */

function fmtDate(d?: string) {
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

function splitMatch(match?: string): { teamA?: string; teamB?: string } {
  if (!match) return {};
  const [a, b] = match.split(/vs|VS| Vs | v\. | – | - /i).map((x) => x.trim());
  if (!a || !b) return { teamA: match };
  return { teamA: a, teamB: b };
}

/* ---------------------------- Adapters (safe) --------------------------- */
function toEditorXO(row: XO): EditorXO {
  const { teamA, teamB } = splitMatch(row.match);
  const players = (row.players ?? []).map((p) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    shirtNo: p.shirtNo,
    minutes: p.minutes,
    position: p.position,
    overall: p.overall,
    note: p.note,
  }));
  const editorObj: any = {
    reportDate: row.date || "",
    competition: "",
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
    teamA && teamB ? `${teamA} vs ${teamB}` : teamA || teamB || (prev?.match ?? "");

  const players: ObsPlayer[] = (anyE.players ?? []).map((p: any) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    shirtNo: p.shirtNo,
    minutes: p.minutes,
    position: p.position as PositionKey,
    overall: p.overall,
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
    mode: (anyE.conditions ?? prev?.mode ?? "live") as Mode,
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
}: {
  data: Observation[];
  onChange: (next: Observation[]) => void;
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

  // anchors for desktop popovers
  const filtersBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);

  // search focus ref for "/" shortcut
  const searchRef = useRef<HTMLInputElement | null>(null);

  // table wrapper ref for horizontal scroll hint
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(HINT_DISMISS_KEY) === "1";
    const el = tableWrapRef.current;
    const hasOverflow =
      el ? el.scrollWidth > el.clientWidth + 8 : false;
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
      router.replace(qs ? `/observations?${qs}` : "/observations", { scroll: false });
    }
    try {
      const already = localStorage.getItem(SEED_FLAG);
      if ((data?.length ?? 0) === 0 && !already) {
        const demo: XO[] = [
          {
            id: 1,
            player: "",
            match: "Lech U19 vs Legia U19",
            date: "2025-05-10",
            time: "12:00",
            status: "draft",
            bucket: "active",
            mode: "live",
            note: "Sparing A — dobre tempo gry.",
            voiceUrl: null,
            players: [
              {
                id: crypto.randomUUID(),
                type: "known",
                name: "Jan Kowalski",
                minutes: 75,
                position: "CF",
                overall: 7,
                note: "Dużo ruchu bez piłki.",
              },
              {
                id: crypto.randomUUID(),
                type: "unknown",
                shirtNo: "27",
                name: "#27",
                minutes: 30,
                position: "RW",
                overall: 6,
                note: "Dobre 1v1, decyzje do poprawy.",
              },
            ],
          },
          {
            id: 2,
            player: "",
            match: "Pogoń U17 vs Warta U17",
            date: "2025-04-28",
            time: "17:30",
            status: "final",
            bucket: "active",
            mode: "tv",
            note: "Analiza TV — solidna organizacja defensywy.",
            voiceUrl: null,
            players: [
              {
                id: crypto.randomUUID(),
                type: "known",
                name: "Michał Nowak",
                minutes: 90,
                position: "CB",
                overall: 8,
                note: "Świetna gra w powietrzu.",
              },
            ],
          },
        ];
        onChange(demo as unknown as Observation[]);
        localStorage.setItem(SEED_FLAG, "1");
        setEditing(demo[0]);
        setPageMode("editor");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Tabs at top (default: active)
  const [tab, setTab] = useState<TabKey>("active");

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

  // -------- MASS SELECTION STATE --------
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u.scope) setScope(u.scope);
      if (u.tab) setTab(u.tab);
      if (u.q) setQ(u.q);
      if (u.matchFilter) setMatchFilter(u.matchFilter);
      if (u.modeFilter) setModeFilter(u.modeFilter);
      if (u.lifecycleFilter) setLifecycleFilter(u.lifecycleFilter);
      if (u.dateFrom) setDateFrom(u.dateFrom);
      if (u.dateTo) setDateTo(u.dateTo);
      if (u.visibleCols) setVisibleCols({ ...DEFAULT_COLS, ...u.visibleCols });
      if (u.sortKey) setSortKey(u.sortKey);
      if (u.sortDir) setSortDir(u.sortDir);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const u = {
        scope,
        tab,
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
    } catch {}
  }, [
    scope,
    tab,
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

  // Keyboard shortcuts
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
        } else if (e.key.toLowerCase() === "x") {
          e.preventDefault();
          setColsOpen((o) => !o);
          setFiltersOpen(false);
          setMoreOpen(false);
          return;
        }
      }
      if (e.key === "Escape") {
        setFiltersOpen(false);
        setColsOpen(false);
        setMoreOpen(false);
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

    if (tab === "draft") base = base.filter((r) => r.status === "draft");
    if (tab === "final") base = base.filter((r) => r.status === "final");

    const dir = sortDir === "asc" ? 1 : -1;
    base.sort((a, b) => {
      const av = (() => {
        switch (sortKey) {
          case "match": return (a.match ?? "").toLowerCase();
          case "date": return a.date ?? "";
          case "time": return a.time ?? "";
          case "mode": return a.mode ?? "live";
          case "status": return a.status;
          case "players": return a.players?.length ?? 0;
        }
      })();
      const bv = (() => {
        switch (sortKey) {
          case "match": return (b.match ?? "").toLowerCase();
          case "date": return b.date ?? "";
          case "time": return b.time ?? "";
          case "mode": return b.mode ?? "live";
          case "status": return b.status;
          case "players": return b.players?.length ?? 0;
        }
      })();

      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      const aStr = String(av);
      const bStr = String(bv);
      return aStr < bStr ? -1 * dir : aStr > bStr ? 1 * dir : 0;
    });

    return base;
  }, [
    rows,
    scope,
    tab,
    q,
    matchFilter,
    modeFilter,
    lifecycleFilter,
    dateFrom,
    dateTo,
    sortKey,
    sortDir,
  ]);

  // Keep selection sane on filter change
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(filtered.map((r) => r.id));
      const next = new Set<number>();
      prev.forEach((id) => { if (visibleIds.has(id)) next.add(id); });
      if (next.size === prev.size) {
        let same = true;
        for (const id of prev) { if (!next.has(id)) { same = false; break; } }
        if (same) return prev;
      }
      return next;
    });
  }, [filtered]);

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someChecked = !allChecked && filtered.some((r) => selected.has(r.id));

  function addNew() {
    setEditing({
      id: 0, player: "", match: "", date: "", time: "",
      status: "draft", bucket: "active", mode: "live",
      note: "", voiceUrl: null, players: [],
    });
    setPageMode("editor");
  }

  function save(obs: XO) {
    const exists = rows.some((x) => x.id === obs.id);
    let next: XO[];
    if (exists) next = rows.map((x) => (x.id === obs.id ? obs : x));
    else {
      const nextId = Math.max(0, ...rows.map((x) => x.id)) + 1;
      next = [{ ...obs, id: nextId }, ...rows];
    }
    onChange(next as unknown as Observation[]);
    setPageMode("list");
    setEditing(null);
  }

  function moveToTrash(id: number) {
    const next = rows.map((x) =>
      x.id === id ? { ...x, bucket: "trash" as Bucket } : x
    );
    onChange(next as unknown as Observation[]);
  }
  function restoreFromTrash(id: number) {
    const next = rows.map((x) =>
      x.id === id ? { ...x, bucket: "active" as Bucket } : x
    );
    onChange(next as unknown as Observation[]);
  }

  // Bulk actions
  function bulkTrash() {
    const ids = selected;
    if (ids.size === 0) return;
    const next = rows.map((x) =>
      ids.has(x.id) ? { ...x, bucket: "trash" as Bucket } : x
    );
    onChange(next as unknown as Observation[]);
    setSelected(new Set());
  }
  function bulkRestore() {
    const ids = selected;
    if (ids.size === 0) return;
    const next = rows.map((x) =>
      ids.has(x.id) ? { ...x, bucket: "active" as Bucket } : x
    );
    onChange(next as unknown as Observation[]);
    setSelected(new Set());
  }

  function toggleModeInline(id: number) {
    const next = rows.map((x) =>
      x.id === id ? { ...x, mode: (x.mode ?? "live") === "live" ? "tv" : "live" } : x
    );
    onChange(next as unknown as Observation[]);
  }
  function toggleStatusInline(id: number) {
    const next = rows.map((x) =>
      x.id === id ? { ...x, status: x.status === "final" ? "draft" : "final" } : x
    );
    onChange(next as unknown as Observation[]);
  }

  function exportCSV() {
    const headers = ["id", "match", "date", "time", "mode", "status", "bucket", "players"];
    const rowsCsv = filtered.map((r) => [
      r.id, r.match ?? "", r.date ?? "", r.time ?? "",
      r.mode ?? "live", r.status, r.bucket ?? "active", r.players?.length ?? 0,
    ]);
    const csv = [
      headers.join(","),
      ...rowsCsv.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "observations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const headers = ["ID", "Mecz", "Data", "Godzina", "Tryb", "Status", "Kosz", "Zawodnicy"];
    const rowsX = filtered.map((r) => [
      r.id, r.match ?? "", r.date ?? "", r.time ?? "",
      r.mode ?? "live", r.status, r.bucket ?? "active", r.players?.length ?? 0,
    ]);
    const tableHtml =
      `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>` +
      rowsX.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`).join("") +
      `</tbody></table>`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${tableHtml}</body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "observations.xls";
    a.click();
    URL.revokeObjectURL(url);
  }
  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (q.trim()) chips.push({ key: "q", label: `Szukaj: "${q.trim()}"`, clear: () => setQ("") });
    if (matchFilter.trim()) chips.push({ key: "match", label: `Mecz: ${matchFilter.trim()}`, clear: () => setMatchFilter("") });
    if (modeFilter) chips.push({ key: "mode", label: `Tryb: ${modeFilter === "live" ? "Live" : "TV"}`, clear: () => setModeFilter("") });
    if (lifecycleFilter) chips.push({ key: "status", label: lifecycleFilter === "final" ? "Finalne" : "Szkice", clear: () => setLifecycleFilter("") });
    if (dateFrom) chips.push({ key: "from", label: `Od: ${fmtDate(dateFrom)}`, clear: () => setDateFrom("") });
    if (dateTo) chips.push({ key: "to", label: `Do: ${fmtDate(dateTo)}`, clear: () => setDateTo("") });
    return chips;
  }, [q, matchFilter, modeFilter, lifecycleFilter, dateFrom, dateTo]);

  const filtersCount =
    (matchFilter ? 1 : 0) +
    (modeFilter ? 1 : 0) +
    (lifecycleFilter ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (q.trim() ? 1 : 0);

  function SortHeader({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <button
        className={
          "flex items-center gap-1 font-medium focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 rounded " +
          (active ? "text-gray-900 dark:text-neutral-100" : "")
        }
        onClick={() => {
          if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          setSortKey(k);
        }}
      >
        {children}
        {active ? (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
      </button>
    );
  }

  /* ===== Counters for tabs ===== */
  const counts = useMemo(() => {
    const withinScope = rows.filter((r) => (r.bucket ?? "active") === scope);
    const all = withinScope.length;
    const draft = withinScope.filter((r) => r.status === "draft").length;
    return { all, draft, final: 0 };
  }, [rows, scope]);

  /* -------- Pagination -------- */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10/20/50

  useEffect(() => {
    setPage(1);
  }, [scope, tab, q, matchFilter, modeFilter, lifecycleFilter, dateFrom, dateTo, sortKey, sortDir]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pageRows = filtered.slice(startIdx, endIdx);

  function gotoPrev() { setPage((p) => Math.max(1, p - 1)); }
  function gotoNext() { setPage((p) => Math.min(totalPages, p + 1)); }

  // Early return for editor
  if (pageMode === "editor" && editing) {
    return (
      <ObservationEditor
        initial={toEditorXO(editing)}
        onSave={(editorObj) => {
          const nextListRow = fromEditorXO(editorObj, editing ?? undefined);
          save(nextListRow);
        }}
        onClose={() => {
          setPageMode("list");
          setEditing(null);
        }}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="w-full">
        <Crumb items={[{ label: "Start", href: "/" }, { label: "Obserwacje" }]} />

        {/* TOOLBAR */}
        <Toolbar
          title="Obserwacje"
          right={
            // Mobile-first: buttons first row, search below; on ≥sm inline again.
            <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3">
              {/* LEFT CLUSTER (filters + columns) */}
              <div className="order-1 flex min-w-0 items-center gap-2 sm:gap-3">
                {/* Tabs inline with title on desktop; hidden on mobile */}
                <div className="hidden shrink-0 sm:inline-flex rounded-lg bg-gray-50 p-1 shadow-sm dark:bg-neutral-900">
                  {[
                    { key: "active", label: "Aktywne obserwacje", count: counts.all },
                    { key: "draft", label: "Szkice", count: counts.draft },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key as TabKey)}
                      className={`px-3 py-2 text-sm rounded transition data-[active=true]:bg-white data-[active=true]:shadow dark:data-[active=true]:bg-neutral-800 ${
                        tab === (t.key as TabKey) ? "bg-white shadow dark:bg-neutral-800" : ""
                      }`}
                      data-active={tab === (t.key as TabKey)}
                    >
                      <span className="inline-flex items-center gap-2">
                        {t.label}
                        <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {t.count}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                {/* Filters button */}
                <div className="relative shrink-0">
                  <Button
                    ref={filtersBtnRef}
                    size="sm"
                    variant="outline"
                    className="h-10 border-gray-300 px-3 py-2 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                    onClick={() => {
                      setFiltersOpen((v) => !v);
                      setColsOpen(false);
                      setMoreOpen(false);
                    }}
                    aria-pressed={filtersOpen}
                  >
                    <ListFilter className="mr-0 md:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">
                      Filtry{filtersCount ? ` (${filtersCount})` : ""}
                    </span>
                  </Button>

                  {/* FILTRY PANEL */}
                  {filtersOpen &&
                    (isMobile ? (
                      <Portal>
                        <div
                          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
                          onClick={() => setFiltersOpen(false)}
                          aria-hidden
                        />
                        <div
                          className="fixed inset-x-0 bottom-0 z-[210] max-h[80vh] max-h-[80vh] overflow-auto rounded-t-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
                          role="dialog"
                          aria-modal="true"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-semibold">Filtry</div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-gray-300 dark:border-neutral-700"
                              onClick={() => setFiltersOpen(false)}
                            >
                              Zamknij
                            </Button>
                          </div>

                          <div className="mb-3">
                            <Label className="text-xs">Mecz (kto vs kto)</Label>
                            <Input
                              value={matchFilter}
                              onChange={(e) => setMatchFilter(e.target.value)}
                              className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Data od</Label>
                              <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Data do</Label>
                              <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                              />
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Tryb</Label>
                              <select
                                value={modeFilter}
                                onChange={(e) => setModeFilter(e.target.value as Mode | "")}
                                className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                              >
                                <option value="">— dowolny —</option>
                                <option value="live">Live</option>
                                <option value="tv">TV</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs">Status</Label>
                              <select
                                value={lifecycleFilter}
                                onChange={(e) =>
                                  setLifecycleFilter(e.target.value as Observation["status"] | "")
                                }
                                className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                              >
                                <option value="">— dowolny —</option>
                                <option value="draft">Szkic</option>
                                <option value="final">Finalna</option>
                              </select>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between">
                            <Button
                              variant="outline"
                              className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                              onClick={() => {
                                setMatchFilter("");
                                setModeFilter("");
                                setLifecycleFilter("");
                                setDateFrom("");
                                setDateTo("");
                                setQ("");
                              }}
                            >
                              Wyczyść
                            </Button>
                            <Button
                              className="bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring focus-visible:ring-indigo-500/60"
                              onClick={() => setFiltersOpen(false)}
                            >
                              Zastosuj
                            </Button>
                          </div>
                        </div>
                      </Portal>
                    ) : (
                      <AnchoredPopover
                        anchorRef={filtersBtnRef as any}
                        open={filtersOpen}
                        onClose={() => setFiltersOpen(false)}
                        width={352}
                        className="rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                      >
                        <div className="mb-3">
                          <Label className="text-xs">Mecz (kto vs kto)</Label>
                          <Input
                            value={matchFilter}
                            onChange={(e) => setMatchFilter(e.target.value)}
                            className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Data od</Label>
                            <Input
                              type="date"
                              value={dateFrom}
                              onChange={(e) => setDateFrom(e.target.value)}
                              className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Data do</Label>
                            <Input
                              type="date"
                              value={dateTo}
                              onChange={(e) => setDateTo(e.target.value)}
                              className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Tryb</Label>
                            <select
                              value={modeFilter}
                              onChange={(e) => setModeFilter(e.target.value as Mode | "")}
                              className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                            >
                              <option value="">— dowolny —</option>
                              <option value="live">Live</option>
                              <option value="tv">TV</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">Status</Label>
                            <select
                              value={lifecycleFilter}
                              onChange={(e) =>
                                setLifecycleFilter(e.target.value as Observation["status"] | "")
                              }
                              className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                            >
                              <option value="">— dowolny —</option>
                              <option value="draft">Szkic</option>
                              <option value="final">Finalna</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between">
                          <Button
                            variant="outline"
                            className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                            onClick={() => {
                              setMatchFilter("");
                              setModeFilter("");
                              setLifecycleFilter("");
                              setDateFrom("");
                              setDateTo("");
                              setQ("");
                            }}
                          >
                            Wyczyść
                          </Button>
                          <Button
                            className="bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring focus-visible:ring-indigo-500/60"
                            onClick={() => setFiltersOpen(false)}
                          >
                            Zastosuj
                          </Button>
                        </div>
                      </AnchoredPopover>
                    ))}
                </div>

                {/* columns (fixed) */}
                <ColumnsButton
                  isMobile={isMobile}
                  open={colsOpen}
                  setOpen={(v) => {
                    setColsOpen(v);
                    if (v) {
                      setFiltersOpen(false);
                      setMoreOpen(false);
                    }
                  }}
                  visibleCols={visibleCols}
                  setVisibleCols={setVisibleCols}
                />
              </div>

              {/* RIGHT ACTIONS (Add + More) */}
              <div className="order-1 ml-auto flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  className="h-10 bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring focus-visible:ring-indigo-500/60"
                  onClick={addNew}
                  title="Skrót: N"
                >
                  <PlusCircle className="mr-0 md:mr-2 h-4 w-4" />{" "}
                  <span className="hidden sm:inline">Dodaj</span>
                </Button>

                <Button
                  ref={moreBtnRef}
                  variant="outline"
                  className="h-10 w-10 border-gray-300 p-0 dark:border-neutral-700"
                  onClick={() => {
                    setMoreOpen((o) => (o ? false : true));
                    setFiltersOpen(false);
                    setColsOpen(false);
                  }}
                  aria-label="Więcej"
                  aria-pressed={moreOpen}
                >
                  <EllipsisVertical className="h-5 w-5" />
                </Button>
              </div>

              {/* SEARCH — full-width on mobile, inline on ≥sm */}
              <div className="order-2 w-full sm:order-none sm:w-auto sm:flex-none">
                <div className="relative w-full sm:w-56 md:w-64">
                  <Input
                    ref={searchRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Szukaj po meczu lub zawodnikach… (/)"
                    className="w-full"
                    aria-label="Szukaj w obserwacjach"
                  />
                </div>
              </div>

              {/* MORE MENU PANELS */}
              {moreOpen &&
                (isMobile ? (
                  <Portal>
                    <div
                      className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
                      onClick={() => setMoreOpen(false)}
                      aria-hidden
                    />
                    <div
                      className="fixed inset-x-0 bottom-0 z-[210] max-h-[75vh] overflow-auto rounded-t-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
                      role="dialog"
                      aria-modal="true"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="mb-1 flex items-center justify-between px-1">
                        <div className="text-sm font-semibold">Więcej</div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-300 dark:border-neutral-700"
                          onClick={() => setMoreOpen(false)}
                        >
                          Zamknij
                        </Button>
                      </div>

                      <div className="divide-y divide-gray-100 rounded border border-gray-200 dark:divide-neutral-800 dark:border-neutral-800">
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                          onClick={() => {
                            setScope("active");
                            setMoreOpen(false);
                          }}
                        >
                          <Users className="h-4 w-4" /> Aktywni
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                          onClick={() => {
                            setScope("trash");
                            setMoreOpen(false);
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> Kosz
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                          onClick={() => {
                            setMoreOpen(false);
                            exportCSV();
                          }}
                        >
                          <FileDown className="h-4 w-4" /> Eksport CSV
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                          onClick={() => {
                            setMoreOpen(false);
                            exportExcel();
                          }}
                        >
                          <FileSpreadsheet className="h-4 w-4" /> Eksport Excel
                        </button>
                      </div>
                    </div>
                  </Portal>
                ) : (
                  <AnchoredPopover
                    anchorRef={moreBtnRef as any}
                    open={moreOpen}
                    onClose={() => setMoreOpen(false)}
                    width={224}
                    className="overflow-hidden rounded border border-gray-200 bg-white p-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-900"
                      onClick={() => {
                        setScope("active");
                        setMoreOpen(false);
                      }}
                    >
                      <Users className="h-4 w-4" /> Aktywni
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-900"
                      onClick={() => {
                        setScope("trash");
                        setMoreOpen(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Kosz
                    </button>
                    <div className="my-1 h-px bg-gray-200 dark:bg-neutral-800" />
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-900"
                      onClick={() => {
                        setMoreOpen(false);
                        exportCSV();
                      }}
                    >
                      <FileDown className="h-4 w-4" /> Eksport CSV
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-900"
                      onClick={() => {
                        setMoreOpen(false);
                        exportExcel();
                      }}
                    >
                      <FileSpreadsheet className="h-4 w-4" /> Eksport Excel
                    </button>
                  </AnchoredPopover>
                ))}
            </div>
          }
        />

        {/* Tabs (mobile only) */}
        <div className="mt-3 flex flex-col items-stretch gap-2 sm:hidden">
          <div className="inline-flex rounded-lg bg-gray-50 p-1 shadow-sm dark:bg-neutral-900">
            {[
              { key: "active", label: "Aktywne obserwacje", count: counts.all },
              { key: "draft", label: "Szkice", count: counts.draft },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as TabKey)}
                className={`px-3 py-2 text-sm rounded transition data-[active=true]:bg-white data-[active=true]:shadow dark:data-[active=true]:bg-neutral-800 ${
                  tab === (t.key as TabKey) ? "bg-white shadow dark:bg-neutral-800" : ""
                }`}
                data-active={tab === (t.key as TabKey)}
              >
                <span className="inline-flex items-center gap-2">
                  {t.label}
                  <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {t.count}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeChips.map((c) => (
              <button
                key={c.key}
                onClick={c.clear}
                className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-900"
                title="Wyczyść filtr"
              >
                <X className="h-3 w-3" />
                {c.label}
              </button>
            ))}
            <button
              onClick={() => {
                setMatchFilter("");
                setModeFilter("");
                setLifecycleFilter("");
                setDateFrom("");
                setDateTo("");
                setQ("");
              }}
              className="ml-1 inline-flex items-center gap-1 rounded bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
              title="Wyczyść wszystkie filtry"
            >
              Wyczyść wszystkie
            </button>
          </div>
        )}

        {/* TABLE CARD */}
        <div
          ref={tableWrapRef}
          className="
            mt-3 w-full overflow-x-auto rounded border border-gray-200 bg-white p-0 shadow-sm
            dark:border-neutral-700 dark:bg-neutral-950
          "
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                {visibleCols.select && (
                  <th className="w-10 p-2 text-left font-medium sm:p-3">
                    <Checkbox
                      aria-label="Zaznacz wszystkie"
                      checked={
                        filtered.length === 0
                          ? false
                          : allChecked
                          ? true
                          : (someChecked ? ("indeterminate" as any) : false)
                      }
                      onCheckedChange={(v) => {
                        if (Boolean(v)) setSelected(new Set(filtered.map((r) => r.id)));
                        else setSelected(new Set());
                      }}
                    />
                  </th>
                )}
                {visibleCols.match && (
                  <th className="p-2 text-left sm:p-3">
                    <SortHeader k="match">Mecz</SortHeader>
                  </th>
                )}
                {visibleCols.date && (
                  <th className="hidden p-2 text-left sm:table-cell sm:p-3">
                    <SortHeader k="date">Data</SortHeader>
                  </th>
                )}
                {visibleCols.time && (
                  <th className="hidden p-2 text-left sm:table-cell sm:p-3">
                    <SortHeader k="time">Godzina</SortHeader>
                  </th>
                )}
                {visibleCols.mode && (
                  <th className="hidden p-2 text-left sm:table-cell sm:p-3">
                    <SortHeader k="mode">Tryb</SortHeader>
                  </th>
                )}
                {visibleCols.status && (
                  <th className="p-2 text-left sm:p-3">
                    <SortHeader k="status">Status</SortHeader>
                  </th>
                )}
                {visibleCols.players && (
                  <th className="hidden p-2 text-left sm:table-cell sm:p-3">
                    <SortHeader k="players">Zawodnicy</SortHeader>
                  </th>
                )}
                {visibleCols.actions && (
                  <th className="p-2 text-right font-medium sm:p-3">Akcje</th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => {
                const status = r.status;
                const mode = r.mode ?? "live";
                const pCount = r.players?.length ?? 0;

                return (
                  <tr
                    key={r.id}
                    className={`group h-12 border-t transition-colors duration-150
                                ${idx % 2 === 1 ? "bg-gray-50/40 dark:bg-neutral-900/30" : "bg-transparent"}
                                border-gray-200 hover:bg-gray-50/70 dark:border-neutral-800 dark:hover:bg-neutral-900/60`}
                  >
                    {visibleCols.select && (
                      <td className="p-2 sm:p-3">
                        <Checkbox
                          aria-label={`Zaznacz obserwację #${r.id}`}
                          checked={selected.has(r.id)}
                          onCheckedChange={(v) => {
                            const copy = new Set(selected);
                            if (Boolean(v)) copy.add(r.id);
                            else copy.delete(r.id);
                            setSelected(copy);
                          }}
                        />
                      </td>
                    )}

                    {visibleCols.match && (
                      <td className="p-2 sm:p-3 align-top">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900 dark:text-neutral-100">
                            {r.match || "—"}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-neutral-400">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {fmtDate(r.date)} {r.time || "—"}
                            </span>
                            <span
                              title="Tryb"
                              className={`inline-flex items-center rounded px-2 py-0.5 font-medium ${
                                mode === "live"
                                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                  : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                              }`}
                            >
                              {mode === "live" ? "Live" : "TV"}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  title="Status"
                                  className={`inline-flex cursor-default items-center rounded px-2 py-0.5 font-medium ${
                                    status === "final"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                  }`}
                                >
                                  {status === "final" ? "Finalna" : "Szkic"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Kliknij ikonę w kolumnie „Status”, aby przełączyć.
                              </TooltipContent>
                            </Tooltip>
                            {pCount > 0 && (
                              <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                                {pCount} zawodn.
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    )}

                    {visibleCols.date && (
                      <td className="hidden p-2 sm:table-cell sm:p-3 align-top">{fmtDate(r.date)}</td>
                    )}
                    {visibleCols.time && (
                      <td className="hidden p-2 sm:table-cell sm:p-3 align-top">{r.time || "—"}</td>
                    )}

                    {visibleCols.mode && (
                      <td className="hidden p-2 sm:table-cell sm:p-3 align-top">
                        <button
                          onClick={() => toggleModeInline(r.id)}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 ${
                            mode === "live"
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-violet-600 text-white hover:bg-violet-700"
                          }`}
                          title="Przełącz Live/TV"
                          aria-pressed={mode === "live"}
                        >
                          {mode === "live" ? (
                            <PlayCircle className="h-3.5 w-3.5" />
                          ) : (
                            <Monitor className="h-3.5 w-3.5" />
                          )}
                          {mode === "live" ? "Live" : "TV"}
                        </button>
                      </td>
                    )}

                    {visibleCols.status && (
                      <td className="p-2 sm:p-3 align-top">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => toggleStatusInline(r.id)}
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition hover:scale-[1.02] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 ${
                                status === "final"
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : "bg-amber-600 text-white hover:bg-amber-700"
                              }`}
                              title="Przełącz Szkic/Finalna"
                              aria-pressed={status === "final"}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {status === "final" ? "Finalna" : "Szkic"}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Przełącz status</TooltipContent>
                        </Tooltip>
                      </td>
                    )}

                    {visibleCols.players && (
                      <td className="hidden p-2 sm:table-cell sm:p-3 align-top">
                        <GrayTag>{pCount}</GrayTag>
                      </td>
                    )}

                    {visibleCols.actions && (
                      <td className="p-2 text-right sm:p-3 align-top">
                        <div className="inline-flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-9 w-9 border-gray-300 p-0 transition hover:scale-105 hover:border-gray-400 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                                onClick={() => {
                                  setEditing(r);
                                  setPageMode("editor");
                                }}
                                aria-label="Edytuj"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Edytuj</TooltipContent>
                          </Tooltip>

                          {(r.bucket ?? "active") === "active" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 border-gray-300 p-0 text-rose-600 transition hover:scale-105 hover:border-gray-400 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                                  onClick={() => moveToTrash(r.id)}
                                  aria-label="Przenieś do kosza"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Przenieś do kosza</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-9 w-9 border-gray-300 p-0 text-emerald-600 transition hover:scale-105 hover:border-gray-400 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                                  onClick={() => restoreFromTrash(r.id)}
                                  aria-label="Przywróć z kosza"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Przywróć z kosza</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={Object.values(visibleCols).filter(Boolean).length || 1}
                    className="p-3 text-center text-sm text-dark dark:text-neutral-400"
                  >
                    Brak wyników dla bieżących filtrów.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Mobile scroll hint overlay */}
          {showScrollHint && (
            <div className="pointer-events-none sm:hidden">
              <div className="absolute bottom-2 right-2 z-20 inline-flex items-center gap-2 rounded bg-gray-900/90 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur">
                <span>Przeciągnij w bok</span>
                <MoveHorizontal className="h-4 w-4" />
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white dark:from-neutral-950" />
            </div>
          )}
        </div>

{/* Pagination footer — compact, 1-row on mobile */}
<div className="mt-3 flex flex-row flex-wrap items-center justify-between gap-2 rounded bg-white p-2 text-sm shadow-sm dark:bg-neutral-950">
  {/* Left: page size + range */}
  <div className="flex flex-row flex-wrap items-center gap-2">
    <span className="text-dark dark:text-neutral-300">Wiersze na stronę:</span>
    <select
      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm leading-none dark:border-neutral-700 dark:bg-neutral-900"
      value={pageSize}
      onChange={(e) => {
        const n = Number(e.target.value) || 10;
        setPageSize(n);
        setPage(1);
      }}
      aria-label="Liczba wierszy na stronę"
    >
      {[10, 20, 50].map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>

    <span className="ml-2 text-dark dark:text-neutral-300 leading-none">
      {totalItems === 0 ? "0" : `${startIdx + 1}–${endIdx} z ${totalItems}`}
    </span>
  </div>

  {/* Right: pager (compact buttons, icon sized to font) */}
  <div className="flex flex-row flex-wrap items-center gap-2">
    <Button
      variant="outline"
      className="h-auto px-2 py-1 leading-none border-gray-300 dark:border-neutral-700"
      disabled={page <= 1}
      onClick={gotoPrev}
      aria-label="Poprzednia strona"
      title="Poprzednia strona"
    >
      <ChevronLeft className="h-[1.1em] w-[1.1em]" />
    </Button>

    <div className="min-w-[80px] text-center leading-none">
      Strona {page} / {totalPages}
    </div>

    <Button
      variant="outline"
      className="h-auto px-2 py-1 leading-none border-gray-300 dark:border-neutral-700"
      disabled={page >= totalPages}
      onClick={gotoNext}
      aria-label="Następna strona"
      title="Następna strona"
    >
      <ChevronRight className="h-[1.1em] w-[1.1em]" />
    </Button>
  </div>
</div>

      </div>

      {/* Floating selection pill (center-bottom) */}
      {selected.size > 0 && (
        <Portal>
          <div className="fixed left-1/2 bottom-4 z-[240] -translate-x-1/2">
            <div className="inline-flex items-center gap-2 rounded border border-gray-200 bg-white/90 px-2 py-1 shadow-xl backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/85">
              {/* Clear selection */}
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:hover:bg-neutral-800"
                onClick={() => setSelected(new Set())}
                aria-label="Wyczyść zaznaczenie"
                title="Wyczyść zaznaczenie"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Count badge */}
              <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded bg-gray-900 px-2 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                {selected.size}
              </span>

              <span className="hidden sm:inline text-sm text-gray-800 dark:text-neutral-100">
                zaznaczone
              </span>

              {/* Divider */}
              <span className="mx-1 h-6 w-px bg-gray-200 dark:bg-neutral-800" />

              {/* Scope-aware action */}
              {rows.some(r => selected.has(r.id) && (r.bucket ?? "active") === "active") && scope === "active" ? (
                <Button
                  className="h-8 w-8 rounded bg-rose-600 p-0 text-white hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500/60"
                  onClick={bulkTrash}
                  aria-label="Przenieś do kosza"
                  title="Przenieś do kosza"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="h-8 w-8 rounded bg-emerald-600 p-0 text-white hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                  onClick={bulkRestore}
                  aria-label="Przywróć"
                  title="Przywróć"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Portal>
      )}
    </TooltipProvider>
  );
}

/* ========================= Columns popover ========================= */

function ColumnsButton({
  isMobile,
  open,
  setOpen,
  visibleCols,
  setVisibleCols,
}: {
  isMobile: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  visibleCols: Record<keyof typeof DEFAULT_COLS, boolean>;
  setVisibleCols: (v: Record<keyof typeof DEFAULT_COLS, boolean>) => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="relative shrink-0">
      <Button
        ref={btnRef as any}
        size="sm"
        variant="outline"
        className="h-10 border-gray-300 px-3 py-2 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
        onClick={() => setOpen(!open)}
        title="Widoczność kolumn"
        aria-label="Widoczność kolumn"
        aria-pressed={open}
      >
        <ColumnsIcon className="h-4 w-4" />
        <span className="ml-2 hidden sm:inline">Kolumny</span>
      </Button>

      {open &&
        (isMobile ? (
          <Portal>
            <div
              className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              className="fixed inset-x-0 bottom-0 z-[210] max-h-[75vh] overflow-auto rounded-t-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">Kolumny</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-300 dark:border-neutral-700"
                  onClick={() => setOpen(false)}
                >
                  Zamknij
                </Button>
              </div>

              {Object.keys(DEFAULT_COLS).map((k) => {
                const key = k as keyof typeof DEFAULT_COLS;
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    <span className="text-gray-800 dark:text-neutral-100">
                      {COL_PL[key]}
                    </span>
                    <Checkbox
                      checked={visibleCols[key]}
                      onCheckedChange={(v) =>
                        setVisibleCols({ ...visibleCols, [key]: Boolean(v) })
                      }
                    />
                  </label>
                );
              })}
            </div>
          </Portal>
        ) : (
          <AnchoredPopover
            anchorRef={btnRef as any}
            open={open}
            onClose={() => setOpen(false)}
            width={288}
            className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div className="mb-2 text-xs font-medium text-dark dark:text-neutral-400">
              Widoczność kolumn
            </div>
            {Object.keys(DEFAULT_COLS).map((k) => {
              const key = k as keyof typeof DEFAULT_COLS;
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
                >
                  <span className="text-gray-800 dark:text-neutral-100">
                    {COL_PL[key]}
                  </span>
                  <Checkbox
                    checked={visibleCols[key]}
                    onCheckedChange={(v) =>
                      setVisibleCols({ ...visibleCols, [key]: Boolean(v) })
                    }
                  />
                </label>
              );
            })}
          </AnchoredPopover>
        ))}
    </div>
  );
}
