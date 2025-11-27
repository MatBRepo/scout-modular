// src/features/players/MyPlayersFeature.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Toolbar } from "@/shared/ui/atoms";
import type { Player, Observation } from "@/shared/types";
import {
  PlusCircle,
  Pencil,
  Undo2,
  Trash2,
  ListFilter,
  ChevronUp,
  ChevronDown,
  Download,
  PlusSquare,
  Search,
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Columns3,
  EllipsisVertical,
  Users,
  FileDown,
  FileSpreadsheet,
  FileEdit,
  Tv,
  Radio,
  Eraser,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { AddPlayerIcon, PlayerOnlyTshirt } from "@/components/icons";
import { supabase } from "@/shared/supabase-client";
import { computePlayerProfileProgress } from "@/shared/playerProfileProgress";

/* ====== helpers: mobile detection + portal ====== */
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
  useEffect(() => setEl(document.getElementById("portal-root")), []);
  return el ? createPortal(children, el) : null;
}
function MobileSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <Portal>
      {/* overlay */}
      <div
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-0 bottom-0 z-[210] max-h-[80vh] overflow-auto rounded-md-t-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-300 dark:border-neutral-700"
            onClick={onClose}
          >
            Zamknij
          </Button>
        </div>
        {children}
      </div>
    </Portal>
  );
}

/* ================= Anchored popover (desktop) ================= */
type AnchorAlign = "start" | "end";
function useAnchoredPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement>,
  align: AnchorAlign = "end",
  gap = 8
) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  const compute = () => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const left = align === "end" ? Math.min(vw - 12, r.left + r.width) : r.left;
    setStyle({
      position: "fixed",
      top: r.top + r.height + gap,
      left: align === "end" ? left : Math.max(12, left),
      transform: align === "end" ? "translateX(-100%)" : "none",
      zIndex: 210,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    compute();
    const on = () => compute();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return style;
}

function AnchoredPopover({
  open,
  onClose,
  anchorRef,
  align = "end",
  maxWidth = 420,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  align?: AnchorAlign;
  maxWidth?: number;
  children: React.ReactNode;
}) {
  const style = useAnchoredPosition(open, anchorRef, align);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const a = anchorRef.current;
      const p =
        (document.querySelector(
          "[data-popover-panel='true']"
        ) as HTMLElement) || null;
      if (p?.contains(t) || a?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[200] bg-transparent" aria-hidden />
      <div
        data-popover-panel="true"
        className="z-[210] overflow-hidden rounded-md border border-gray-200 bg-white p-0 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        style={{ ...style, width: "min(92vw, " + maxWidth + "px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </Portal>
  );
}

/* =======================================
   Types & constants
======================================= */
const POS: PosGroup[] = ["GK", "DF", "MF", "FW"];
type PosGroup = "GK" | "DF" | "MF" | "FW";

function toPosGroup(p: Player["pos"]): PosGroup {
  switch (p) {
    case "GK":
      return "GK";
    case "DF":
    case "CB":
    case "RB":
    case "CW":
      return "DF";
    case "MF":
    case "CM":
      return "MF";
    case "FW":
    case "LW":
      return "FW";
    case "?":
    default:
      return "MF";
  }
}

const DEFAULT_COLS = {
  photo: true,
  select: true,
  name: true,
  club: true,
  pos: true,
  age: true,
  progress: true, // nowa kolumna
  obs: true,
  actions: true,
};
type ColKey = keyof typeof DEFAULT_COLS;

const COL_LABELS: Record<ColKey, string> = {
  photo: "",
  select: "Zaznacz",
  name: "Nazwa",
  club: "Klub",
  pos: "Pozycja",
  age: "Wiek",
  progress: "Profil",
  obs: "Obserwacje",
  actions: "Akcje",
};

type KnownScope = "known" | "unknown" | "all";
type Scope = "active" | "trash";
type SortKey = "name" | "club" | "pos" | "age" | "obs" | "progress";
type SortDir = "asc" | "desc";

type PlayerWithOwner = Player & {
  user_id?: string | null;
  profile_id?: string | null;
};
type ObservationWithOwner = Observation & {
  user_id?: string | null;
  profile_id?: string | null;
};

type PlayerRow = Player & {
  _known: boolean;
  _obs: number;
  _progress: number;
};

/* =======================================
   Main feature
======================================= */
export default function MyPlayersFeature({
  players,
  observations,
  onChangePlayers,
  onQuickAddObservation,
}: {
  players: Player[];
  observations: Observation[];
  onChangePlayers: (next: Player[]) => void;
  onQuickAddObservation?: (o: Observation) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  // === Supabase auth: tylko swoje rekordy (user_id/profile_id) ===
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error) {
          console.error("[MyPlayersFeature] auth.getUser error:", error);
          setAuthUserId(null);
        } else {
          setAuthUserId(data.user?.id ?? null);
        }
      } catch (e) {
        console.error("[MyPlayersFeature] auth.getUser failed:", e);
        setAuthUserId(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Filtrowanie po właścicielu — user_id/profile_id
  const ownedPlayers = useMemo(() => {
    const base = players as PlayerWithOwner[];
    if (!authUserId) return base;
    return base.filter(
      (p) => p.user_id === authUserId || p.profile_id === authUserId
    );
  }, [players, authUserId]);

  const ownedObservations = useMemo(() => {
    const base = observations as ObservationWithOwner[];
    if (!authUserId) return base;
    return base.filter(
      (o) => o.user_id === authUserId || o.profile_id === authUserId
    );
  }, [observations, authUserId]);

  const [content, setContent] = useState<"table" | "quick">("table");
  const [quickFor, setQuickFor] = useState<Player | null>(null);
  const [quickTab, setQuickTab] = useState<"new" | "existing">("new");

  const [scope, setScope] = useState<Scope>("active");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pos, setPos] = useState<Record<PosGroup, boolean>>({
    GK: true,
    DF: true,
    MF: true,
    FW: true,
  });
  const [club, setClub] = useState("");
  const [ageMin, setAgeMin] = useState<number | "">("");
  const [ageMax, setAgeMax] = useState<number | "">("");
  const [colsOpen, setColsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState({ ...DEFAULT_COLS });
  const [knownScope, setKnownScope] = useState<KnownScope>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // 3-dots menu (desktop)
  const [moreOpen, setMoreOpen] = useState(false);

  // Mobile sheets
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [colsSheetOpen, setColsSheetOpen] = useState(false);

  // anchors for desktop popovers
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);

  // Chips “more” popover
  const chipsMoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const [chipsOpen, setChipsOpen] = useState(false);
  const chipsHoverTimer = useRef<number | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50 | 100>(25);

  // Quick creator fields
  const [qaMatch, setQaMatch] = useState("");
  const [qaDate, setQaDate] = useState("");
  const [qaTime, setQaTime] = useState("");
  const [qaMode, setQaMode] = useState<"live" | "tv">("live");
  const [qaStatus, setQaStatus] = useState<Observation["status"]>("draft");
  // Existing picker
  const [obsQuery, setObsQuery] = useState("");
  const [obsSelectedId, setObsSelectedId] = useState<number | null>(null);

  const searchRef = useRef<HTMLInputElement | null>(null);

  // scroll-hint (mobile horizontal overflow)
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  /* URL param -> tab sync; default = all */
  useEffect(() => {
    const tab = (searchParams?.get("tab") as KnownScope | null) ?? "all";
    if (tab === "known" || tab === "unknown" || tab === "all") {
      setKnownScope(tab);
    } else {
      setKnownScope("all");
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function changeKnownScope(next: KnownScope) {
    setKnownScope(next);
    setPage(1);
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    sp.set("tab", next);
    router.replace(`/players?${sp.toString()}`, { scroll: false });
  }

  // Base with obs count + known flag + progress – TYLKO dla ownedPlayers/ownedObservations
  const withObsCount = useMemo<PlayerRow[]>(
    () =>
      (ownedPlayers as PlayerWithOwner[]).map((p) => ({
        ...p,
        _obs: ownedObservations.filter((o) => o.player === p.name).length,
        _known: Boolean((p as any).firstName || (p as any).lastName),
        _progress: computePlayerProfileProgress(p),
      })),
    [ownedPlayers, ownedObservations]
  );

  // Apply all filters except known tab
  const baseFilteredNoKnown = useMemo(() => {
    return withObsCount
      .filter((r) => (r.status ?? "active") === scope)
      .filter((r) =>
        !q
          ? true
          : r.name.toLowerCase().includes(q.toLowerCase()) ||
            r.club.toLowerCase().includes(q.toLowerCase())
      )
      .filter((r) => pos[toPosGroup(r.pos)])
      .filter((r) =>
        club ? r.club.toLowerCase().includes(club.toLowerCase()) : true
      )
      .filter((r) => (ageMin === "" ? true : r.age >= Number(ageMin)))
      .filter((r) => (ageMax === "" ? true : r.age <= Number(ageMax)));
  }, [withObsCount, scope, q, pos, club, ageMin, ageMax]);

  const tabCounts = useMemo(() => {
    const known = baseFilteredNoKnown.filter((r) => r._known).length;
    const unknown = baseFilteredNoKnown.filter((r) => !r._known).length;
    const all = baseFilteredNoKnown.length;
    return { known, unknown, all };
  }, [baseFilteredNoKnown]);

  // Final filtered (includes knownScope)
  const filtered = useMemo<PlayerRow[]>(() => {
    let base = [...baseFilteredNoKnown];
    if (knownScope === "known") base = base.filter((r) => r._known);
    if (knownScope === "unknown") base = base.filter((r) => !r._known);

    base.sort((a: any, b: any) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let av: any;
      let bv: any;
      switch (sortKey) {
        case "name":
        case "club":
        case "pos":
          av = (a[sortKey] || "").toString().toLowerCase();
          bv = (b[sortKey] || "").toString().toLowerCase();
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        case "age":
          av = a.age || 0;
          bv = b.age || 0;
          return (av - bv) * dir;
        case "obs":
          av = a._obs || 0;
          bv = b._obs || 0;
          return (av - bv) * dir;
        case "progress":
          av = a._progress || 0;
          bv = b._progress || 0;
          return (av - bv) * dir;
        default:
          return 0;
      }
    });
    return base;
  }, [baseFilteredNoKnown, knownScope, sortKey, sortDir]);

  // Pagination slice
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // ====== actions ======
  function trash(id: number) {
    const next: Player[] = players.map((p) =>
      p.id === id ? ({ ...p, status: "trash" } as Player) : p
    );
    onChangePlayers(next);
    setSelected((s) => {
      const copy = new Set(s);
      copy.delete(id);
      return copy;
    });
  }
  function restore(id: number) {
    const next: Player[] = players.map((p) =>
      p.id === id ? ({ ...p, status: "active" } as Player) : p
    );
    onChangePlayers(next);
    setSelected((s) => {
      const copy = new Set(s);
      copy.delete(id);
      return copy;
    });
  }
  function bulkTrash() {
    const next: Player[] = players.map((p) =>
      selected.has(p.id) ? ({ ...p, status: "trash" } as Player) : p
    );
    onChangePlayers(next);
    setSelected(new Set());
  }
  function bulkRestore() {
    const next: Player[] = players.map((p) =>
      selected.has(p.id) ? ({ ...p, status: "active" } as Player) : p
    );
    onChangePlayers(next);
    setSelected(new Set());
  }

  // exports – tylko własny widok, ale operujemy na filtered (już zawęzonym)
  function exportCSV() {
    const headers = [
      "id",
      "name",
      "club",
      "pos",
      "age",
      "status",
      "obs",
      "progress",
    ];
    const rows = filtered.map((p) => [
      p.id,
      p.name,
      p.club,
      p.pos,
      p.age,
      p.status,
      (p as any)._obs,
      (p as any)._progress,
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        r
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "players.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    const headers = [
      "ID",
      "Nazwa",
      "Klub",
      "Pozycja",
      "Wiek",
      "Status",
      "Obserwacje",
      "Profil %",
    ];
    const rows = filtered.map((p) => [
      p.id,
      p.name,
      p.club,
      p.pos,
      p.age,
      p.status,
      (p as any)._obs,
      (p as any)._progress,
    ]);
    const tableHtml =
      `<table><thead><tr>${headers
        .map((h) => `<th>${escapeHtml(h)}</th>`)
        .join("")}</tr></thead><tbody>` +
      rows
        .map(
          (r) =>
            `<tr>${r
              .map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`)
              .join("")}</tr>`
        )
        .join("") +
      `</tbody></table>`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${tableHtml}</body></html>`;
    const blob = new Blob([html], {
      type: "application/vnd.ms-excel",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "players.xls";
    a.click();
    URL.revokeObjectURL(url);
  }
  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Quick area controls
  function openQuick(player: Player) {
    setQuickFor(player);
    setQuickTab("new");
    setQaMatch("");
    setQaDate("");
    setQaTime("");
    setQaMode("live");
    setQaStatus("draft");
    setObsQuery("");
    setObsSelectedId(null);
    setContent("quick");
  }
  function closeQuick() {
    setContent("table");
    setQuickFor(null);
  }

  function saveQuickNew() {
    if (!quickFor) return;
    const obs: Observation = {
      id: Date.now(),
      player: quickFor.name,
      match: qaMatch.trim() || "—",
      date: qaDate || "",
      time: qaTime || "",
      status: qaStatus,
      // @ts-ignore
      mode: qaMode,
    };
    if (onQuickAddObservation) {
      onQuickAddObservation(obs);
    } else {
      console.warn(
        "[MyPlayersFeature] onQuickAddObservation not provided – quick obs not persisted"
      );
    }
    closeQuick();
  }
  function duplicateExistingToPlayer() {
    if (!quickFor || obsSelectedId == null) return;
    const base = ownedObservations.find((o) => o.id === obsSelectedId);
    if (!base) return;
    const copy: Observation = {
      ...base,
      id: Date.now(),
      player: quickFor.name,
    };
    if (onQuickAddObservation) {
      onQuickAddObservation(copy);
    } else {
      console.warn(
        "[MyPlayersFeature] onQuickAddObservation not provided – duplicate obs not persisted"
      );
    }
    closeQuick();
  }
  function reassignExistingToPlayer() {
    if (!quickFor || obsSelectedId == null) return;
    const base = ownedObservations.find((o) => o.id === obsSelectedId);
    if (!base) return;
    const updated: Observation = { ...base, player: quickFor.name };
    if (onQuickAddObservation) {
      onQuickAddObservation(updated);
    } else {
      console.warn(
        "[MyPlayersFeature] onQuickAddObservation not provided – reassign obs not persisted"
      );
    }
    closeQuick();
  }

  /* ===== active chips (hide "Poz.: Wszystkie" by default) ===== */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];

    if (q.trim()) {
      chips.push({
        key: "q",
        label: `Szukaj: “${q.trim()}”`,
        clear: () => {
          setQ("");
          setPage(1);
        },
      });
    }

    const visiblePositions = (Object.keys(pos) as PosGroup[]).filter(
      (k) => pos[k]
    );
    const allSelected = visiblePositions.length === POS.length;

    if (!allSelected) {
      const posLabel = `Poz.: ${visiblePositions.join(", ")}`;
      chips.push({
        key: "pos",
        label: posLabel,
        clear: () => {
          setPos({ GK: true, DF: true, MF: true, FW: true });
          setPage(1);
        },
      });
    }

    if (club.trim()) {
      chips.push({
        key: "club",
        label: `Klub: ${club.trim()}`,
        clear: () => {
          setClub("");
          setPage(1);
        },
      });
    }

    if (ageMin !== "") {
      chips.push({
        key: "ageMin",
        label: `Wiek ≥ ${ageMin}`,
        clear: () => {
          setAgeMin("");
          setPage(1);
        },
      });
    }

    if (ageMax !== "") {
      chips.push({
        key: "ageMax",
        label: `Wiek ≤ ${ageMax}`,
        clear: () => {
          setAgeMax("");
          setPage(1);
        },
      });
    }

    // if (knownScope !== "all") {
    //   chips.push({
    //     key: "known",
    //     label: knownScope === "known" ? "Znani" : "Nieznani",
    //     clear: () => changeKnownScope("all"),
    //   });
    // }

    return chips;
  }, [q, pos, club, ageMin, ageMax, knownScope]);

  const MAX_INLINE_CHIPS = 2;
  const inlineChips = activeChips.slice(0, MAX_INLINE_CHIPS);
  const overflowChips = activeChips.slice(MAX_INLINE_CHIPS);

  // CONSISTENT HEIGHTS
  const controlH = "h-9";
  const cellPad = "p-1";
  const rowH = "h-10";

  // Keyboard shortcuts (+ Esc closes panels)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        (e as any).isComposing;
      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/players/new");
        return;
      } else if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        exportCSV();
        return;
      } else if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        if (isMobile) setColsSheetOpen((o) => !o);
        else setColsOpen((o) => !o);
        setFiltersOpen(false);
        setMoreOpen(false);
        setMoreSheetOpen(false);
        return;
      } else if (e.key === "Escape") {
        setFiltersOpen(false);
        setColsOpen(false);
        setMoreOpen(false);
        setChipsOpen(false);
        setMoreSheetOpen(false);
        setColsSheetOpen(false);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, isMobile]);

  /* ====== filtersCount for badge ====== */
  const filtersCount =
    (q.trim() ? 1 : 0) +
    (Object.values(pos).some((v) => !v) ? 1 : 0) +
    (club.trim() ? 1 : 0) +
    (ageMin !== "" ? 1 : 0) +
    (ageMax !== "" ? 1 : 0) +
    (knownScope !== "all" ? 1 : 0);

  /* ====== scope-aware selection state (used by pill) ====== */
  const anyActiveSelected = useMemo(() => {
    return ownedPlayers.some(
      (p) =>
        selected.has(p.id) &&
        ((p.status ?? "active") === "active")
    );
  }, [ownedPlayers, selected]);

  // ====== MOBILE: detect horizontal overflow & first scroll ======
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const check = () => {
      const should =
        isMobile &&
        el.scrollWidth > el.clientWidth &&
        el.scrollLeft < 8;
      setShowScrollHint(should);
    };
    check();
    const onScroll = () => {
      if (el.scrollLeft > 12) setShowScrollHint(false);
    };
    el.addEventListener("scroll", onScroll, {
      passive: true,
    } as any);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener(
        "scroll",
        onScroll as any
      );
      window.removeEventListener("resize", check);
    };
  }, [isMobile, paginated.length, JSON.stringify(visibleCols)]);

  // Helpers for chips (desktop height = h-9)
  const Chip = ({
    label,
    onClear,
  }: {
    label: string;
    onClear: () => void;
  }) => (
    <span className="inline-flex h-9  items-center rounded-md border border-gray-200 bg-white/90 px-2 text-[12px] font-medium text-gray-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-200">
      <span className="max-w-[200px] truncate">
        {label}
      </span>
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

  // === Widok ładowania auth / brak usera ===
  if (authLoading) {
    return (
      <div className="w-full rounded-md border border-gray-200 bg-white p-4 text-sm text-dark shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
        Ładowanie Twoich zawodników…
      </div>
    );
  }

  if (!authUserId) {
    return (
      <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
        Nie udało się powiązać listy zawodników z zalogowanym kontem. Spróbuj
        odświeżyć stronę lub zalogować się ponownie.
      </div>
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
                Baza zawodników
              </span>

              {/* Right: tabs block (desktop) */}
              <div className="hidden md:block shrink-0">
                <Tabs
                  className="items-center"
                  value={knownScope}
                  onValueChange={(v) =>
                    changeKnownScope(v as KnownScope)
                  }
                >
                  <TabsList>
                    <TabsTrigger
                      value="all"
                      className="flex items-center gap-2"
                    >
                      <span>Wszyscy</span>
                      <span className="rounded-full bg-white px-1.5 text-[10px] font-medium border border-stone-300">
                        {tabCounts.all}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="known"
                      className="flex items-center gap-2"
                    >
                      <span>Znani</span>
                      <span className="rounded-full bg-white px-1.5 text-[10px] font-medium border border-stone-300">
                        {tabCounts.known}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="unknown"
                      className="flex items-center gap-2"
                    >
                      <span>Nieznani</span>
                      <span className="rounded-full bg-white px-1.5 text-[10px] font-medium border border-stone-300">
                        {tabCounts.unknown}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="all" />
                  <TabsContent value="known" />
                  <TabsContent value="unknown" />
                </Tabs>
              </div>

              {/* Center: Active filter chips (desktop) */}
              <div className="hidden md:flex flex-1 items-start justify-center h-9">
                <div className="flex items-center gap-1 h-9">
                  {inlineChips.map((c) => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      onClear={c.clear}
                    />
                  ))}

                  {overflowChips.length > 0 && (
                    <>
                      <button
                        ref={chipsMoreBtnRef}
                        type="button"
                        className="inline-flex h-9  items-center gap-1 rounded-md border border-gray-200 bg-white/90 px-2 text-[12px] font-medium text-gray-800 shadow-sm hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100"
                        onClick={() => setChipsOpen((v) => !v)}
                        onMouseEnter={() => {
                          if (chipsHoverTimer.current)
                            window.clearTimeout(
                              chipsHoverTimer.current
                            );
                          setChipsOpen(true);
                        }}
                        onMouseLeave={() => {
                          if (chipsHoverTimer.current)
                            window.clearTimeout(
                              chipsHoverTimer.current
                            );
                          chipsHoverTimer.current =
                            window.setTimeout(
                              () => setChipsOpen(false),
                              160
                            ) as unknown as number;
                        }}
                        aria-expanded={chipsOpen}
                        title="Pokaż więcej filtrów"
                      >
                        +{overflowChips.length}
                      </button>

                      <AnchoredPopover
                        open={chipsOpen}
                        onClose={() => setChipsOpen(false)}
                        anchorRef={chipsMoreBtnRef}
                        align="end"
                        maxWidth={360}
                      >
                        <div
                          className="w-full p-2"
                          onMouseEnter={() => {
                            if (chipsHoverTimer.current)
                              window.clearTimeout(
                                chipsHoverTimer.current
                              );
                            setChipsOpen(true);
                          }}
                          onMouseLeave={() => {
                            if (chipsHoverTimer.current)
                              window.clearTimeout(
                                chipsHoverTimer.current
                              );
                            chipsHoverTimer.current =
                              window.setTimeout(
                                () => setChipsOpen(false),
                                140
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-between min-h-9">
              <div />

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
                {/* Search */}
                <div className="relative order-1 w-full min-w-0 sm:order-none sm:w-64 h-9">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden="true"
                  />
                  <Input
                    ref={searchRef}
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Szukaj po nazwisku/klubie… (/)"
                    className={`${controlH} w-full pl-8 pr-3 text-sm`}
                    aria-label="Szukaj w bazie zawodników"
                  />
                </div>

                {/* Filtry */}
<div className="relative inline-flex">
  <span
    className="pointer-events-none absolute -top-2 left-3 rounded-full bg-white px-1.5 text-[10px] font-medium text-stone-500 
               dark:bg-neutral-950 dark:text-neutral-300"
  >
    Filtry
  </span>

    <Button
    ref={filterBtnRef}
    type="button"
    variant="outline"
    className={`${controlH} h-9 border-gray-300 px-3 py-2 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700`}
    aria-pressed={filtersOpen}
    onClick={() => {
      setFiltersOpen((v) => !v);
      setColsOpen(false);
      setMoreOpen(false);
      setMoreSheetOpen(false);
    }}
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


                {/* Dodaj */}
                <Button
                  type="button"
                  title="Skrót: N"
                  onClick={() => router.push("/players/new")}
                  className={`${controlH} h-9 w-9 primary inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-3 text-sm text-white hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60`}
                >
                  <AddPlayerIcon className="mr-0  h-4 w-4" />
                </Button>

                {/* Więcej */}
                <Button
                  ref={moreBtnRef}
                  type="button"
                  aria-label="Więcej"
                  aria-pressed={moreOpen}
                  onClick={() => {
                    if (isMobile) {
                      setMoreSheetOpen(true);
                      setFiltersOpen(false);
                      setColsSheetOpen(false);
                    } else {
                      setMoreOpen((o) => !o);
                      setFiltersOpen(false);
                    }
                  }}
                  variant="outline"
                  className={`${controlH} h-9 w-9 border-gray-300 p-0 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 ml-auto sm:ml-0`}
                >
                  <EllipsisVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>
          }
        />

        {/* Tabs for mobile */}
        <div className="mt-2 md:hidden">
          <Tabs
            className="items-center w-full"
            value={knownScope}
            onValueChange={(v) =>
              changeKnownScope(v as KnownScope)
            }
          >
            <TabsList className="w-full flex">
              <TabsTrigger
                value="all"
                className="flex-1 flex items-center justify-center gap-2"
              >
                <span>Wszyscy</span>
                <span className="rounded-full bg-white px-1.5 text-[10px] font-medium border border-stone-300">
                  {tabCounts.all}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="known"
                className="flex-1 flex items-center justify-center gap-2"
              >
                <span>Znani</span>
                <span className="rounded-full bg-white px-1.5 text-[10px] font-medium border border-stone-300">
                  {tabCounts.known}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="unknown"
                className="flex-1 flex items-center justify-center gap-2"
              >
                <span>Nieznani</span>
                <span className="rounded-full bg-white px-1.5 text-[10px] font-medium border border-stone-300">
                  {tabCounts.unknown}
                </span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all" />
            <TabsContent value="known" />
            <TabsContent value="unknown" />
          </Tabs>

          {/* Mobile: compact chips under tabs */}
          {activeChips.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {activeChips.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <span className="max-w-[120px] truncate">
                    {c.label}
                  </span>
                  <button
                    className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
                    onClick={c.clear}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: anchored popovers */}
        {!isMobile && (
          <>
            {/* Filters popover */}
            <AnchoredPopover
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              anchorRef={filterBtnRef}
              align="end"
              maxWidth={440}
            >
              <div className="w-full p-3 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold text-dark dark:text-neutral-300">
                    Filtry
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900"
                        onClick={() => {
                          setPos({
                            GK: true,
                            DF: true,
                            MF: true,
                            FW: true,
                          });
                          setClub("");
                          setAgeMin("");
                          setAgeMax("");
                          setQ("");
                          changeKnownScope("all");
                          setPage(1);
                        }}
                        title="Wyczyść wszystko"
                        aria-label="Wyczyść wszystko"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">
                          Wyczyść
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Wyczyść filtry
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="mb-2 grid grid-cols-4 gap-2">
                  {POS.map((p) => (
                    <label
                      key={p}
                      className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-stone-100 dark:hover:bg-neutral-800"
                    >
                      <span>{p}</span>
                      <Checkbox
                        checked={pos[p]}
                        onCheckedChange={(v) => {
                          setPos((prev) => ({
                            ...prev,
                            [p]: Boolean(v),
                          }));
                          setPage(1);
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div className="mb-2">
                  <Label className="text-xs text-dark dark:text-neutral-300">
                    Klub
                  </Label>
                  <Input
                    value={club}
                    onChange={(e) => {
                      setClub(e.target.value);
                      setPage(1);
                    }}
                    className="mt-1 border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-dark dark:text-neutral-300">
                      Wiek min
                    </Label>
                    <Input
                      type="number"
                      value={ageMin}
                      onChange={(e) => {
                        setAgeMin(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                        );
                        setPage(1);
                      }}
                      className="mt-1 border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-dark dark:text-neutral-300">
                      Wiek max
                    </Label>
                    <Input
                      type="number"
                      value={ageMax}
                      onChange={(e) => {
                        setAgeMax(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                        );
                        setPage(1);
                      }}
                      className="mt-1 border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                </div>

                {activeChips.length > 0 && (
                  <div className="mt-3 border-t border-gray-200 pt-2 dark:border-neutral-800">
                    <div className="mb-1 text-[11px] font-semibold text-dark dark:text-neutral-300">
                      Aktywne
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {activeChips.map((c) => (
                        <Chip
                          key={c.key}
                          label={c.label}
                          onClear={c.clear}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button
                    className="bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring focus-visible:ring-indigo-500/60"
                    onClick={() => setFiltersOpen(false)}
                  >
                    Zastosuj
                  </Button>
                </div>
              </div>
            </AnchoredPopover>

            {/* Columns popover */}
            <AnchoredPopover
              open={colsOpen}
              onClose={() => setColsOpen(false)}
              anchorRef={moreBtnRef}
              align="end"
              maxWidth={320}
            >
              <div className="w-full p-3">
                <div className="mb-2 text-xs font-medium text-dark dark:text-neutral-400">
                  Widoczność kolumn
                </div>
                {Object.keys(DEFAULT_COLS).map((k) => {
                  const key = k as ColKey;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                    >
                      <span className="text-gray-800 dark:text-neutral-100">
                        {COL_LABELS[key]}
                      </span>
                      <Checkbox
                        checked={visibleCols[key]}
                        onCheckedChange={(v) =>
                          setVisibleCols({
                            ...visibleCols,
                            [key]: Boolean(v),
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </AnchoredPopover>

            {/* More popover */}
            <AnchoredPopover
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              anchorRef={moreBtnRef}
              align="end"
              maxWidth={260}
            >
              <div className="w-full p-1">
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-900"
                  onClick={() => {
                    setColsOpen(true);
                    setMoreOpen(false);
                  }}
                >
                  <Columns3 className="h-4 w-4" /> Kolumny
                </button>
                <div className="my-1 h-px bg-gray-200 dark:bg-neutral-800" />
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-900"
                  onClick={() => {
                    setScope("active");
                    setMoreOpen(false);
                  }}
                >
                  <Users className="h-4 w-4" /> Aktywni
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-900"
                  onClick={() => {
                    setScope("trash");
                    setMoreOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Kosz
                </button>
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
              </div>
            </AnchoredPopover>
          </>
        )}

        {/* MOBILE SHEETS */}
        {isMobile && (
          <>
            {/* Filtry */}
            <MobileSheet
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              title="Filtry"
            >
              <div className="mb-3 grid grid-cols-2 gap-2">
                {POS.map((p) => (
                  <label
                    key={p}
                    className="flex items-center justify-between rounded-md px-2 py-2 ring-1 ring-gray-200 dark:ring-neutral-700"
                  >
                    <span>{p}</span>
                    <Checkbox
                      checked={pos[p]}
                      onCheckedChange={(v) => {
                        setPos((prev) => ({
                          ...prev,
                          [p]: Boolean(v),
                        }));
                        setPage(1);
                      }}
                    />
                  </label>
                ))}
              </div>

              <div className="mb-3">
                <Label className="text-xs">Klub</Label>
                <Input
                  value={club}
                  onChange={(e) => {
                    setClub(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Wiek min</Label>
                  <Input
                    type="number"
                    value={ageMin}
                    onChange={(e) => {
                      setAgeMin(
                        e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                      );
                      setPage(1);
                    }}
                    className="mt-1 border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <Label className="text-xs">Wiek max</Label>
                  <Input
                    type="number"
                    value={ageMax}
                    onChange={(e) => {
                      setAgeMax(
                        e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                      );
                      setPage(1);
                    }}
                    className="mt-1 border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
              </div>

              {activeChips.length > 0 && (
                <div className="mt-3 border-t border-gray-200 pt-2 dark:border-neutral-800">
                  <div className="mb-1 text-[11px] font-semibold text-dark dark:text-neutral-300">
                    Aktywne
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {activeChips.map((c) => (
                      <span
                        key={c.key}
                        className="inline-flex items-center rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-neutral-700 dark:bg-neutral-900"
                      >
                        <span className="max-w-[160px] truncate">
                          {c.label}
                        </span>
                        <button
                          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
                          onClick={c.clear}
                          aria-label="Wyczyść filtr"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-start justify-between">
                <Button
                  variant="outline"
                  className="border-gray-300 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                  onClick={() => {
                    setPos({
                      GK: true,
                      DF: true,
                      MF: true,
                      FW: true,
                    });
                    setClub("");
                    setAgeMin("");
                    setAgeMax("");
                    setQ("");
                    changeKnownScope("all");
                    setPage(1);
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
            </MobileSheet>

            {/* Więcej */}
            <MobileSheet
              open={moreSheetOpen}
              onClose={() => setMoreSheetOpen(false)}
              title="Więcej"
            >
              <div className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-neutral-800 dark:border-neutral-800">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setMoreSheetOpen(false);
                    setColsSheetOpen(true);
                  }}
                >
                  <Columns3 className="h-4 w-4" /> Kolumny
                </button>

                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setScope("active");
                    setMoreSheetOpen(false);
                  }}
                >
                  <Users className="h-4 w-4" /> Aktywni
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setScope("trash");
                    setMoreSheetOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Kosz
                </button>

                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setMoreSheetOpen(false);
                    exportCSV();
                  }}
                >
                  <FileDown className="h-4 w-4" /> Eksport CSV
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setMoreSheetOpen(false);
                    exportExcel();
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Eksport Excel
                </button>
              </div>
            </MobileSheet>

            {/* Kolumny */}
            <MobileSheet
              open={colsSheetOpen}
              onClose={() => setColsSheetOpen(false)}
              title="Kolumny"
            >
              <div className="rounded-md border border-gray-200 dark:border-neutral-800">
                {Object.keys(DEFAULT_COLS).map((k) => {
                  const key = k as ColKey;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-neutral-800"
                    >
                      <span className="text-gray-800 dark:text-neutral-100">
                        {COL_LABELS[key]}
                      </span>
                      <Checkbox
                        checked={visibleCols[key]}
                        onCheckedChange={(v) =>
                          setVisibleCols({
                            ...visibleCols,
                            [key]: Boolean(v),
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </MobileSheet>
          </>
        )}

        {/* Floating selection pill */}
        {content === "table" && selected.size > 0 && (
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

                {anyActiveSelected && scope === "active" ? (
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

        {/* CONTENT REGION */}
        <div className="mt-3">
          {content === "table" ? (
            <>
              <div className="relative">
                <PlayersTable
                  rows={paginated as PlayerRow[]}
                  observations={ownedObservations}
                  visibleCols={visibleCols}
                  selected={selected}
                  setSelected={setSelected}
                  scope={scope}
                  onOpen={(id) => {
                    const p = (players as any[]).find(
                      (pl) => pl.id === id
                    );
                    let label: string | undefined;

                    if (p) {
                      const fn = (
                        p.firstName ?? p.imie ?? ""
                      )
                        .toString()
                        .trim();
                      const ln = (
                        p.lastName ?? p.nazwisko ?? ""
                      )
                        .toString()
                        .trim();

                      if (fn || ln) {
                        label = `${fn} ${ln}`.trim();
                      } else {
                        label = p.name;
                      }
                    }

                    const qs = label
                      ? `?playerName=${encodeURIComponent(
                          label
                        )}`
                      : "";
                    router.push(`/players/${id}${qs}`);
                  }}
                  onTrash={trash}
                  onRestore={restore}
                  onSortChange={(k, d) => {
                    setSortKey(k);
                    setSortDir(d);
                  }}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onQuick={(p) => openQuick(p)}
                  cellPad={cellPad}
                  rowH={rowH}
                  pageSliceCount={paginated.length}
                  wrapRef={tableWrapRef}
                />

                {showScrollHint && (
                  <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 sm:hidden">
                    <div className="inline-flex items-center gap-1 rounded-md bg-gray-900/85 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-black/10 backdrop-blur">
                      Przewiń tabelę →
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination footer */}
              <div className="mt-3 flex flex-row flex-wrap items-center justify-center lg:justify-between gap-2 rounded-md p-2 text-sm shadow-sm dark:bg-neutral-950">
                <div className="flex flex-row flex-wrap items-center gap-2">
                  <span className="text-dark dark:text-neutral-300 leading-none">
                    Wiersze na stronę:
                  </span>
                  <select
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm leading-none dark:border-neutral-700 dark:bg-neutral-900"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(
                        Number(e.target.value) as any
                      );
                      setPage(1);
                    }}
                    aria-label="Liczba wierszy na stronę"
                  >
                    {[10, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>

                  <span className="ml-2 text-dark dark:text-neutral-300 leading-none">
                    {total === 0
                      ? "0"
                      : (currentPage - 1) * pageSize + 1}
                    –
                    {Math.min(
                      currentPage * pageSize,
                      total
                    )}{" "}
                    z {total}
                  </span>
                </div>

                <div className="flex flex-row flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-auto px-2 py-1 leading-none border-gray-300 dark:border-neutral-700"
                    disabled={currentPage <= 1}
                    onClick={() =>
                      setPage((p) => Math.max(1, p - 1))
                    }
                    aria-label="Poprzednia strona"
                    title="Poprzednia strona"
                  >
                    <ChevronLeft className="h-[1.1em] w-[1.1em]" />
                  </Button>

                  <div className="min-w-[80px] text-center leading-none">
                    Strona {currentPage} / {totalPages}
                  </div>

                  <Button
                    variant="outline"
                    className="h-auto px-2 py-1 leading-none border-gray-300 dark:border-neutral-700"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      setPage((p) =>
                        Math.min(totalPages, p + 1)
                      )
                    }
                    aria-label="Następna strona"
                    title="Następna strona"
                  >
                    <ChevronRight className="h-[1.1em] w-[1.1em]" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <QuickObservation
              player={quickFor!}
              onBack={closeQuick}
              quickTab={quickTab}
              setQuickTab={setQuickTab}
              qaMatch={qaMatch}
              setQaMatch={setQaMatch}
              qaDate={qaDate}
              setQaDate={setQaDate}
              qaTime={qaTime}
              setQaTime={setQaTime}
              qaMode={qaMode}
              setQaMode={setQaMode}
              qaStatus={qaStatus}
              setQaStatus={setQaStatus}
              onSaveNew={saveQuickNew}
              observations={ownedObservations}
              obsQuery={obsQuery}
              setObsQuery={setObsQuery}
              obsSelectedId={obsSelectedId}
              setObsSelectedId={setObsSelectedId}
              onDuplicate={duplicateExistingToPlayer}
              onReassign={reassignExistingToPlayer}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

/* =======================================
   Table
======================================= */
function PlayersTable({
  rows,
  observations, // eslint-disable-line @typescript-eslint/no-unused-vars
  visibleCols,
  selected,
  setSelected,
  scope,
  onOpen,
  onTrash,
  onRestore,
  onSortChange,
  sortKey,
  sortDir,
  onQuick, // eslint-disable-line @typescript-eslint/no-unused-vars
  cellPad,
  rowH,
  pageSliceCount,
  wrapRef,
}: {
  rows: PlayerRow[];
  observations: Observation[];
  visibleCols: Record<keyof typeof DEFAULT_COLS, boolean>;
  selected: Set<number>;
  setSelected: (s: Set<number>) => void;
  scope: "active" | "trash";
  onOpen: (id: number) => void;
  onTrash: (id: number) => void;
  onRestore: (id: number) => void;
  onSortChange: (k: SortKey, d: SortDir) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onQuick: (p: Player) => void;
  cellPad: string;
  rowH: string;
  pageSliceCount: number;
  wrapRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const allChecked =
    pageSliceCount > 0 && rows.every((r) => selected.has(r.id));
  const someChecked =
    !allChecked && rows.some((r) => selected.has(r.id));

  // per-row confirmation for trash
  const [confirmTrashId, setConfirmTrashId] = useState<number | null>(
    null
  );

  useEffect(() => {
    // reset confirmation on page/scope change
    setConfirmTrashId(null);
  }, [rows, scope]);

  function SortHeader({
    k,
    children,
  }: {
    k: SortKey;
    children: React.ReactNode;
  }) {
    const active = sortKey === k;
    return (
      <button
        className={
          "flex items-center gap-1 font-medium " +
          (active
            ? "text-gray-900 dark:text-neutral-100"
            : "")
        }
        onClick={() =>
          onSortChange(
            k,
            active && sortDir === "asc" ? "desc" : "asc"
          )
        }
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

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last =
      parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
    return (first + last).toUpperCase();
  };

  const getJerseyNo = (name: string) => {
    const m = name.match(/#(\d{1,3})/);
    return m ? m[1] : null;
  };

  const KnownBadge = ({ known }: { known: boolean }) => {
    if (known) return null; // znany → no badge
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        nieznany
      </span>
    );
  };

  const progressBarColor = (v: number) => {
    if (v < 40) return "bg-rose-500";
    if (v < 75) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div
      ref={wrapRef as any}
      className="w-full overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950"
    >
<table className="w-full table-auto text-sm">
  <thead className="sticky top-0 z-10 bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
    <tr>
      {visibleCols.photo && (
        <th
          className={`${cellPad} w-px whitespace-nowrap text-left font-medium`}
        ></th>
      )}
      {visibleCols.select && (
        <th
          className={`${cellPad} text-left font-medium w-10`}
        >
          <Checkbox
            checked={
              rows.length === 0
                ? false
                : allChecked
                ? true
                : someChecked
                ? "indeterminate"
                : false
            }
            onCheckedChange={(v) => {
              if (v)
                setSelected(
                  new Set([
                    ...selected,
                    ...rows.map((f) => f.id),
                  ])
                );
              else {
                const set = new Set(selected);
                rows.forEach((r) => set.delete(r.id));
                setSelected(set);
              }
            }}
            aria-label="Zaznacz wszystkie widoczne"
          />
        </th>
      )}
      {visibleCols.name && (
        <th className={`${cellPad} text-left`}>
          <SortHeader k="name">Nazwa</SortHeader>
        </th>
      )}
      {visibleCols.club && (
        <th className={`${cellPad} text-left`}>
          <SortHeader k="club">Klub</SortHeader>
        </th>
      )}
      {visibleCols.pos && (
        <th className={`${cellPad} text-left`}>
          <SortHeader k="pos">Pozycja</SortHeader>
        </th>
      )}
      {visibleCols.age && (
        <th className={`${cellPad} text-left`}>
          <SortHeader k="age">Wiek</SortHeader>
        </th>
      )}
      {visibleCols.progress && (
        <th className={`${cellPad} text-left`}>
          <SortHeader k="progress">Wypełnienie profilu</SortHeader>
        </th>
      )}
      {visibleCols.obs && (
        <th className={`${cellPad} text-left`}>
          <SortHeader k="obs">Obserwacje</SortHeader>
        </th>
      )}
      {visibleCols.actions && (
        <th
          className={`${cellPad} text-right font-medium`}
        >
          Akcje
        </th>
      )}
    </tr>
  </thead>
  <tbody>
    {rows.map((r) => {
      const jersey = getJerseyNo(r.name);
      const isConfirmingTrash = confirmTrashId === r.id;

      return (
        <tr
          key={r.id}
          className={`group border-t border-gray-200 transition-colors duration-150 hover:bg-stone-100/80 dark:border-neutral-800 dark:hover:bg-neutral-900/70 ${rowH}`}
          onDoubleClick={() => onOpen(r.id)}
        >
          {visibleCols.photo && (
            <td className={`${cellPad} w-px whitespace-nowrap`}>
              <div className="relative">
                {r._known ? (
                  r.photo ? (
                    <img
                      src={r.photo}
                      alt={r.name}
                      className="h-9  rounded-md object-cover ring-1 ring-black/5 transition group-hover:shadow-sm"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-xs font-semibold text-gray-700 ring-1 ring-black/5 transition group-hover:shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
                      {getInitials(r.name)}
                    </div>
                  )
                ) : jersey ? (
                  // NIEZNANY + jest numer koszulki → pokazujemy sam numer
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-sm font-semibold text-gray-800 ring-1 ring-black/5 transition group-hover:shadow-sm dark:bg-neutral-800 dark:text-neutral-100">
                    {jersey}
                  </div>
                ) : (
                  // NIEZNANY + brak numeru → sama koszulka
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-xs ring-1 ring-black/5 transition group-hover:shadow-sm dark:bg-neutral-800">
                    <PlayerOnlyTshirt
                      className="h-6 w-6"
                      strokeWidthAll={14}
                    />
                  </div>
                )}
              </div>
            </td>
          )}

          {visibleCols.select && (
            <td className={cellPad}>
              <Checkbox
                checked={selected.has(r.id)}
                onCheckedChange={(v) => {
                  const copy = new Set(selected);
                  if (v) copy.add(r.id);
                  else copy.delete(r.id);
                  setSelected(copy);
                }}
                aria-label={`Zaznacz ${r.name}`}
              />
            </td>
          )}

          {visibleCols.name && (
            <td
              className={`${cellPad} max-w-[260px] text-gray-900 dark:text-neutral-100`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="truncate"
                  title={r.name}
                >
                  {r.name}
                </span>
                <KnownBadge known={r._known} />
              </div>
            </td>
          )}
          {visibleCols.club && (
            <td
              className={`${cellPad} max-w-[220px] text-gray-700 dark:text-neutral-200`}
            >
              <span
                className="truncate"
                title={r.club}
              >
                {r.club}
              </span>
            </td>
          )}
          {visibleCols.pos && (
            <td className={cellPad}>
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                {r.pos}
              </span>
            </td>
          )}
          {visibleCols.age && (
            <td
              className={`${cellPad} text-gray-700 dark:text-neutral-200`}
            >
              {r.age}
            </td>
          )}

          {visibleCols.progress && (
            <td className={cellPad}>
              <div className="flex items-center gap-2">
                <div className="relative h-2 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-800">
                  <div
                    className={`h-full ${progressBarColor(
                      r._progress
                    )} transition-[width] duration-300`}
                    style={{
                      width: `${r._progress}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-medium text-gray-700 dark:text-neutral-300 tabular-nums">
                  {r._progress}%
                </span>
              </div>
            </td>
          )}

          {visibleCols.obs && (
            <td className={cellPad}>
              <span className="inline-flex rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                {r._obs}
              </span>
            </td>
          )}
          {visibleCols.actions && (
            <td
              className={`${cellPad} text-right`}
            >
              <div className="flex justify-end gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 border-gray-300 p-0 transition hover:scale-105 hover:border-gray-400 focus-visible:ring focus-visible:ring-indigo-500/60 dark:border-neutral-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r.id);
                      }}
                      aria-label={
                        r._known
                          ? "Edytuj"
                          : "Uzupełnij dane"
                      }
                    >
                      {r._known ? (
                        <Pencil className="h-4 w-4" />
                      ) : (
                        <FileEdit className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {r._known
                      ? "Edytuj"
                      : "Uzupełnij dane"}
                  </TooltipContent>
                </Tooltip>

                {scope === "active" ? (
                  isConfirmingTrash ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        className="h-9 px-2 text-xs bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500/60"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTrash(r.id);
                          setConfirmTrashId(null);
                        }}
                      >
                        Tak
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-2 text-xs border-gray-300 dark:border-neutral-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmTrashId(null);
                        }}
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
                            setConfirmTrashId(r.id);
                          }}
                          aria-label="Przenieś do kosza"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
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
                          onRestore(r.id);
                        }}
                        aria-label="Przywróć"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Przywróć
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </td>
          )}
        </tr>
      );
    })}
    {rows.length === 0 && (
      <tr>
        <td
          colSpan={
            Object.values(visibleCols).filter(Boolean)
              .length || 1
          }
          className={`${cellPad} text-center text-sm text-dark dark:text-neutral-400`}
        >
          Brak wyników dla bieżących filtrów.
        </td>
      </tr>
    )}
  </tbody>
</table>

    </div>
  );
}

/* =======================================
   Quick Observation
======================================= */
function QuickObservation({
  player,
  onBack,
  quickTab,
  setQuickTab,
  qaMatch,
  setQaMatch,
  qaDate,
  setQaDate,
  qaTime,
  setQaTime,
  qaMode,
  setQaMode,
  qaStatus,
  setQaStatus,
  onSaveNew,
  observations,
  obsQuery,
  setObsQuery,
  obsSelectedId,
  setObsSelectedId,
  onDuplicate,
  onReassign,
}: {
  player: Player;
  onBack: () => void;
  quickTab: "new" | "existing";
  setQuickTab: (t: "new" | "existing") => void;
  qaMatch: string;
  setQaMatch: (v: string) => void;
  qaDate: string;
  setQaDate: (v: string) => void;
  qaTime: string;
  setQaTime: (v: string) => void;
  qaMode: "live" | "tv";
  setQaMode: (v: "live" | "tv") => void;
  qaStatus: Observation["status"];
  setQaStatus: (v: Observation["status"]) => void;
  onSaveNew: () => void;
  observations: Observation[];
  obsQuery: string;
  setObsQuery: (v: string) => void;
  obsSelectedId: number | null;
  setObsSelectedId: (v: number | null) => void;
  onDuplicate: () => void;
  onReassign: () => void;
}) {
  const parseTeams = (m?: string) => {
    if (!m) return { a: "", b: "" };
    const parts = m.split(/ *vs *| *VS *| *Vs */i);
    if (parts.length >= 2)
      return { a: parts[0].trim(), b: parts[1].trim() };
    return { a: m.trim(), b: "" };
  };
  const composeMatch = (a: string, b: string) =>
    a.trim() && b.trim()
      ? `${a.trim()} vs ${b.trim()}`
      : (a + " " + b).trim();

  const chip = (txt: string) => (
    <span className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700">
      {txt}
    </span>
  );

  const [teamA, setTeamA] = useState(parseTeams(qaMatch).a);
  const [teamB, setTeamB] = useState(parseTeams(qaMatch).b);

  useEffect(() => {
    const { a, b } = parseTeams(qaMatch);
    setTeamA(a);
    setTeamB(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaMatch]);

  function updateMatchFromTeams(a: string, b: string) {
    setTeamA(a);
    setTeamB(b);
    setQaMatch(composeMatch(a, b));
  }

  type SaveState = "idle" | "saving" | "saved";
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const tRef = useRef<number | null>(null);

  // prosty wizualny "autosave" bez localStorage / Supabase
  useEffect(() => {
    setSaveState("saving");
    window.clearTimeout(tRef.current || undefined);
    // @ts-ignore
    tRef.current = window.setTimeout(() => {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1000);
    }, 600);
    return () => window.clearTimeout(tRef.current || undefined);
  }, [qaMatch, qaDate, qaTime, qaMode, qaStatus, teamA, teamB]);

  function handleSave() {
    onSaveNew();
  }

  const canSave =
    qaMatch.trim().length > 0 && qaDate.trim().length > 0;

  const existingFiltered = useMemo(() => {
    const q = obsQuery.trim().toLowerCase();
    const arr = [...observations].sort((a, b) =>
      ((b.date || "") + (b.time || "")).localeCompare(
        (a.date || "") + (a.time || "")
      )
    );
    if (!q) return arr;
    return arr.filter(
      (o) =>
        (o.match || "").toLowerCase().includes(q) ||
        (o.player || "").toLowerCase().includes(q) ||
        (o.date || "").includes(q)
    );
  }, [observations, obsQuery]);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-0 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-dark dark:text-neutral-400">
            Szybka obserwacja
          </div>
          <div className="truncate text-sm font-semibold text-gray-900 dark:text-neutral-100">
            {player.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveState !== "idle" && (
            <span
              className={`hidden sm:inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${
                saveState === "saving"
                  ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/50"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-800/50"
              }`}
            >
              {saveState === "saving"
                ? "Zapisywanie…"
                : "Zapisano szkic lokalnie"}
            </span>
          )}
          <Button
            variant="outline"
            className="border-gray-300 dark:border-neutral-700"
            onClick={onBack}
          >
            <ArrowLeft className="mr-0 md:mr-2 h-4 w-4" />
            Wróć
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <Tabs
          value={quickTab}
          onValueChange={(v) =>
            setQuickTab(v as "new" | "existing")
          }
        >
          <TabsList className="mb-2 inline-flex h-9  items-center rounded-md bg-gray-200 p-1 shadow-sm dark:bg-neutral-900">
            <TabsTrigger
              value="new"
              className="h-9 px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800"
            >
              <PlusSquare className="mr-0 md:mr-2 h-4 w-4" />
              Nowa
            </TabsTrigger>
            <TabsTrigger
              value="existing"
              className="h-9 px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800"
            >
              <Download className="mr-0 md:mr-2 h-4 w-4" />
              Istniejąca
            </TabsTrigger>
          </TabsList>

          {/* NEW */}
          <TabsContent value="new" className="mt-2 space-y-4">
            <div className="rounded-md border border-gray-200 p-4 dark:border-neutral-800">
              <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-neutral-100">
                Mecz
              </div>
              <div className="mb-3 text-xs text-dark dark:text-neutral-400">
                Wpisz drużyny — pole „Mecz” składa się
                automatycznie.
              </div>

              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <div>
                  <Label>Drużyna A</Label>
                  <Input
                    value={teamA}
                    onChange={(e) =>
                      updateMatchFromTeams(e.target.value, teamB)
                    }
                    placeholder="np. Lech U19"
                    className="mt-1"
                  />
                </div>
                <div className="hidden select-none items-end justify-center pb-2 text-sm text-dark sm:flex">
                  vs
                </div>
                <div>
                  <Label>Drużyna B</Label>
                  <Input
                    value={teamB}
                    onChange={(e) =>
                      updateMatchFromTeams(teamA, e.target.value)
                    }
                    placeholder="np. Wisła U19"
                    className="mt-1"
                  />
                </div>
                <div className="sm:hidden text-center text-sm text-dark">
                  vs
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label>Data meczu</Label>
                  <Input
                    type="date"
                    value={qaDate}
                    onChange={(e) =>
                      setQaDate(e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Godzina meczu</Label>
                  <Input
                    type="time"
                    value={qaTime}
                    onChange={(e) =>
                      setQaTime(e.target.value)
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-dark dark:text-neutral-300">
                Mecz:{" "}
                <span className="font-medium">
                  {qaMatch || "—"}
                </span>
                <span className="ml-2">
                  {chip(
                    qaMode === "tv" ? "TV" : "Live"
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-gray-200 p-4 dark:border-neutral-800">
                <Label>Tryb</Label>
                <div className="mt-2 inline-flex overflow-hidden rounded-md border">
                  {(["live", "tv"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setQaMode(m)}
                      className={`px-3 py-1 text-sm transition-colors ${
                        qaMode === m
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-700 hover:bg-stone-100 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {m === "live" ? (
                        <span className="inline-flex items-center gap-1">
                          <Radio className="h-3.5 w-3.5" /> Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Tv className="h-3.5 w-3.5" /> TV
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 p-4 dark:border-neutral-800">
                <Label>Status</Label>
                <div className="mt-2 inline-flex overflow-hidden rounded-md border">
                  {(["draft", "final"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setQaStatus(s)}
                      className={`px-3 py-1 text-sm transition-colors ${
                        qaStatus === s
                          ? "bg-green-600 text-white"
                          : "bg-white text-gray-700 hover:bg-stone-100 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {s === "draft" ? "Szkic" : "Finalna"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 mt-1 -mx-4 border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80">
              <div className="flex items-center justify-end gap-2">
                <div className="mr-auto hidden text-[11px] text-dark sm:block dark:text-neutral-400">
                  Skróty:{" "}
                  <span className="font-medium">Enter</span> —
                  Zapisz,{" "}
                  <span className="font-medium">Esc</span> — Wróć
                </div>
                <Button
                  variant="outline"
                  className="border-gray-300 dark:border-neutral-700"
                  onClick={onBack}
                >
                  Anuluj
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="bg-gray-900 text-white hover:bg-gray-800"
                      onClick={handleSave}
                      disabled={!canSave}
                    >
                      Zapisz
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canSave
                      ? "Zapisz nową obserwację"
                      : "Uzupełnij: Drużyna A/B i Datę"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TabsContent>

          {/* EXISTING */}
          <TabsContent value="existing" className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-dark" />
              <Input
                value={obsQuery}
                onChange={(e) => setObsQuery(e.target.value)}
                placeholder="Szukaj po meczu, zawodniku, dacie…"
                className="flex-1"
              />
            </div>

            <div className="max-h-90 overflow-auto rounded-md border border-gray-200 dark:border-neutral-700">
            <table className="table-auto w-fit text-sm">
              <thead className="sticky top-0 bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
                <tr>
                  <th className="w-px whitespace-nowrap p-2 text-left font-medium">
                    #
                  </th>
                  <th className="w-px whitespace-nowrap p-2 text-left font-medium">
                    Mecz
                  </th>
                  <th className="w-px whitespace-nowrap p-2 text-left font-medium">
                    Zawodnik
                  </th>
                  <th className="w-px whitespace-nowrap p-2 text-left font-medium">
                    Data
                  </th>
                  <th className="w-px whitespace-nowrap p-2 text-left font-medium">
                    Tryb
                  </th>
                  <th className="w-px whitespace-nowrap p-2 text-left font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {existingFiltered.map((o) => (
                  <tr
                    key={o.id}
                    className={`cursor-pointer border-t border-gray-200 transition-colors hover:bg-stone-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60 ${
                      obsSelectedId === o.id
                        ? "bg-blue-50/60 dark:bg-blue-900/20"
                        : ""
                    }`}
                    onClick={() => setObsSelectedId(o.id)}
                  >
                    <td className="w-px whitespace-nowrap p-2">
                      <input
                        type="radio"
                        name="obsPick"
                        checked={obsSelectedId === o.id}
                        onChange={() => setObsSelectedId(o.id)}
                      />
                    </td>
                    <td className="w-px whitespace-nowrap p-2">
                      {o.match || "—"}
                    </td>
                    <td className="w-px whitespace-nowrap p-2">
                      {o.player || "—"}
                    </td>
                    <td className="w-px whitespace-nowrap p-2">
                      {[o.date || "—", o.time || ""].filter(Boolean).join(" ")}
                    </td>
                    <td className="w-px whitespace-nowrap p-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                          // @ts-ignore
                          (o as any).mode === "tv"
                            ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                        }`}
                      >
                        {(o as any).mode === "tv" ? "TV" : "Live"}
                      </span>
                    </td>
                    <td className="w-px whitespace-nowrap p-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                          o.status === "final"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                        }`}
                      >
                        {o.status === "final" ? "Finalna" : "Szkic"}
                      </span>
                    </td>
                  </tr>
                ))}
                {existingFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-sm text-dark dark:text-neutral-400"
                    >
                      Brak obserwacji dla podanych kryteriów.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            </div>

            <div className="flex flex-wrap items-start justify-between">
              <Button
                variant="outline"
                className="border-gray-300 dark:border-neutral-700"
                onClick={onBack}
              >
                <ArrowLeft className="mr-0 md:mr-2 h-4 w-4" />
                Wróć
              </Button>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-gray-300 dark:border-neutral-700"
                      disabled={obsSelectedId == null}
                      onClick={onDuplicate}
                    >
                      Skopiuj do zawodnika
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Utwórz kopię wskazanej obserwacji
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="bg-gray-900 text-white hover:bg-gray-800"
                      disabled={obsSelectedId == null}
                      onClick={onReassign}
                    >
                      Przypisz do zawodnika
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Zmień przypisanie bez kopiowania
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
