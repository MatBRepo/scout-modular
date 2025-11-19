"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Globe, RefreshCw, Users, Upload, CheckCircle2, XCircle, CopyCheck
} from "lucide-react";

/* ======================= Types & constants ======================= */

type GlobalPlayer = {
  id: string;                  // internal uid
  name: string;
  club?: string;
  pos?: "GK" | "DF" | "MF" | "FW" | string;
  age?: number;
  nationality?: string;
  source?: string;             // scraper/source id
  extId?: string;              // external id for dedupe
  meta?: Record<string, any>;
};

type ScraperId = "tm" | "wyscout" | "sofifa" | "customA";

type ScrapeResult = {
  source: ScraperId;
  items: GlobalPlayer[];
  tookMs: number;
  error?: string;
};

const STORAGE_KEY = "s4s.global.players"; // global DB
const DEFAULT_SOURCES: { id: ScraperId; label: string; note?: string }[] = [
  { id: "tm",       label: "Transfermarkt" },
  { id: "wyscout",  label: "Wyscout" },
  { id: "sofifa",   label: "SoFIFA" },
  { id: "customA",  label: "Inne / Custom" },
];

/* Simple UID */
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* strong-ish dedupe key */
const dedupeKey = (p: Pick<GlobalPlayer, "name" | "club" | "extId">) =>
  (p.extId?.trim() || "").toLowerCase() ||
  [p.name?.trim().toLowerCase() || "", p.club?.trim().toLowerCase() || ""].join("::");

/* ============================= Page ============================== */

export default function GlobalSearchPage() {
  const [q, setQ] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [enabled, setEnabled] = useState<Record<ScraperId, boolean>>({
    tm: true, wyscout: true, sofifa: true, customA: false,
  });
  const [onlyNew, setOnlyNew] = useState(true);

  const [db, setDb] = useState<GlobalPlayer[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // load DB on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setDb(raw ? JSON.parse(raw) : []);
    } catch {
      setDb([]);
    }
  }, []);

  // helpers
  function persist(next: GlobalPlayer[]) {
    setDb(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  /* run scrapers => GET /api/scrape?query=...&src=tm,sofifa... */
  async function run() {
    if (!q.trim()) return;
    setRunning(true);
    setStatusMsg(null);
    setResults([]);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const srcs = Object.entries(enabled).filter(([,v]) => v).map(([k]) => k).join(",");
    try {
      const t0 = performance.now();
      const rsp = await fetch(`/api/scrape?query=${encodeURIComponent(q)}&src=${encodeURIComponent(srcs)}`, {
        signal: abortRef.current.signal,
      });
      if (!rsp.ok) throw new Error(`HTTP ${rsp.status}`);
      const json = (await rsp.json()) as ScrapeResult[];
      // normalize ids
      const normalized = json.map(bucket => ({
        ...bucket,
        items: bucket.items.map(it => ({ ...it, id: it.id || uid() })),
      }));
      setResults(normalized);
      const took = Math.round(performance.now() - t0);
      setStatusMsg(`Zakończono w ${took} ms • Łącznie ${normalized.reduce((a,b)=>a+(b.items?.length||0),0)} rekordów`);
    } catch (e: any) {
      setStatusMsg(`Błąd: ${e?.message || "nieznany"}`);
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const flat = useMemo(() => {
    const all = results.flatMap(r => r.items.map(i => ({ ...i, source: r.source })));
    // dedupe within results (extId OR name+club)
    const map = new Map<string, GlobalPlayer>();
    for (const it of all) {
      const key = dedupeKey(it);
      if (!map.has(key)) map.set(key, it);
    }
    return Array.from(map.values());
  }, [results]);

  const flatFiltered = useMemo(() => {
    if (!onlyNew) return flat;
    const inDb = new Set(db.map(p => dedupeKey(p)));
    return flat.filter(it => !inDb.has(dedupeKey(it)));
  }, [flat, db, onlyNew]);

  function addOne(p: GlobalPlayer) {
    const key = dedupeKey(p);
    const exists = db.find(x => dedupeKey(x) === key);
    if (exists) {
      setStatusMsg(`Pominięto (duplikat w bazie): ${p.name}${p.club ? " • " + p.club : ""}`);
      return;
    }
    persist([{ ...p, id: uid() }, ...db]);
    setStatusMsg(`Dodano: ${p.name}${p.club ? " • " + p.club : ""}`);
  }

  function addAll(list: GlobalPlayer[]) {
    const seen = new Set(db.map(p => dedupeKey(p)));
    const fresh = list.filter(p => {
      const k = dedupeKey(p);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (fresh.length === 0) {
      setStatusMsg("Brak nowych rekordów do dodania.");
      return;
    }
    persist([...fresh.map(p => ({ ...p, id: uid() })), ...db]);
    setStatusMsg(`Dodano ${fresh.length} nowych rekordów.`);
  }

  function importCSV() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || "");
          const rows = text.split(/\r?\n/).filter(Boolean).map(r => r.split(","));
          // naive CSV: name,club,pos,age,nationality
          const imported: GlobalPlayer[] = rows.map((r) => ({
            id: uid(),
            name: (r[0] || "").replace(/^"|"$/g, ""),
            club: (r[1] || "").replace(/^"|"$/g, ""),
            pos: (r[2] || "").replace(/^"|"$/g, ""),
            age: Number(r[3]) || undefined,
            nationality: (r[4] || "").replace(/^"|"$/g, ""),
            source: "customA",
          }));
          addAll(imported);
        } catch {
          setStatusMsg("Błąd podczas importu CSV.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Zawodnicy", href: "/players/global" }, { label: "Wyszukaj" }]} />
      <Toolbar
        title="Wyszukaj — globalna baza"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Szukaj np. nazwisko, klub…"
              className="h-9 w-72"
            />
            <Button className="h-9 bg-gray-900 text-white hover:bg-gray-800" onClick={run} disabled={running || !q.trim()}>
              <Search className="mr-2 h-4 w-4" /> Szukaj
            </Button>
            <Button variant="outline" className="h-9 border-gray-300 dark:border-neutral-700" onClick={stop} disabled={!running}>
              <XCircle className="mr-2 h-4 w-4" /> Stop
            </Button>

            {/* === Unified-height chip with shadcn Checkbox === */}
            <div className="ml-2 inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="only-new"
                  checked={onlyNew}
                  onCheckedChange={(v) => setOnlyNew(Boolean(v))}
                  className="h-4 w-4"
                />
                <Label htmlFor="only-new" className="cursor-pointer text-[12px] leading-none">
                  Tylko nowe
                </Label>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-7 border-gray-300 px-2 text-xs dark:border-neutral-700"
                onClick={() => setResults([])}
                title="Wyczyść wyniki"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="ml-1">Wyczyść</span>
              </Button>
            </div>

            <Button variant="outline" className="h-9 border-gray-300 dark:border-neutral-700" onClick={importCSV}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
          </div>
        }
      />

      {/* Sources picker */}
      <Card className="mb-3 mt-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Źródła (scrapers)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {DEFAULT_SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setEnabled((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
              className={`inline-flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-xs transition ${
                enabled[s.id]
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200"
                  : "border-gray-300 text-gray-700 hover:bg-stone-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              }`}
              title={s.note}
            >
              <Globe className="h-3.5 w-3.5" />
              {s.label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Status */}
      {statusMsg && (
        <div className="mb-3 inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
          {statusMsg}
        </div>
      )}

      {/* Results & merge view */}
      <Tabs defaultValue="merged" className="space-y-3">
        <TabsList className="mt-4 rounded-md bg-stone-100 p-1 shadow-sm dark:bg-neutral-900">
          <TabsTrigger value="merged" className="px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800">
            Scalona lista ({flatFiltered.length})
          </TabsTrigger>
          {results.map((r) => (
            <TabsTrigger key={r.source} value={r.source} className="px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800">
              {labelForSource(r.source)} ({r.items.length})
            </TabsTrigger>
          ))}
        </TabsList>

        {/* merged */}
        <TabsContent value="merged">
          <ResultsTable
            rows={flatFiltered}
            dbKeys={new Set(db.map(dedupeKey))}
            onAddOne={addOne}
            onAddAll={() => addAll(flatFiltered)}
          />
        </TabsContent>

        {/* per-source */}
        {results.map((r) => (
          <TabsContent key={r.source} value={r.source}>
            <ResultsTable
              rows={(onlyNew ? flatFiltered : flat).filter(x => x.source === r.source)}
              dbKeys={new Set(db.map(dedupeKey))}
              onAddOne={addOne}
              onAddAll={() => addAll((onlyNew ? flatFiltered : flat).filter(x => x.source === r.source))}
              sourceLabel={labelForSource(r.source)}
              tookMs={r.tookMs}
              error={r.error}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ======================== Presentational ======================== */

function ResultsTable({
  rows, dbKeys, onAddOne, onAddAll, sourceLabel, tookMs, error,
}: {
  rows: GlobalPlayer[];
  dbKeys: Set<string>;
  onAddOne: (p: GlobalPlayer) => void;
  onAddAll: () => void;
  sourceLabel?: string;
  tookMs?: number;
  error?: string;
}) {
  return (
    <Card className="border-gray-200 dark:border-neutral-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm">
            {sourceLabel ? `Wyniki: ${sourceLabel}` : "Wyniki (scalone)"}{" "}
            <span className="ml-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {rows.length}
            </span>
          </CardTitle>
          {typeof tookMs === "number" && (
            <div className="mt-1 text-[11px] text-dark dark:text-neutral-400">Czas: {tookMs} ms</div>
          )}
          {error && (
            <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">Błąd źródła: {error}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={onAddAll} disabled={rows.length === 0}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Dodaj wszystkie
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="p-3 text-left font-medium">Zawodnik</th>
                <th className="p-3 text-left font-medium">Klub</th>
                <th className="p-3 text-left font-medium">Pozycja</th>
                <th className="p-3 text-left font-medium">Wiek</th>
                <th className="p-3 text-left font-medium">Źródło</th>
                <th className="p-3 text-right font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inDb = dbKeys.has(dedupeKey(r));
                return (
                  <tr key={`${r.id}-${r.source}-${r.extId || ""}`} className="border-t border-gray-200 dark:border-neutral-800">
                    <td className="p-3">
                      <div className="font-medium text-gray-900 dark:text-neutral-100">{r.name || "—"}</div>
                      {r.nationality && <div className="text-xs text-dark dark:text-neutral-400">{r.nationality}</div>}
                    </td>
                    <td className="p-3">{r.club || "—"}</td>
                    <td className="p-3">
                      {r.pos ? (
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                          {r.pos}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3">{r.age ?? "—"}</td>
                    <td className="p-3">{labelForSource(r.source as ScraperId)}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-gray-300 dark:border-neutral-700"
                        onClick={() => onAddOne(r)}
                        disabled={inDb}
                        title={inDb ? "Już w bazie" : "Dodaj do globalnej bazy"}
                      >
                        {inDb ? (
                          <>
                            <CopyCheck className="mr-1 h-4 w-4" /> W bazie
                          </>
                        ) : (
                          <>
                            <Users className="mr-1 h-4 w-4" /> Dodaj
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-5 text-center text-sm text-dark dark:text-neutral-400">
                    Brak wyników do wyświetlenia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================ helpers ============================ */

function labelForSource(id?: ScraperId | string) {
  if (id === "tm") return "Transfermarkt";
  if (id === "wyscout") return "Wyscout";
  if (id === "sofifa") return "SoFIFA";
  if (id === "customA") return "Custom";
  return String(id || "Źródło");
}
