// app/duplicates/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, RefreshCw, Lock, UserCircle2, Info, CheckCircle2, XCircle, Eye
} from "lucide-react";

/* ======================== Types ======================== */
type Role = "admin" | "scout" | "scout-agent";

type BasePlayer = {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string; // YYYY-MM-DD
  pos: "GK" | "DF" | "MF" | "FW";
  age?: number;
  status?: "active" | "trash";
  photo?: string;
};

type AllPlayer = BasePlayer & {
  scoutId: string;              // who added it
  scoutName?: string;           // optional display
  duplicateOf?: number | null;  // if marked as duplicate -> points to keeper id
  globalId?: number | null;     // canonical id in global DB (if linked/merged)
};

type GlobalPlayer = {
  id: number;
  key: string;                  // normalized name + birthDate (see dupKey)
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  pos: "GK" | "DF" | "MF" | "FW";
  age?: number;
  photo?: string;
  createdAt: string;
  sources: { playerId: number; scoutId: string }[];
};

/* ======================== Utils ======================== */
function normalizeName(s: string) {
  return (s || "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function dupKey(p: { name: string; birthDate?: string }) {
  const base = normalizeName(p.name);
  return [base, p.birthDate || ""].join("|");
}
function completenessScore(p: AllPlayer) {
  let s = 0;
  if (p.firstName) s += 1;
  if (p.lastName) s += 1;
  if (p.birthDate) s += 1;
  if (p.photo) s += 1;
  return s; // 0–4
}
function prettyDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
}
function nowIso() {
  return new Date().toISOString();
}
function fmtTime(ts?: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

/* ======================== Demo Seeder ======================== */
function demoAllPlayers(): AllPlayer[] {
  return [
    // ===== Group A: Jan Kowalski (3 entries)
    { id: 101, name: "Jan Kowalski", firstName: "Jan", lastName: "Kowalski", birthDate: "2006-03-12", pos: "MF", age: 19, scoutId: "s1", scoutName: "Scout A", status: "active", photo: "" },
    { id: 205, name: "Kowalski Jan", firstName: "Jan", lastName: "Kowalski", birthDate: "2006-03-12", pos: "MF", age: 19, scoutId: "s2", scoutName: "Scout B", status: "active" },
    { id: 309, name: "Jan K.",        firstName: "Jan", lastName: "Kowalski", birthDate: "2006-03-12", pos: "MF", age: 19, scoutId: "s3", scoutName: "Scout C", status: "active" },

    // ===== Group B: Marco Rossi (4 entries)
    { id: 402, name: "Marco Rossi",     firstName: "Marco", lastName: "Rossi", birthDate: "2005-09-01", pos: "FW", age: 20, scoutId: "s2", scoutName: "Scout B", status: "active", photo: "" },
    { id: 518, name: "Rossi, Marco",    firstName: "Marco", lastName: "Rossi", birthDate: "2005-09-01", pos: "FW", age: 20, scoutId: "s4", scoutName: "Scout D", status: "active" },
    { id: 519, name: "M. Rossi",        firstName: "Marco", lastName: "Rossi", birthDate: "2005-09-01", pos: "FW", age: 20, scoutId: "s5", scoutName: "Scout E", status: "active" },
    { id: 520, name: "Marco R",         firstName: "Marco", lastName: "Rossi", birthDate: "2005-09-01", pos: "FW", age: 20, scoutId: "s3", scoutName: "Scout C", status: "active" },

    // ===== Group C: João Silva (2 entries; diacritics)
    { id: 610, name: "João Silva",      firstName: "João", lastName: "Silva",  birthDate: "2006-12-11", pos: "FW", age: 18, scoutId: "s1", scoutName: "Scout A", status: "active" },
    { id: 611, name: "Joao Silva",      firstName: "Joao", lastName: "Silva",  birthDate: "2006-12-11", pos: "FW", age: 18, scoutId: "s4", scoutName: "Scout D", status: "active" },

    // ===== Group D: Adam Nowak (2 entries; one trashed)
    { id: 700, name: "Adam Nowak",      firstName: "Adam", lastName: "Nowak",  birthDate: "2007-01-20", pos: "DF", age: 18, scoutId: "s1", scoutName: "Scout A", status: "active" },
    { id: 701, name: "Nowak Adam",      firstName: "Adam", lastName: "Nowak",  birthDate: "2007-01-20", pos: "DF", age: 18, scoutId: "s2", scoutName: "Scout B", status: "trash" },

    // ===== Group E: Luka Modric (2 entries)
    { id: 800, name: "Luka Modrić",     firstName: "Luka", lastName: "Modrić", birthDate: "1985-09-09", pos: "MF", age: 39, scoutId: "s3", scoutName: "Scout C", status: "active" },
    { id: 801, name: "Luka Modric",     firstName: "Luka", lastName: "Modric", birthDate: "1985-09-09", pos: "MF", age: 39, scoutId: "s5", scoutName: "Scout E", status: "active" },

    // Singles (won’t appear as dupes)
    { id: 900, name: "Piotr Zieliński", firstName: "Piotr", lastName: "Zieliński", birthDate: "1994-05-20", pos: "MF", age: 31, scoutId: "s2", scoutName: "Scout B", status: "active" },
    { id: 901, name: "David Müller",    firstName: "David", lastName: "Müller",    birthDate: "2004-02-10", pos: "DF", age: 21, scoutId: "s3", scoutName: "Scout C", status: "active" },
    { id: 902, name: "Oleksii Bondar",  firstName: "Oleksii", lastName: "Bondar",  birthDate: "2006-04-05", pos: "GK", age: 19, scoutId: "s1", scoutName: "Scout A", status: "active" },
    { id: 903, name: "Nicolas Dupont",  firstName: "Nicolas", lastName: "Dupont",  birthDate: "2007-07-07", pos: "DF", age: 18, scoutId: "s4", scoutName: "Scout D", status: "active" },
    { id: 904, name: "Marek Hamsik",    firstName: "Marek", lastName: "Hamsik",    birthDate: "1987-07-27", pos: "MF", age: 37, scoutId: "s5", scoutName: "Scout E", status: "active" },
  ];
}

/* ======================== Global DB helpers ======================== */
function readAllPlayers(): AllPlayer[] {
  try {
    const raw = localStorage.getItem("s4s.allPlayers");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeAllPlayers(arr: AllPlayer[]) {
  try { localStorage.setItem("s4s.allPlayers", JSON.stringify(arr)); } catch {}
}

function readGlobal(): GlobalPlayer[] {
  try {
    const raw = localStorage.getItem("s4s.globalPlayers");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeGlobal(arr: GlobalPlayer[]) {
  try { localStorage.setItem("s4s.globalPlayers", JSON.stringify(arr)); } catch {}
}
function nextGlobalId(list: GlobalPlayer[]) {
  return Math.max(0, ...list.map((g) => g.id)) + 1;
}

/* ======================== Page ======================== */
export default function DuplicatesPage() {
  // ---- hooks (keep order stable) ----
  const [role, setRole] = useState<Role>("scout");
  const [rows, setRows] = useState<AllPlayer[]>([]);
  const [globals, setGlobals] = useState<GlobalPlayer[]>([]);
  const [q, setQ] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [keeperByKey, setKeeperByKey] = useState<Record<string, number | null>>({});
  const [includeTrashed, setIncludeTrashed] = useState(false);
  const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(true);
  const [details, setDetails] = useState<AllPlayer | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | undefined>(undefined);

  // load role
  useEffect(() => {
    try {
      const r = localStorage.getItem("s4s.role");
      if (r === "admin" || r === "scout" || r === "scout-agent") setRole(r);
    } catch {}
  }, []);

  // initial seed + load
  useEffect(() => {
    function initAll() {
      let all = readAllPlayers();
      if (!Array.isArray(all) || all.length === 0) {
        all = demoAllPlayers();
        writeAllPlayers(all);
      }
      setRows(all);
      setGlobals(readGlobal());
    }
    initAll();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "s4s.allPlayers" || e.key === "s4s.globalPlayers" || e.key === "s4s.role") {
        if (e.key === "s4s.role") {
          const r = localStorage.getItem("s4s.role");
          if (r === "admin" || r === "scout" || r === "scout-agent") setRole(r);
        }
        setRows(readAllPlayers());
        setGlobals(readGlobal());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshTick]);

  // recompute groups
  const groups = useMemo(() => {
    const pool = rows.filter((p) => (includeTrashed ? true : (p.status ?? "active") === "active"));
    const map = new Map<string, AllPlayer[]>();
    for (const p of pool) {
      const key = dupKey(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    let arr = Array.from(map.entries())
      .map(([key, list]) => ({ key, list }))
      .filter((g) => g.list.length >= 2);

    if (showOnlyUnresolved) {
      arr = arr.filter((g) => {
        const marked = g.list.filter((p) => !!p.duplicateOf);
        return marked.length < g.list.length - 1;
      });
    }

    const qq = q.trim().toLowerCase();
    if (qq) {
      arr = arr.filter((g) =>
        g.list.some(
          (p) =>
            p.name.toLowerCase().includes(qq) ||
            (p.firstName || "").toLowerCase().includes(qq) ||
            (p.lastName || "").toLowerCase().includes(qq) ||
            (p.scoutName || "").toLowerCase().includes(qq)
        )
      );
    }

    arr.sort((a, b) => {
      const d = b.list.length - a.list.length;
      if (d !== 0) return d;
      const an = a.list[0]?.name?.toLowerCase() ?? "";
      const bn = b.list[0]?.name?.toLowerCase() ?? "";
      return an.localeCompare(bn);
    });

    return arr;
  }, [rows, q, includeTrashed, showOnlyUnresolved]);

  // default keeper per group
  useEffect(() => {
    setKeeperByKey((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (!(g.key in next)) {
          const best = [...g.list].sort((a, b) => completenessScore(b) - completenessScore(a))[0];
          next[g.key] = best?.id ?? null;
        }
      }
      return next;
    });
  }, [groups]);

  const isAdmin = role === "admin";

  function runRefresh() {
    // just reload from storage and stamp time
    setRows(readAllPlayers());
    setGlobals(readGlobal());
    setRefreshTick((t) => t + 1);
    setLastRefreshAt(nowIso());
  }

  function markDuplicatesToKeeper(key: string) {
    const g = groups.find((x) => x.key === key);
    if (!g) return;
    const keeperId = keeperByKey[key];
    if (!keeperId) return;

    const next = rows.map((p) =>
      g.list.some((x) => x.id === p.id)
        ? (p.id === keeperId ? { ...p, duplicateOf: null } : { ...p, duplicateOf: keeperId })
        : p
    );
    setRows(next);
    writeAllPlayers(next);
    runRefresh();
  }

  function mergeGroupToGlobal(key: string) {
    const g = groups.find((x) => x.key === key);
    if (!g) return;

    const keeperId = keeperByKey[key];
    const keeper = g.list.find((p) => p.id === keeperId) ?? g.list[0];

    const existingGlobal = globals.find((gp) => gp.key === key);
    let globalId = existingGlobal?.id;

    if (!existingGlobal) {
      // create new canonical
      const newGlobal: GlobalPlayer = {
        id: nextGlobalId(globals),
        key,
        name: keeper.name,
        firstName: keeper.firstName,
        lastName: keeper.lastName,
        birthDate: keeper.birthDate,
        pos: keeper.pos,
        age: keeper.age,
        photo: keeper.photo,
        createdAt: nowIso(),
        sources: g.list.map((p) => ({ playerId: p.id, scoutId: p.scoutId })),
      };
      const nextGlobal = [...globals, newGlobal];
      writeGlobal(nextGlobal);
      setGlobals(nextGlobal);
      globalId = newGlobal.id;
    } else {
      // update sources (idempotent)
      const srcIds = new Set(existingGlobal.sources.map((s) => s.playerId));
      const merged = {
        ...existingGlobal,
        // prefer richer keeper fields
        name: keeper.name || existingGlobal.name,
        firstName: keeper.firstName ?? existingGlobal.firstName,
        lastName: keeper.lastName ?? existingGlobal.lastName,
        birthDate: keeper.birthDate ?? existingGlobal.birthDate,
        pos: keeper.pos ?? existingGlobal.pos,
        age: keeper.age ?? existingGlobal.age,
        photo: keeper.photo ?? existingGlobal.photo,
        sources: [
          ...existingGlobal.sources,
          ...g.list.filter((p) => !srcIds.has(p.id)).map((p) => ({ playerId: p.id, scoutId: p.scoutId })),
        ],
      } as GlobalPlayer;
      const nextGlobal = globals.map((gp) => (gp.id === merged.id ? merged : gp));
      writeGlobal(nextGlobal);
      setGlobals(nextGlobal);
      globalId = merged.id;
    }

    // link group members to canonical and set duplicateOf to keeper
    const nextRows = rows.map((p) =>
      g.list.some((x) => x.id === p.id)
        ? {
            ...p,
            globalId: globalId!,
            duplicateOf: p.id === keeper.id ? null : keeper.id,
          }
        : p
    );
    setRows(nextRows);
    writeAllPlayers(nextRows);
    runRefresh();
  }

  function linkGroupToExistingGlobal(key: string, globalId: number) {
    const g = groups.find((x) => x.key === key);
    if (!g) return;
    const keeperId = keeperByKey[key] ?? g.list[0]?.id ?? null;

    const nextRows = rows.map((p) =>
      g.list.some((x) => x.id === p.id)
        ? { ...p, globalId, duplicateOf: keeperId && p.id !== keeperId ? keeperId : null }
        : p
    );
    setRows(nextRows);
    writeAllPlayers(nextRows);
    runRefresh();
  }

  return (
    <div className="w-full p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Duplikaty (wszyscy skauci)</h1>
          <p className="text-sm text-dark">
            Wykrywa tych samych zawodników dodanych przez różnych scoutów. Tylko dla Administratora.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex flex-wrap items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            onClick={runRefresh}
            title={lastRefreshAt ? `Ostatnie odświeżenie: ${fmtTime(lastRefreshAt)}` : "Odśwież teraz"}
          >
            <RefreshCw className="h-4 w-4" />
            Odśwież{lastRefreshAt ? ` (${fmtTime(lastRefreshAt)})` : ""}
          </button>
          <Link
            href="/scouts"
            className="inline-flex flex-wrap items-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800"
            title="Lista scoutów"
          >
            <UserCircle2 className="h-4 w-4" />
            Scoutsi
          </Link>
        </div>
      </div>

      {lastRefreshAt && (
        <div className="mb-2 text-xs text-dark">
          Ostatnie odświeżenie: <b>{fmtTime(lastRefreshAt)}</b>
        </div>
      )}

      {!isAdmin ? (
        <div className="rounded border border-dashed border-gray-300 p-6 text-center dark:border-neutral-700">
          <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium">Dostęp tylko dla Administratora</div>
          <div className="mt-1 text-xs text-dark">Zmień rolę na <b>Admin</b> w menu „Konto”.</div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Szukaj po nazwisku lub skaucie…"
                className="w-72 rounded border border-gray-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
              <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <label className="inline-flex flex-wrap items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTrashed}
                onChange={(e) => setIncludeTrashed(e.target.checked)}
              />
              Pokaż także „Kosz”
            </label>
            <label className="inline-flex flex-wrap items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyUnresolved}
                onChange={(e) => setShowOnlyUnresolved(e.target.checked)}
              />
              Tylko nierozwiązane
            </label>
            <div className="ml-auto text-sm text-dark dark:text-neutral-300">
              Grupy: <b>{groups.length}</b>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="rounded border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
              <div className="flex flex-wrap items-center gap-2">
                <Info className="h-4 w-4 text-dark" />
                Brak potencjalnych duplikatów.
              </div>
              <div className="mt-2 text-xs text-dark">
                Wyczyść <code>localStorage:s4s.allPlayers</code>, aby ponownie załadować przykładowe dane.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g, idx) => {
                const keeperId = keeperByKey[g.key] ?? null;
                const rep = [...g.list].sort((a, b) => completenessScore(b) - completenessScore(a))[0];
                const existingGlobal = globals.find((gp) => gp.key === g.key);
                const allLinkedToGlobal = g.list.every((p) => !!p.globalId);

                return (
                  <div
                    key={g.key}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-neutral-800">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {rep?.name || "Nieznany"} • ur. {prettyDate(rep?.birthDate)} • {g.list.length} wpis(y)
                        </div>
                        <div className="mt-0.5 text-[12px] text-dark">
                          Klucz grupy: <code className="rounded bg-gray-50 px-1 py-0.5 dark:bg-neutral-900">{g.key}</code>{" "}
                          {existingGlobal && (
                            <span className="ml-2 inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                              Ma globalny wpis #{existingGlobal.id}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* merge / link to global */}
                        {existingGlobal ? (
                          <button
                            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            onClick={() => linkGroupToExistingGlobal(g.key, existingGlobal.id)}
                            disabled={allLinkedToGlobal}
                            title="Powiąż wszystkie rekordy z istniejącym wpisem globalnym"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Powiąż z globalnym #{existingGlobal.id}
                          </button>
                        ) : (
                          <button
                            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                            onClick={() => mergeGroupToGlobal(g.key)}
                            title="Scal i dodaj do Globalnej bazy"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Scal i dodaj do Globalnej bazy
                          </button>
                        )}

                        {/* classic duplicate marking to keeper */}
                        <button
                          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          onClick={() => markDuplicatesToKeeper(g.key)}
                          disabled={!keeperId}
                          title="Ustaw wskazaną pozycję jako główną, resztę oznacz jako duplikat"
                        >
                          Oznacz duplikaty (keeper)
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                          onClick={() => setKeeperByKey((prev) => ({ ...prev, [g.key]: null }))}
                          title="Wyczyść wybór keepera"
                        >
                          <XCircle className="h-4 w-4" />
                          Wyczyść keepera
                        </button>
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-dark dark:bg-neutral-900 dark:text-neutral-300">
                          <tr>
                            <th className="p-3 text-left font-medium">Keeper</th>
                            <th className="p-3 text-left font-medium">Scout</th>
                            <th className="p-3 text-left font-medium">Nazwisko i imię</th>
                            <th className="p-3 text-left font-medium">Data ur.</th>
                            <th className="p-3 text-left font-medium">Poz.</th>
                            <th className="p-3 text-left font-medium">Status</th>
                            <th className="p-3 text-left font-medium">Kompletność</th>
                            <th className="p-3 text-left font-medium">Global</th>
                            <th className="p-3 text-right font-medium">Akcje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.list
                            .slice()
                            .sort((a, b) => {
                              if (a.id === keeperId) return -1;
                              if (b.id === keeperId) return 1;
                              return completenessScore(b) - completenessScore(a);
                            })
                            .map((p) => {
                              const comp = completenessScore(p);
                              const isKeeper = p.id === keeperId;
                              return (
                                <tr key={p.id} className="border-t border-gray-200 dark:border-neutral-800">
                                  <td className="p-3 align-middle">
                                    <input
                                      type="radio"
                                      name={`keeper-${idx}`}
                                      checked={isKeeper}
                                      onChange={() =>
                                        setKeeperByKey((prev) => ({ ...prev, [g.key]: p.id }))
                                      }
                                    />
                                  </td>
                                  <td className="p-3 align-middle">
                                    <div className="font-medium text-gray-900 dark:text-neutral-100">
                                      {p.scoutName || p.scoutId}
                                    </div>
                                    <div className="text-xs text-dark">{p.scoutId}</div>
                                  </td>
                                  <td className="p-3 align-middle">
                                    <div className="font-medium text-gray-900 dark:text-neutral-100">
                                      {p.name}
                                    </div>
                                    <div className="text-xs text-dark">
                                      {(p.firstName || "—") + " " + (p.lastName || "")}
                                    </div>
                                  </td>
                                  <td className="p-3 align-middle">{prettyDate(p.birthDate)}</td>
                                  <td className="p-3 align-middle">
                                    <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                                      {p.pos}
                                    </span>
                                  </td>
                                  <td className="p-3 align-middle">
                                    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${
                                      (p.status ?? "active") === "active"
                                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                                        : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                                    }`}>
                                      {(p.status ?? "active") === "active" ? "aktywny" : "kosz"}
                                    </span>
                                  </td>
                                  <td className="p-3 align-middle">
                                    <div className="w-40 rounded bg-gray-100 dark:bg-neutral-800">
                                      <div
                                        className={`h-2 rounded ${isKeeper ? "bg-emerald-500" : "bg-gray-400"}`}
                                        style={{ width: `${(comp / 4) * 100}%` }}
                                      />
                                    </div>
                                    <div className="mt-1 text-xs text-dark">{comp}/4</div>
                                  </td>
                                  <td className="p-3 align-middle text-xs">
                                    {p.globalId ? (
                                      <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                                        #{p.globalId}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="p-3 align-middle text-right">
                                    <button
                                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                      onClick={() => setDetails(p)}
                                      title="Podgląd szczegółów rekordu skauta"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Szczegóły
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== Details Modal ===== */}
      {details && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-neutral-800">
              <div className="text-sm font-semibold">Szczegóły zawodnika skauta</div>
              <button
                className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                onClick={() => setDetails(null)}
              >
                Zamknij
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-dark">Scout</div>
                  <div className="font-medium">{details.scoutName || details.scoutId}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">ID rekordu</div>
                  <div className="font-medium">#{details.id}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-dark">Nazwa</div>
                  <div className="font-medium">{details.name}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Imię</div>
                  <div>{details.firstName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Nazwisko</div>
                  <div>{details.lastName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Data ur.</div>
                  <div>{prettyDate(details.birthDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Pozycja</div>
                  <div>{details.pos}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Status</div>
                  <div>{details.status ?? "active"}</div>
                </div>
                <div>
                  <div className="text-xs text-dark">Global</div>
                  <div>{details.globalId ? `#${details.globalId}` : "—"}</div>
                </div>
              </div>
              <div className="mt-4 rounded bg-gray-50 p-3 text-xs leading-relaxed dark:bg-neutral-900">
                <div className="font-medium mb-1">Uwaga dot. scalania i przyszłych duplikatów</div>
                Po scaleniu do globalnej bazy, kolejne wpisy scoutów o tym samym zawodniku zostaną
                wykryte jako grupa o tym samym kluczu. Wystarczy użyć akcji
                <b> „Powiąż z globalnym”</b>, aby dopiąć nowy wpis do istn. rekordu globalnego.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
              <span className="text-gray-500">Klucz: <code>{dupKey(details)}</code></span>
              <div className="text-gray-500">Kompletność: {completenessScore(details)}/4</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
