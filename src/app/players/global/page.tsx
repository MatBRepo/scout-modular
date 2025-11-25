// /app/players/global/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Search,
  NotebookPen,
  Trash2,
  Undo2,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Users,
  X,
  Info as InfoIcon,
} from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import StarRating from "@/shared/ui/StarRating";

/* ============================== Types ============================== */

type RankSource = "tm" | "wyscout" | "sofifa" | "custom";

type GlobalSource = {
  playerId: number | string;
  scoutId: string;
};

type GlobalPlayer = {
  id: string;
  key?: string;
  name: string;
  club?: string;
  pos?: "GK" | "DF" | "MF" | "FW" | string;
  age?: number;
  nationality?: string;
  source?: RankSource | string;
  extId?: string;
  addedAt?: string;
  adminNote?: string;
  meta?: Record<string, any>;
  sources?: GlobalSource[];
};

type Role = "admin" | "scout" | "scout-agent";

type AuthStatus = "checking" | "unauth" | "forbidden" | "ok";

type ScoutMeta = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type SourcesModalState = {
  playerName: string;
  scouts: {
    id: string;
    name?: string | null;
    email?: string | null;
  }[];
};

type RatingAspect = {
  id: string;
  key: string;
  label: string;
  tooltip?: string | null;
  enabled?: boolean | null;
  groupKey: string; // GEN / GK / DEF / MID / FW
};

type RatingSummary = {
  id: string;
  key: string;
  label: string;
  tooltip?: string;
  groupKey: string;
  avg: number;
  count: number;
};

type ObsItem = {
  id: number;
  match?: string | null;
  date?: string | null;
  time?: string | null;
  mode?: string | null;
  status?: string | null;
  userId?: string | null;
};

/* ============================== Utils ============================== */

function normalizeName(s: string) {
  return (s || "")
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================== Page (Admin) ========================== */

export default function GlobalDatabasePage() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [role, setRole] = useState<Role | null>(null);

  const [rows, setRows] = useState<GlobalPlayer[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [scoutsMap, setScoutsMap] = useState<Record<string, ScoutMeta>>({});
  const [sourcesModal, setSourcesModal] =
    useState<SourcesModalState | null>(null);

  // rozwijany wiersz
  const [expandedGlobal, setExpandedGlobal] = useState<GlobalPlayer | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailPlayers, setDetailPlayers] = useState<any[]>([]);
  const [detailObservations, setDetailObservations] = useState<ObsItem[]>([]);
  const [ratingAspects, setRatingAspects] = useState<RatingAspect[]>([]);

  /* ------------------------- Auth + role ------------------------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabase();

        const { data: userData, error: userErr } =
          await supabase.auth.getUser();

        if (userErr || !userData?.user) {
          if (!cancelled) {
            setAuthStatus("unauth");
            setRole(null);
          }
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userData.user.id)
          .single();

        if (profileErr || !profile?.role) {
          if (!cancelled) {
            setAuthStatus("forbidden");
            setRole(null);
          }
          return;
        }

        const r = profile.role as Role;
        if (!cancelled) {
          setRole(r);
          setAuthStatus(r === "admin" ? "ok" : "forbidden");
        }

        if (r === "admin") {
          await loadPlayers();
        }
      } catch (err) {
        console.error("[GlobalDatabasePage] auth/role error:", err);
        if (!cancelled) {
          setAuthStatus("forbidden");
          setRole(null);
          setError("Nie udało się zweryfikować uprawnień.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------- Supabase: load list --------------------- */

  async function loadPlayers() {
    setLoadingList(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: dbError } = await supabase
        .from("global_players")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbError) {
        console.error("[GlobalDatabasePage] loadPlayers error:", dbError);
        setError("Nie udało się pobrać globalnej bazy zawodników.");
        setRows([]);
        return;
      }

      const mapped: GlobalPlayer[] = (data || []).map((row: any) => ({
        id: String(row.id),
        key: row.key ?? undefined,
        name: row.name ?? "",
        club: row.club ?? undefined,
        pos: row.pos ?? undefined,
        age: row.age ?? undefined,
        nationality: row.nationality ?? undefined,
        source: row.source ?? undefined,
        extId: row.ext_id ?? undefined,
        addedAt: row.created_at ?? undefined,
        adminNote: row.admin_note ?? undefined,
        meta: row.meta ?? undefined,
        sources: Array.isArray(row.sources) ? row.sources : undefined,
      }));

      setRows(mapped);

      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, role");

      if (!profilesErr && Array.isArray(profiles)) {
        const map: Record<string, ScoutMeta> = {};
        for (const p of profiles as any[]) {
          map[p.id] = {
            id: p.id,
            name: p.full_name,
            email: p.email,
            role: p.role,
          };
        }
        setScoutsMap(map);
      } else if (profilesErr) {
        console.warn(
          "[GlobalDatabasePage] loadPlayers profiles error:",
          profilesErr
        );
      }
    } catch (err) {
      console.error("[GlobalDatabasePage] loadPlayers exception:", err);
      setError("Wystąpił błąd podczas ładowania globalnej bazy.");
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }

  /* ---- Ładowanie konfiguracji aspektów ocen (globalnie, raz) ---- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabase();
        const { data, error: dbError } = await supabase
          .from("player_rating_aspects")
          .select("id, key, label, tooltip, enabled, group_key, sort_order")
          .order("sort_order", { ascending: true });

        if (dbError) {
          console.warn(
            "[GlobalDatabasePage] load rating_aspects error:",
            dbError
          );
          return;
        }

        if (!cancelled && Array.isArray(data)) {
          setRatingAspects(
            data.map((row: any) => ({
              id: row.id as string,
              key: row.key as string,
              label: row.label as string,
              tooltip: row.tooltip ?? null,
              enabled: row.enabled ?? true,
              groupKey: (row.group_key as string) || "GEN",
            }))
          );
        }
      } catch (err) {
        console.error(
          "[GlobalDatabasePage] load rating_aspects exception:",
          err
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------- Sync / reload ------------------------ */

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await loadPlayers();
    } catch (err) {
      console.error("[GlobalDatabasePage] handleSync exception:", err);
      setError("Wystąpił błąd podczas odświeżania globalnej bazy.");
    } finally {
      setSyncing(false);
    }
  }

  /* ------------------------- Local helpers ------------------------ */

  const filtered = useMemo(() => {
    const map = new Map<string, GlobalPlayer>();

    for (const r of rows) {
      const normalized = normalizeName(r.name || "");
      const key = normalized || `id:${r.id}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, r);
        continue;
      }

      const mergedSourcesRaw = [
        ...(existing.sources || []),
        ...(r.sources || []),
      ];
      const seen = new Set<string>();
      const mergedSources: GlobalSource[] = mergedSourcesRaw.filter((s) => {
        const marker = `${s.scoutId}|${s.playerId}`;
        if (seen.has(marker)) return false;
        seen.add(marker);
        return true;
      });

      const tNew = r.addedAt ? new Date(r.addedAt).getTime() : 0;
      const tOld = existing.addedAt
        ? new Date(existing.addedAt).getTime()
        : 0;
      const winner = tNew > tOld ? r : existing;

      map.set(key, { ...winner, sources: mergedSources });
    }

    const base = Array.from(map.values());

    const qq = q.trim().toLowerCase();
    const list = !qq
      ? base
      : base.filter((r) =>
          [r.name, r.club, r.nationality, r.pos]
            .map((x) => (x || "").toString().toLowerCase())
            .some((x) => x.includes(qq))
        );

    return [...list].sort((a, b) => {
      const ad = a.addedAt || "";
      const bd = b.addedAt || "";
      if (ad !== bd) return bd > ad ? 1 : -1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [rows, q]);

  const lastSync: Date | null = useMemo(() => {
    if (!rows.length) return null;
    const timestamps = rows
      .map((r) => (r.addedAt ? new Date(r.addedAt).getTime() : 0))
      .filter((t) => t > 0);
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps));
  }, [rows]);

  function clearSearch() {
    setQ("");
  }

  function startEditNote(r: GlobalPlayer) {
    setEditingId(r.id);
    setNoteDraft(r.adminNote ?? "");
  }

  function cancelNote() {
    setEditingId(null);
    setNoteDraft("");
    setSavingNoteId(null);
  }

  async function saveNote() {
    if (!editingId) return;
    const id = editingId;
    setSavingNoteId(id);
    setError(null);

    try {
      const supabase = getSupabase();
      const { error: dbError } = await supabase
        .from("global_players")
        .update({ admin_note: noteDraft })
        .eq("id", id);

      if (dbError) {
        console.error("[GlobalDatabasePage] saveNote error:", dbError);
        setError("Nie udało się zapisać notatki Admina.");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, adminNote: noteDraft } : r
        )
      );
      setEditingId(null);
      setNoteDraft("");
    } catch (err) {
      console.error("[GlobalDatabasePage] saveNote exception:", err);
      setError("Wystąpił błąd podczas zapisu notatki.");
    } finally {
      setSavingNoteId(null);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    setError(null);

    try {
      const supabase = getSupabase();
      const { error: dbError } = await supabase
        .from("global_players")
        .delete()
        .eq("id", id);

      if (dbError) {
        console.error("[GlobalDatabasePage] delete error:", dbError);
        setError("Nie udało się usunąć zawodnika z globalnej bazy.");
        return;
      }

      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("[GlobalDatabasePage] delete exception:", err);
      setError("Wystąpił błąd podczas usuwania zawodnika.");
    } finally {
      setDeletingId(null);
    }
  }

  async function refreshFromSupabase() {
    await loadPlayers();
  }

  const isAdmin = authStatus === "ok" && role === "admin";

  /* ------------------- Szczegóły globalnego gracza ------------------ */

  async function toggleDetail(r: GlobalPlayer) {
    // jeśli klikam w ten sam – zwijamy
    if (expandedGlobal && expandedGlobal.id === r.id) {
      setExpandedGlobal(null);
      setDetailPlayers([]);
      setDetailObservations([]);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    // nowy rozwijany wiersz
    setExpandedGlobal(r);
    setDetailLoading(true);
    setDetailError(null);
    setDetailPlayers([]);
    setDetailObservations([]);

    try {
      const supabase = getSupabase();
      const normName = normalizeName(r.name || "");

      // 1) players – szukamy po name (a potem normalizujemy w JS)
      const { data: playersData, error: playersErr } = await supabase
        .from("players")
        .select("id, meta, user_id, name, \"firstName\", \"lastName\"")
        .ilike("name", `%${r.name}%`);

      if (playersErr) {
        console.error(
          "[GlobalDatabasePage] toggleDetail players error:",
          playersErr
        );
      }

      let playersArr = (playersData || []) as any[];

      playersArr = playersArr.filter((p) => {
        const displayName =
          (p.name as string) ||
          `${p.firstName || ""} ${p.lastName || ""}`.trim();
        if (!displayName) return false;
        return normalizeName(displayName) === normName;
      });

      setDetailPlayers(playersArr);

      const playerIds = playersArr.map((p) => p.id);

      // 2) observations – bierzemy trochę rekordów i filtrujemy w JS
      const { data: obsData, error: obsErr } = await supabase
        .from("observations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (obsErr) {
        console.error(
          "[GlobalDatabasePage] toggleDetail observations error:",
          obsErr
        );
      }

      const allObs = Array.isArray(obsData) ? obsData : [];

      const matchedObs = allObs.filter((o: any) => {
        // dopasowanie po kolumnie player (tekst)
        if (o.player && normalizeName(o.player) === normName) {
          return true;
        }

        const arr = Array.isArray(o.players) ? o.players : [];
        if (!arr.length) return false;

        return arr.some((entry: any) => {
          const nameFromEntry =
            entry.playerName ||
            entry.name ||
            `${entry.firstName || ""} ${entry.lastName || ""}`.trim();

          if (nameFromEntry && normalizeName(nameFromEntry) === normName) {
            return true;
          }

          const gid =
            entry.globalId ??
            entry.global_id ??
            entry.global ??
            null;
          if (gid != null && Number(gid) === Number(r.id)) {
            return true;
          }

          const pid =
            entry.playerId ?? entry.player_id ?? entry.id ?? null;
          if (pid != null && playerIds.includes(pid)) {
            return true;
          }

          return false;
        });
      });

      const mappedObs: ObsItem[] = matchedObs.map((o: any) => ({
        id: o.id,
        match: o.match ?? null,
        date: o.date ?? null,
        time: o.time ?? null,
        mode: o.mode ?? null,
        status: o.status ?? null,
        userId: o.user_id ?? o.userId ?? null,
      }));

      setDetailObservations(mappedObs);
    } catch (err) {
      console.error("[GlobalDatabasePage] toggleDetail exception:", err);
      setDetailError(
        "Wystąpił błąd podczas pobierania szczegółów globalnego zawodnika."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  /* --------- Agregacja ocen z wielu scoutów (średnie) --------- */

  const ratingsSummary: RatingSummary[] = useMemo(() => {
    if (!detailPlayers.length || !ratingAspects.length) return [];

    const acc = new Map<
      string,
      { sum: number; count: number; aspect: RatingAspect }
    >();

    for (const p of detailPlayers) {
      const meta = (p.meta as any) || {};
      const ratings = (meta.ratings || {}) as Record<string, any>;
      for (const [key, rawVal] of Object.entries(ratings)) {
        let val = typeof rawVal === "number" ? rawVal : Number(rawVal);
        if (!Number.isFinite(val) || val <= 0) continue;

        const aspect = ratingAspects.find((a) => a.key === key);
        if (!aspect || aspect.enabled === false) continue;

        const current = acc.get(key);
        if (!current) {
          acc.set(key, { sum: val, count: 1, aspect });
        } else {
          current.sum += val;
          current.count += 1;
        }
      }
    }

    return Array.from(acc.values())
      .map(({ sum, count, aspect }) => ({
        id: aspect.id,
        key: aspect.key,
        label: aspect.label,
        tooltip: aspect.tooltip ?? undefined,
        groupKey: aspect.groupKey || "GEN",
        avg: Math.round((sum / count) * 10) / 10,
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [detailPlayers, ratingAspects]);

  const baseSummaries = ratingsSummary.filter(
    (x) => (x.groupKey || "GEN") === "GEN"
  );
  const gkSummaries = ratingsSummary.filter((x) => x.groupKey === "GK");
  const defSummaries = ratingsSummary.filter((x) => x.groupKey === "DEF");
  const midSummaries = ratingsSummary.filter((x) => x.groupKey === "MID");
  const fwSummaries = ratingsSummary.filter((x) => x.groupKey === "FW");

  /* ---------------------------- Render ---------------------------- */

  if (authStatus === "checking") {
    return (
      <div className="w-full">
        <Card className="mt-4 border-gray-200 dark:border-neutral-800">
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            <div className="text-sm text-gray-700 dark:text-neutral-300">
              Sprawdzam uprawnienia…
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authStatus === "unauth") {
    return (
      <div className="w-full">
        <Card className="mt-4 border-amber-200 dark:border-amber-900/50">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-5 w-5" />
              Wymagane logowanie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-neutral-300">
              Aby zobaczyć globalną bazę zawodników, zaloguj się do konta
              z uprawnieniami <b>Admin</b>.
            </p>
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => router.push("/")}
            >
              Wróć do kokpitu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="w-full">
        <Card className="mt-4 border-rose-200 dark:border-rose-900/50">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="h-5 w-5" />
              Brak uprawnień
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-neutral-300">
              Ten widok jest dostępny wyłącznie dla roli <b>Admin</b>.
            </p>
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => router.push("/")}
            >
              Wróć do kokpitu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <Toolbar
        title="Zawodnicy — globalna baza (Admin)"
        right={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2 h-4 w-4 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Szukaj po nazwisku, klubie, narodowości…"
                className="w-72 pl-8 pr-10"
              />
              {q && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 text-xs text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                  aria-label="Wyczyść wyszukiwanie"
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              variant="outline"
              className="h-9 border-gray-300 dark:border-neutral-700"
              onClick={handleSync}
              title="Przeładuj globalną bazę z tabeli global_players"
              disabled={syncing || loadingList}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Przeładuj bazę
            </Button>

            <Button
              variant="outline"
              className="h-9 border-gray-300 dark:border-neutral-700"
              onClick={refreshFromSupabase}
              title="Wczytaj ponownie z global_players"
              disabled={loadingList || syncing}
            >
              {loadingList && !syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Odśwież
            </Button>
          </div>
        }
      />

      <Card className="border-dashed border-slate-300 bg-slate-50/70 text-xs dark:border-neutral-700 dark:bg-neutral-900/40">
        <CardContent className="flex flex-wrap items-start gap-2 px-3 py-2">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 text-slate-500 dark:text-neutral-400" />
          <div className="space-y-1">
            <div className="font-medium text-slate-800 dark:text-neutral-100">
              Globalna baza = końcowy, bezduplikatowy katalog zawodników
            </div>
            <p className="text-slate-600 dark:text-neutral-300">
              W tej tabeli widzisz po <b>jednym wierszu na zawodnika</b>{" "}
              (deduplikacja po znormalizowanej nazwie). Rekordy trafiają z
              widoku{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px] dark:bg-neutral-800">
                Duplikaty
              </code>{" "}
              po akcji <b>„Scal i dodaj do Globalnej bazy”</b> /{" "}
              <b>„Powiąż z globalnym”</b> lub z zewnętrznych źródeł (TM/Wyscout).
              Jeśli zawodnik ma przypisanych scoutów w polu{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 text-[10px] dark:bg-neutral-800">
                sources
              </code>
              , zobaczysz badge z liczbą kont scoutów i listę po kliknięciu.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mt-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      )}

      <Card className="border-gray-200 dark:border-neutral-800">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm">
              Globalna baza •{" "}
              <span className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {filtered.length} zawodników
              </span>
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Ostatnia aktualizacja:{" "}
              {lastSync
                ? lastSync.toLocaleString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "brak danych – dodaj zawodników przez Duplikaty / merge do globalnej bazy"}
            </p>
          </div>

          {(loadingList || syncing) && (
            <div className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {syncing ? "Przeładowywanie…" : "Ładowanie…"}
            </div>
          )}
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
                  <th className="p-3 text-left font-medium">Narodowość</th>
                  <th className="p-3 text-left font-medium">Źródło</th>
                  <th className="p-3 text-left font-medium">Dodano</th>
                  <th className="p-3 text-left font-medium">
                    Notatka (Admin)
                  </th>
                  <th className="p-3 text-right font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const isEditing = editingId === r.id;
                  const isSavingThis = savingNoteId === r.id;
                  const isDeletingThis = deletingId === r.id;
                  const isExpanded =
                    expandedGlobal && expandedGlobal.id === r.id;

                  const scoutIds = Array.isArray(r.sources)
                    ? Array.from(
                        new Set(
                          r.sources
                            .map((s) => s.scoutId)
                            .filter((id): id is string => !!id)
                        )
                      )
                    : [];

                  const scoutsCount = scoutIds.length;
                  const scoutsLabel =
                    scoutsCount === 1
                      ? "1 scout"
                      : `${scoutsCount} scoutów`;

                  return (
                    <>
                      <tr
                        key={r.id}
                        className={cn(
                          "border-t border-gray-200 align-top dark:border-neutral-800",
                          idx % 2
                            ? "bg-stone-50/60 dark:bg-neutral-900/40"
                            : "bg-white dark:bg-neutral-950"
                        )}
                      >
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <div className="font-medium text-gray-900 dark:text-neutral-100">
                              {r.name || "—"}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400">
                              {r.extId && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-neutral-900">
                                  ID zewn.: {r.extId}
                                </span>
                              )}
                              {scoutsCount > 0 && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                                  onClick={() =>
                                    setSourcesModal({
                                      playerName:
                                        r.name || "Bez nazwy",
                                      scouts: scoutIds.map((id) => ({
                                        id,
                                        name: scoutsMap[id]?.name,
                                        email: scoutsMap[id]?.email,
                                      })),
                                    })
                                  }
                                  title="Pokaż listę scoutów, którzy mają tego zawodnika"
                                >
                                  <Users className="h-3 w-3" />
                                  {scoutsLabel}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {r.club ? (
                            <span className="inline-flex max-w-[180px] items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-800 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
                              {r.club}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
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
                          {r.nationality ? (
                            <span className="inline-flex max-w-[140px] items-center rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-800 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
                              {r.nationality}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">
                          {labelForSource(r.source)}
                        </td>
                        <td className="p-3">
                          {r.addedAt
                            ? new Date(r.addedAt).toLocaleString(
                                "pl-PL",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "—"}
                        </td>
                        <td className="p-3">
                          {!isEditing ? (
                            r.adminNote ? (
                              <div className="max-w-xs truncate text-gray-800 dark:text-neutral-100">
                                {r.adminNote}
                              </div>
                            ) : (
                              <span className="text-xs text-dark dark:text-neutral-400">
                                Brak
                              </span>
                            )
                          ) : (
                            <div className="max-w-md space-y-2">
                              <Label className="text-xs">
                                Notatka
                              </Label>
                              <textarea
                                value={noteDraft}
                                onChange={(e) =>
                                  setNoteDraft(e.target.value)
                                }
                                className="h-24 w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                                placeholder="Twoja prywatna notatka (widoczna tylko dla Admina w tym widoku)…"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  className="bg-gray-900 text-white hover:bg-gray-800"
                                  size="sm"
                                  onClick={saveNote}
                                  disabled={isSavingThis}
                                >
                                  {isSavingThis ? (
                                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="mr-1 h-4 w-4" />
                                  )}
                                  Zapisz
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-gray-300 dark:border-neutral-700"
                                  onClick={cancelNote}
                                  disabled={isSavingThis}
                                >
                                  Anuluj
                                </Button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {!isEditing ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant={isExpanded ? "default" : "outline"}
                                className={cn(
                                  "h-8",
                                  !isExpanded &&
                                    "border-gray-300 dark:border-neutral-700"
                                )}
                                onClick={() => toggleDetail(r)}
                                title="Pokaż szczegóły globalnego zawodnika"
                                disabled={isDeletingThis}
                              >
                                <InfoIcon className="mr-1 h-4 w-4" />
                                {isExpanded
                                  ? "Ukryj szczegóły"
                                  : "Szczegóły"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-gray-300 dark:border-neutral-700"
                                onClick={() => startEditNote(r)}
                                title="Edytuj notatkę Administratora"
                                disabled={isDeletingThis}
                              >
                                <NotebookPen className="mr-1 h-4 w-4" />
                                Notatka
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 bg-gray-900 text-white hover:bg-gray-800"
                                onClick={() => remove(r.id)}
                                title="Usuń z globalnej bazy"
                                disabled={isDeletingThis}
                              >
                                {isDeletingThis ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-1 h-4 w-4" />
                                )}
                                Usuń
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-gray-300 dark:border-neutral-700"
                              onClick={cancelNote}
                              disabled={isSavingThis}
                            >
                              <Undo2 className="mr-1 h-4 w-4" />
                              Anuluj
                            </Button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr
                          key={`${r.id}-details`}
                          className="border-t border-slate-200 bg-slate-50/70 dark:border-neutral-800 dark:bg-neutral-950/60"
                        >
                          <td colSpan={9} className="p-3">
                            <div className="space-y-3 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                                    Szczegóły globalnego zawodnika
                                  </div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-neutral-50">
                                    {r.name} • {r.club || "bez klubu"} •{" "}
                                    {r.pos || "brak pozycji"}
                                  </div>
                                </div>
                                {detailLoading && (
                                  <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Ładowanie szczegółów…
                                  </div>
                                )}
                              </div>

                              {detailError && (
                                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
                                  {detailError}
                                </div>
                              )}

                              {!detailLoading &&
                                !detailError &&
                                !detailPlayers.length &&
                                !detailObservations.length && (
                                  <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                                    Nie znaleziono powiązanych profili
                                    scoutów ani obserwacji na podstawie
                                    tej nazwy zawodnika.
                                  </p>
                                )}

                              {(detailPlayers.length > 0 ||
                                detailObservations.length > 0) && (
                                <Tabs
                                  defaultValue="ratings"
                                  className="w-full"
                                >
                                  <TabsList className="mb-3">
                                    <TabsTrigger value="ratings">
                                      Ocena zawodnika
                                    </TabsTrigger>
                                    <TabsTrigger value="observations">
                                      Obserwacje
                                    </TabsTrigger>
                                  </TabsList>

                                  <TabsContent
                                    value="ratings"
                                    className="space-y-4"
                                  >
                                    <div className="text-[11px] text-gray-600 dark:text-neutral-400">
                                      Zebrano oceny z{" "}
                                      <b>{detailPlayers.length}</b>{" "}
                                      {detailPlayers.length === 1
                                        ? "profilu scouta"
                                        : "profili scoutów"}
                                      . Poniżej średnie wartości
                                      parametrów.
                                    </div>

                                    {ratingsSummary.length === 0 ? (
                                      <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                                        Żaden z powiązanych scoutów nie
                                        wprowadził jeszcze szczegółowych
                                        ocen dla tego zawodnika.
                                      </p>
                                    ) : (
                                      <div className="space-y-5">
                                        {baseSummaries.length > 0 && (
                                          <RatingBlock
                                            title="Podstawowe"
                                            items={baseSummaries}
                                          />
                                        )}
                                        {gkSummaries.length > 0 && (
                                          <RatingBlock
                                            title="Bramkarz (GK)"
                                            items={gkSummaries}
                                          />
                                        )}
                                        {defSummaries.length > 0 && (
                                          <RatingBlock
                                            title="Obrońca (DEF)"
                                            items={defSummaries}
                                          />
                                        )}
                                        {midSummaries.length > 0 && (
                                          <RatingBlock
                                            title="Pomocnik (MID)"
                                            items={midSummaries}
                                          />
                                        )}
                                        {fwSummaries.length > 0 && (
                                          <RatingBlock
                                            title="Napastnik (ATT)"
                                            items={fwSummaries}
                                          />
                                        )}
                                      </div>
                                    )}
                                  </TabsContent>

                                  <TabsContent
                                    value="observations"
                                    className="space-y-3"
                                  >
                                    {detailObservations.length === 0 ? (
                                      <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                                        Brak obserwacji w globalnym
                                        dzienniku, w których ten zawodnik
                                        występuje (na podstawie nazwy /
                                        listy players[]).
                                      </p>
                                    ) : (
                                      <div className="space-y-2 text-[11px]">
                                        {detailObservations.map((o) => {
                                          const scout = o.userId
                                            ? scoutsMap[o.userId]
                                            : undefined;
                                          return (
                                            <div
                                              key={o.id}
                                              className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
                                            >
                                              <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-gray-900 dark:text-neutral-50">
                                                  {o.match ||
                                                    "Bez nazwy meczu"}
                                                </span>
                                                <span className="text-[11px] text-gray-500 dark:text-neutral-400">
                                                  {o.date} {o.time}
                                                </span>
                                                {o.mode && (
                                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">
                                                    {o.mode}
                                                  </span>
                                                )}
                                                {o.status && (
                                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700 dark:bg-neutral-900 dark:text-neutral-200">
                                                    {o.status}
                                                  </span>
                                                )}
                                              </div>
                                              {scout && (
                                                <div className="text-[11px] text-gray-500 dark:text-neutral-400">
                                                  Scout:{" "}
                                                  <span className="font-medium">
                                                    {scout.name ||
                                                      "Bez nazwy konta"}
                                                  </span>
                                                  {scout.email
                                                    ? ` • ${scout.email}`
                                                    : ""}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </TabsContent>
                                </Tabs>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {filtered.length === 0 && !loadingList && !syncing && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-5 text-center text-sm text-dark dark:text-neutral-400"
                    >
                      Brak rekordów do wyświetlenia.
                    </td>
                  </tr>
                )}
                {(loadingList || syncing) && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-5 text-center text-sm text-dark dark:text-neutral-400"
                    >
                      Ładowanie danych z Supabase…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ===== Modal: lista scoutów, którzy mają tego zawodnika ===== */}
      {sourcesModal && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setSourcesModal(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-neutral-800">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                  Zawodnik
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-neutral-50">
                  {sourcesModal.playerName}
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-stone-100 hover:text-gray-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                onClick={() => setSourcesModal(null)}
                aria-label="Zamknij"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto px-4 py-3 text-sm">
              {sourcesModal.scouts.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-neutral-400">
                  Brak powiązanych scoutów (puste sources w global_players).
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 dark:text-neutral-400">
                    Ten zawodnik znajduje się w bazie{" "}
                    <b>{sourcesModal.scouts.length}</b>{" "}
                    {sourcesModal.scouts.length === 1
                      ? "scouta"
                      : "scoutów"}
                    :
                  </div>
                  <ul className="space-y-1.5">
                    {sourcesModal.scouts.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-800 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                      >
                        <div className="font-medium">
                          {s.name || "Bez nazwy konta"}
                        </div>
                        <div className="mt-0.5 break-all text-[11px] text-slate-500 dark:text-neutral-400">
                          ID: {s.id}
                          {s.email ? ` • ${s.email}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              Lista budowana z pola{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-neutral-800">
                global_players.sources
              </code>{" "}
              oraz tabeli{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 dark:bg-neutral-800">
                profiles
              </code>
              .
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Helpers ============================ */

function labelForSource(src?: string) {
  if (src === "tm") return "Transfermarkt";
  if (src === "wyscout") return "Wyscout";
  if (src === "sofifa") return "SoFIFA";
  if (src === "custom") return "Custom";
  return src || "Źródło";
}

/* ========================= UI subcomponents ========================= */

function RatingBlock({
  title,
  items,
}: {
  title: string;
  items: RatingSummary[];
}) {
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
        <span className="h-1.5 w-1.5 rounded-md bg-stone-500" />
        {title}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((s) => (
          <div
            key={s.key}
            className="rounded-md border border-slate-200 bg-white/90 p-3 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-950/80"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-[13px]">
                {s.label}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400">
                {s.count} ocen
              </span>
            </div>
            {s.tooltip && (
              <p className="mt-1 line-clamp-3 text-[11px] text-slate-500 dark:text-neutral-400">
                {s.tooltip}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <StarRating
                max={5}
                value={s.avg}
                onChange={() => {}}
              />
              <span className="text-xs text-slate-700 dark:text-neutral-200">
                {s.avg.toFixed(1)}/5
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
