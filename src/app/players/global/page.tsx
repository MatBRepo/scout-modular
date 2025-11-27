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
import { Checkbox } from "@/components/ui/checkbox";
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

type RankSource = "tm" | "wyscout" | "sofifa" | "custom" | "lnp";

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

type SourceFilter = "all" | "tm" | "lnp";

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
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  // NEW: filter by source (wszystko / tylko TM / tylko LNP)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  // NEW: zaznaczone rekordy (checkboxy)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
        source: row.source ?? undefined, // "tm" / "lnp" / ...
        extId: row.ext_id ?? undefined,
        addedAt: row.created_at ?? undefined,
        adminNote: row.admin_note ?? undefined,
        meta: row.meta ?? undefined,
        sources: Array.isArray(row.sources) ? row.sources : undefined,
      }));

      setRows(mapped);
      setSelectedIds([]); // reset zaznaczenia po przeładowaniu

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

  async function refreshFromSupabase() {
    await loadPlayers();
  }

  /* ------------------------- Local helpers ------------------------ */

  const filtered = useMemo(() => {
    // 1) dedupe po nazwie
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

    // 2) filtr tekstowy
    const qq = q.trim().toLowerCase();
    const byText = !qq
      ? base
      : base.filter((r) =>
          [r.name, r.club, r.nationality, r.pos]
            .map((x) => (x || "").toString().toLowerCase())
            .some((x) => x.includes(qq))
        );

    // 3) filtr po źródle (all / tm / lnp)
    const bySource =
      sourceFilter === "all"
        ? byText
        : byText.filter((r) => r.source === sourceFilter);

    // 4) sortowanie
    return [...bySource].sort((a, b) => {
      const ad = a.addedAt || "";
      const bd = b.addedAt || "";
      if (ad !== bd) return bd > ad ? 1 : -1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [rows, q, sourceFilter]);

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
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      console.error("[GlobalDatabasePage] delete exception:", err);
      setError("Wystąpił błąd podczas usuwania zawodnika.");
    } finally {
      setDeletingId(null);
    }
  }

  // NEW: masowe usuwanie zaznaczonych
  async function removeSelected() {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      `Na pewno chcesz usunąć ${selectedIds.length} zaznaczonych zawodników z globalnej bazy?`
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { error: dbError } = await supabase
        .from("global_players")
        .delete()
        .in("id", selectedIds);

      if (dbError) {
        console.error("[GlobalDatabasePage] bulk delete error:", dbError);
        setError("Nie udało się masowo usunąć zawodników z globalnej bazy.");
        return;
      }

      setRows((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error("[GlobalDatabasePage] bulk delete exception:", err);
      setError("Wystąpił błąd podczas masowego usuwania zawodników.");
    } finally {
      setBulkDeleting(false);
    }
  }

  const isAdmin = authStatus === "ok" && role === "admin";

  /* ------------------- Szczegóły globalnego gracza ------------------ */

  async function toggleDetail(r: GlobalPlayer) {
    if (expandedGlobal && expandedGlobal.id === r.id) {
      setExpandedGlobal(null);
      setDetailPlayers([]);
      setDetailObservations([]);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    setExpandedGlobal(r);
    setDetailLoading(true);
    setDetailError(null);
    setDetailPlayers([]);
    setDetailObservations([]);

    try {
      const supabase = getSupabase();
      const normName = normalizeName(r.name || "");

      // 1) players – szukamy po name, potem dopinamy normName
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

      // 2) observations – szeroko, filtr w JS
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

  const totalGlobal = rows.length;
  const tmCount = rows.filter((r) => r.source === "tm").length;
  const lnpCount = rows.filter((r) => r.source === "lnp").length;

  // select-all / indeterminate dla aktualnie przefiltrowanych
  const visibleIds = filtered.map((r) => r.id);
  const visibleSelectedCount = visibleIds.filter((id) =>
    selectedIds.includes(id)
  ).length;
  const allVisibleSelected =
    filtered.length > 0 && visibleSelectedCount === filtered.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < filtered.length;

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      // odznacz tylko widocznych
      const visibleSet = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      // zaznacz wszystkich widocznych + zachowaj poprzednie zaznaczenia
      setSelectedIds((prev) => {
        const set = new Set(prev);
        for (const id of visibleIds) set.add(id);
        return Array.from(set);
      });
    }
  }

  function toggleSelectOne(id: string, checked: boolean | "indeterminate") {
    if (checked) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev : [...prev, id]
      );
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  }

  return (
    <div className="w-full space-y-5">
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
                className="w-72 rounded pl-8 pr-10 text-sm"
              />
              {q && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 text-xs text-gray-400 transition hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                  aria-label="Wyczyść wyszukiwanie"
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              variant="outline"
              className="h-9 rounded border-gray-300 text-xs font-medium dark:border-neutral-700"
              onClick={handleSync}
              title="Przeładuj globalną bazę z tabeli global_players"
              disabled={syncing || loadingList}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Przeładuj
            </Button>

            <Button
              variant="outline"
              className="h-9 rounded border-gray-300 text-xs font-medium dark:border-neutral-700"
              onClick={refreshFromSupabase}
              title="Wczytaj ponownie z global_players"
              disabled={loadingList || syncing}
            >
              {loadingList && !syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Odśwież listę
            </Button>
          </div>
        }
      />

      {/* Info / summary card */}
      <Card className="border-stone-200 bg-gradient-to-r from-stone-50 to-stone-100 text-xs dark:border-neutral-700 dark:from-neutral-900 dark:to-neutral-900/70">
        <CardContent className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="flex flex-1 items-start gap-2">
            <div className="mt-0.5 rounded bg-stone-900/5 p-1 dark:bg-neutral-100/5">
              <InfoIcon className="h-3.5 w-3.5 text-stone-600 dark:text-neutral-300" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:text-neutral-200">
                Globalna baza zawodników
              </div>
              <p className="text-[11px] leading-snug text-stone-600 dark:text-neutral-300">
                Jeden rekord = jeden zawodnik (po deduplikacji nazwy). Dane
                spływają z widoku{" "}
                <code className="rounded bg-stone-200 px-1 py-0.5 text-[10px] dark:bg-neutral-800">
                  Duplikaty
                </code>{" "}
                po akcji <b>„Scal i dodaj do Globalnej bazy”</b> /
                <b> „Powiąż z globalnym”</b> oraz z zewnętrznych źródeł
                (np. Transfermarkt, LNP).
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-[11px] text-stone-600 dark:text-neutral-300">
            <span>
              Wszystkich (global_players):{" "}
              <span className="font-semibold text-stone-900 dark:text-neutral-50">
                {totalGlobal}
              </span>
            </span>
            <span>
              TM:{" "}
              <span className="font-semibold text-stone-900 dark:text-neutral-50">
                {tmCount}
              </span>{" "}
              • LNP:{" "}
              <span className="font-semibold text-stone-900 dark:text-neutral-50">
                {lnpCount}
              </span>
            </span>
            <span className="text-[10px]">
              Ostatnia aktualizacja:{" "}
              {lastSync
                ? lastSync.toLocaleString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "brak danych"}
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mt-1 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      )}

      <Card className="border-gray-200 shadow-sm dark:border-neutral-800">
        <CardHeader className="flex flex-col gap-2 border-b border-stone-200/70 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800/80">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-stone-900 dark:text-neutral-50">
              Globalna baza zawodników
            </CardTitle>
            <p className="text-[11px] text-gray-500 dark:text-neutral-400">
              Kliknij{" "}
              <span className="inline-flex items-center rounded bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
                <InfoIcon className="mr-1 h-3 w-3" />
                Szczegóły
              </span>{" "}
              aby zobaczyć zagregowane oceny i wszystkie obserwacje z systemu.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {(loadingList || syncing) && (
              <div className="inline-flex items-center gap-1 rounded bg-stone-100 px-3 py-1 text-[11px] text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {syncing ? "Przeładowywanie bazy…" : "Ładowanie danych…"}
              </div>
            )}
            {/* NEW: źródło TM / LNP / Wszystkie */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-stone-600 dark:text-neutral-300">
                Widok:
              </span>
              <div className="inline-flex rounded bg-stone-100 p-0.5 text-[11px] dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setSourceFilter("all")}
                  className={cn(
                    "rounded px-2 py-0.5",
                    sourceFilter === "all"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-stone-600 hover:bg-stone-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  )}
                >
                  Wszyscy
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter("tm")}
                  className={cn(
                    "rounded px-2 py-0.5",
                    sourceFilter === "tm"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-stone-600 hover:bg-stone-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  )}
                >
                  Transfermarkt
                </button>
                <button
                  type="button"
                  onClick={() => setSourceFilter("lnp")}
                  className={cn(
                    "rounded px-2 py-0.5",
                    sourceFilter === "lnp"
                      ? "bg-white text-stone-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-stone-600 hover:bg-stone-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  )}
                >
                  LNP
                </button>
              </div>
            </div>

            {/* NEW: akcje masowe */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-[11px] text-rose-700 dark:text-rose-300">
                  Zaznaczonych:{" "}
                  <span className="font-semibold">
                    {selectedIds.length}
                  </span>
                </span>
                <Button
                  size="sm"
                  className="h-7 rounded bg-rose-600 px-2.5 text-[11px] font-medium text-white hover:bg-rose-700"
                  onClick={removeSelected}
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Usuń zaznaczonych
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-600 dark:bg-neutral-900 dark:text-neutral-300">
                <tr>
                  <th className="w-[40px] px-3 py-2 text-left">
                    <Checkbox
                      checked={
                        allVisibleSelected
                          ? true
                          : someVisibleSelected
                          ? "indeterminate"
                          : false
                      }
                      onCheckedChange={toggleSelectAllVisible}
                      aria-label="Zaznacz/odznacz wszystkich na tej stronie"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Zawodnik</th>
                  <th className="px-3 py-2 text-left">Klub</th>
                  <th className="px-3 py-2 text-left">Pozycja</th>
                  <th className="px-3 py-2 text-left">Wiek</th>
                  <th className="px-3 py-2 text-left">Narodowość</th>
                  <th className="px-3 py-2 text-left">Źródło</th>
                  <th className="px-3 py-2 text-left">Dodano</th>
                  <th className="px-3 py-2 text-left">Notatka (Admin)</th>
                  <th className="px-3 py-2 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-[13px]">
                {filtered.map((r, idx) => {
                  const isEditing = editingId === r.id;
                  const isSavingThis = savingNoteId === r.id;
                  const isDeletingThis = deletingId === r.id;
                  const isExpanded =
                    expandedGlobal && expandedGlobal.id === r.id;
                  const isSelected = selectedIds.includes(r.id);

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
                          "border-t border-gray-100 align-top transition-colors dark:border-neutral-800",
                          idx % 2
                            ? "bg-white dark:bg-neutral-950"
                            : "bg-stone-50/40 dark:bg-neutral-950/60",
                          "hover:bg-stone-100/90 dark:hover:bg-neutral-900",
                          isExpanded &&
                            "border-sky-200 bg-sky-50/70 shadow-sm dark:border-sky-700 dark:stone-700",
                          isSelected &&
                            "bg-sky-50/80 dark:bg-sky-950/40"
                        )}
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(val) =>
                              toggleSelectOne(r.id, !!val)
                            }
                            aria-label={`Zaznacz zawodnika ${r.name}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-gray-900 dark:text-neutral-100">
                                {r.name || "—"}
                              </div>
                              {r.pos && (
                                <span className="inline-flex rounded bg-stone-900/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-800 dark:bg-neutral-100/5 dark:text-neutral-100">
                                  {r.pos}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500 dark:text-neutral-400">
                              {r.extId && (
                                <span className="rounded bg-stone-100 px-1.5 py-0.5 dark:bg-neutral-900">
                                  ID zewn.: {r.extId}
                                </span>
                              )}
                              {scoutsCount > 0 && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 transition hover:bg-stone-200 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
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
                        <td className="px-3 py-2">
                          {r.club ? (
                            <span className="inline-flex max-w-[180px] items-center rounded bg-stone-50 px-2 py-0.5 text-[11px] text-stone-800 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
                              {r.club}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.pos ? (
                            <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                              {r.pos}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">{r.age ?? "—"}</td>
                        <td className="px-3 py-2">
                          {r.nationality ? (
                            <span className="inline-flex max-w-[140px] items-center rounded bg-stone-50 px-2 py-0.5 text-[11px] text-stone-800 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
                              {r.nationality}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {labelForSource(r.source)}
                        </td>
                        <td className="px-3 py-2">
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
                        <td className="px-3 py-2">
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
                              <Label className="text-[11px]">
                                Notatka
                              </Label>
                              <textarea
                                value={noteDraft}
                                onChange={(e) =>
                                  setNoteDraft(e.target.value)
                                }
                                className="h-24 w-full rounded border border-gray-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                                placeholder="Prywatna notatka Admina o tym zawodniku…"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  className="bg-gray-900 text-xs text-white hover:bg-gray-800"
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
                                  className="border-gray-300 text-xs dark:border-neutral-700"
                                  onClick={cancelNote}
                                  disabled={isSavingThis}
                                >
                                  Anuluj
                                </Button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!isEditing ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant={isExpanded ? "default" : "outline"}
                                className={cn(
                                  "h-8 rounded px-3 text-[11px] font-medium",
                                  !isExpanded &&
                                    "border-gray-300 dark:border-neutral-700"
                                )}
                                onClick={() => toggleDetail(r)}
                                title="Pokaż szczegóły globalnego zawodnika"
                                disabled={isDeletingThis || bulkDeleting}
                              >
                                <InfoIcon className="mr-1 h-3.5 w-3.5" />
                                {isExpanded
                                  ? "Ukryj szczegóły"
                                  : "Szczegóły"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded border-gray-300 px-3 text-[11px] font-medium dark:border-neutral-700"
                                onClick={() => startEditNote(r)}
                                title="Edytuj notatkę Administratora"
                                disabled={isDeletingThis || bulkDeleting}
                              >
                                <NotebookPen className="mr-1 h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 rounded bg-gray-900 px-3 text-[11px] font-medium text-white hover:bg-gray-800"
                                onClick={() => remove(r.id)}
                                title="Usuń z globalnej bazy"
                                disabled={isDeletingThis || bulkDeleting}
                              >
                                {isDeletingThis ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className=" h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded border-gray-300 px-3 text-[11px] font-medium dark:border-neutral-700"
                              onClick={cancelNote}
                              disabled={isSavingThis}
                            >
                              <Undo2 className="mr-1 h-3.5 w-3.5" />
                              Anuluj
                            </Button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr
                          key={`${r.id}-details`}
                          className="border-t border-stone-200 bg-stone-50/70 dark:border-neutral-800 dark:bg-neutral-950/60"
                        >
                          <td colSpan={10} className="px-3 py-4">
                            <div className="space-y-4 rounded border border-stone-200 bg-white/95 p-4 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-950/95">
                              {/* Header / summary */}
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1.5">
                                  <div className="inline-flex items-center gap-2 rounded bg-stone-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
                                    <span className="h-1.5 w-1.5 rounded bg-stone-500" />
                                    Szczegóły globalnego zawodnika
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900 dark:text-neutral-50">
                                    <span>{r.name}</span>
                                    {r.club && (
                                      <>
                                        <span className="text-[11px] text-stone-400">
                                          •
                                        </span>
                                        <span className="rounded bg-stone-900/5 px-2 py-0.5 text-[11px] font-normal text-stone-700 dark:bg-neutral-100/5 dark:text-neutral-200">
                                          {r.club}
                                        </span>
                                      </>
                                    )}
                                    {r.pos && (
                                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                        {r.pos}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-[11px] text-stone-500 dark:text-neutral-400">
                                    {r.nationality && (
                                      <span className="inline-flex items-center rounded bg-stone-100 px-2 py-0.5 dark:bg-neutral-900">
                                        {r.nationality}
                                      </span>
                                    )}
                                    {r.source && (
                                      <span className="inline-flex items-center rounded bg-stone-100 px-2 py-0.5 dark:bg-neutral-900">
                                        Źródło: {labelForSource(r.source)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1 text-[11px] text-stone-600 dark:text-neutral-300">
                                  <div className="flex flex-wrap justify-end gap-1.5">
                                    <SummaryPill
                                      label="Profile scoutów"
                                      value={detailPlayers.length}
                                    />
                                    <SummaryPill
                                      label="Obserwacje"
                                      value={detailObservations.length}
                                    />
                                  </div>
                                  {detailLoading && (
                                    <div className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600 dark:bg-neutral-900 dark:text-neutral-300">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Ładowanie szczegółów…
                                    </div>
                                  )}
                                </div>
                              </div>

                              {detailError && (
                                <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
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
                                  <TabsList className="mb-3 h-10 rounded bg-stone-100 p-1 text-[11px] dark:bg-neutral-900">
                                    <TabsTrigger
                                      value="ratings"
                                      className="rounded px-3"
                                    >
                                      Ocena zawodnika
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="observations"
                                      className="rounded px-3"
                                    >
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
                                              className="flex flex-col gap-1 rounded border border-gray-200 bg-stone-50/80 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
                                            >
                                              <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-col gap-0.5">
                                                  <div className="font-medium text-stone-900 dark:text-neutral-50">
                                                    {o.match ||
                                                      "Bez nazwy meczu"}
                                                  </div>
                                                  <div className="text-[11px] text-gray-500 dark:text-neutral-400">
                                                    {o.date}{" "}
                                                    {o.time && `• ${o.time}`}
                                                  </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1">
                                                  {o.mode && (
                                                    <span className="rounded bg-stone-900/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-stone-700 dark:bg-neutral-100/5 dark:text-neutral-200">
                                                      {o.mode}
                                                    </span>
                                                  )}
                                                  {o.status && (
                                                    <span className="rounded bg-stone-900/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-stone-700 dark:bg-neutral-100/5 dark:text-neutral-200">
                                                      {o.status}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              {scout && (
                                                <div className="text-[11px] text-gray-500 dark:text-neutral-400">
                                                  Scout:{" "}
                                                  <span className="font-medium text-stone-800 dark:text-neutral-100">
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
                      colSpan={10}
                      className="px-5 py-7 text-center text-sm text-dark dark:text-neutral-400"
                    >
                      Brak rekordów do wyświetlenia (dla bieżącego filtra
                      źródła i wyszukiwania).
                    </td>
                  </tr>
                )}
                {(loadingList || syncing) && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-7 text-center text-sm text-dark dark:text-neutral-400"
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
            className="w-full max-w-md overflow-hidden rounded border border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-neutral-800">
              <div>
                <div className="text-xs uppercase tracking-wide text-stone-500 dark:text-neutral-400">
                  Zawodnik
                </div>
                <div className="text-sm font-semibold text-stone-900 dark:text-neutral-50">
                  {sourcesModal.playerName}
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-stone-100 hover:text-gray-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                onClick={() => setSourcesModal(null)}
                aria-label="Zamknij"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto px-4 py-3 text-sm">
              {sourcesModal.scouts.length === 0 ? (
                <div className="text-xs text-stone-500 dark:text-neutral-400">
                  Brak powiązanych scoutów (puste sources w global_players).
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-stone-500 dark:text-neutral-400">
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
                        className="rounded bg-stone-50 px-3 py-2 text-xs text-stone-800 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"
                      >
                        <div className="font-medium">
                          {s.name || "Bez nazwy konta"}
                        </div>
                        <div className="mt-0.5 break-all text-[11px] text-stone-500 dark:text-neutral-400">
                          ID: {s.id}
                          {s.email ? ` • ${s.email}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 bg-stone-50 px-4 py-2 text-[11px] text-stone-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              Lista budowana z pola{" "}
              <code className="rounded bg-stone-200 px-1 py-0.5 dark:bg-neutral-800">
                global_players.sources
              </code>{" "}
              oraz tabeli{" "}
              <code className="rounded bg-stone-200 px-1 py-0.5 dark:bg-neutral-800">
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
  if (src === "lnp") return "LNP";
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
      <div className="inline-flex items-center gap-2 rounded bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
        <span className="h-1.5 w-1.5 rounded bg-stone-500" />
        {title}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((s) => (
          <div
            key={s.key}
            className="rounded border border-stone-200 bg-white/90 p-3 text-xs shadow-sm transition hover:-translate-y-[1px] hover:border-stone-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-950/80 dark:hover:border-neutral-500"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-[13px] text-stone-900 dark:text-neutral-50">
                {s.label}
              </div>
              <span className="text-[11px] text-stone-500 dark:text-neutral-400">
                {s.count} ocen
              </span>
            </div>
            {s.tooltip && (
              <p className="mt-1 line-clamp-3 text-[11px] text-stone-500 dark:text-neutral-400">
                {s.tooltip}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <StarRating max={5} value={s.avg} onChange={() => {}} />
              <span className="text-xs text-stone-700 dark:text-neutral-200">
                {s.avg.toFixed(1)}/5
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded bg-stone-100 px-2.5 py-0.5 text-[10px] text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
      <span className="text-[11px] font-semibold text-stone-900 dark:text-neutral-50">
        {value}
      </span>
      <span>{label}</span>
    </div>
  );
}
