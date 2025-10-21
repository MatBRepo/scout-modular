// src/features/observations/Observations.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { Crumb, Toolbar, GrayTag } from "@/shared/ui/atoms";
import type { Observation } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
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
} from "lucide-react";
import { ObservationEditor } from "./ObservationEditor";

/* -------------------------------- Types -------------------------------- */

type Bucket = "active" | "trash";
type Mode = "live" | "tv";

type ObsPlayer = {
  id: string;
  type: "known" | "unknown";
  name?: string;
  shirtNo?: string;
  minutes?: number;
  position?: string;
  overall?: number;
  voiceUrl?: string | null;
  note?: string;
  ratings: { off: number; def: number; tech: number; motor: number };
};

type XO = Observation & {
  bucket?: Bucket;
  mode?: Mode;
  voiceUrl?: string | null;
  note?: string;
  players?: ObsPlayer[];
};

const DEFAULT_COLS = {
  select: false,
  match: true,
  date: true,
  time: true,
  mode: true,
  status: true,
  bucket: true,
  players: true,
  actions: true,
};
type ColKey = keyof typeof DEFAULT_COLS;

type SortKey = "match" | "date" | "time" | "mode" | "status" | "players";
type SortDir = "asc" | "desc";

const UI_KEY = "s4s.observations.ui";
const SEED_FLAG = "s4s.observations.demoSeeded";

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

/* =============================== Feature ================================ */

export default function ObservationsFeature({
  data,
  onChange,
}: {
  data: Observation[];
  onChange: (next: Observation[]) => void;
}) {
  // Extend incoming rows—non-destructive
  const rows: XO[] = (data as XO[]).map((o) => ({
    bucket: "active",
    mode: "live",
    players: [],
    ...o,
  }));

  // ====== page state ======
  const [pageMode, setPageMode] = useState<"list" | "editor">("list");
  const [editing, setEditing] = useState<XO | null>(null);

  // ---- DEMO SEED: if empty -> create examples once and open editor
  useEffect(() => {
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
                voiceUrl: null,
                ratings: { off: 4, def: 3, tech: 4, motor: 5 },
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
                voiceUrl: null,
                ratings: { off: 3, def: 3, tech: 4, motor: 4 },
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
                voiceUrl: null,
                ratings: { off: 3, def: 5, tech: 4, motor: 4 },
              },
            ],
          },
        ];
        onChange(demo as unknown as Observation[]);
        localStorage.setItem(SEED_FLAG, "1");
        // Open first demo in editor right away
        setEditing(demo[0]);
        setPageMode("editor");
      }
    } catch {}
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // toolbar state (persisted)
  const [tabScope, setTabScope] = useState<Bucket>("active");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);

  const [matchFilter, setMatchFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<Mode | "">("");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<Observation["status"] | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [visibleCols, setVisibleCols] = useState({ ...DEFAULT_COLS });

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // load persisted UI
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (!raw) return;
      const u = JSON.parse(raw);
      if (u.tabScope) setTabScope(u.tabScope);
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
        tabScope,
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
    tabScope,
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

  // ====== computed list ======
  const filtered = useMemo(() => {
    let base = rows
      .filter((r) => (r.bucket ?? "active") === tabScope)
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
        matchFilter ? (r.match ?? "").toLowerCase().includes(matchFilter.toLowerCase()) : true
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
            return a.status;
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
            return b.status;
          case "players":
            return b.players?.length ?? 0;
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
    tabScope,
    q,
    matchFilter,
    modeFilter,
    lifecycleFilter,
    dateFrom,
    dateTo,
    sortKey,
    sortDir,
  ]);

  // ====== actions ======
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
      note: "",
      voiceUrl: null,
      players: [],
    });
    setPageMode("editor");
  }

  function save(obs: XO) {
    const exists = rows.some((x) => x.id === obs.id);
    let next: XO[];
    if (exists) {
      next = rows.map((x) => (x.id === obs.id ? obs : x));
    } else {
      const nextId = Math.max(0, ...rows.map((x) => x.id)) + 1;
      next = [{ ...obs, id: nextId }, ...rows];
    }
    onChange(next as unknown as Observation[]);
    setPageMode("list");
    setEditing(null);
  }

  function moveToTrash(id: number) {
    const next = rows.map((x) => (x.id === id ? { ...x, bucket: "trash" as Bucket } : x));
    onChange(next as unknown as Observation[]);
  }
  function restoreFromTrash(id: number) {
    const next = rows.map((x) => (x.id === id ? { ...x, bucket: "active" as Bucket } : x));
    onChange(next as unknown as Observation[]);
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

  // export
  function exportCSV() {
    const headers = ["id", "match", "date", "time", "mode", "status", "bucket", "players"];
    const rowsCsv = filtered.map((r) => [
      r.id,
      r.match ?? "",
      r.date ?? "",
      r.time ?? "",
      r.mode ?? "live",
      r.status,
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
    const headers = ["ID", "Mecz", "Data", "Godzina", "Tryb", "Status", "Kosz", "Zawodnicy"];
    const rowsX = filtered.map((r) => [
      r.id,
      r.match ?? "",
      r.date ?? "",
      r.time ?? "",
      r.mode ?? "live",
      r.status,
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
    if (q.trim()) chips.push({ key: "q", label: `Szukaj: “${q.trim()}”`, clear: () => setQ("") });
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
      chips.push({ key: "from", label: `Od: ${fmtDate(dateFrom)}`, clear: () => setDateFrom("") });
    if (dateTo)
      chips.push({ key: "to", label: `Do: ${fmtDate(dateTo)}`, clear: () => setDateTo("") });
    return chips;
  }, [q, matchFilter, modeFilter, lifecycleFilter, dateFrom, dateTo]);

  function SortHeader({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <button
        className={
          "flex items-center gap-1 font-medium " +
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

  if (pageMode === "editor" && editing) {
    return (
      <ObservationEditor
        initial={editing}
        onSave={save}
        onClose={() => {
          setPageMode("list");
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Obserwacje" }]} />
      <Toolbar
        title="Obserwacje"
        right={
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700">
              {(["active", "trash"] as const).map((s) => (
                <button
                  key={s}
                  className={`px-3 py-2 text-sm ${
                    tabScope === s
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"
                  }`}
                  onClick={() => setTabScope(s)}
                >
                  {s === "active" ? "aktywne" : "kosz"}
                </button>
              ))}
            </div>

            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Szukaj po meczu lub zawodnikach…"
              className="w-64"
            />

            <div className="relative">
              <Button
                variant="outline"
                className="border-gray-300 px-3 py-2 dark:border-neutral-700"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <ListFilter className="mr-2 h-4 w-4" />
                Filtry
              </Button>
              {filtersOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 w-[22rem] rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="mb-3">
                    <Label className="text-xs">Mecz (kto vs kto)</Label>
                    <Input
                      value={matchFilter}
                      onChange={(e) => setMatchFilter(e.target.value)}
                      className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Data od</Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data do</Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Tryb</Label>
                      <select
                        value={modeFilter}
                        onChange={(e) => setModeFilter(e.target.value as Mode | "")}
                        className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
                        className="mt-1 w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
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
                      className="border-gray-300 dark:border-neutral-700"
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
                      className="bg-gray-900 text-white hover:bg-gray-800"
                      onClick={() => setFiltersOpen(false)}
                    >
                      Zastosuj
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <ColumnsButton
              open={colsOpen}
              setOpen={setColsOpen}
              visibleCols={visibleCols}
              setVisibleCols={setVisibleCols}
            />

            <Button
              variant="outline"
              className="border-gray-300 px-3 py-2 dark:border-neutral-700"
              onClick={exportCSV}
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline"
              className="border-gray-300 px-3 py-2 dark:border-neutral-700"
              onClick={exportExcel}
            >
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>

            <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={addNew}>
              <PlusCircle className="mr-2 h-4 w-4" /> Dodaj
            </Button>
          </div>
        }
      />

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
            onClick={() => {
              setMatchFilter("");
              setModeFilter("");
              setLifecycleFilter("");
              setDateFrom("");
              setDateTo("");
              setQ("");
            }}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
            title="Wyczyść wszystkie filtry"
          >
            <X className="h-3 w-3" /> Wyczyść wszystkie
          </button>
        </div>
      )}

      <div className="mt-3 w-full overflow-x-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
            <tr>
              {visibleCols.select && <th className="p-3 text-left font-medium">#</th>}
              {visibleCols.match && (
                <th className="p-3 text-left">
                  <SortHeader k="match">Obserwowany mecz</SortHeader>
                </th>
              )}
              {visibleCols.date && (
                <th className="p-3 text-left">
                  <SortHeader k="date">Data</SortHeader>
                </th>
              )}
              {visibleCols.time && (
                <th className="p-3 text-left">
                  <SortHeader k="time">Godzina</SortHeader>
                </th>
              )}
              {visibleCols.mode && (
                <th className="p-3 text-left">
                  <SortHeader k="mode">Tryb</SortHeader>
                </th>
              )}
              {visibleCols.status && (
                <th className="p-3 text-left">
                  <SortHeader k="status">Status</SortHeader>
                </th>
              )}
              {visibleCols.bucket && <th className="p-3 text-left font-medium">Kosz</th>}
              {visibleCols.players && (
                <th className="p-3 text-left">
                  <SortHeader k="players">Zawodnicy</SortHeader>
                </th>
              )}
              {visibleCols.actions && <th className="p-3 text-right font-medium">Akcje</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const bucket = r.bucket ?? "active";
              const status = r.status;
              const mode = r.mode ?? "live";
              const pCount = r.players?.length ?? 0;

              return (
                <tr
                  key={r.id}
                  className="group border-t border-gray-200 dark:border-neutral-800 hover:bg-gray-50/60 dark:hover:bg-neutral-900/60 h-12"
                >
                  {visibleCols.select && <td className="p-3">•</td>}

                  {visibleCols.match && (
                    <td className="p-3">
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
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                              mode === "live"
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                            }`}
                          >
                            {mode === "live" ? "Live" : "TV"}
                          </span>
                          <span
                            title="Status"
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                              status === "final"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}
                          >
                            {status === "final" ? "Finalna" : "Szkic"}
                          </span>
                          {pCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                              {pCount} zawodn.
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  )}

                  {visibleCols.date && <td className="p-3">{fmtDate(r.date)}</td>}
                  {visibleCols.time && <td className="p-3">{r.time || "—"}</td>}

                  {visibleCols.mode && (
                    <td className="p-3">
                      <button
                        onClick={() => toggleModeInline(r.id)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition ${
                          mode === "live"
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "bg-violet-600 text-white hover:bg-violet-700"
                        }`}
                        title="Przełącz Live/TV"
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
                    <td className="p-3">
                      <button
                        onClick={() => toggleStatusInline(r.id)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition ${
                          status === "final"
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-amber-600 text-white hover:bg-amber-700"
                        }`}
                        title="Przełącz Szkic/Finalna"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {status === "final" ? "Finalna" : "Szkic"}
                      </button>
                    </td>
                  )}

                  {visibleCols.bucket && (
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          bucket === "active"
                            ? "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        }`}
                      >
                        {bucket === "active" ? "Aktywne" : "Kosz"}
                      </span>
                    </td>
                  )}
                  {visibleCols.players && (
                    <td className="p-3">
                      <GrayTag>{pCount}</GrayTag>
                    </td>
                  )}
                  {visibleCols.actions && (
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2 h-8 border-gray-300 px-3 dark:border-neutral-700"
                        onClick={() => {
                          setEditing(r);
                          setPageMode("editor");
                        }}
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        Edytuj
                      </Button>
                      {(r.bucket ?? "active") === "active" ? (
                        <Button
                          size="sm"
                          className="h-8 bg-gray-900 px-3 text-white hover:bg-gray-800"
                          onClick={() => moveToTrash(r.id)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Do kosza
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 bg-gray-900 px-3 text-white hover:bg-gray-800"
                          onClick={() => restoreFromTrash(r.id)}
                        >
                          <Undo2 className="mr-1 h-4 w-4" /> Przywróć
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={Object.values(visibleCols).filter(Boolean).length || 1}
                  className="p-3 text-center text-sm text-gray-500 dark:text-neutral-400"
                >
                  Brak wyników dla bieżących filtrów.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ========================= Columns popover ========================= */

function ColumnsButton({
  open,
  setOpen,
  visibleCols,
  setVisibleCols,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  visibleCols: Record<keyof typeof DEFAULT_COLS, boolean>;
  setVisibleCols: (v: Record<keyof typeof DEFAULT_COLS, boolean>) => void;
}) {
  return (
    <div className="relative">
      <Button
        variant="outline"
        className="border-gray-300 px-3 py-2 dark:border-neutral-700"
        onClick={() => setOpen(!open)}
      >
        Kolumny
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-2 text-xs font-medium text-gray-500 dark:text-neutral-400">
            Widoczność kolumn
          </div>
          {Object.keys(DEFAULT_COLS).map((k) => {
            const key = k as ColKey;
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800"
              >
                <span className="capitalize text-gray-800 dark:text-neutral-100">
                  {key}
                </span>
                <input
                  type="checkbox"
                  checked={visibleCols[key]}
                  onChange={(e) =>
                    setVisibleCols({ ...visibleCols, [key]: e.target.checked })
                  }
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
