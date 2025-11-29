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
  XCircle, // NEW
} from "lucide-react";
import { ObservationEditor } from "./ObservationEditor";
import type { XO as EditorXO } from "./ObservationEditor";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { AddObservationIcon } from "@/components/icons";

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
  status: true, // używamy tego klucza dla kolumny „Liga”
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
  status: "Liga", // etykieta dla kolumny z competition
  players: "Zawodnicy",
  actions: "Akcje",
};

type SortKey = "match" | "date" | "time" | "mode" | "status" | "players";
type SortDir = "asc" | "desc";

const UI_KEY = "s4s.observations.ui";
const SEED_FLAG = "s4s.observations.demoSeeded";
const HINT_DISMISS_KEY = "s4s.observations.scrollHintDismissed";

/* shared layout tokens (align with MyPlayersFeature) */
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
    id: row.id,
    reportDate: row.date || "",
    competition: row.competition ?? "", // <- Liga / turniej do edytora
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
    competition: anyE.competition ?? prev?.competition ?? null, // <- Liga / turniej z edytora
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
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Filters + state
  const [scope, setScope] = useState<Bucket>("active");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false); // now opened from 3-dots
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

  // MASS SELECTION
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // --- NEW: transient inline status note (zostawione, choć kolumna statusu to teraz liga) ---
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

  // --- NEW: inline confirm for move-to-trash ---
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
    } catch {}
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
    } catch {}
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
            // sort key „status” używamy teraz do sortowania po lidze (competition)
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
      competition: null, // nowa obserwacja bez ligi
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

  // Bulk actions
  function bulkTrash() {
    const ids = selected;
    if (ids.size === 0) return;
    const next = rows.map((x) =>
      ids.has(x.id as number) ? { ...x, bucket: "trash" as Bucket } : x
    );
    onChange(next as unknown as Observation[]);
    setSelected(new Set());
  }
  function bulkRestore() {
    const ids = selected;
    if (ids.size === 0) return;
    const next = rows.map((x) =>
      ids.has(x.id as number) ? { ...x, bucket: "active" as Bucket } : x
    );
    onChange(next as unknown as Observation[]);
    setSelected(new Set());
  }

  function toggleModeInline(id: number) {
    const next = rows.map((x) =>
      x.id === id
        ? { ...x, mode: (x.mode ?? "live") === "live" ? "tv" : "live" }
        : x
    );
    onChange(next as unknown as Observation[]);
  }

  // (pozostawione – jeśli będziesz znów mieć kolumnę statusu)
  function toggleStatusInline(id: number) {
    let nextStatusForNote: Observation["status"] = "draft";
    const next = rows.map((x) => {
      if (x.id !== id) return x;
      const nextStatus = x.status === "final" ? "draft" : "final";
      nextStatusForNote = nextStatus;
      return { ...x, status: nextStatus };
    });
    onChange(next as unknown as Observation[]);
    flashStatus(id, nextStatusForNote);
  }

  function exportCSV() {
    const headers = [
      "id",
      "match",
      "date",
      "time",
      "mode",
      "competition", // Liga
      "bucket",
      "players",
    ];
    const rowsCsv = filtered.map((r) => [
      r.id,
      r.match ?? "",
      r.date ?? "",
      r.time ?? "",
      r.mode ?? "live",
      r.competition ?? "", // Liga
      r.bucket ?? "active",
      r.players?.length ?? 0,
    ]);
    const csv = [
      headers.join(","),
      ...rowsCsv.map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      ),
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
    const headers = [
      "ID",
      "Mecz",
      "Data",
      "Godzina",
      "Tryb",
      "Liga", // nagłówek w XLS
      "Kosz",
      "Zawodnicy",
    ];
    const rowsX = filtered.map((r) => [
      r.id,
      r.match ?? "",
      r.date ?? "",
      r.time ?? "",
      r.mode ?? "live",
      r.competition ?? "", // Liga
      r.bucket ?? "active",
      r.players?.length ?? 0,
    ]);
    const tableHtml =
      `<table><thead><tr>${headers
        .map((h) => `<th>${escapeHtml(h)}</th>`)
        .join("")}</tr></thead><tbody>` +
      rowsX
        .map(
          (r) =>
            `<tr>${r
              .map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`)
              .join("")}</tr>`
        )
        .join("") +
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
    if (q.trim())
      chips.push({
        key: "q",
        label: `Szukaj: “${q.trim()}”`,
        clear: () => setQ(""),
      });
    if (matchFilter.trim())
      chips.push({
        key: "match",
        label: `Mecz: ${matchFilter.trim()}`,
        clear: () => setMatchFilter(""),
      });
    if (modeFilter)
      chips.push({
        key: "mode",
        label: `Tryb: ${modeFilter === "live" ? "Live" : "TV"}`,
        clear: () => setModeFilter(""),
      });
    if (lifecycleFilter)
      chips.push({
        key: "status",
        label: lifecycleFilter === "final" ? "Finalne" : "Szkice",
        clear: () => setLifecycleFilter(""),
      });
    if (dateFrom)
      chips.push({
        key: "from",
        label: `Od: ${fmtDate(dateFrom)}`,
        clear: () => setDateFrom(""),
      });
    if (dateTo)
      chips.push({
        key: "to",
        label: `Do: ${fmtDate(dateTo)}`,
        clear: () => setDateTo(""),
      });
    return chips;
  }, [q, matchFilter, modeFilter, lifecycleFilter, dateFrom, dateTo]);

  const MAX_INLINE_CHIPS = 2;
  const inlineChips = activeChips.slice(0, MAX_INLINE_CHIPS);
  const overflowChips = activeChips.slice(MAX_INLINE_CHIPS);

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
          "flex items-center gap-1 font-medium focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 rounded-md " +
          (active ? "text-gray-900 dark:text-neutral-100" : "")
        }
        onClick={() => {
          if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          setSortKey(k);
        }}
      >
        {children}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : null}
      </button>
    );
  }

  /* ===== NEW: global trash count ===== */
  const trashCount = useMemo(
    () => rows.filter((r) => (r.bucket ?? "active") === "trash").length,
    [rows]
  );

  /* ===== NEW: empty trash ===== */
  function emptyTrash() {
    const trashIds = rows
      .filter((r) => (r.bucket ?? "active") === "trash")
      .map((r) => r.id);

    if (trashIds.length === 0) return;

    const next = rows.filter((r) => (r.bucket ?? "active") !== "trash");
    onChange(next as unknown as Observation[]);

    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const copy = new Set(prev);
      rows.forEach((r) => {
        if ((r.bucket ?? "active") === "trash") {
          copy.delete(r.id as number);
        }
      });
      return copy;
    });
  }

  /* ===== Infinite scroll: reset visibleCount on filters/sort change ===== */
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [
    scope,
    q,
    matchFilter,
    modeFilter,
    lifecycleFilter,
    dateFrom,
    dateTo,
    sortKey,
    sortDir,
    rows,
  ]);

  /* ===== Visible rows slice ===== */
  const visibleRows = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  /* ===== Infinite scroll observer ===== */
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    if (visibleCount >= filtered.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;
        setVisibleCount((prev) =>
          Math.min(prev + STEP_VISIBLE, filtered.length)
        );
      },
      {
        root: null,
        rootMargin: "160px 0px 0px 0px",
        threshold: 0.1,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length]);

  // CHIP atom (desktop height = h-9)
  const Chip = ({ label, onClear }: { label: string; onClear: () => void }) => (
    <span className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white/90 px-2 text-[12px] font-medium text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-200">
      <span className="max-w-[200px] truncate">{label}</span>
      <button
        className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
        onClick={onClear}
        aria-label="Wyczyść filtr"
        title="Wyczyść filtr"
      >
        <X className="h-4 w-4" />
      </button>
    </span>
  );

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
        {/* TOOLBAR */}
        <Toolbar
          title={
            <div className="flex items-start gap-3 w-full min-h-9">
              {/* Left: Title */}
              <span className="font-semibold text-xl md:text-2xl shrink-0 leading-none h-9 flex items-center">
                Obserwacje
              </span>

              {/* Center: Active filter chips (desktop) */}
              <div className="hidden md:flex flex-1 items-start justify-center h-9">
                <div className="flex items-center gap-1 h-9">
                  {inlineChips.map((c) => (
                    <Chip key={c.key} label={c.label} onClear={c.clear} />
                  ))}

                  {overflowChips.length > 0 && (
                    <>
                      <button
                        ref={chipsMoreBtnRef}
                        type="button"
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-gray-200 bg-white/90 px-2 text-[12px] font-medium text-gray-800 shadow-sm hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100"
                        onClick={() => setChipsOpen((v) => !v)}
                        onMouseEnter={() => {
                          if (chipsHoverTimer.current)
                            window.clearTimeout(chipsHoverTimer.current);
                          setChipsOpen(true);
                        }}
                        onMouseLeave={() => {
                          if (chipsHoverTimer.current)
                            window.clearTimeout(chipsHoverTimer.current);
                          chipsHoverTimer.current = window.setTimeout(
                            () => setChipsOpen(false),
                            160
                          ) as unknown as number;
                        }}
                        aria-expanded={chipsOpen}
                        title="Pokaż więcej filtrów"
                      >
                        <ChevronRightIcon className="h-4 w-4" />
                        +{overflowChips.length}
                      </button>

                      <AnchoredPopover
                        anchorRef={chipsMoreBtnRef as any}
                        open={chipsOpen}
                        onClose={() => setChipsOpen(false)}
                        width={360}
                        className="z-[210] overflow-hidden rounded-md border border-gray-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
                      >
                        <div
                          className="w-full p-1"
                          onMouseEnter={() => {
                            if (chipsHoverTimer.current)
                              window.clearTimeout(chipsHoverTimer.current);
                            setChipsOpen(true);
                          }}
                          onMouseLeave={() => {
                            if (chipsHoverTimer.current)
                              window.clearTimeout(chipsHoverTimer.current);
                            chipsHoverTimer.current = window.setTimeout(
                              () => setChipsOpen(false),
                              150
                            ) as unknown as number;
                          }}
                        >
                          <div className="mb-1 px-1 text-[11px] font-semibold text-gray-700 dark:text-neutral-200">
                            Aktywne filtry
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {overflowChips.map((c) => (
                              <Chip
                                key={c.key}
                                label={c.label}
                                onClear={c.clear}
                              />
                            ))}
                          </div>
                        </div>
                      </AnchoredPopover>
                    </>
                  )}
                </div>
              </div>
            </div>
          }
          right={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                {/* PRIMARY: Dodaj obserwację – mobile: full width, desktop: auto */}
                <Button
                  type="button"
                  onClick={addNew}
                  className={`${controlH} secondary inline-flex h-9 w-full shrink-0 items-center justify-center rounded-md bg-gray-900 px-3.5 text-sm font-semibold text-white hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 sm:w-auto`}
                >
                  <AddObservationIcon className="mr-2 h-4 w-4" />
                  Dodaj obserwację
                </Button>

                {/* Row: Search + Filtry + 3 dots – ALWAYS single row on mobile */}
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:justify-start sm:gap-3">
                  {/* Search */}
                  <div className="relative h-9 min-w-[160px] flex-1 sm:w-72 sm:flex-none">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <Input
                      ref={searchRef}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Szukaj po meczu lub zawodnikach… (/) "
                      className={`${controlH} w-full pl-8 pr-3 text-sm`}
                      aria-label="Szukaj w obserwacjach"
                    />
                  </div>

                  {/* Filtry */}
                  <div className="relative inline-flex shrink-0">
                    <span
                      className="pointer-events-none absolute -top-2 left-3 rounded-full bg-white px-1.5 text-[10px] font-medium text-stone-500 
             dark:bg-neutral-950 dark:text-neutral-300"
                    >
                      Filtry
                    </span>

                    <Button
                      ref={filtersBtnRef}
                      size="sm"
                      variant="outline"
                      className={`${controlH} h-9 border-gray-300 px-3 py-2 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700`}
                      onClick={() => {
                        setFiltersOpen((v) => !v);
                        setColsOpen(false);
                        setMoreOpen(false);
                      }}
                      aria-pressed={filtersOpen}
                      type="button"
                      title="Filtry"
                    >
                      <ListFilter className="h-4 w-4" />
                      {filtersCount ? (
                        <span className="hidden sm:inline">
                          {` (${filtersCount})`}
                        </span>
                      ) : null}
                    </Button>
                  </div>

                  {/* 3 dots */}
                  <Button
                    ref={moreBtnRef}
                    variant="outline"
                    className={`${controlH} h-9 w-9 shrink-0 border-gray-300 p-0 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700`}
                    onClick={() => {
                      setMoreOpen((o) => !o);
                      setFiltersOpen(false);
                      // colsOpen opened from menu item
                    }}
                    aria-label="Więcej"
                    aria-pressed={moreOpen}
                    type="button"
                  >
                    <EllipsisVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          }
        />

        {/* Mobile: active filter chips below header */}
        {activeChips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1 md:hidden">
            {activeChips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-neutral-700 dark:bg-neutral-900"
              >
                <span className="max-w-[120px] truncate">{c.label}</span>
                <button
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
                  onClick={c.clear}
                  aria-label="Wyczyść filtr"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
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
              className="ml-1 inline-flex items-center gap-1 rounded-md bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700"
              title="Wyczyść wszystkie filtry"
              type="button"
            >
              Wyczyść wszystkie
            </button>
          </div>
        )}

        {/* FILTERS PANEL(s) */}
        {filtersOpen &&
          (isMobile ? (
            <Portal>
              <div
                className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
                onClick={() => setFiltersOpen(false)}
                aria-hidden
              />
              <div
                className="fixed inset-x-0 bottom-0 z-[210] max-h-[80vh] overflow-auto rounded-md-t-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
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
                      onChange={(e) =>
                        setModeFilter(e.target.value as Mode | "")
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
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
                        setLifecycleFilter(
                          e.target.value as Observation["status"] | ""
                        )
                      }
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                    >
                      <option value="">— dowolny —</option>
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
              open={true}
              onClose={() => setFiltersOpen(false)}
              width={352}
              className="rounded-md border border-gray-200 bg-white p-4 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
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
                    onChange={(e) =>
                      setModeFilter(e.target.value as Mode | "")
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
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
                      setLifecycleFilter(
                        e.target.value as Observation["status"] | ""
                      )
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
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

        {/* MORE MENU (includes Kolumny) */}
        {moreOpen &&
          (isMobile ? (
            <Portal>
              <div
                className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
                onClick={() => setMoreOpen(false)}
                aria-hidden
              />
              <div
                className="fixed inset-x-0 bottom-0 z-[210] max-h-[75vh] overflow-auto rounded-md-t-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-1 flex items-center justify-between px-1 gap-2">
                  <div className="text-sm font-semibold">Więcej</div>
                  <div className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-200">
                    W koszu: {trashCount}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300 dark:border-neutral-700"
                    onClick={() => setMoreOpen(false)}
                  >
                    Zamknij
                  </Button>
                </div>

                <div className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-neutral-800 dark:border-neutral-800">
                  {/* Kolumny (mobile -> own sheet) */}
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                    onClick={() => {
                      setMoreOpen(false);
                      setColsOpen(true);
                    }}
                  >
                    <ColumnsIcon className="h-4 w-4" /> Kolumny
                  </button>

                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                    onClick={() => {
                      setScope("active");
                      setMoreOpen(false);
                    }}
                  >
                    <Users className="h-4 w-4" /> Aktywne
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                    onClick={() => {
                      setScope("trash");
                      setMoreOpen(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Kosz</span>
                    <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-200">
                      {trashCount}
                    </span>
                  </button>

                  {trashCount > 0 && (
                    <button
                      className="flex w-full items-center gap-2 bg-rose-50/70 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50"
                      onClick={() => {
                        setMoreOpen(false);
                        emptyTrash();
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Opróżnij kosz</span>
                    </button>
                  )}

                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                    onClick={() => {
                      setMoreOpen(false);
                      exportCSV();
                    }}
                  >
                    <FileDown className="h-4 w-4" /> Eksport CSV
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
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
              open={true}
              onClose={() => setMoreOpen(false)}
              width={248}
              className="overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
            >
              {/* Header with trash count */}
              <div className="flex items-center justify-between px-2 pb-1 pt-1">
                <span className="text-[11px] font-medium text-stone-500 dark:text-neutral-400">
                  Menu
                </span>
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-200">
                  W koszu: {trashCount}
                </span>
              </div>

              {/* Kolumny opens a separate popover anchored to the dots */}
              <button
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  setMoreOpen(false);
                  setColsOpen(true);
                }}
              >
                <ColumnsIcon className="h-4 w-4" /> Kolumny
              </button>

              <div className="my-1 h-px bg-gray-200 dark:bg-neutral-800" />

              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  setScope("active");
                  setMoreOpen(false);
                }}
              >
                <Users className="h-4 w-4" /> Aktywne
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  setScope("trash");
                  setMoreOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span>Kosz</span>
                <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-200">
                  {trashCount}
                </span>
              </button>

              {trashCount > 0 && (
                <button
                  className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                  onClick={() => {
                    setMoreOpen(false);
                    emptyTrash();
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  <span>Opróżnij kosz</span>
                </button>
              )}

              <div className="my-1 h-px bg-gray-200 dark:bg-neutral-800" />

              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  setMoreOpen(false);
                  exportCSV();
                }}
              >
                <FileDown className="h-4 w-4" /> Eksport CSV
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-900"
                onClick={() => {
                  setMoreOpen(false);
                  exportExcel();
                }}
              >
                <FileSpreadsheet className="h-4 w-4" /> Eksport Excel
              </button>
            </AnchoredPopover>
          ))}

        {/* COLUMNS UI (opened from 3-dots) */}
        {colsOpen &&
          (isMobile ? (
            <Portal>
              <div
                className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
                onClick={() => setColsOpen(false)}
                aria-hidden
              />
              <div
                className="fixed inset-x-0 bottom-0 z-[210] max-h-[75vh] overflow-auto rounded-md-t-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
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
                    onClick={() => setColsOpen(false)}
                  >
                    Zamknij
                  </Button>
                </div>

                {Object.keys(DEFAULT_COLS).map((k) => {
                  const key = k as keyof typeof DEFAULT_COLS;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                    >
                      <span className="text-gray-800 dark:text-neutral-100">
                        {COL_PL[key]}
                      </span>
                      <Checkbox
                        checked={visibleCols[key]}
                        onCheckedChange={(v) =>
                          setVisibleCols({
                            ...visibleCols,
                            [key]: Boolean(v),
                          })
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </label>
                  );
                })}
              </div>
            </Portal>
          ) : (
            <AnchoredPopover
              anchorRef={moreBtnRef as any}
              open={true}
              onClose={() => setColsOpen(false)}
              width={288}
              className="rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            >
              <div className="mb-2 text-xs font-medium text-dark dark:text-neutral-400">
                Widoczność kolumn
              </div>
              {Object.keys(DEFAULT_COLS).map((k) => {
                const key = k as keyof typeof DEFAULT_COLS;
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                  >
                    <span className="text-gray-800 dark:text-neutral-100">
                      {COL_PL[key]}
                    </span>
                    <Checkbox
                      checked={visibleCols[key]}
                      onCheckedChange={(v) =>
                        setVisibleCols({
                          ...visibleCols,
                          [key]: Boolean(v),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                );
              })}
            </AnchoredPopover>
          ))}

        {/* TABLE CARD */}
        <div
          ref={tableWrapRef}
          className="
            mt-3 w-full overflow-x-auto rounded-md border border-gray-200 bg-white p-0 shadow-sm
            dark:border-neutral-700 dark:bg-neutral-950
          "
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-stone-100 text-gray-600 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.06)] dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                {visibleCols.select && (
                  <th className={`${cellPad} w-10 text-left font-medium`}>
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
                        if (Boolean(v))
                          setSelected(
                            new Set(filtered.map((r) => r.id as number))
                          );
                        else setSelected(new Set());
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                )}
                {visibleCols.match && (
                  <th className={`${cellPad} text-left`}>
                    <SortHeader k="match">Mecz</SortHeader>
                  </th>
                )}
                {visibleCols.date && (
                  <th className={`${cellPad} hidden text-left sm:table-cell`}>
                    <SortHeader k="date">Data</SortHeader>
                  </th>
                )}
                {visibleCols.time && (
                  <th className={`${cellPad} hidden text-left sm:table-cell`}>
                    <SortHeader k="time">Godzina</SortHeader>
                  </th>
                )}
                {visibleCols.mode && (
                  <th className={`${cellPad} hidden text-left sm:table-cell`}>
                    <SortHeader k="mode">Tryb</SortHeader>
                  </th>
                )}
                {visibleCols.status && (
                  <th className={`${cellPad} text-left`}>
                    <SortHeader k="status">Liga</SortHeader>
                  </th>
                )}
                {visibleCols.players && (
                  <th className={`${cellPad} hidden text-left sm:table-cell`}>
                    <SortHeader k="players">Zawodnicy</SortHeader>
                  </th>
                )}
                {visibleCols.actions && (
                  <th className={`${cellPad} text-right font-medium`}>Akcje</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, idx) => {
                const mode = r.mode ?? "live";
                const pCount = r.players?.length ?? 0;

                return (
                  <tr
                    key={r.id}
                    className={`group border-t transition-colors duration-150 ${rowH} cursor-pointer
                                ${
                                  idx % 2 === 1
                                    ? "bg-stone-100/40 dark:bg-neutral-900/30"
                                    : "bg-transparent"
                                }
                                border-gray-200 hover:bg-stone-100/70 dark:border-neutral-800 dark:hover:bg-neutral-900/60`}
                    onClick={() => {
                      setEditing(r);
                      setPageMode("editor");
                    }}
                  >
                    {visibleCols.select && (
                      <td className={`${cellPad}`}>
                        <Checkbox
                          aria-label={`Zaznacz obserwację #${r.id}`}
                          checked={selected.has(r.id as number)}
                          onCheckedChange={(v) => {
                            const copy = new Set(selected);
                            if (Boolean(v)) copy.add(r.id as number);
                            else copy.delete(r.id as number);
                            setSelected(copy);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}

                    {visibleCols.match && (
                      <td className={`${cellPad} align-center`}>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900 dark:text-neutral-100">
                            {r.match || "—"}
                          </div>
                        </div>
                      </td>
                    )}

                    {visibleCols.date && (
                      <td
                        className={`${cellPad} hidden align-center sm:table-cell`}
                      >
                        {fmtDate(r.date)}
                      </td>
                    )}
                    {visibleCols.time && (
                      <td
                        className={`${cellPad} hidden align-center sm:table-cell`}
                      >
                        {r.time || "—"}
                      </td>
                    )}

                    {visibleCols.mode && (
                      <td
                        className={`${cellPad} hidden align-center sm:table-cell`}
                      >
                        <span className="inline-flex items-center rounded-md bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-800 dark:bg-neutral-800 dark:text-neutral-100">
                          {mode === "live" ? "Live" : "TV"}
                        </span>
                      </td>
                    )}

                    {visibleCols.status && (
                      <td className={`${cellPad} align-center`}>
                        <span className="inline-flex items-center rounded-md bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-800 dark:bg-neutral-800 dark:text-neutral-100">
                          {r.competition || "—"}
                        </span>
                      </td>
                    )}

                    {visibleCols.players && (
                      <td
                        className={`${cellPad} hidden align-center sm:table-cell`}
                      >
                        <span className="inline-flex rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                          {pCount}
                        </span>
                      </td>
                    )}

                    {visibleCols.actions && (
                      <td className={`${cellPad} text-right align-center`}>
                        <div className="inline-flex items-center gap-2">
                          {/* Edycja */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 border-gray-300 p-0 transition hover:scale-105 hover:border-gray-400 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                                onClick={(e) => {
                                  e.stopPropagation();
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

                          {/* Kosz / Przywróć z potwierdzeniem Tak / Nie dla Kosza */}
                          {(r.bucket ?? "active") === "active" ? (
                            confirmTrashId === r.id ? (
                              <div
                                className="inline-flex items-center gap-1 text-sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  size="sm"
                                  className="h-9 px-2 text-xs bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500/60"
                                  onClick={() => moveToTrash(r.id as number)}
                                >
                                  Tak
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 px-2 text-xs border-gray-300 dark:border-neutral-700"
                                  onClick={() => setConfirmTrashId(null)}
                                >
                                  Nie
                                </Button>
                              </div>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-gray-300 p-0 text-rose-600 transition hover:scale-105 hover:border-gray-400 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmTrashId(r.id as number);
                                    }}
                                    aria-label="Przenieś do kosza"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Przenieś do kosza
                                </TooltipContent>
                              </Tooltip>
                            )
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 border-gray-300 p-0 text-emerald-600 transition hover:scale-105 hover:border-gray-400 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    restoreFromTrash(r.id as number);
                                  }}
                                  aria-label="Przywróć z kosza"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Przywróć z kosza
                              </TooltipContent>
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
                    className={`${cellPad} text-center text-sm text-dark dark:text-neutral-400`}
                  >
                    Brak wyników dla bieżących filtrów.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Infinite scroll loader sentinel */}
          {filtered.length > 0 && visibleRows.length < filtered.length && (
            <div
              ref={loadMoreRef}
              className="flex w-full items-center justify-center py-3 text-[11px] text-stone-500 dark:text-neutral-400"
            >
              Ładowanie kolejnych obserwacji…
            </div>
          )}

          {/* Mobile scroll hint */}
          {showScrollHint && (
            <div className="pointer-events-none sm:hidden">
              <div className="absolute bottom-2 right-2 z-20 inline-flex items-center gap-2 rounded-md bg-gray-900/90 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur">
                <span>Przeciągnij w bok</span>
                <MoveHorizontal className="h-4 w-4" />
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white dark:from-neutral-950" />
            </div>
          )}
        </div>
      </div>

      {/* Floating selection pill – aligned with players sizes */}
      {selected.size > 0 && (
        <Portal>
          <div className="fixed left-1/2 bottom-4 z-[240] -translate-x-1/2">
            <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white/90 px-2 py-1 shadow-xl backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/85">
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:hover:bg-neutral-800"
                onClick={() => setSelected(new Set())}
                aria-label="Wyczyść zaznaczenie"
                title="Wyczyść zaznaczenie"
              >
                <X className="h-4 w-4" />
              </button>

              <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md bg-gray-900 px-2 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                {selected.size}
              </span>

              <span className="hidden sm:inline text-sm text-gray-800 dark:text-neutral-100">
                zaznaczone
              </span>

              <span className="mx-1 h-6 w-px bg-gray-200 dark:bg-neutral-800" />

              {rows.some(
                (r) =>
                  selected.has(r.id as number) &&
                  (r.bucket ?? "active") === "active"
              ) && scope === "active" ? (
                <Button
                  className="h-8 w-8 rounded-md bg-rose-600 p-0 text-white hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500/60"
                  onClick={bulkTrash}
                  aria-label="Przenieś do kosza"
                  title="Przenieś do kosza"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="h-8 w-8 rounded-md bg-emerald-600 p-0 text-white hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/60"
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
