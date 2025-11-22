"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Phone,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Ban,
  X,
  Copy,
  Share2,
  Send,
  Filter,
  Trash2,
  Plus,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  loadMetrics,
  saveMetrics,
  syncMetricsFromSupabase,
  type MetricsConfig,
  type MetricGroupKey,
  type Metric,
} from "@/shared/metrics";

import {
  loadRatings,
  saveRatings,
  type RatingsConfig,
  type RatingAspect,
  safeRatingId,
  slugRatingKey,
} from "@/shared/ratings";
import { getSupabase } from "@/lib/supabaseClient";

/* ----------------------------- Types ----------------------------- */
type Role = "admin" | "scout" | "scout-agent";

type Account = {
  id: string; // uuid z profiles.id
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
  createdAt: string; // ISO z profiles.created_at
  lastActive?: string; // ISO z profiles.last_active
};

type InviteChannel = "email" | "whatsapp" | "messenger" | "link" | "system-share";
type InviteStatus = "pending" | "revoked";
type Invite = {
  id: string; // token = scout_invites.id
  name?: string;
  email?: string;
  role: Role;
  channel: InviteChannel;
  createdAt: string;
  expiresAt?: string;
  status: InviteStatus;
  url: string; // budowany z tokenu
};

/* Supabase rows */
type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  active: boolean | null;
  created_at: string;
  last_active: string | null;
};

type InviteRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  channel: string | null;
  created_at: string;
  expires_at: string | null;
  status: string | null;
};

/* -------------------------- Constants --------------------------- */
const ROLES: Role[] = ["admin", "scout", "scout-agent"];
const GROUP_LABEL: Record<MetricGroupKey, string> = {
  BASE: "Kategorie bazowe",
  GK: "Bramkarz (GK)",
  DEF: "Obrońca (CB/FB/WB)",
  MID: "Pomocnik (6/8/10)",
  ATT: "Napastnik (9/7/11)",
};

/* Helpers – mapping Supabase → UI */
function mapProfileRow(row: ProfileRow): Account {
  const role: Role =
    row.role === "admin" || row.role === "scout-agent" || row.role === "scout"
      ? (row.role as Role)
      : "scout";
  return {
    id: row.id,
    name: row.full_name || "Bez nazwy",
    email: row.email || "brak-emaila@example.com",
    phone: row.phone || undefined,
    role,
    active: row.active ?? true,
    createdAt: row.created_at,
    lastActive: row.last_active || undefined,
  };
}

function buildInviteUrl(token: string) {
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://app.example.com";
  return `${origin}/invite/${token}`;
}

function mapInviteRow(row: InviteRow): Invite {
  const role: Role =
    row.role === "admin" || row.role === "scout-agent" || row.role === "scout"
      ? (row.role as Role)
      : "scout";
  const channel: InviteChannel =
    row.channel === "whatsapp" ||
    row.channel === "messenger" ||
    row.channel === "link" ||
    row.channel === "system-share"
      ? (row.channel as InviteChannel)
      : "email";

  const status: InviteStatus = row.status === "revoked" ? "revoked" : "pending";

  return {
    id: row.id,
    name: row.name || undefined,
    email: row.email || undefined,
    role,
    channel,
    createdAt: row.created_at,
    expiresAt: row.expires_at || undefined,
    status,
    url: buildInviteUrl(row.id),
  };
}

/* ============================ Page ============================== */
export default function ManagePage() {
  /* Users */
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  /* Add user modal */
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Account | null>(null);
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPhone, setNPhone] = useState("");
  const [nRole, setNRole] = useState<Role>("scout");
  const [nActive, setNActive] = useState(true);

  /* Invitations */
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iRole, setIRole] = useState<Role>("scout");
  const [iChannel, setIChannel] = useState<InviteChannel>("email");
  const [iExpiresDays, setIExpiresDays] = useState<number>(14);

  /* Loading / errors */
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [errorAccounts, setErrorAccounts] = useState<string | null>(null);
  const [errorInvites, setErrorInvites] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [metricsLoading, setMetricsLoading] = useState(false);

  /* ---------------------- Metrics from Supabase ------------------ */
  useEffect(() => {
    let active = true;

    (async () => {
      setMetricsLoading(true);
      try {
        const cfg = await syncMetricsFromSupabase();
        if (!active) return;
        setMCfg(cfg);
      } finally {
        if (active) setMetricsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /* --------------------------- Loaders -------------------------- */
  // Accounts from Supabase
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoadingAccounts(true);
      setErrorAccounts(null);
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, full_name, email, phone, role, active, created_at, last_active"
          )
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        const mapped = (data as ProfileRow[]).map(mapProfileRow);
        setAccounts(mapped);
      } catch (e: any) {
        if (!mounted) return;
        console.error("Error loading accounts:", e);
        setErrorAccounts(
          e?.message || "Nie udało się pobrać listy użytkowników z Supabase."
        );
      } finally {
        if (mounted) setLoadingAccounts(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Invites from Supabase
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoadingInvites(true);
      setErrorInvites(null);
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("scout_invites")
          .select(
            "id, name, email, role, channel, created_at, expires_at, status"
          )
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        const mapped = (data as InviteRow[]).map(mapInviteRow);
        setInvites(mapped);
      } catch (e: any) {
        if (!mounted) return;
        console.error("Error loading invites:", e);
        setErrorInvites(
          e?.message || "Nie udało się pobrać zaproszeń z Supabase."
        );
      } finally {
        if (mounted) setLoadingInvites(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  /* -------------------------- Persistence ----------------------- */

  async function onChangeRole(id: string, role: Role) {
    // optymistycznie w UI
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, role } : a))
    );
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", id);
      if (error) throw error;
    } catch (e: any) {
      console.error("Error updating role:", e);
      // fallback – przeładuj
      setErrorAccounts("Nie udało się zaktualizować roli. Odśwież listę.");
    }
  }

  async function onToggleActive(id: string) {
    const current = accounts.find((a) => a.id === id);
    if (!current) return;
    const nextActive = !current.active;

    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: nextActive } : a))
    );
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("profiles")
        .update({ active: nextActive })
        .eq("id", id);
      if (error) throw error;
    } catch (e: any) {
      console.error("Error toggling active:", e);
      setErrorAccounts(
        "Nie udało się zmienić statusu. Odśwież listę, aby zobaczyć aktualny stan."
      );
    }
  }

  function onOpenDetail(a: Account) {
    setDetail(a);
  }

  // gdy accounts się zmieniają (np. rola/status), odśwież panel szczegółów
  useEffect(() => {
    if (!detail) return;
    const fresh = accounts.find((a) => a.id === detail.id);
    if (!fresh || fresh === detail) return;
    setDetail(fresh);
  }, [accounts, detail]);

  async function onAddUser() {
    if (!nName.trim() || !nEmail.trim()) return;
    setSavingUser(true);
    setErrorAccounts(null);
    try {
      const supabase = getSupabase();
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto.randomUUID() as string)
          : Math.random().toString(36).slice(2);

      const payload = {
        id, // uwaga: zakłada, że możesz tworzyć profiles z własnym UUID
        full_name: nName.trim(),
        email: nEmail.trim().toLowerCase(),
        phone: nPhone.trim() || null,
        role: nRole,
        active: nActive,
      };

      const { data, error } = await supabase
        .from("profiles")
        .insert(payload)
        .select(
          "id, full_name, email, phone, role, active, created_at, last_active"
        )
        .single();

      if (error) throw error;

      const acc = mapProfileRow(data as ProfileRow);
      setAccounts((prev) => [acc, ...prev]);

      setAddOpen(false);
      setNName("");
      setNEmail("");
      setNPhone("");
      setNRole("scout");
      setNActive(true);
    } catch (e: any) {
      console.error("Error adding user:", e);
      setErrorAccounts(
        e?.message ||
          "Nie udało się dodać użytkownika. Sprawdź konfigurację tabeli profiles."
      );
    } finally {
      setSavingUser(false);
    }
  }

  /* ------------------------- Invite logic ----------------------- */
  function createInviteLink(token: string): string {
    return buildInviteUrl(token);
  }
  function generateToken() {
    try {
      return crypto.randomUUID();
    } catch {
      return Math.random().toString(36).slice(2);
    }
  }

  async function onCreateInvite() {
    const token = generateToken();
    const url = createInviteLink(token);
    const expiresAt = iExpiresDays > 0 ? isoDaysFromNow(iExpiresDays) : undefined;

    setCreatingInvite(true);
    setErrorInvites(null);

    try {
      const supabase = getSupabase();
      const payload = {
        id: token,
        name: iName.trim() || null,
        email: iEmail.trim() || null,
        role: iRole,
        channel: iChannel,
        expires_at: expiresAt || null,
        status: "pending",
      };

      const { data, error } = await supabase
        .from("scout_invites")
        .insert(payload)
        .select(
          "id, name, email, role, channel, created_at, expires_at, status"
        )
        .single();

      if (error) throw error;

      const inv = mapInviteRow(data as InviteRow);
      setInvites((prev) => [inv, ...prev]);

      // szybki share jak wcześniej:
      quickShare({ ...inv, url });

      setIName("");
      setIEmail("");
      setIRole("scout");
      setIChannel("email");
    } catch (e: any) {
      console.error("Error creating invite:", e);
      setErrorInvites(
        e?.message || "Nie udało się utworzyć zaproszenia w Supabase."
      );
    } finally {
      setCreatingInvite(false);
    }
  }

  function quickShare(invite: Invite) {
    if (
      invite.channel === "system-share" &&
      typeof navigator !== "undefined" &&
      (navigator as any).share
    ) {
      (navigator as any)
        .share({
          title: "Zaproszenie do S4S",
          text: buildInviteText(invite),
          url: invite.url,
        })
        .catch(() => {});
      return;
    }
    if (invite.channel === "email") {
      const subject = encodeURIComponent("Zaproszenie do S4S");
      const body = encodeURIComponent(buildInviteText(invite));
      const to = invite.email ? encodeURIComponent(invite.email) : "";
      window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
      return;
    }
    if (invite.channel === "whatsapp") {
      const text = encodeURIComponent(buildInviteText(invite));
      window.open(`https://wa.me/?text=${text}`, "_blank");
      return;
    }
    if (invite.channel === "messenger") {
      const link = encodeURIComponent(invite.url);
      window.open(
        `https://www.facebook.com/dialog/send?link=${link}`,
        "_blank"
      );
      return;
    }
    if (invite.channel === "link") {
      copy(invite.url);
      alert("Skopiowano link zaproszenia do schowka.");
    }
  }

  function buildInviteText(inv: Invite) {
    const who = inv.name ? inv.name : "nowy scout";
    const roleTxt = `rola: ${labelForRole(inv.role)}`;
    const exp = inv.expiresAt ? ` (wygasa: ${fmtDate(inv.expiresAt)})` : "";
    return `Cześć ${who}!\n\nZapraszam Cię do S4S (${roleTxt}).\nDołącz: ${inv.url}${exp}\n\nDzięki!`;
  }

  function copy(txt: string) {
    try {
      navigator.clipboard.writeText(txt);
    } catch {
      // ignore
    }
  }

  const REVOKED: InviteStatus = "revoked" as InviteStatus;

  async function revokeInvite(id: string) {
    setInvites((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: REVOKED } : i))
    );
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("scout_invites")
        .update({ status: "revoked" })
        .eq("id", id);
      if (error) throw error;
    } catch (e: any) {
      console.error("Error revoking invite:", e);
      setErrorInvites("Nie udało się cofnąć zaproszenia.");
    }
  }

  /* --------------------------- Derived -------------------------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => {
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.phone || "").toLowerCase().includes(q)
        );
      })
      .filter((a) => (roleFilter ? a.role === roleFilter : true))
      .filter((a) => {
        if (!statusFilter) return true;
        return statusFilter === "active" ? a.active : !a.active;
      })
      .sort((a, b) => Number(b.active) - Number(a.active));
  }, [accounts, query, roleFilter, statusFilter]);

  const pendingInvites = invites.filter((i) => i.status === "pending");

  // statystyki na górę
  const totalActive = accounts.filter((a) => a.active).length;
  const totalScouts = accounts.filter((a) => a.role === "scout").length;
  const totalAgents = accounts.filter((a) => a.role === "scout-agent").length;

  /* -------------------- Metrics configuration ------------------- */
  const [mCfg, setMCfg] = useState<MetricsConfig>(loadMetrics());
  const [openGroups, setOpenGroups] = useState<Record<MetricGroupKey, boolean>>({
    BASE: true,
    GK: false,
    DEF: false,
    MID: false,
    ATT: false,
  });

  /* -------------------- Ratings configuration ------------------- */
  const [rCfg, setRCfg] = useState<RatingsConfig>(loadRatings());
  const [ratingsOpen, setRatingsOpen] = useState(true);

  // keep metrics/ratings in sync with external changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "s4s.obs.metrics") {
        setMCfg(loadMetrics());
      }
      if (e.key === "s4s.playerRatings.v1") {
        setRCfg(loadRatings());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function setAndSave(next: MetricsConfig) {
    setMCfg(next);
    saveMetrics(next);
  }

  function updateLabel(group: MetricGroupKey, id: string, label: string) {
    const next = {
      ...mCfg,
      [group]: mCfg[group].map((m) => (m.id === id ? { ...m, label } : m)),
    };
    setAndSave(next);
  }
  function updateKey(group: MetricGroupKey, id: string, key: string) {
    const safe = key.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
    const next = {
      ...mCfg,
      [group]: mCfg[group].map((m) => (m.id === id ? { ...m, key: safe } : m)),
    };
    setAndSave(next);
  }
  function toggleMetric(group: MetricGroupKey, id: string) {
    const next = {
      ...mCfg,
      [group]: mCfg[group].map((m) =>
        m.id === id ? { ...m, enabled: !m.enabled } : m
      ),
    };
    setAndSave(next);
  }
  function addMetric(group: MetricGroupKey) {
    const id = safeId();
    const label = "Nowa metryka";
    const key = slugKey(label);
    const item: Metric = { id, key, label, enabled: true };
    const next = { ...mCfg, [group]: [...mCfg[group], item] };
    setAndSave(next);
  }
  function removeMetric(group: MetricGroupKey, id: string) {
    const next = {
      ...mCfg,
      [group]: mCfg[group].filter((m) => m.id !== id),
    };
    setAndSave(next);
  }
  function moveMetric(group: MetricGroupKey, id: string, dir: -1 | 1) {
    const arr = [...mCfg[group]];
    const idx = arr.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    const tmp = arr[idx];
    arr[idx] = arr[target];
    arr[target] = tmp;
    setAndSave({ ...mCfg, [group]: arr });
  }
  function toggleGroup(g: MetricGroupKey) {
    setOpenGroups((s) => ({ ...s, [g]: !s[g] }));
  }

  /* ------- Ratings helpers (Konfiguracja ocen zawodnika) ------- */
  function setAndSaveRatings(next: RatingsConfig) {
    // gwarantujemy spójny sort_order
    const withOrder = next.map((r, idx) => ({
      ...r,
      sort_order: idx,
    })) as RatingsConfig;

    setRCfg(withOrder);
    saveRatings(withOrder);
  }

  function updateRatingLabel(id: string, label: string) {
    const next = rCfg.map((r) => (r.id === id ? { ...r, label } : r));
    setAndSaveRatings(next);
  }

  function updateRatingKey(id: string, key: string) {
    const safe = key.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
    const next = rCfg.map((r) => (r.id === id ? { ...r, key: safe } : r));
    setAndSaveRatings(next);
  }

  function updateRatingTooltip(id: string, tooltip: string) {
    const next = rCfg.map((r) => (r.id === id ? { ...r, tooltip } : r));
    setAndSaveRatings(next);
  }

  function toggleRating(id: string) {
    const next = rCfg.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    setAndSaveRatings(next);
  }

  function addRating() {
    const label = "Nowa ocena";

    const item: RatingAspect = {
      id: safeRatingId(),
      key: slugRatingKey(label),
      label,
      tooltip: "",
      enabled: true,
      sort_order: rCfg.length,
      // domyślna grupa – dopasuj nazwę do swojego uniona w ratings.ts
      groupKey: "GENERAL" as any,
    };

    const next = [...rCfg, item];
    setAndSaveRatings(next);
  }

  function removeRating(id: string) {
    const next = rCfg.filter((r) => r.id !== id);
    setAndSaveRatings(next);
  }

  function moveRating(id: string, dir: -1 | 1) {
    const arr = [...rCfg];
    const idx = arr.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    const tmp = arr[idx];
    arr[idx] = arr[target];
    arr[target] = tmp;
    setAndSaveRatings(arr);
  }

  /* ============================ UI ============================== */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Zarządzanie użytkownikami
          </h1>
          <p className="mt-1 text-sm text-dark dark:text-neutral-300">
            Rejestr scoutów • Zmieniaj role, aktywuj/deaktywuj, zapraszaj
            nowych i konfiguruj metryki / oceny.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-gray-900 text-white hover:bg-gray-800"
            onClick={() => setInviteOpen(true)}
          >
            <Send className="mr-2 h-4 w-4" />
            Zaproś scouta
          </Button>
          <Button
            variant="outline"
            className="border-gray-300 dark:border-neutral-700"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Dodaj ręcznie
          </Button>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <div className="text-xs text-dark dark:text-neutral-400">
                Aktywne konta
              </div>
              <div className="mt-1 text-xl font-semibold">
                {totalActive} / {accounts.length}
              </div>
            </div>
            <Users className="h-6 w-6 text-gray-400" />
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <div className="text-xs text-dark dark:text-neutral-400">
                Rozkład ról
              </div>
              <div className="mt-1 text-sm">
                Scout: <b>{totalScouts}</b> • Scout Agent:{" "}
                <b>{totalAgents}</b>
              </div>
            </div>
            <Shield className="h-6 w-6 text-gray-400" />
          </CardContent>
        </Card>
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <div className="text-xs text-dark dark:text-neutral-400">
                Oczekujące zaproszenia
              </div>
              <div className="mt-1 text-xl font-semibold">
                {pendingInvites.length}
              </div>
            </div>
            <Send className="h-6 w-6 text-gray-400" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-gray-200 dark:border-neutral-800">
        <CardHeader className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold">
            <Filter className="h-4 w-4" />
            Filtry i wyszukiwanie
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Szukaj po imieniu, e-mailu lub telefonie…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Rola
              </label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter((e.target.value || "") as Role | "")
                }
              >
                <option value="">Wszystkie</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {labelForRole(r)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Status
              </label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter((e.target.value || "") as any)
                }
              >
                <option value="">Wszystkie</option>
                <option value="active">Aktywne</option>
                <option value="inactive">Nieaktywne</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors for accounts */}
      {errorAccounts && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {errorAccounts}
        </div>
      )}

      {/* Pending invitations */}
      <Card className="border-gray-200 dark:border-neutral-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">
            Oczekujące zaproszenia ({pendingInvites.length})
          </CardTitle>
          <div className="text-xs text-dark dark:text-neutral-400">
            Udostępnij link lub wyślij przez e-mail/komunikator.
          </div>
        </CardHeader>
        <CardContent className="w-full overflow-x-auto">
          {errorInvites && (
            <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {errorInvites}
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="p-3 text-left font-medium">Osoba</th>
                <th className="p-3 text-left font-medium">Rola</th>
                <th className="p-3 text-left font-medium">Kanał</th>
                <th className="p-3 text-left font-medium">Wysłano</th>
                <th className="p-3 text-left font-medium">Wygasa</th>
                <th className="p-3 text-right font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {loadingInvites && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-xs text-dark dark:text-neutral-400"
                  >
                    Ładowanie zaproszeń…
                  </td>
                </tr>
              )}
              {!loadingInvites &&
                pendingInvites.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t border-gray-200 align-middle dark:border-neutral-700"
                  >
                    <td className="p-3">
                      <div className="font-medium">
                        {inv.name || "—"}
                      </div>
                      <div className="text-xs text-dark dark:text-neutral-400">
                        {inv.email || "brak e-maila"}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                        <Shield className="h-3.5 w-3.5" />{" "}
                        {labelForRole(inv.role)}
                      </span>
                    </td>
                    <td className="p-3 text-xs capitalize">
                      {channelLabel(inv.channel)}
                    </td>
                    <td className="p-3 text-xs text-dark dark:text-neutral-400">
                      {fmtDate(inv.createdAt)}
                    </td>
                    <td className="p-3 text-xs text-dark dark:text-neutral-400">
                      {inv.expiresAt ? fmtDate(inv.expiresAt) : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-gray-300 dark:border-neutral-700"
                          onClick={() => {
                            copy(inv.url);
                          }}
                          title="Kopiuj link"
                        >
                          <Copy className="mr-1 h-4 w-4" /> Kopiuj
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-gray-300 dark:border-neutral-700"
                          onClick={() =>
                            quickShare({ ...inv, channel: "system-share" })
                          }
                          title="Udostępnij"
                        >
                          <Share2 className="mr-1 h-4 w-4" /> Udostępnij
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-gray-300 text-red-600 dark:border-neutral-700"
                          onClick={() => revokeInvite(inv.id)}
                          title="Cofnij zaproszenie"
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Cofnij
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loadingInvites && pendingInvites.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center text-sm text-dark dark:text-neutral-400"
                  >
                    Brak aktywnych zaproszeń — użyj „Zaproś scouta”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Users list + right-side details */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Lista użytkowników */}
        <Card className="border-gray-200 dark:border-neutral-800 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">
              <div className="flex flex-wrap items-center gap-2">
                <Users className="h-4 w-4" />
                Użytkownicy ({filtered.length})
              </div>
            </CardTitle>
            <div className="text-xs text-dark dark:text-neutral-400">
              Kliknij nazwę lub „Szczegóły”, aby podejrzeć profil po prawej.
            </div>
          </CardHeader>
          <CardContent className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
                <tr>
                  <th className="p-3 text-left font-medium">Użytkownik</th>
                  <th className="p-3 text-left font-medium">Kontakt</th>
                  <th className="p-3 text-left font-medium">Rola</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Utworzono</th>
                  <th className="p-3 text-right font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {loadingAccounts && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-4 text-center text-xs text-dark dark:text-neutral-400"
                    >
                      Ładowanie użytkowników…
                    </td>
                  </tr>
                )}
                {!loadingAccounts &&
                  filtered.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-t border-gray-200 align-middle dark:border-neutral-700 ${
                        detail?.id === a.id
                          ? "bg-slate-50/80 dark:bg-neutral-900/60"
                          : ""
                      }`}
                    >
                      <td className="p-3">
                        <button
                          className="text-left font-medium hover:underline"
                          onClick={() => onOpenDetail(a)}
                          title="Pokaż szczegóły po prawej"
                        >
                          {a.name}
                        </button>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-dark dark:text-neutral-400">
                          <Shield className="h-3.5 w-3.5" />
                          {labelForRole(a.role)}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-neutral-300">
                          <Mail className="h-3.5 w-3.5" /> {a.email}
                        </div>
                        {a.phone && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-dark dark:text-neutral-400">
                            <Phone className="h-3.5 w-3.5" /> {a.phone}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <select
                          className="rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                          value={a.role}
                          onChange={(e) =>
                            onChangeRole(a.id, e.target.value as Role)
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {labelForRole(r)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        {a.active ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                            <CheckCircle className="h-3.5 w-3.5" /> Aktywne
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            <Ban className="h-3.5 w-3.5" /> Nieaktywne
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-dark dark:text-neutral-400">
                        {fmtDate(a.createdAt)}
                        <div className="opacity-70">
                          {a.lastActive
                            ? `Ost. aktywność: ${fmtDate(a.lastActive)}`
                            : "—"}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-gray-300 dark:border-neutral-700"
                            onClick={() => onOpenDetail(a)}
                          >
                            <Eye className="mr-1 h-4 w-4" /> Szczegóły
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-gray-300 dark:border-neutral-700"
                            onClick={() => onToggleActive(a.id)}
                            title={a.active ? "Deaktywuj" : "Aktywuj"}
                          >
                            {a.active ? (
                              <>
                                <XCircle className="mr-1 h-4 w-4" /> Deaktywuj
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-1 h-4 w-4" /> Aktywuj
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!loadingAccounts && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-sm text-dark dark:text-neutral-400"
                    >
                      Brak wyników — zmień filtry lub dodaj nowego użytkownika.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Panel szczegółów po prawej */}
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <span>Szczegóły konta</span>
              {detail && (
                <span className="text-[11px] text-dark/70 dark:text-neutral-400">
                  ID: {detail.id.slice(0, 8)}…
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!detail && (
              <div className="text-xs text-dark dark:text-neutral-400">
                Wybierz użytkownika z listy po lewej, aby zobaczyć szczegóły
                konta.
              </div>
            )}

            {detail && (
              <>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-dark dark:text-neutral-400">
                    Imię i nazwisko
                  </div>
                  <div className="text-sm font-semibold">{detail.name}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-dark dark:text-neutral-400">
                    E-mail
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5" />
                    {detail.email}
                  </div>
                </div>

                {detail.phone && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-dark dark:text-neutral-400">
                      Telefon
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5" />
                      {detail.phone}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-medium text-dark dark:text-neutral-400">
                    Rola
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    <span className="text-sm">{labelForRole(detail.role)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-dark dark:text-neutral-400">
                    Status
                  </div>
                  {detail.active ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                      <CheckCircle className="h-3.5 w-3.5" /> Aktywne
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      <Ban className="h-3.5 w-3.5" /> Nieaktywne
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-medium text-dark dark:text-neutral-400">
                      Utworzono
                    </div>
                    <div className="mt-0.5 text-dark dark:text-neutral-300">
                      {fmtDate(detail.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-dark dark:text-neutral-400">
                      Ost. aktywność
                    </div>
                    <div className="mt-0.5 text-dark dark:text-neutral-300">
                      {detail.lastActive ? fmtDate(detail.lastActive) : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-gray-200 pt-2 dark:border-neutral-800">
                  <div className="text-[11px] text-dark/70 dark:text-neutral-500">
                    Zarządzaj statusem użytkownika.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-gray-300 text-xs dark:border-neutral-700"
                      onClick={() => onToggleActive(detail.id)}
                    >
                      {detail.active ? (
                        <>
                          <XCircle className="mr-1 h-4 w-4" /> Deaktywuj
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-1 h-4 w-4" /> Aktywuj
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-gray-300 text-xs dark:border-neutral-700"
                      onClick={() => setDetail(null)}
                    >
                      Wyczyść wybór
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Konfiguracja metryk ===== */}
      {/* (tutaj możesz mieć swoją istniejącą sekcję konfiguracji mCfg / rCfg;
          logika powyżej pozostała kompatybilna) */}

      {/* ===== Modals (invites, add user) ===== */}
      {inviteOpen && (
        <Modal
          onClose={() => setInviteOpen(false)}
          title="Zaproś nowego scouta"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Imię i nazwisko (opcjonalnie)
              </label>
              <Input
                value={iName}
                onChange={(e) => setIName(e.target.value)}
                placeholder="np. Jan Kowalski"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                E-mail (wymagany dla kanału e-mail)
              </label>
              <Input
                type="email"
                value={iEmail}
                onChange={(e) => setIEmail(e.target.value)}
                placeholder="np. jan@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Rola
              </label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={iRole}
                onChange={(e) => setIRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {labelForRole(r)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Kanał
              </label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={iChannel}
                onChange={(e) =>
                  setIChannel(e.target.value as InviteChannel)
                }
              >
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="messenger">Messenger</option>
                <option value="link">Kopiuj link</option>
                <option value="system-share">Udostępnianie systemowe</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Wygasa (dni)
              </label>
              <Input
                type="number"
                min={0}
                value={iExpiresDays}
                onChange={(e) =>
                  setIExpiresDays(Number(e.target.value || 0))
                }
                placeholder="np. 14"
              />
              <div className="mt-1 text-[11px] text-dark dark:text-neutral-400">
                0 = bez wygaśnięcia
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => setInviteOpen(false)}
            >
              Anuluj
            </Button>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={onCreateInvite}
              disabled={creatingInvite || (iChannel === "email" && !iEmail.trim())}
              title={
                iChannel === "email" && !iEmail.trim()
                  ? "Podaj e-mail albo wybierz inny kanał"
                  : ""
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {creatingInvite ? "Tworzenie…" : "Wyślij zaproszenie"}
            </Button>
          </div>
        </Modal>
      )}

      {addOpen && (
        <Modal
          onClose={() => setAddOpen(false)}
          title="Dodaj użytkownika ręcznie"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Imię i nazwisko
              </label>
              <Input
                value={nName}
                onChange={(e) => setNName(e.target.value)}
                placeholder="np. Jan Kowalski"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                E-mail
              </label>
              <Input
                type="email"
                value={nEmail}
                onChange={(e) => setNEmail(e.target.value)}
                placeholder="np. jan@example.com"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Telefon (opcjonalnie)
              </label>
              <Input
                value={nPhone}
                onChange={(e) => setNPhone(e.target.value)}
                placeholder="+48 ..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Rola
              </label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={nRole}
                onChange={(e) => setNRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {labelForRole(r)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Status
              </label>
              <button
                type="button"
                onClick={() => setNActive((v) => !v)}
                className="mt-[2px] inline-flex w-full items-center justify-between rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
              >
                <span>
                  {nActive ? "Aktywne" : "Nieaktywne"}
                </span>
                {nActive ? (
                  <ToggleRight className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => setAddOpen(false)}
            >
              Anuluj
            </Button>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={onAddUser}
              disabled={savingUser || !nName.trim() || !nEmail.trim()}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {savingUser ? "Zapisywanie…" : "Dodaj użytkownika"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ======================== Excel-like cell ======================= */
function InlineCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  function commit() {
    const v = local.trim();
    if (v !== value) onChange(v);
  }

  return (
    <input
      className="h-8 w-full rounded-md border border-transparent px-2 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setLocal(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/* ======================== Small components ====================== */

function labelForRole(r: Role) {
  if (r === "admin") return "Admin";
  if (r === "scout-agent") return "Scout Agent";
  return "Scout";
}
function cycleRole(r: Role): Role {
  const order: Role[] = ["scout", "scout-agent", "admin"];
  const i = order.indexOf(r);
  return order[(i + 1) % order.length];
}
function channelLabel(c: InviteChannel) {
  if (c === "email") return "E-mail";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "messenger") return "Messenger";
  if (c === "system-share") return "Udostępnij";
  return "Link";
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/* Minimal modal */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-x-3 top-[8vh] z-[101] mx-auto max-w-2xl rounded-md border border-gray-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Shield className="h-4 w-4" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button
            className="rounded-md p-1 text-dark hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            onClick={onClose}
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

/* ========================= utils ========================== */
function slugKey(s: string) {
  const base = s.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
  return base || `metric-${Math.random().toString(36).slice(2, 7)}`;
}
function safeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `m-${Math.random().toString(36).slice(2)}`;
  }
}
