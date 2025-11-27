"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

import {
  Search,
  RefreshCw,
  Users,
  Upload,
  CheckCircle2,
  XCircle,
  CopyCheck,
  Database,
  RotateCw,
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { supabase } from "@/shared/supabase-client";

/* ======================= Typy & stałe ======================= */

type GlobalPlayer = {
  id: string; // wewnętrzne UID dla UI
  name: string;
  club?: string;
  pos?: "GK" | "DF" | "MF" | "FW" | string;
  age?: number;
  nationality?: string;
  source?: string;
  extId?: string;
  meta?: Record<string, any>;
};

type ScraperId = "tm" | "lnp";

type ScrapeResult = {
  source?: ScraperId | string;
  items: GlobalPlayer[];
  tookMs: number;
  error?: string;
};

const STORAGE_KEY = "s4s.global.players"; // lokalna baza LNP (localStorage)

/* Proste UID */
const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

/* Klucz do deduplikacji */
const dedupeKey = (p: Pick<GlobalPlayer, "name" | "club" | "extId">) =>
  (p.extId?.trim() || "").toLowerCase() ||
  [p.name?.trim().toLowerCase() || "", p.club?.trim().toLowerCase() || ""].join(
    "::"
  );

/* ============================= Page ============================== */

type ViewTab = "lnp" | "tm";

export default function GlobalSearchPage() {
  const [tab, setTab] = useState<ViewTab>("lnp");

  return (
    <div className="w-full space-y-3">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Zawodnicy", href: "/players/global" },
          { label: "Import / wyszukiwarka" },
        ]}
      />

      <Toolbar
        title="Globalna baza zawodników – import"
        right={
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as ViewTab)}
            className="w-full sm:w-auto"
          >
            <TabsList className="inline-flex rounded-full bg-stone-100 p-0.5 text-xs shadow-sm dark:bg-neutral-900">
              <TabsTrigger
                value="lnp"
                className="rounded-full px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
              >
                LNP
              </TabsTrigger>
              <TabsTrigger
                value="tm"
                className="rounded-full px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
              >
                TM scraper
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <Card className="border-dashed border-stone-200 bg-stone-50/70 text-[11px] text-stone-700 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-200">
        <CardContent className="flex flex-col gap-1.5 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p>
              <span className="font-semibold">LNP</span> – szybkie dodawanie
              pojedynczych zawodników.
            </p>
            <p>
              <span className="font-semibold">Transfermarkt</span> – masowy
              import (kraj / sezon) z zapisem do globalnej bazy.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-neutral-950 dark:text-neutral-200 dark:ring-neutral-700">
            <Database className="mr-1 h-3 w-3" />
            Dane tylko do odczytu • tabela{" "}
            <span className="ml-1 font-semibold">global_players</span>
          </span>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {tab === "lnp" ? <LnpSearchPanel /> : <TmScraperPanel />}
      </div>
    </div>
  );
}

/* ===================== LNP – wyszukiwarka / import ======================= */

function LnpSearchPanel() {
  const [q, setQ] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [onlyNew, setOnlyNew] = useState(true);

  const [db, setDb] = useState<GlobalPlayer[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // wczytanie lokalnej bazy LNP przy starcie
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setDb(raw ? JSON.parse(raw) : []);
    } catch {
      setDb([]);
    }
  }, []);

  function persist(next: GlobalPlayer[]) {
    setDb(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignoruj błąd
    }
  }

  /* uruchom scraper LNP => GET /api/scrape?query=...&src=lnp */
  async function run() {
    if (!q.trim()) return;
    setRunning(true);
    setStatusMsg(null);
    setResults([]);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const t0 = performance.now();
      const rsp = await fetch(
        `/api/scrape?query=${encodeURIComponent(q)}&src=${encodeURIComponent(
          "lnp"
        )}`,
        {
          signal: abortRef.current.signal,
        }
      );
      if (!rsp.ok) throw new Error(`HTTP ${rsp.status}`);

      const raw = (await rsp.json()) as any;
      const buckets: ScrapeResult[] = Array.isArray(raw) ? raw : [raw];

      const normalized = buckets.map((bucket) => ({
        ...bucket,
        items: (bucket.items || []).map((it: any) => ({
          ...it,
          id: it.id || uid(),
          source: it.source || (bucket.source as string) || "lnp",
        })),
      }));

      setResults(normalized);
      const took = Math.round(performance.now() - t0);
      const totalCount = normalized.reduce(
        (a, b) => a + (b.items?.length || 0),
        0
      );
      setStatusMsg(
        `Zakończono w ${took} ms • ${totalCount} znalezionych rekordów`
      );
    } catch (e: any) {
      setStatusMsg(`Błąd wyszukiwania: ${e?.message || "nieznany"}`);
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const flat = useMemo(() => {
    const all = results.flatMap((r) =>
      r.items.map((i) => ({
        ...i,
        source: i.source || r.source || "lnp",
      }))
    );
    const map = new Map<string, GlobalPlayer>();
    for (const it of all) {
      const key = dedupeKey(it);
      if (!map.has(key)) map.set(key, it);
    }
    return Array.from(map.values());
  }, [results]);

  const flatFiltered = useMemo(() => {
    if (!onlyNew) return flat;
    const inDb = new Set(db.map((p) => dedupeKey(p)));
    return flat.filter((it) => !inDb.has(dedupeKey(it)));
  }, [flat, db, onlyNew]);

  function addOne(p: GlobalPlayer) {
    const key = dedupeKey(p);
    const exists = db.find((x) => dedupeKey(x) === key);
    if (exists) {
      setStatusMsg(
        `Pominięto (już w bazie): ${p.name}${p.club ? " • " + p.club : ""}`
      );
      return;
    }
    persist([{ ...p, id: uid() }, ...db]);
    setStatusMsg(`Dodano: ${p.name}${p.club ? " • " + p.club : ""}`);
  }

  function addAll(list: GlobalPlayer[]) {
    const seen = new Set(db.map((p) => dedupeKey(p)));
    const fresh = list.filter((p) => {
      const k = dedupeKey(p);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (fresh.length === 0) {
      setStatusMsg("Brak nowych rekordów do dodania.");
      return;
    }
    persist([...fresh.map((p) => ({ ...p, id: uid() })), ...db]);
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
          const rows = text
            .split(/\r?\n/)
            .filter(Boolean)
            .map((r) => r.split(","));
          // prosty CSV: name,club,pos,age,nationality
          const imported: GlobalPlayer[] = rows.map((r) => ({
            id: uid(),
            name: (r[0] || "").replace(/^"|"$/g, ""),
            club: (r[1] || "").replace(/^"|"$/g, ""),
            pos: (r[2] || "").replace(/^"|"$/g, ""),
            age: Number(r[3]) || undefined,
            nationality: (r[4] || "").replace(/^"|"$/g, ""),
            source: "lnp",
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

  const firstBucket = results[0];
  const tookMs = firstBucket?.tookMs;
  const error = firstBucket?.error;

  return (
    <div className="space-y-3">
      <Card className="border-gray-200 bg-white/70 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60">
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-1 sm:max-w-xl">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-400">
                Wyszukiwanie w LNP
              </Label>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        run();
                      }
                    }}
                    placeholder="Nazwisko, klub, fraza…"
                    className="h-8 w-full pl-8 text-sm"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    className="h-8 px-3 text-xs"
                    onClick={run}
                    disabled={running || !q.trim()}
                  >
                    {running ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Szukanie…
                      </>
                    ) : (
                      <>
                        <Search className="mr-1.5 h-3.5 w-3.5" />
                        Szukaj
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={stop}
                    disabled={!running}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" /> Stop
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-[11px] sm:items-end">
              <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
                <Users className="mr-1 h-3 w-3" />
                W lokalnej bazie: {db.length}
              </span>
              <Button
                variant="outline"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={importCSV}
              >
                <Upload className="h-3.5 w-3.5" /> Import CSV
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-2 text-[11px] text-muted-foreground">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-800">
              <Checkbox
                id="only-new"
                checked={onlyNew}
                onCheckedChange={(v) => setOnlyNew(Boolean(v))}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor="only-new"
                className="cursor-pointer text-[11px] leading-none"
              >
                Tylko nowi (nieobecni w lokalnej bazie)
              </Label>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => setResults([])}
              title="Wyczyść wyniki wyszukiwania"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Wyczyść
            </Button>

            {statusMsg && (
              <span className="inline-flex items-center gap-1 rounded-md bg-stone-50 px-2 py-0.5 text-[11px] text-stone-700 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
                {statusMsg}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {typeof tookMs === "number" && (
              <span>Czas odpowiedzi źródła: {tookMs} ms</span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                Błąd źródła LNP: {error}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <ResultsTable
        rows={flatFiltered}
        dbKeys={new Set(db.map(dedupeKey))}
        onAddOne={addOne}
        onAddAll={() => addAll(flatFiltered)}
        sourceLabel="LNP"
        tookMs={tookMs}
        error={error}
      />
    </div>
  );
}

/* ======================== Prezentacja tabeli LNP ======================== */

function ResultsTable({
  rows,
  dbKeys,
  onAddOne,
  onAddAll,
  sourceLabel,
  tookMs,
  error,
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
    <Card className="border-gray-200 bg-white/70 text-xs dark:border-neutral-800 dark:bg-neutral-950/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-3 pb-2">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span>{sourceLabel ? `Wyniki: ${sourceLabel}` : "Wyniki"}</span>
            <span className="inline-flex items-center rounded-full bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700">
              {rows.length} rekordów
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {typeof tookMs === "number" && (
              <span>Czas odpow.: {tookMs} ms</span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                Błąd źródła LNP: {error}
              </span>
            )}
          </div>
        </div>
        <Button
          className="h-8 gap-1.5 bg-gray-900 px-3 text-xs text-white hover:bg-gray-800"
          onClick={onAddAll}
          disabled={rows.length === 0}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Dodaj wszystkie
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-stone-100 text-[11px] font-medium text-stone-700 shadow-sm dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="p-2 text-left">Zawodnik</th>
                <th className="p-2 text-left">Klub</th>
                <th className="p-2 text-left">Pozycja</th>
                <th className="p-2 text-left">Wiek</th>
                <th className="p-2 text-left">Źródło</th>
                <th className="p-2 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inDb = dbKeys.has(dedupeKey(r));
                const rowClass = inDb
                  ? "bg-emerald-50/60 text-stone-700 dark:bg-emerald-950/25 dark:text-neutral-100"
                  : "hover:bg-stone-50 dark:hover:bg-neutral-900";

                return (
                  <tr
                    key={`${r.id}-${r.source}-${r.extId || ""}`}
                    className={`border-t border-gray-200 transition-colors dark:border-neutral-800 ${rowClass}`}
                  >
                    <td className="p-2">
                      <div className="text-xs font-medium text-gray-900 dark:text-neutral-100">
                        {r.name || "—"}
                      </div>
                      {r.nationality && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {r.nationality}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-xs text-stone-800 dark:text-neutral-200">
                      {r.club || "—"}
                    </td>
                    <td className="p-2">
                      {r.pos ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800 ring-1 ring-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700">
                          {r.pos}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2 text-xs text-stone-800 dark:text-neutral-200">
                      {r.age ?? "—"}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {labelForSource(r.source as ScraperId | string)}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 border-gray-300 px-2 text-[11px] dark:border-neutral-700"
                        onClick={() => onAddOne(r)}
                        disabled={inDb}
                        title={
                          inDb
                            ? "Już w lokalnej bazie"
                            : "Dodaj do lokalnej bazy LNP"
                        }
                      >
                        {inDb ? (
                          <>
                            <CopyCheck className="h-3 w-3" /> W bazie
                          </>
                        ) : (
                          <>
                            <Users className="h-3 w-3" /> Dodaj
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-5 text-center text-xs text-muted-foreground"
                  >
                    Brak wyników. Użyj wyszukiwarki powyżej lub zaimportuj CSV.
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

/* =================== TM – scraper (Transfermarkt) =================== */

type TmPlayerRow = {
  tm_player_id: number;
  player_name: string;
  player_path: string;

  competition_code: string;
  competition_name: string;
  tier_label: string | null;

  club_tm_id: number | null;
  club_name: string;
  club_profile_path: string;

  number: string | null;
  position: string | null;
  age: number | null;
  nationalities: string[];
  height_cm: number | null;
  foot: string | null;
  date_of_birth: string | null;
  contract_until: string | null;
};

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

type PlayerDetailsResponse = {
  slug: string;
  playerId: string;
  urls: Record<string, string>;
  tables?: Record<string, ParsedTable | null>;
  errors?: Record<string, string>;
};

function TmScraperPanel() {
  const [country, setCountry] = useState("135");
  const [season, setSeason] = useState("2025");

  const [rows, setRows] = useState<TmPlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastApiMessage, setLastApiMessage] = useState<string | null>(null);

  const [stats, setStats] = useState<{
    competitions: number;
    clubs: number;
    players: number;
  }>({ competitions: 0, clubs: 0, players: 0 });

  const [saving, setSaving] = useState(false);

  const [downloadedAt, setDownloadedAt] = useState<string | null>(null);
  const [cachedFlag, setCachedFlag] = useState<boolean | null>(null);

  // --- nowe filtry ---
  type PosFilter = "all" | "GK" | "DF" | "MF" | "FW" | "other";
  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");

  // szczegóły TM dla wybranego zawodnika
  const [selectedPlayer, setSelectedPlayer] = useState<TmPlayerRow | null>(
    null
  );
  const [playerDetails, setPlayerDetails] =
    useState<PlayerDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // lista dostępnych rozgrywek (do selecta)
  const competitionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of rows) {
      if (p.competition_name) set.add(p.competition_name);
    }
    return Array.from(set.values()).sort((a, b) =>
      a.localeCompare(b, "pl")
    );
  }, [rows]);

  /* ----- pobierz listę zawodników (Supabase cache / TM) ----- */
  const loadPlayers = async (opts?: { refresh?: boolean }) => {
    setLoading(true);
    setErrorMsg(null);
    setLastApiMessage(null);

    try {
      let url =
        `/api/admin/tm/scrape/competition/list` +
        `?country=${encodeURIComponent(country)}` +
        `&season=${encodeURIComponent(season)}`;

      if (opts?.refresh) {
        url += `&refresh=1`;
      }

      const r = await fetch(url, { cache: "no-store" });
      const text = await r.text();

      if (!r.ok) {
        let apiErr = "";
        try {
          const parsed = JSON.parse(text);
          apiErr = parsed?.error || "";
        } catch {
          // ignore
        }

        const msg =
          apiErr ||
          text ||
          `TM API: HTTP ${r.status} przy pobieraniu listy zawodników`;
        setErrorMsg(msg);
        setLastApiMessage(msg);
        setRows([]);
        setStats({ competitions: 0, clubs: 0, players: 0 });
        setDownloadedAt(null);
        setCachedFlag(null);
        toast.error(msg);
        return;
      }

      let j: any = {};
      try {
        j = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Nieprawidłowa odpowiedź JSON z /competition/list");
      }

      if (j.error) {
        const msg = `TM API (JSON error): ${j.error}`;
        setErrorMsg(msg);
        setLastApiMessage(msg);
        setRows([]);
        setStats({ competitions: 0, clubs: 0, players: 0 });
        setDownloadedAt(null);
        setCachedFlag(null);
        toast.error(msg);
        return;
      }

      const rowsRaw: any[] = Array.isArray(j.rows)
        ? j.rows
        : Array.isArray(j.players)
        ? j.players
        : Array.isArray(j.items)
        ? j.items
        : [];

      const list: TmPlayerRow[] = rowsRaw.map((row: any) => ({
        tm_player_id: Number(
          row.tm_player_id ?? row.player_id ?? row.id ?? 0
        ),
        player_name: String(row.player_name ?? row.name ?? ""),
        player_path: row.player_path ?? row.profile_path ?? "",

        competition_code: String(
          row.competition_code ?? row.comp_code ?? ""
        ),
        competition_name: String(
          row.competition_name ?? row.comp_name ?? ""
        ),
        tier_label:
          row.tier_label === undefined || row.tier_label === null
            ? null
            : String(row.tier_label),

        club_tm_id:
          row.club_tm_id === undefined || row.club_tm_id === null
            ? row.tm_club_id ?? null
            : Number(row.club_tm_id),
        club_name: String(row.club_name ?? row.tm_club_name ?? ""),
        club_profile_path: row.club_profile_path ?? row.club_path ?? "",

        number: row.number ?? row.shirt_number ?? null,
        position: row.position ?? null,
        age:
          typeof row.age === "number"
            ? row.age
            : row.age
            ? Number(row.age)
            : null,
        nationalities: Array.isArray(row.nationalities)
          ? row.nationalities
          : row.nationality
          ? [String(row.nationality)]
          : [],
        height_cm:
          typeof row.height_cm === "number"
            ? row.height_cm
            : row.height_cm
            ? Number(row.height_cm)
            : null,
        foot: row.foot ?? null,
        date_of_birth: row.date_of_birth ?? row.dob ?? null,
        contract_until: row.contract_until ?? row.contract_end ?? null,
      }));

      setRows(list);
      setStats({
        competitions: Number(j.competitionsCount || 0),
        clubs: Number(j.clubsCount || 0),
        players: Number(j.playersCount || list.length),
      });

      setDownloadedAt(j.downloadedAt ?? null);
      setCachedFlag(
        typeof j.cached === "boolean" ? (j.cached as boolean) : null
      );

      const originLabel =
        j.cached === true
          ? " (Supabase cache – bez scrapowania)"
          : " (świeże pobranie z TM)";
      const okMsg = `Pobrano ${list.length} zawodników (kraj: ${country}, sezon: ${season})${originLabel}`;
      setLastApiMessage(okMsg);
      toast.success(okMsg);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Nie udało się pobrać listy zawodników";
      setErrorMsg(msg);
      setLastApiMessage(msg);
      setRows([]);
      setStats({ competitions: 0, clubs: 0, players: 0 });
      setDownloadedAt(null);
      setCachedFlag(null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTmUrl = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `https://www.transfermarkt.com${path}`;
  };

  const copyPath = async (path?: string | null) => {
    if (!path) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(path);
      } else {
        const ta = document.createElement("textarea");
        ta.value = path;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Ścieżka została skopiowana");
    } catch {
      toast.error("Nie udało się skopiować ścieżki");
    }
  };

  const total = rows.length;

  /* ----- filtrowanie (po rozgrywkach, pozycji, oraz full-text) ----- */
  const filtered = useMemo(() => {
    let data = [...rows];

    if (competitionFilter !== "all") {
      data = data.filter(
        (p) => p.competition_name === competitionFilter
      );
    }

    if (posFilter !== "all") {
      data = data.filter((p) => {
        const pos = (p.position || "").toUpperCase();
        if (!pos) return false;
        if (posFilter === "GK") return pos.startsWith("GK");
        if (posFilter === "DF")
          return pos.startsWith("DF") || pos.includes("BACK");
        if (posFilter === "MF")
          return pos.startsWith("MF") || pos.includes("MIDFIELD");
        if (posFilter === "FW")
          return (
            pos.startsWith("FW") ||
            pos.includes("STRIKER") ||
            pos.includes("WINGER")
          );
        if (posFilter === "other")
          return !(
            pos.startsWith("GK") ||
            pos.startsWith("DF") ||
            pos.startsWith("MF") ||
            pos.startsWith("FW")
          );
        return true;
      });
    }

    const q = search.trim().toLowerCase();
    if (!q) return data;
    const tokens = q.split(/\s+/).filter(Boolean);

    return data.filter((p) => {
      const haystack = (
        p.player_name +
        " " +
        p.club_name +
        " " +
        (p.position || "") +
        " " +
        (p.nationalities || []).join(" ") +
        " " +
        p.competition_name +
        " " +
        (p.tier_label || "")
      )
        .toLowerCase()
        .replace(/\s+/g, " ");

      return tokens.every((t) => haystack.includes(t));
    });
  }, [rows, search, competitionFilter, posFilter]);

  const visible = filtered.length;

  /* ----- grupowanie po klubach do głównej tabeli ----- */
  const groupedByClub = useMemo(() => {
    type ClubGroup = {
      club_name: string;
      competitions: Set<string>;
      players: TmPlayerRow[];
    };

    const map = new Map<string, ClubGroup>();

    for (const p of filtered) {
      const name = p.club_name || "Bez klubu";
      let entry = map.get(name);
      if (!entry) {
        entry = {
          club_name: name,
          competitions: new Set<string>(),
          players: [],
        };
        map.set(name, entry);
      }
      if (p.competition_name) {
        entry.competitions.add(p.competition_name);
      }
      entry.players.push(p);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.club_name.localeCompare(b.club_name, "pl")
    );
  }, [filtered]);

  /* ----- agregacja klubów i zawodników (dla bocznych boxów) ----- */
  const clubsAgg = useMemo(() => {
    const map = new Map<string, { club_name: string; playersCount: number }>();

    for (const p of filtered) {
      const name = p.club_name || "Bez klubu";
      const existing = map.get(name);
      if (existing) {
        existing.playersCount += 1;
      } else {
        map.set(name, { club_name: name, playersCount: 1 });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.club_name.localeCompare(b.club_name, "pl")
    );
  }, [filtered]);

  const sortedPlayers = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => a.player_name.localeCompare(b.player_name, "pl"));
    return list;
  }, [filtered]);

  const handleClubFilter = (clubName: string) => {
    setSearch(clubName);
  };

  /* ----- zapis do Supabase: global_players (opcjonalny, ręczny) ----- */
  const saveToSupabase = async () => {
    if (!filtered.length) return;
    setSaving(true);

    try {
      const payload = filtered.map((p) => ({
        key: `tm:${p.tm_player_id}`,
        name: p.player_name,
        pos: p.position || "UNK",
        age: p.age ?? null,
        club: p.club_name || null,
        nationality:
          p.nationalities && p.nationalities.length
            ? p.nationalities.join(", ")
            : null,
        source: "tm",
        ext_id: String(p.tm_player_id),
        birth_date: p.date_of_birth,
        meta: {
          competition_code: p.competition_code,
          competition_name: p.competition_name,
          tier_label: p.tier_label,
          club_tm_id: p.club_tm_id,
          club_profile_path: p.club_profile_path,
          number: p.number,
          height_cm: p.height_cm,
          foot: p.foot,
          contract_until: p.contract_until,
          player_path: p.player_path,
          country,
          season,
        },
        added_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("global_players")
        .upsert(payload, { onConflict: "key" });

      if (error) throw error;

      toast.success(
        `Zapisano ${payload.length} zawodników do tabeli global_players`
      );
    } catch (e: any) {
      console.error(e);
      toast.error(
        `Błąd zapisu do Supabase: ${e?.message || "nieznany błąd"}`
      );
    } finally {
      setSaving(false);
    }
  };

  /* ----- ładowanie szczegółów TM dla jednego zawodnika ----- */
  const loadPlayerDetails = async (player: TmPlayerRow) => {
    if (!player.player_path) {
      toast.error("Brak ścieżki TM dla tego zawodnika");
      return;
    }
    setSelectedPlayer(player);
    setPlayerDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);

    try {
      const res = await fetch(
        `/api/tm/player/details?path=${encodeURIComponent(
          player.player_path
        )}`
      );
      const text = await res.text();
      if (!res.ok) {
        let err = "";
        try {
          const parsed = JSON.parse(text);
          err = parsed?.error || "";
        } catch {
          // ignore
        }
        throw new Error(err || text || `HTTP ${res.status}`);
      }
      const json = text
        ? (JSON.parse(text) as PlayerDetailsResponse)
        : ({} as PlayerDetailsResponse);
      setPlayerDetails(json);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.message || "Nie udało się pobrać detali zawodnika z TM";
      setDetailsError(msg);
      toast.error(msg);
    } finally {
      setDetailsLoading(false);
    }
  };

  const renderParsedTable = (table?: ParsedTable | null) => {
    if (!table) {
      return (
        <div className="text-xs text-muted-foreground">
          Brak danych w tej zakładce (lub tabela nie została rozpoznana).
        </div>
      );
    }

    return (
      <div className="w-full overflow-x-auto rounded-md border border-dashed border-stone-200 bg-white/60 dark:border-neutral-800 dark:bg-neutral-950/60">
        <table className="w-full border-collapse text-[11px]">
          <thead className="bg-stone-100 text-[11px] font-semibold text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
            <tr>
              {table.headers.map((h, idx) => (
                <th
                  key={`${h}-${idx}`}
                  className="border-b border-stone-200 px-2 py-1 text-left dark:border-neutral-800"
                >
                  {h || "—"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 && (
              <tr>
                <td
                  colSpan={table.headers.length || 1}
                  className="px-2 py-2 text-center text-xs text-muted-foreground"
                >
                  Brak wierszy w tabeli.
                </td>
              </tr>
            )}
            {table.rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="border-b border-dashed border-stone-200 last:border-b-0 dark:border-neutral-800"
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-2 py-1 align-top text-[11px]"
                  >
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Nagłówek + statystyki */}
      <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4" />
            Scraper zawodników (Transfermarkt – kraj / sezon)
          </div>
          {downloadedAt && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                Ostatnie pobranie:{" "}
                {new Date(downloadedAt).toLocaleString("pl-PL")}
              </span>
              {cachedFlag !== null && (
                <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                  Źródło:{" "}
                  <span className="ml-1 font-medium">
                    {cachedFlag
                      ? "Supabase cache"
                      : "świeże pobranie z TM"}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
            Rozgrywek: {stats.competitions}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
            Klubów: {stats.clubs}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
            Zawodników: {stats.players}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
            Widoczne: {visible}/{total}
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
              <Loader2 className="h-3 w-3 animate-spin" />
              Ładowanie z TM…
            </span>
          )}
        </div>

        <Button asChild variant="outline" className="h-7 px-2 text-[11px]">
          <Link href="/admin/scraper/data">Historia pobrań</Link>
        </Button>
      </div>

      {/* Sterowanie + filtry */}
      <Card className="border-gray-200 bg-white/70 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950/60">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              Kraj (ID TM)
            </span>
            <Input
              className="h-7 w-20 text-xs"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              onBlur={() => loadPlayers()}
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Sezon</span>
            <Input
              className="h-7 w-20 text-xs"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              onBlur={() => loadPlayers()}
              disabled={loading}
            />
          </div>

          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtr: nazwisko / klub / liga / pozycja…"
                className="h-7 pl-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearch("")}
              disabled={!search || loading}
              className="h-7 px-2 text-[11px]"
            >
              Wyczyść
            </Button>
          </div>

          <div className="w-full border-t border-dashed pt-2" />

          {/* Rozgrywki + pozycja */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                Rozgrywki:
              </span>
              <select
                className="h-7 rounded-md border border-gray-300 bg-white px-2 text-[11px] dark:border-neutral-700 dark:bg-neutral-900"
                value={competitionFilter}
                onChange={(e) => setCompetitionFilter(e.target.value)}
                disabled={loading}
              >
                <option value="all">Wszystkie</option>
                {competitionOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] text-muted-foreground">
                Pozycja:
              </span>
              {(
                ["all", "GK", "DF", "MF", "FW", "other"] as PosFilter[]
              ).map((key) => {
                const label =
                  key === "all"
                    ? "Wszystkie"
                    : key === "other"
                    ? "Inne"
                    : key;
                const active = posFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPosFilter(key)}
                    className={[
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/70 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full border-t border-dashed pt-2" />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-7 gap-1.5 px-2 text-[11px]"
              onClick={() => loadPlayers()}
              disabled={loading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Odśwież (cache / TM)
            </Button>

            <Button
              variant="outline"
              className="h-7 gap-1.5 px-2 text-[11px]"
              onClick={() => loadPlayers({ refresh: true })}
              disabled={loading}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Pobierz ponownie (bez cache)
            </Button>

            <Button
              className="h-7 gap-1.5 bg-emerald-600 px-3 text-[11px] text-white hover:bg-emerald-500"
              onClick={saveToSupabase}
              disabled={saving || !filtered.length}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Zapisywanie…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Zapisz widocznych do global_players
                </>
              )}
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 p-2 text-[11px] text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900">
            <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {lastApiMessage && !errorMsg && (
          <div className="mt-2 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900">
            {lastApiMessage}
          </div>
        )}
      </Card>

      {/* Tabela: grupy klubów + zawodnicy */}
      <Card className="p-0 text-xs">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-stone-100 text-[11px] font-medium text-stone-700 shadow-sm dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="p-2 text-left">Rozgrywki</th>
                <th className="p-2 text-left">Klub</th>
                <th className="p-2 text-left">Zawodnik</th>
                <th className="p-2 text-left">Pozycja</th>
                <th className="p-2 text-left">Wiek</th>
                <th className="p-2 text-left">Narodowość</th>
                <th className="p-2 text-left">Data ur.</th>
                <th className="p-2 text-left">Kontrakt do</th>
                <th className="p-2 text-right">TM</th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-4 text-center text-xs text-muted-foreground"
                  >
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ładowanie danych z Transfermarkt…
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                groupedByClub.map((group) => {
                  const comps = Array.from(group.competitions.values());
                  return (
                    <React.Fragment
                      key={`club-${group.club_name || "none"}`}
                    >
                      <tr className="border-t border-stone-200 bg-stone-50/80 text-[11px] font-medium uppercase tracking-wide text-stone-700 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-200">
                        <td colSpan={9} className="p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-700">
                                {group.club_name || "Bez klubu"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Zawodników: {group.players.length}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {comps.map((c) => (
                                <span
                                  key={c}
                                  className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-700"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {group.players.map((p, idx) => {
                        const tmHref = openTmUrl(p.player_path);
                        const showClubName = idx === 0;
                        const isSelected =
                          selectedPlayer?.tm_player_id === p.tm_player_id;

                        return (
                          <tr
                            key={p.tm_player_id}
                            className={[
                              "border-t border-gray-200 align-top transition-colors dark:border-neutral-800",
                              isSelected
                                ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                                : "hover:bg-stone-50 dark:hover:bg-neutral-900",
                            ].join(" ")}
                          >
                            <td className="p-2 align-top">
                              <div className="truncate text-[11px] font-medium">
                                {p.competition_name}
                              </div>
                              {p.tier_label && (
                                <div className="mt-0.5 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-700">
                                  {p.tier_label}
                                </div>
                              )}
                            </td>

                            <td className="p-2 align-top">
                              {showClubName && (
                                <div className="truncate text-xs text-stone-800 dark:text-neutral-100">
                                  {p.club_name || "—"}
                                </div>
                              )}
                            </td>

                            <td className="p-2 align-top">
                              <button
                                type="button"
                                onClick={() => loadPlayerDetails(p)}
                                className="truncate text-left text-xs font-semibold text-stone-900 underline-offset-2 hover:underline dark:text-neutral-50"
                              >
                                {p.player_name || "—"}
                              </button>
                            </td>

                            <td className="p-2 align-top">
                              {p.position ? (
                                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800 ring-1 ring-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700">
                                  {p.position}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td className="p-2 align-top text-xs text-stone-800 dark:text-neutral-200">
                              {p.age ?? "—"}
                            </td>

                            <td className="p-2 align-top text-xs text-stone-800 dark:text-neutral-200">
                              {p.nationalities && p.nationalities.length > 0
                                ? p.nationalities.join(", ")
                                : "—"}
                            </td>

                            <td className="p-2 align-top text-xs text-stone-800 dark:text-neutral-200">
                              {p.date_of_birth ? p.date_of_birth : "—"}
                            </td>

                            <td className="p-2 align-top text-xs text-stone-800 dark:text-neutral-200">
                              {p.contract_until ? p.contract_until : "—"}
                            </td>

                            <td className="p-2 align-top text-right">
                              <div className="flex flex-col items-end gap-1 text-[10px] font-mono text-muted-foreground">
                                {p.player_path ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <span className="hidden max-w-[180px] truncate sm:inline">
                                        {p.player_path}
                                      </span>
                                      <button
                                        className="inline-flex items-center rounded border px-1 py-0.5 hover:bg-muted"
                                        onClick={() =>
                                          copyPath(p.player_path)
                                        }
                                        title="Skopiuj ścieżkę"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                      {tmHref && (
                                        <a
                                          href={tmHref}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center rounded border px-1 py-0.5 hover:bg-muted"
                                          title="Otwórz na Transfermarkt"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-6 gap-1 border-stone-300 px-2 text-[10px] dark:border-neutral-700"
                                      onClick={() => loadPlayerDetails(p)}
                                    >
                                      {detailsLoading &&
                                      selectedPlayer?.tm_player_id ===
                                        p.tm_player_id ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Detale…
                                        </>
                                      ) : (
                                        <>
                                          <Database className="h-3 w-3" />
                                          Szczegóły TM
                                        </>
                                      )}
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground/70">
                                    Brak linku TM
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

              {!loading && !groupedByClub.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-4 text-center text-xs text-muted-foreground"
                  >
                    Brak zawodników spełniających podane filtry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Szczegóły wybranego zawodnika z Transfermarkt */}
      {selectedPlayer && (
        <Card className="border-emerald-200 bg-emerald-50/40 p-3 text-[11px] dark:border-emerald-900 dark:bg-emerald-950/20">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold ring-1 ring-emerald-200 dark:bg-neutral-950 dark:ring-emerald-800">
                  {selectedPlayer.player_name}
                </span>
                {selectedPlayer.position && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-700">
                    {selectedPlayer.position}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {selectedPlayer.club_name || "Bez klubu"} •{" "}
                {selectedPlayer.competition_name || "—"}
              </div>
              {selectedPlayer.age !== null && (
                <div className="text-[11px] text-muted-foreground">
                  Wiek: {selectedPlayer.age}{" "}
                  {selectedPlayer.date_of_birth &&
                    `• ur. ${selectedPlayer.date_of_birth}`}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedPlayer.player_path && (
                <a
                  href={openTmUrl(selectedPlayer.player_path) || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-neutral-900 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Profil TM
                </a>
              )}
              {detailsLoading && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-800">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Ładowanie detali…
                </span>
              )}
            </div>
          </div>

          {detailsError && (
            <div className="mb-2 flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900">
              <AlertTriangle className="h-3 w-3" />
              {detailsError}
            </div>
          )}

          {!detailsLoading && !playerDetails && !detailsError && (
            <div className="text-[11px] text-muted-foreground">
              Brak danych szczegółowych (endpoint nie zwrócił JSON). Sprawdź,
              czy działa <code>/api/tm/player/details</code>.
            </div>
          )}

          {playerDetails && (
            <Tabs defaultValue="allSeasons" className="mt-2 w-full text-xs">
              <TabsList className="mb-2 flex flex-wrap gap-1 rounded-md bg-emerald-100/60 p-1 text-[11px] dark:bg-emerald-950/40">
                <TabsTrigger
                  value="allSeasons"
                  className="px-2 py-1 text-[11px] data-[state=active]:bg-white data-[state=active]:text-emerald-800 dark:data-[state=active]:bg-neutral-900 dark:data-[state=active]:text-emerald-100"
                >
                  All seasons
                </TabsTrigger>
                <TabsTrigger
                  value="byClub"
                  className="px-2 py-1 text-[11px] data-[state=active]:bg-white data-[state=active]:text-emerald-800 dark:data-[state=active]:bg-neutral-900 dark:data-[state=active]:text-emerald-100"
                >
                  Stats by club
                </TabsTrigger>
                <TabsTrigger
                  value="injuries"
                  className="px-2 py-1 text-[11px] data-[state=active]:bg-white data-[state=active]:text-emerald-800 dark:data-[state=active]:bg-neutral-900 dark:data-[state=active]:text-emerald-100"
                >
                  Injury history
                </TabsTrigger>
                <TabsTrigger
                  value="marketValue"
                  className="px-2 py-1 text-[11px] data-[state=active]:bg-white data-[state=active]:text-emerald-800 dark:data-[state=active]:bg-neutral-900 dark:data-[state=active]:text-emerald-100"
                >
                  Market value
                </TabsTrigger>
              </TabsList>

              <TabsContent value="allSeasons" className="mt-0">
                {renderParsedTable(
                  playerDetails.tables?.["statsAllSeasons"]
                )}
              </TabsContent>
              <TabsContent value="byClub" className="mt-0">
                {renderParsedTable(
                  playerDetails.tables?.["statsByClub"]
                )}
              </TabsContent>
              <TabsContent value="injuries" className="mt-0">
                {renderParsedTable(
                  playerDetails.tables?.["injuryHistory"]
                )}
              </TabsContent>
              <TabsContent value="marketValue" className="mt-0">
                {renderParsedTable(
                  playerDetails.tables?.["marketValue"]
                )}
              </TabsContent>
            </Tabs>
          )}
        </Card>
      )}

      {/* Podsumowania boczne (kluby + zawodnicy) */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-3 text-[11px]">
          <CardTitle className="flex items-center justify-between text-xs">
            <span>Kluby (aktualny filtr)</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] dark:bg-neutral-800">
              {clubsAgg.length}
            </span>
          </CardTitle>
          <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
            {clubsAgg.length === 0 && (
              <div className="text-muted-foreground">
                Brak klubów w aktualnym widoku.
              </div>
            )}
            {clubsAgg.map((c) => (
              <button
                key={c.club_name}
                type="button"
                onClick={() =>
                  c.club_name !== "Bez klubu" &&
                  handleClubFilter(c.club_name)
                }
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[11px] hover:bg-stone-100 dark:hover:bg-neutral-800"
              >
                <span className="truncate">{c.club_name || "Bez klubu"}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {c.playersCount}{" "}
                  {c.playersCount === 1 ? "zawodnik" : "zawodników"}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-3 text-[11px]">
          <CardTitle className="flex items-center justify-between text-xs">
            <span>Zawodnicy (A–Z)</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] dark:bg-neutral-800">
              {sortedPlayers.length}
            </span>
          </CardTitle>
          <div className="mt-2 max-h-64 overflow-y-auto">
            {sortedPlayers.length === 0 && (
              <div className="text-muted-foreground">
                Brak zawodników w aktualnym widoku.
              </div>
            )}
            {sortedPlayers.map((p) => (
              <div
                key={p.tm_player_id}
                className="flex items-center justify-between gap-2 border-b border-dashed border-stone-200 py-1 last:border-b-0 dark:border-neutral-800"
              >
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium">
                    {p.player_name || "—"}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {p.club_name || "—"}
                    {p.position && ` • ${p.position}`}
                  </div>
                </div>
                <div className="shrink-0 text-[10px] text-muted-foreground">
                  {p.age ?? ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================ helpers ============================ */

function labelForSource(id?: ScraperId | string) {
  if (id === "tm") return "Transfermarkt";
  if (id === "lnp") return "LNP";
  return String(id || "Źródło");
}
