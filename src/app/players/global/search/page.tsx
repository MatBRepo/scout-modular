"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="w-full">
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
            <TabsList className="rounded-md bg-stone-100 p-1 shadow-sm dark:bg-neutral-900">
              <TabsTrigger
                value="lnp"
                className="px-3 py-1.5 text-xs sm:px-4 sm:py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800"
              >
                LNP – wyszukiwarka
              </TabsTrigger>
              <TabsTrigger
                value="tm"
                className="px-3 py-1.5 text-xs sm:px-4 sm:py-2 data-[state=active]:bg-white data-[state=active]:shadow dark:data-[state=active]:bg-neutral-800"
              >
                Transfermarkt – scraper
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="mt-4 space-y-4">
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
      const json = (await rsp.json()) as ScrapeResult[];

      const normalized = json.map((bucket) => ({
        ...bucket,
        items: bucket.items.map((it) => ({
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
        `Zakończono w ${took} ms • Łącznie ${totalCount} znalezionych rekordów`
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
    setStatusMsg(`Dodano ${fresh.length} nowych rekordów do lokalnej bazy.`);
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
    <div className="space-y-4">
      {/* Sterowanie */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          placeholder="Szukaj w LNP (nazwisko, klub…) "
          className="h-9 w-full max-w-xs sm:max-w-md"
        />
        <Button
          className="h-9 bg-gray-900 text-white hover:bg-gray-800"
          onClick={run}
          disabled={running || !q.trim()}
        >
          <Search className="mr-2 h-4 w-4" /> Szukaj
        </Button>
        <Button
          variant="outline"
          className="h-9 border-gray-300 dark:border-neutral-700"
          onClick={stop}
          disabled={!running}
        >
          <XCircle className="mr-2 h-4 w-4" /> Przerwij
        </Button>

        <div className="ml-0 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950 sm:ml-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="only-new"
              checked={onlyNew}
              onCheckedChange={(v) => setOnlyNew(Boolean(v))}
              className="h-4 w-4"
            />
            <Label
              htmlFor="only-new"
              className="cursor-pointer text-[12px] leading-none"
            >
              Pokaż tylko nowe rekordy
            </Label>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-7 border-gray-300 px-2 text-xs dark:border-neutral-700"
            onClick={() => setResults([])}
            title="Wyczyść wyniki wyszukiwania"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="ml-1">Wyczyść</span>
          </Button>
        </div>

        <Button
          variant="outline"
          className="h-9 border-gray-300 dark:border-neutral-700"
          onClick={importCSV}
        >
          <Upload className="mr-2 h-4 w-4" /> Import CSV
        </Button>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="mb-1 inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
          {statusMsg}
        </div>
      )}

      {/* Wyniki */}
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
    <Card className="border-gray-200 dark:border-neutral-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm">
            {sourceLabel ? `Wyniki: ${sourceLabel}` : "Wyniki"}{" "}
            <span className="ml-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {rows.length}
            </span>
          </CardTitle>
          {typeof tookMs === "number" && (
            <div className="mt-1 text-[11px] text-dark dark:text-neutral-400">
              Czas odpow.: {tookMs} ms
            </div>
          )}
          {error && (
            <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
              Błąd źródła LNP: {error}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="bg-gray-900 text-white hover:bg-gray-800"
            onClick={onAddAll}
            disabled={rows.length === 0}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Dodaj wszystkie do lokalnej bazy
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
                  <tr
                    key={`${r.id}-${r.source}-${r.extId || ""}`}
                    className="border-t border-gray-200 dark:border-neutral-800"
                  >
                    <td className="p-3">
                      <div className="font-medium text-gray-900 dark:text-neutral-100">
                        {r.name || "—"}
                      </div>
                      {r.nationality && (
                        <div className="text-xs text-dark dark:text-neutral-400">
                          {r.nationality}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{r.club || "—"}</td>
                    <td className="p-3">
                      {r.pos ? (
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                          {r.pos}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">{r.age ?? "—"}</td>
                    <td className="p-3">
                      {labelForSource(r.source as ScraperId | string)}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-gray-300 dark:border-neutral-700"
                        onClick={() => onAddOne(r)}
                        disabled={inDb}
                        title={
                          inDb
                            ? "Już znajduje się w lokalnej bazie"
                            : "Dodaj do lokalnej bazy LNP"
                        }
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
                  <td
                    colSpan={6}
                    className="p-5 text-center text-sm text-dark dark:text-neutral-400"
                  >
                    Brak wyników do wyświetlenia. Użyj wyszukiwarki powyżej.
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

  /* ----- pobierz listę zawodników (flat=1, details=1) ----- */
  const loadPlayers = async () => {
    setLoading(true);
    setErrorMsg(null);
    setLastApiMessage(null);

    try {
      const url =
        `/api/admin/tm/scrape/competition/list` +
        `?country=${encodeURIComponent(country)}` +
        `&season=${encodeURIComponent(season)}` +
        `&details=1&flat=1`;

      const r = await fetch(url, { cache: "no-store" });
      const text = await r.text();

      if (!r.ok) {
        // jeśli backend zwrócił JSON z error, spróbuj go wyciągnąć
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
        toast.error(msg);
        return;
      }

      const rowsRaw: any[] = j.rows || [];

      const list: TmPlayerRow[] = rowsRaw.map((row: any) => ({
        tm_player_id: Number(row.tm_player_id),
        player_name: String(row.player_name || ""),
        player_path: row.player_path || "",

        competition_code: String(row.competition_code || ""),
        competition_name: String(row.competition_name || ""),
        tier_label:
          row.tier_label === undefined || row.tier_label === null
            ? null
            : String(row.tier_label),

        club_tm_id:
          row.club_tm_id === undefined || row.club_tm_id === null
            ? null
            : Number(row.club_tm_id),
        club_name: String(row.club_name || ""),
        club_profile_path: row.club_profile_path || "",

        number: row.number ?? null,
        position: row.position ?? null,
        age:
          typeof row.age === "number"
            ? row.age
            : row.age
            ? Number(row.age)
            : null,
        nationalities: Array.isArray(row.nationalities)
          ? row.nationalities
          : row.nationalities
          ? [String(row.nationalities)]
          : [],
        height_cm:
          typeof row.height_cm === "number" ? row.height_cm : null,
        foot: row.foot ?? null,
        date_of_birth: row.date_of_birth ?? null,
        contract_until: row.contract_until ?? null,
      }));

      setRows(list);
      setStats({
        competitions: Number(j.competitionsCount || 0),
        clubs: Number(j.clubsCount || 0),
        players: Number(j.playersCount || list.length),
      });

      const okMsg = `Pobrano ${list.length} zawodników (kraj: ${country}, sezon: ${season})`;
      setLastApiMessage(okMsg);
      toast.success(okMsg);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "Nie udało się pobrać listy zawodników";
      setErrorMsg(msg);
      setLastApiMessage(msg);
      setRows([]);
      setStats({ competitions: 0, clubs: 0, players: 0 });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // automat: pierwszy load
    loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- filtrowanie (wielowyrazowe) ----- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    const tokens = q.split(/\s+/).filter(Boolean);

    return rows.filter((p) => {
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
  }, [rows, search]);

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
  const visible = filtered.length;

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Database className="h-5 w-5" />
          Scraper zawodników (Transfermarkt – kraj / sezon)
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">
            Rozgrywek: {stats.competitions}
          </span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">
            Klubów: {stats.clubs}
          </span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">
            Zawodników: {stats.players}
          </span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5">
            Widoczne (filtr): {visible}/{total}
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Ładowanie z TM…
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/scraper/data">Pobrane dane</Link>
          </Button>
        </div>
      </div>

      {/* Sterowanie */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">Kraj (ID TM)</label>
            <Input
              className="w-28"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              onBlur={loadPlayers}
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Sezon</label>
            <Input
              className="w-28"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              onBlur={loadPlayers}
              disabled={loading}
            />
          </div>

          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtruj po nazwie / klubie / rozgrywkach / pozycji…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setSearch("")}
              disabled={!search || loading}
            >
              Wyczyść filtr
            </Button>
          </div>

          <div className="my-1 w-full border-t" />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={loadPlayers}
              disabled={loading}
            >
              <RotateCw className="h-4 w-4" />
              Odśwież listę
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {lastApiMessage && !errorMsg && (
          <div className="mt-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            {lastApiMessage}
          </div>
        )}
      </Card>

      {/* Tabela: rozgrywki + klub + zawodnik */}
      <Card className="p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="p-3 text-left font-medium">Rozgrywki</th>
                <th className="p-3 text-left font-medium">Klub</th>
                <th className="p-3 text-left font-medium">Zawodnik</th>
                <th className="p-3 text-left font-medium">Pozycja</th>
                <th className="p-3 text-left font-medium">Wiek</th>
                <th className="p-3 text-left font-medium">Narodowość</th>
                <th className="p-3 text-left font-medium">Data ur.</th>
                <th className="p-3 text-left font-medium">Kontrakt do</th>
                <th className="p-3 text-right font-medium">TM</th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-4 text-center text-sm text-muted-foreground"
                  >
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ładowanie danych z Transfermarkt…
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((p) => {
                  const tmHref = openTmUrl(p.player_path);

                  return (
                    <tr
                      key={p.tm_player_id}
                      className="border-t border-gray-200 align-top dark:border-neutral-800"
                    >
                      {/* Rozgrywki */}
                      <td className="p-3">
                        <div className="truncate text-xs font-medium">
                          {p.competition_name}
                        </div>
                        {p.tier_label && (
                          <div className="mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {p.tier_label}
                          </div>
                        )}
                      </td>

                      {/* Klub */}
                      <td className="p-3">
                        <div className="truncate">{p.club_name || "—"}</div>
                      </td>

                      {/* Zawodnik */}
                      <td className="p-3">
                        <div className="font-medium truncate">
                          {p.player_name || "—"}
                        </div>
                      </td>

                      {/* Pozycja */}
                      <td className="p-3">
                        {p.position ? (
                          <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                            {p.position}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Wiek */}
                      <td className="p-3">{p.age ?? "—"}</td>

                      {/* Narodowość */}
                      <td className="p-3">
                        {p.nationalities && p.nationalities.length > 0
                          ? p.nationalities.join(", ")
                          : "—"}
                      </td>

                      {/* Data ur. */}
                      <td className="p-3">
                        {p.date_of_birth ? p.date_of_birth : "—"}
                      </td>

                      {/* Kontrakt */}
                      <td className="p-3">
                        {p.contract_until ? p.contract_until : "—"}
                      </td>

                      {/* TM link + copy */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2 text-[11px] font-mono text-muted-foreground">
                          {p.player_path ? (
                            <>
                              <span className="hidden max-w-[200px] truncate sm:inline">
                                {p.player_path}
                              </span>
                              <button
                                className="inline-flex items-center rounded border px-1 py-0.5 hover:bg-muted"
                                onClick={() => copyPath(p.player_path)}
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

              {!loading && !filtered.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-4 text-center text-sm text-muted-foreground"
                  >
                    Brak zawodników spełniających podane filtry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ============================ helpers ============================ */

function labelForSource(id?: ScraperId | string) {
  if (id === "tm") return "Transfermarkt";
  if (id === "lnp") return "LNP";
  return String(id || "Źródło");
}
