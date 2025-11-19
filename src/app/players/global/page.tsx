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

/* ============================== Types ============================== */

type RankSource = "tm" | "wyscout" | "sofifa" | "custom";

type GlobalSource = {
  playerId: number | string;
  scoutId: string;
};

type GlobalPlayer = {
  id: string;
  key?: string; // z bazy, ale do deduplikacji używamy znormalizowanej nazwy
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
  const [sourcesModal, setSourcesModal] = useState<SourcesModalState | null>(
    null
  );

  /* ------------------------- Auth + role ------------------------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabase();

        // 1) Auth
        const { data: userData, error: userErr } =
          await supabase.auth.getUser();

        if (userErr || !userData?.user) {
          if (!cancelled) {
            setAuthStatus("unauth");
            setRole(null);
          }
          return;
        }

        // 2) Role z tabeli profiles
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

      // Profiles -> map scoutId -> meta (ładniejsze listy w popupie)
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

  /* ------------------------- Sync z players ------------------------
     Uwaga: NIE wołamy już RPC sync_global_players – żeby global_players
     było w 100% kontrolowane z widoku Duplikaty / innych akcji admina.
     Ten przycisk to w praktyce “twardy reload z bazy”.
  ------------------------------------------------------------------ */

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await loadPlayers(); // tylko reload, żadnego RPC
    } catch (err) {
      console.error("[GlobalDatabasePage] handleSync exception:", err);
      setError("Wystąpił błąd podczas odświeżania globalnej bazy.");
    } finally {
      setSyncing(false);
    }
  }

  /* ------------------------- Local helpers ------------------------ */

  // deduplikacja + filtrowanie
  const filtered = useMemo(() => {
    // 1) deduplikacja po znormalizowanej nazwie, ale z MERGOWANIEM sources
    const map = new Map<string, GlobalPlayer>();

    for (const r of rows) {
      const normalized = normalizeName(r.name || "");
      const key = normalized || `id:${r.id}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, r);
        continue;
      }

      // scal źródła
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

      // wybierz nowszy rekord jako bazowy
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

  // "ostatnia synchronizacja" = max(addedAt) w global_players
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

  // ===== Admin view =====
  return (
    <div className="w-full space-y-3">
      <Toolbar
        title="Zawodnicy — globalna baza (Admin)"
        right={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Search */}
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

            {/* Sync (twardy reload z global_players) */}
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

            {/* Refresh from global_players only */}
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

      {/* Hint */}
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
                                    playerName: r.name || "Bez nazwy",
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
                      <td className="p-3">{labelForSource(r.source)}</td>
                      <td className="p-3">
                        {r.addedAt
                          ? new Date(r.addedAt).toLocaleString("pl-PL", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
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
                            <Label className="text-xs">Notatka</Label>
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
                          <div className="flex justify-end gap-2">
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
