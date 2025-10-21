// src/features/players/MyPlayersFeature.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import type { Player, Observation } from "@/shared/types";
import {
  PlusCircle, Pencil, Undo2, Trash2, ListFilter, ChevronUp, ChevronDown,
  ImageUp, Download, RotateCcw, PlusSquare, Search, ArrowLeft, X,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* =======================================
   Types & constants
======================================= */
type Pos = Player["pos"];
const POS: Pos[] = ["GK", "DF", "MF", "FW"];

const DEFAULT_COLS = {
  photo: true,
  select: true,
  name: true,
  club: true,
  pos: true,
  age: true,
  status: true,
  obs: true,
  actions: true,
};
type ColKey = keyof typeof DEFAULT_COLS;

type KnownScope = "known" | "unknown" | "all";
type Scope = "active" | "trash";
type SortKey = "name" | "club" | "pos" | "age" | "status" | "obs";
type SortDir = "asc" | "desc";
type Density = "comfortable" | "compact";

const UI_KEY = "s4s.players.ui";

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

  // Content swap inside table region
  const [content, setContent] = useState<"table" | "quick">("table");
  const [quickFor, setQuickFor] = useState<Player | null>(null);
  const [quickTab, setQuickTab] = useState<"new" | "existing">("new");

  // Restored UI state
  const [scope, setScope] = useState<Scope>("active");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
const [pos, setPos] = useState<Record<Pos, boolean>>({
  GK: true,
  DF: true,
  MF: true,
  FW: true,
  RB: true,
  CB: true,
  CW: true,
  LW: true,
  CM: true,
  "?": true,
});  const [club, setClub] = useState("");
  const [ageMin, setAgeMin] = useState<number | "">("");
  const [ageMax, setAgeMax] = useState<number | "">("");
  const [colsOpen, setColsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState({ ...DEFAULT_COLS });
  const [knownScope, setKnownScope] = useState<KnownScope>("known");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<number>>(new Set());

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

  // Refs
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Load UI prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u.scope) setScope(u.scope);
      if (u.knownScope) setKnownScope(u.knownScope);
      if (u.q) setQ(u.q);
      if (u.pos) setPos(u.pos);
      if (typeof u.club === "string") setClub(u.club);
      if (u.ageMin ?? false) setAgeMin(u.ageMin);
      if (u.ageMax ?? false) setAgeMax(u.ageMax);
      if (u.visibleCols) setVisibleCols({ ...DEFAULT_COLS, ...u.visibleCols });
      if (u.sortKey) setSortKey(u.sortKey);
      if (u.sortDir) setSortDir(u.sortDir);
      
      if (u.pageSize) setPageSize(u.pageSize);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const ui = { scope, knownScope, q, pos, club, ageMin, ageMax, visibleCols, sortKey, sortDir,pageSize };
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch {}
  }, [scope, knownScope, q, pos, club, ageMin, ageMax, visibleCols, sortKey, sortDir, pageSize]);

  /* URL param -> tab sync */
  useEffect(() => {
    const tab = (searchParams?.get("tab") as KnownScope | null) ?? null;
    if (tab === "known" || tab === "unknown" || tab === "all") {
      setKnownScope(tab);
    } else {
      setKnownScope("known");
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

  // Base with obs count + known flag
  const withObsCount = useMemo(
    () =>
      players.map((p) => ({
        ...p,
        _obs: observations.filter((o) => o.player === p.name).length,
        _known: Boolean((p as any).firstName || (p as any).lastName),
      })),
    [players, observations]
  );

  // Apply all filters except known tab for per-tab counters
  const baseFilteredNoKnown = useMemo(() => {
    return withObsCount
      .filter((r) => r.status === scope)
      .filter((r) => (!q ? true : r.name.toLowerCase().includes(q.toLowerCase()) || r.club.toLowerCase().includes(q.toLowerCase())))
      .filter((r) => pos[r.pos])
      .filter((r) => (club ? r.club.toLowerCase().includes(club.toLowerCase()) : true))
      .filter((r) => (ageMin === "" ? true : r.age >= Number(ageMin)))
      .filter((r) => (ageMax === "" ? true : r.age <= Number(ageMax)));
  }, [withObsCount, scope, q, pos, club, ageMin, ageMax]);

  const tabCounts = useMemo(() => {
    const known = baseFilteredNoKnown.filter((r) => r._known).length;
    const unknown = baseFilteredNoKnown.filter((r) => !r._known).length;
    const all = baseFilteredNoKnown.length;
    return { known, unknown, all };
  }, [baseFilteredNoKnown]);

  // Final filtered (includes current knownScope)
  const filtered = useMemo(() => {
    let base = [...baseFilteredNoKnown];
    if (knownScope === "known") base = base.filter((r) => r._known);
    if (knownScope === "unknown") base = base.filter((r) => !r._known);

    base.sort((a: any, b: any) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let av: any; let bv: any;
      switch (sortKey) {
        case "name":
        case "club":
        case "pos":
          av = (a[sortKey] || "").toString().toLowerCase();
          bv = (b[sortKey] || "").toString().toLowerCase();
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        case "age":
          av = a.age || 0; bv = b.age || 0; return (av - bv) * dir;
        case "status":
          av = a.status === "active" ? 1 : 0; bv = b.status === "active" ? 1 : 0; return (av - bv) * dir;
        case "obs":
          av = a._obs || 0; bv = b._obs || 0; return (av - bv) * dir;
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
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  // ====== actions ======
function trash(id: number) {
  const next: Player[] = players.map(p =>
    p.id === id ? { ...p, status: 'trash' as Player['status'] } : p
  );
  onChangePlayers(next);
  setSelected(s => { const copy = new Set(s); copy.delete(id); return copy; });
}

function restore(id: number) {
  const next: Player[] = players.map(p =>
    p.id === id ? { ...p, status: 'active' as Player['status'] } : p
  );
  onChangePlayers(next);
  setSelected(s => { const copy = new Set(s); copy.delete(id); return copy; });
}

function bulkTrash() {
  const next: Player[] = players.map(p =>
    selected.has(p.id) ? { ...p, status: 'trash' as Player['status'] } : p
  );
  onChangePlayers(next);
  setSelected(new Set());
}

function bulkRestore() {
  const next: Player[] = players.map(p =>
    selected.has(p.id) ? { ...p, status: 'active' as Player['status'] } : p
  );
  onChangePlayers(next);
  setSelected(new Set());
}

  // exports
  function exportCSV() {
    const headers = ["id", "name", "club", "pos", "age", "status", "obs"];
    const rows = filtered.map((p) => [p.id, p.name, p.club, p.pos, p.age, p.status, (p as any)._obs]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "players.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function exportExcel() {
    const headers = ["ID", "Nazwa", "Klub", "Pozycja", "Wiek", "Status", "Obserwacje"];
    const rows = filtered.map((p) => [p.id, p.name, p.club, p.pos, p.age, p.status, (p as any)._obs]);
    const tableHtml =
      `<table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>` +
      rows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(String(c??""))}</td>`).join("")}</tr>`).join("") +
      `</tbody></table>`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${tableHtml}</body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "players.xls"; a.click(); URL.revokeObjectURL(url);
  }
  function escapeHtml(s: string) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // photos
  function handlePhotoChange(pId: number, file: File) {
    const url = URL.createObjectURL(file);
    const next = players.map((p) => (p.id === pId ? ({ ...p, photo: url } as any) : p));
    onChangePlayers(next);
  }

  // Quick area controls
  function openQuick(player: Player) {
    setQuickFor(player);
    setQuickTab("new");
    setQaMatch(""); setQaDate(""); setQaTime(""); setQaMode("live"); setQaStatus("draft");
    setObsQuery(""); setObsSelectedId(null);
    setContent("quick");
  }
  function closeQuick() {
    setContent("table");
    setQuickFor(null);
  }
  function appendObsLocalStorage(newObs: Observation) {
    try {
      const raw = localStorage.getItem("s4s.observations");
      const arr: Observation[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem("s4s.observations", JSON.stringify([newObs, ...arr]));
    } catch {}
  }
  function updateObsLocalStorage(targetId: number, patch: Partial<Observation>) {
    try {
      const raw = localStorage.getItem("s4s.observations");
      const arr: Observation[] = raw ? JSON.parse(raw) : [];
      const next = arr.map(o => o.id===targetId ? { ...o, ...patch } : o);
      localStorage.setItem("s4s.observations", JSON.stringify(next));
    } catch {}
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
    if (onQuickAddObservation) onQuickAddObservation(obs);
    else appendObsLocalStorage(obs);
    closeQuick();
  }
  function duplicateExistingToPlayer() {
    if (!quickFor || obsSelectedId == null) return;
    const base = observations.find(o => o.id === obsSelectedId);
    if (!base) return;
    const copy: Observation = { ...base, id: Date.now(), player: quickFor.name };
    if (onQuickAddObservation) onQuickAddObservation(copy);
    else appendObsLocalStorage(copy);
    closeQuick();
  }
  function reassignExistingToPlayer() {
    if (!quickFor || obsSelectedId == null) return;
    updateObsLocalStorage(obsSelectedId, { player: quickFor.name });
    closeQuick();
  }

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (q.trim()) chips.push({ key: "q", label: `Szukaj: “${q.trim()}”`, clear: () => { setQ(""); setPage(1); } });
    const posInactive = POS.filter(p => !pos[p]);
    if (posInactive.length) chips.push({
      key: "pos",
      label: `Pozycje: ${POS.filter(p => pos[p]).join(", ")}`,
clear: () => {
  setPos({
    GK: true, DF: true, MF: true, FW: true,
    RB: true, CB: true, CW: true, LW: true, CM: true, "?": true,
  });
  setPage(1);
},
    });
    if (club.trim()) chips.push({ key: "club", label: `Klub: ${club.trim()}`, clear: () => { setClub(""); setPage(1); } });
    if (ageMin !== "") chips.push({ key: "ageMin", label: `Wiek ≥ ${ageMin}`, clear: () => { setAgeMin(""); setPage(1); } });
    if (ageMax !== "") chips.push({ key: "ageMax", label: `Wiek ≤ ${ageMax}`, clear: () => { setAgeMax(""); setPage(1); } });
    if (knownScope !== "all") chips.push({
      key: "known",
      label: knownScope === "known" ? "Znani" : "Nieznani",
      clear: () => changeKnownScope("all"),
    });
    return chips;
  }, [q, pos, club, ageMin, ageMax, knownScope]);

  // Density helpers
 const cellPad = "p-3";
const rowH = "h-12";

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (e as any).isComposing;
      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/players/new");
      } else if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        exportCSV();
      } else if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        setColsOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Baza zawodników" }]} />

      {/* TOOLBAR */}
      <Toolbar
        title="Baza zawodników"
        right={
          <div className="flex flex-wrap items-center gap-3">
            {/* active / trash */}
            <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700">
              {(["active", "trash"] as const).map((s) => (
                <button
                  key={s}
                  className={`px-3 py-2 text-sm ${scope === s ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`}
                  onClick={() => { setScope(s); setSelected(new Set()); setPage(1); }}
                >
                  {s === "active" ? "aktywni" : "kosz"}
                </button>
              ))}
            </div>

            {/* search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Szukaj po nazwisku/klubie… (/) "
                className="w-64 pl-8"
                aria-label="Szukaj w bazie zawodników"
              />
            </div>

            {/* filters */}
            <div className="relative">
              <Button variant="outline" className="border-gray-300 px-3 py-2 dark:border-neutral-700" onClick={() => setFiltersOpen((v) => !v)}>
                <ListFilter className="mr-2 h-4 w-4" />
                Filtry
              </Button>
              {filtersOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 w-96 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="mb-2 text-xs font-medium text-gray-500 dark:text-neutral-400">Pozycje</div>
                  <div className="mb-3 grid grid-cols-4 gap-2">
                    {POS.map((p) => (
                      <label key={p} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-gray-50 dark:hover:bg-neutral-800">
                        <span>{p}</span>
                        <input type="checkbox" checked={pos[p]} onChange={(e) => { setPos((prev) => ({ ...prev, [p]: e.target.checked })); setPage(1); }} />
                      </label>
                    ))}
                  </div>
                  <div className="mb-3">
                    <Label className="text-xs text-gray-600 dark:text-neutral-300">Klub</Label>
                    <Input value={club} onChange={(e) => { setClub(e.target.value); setPage(1); }} className="mt-1 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600 dark:text-neutral-300">Wiek min</Label>
                      <Input type="number" value={ageMin} onChange={(e) => { setAgeMin(e.target.value === "" ? "" : Number(e.target.value)); setPage(1); }} className="mt-1 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 dark:text-neutral-300">Wiek max</Label>
                      <Input type="number" value={ageMax} onChange={(e) => { setAgeMax(e.target.value === "" ? "" : Number(e.target.value)); setPage(1); }} className="mt-1 border-gray-300 dark:border-neutral-700 dark:bg-neutral-950" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={()=>{
setPos({
  GK: true, DF: true, MF: true, FW: true,
  RB: true, CB: true, CW: true, LW: true, CM: true, "?": true,
});
setClub("");
setAgeMin("");
setAgeMax("");
setQ("");
changeKnownScope("all");
setPage(1);
                    }}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Resetuj wszystko
                    </Button>
                    <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => setFiltersOpen(false)}>
                      Zastosuj
                    </Button>
                  </div>
                </div>
              )}
            </div>



            {/* columns */}
            <ColumnsButton
              open={colsOpen}
              setOpen={setColsOpen}
              visibleCols={visibleCols}
              setVisibleCols={(next) => setVisibleCols(next)}
            />

            {/* export */}
            <Button variant="outline" className="border-gray-300 px-3 py-2 dark:border-neutral-700" onClick={exportCSV} title="Skrót: E">
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" className="border-gray-300 px-3 py-2 dark:border-neutral-700" onClick={exportExcel}>
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>

            {/* add player */}
            <Button className="bg-gray-900 px-4 py-2 text-white hover:bg-gray-800" onClick={() => router.push("/players/new")} title="Skrót: N">
              <PlusCircle className="mr-2 h-4 w-4" />
              Dodaj
            </Button>
          </div>
        }
      />

      {/* Tabs with counts */}
      <div className="mt-3">
        <Tabs value={knownScope} onValueChange={(v) => changeKnownScope(v as KnownScope)}>
          <TabsList className="rounded-lg bg-gray-50 p-1 shadow-sm dark:bg-neutral-900">
            <TabsTrigger value="known" className="px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800">
              Znani <span className="ml-2 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{tabCounts.known}</span>
            </TabsTrigger>
            <TabsTrigger value="unknown" className="px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800">
              Nieznani <span className="ml-2 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{tabCounts.unknown}</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800">
              Wszyscy <span className="ml-2 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{tabCounts.all}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="known" />
          <TabsContent value="unknown" />
          <TabsContent value="all" />
        </Tabs>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map((c) => (
            <button
              key={c.key}
              onClick={c.clear}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-900"
              title="Wyczyść filtr"
            >
              <X className="h-3 w-3" />
              {c.label}
            </button>
          ))}
          <button
            onClick={()=>{
setPos({ GK:true, DF:true, MF:true, FW:true, RB:true, CB:true, CW:true, LW:true, CM:true, "?":true });
              setClub(""); setAgeMin(""); setAgeMax(""); setQ(""); changeKnownScope("all"); setPage(1);
            }}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
            title="Wyczyść wszystkie filtry"
          >
            <RotateCcw className="h-3 w-3" /> Wyczyść wszystkie
          </button>
        </div>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && content === "table" && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div>Zaznaczono: <b>{selected.size}</b></div>
          <div className="flex items-center gap-2">
            {scope === "active" ? (
              <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={bulkTrash}>
                <Trash2 className="mr-2 h-4 w-4" /> Do kosza
              </Button>
            ) : (
              <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={bulkRestore}>
                <Undo2 className="mr-2 h-4 w-4" /> Przywróć
              </Button>
            )}
          </div>
        </div>
      )}

      {/* CONTENT REGION */}
      <div className="mt-3">
        {content === "table" ? (
          <>
            <PlayersTable
              rows={paginated}
              observations={observations}
              visibleCols={visibleCols}
              selected={selected}
              setSelected={setSelected}
              scope={scope}
              onOpen={(id) => router.push(`/players/${id}`)}
              onTrash={trash}
              onRestore={restore}
              onSortChange={(k, d) => { setSortKey(k); setSortDir(d); }}
              sortKey={sortKey}
              sortDir={sortDir}
              onPhotoChange={handlePhotoChange}
              onQuick={(p) => openQuick(p)}
              cellPad={cellPad}
              rowH={rowH}
              pageSliceCount={paginated.length}
            />

            {/* Pagination footer */}
            <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-950 md:flex-row">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-neutral-300">Wiersze na stronę:</span>
                <select
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={pageSize}
                  onChange={(e)=>{ setPageSize(Number(e.target.value) as any); setPage(1); }}
                >
                  {[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                <span className="ml-2 text-gray-600 dark:text-neutral-300">
                  {total === 0 ? "0" : ((currentPage - 1) * pageSize + 1)}–{Math.min(currentPage * pageSize, total)} z {total}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-gray-300 dark:border-neutral-700"
                  disabled={currentPage <= 1}
                  onClick={()=>setPage((p)=>Math.max(1, p-1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Poprzednia
                </Button>
                <div className="min-w-[80px] text-center">
                  Strona {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  className="border-gray-300 dark:border-neutral-700"
                  disabled={currentPage >= totalPages}
                  onClick={()=>setPage((p)=>Math.min(totalPages, p+1))}
                >
                  Następna <ChevronRight className="ml-1 h-4 w-4" />
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
            observations={observations}
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
  );
}

/* =======================================
   Table
======================================= */
function PlayersTable({
  rows,
  observations,
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
  onPhotoChange,
  onQuick,
  cellPad,
  rowH,
  pageSliceCount,
}: {
  rows: (Player & { _known: boolean; _obs: number })[];
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
  onPhotoChange: (id: number, file: File) => void;
  onQuick: (p: Player) => void;
  cellPad: string;
  rowH: string;
  pageSliceCount: number;
}) {
  const allChecked = pageSliceCount > 0 && rows.every((r) => selected.has(r.id));
  const someChecked = !allChecked && rows.some((r) => selected.has(r.id));

  function SortHeader({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <button
        className={"flex items-center gap-1 font-medium " + (active ? "text-gray-900 dark:text-neutral-100" : "")}
        onClick={() => onSortChange(k, active && sortDir === "asc" ? "desc" : "asc")}
      >
        {children}
        {active ? (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
      </button>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? ""; const last = parts.length > 1 ? parts[parts.length-1][0] ?? "" : "";
    return (first + last).toUpperCase();
  };

  const getJerseyNo = (name: string) => {
    const m = name.match(/#(\d{1,3})/);
    return m ? m[1] : null;
  };

  const KnownBadge = ({ known }: { known: boolean }) => (
    <span className={"inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium " + (known ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200")}>
      {known ? "znany" : "nieznany"}
    </span>
  );

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
          <tr>
            {visibleCols.photo && <th className={`${cellPad} text-left font-medium w-16`}>Foto</th>}
            {visibleCols.select && (
              <th className={`${cellPad} text-left font-medium w-9`}>
                <input
                  type="checkbox"
                  aria-checked={(!rows.length ? false : undefined) || (someChecked ? "mixed" : undefined)}
                  checked={pageSliceCount > 0 && rows.every((r) => selected.has(r.id))}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set([...selected, ...rows.map((f) => f.id)]));
                    else {
                      const set = new Set(selected);
                      rows.forEach(r => set.delete(r.id));
                      setSelected(set);
                    }
                  }}
                />
              </th>
            )}
            {visibleCols.name && <th className={`${cellPad} text-left`}><SortHeader k="name">Nazwa</SortHeader></th>}
            {visibleCols.club && <th className={`${cellPad} text-left`}><SortHeader k="club">Klub</SortHeader></th>}
            {visibleCols.pos && <th className={`${cellPad} text-left`}><SortHeader k="pos">Pozycja</SortHeader></th>}
            {visibleCols.age && <th className={`${cellPad} text-left`}><SortHeader k="age">Wiek</SortHeader></th>}
            {visibleCols.status && <th className={`${cellPad} text-left font-medium`}>Status</th>}
            {visibleCols.obs && <th className={`${cellPad} text-left`}><SortHeader k="obs">Obserwacje</SortHeader></th>}
            {visibleCols.actions && <th className={`${cellPad} text-right font-medium`}>Akcje</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const jersey = !r._known ? getJerseyNo(r.name) : null;
            return (
              <tr
                key={r.id}
                className={`group border-t border-gray-200 dark:border-neutral-800 hover:bg-gray-50/60 dark:hover:bg-neutral-900/60 ${rowH}`}
                onDoubleClick={() => onOpen(r.id)}
              >
                {visibleCols.photo && (
                  <td className={cellPad}>
                    <div className="relative">
                      {!r._known ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-xs ring-1 ring-black/5 dark:bg-neutral-800">
                          <svg className="h-5 w-5 text-gray-800 dark:text-neutral-200" viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M13.5867 2.30659L10.6667 1.33325C10.6667 2.0405 10.3857 2.71877 9.88565 3.21887C9.38555 3.71897 8.70727 3.99992 8.00003 3.99992C7.29278 3.99992 6.61451 3.71897 6.11441 3.21887C5.61431 2.71877 5.33336 2.0405 5.33336 1.33325L2.41336 2.30659C2.11162 2.40711 1.85575 2.6122 1.69193 2.88481C1.52811 3.15743 1.46715 3.47963 1.52003 3.79325L1.90669 6.10659C1.93208 6.26319 2.01248 6.40562 2.13345 6.50826C2.25443 6.61091 2.40804 6.66704 2.56669 6.66659H4.00003V13.3333C4.00003 14.0666 4.60003 14.6666 5.33336 14.6666H10.6667C11.0203 14.6666 11.3595 14.5261 11.6095 14.2761C11.8596 14.026 12 13.6869 12 13.3333V6.66659H13.4334C13.592 6.66704 13.7456 6.61091 13.8666 6.50826C13.9876 6.40562 14.068 6.26319 14.0934 6.10659L14.48 3.79325C14.5329 3.47963 14.4719 3.15743 14.3081 2.88481C14.1443 2.6122 13.8884 2.40711 13.5867 2.30659Z" stroke="currentColor" strokeWidth="0.222" strokeLinecap="round" strokeLinejoin="round" fill="none"></path>
                          </svg>
                          {jersey && (
                            <span className="absolute -bottom-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-neutral-950">
                              {jersey}
                            </span>
                          )}
                        </div>
                      ) : r.photo ? (
                        <img src={r.photo} alt={r.name} className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5" loading="lazy" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 ring-1 ring-black/5 dark:bg-neutral-800 dark:text-neutral-200">
                          {getInitials(r.name)}
                        </div>
                      )}
                      {r._known && (
                        <label className="absolute -bottom-1 -right-1 hidden cursor-pointer items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] shadow ring-1 ring-black/5 group-hover:flex dark:bg-neutral-800">
                          <ImageUp className="h-3 w-3" />
                          Zmień
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onPhotoChange(r.id, file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </td>
                )}

                {visibleCols.select && (
                  <td className={cellPad}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) => {
                        const copy = new Set(selected);
                        if (e.target.checked) copy.add(r.id); else copy.delete(r.id);
                        setSelected(copy);
                      }}
                    />
                  </td>
                )}

                {visibleCols.name && (
                  <td className={`${cellPad} text-gray-900 dark:text-neutral-100`}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{r.name}</span>
                      <KnownBadge known={r._known} />
                    </div>
                  </td>
                )}
                {visibleCols.club && <td className={`${cellPad} text-gray-700 dark:text-neutral-200`}>{r.club}</td>}
                {visibleCols.pos && (
                  <td className={cellPad}>
                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                      {r.pos}
                    </span>
                  </td>
                )}
                {visibleCols.age && <td className={`${cellPad} text-gray-700 dark:text-neutral-200`}>{r.age}</td>}
                {visibleCols.status && (
                  <td className={cellPad}>
                    <span className={"inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium " + (r.status === "active" ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200")}>
                      {r.status === "active" ? "aktywny" : "w koszu"}
                    </span>
                  </td>
                )}
                {visibleCols.obs && (
                  <td className={cellPad}>
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      {r._obs}
                    </span>
                  </td>
                )}
                {visibleCols.actions && (
                  <td className={`${cellPad} text-right`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mr-2 h-8 border-gray-300 px-3 dark:border-neutral-700"
                      onClick={() => onQuick(r)}
                      title="Szybka obserwacja / Wybierz istniejącą"
                    >
                      <PlusSquare className="mr-1 h-4 w-4" />
                      Obs
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mr-2 h-8 border-gray-300 px-3 dark:border-neutral-700"
                      onClick={() => onOpen(r.id)}
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      {r._known ? "Edytuj" : "Uzupełnij dane"}
                    </Button>
                    {scope === "active" ? (
                      <Button size="sm" className="h-8 bg-gray-900 px-3 text-white hover:bg-gray-800" onClick={() => onTrash(r.id)}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Do kosza
                      </Button>
                    ) : (
                      <Button size="sm" className="h-8 bg-gray-900 px-3 text-white hover:bg-gray-800" onClick={() => onRestore(r.id)}>
                        <Undo2 className="mr-1 h-4 w-4" />
                        Przywróć
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={Object.values(visibleCols).filter(Boolean).length || 1}
                className={`${cellPad} text-center text-sm text-gray-500 dark:text-neutral-400`}
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

/* Columns popover */
function ColumnsButton({
  open, setOpen, visibleCols, setVisibleCols,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  visibleCols: Record<keyof typeof DEFAULT_COLS, boolean>;
  setVisibleCols: (v: Record<keyof typeof DEFAULT_COLS, boolean>) => void;
}) {
  return (
    <div className="relative">
      <Button variant="outline" className="border-gray-300 px-3 py-2 dark:border-neutral-700" onClick={() => setOpen(!open)}>
        Kolumny
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-2 text-xs font-medium text-gray-500 dark:text-neutral-400">Widoczność kolumn</div>
          {Object.keys(DEFAULT_COLS).map((k) => {
            const key = k as ColKey;
            return (
              <label key={key} className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                <span className="capitalize text-gray-800 dark:text-neutral-100">{key}</span>
                <input
                  type="checkbox"
                  checked={visibleCols[key]}
                  onChange={(e) => setVisibleCols({ ...visibleCols, [key]: e.target.checked })}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =======================================
   Quick Observation (unchanged core)
======================================= */
function QuickObservation({
  player,
  onBack,
  quickTab, setQuickTab,
  qaMatch, setQaMatch,
  qaDate, setQaDate,
  qaTime, setQaTime,
  qaMode, setQaMode,
  qaStatus, setQaStatus,
  onSaveNew,
  observations, obsQuery, setObsQuery, obsSelectedId, setObsSelectedId,
  onDuplicate, onReassign,
}: {
  player: Player;
  onBack: () => void;
  quickTab: "new" | "existing";
  setQuickTab: (t: "new" | "existing") => void;
  qaMatch: string; setQaMatch: (v: string) => void;
  qaDate: string; setQaDate: (v: string) => void;
  qaTime: string; setQaTime: (v: string) => void;
  qaMode: "live"|"tv"; setQaMode: (v: "live"|"tv") => void;
  qaStatus: Observation["status"]; setQaStatus: (v: Observation["status"]) => void;
  onSaveNew: () => void;
  observations: Observation[];
  obsQuery: string; setObsQuery: (v: string) => void;
  obsSelectedId: number | null; setObsSelectedId: (v: number | null) => void;
  onDuplicate: () => void; onReassign: () => void;
}) {
  const existingFiltered = useMemo(() => {
    const q = obsQuery.trim().toLowerCase();
    const arr = [...observations].sort((a, b) => ( (b.date||"") + (b.time||"") ).localeCompare( (a.date||"") + (a.time||"") ));
    if (!q) return arr;
    return arr.filter(o =>
      (o.match || "").toLowerCase().includes(q) ||
      (o.player || "").toLowerCase().includes(q) ||
      (o.date || "").includes(q)
    );
  }, [observations, obsQuery]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-neutral-300">
          <span className="font-medium">Szybka obserwacja:</span> {player.name}
        </div>
        <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Wróć
        </Button>
      </div>

      <Tabs value={quickTab} onValueChange={(v)=>setQuickTab(v as "new"|"existing")}>
        <TabsList className="mb-3 rounded-lg bg-gray-50 p-1 shadow-sm dark:bg-neutral-900">
          <TabsTrigger value="new" className="px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800">
            Nowa
          </TabsTrigger>
          <TabsTrigger value="existing" className="px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800">
            Istniejąca
          </TabsTrigger>
        </TabsList>

        {/* NEW */}
        <TabsContent value="new" className="space-y-3">
          <div>
            <Label>Mecz (kto vs kto)</Label>
            <Input value={qaMatch} onChange={(e) => setQaMatch(e.target.value)} placeholder="np. U19: Lech vs Wisła" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={qaDate} onChange={(e) => setQaDate(e.target.value)} />
            </div>
            <div>
              <Label>Godzina</Label>
              <Input type="time" value={qaTime} onChange={(e) => setQaTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tryb</Label>
              <div className="inline-flex overflow-hidden rounded-md border">
                {(["live", "tv"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setQaMode(m)}
                    className={`px-3 py-1 text-sm ${qaMode === m ? "bg-blue-600 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`}
                  >
                    {m === "live" ? "Live" : "TV"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <div className="inline-flex overflow-hidden rounded-md border">
                {(["draft", "final"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setQaStatus(s)}
                    className={`px-3 py-1 text-sm ${qaStatus === s ? "bg-green-600 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`}
                  >
                    {s === "draft" ? "Szkic" : "Finalna"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={onSaveNew}>
              Zapisz
            </Button>
          </div>
        </TabsContent>

        {/* EXISTING */}
        <TabsContent value="existing" className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input value={obsQuery} onChange={(e) => setObsQuery(e.target.value)} placeholder="Szukaj po meczu, zawodniku, dacie…" />
          </div>

          <div className="max-h-80 overflow-auto rounded-md border border-gray-200 dark:border-neutral-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
                <tr>
                  <th className="p-2 text-left font-medium">#</th>
                  <th className="p-2 text-left font-medium">Mecz</th>
                  <th className="p-2 text-left font-medium">Zawodnik</th>
                  <th className="p-2 text-left font-medium">Data</th>
                  <th className="p-2 text-left font-medium">Tryb</th>
                  <th className="p-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {existingFiltered.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-t border-gray-200 dark:border-neutral-800 hover:bg-gray-50/60 dark:hover:bg-neutral-900/60 ${obsSelectedId === o.id ? "bg-blue-50/60 dark:bg-blue-900/20" : ""}`}
                    onClick={() => setObsSelectedId(o.id)}
                  >
                    <td className="p-2">
                      <input type="radio" name="obsPick" checked={obsSelectedId === o.id} onChange={() => setObsSelectedId(o.id)} />
                    </td>
                    <td className="p-2">{o.match || "—"}</td>
                    <td className="p-2">{o.player || "—"}</td>
                    <td className="p-2">{[o.date || "—", o.time || ""].filter(Boolean).join(" ")}</td>
                    <td className="p-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        // @ts-ignore
                        (o as any).mode === "tv" ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                      }`}>
                        {/* @ts-ignore */}
                        {(o as any).mode === "tv" ? "TV" : "Live"}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.status === "final" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                      }`}>
                        {o.status === "final" ? "Finalna" : "Szkic"}
                      </span>
                    </td>
                  </tr>
                ))}
                {existingFiltered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-3 text-center text-xs text-gray-500 dark:text-neutral-400">
                      Brak obserwacji.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Wróć
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="border-gray-300 dark:border-neutral-700" disabled={obsSelectedId == null} onClick={onDuplicate}>
                Skopiuj do zawodnika
              </Button>
              <Button className="bg-gray-900 text-white hover:bg-gray-800" disabled={obsSelectedId == null} onClick={onReassign}>
                Przypisz do zawodnika
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
