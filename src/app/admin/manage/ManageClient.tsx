"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
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
  id: string; // uuid from profiles.id
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
  createdAt: string; // ISO from profiles.created_at
  lastActive?: string; // ISO from profiles.last_active
};

type InviteChannel =
  | "email"
  | "whatsapp"
  | "messenger"
  | "link"
  | "system-share";
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

type UserStats = {
  playersTotal: number;
  playersActive: number;
  playersTrash: number;
  observationsTotal: number;
  observationsDraft: number;
  observationsOther: number;
  lastObservationAt?: string | null;
};

/* -------------------------- Constants --------------------------- */
const ROLES: Role[] = ["admin", "scout", "scout-agent"];
const GROUP_LABEL: Record<MetricGroupKey, string> = {
  BASE: "Base categories",
  GK: "Goalkeeper (GK)",
  DEF: "Defender (CB/FB/WB)",
  MID: "Midfielder (6/8/10)",
  ATT: "Forward (9/7/11)",
};

const MODAL_ROOT_ID = "global-modal-root";

/* Helpers – mapping Supabase → UI */
function mapProfileRow(row: ProfileRow): Account {
  const role: Role =
    row.role === "admin" || row.role === "scout-agent" || row.role === "scout"
      ? (row.role as Role)
      : "scout";
  return {
    id: row.id,
    name: row.full_name || "Unnamed",
    email: row.email || "no-email@example.com",
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
  const [statusFilter, setStatusFilter] = useState<
    "" | "active" | "inactive"
  >("");

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

  /* Details from Supabase for the selected user */
  const [detailStats, setDetailStats] = useState<UserStats | null>(null);
  const [loadingDetailStats, setLoadingDetailStats] = useState(false);
  const [detailStatsError, setDetailStatsError] = useState<string | null>(null);

  /* User deletion – confirmation modal */
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null);

  /* ---------------------- Metrics from Supabase ------------------ */
  const [mCfg, setMCfg] = useState<MetricsConfig>(loadMetrics());
  const [openGroups, setOpenGroups] = useState<
    Record<MetricGroupKey, boolean>
  >({
    BASE: true,
    GK: false,
    DEF: false,
    MID: false,
    ATT: false,
  });

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

  /* -------------------- Ratings configuration ------------------- */
  const [rCfg, setRCfg] = useState<RatingsConfig>(loadRatings());

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
          e?.message || "Failed to fetch user list from Supabase."
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
          e?.message || "Failed to fetch invitations from Supabase."
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

  /* ----------------------- User detail stats --------------------- */
  useEffect(() => {
    if (!detail) {
      setDetailStats(null);
      setDetailStatsError(null);
      return;
    }

    let cancelled = false;

    const loadStats = async () => {
      setLoadingDetailStats(true);
      setDetailStatsError(null);

      try {
        const supabase = getSupabase();

        const [playersRes, obsRes] = await Promise.all([
          supabase
            .from("players")
            .select("status, created_at")
            .eq("user_id", detail.id),
          supabase
            .from("observations")
            .select("status, bucket, created_at")
            .eq("user_id", detail.id),
        ]);

        if (playersRes.error) throw playersRes.error;
        if (obsRes.error) throw obsRes.error;
        if (cancelled) return;

        const players =
          (playersRes.data as { status: string; created_at?: string }[]) || [];
        const observations =
          (obsRes.data as {
            status: string;
            bucket: string;
            created_at?: string;
          }[]) || [];

        const playersTotal = players.length;
        const playersActive = players.filter(
          (p) => p.status === "active"
        ).length;
        const playersTrash = players.filter(
          (p) => p.status === "trash"
        ).length;

        const observationsTotal = observations.length;
        const observationsDraft = observations.filter(
          (o) => o.status === "draft"
        ).length;
        const observationsOther = observationsTotal - observationsDraft;

        const lastObservationAt =
          observations
            .map((o) => o.created_at)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null;

        setDetailStats({
          playersTotal,
          playersActive,
          playersTrash,
          observationsTotal,
          observationsDraft,
          observationsOther,
          lastObservationAt,
        });
      } catch (e: any) {
        if (cancelled) return;
        console.error("Error loading user stats:", e);
        setDetailStats(null);
        setDetailStatsError(
          e?.message ||
          "Failed to fetch user statistics from Supabase."
        );
      } finally {
        if (!cancelled) setLoadingDetailStats(false);
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [detail]);

  /* -------------------------- Persistence ----------------------- */

  async function onChangeRole(id: string, role: Role) {
    // optimistically in UI
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
      // fallback – reload
      setErrorAccounts("Failed to update role. Please refresh the list.");
    }
  }

  async function onToggleActive(id: string) {
    const current = accounts.find((a) => a.id === id);
    if (!current) return;
    const nextActive = !current.active;

    // Optimistic update
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: nextActive } : a))
    );

    try {
      if (nextActive) {
        // Activation: Use API to also confirm email in Auth
        const res = await fetch("/api/admin/activate-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Activation error via API");
        }
      } else {
        // Deactivation: Direct DB update is fine
        const supabase = getSupabase();
        const { error } = await supabase
          .from("profiles")
          .update({ active: false })
          .eq("id", id);
        if (error) throw error;
      }
    } catch (e: any) {
      console.error("Error toggling active:", e);
      // Revert optimistic update
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: !nextActive } : a))
      );
      setErrorAccounts(
        e.message || "Failed to change status. Please try again."
      );
    }
  }

  function onOpenDetail(a: Account) {
    setDetail(a);
  }

  // when accounts change (e.g. role/status), refresh details panel
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
        id, // note: assumes you can create profiles with your own UUID
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
        "Failed to add user. Check profiles table configuration."
      );
    } finally {
      setSavingUser(false);
    }
  }

  /* User deletion */
  async function onDeleteUser(id: string) {
    setErrorAccounts(null);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Server error while deleting user.");
      }

      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (detail?.id === id) {
        setDetail(null);
        setDetailStats(null);
      }
      toast.success("User successfully deleted.");
    } catch (e: any) {
      console.error("Error deleting user:", e);
      const msg = e?.message || "Failed to delete user. They may have linked data (e.g. players or observations).";
      setErrorAccounts(msg);
      toast.error(msg);
    } finally {
      setDeleteConfirm(null);
    }
  }

  /* Resending activation email */
  async function onResendActivation(userId: string, email: string, name: string) {
    try {
      const res = await fetch("/api/auth/send-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, userId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to send email (server error)");
      }

      const data = await res.json();

      if (data.mailSent) {
        toast.success("Activation email has been sent!");
      } else if (data.link) {
        // Fallback - copy link to clipboard
        copy(data.link);
        toast("Activation link copied to clipboard.", {
          description: "(Email was not sent - check configuration).",
        });
      }
    } catch (e: any) {
      console.error("Error resending activation:", e);
      toast.error("Error: " + (e.message || "An unknown error occurred"));
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
    const expiresAt =
      iExpiresDays > 0 ? isoDaysFromNow(iExpiresDays) : undefined;

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

      // quick share as before:
      quickShare({ ...inv, url });

      setIName("");
      setIEmail("");
      setIRole("scout");
      setIChannel("email");
    } catch (e: any) {
      console.error("Error creating invite:", e);
      setErrorInvites(
        e?.message || "Failed to create invitation in Supabase."
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
          title: "S4S Invitation",
          text: buildInviteText(invite),
          url: invite.url,
        })
        .catch(() => { });
      return;
    }
    if (invite.channel === "email") {
      const subject = encodeURIComponent("S4S Invitation");
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
      toast.success("Invitation link copied to clipboard.");
    }
  }

  function buildInviteText(inv: Invite) {
    const who = inv.name ? inv.name : "new scout";
    const roleTxt = `role: ${labelForRole(inv.role)}`;
    const exp = inv.expiresAt ? ` (expires: ${fmtDate(inv.expiresAt)})` : "";
    return `Hi ${who}!\n\nI invite you to S4S (${roleTxt}).\nJoin: ${inv.url}${exp}\n\nThanks!`;
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
      setErrorInvites("Failed to revoke invitation.");
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

  // stats for the top
  const totalActive = accounts.filter((a) => a.active).length;
  const totalScouts = accounts.filter((a) => a.role === "scout").length;
  const totalAgents = accounts.filter((a) => a.role === "scout-agent").length;

  /* -------------------- Metrics helpers ------------------------- */
  function setAndSaveMetrics(next: MetricsConfig) {
    setMCfg(next);
    saveMetrics(next);
  }

  function updateLabel(group: MetricGroupKey, id: string, label: string) {
    const next = {
      ...mCfg,
      [group]: mCfg[group].map((m) => (m.id === id ? { ...m, label } : m)),
    };
    setAndSaveMetrics(next);
  }
  function updateKey(group: MetricGroupKey, id: string, key: string) {
    const safe = key.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
    const next = {
      ...mCfg,
      [group]: mCfg[group].map((m) => (m.id === id ? { ...m, key: safe } : m)),
    };
    setAndSaveMetrics(next);
  }
  function toggleMetric(group: MetricGroupKey, id: string) {
    const next = {
      ...mCfg,
      [group]: mCfg[group].map((m) =>
        m.id === id ? { ...m, enabled: !m.enabled } : m
      ),
    };
    setAndSaveMetrics(next);
  }
  function addMetric(group: MetricGroupKey) {
    const id = safeId();
    const label = "New metric";
    const key = slugKey(label);
    const item: Metric = { id, key, label, enabled: true };
    const next = { ...mCfg, [group]: [...mCfg[group], item] };
    setAndSaveMetrics(next);
  }
  function removeMetric(group: MetricGroupKey, id: string) {
    const next = {
      ...mCfg,
      [group]: mCfg[group].filter((m) => m.id !== id),
    };
    setAndSaveMetrics(next);
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
    setAndSaveMetrics({ ...mCfg, [group]: arr });
  }
  function toggleGroup(g: MetricGroupKey) {
    setOpenGroups((s) => ({ ...s, [g]: !s[g] }));
  }

  /* ------- Ratings helpers (Player rating configuration) ------- */
  function setAndSaveRatings(next: RatingsConfig) {
    // ensuring consistent sort_order
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
    const label = "New rating";

    const item: RatingAspect = {
      id: safeRatingId(),
      key: slugRatingKey(label),
      label,
      tooltip: "",
      enabled: true,
      sort_order: rCfg.length,
      // default group – match the name to your union in ratings.ts
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
            User management
          </h1>
          <p className="mt-1 text-sm text-dark dark:text-neutral-300">
            Scout register • Change roles, activate/deactivate, invite
            new users and configure metrics / ratings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-gray-900 text-white hover:bg-gray-800"
            onClick={() => setInviteOpen(true)}
          >
            <Send className="mr-2 h-4 w-4" />
            Invite scout
          </Button>
          <Button
            variant="outline"
            className="border-gray-300 dark:border-neutral-700"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add manually
          </Button>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-gray-200 dark:border-neutral-800">
          <div className="flex items-center justify-between p-3">
            <div>
              <div className="text-xs text-dark dark:text-neutral-400">
                Active accounts
              </div>
              <div className="mt-1 text-xl font-semibold">
                {totalActive} / {accounts.length}
              </div>
            </div>
            <Users className="h-6 w-6 text-gray-400" />
          </div>
        </Card>
        <Card className="border-gray-200 dark:border-neutral-800">
          <div className="flex items-center justify-between p-3">
            <div>
              <div className="text-xs text-dark dark:text-neutral-400">
                Role distribution
              </div>
              <div className="mt-1 text-sm">
                Scout: <b>{totalScouts}</b> • Scout Agent:{" "}
                <b>{totalAgents}</b>
              </div>
            </div>
            <Shield className="h-6 w-6 text-gray-400" />
          </div>
        </Card>
        <Card className="border-gray-200 dark:border-neutral-800">
          <div className="flex items-center justify-between p-3">
            <div>
              <div className="text-xs text-dark dark:text-neutral-400">
                Pending invitations
              </div>
              <div className="mt-1 text-xl font-semibold">
                {pendingInvites.length}
              </div>
            </div>
            <Send className="h-6 w-6 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* Filtry – sekcja w akordeonie */}
      <InterfaceSection
        icon={<Filter className="h-4 w-4" />}
        title="Filters and search"
        description="Filter the user list by role, status, and contact information."
        defaultOpen
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, e-mail, or phone…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Role
              </label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter((e.target.value || "") as Role | "")
                }
              >
                <option value="">All</option>
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
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </InterfaceSection>

      {/* Zaproszenia – akordeon */}
      <InterfaceSection
        icon={<Send className="h-4 w-4" />}
        title={`Pending invitations (${pendingInvites.length})`}
        description="Share link or send via e-mail / messaging app."
        defaultOpen
      >
        {errorInvites && (
          <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {errorInvites}
          </div>
        )}
        <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="p-3 text-left font-medium">Person</th>
                <th className="p-3 text-left font-medium">Role</th>
                <th className="p-3 text-left font-medium">Channel</th>
                <th className="p-3 text-left font-medium">Sent</th>
                <th className="p-3 text-left font-medium">Expires</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingInvites && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-xs text-dark dark:text-neutral-400"
                  >
                    Loading invitations…
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
                      <div className="font-medium">{inv.name || "—"}</div>
                      <div className="text-xs text-dark dark:text-neutral-400">
                        {inv.email || "no e-mail"}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700">
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
                          title="Copy link"
                        >
                          <Copy className="mr-1 h-4 w-4" /> Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-gray-300 dark:border-neutral-700"
                          onClick={() =>
                            quickShare({ ...inv, channel: "system-share" })
                          }
                          title="Share"
                        >
                          <Share2 className="mr-1 h-4 w-4" /> Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-gray-300 text-red-600 dark:border-neutral-700"
                          onClick={() => revokeInvite(inv.id)}
                          title="Revoke invitation"
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Revoke
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
                    No active invitations — use "Invite scout".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </InterfaceSection>

      {/* Użytkownicy + szczegóły – akordeon */}
      <InterfaceSection
        icon={<Users className="h-4 w-4" />}
        title={`Users (${filtered.length})`}
        description="Click an entry to see details on the right and manage status."
        defaultOpen
      >
        {errorAccounts && (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {errorAccounts}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Lista użytkowników */}
          <div className="lg:col-span-2">
            <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="hidden bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300 sm:table-header-group">
                  <tr>
                    <th className="p-3 text-left font-medium">User</th>
                    <th className="p-3 text-left font-medium hidden md:table-cell">Contact</th>
                    <th className="p-3 text-left font-medium hidden sm:table-cell">Role</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium hidden lg:table-cell">Created</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAccounts && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-4 text-center text-xs text-dark dark:text-neutral-400"
                      >
                        Loading users…
                      </td>
                    </tr>
                  )}
                  {!loadingAccounts &&
                    filtered.map((a) => (
                      <tr
                        key={a.id}
                        className={`flex flex-col border-t border-gray-200 align-middle dark:border-neutral-700 sm:table-row ${detail?.id === a.id
                          ? "bg-indigo-50/30 dark:bg-indigo-950/10"
                          : ""
                          }`}
                      >
                        <td className="p-3">
                          <div className="flex items-start justify-between sm:block">
                            <div>
                              <button
                                className="text-left font-medium hover:underline"
                                onClick={() => onOpenDetail(a)}
                                title="Show details"
                              >
                                {a.name}
                              </button>
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-dark dark:text-neutral-400">
                                <Shield className="h-3.5 w-3.5" />
                                {labelForRole(a.role)}
                              </div>
                            </div>
                            {/* Role Selector for Mobile Only */}
                            <div className="sm:hidden">
                              <select
                                className="rounded-md border border-gray-300 bg-white p-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
                                value={a.role}
                                onChange={(e) =>
                                  onChangeRole(a.id, e.target.value as Role)
                                }
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {labelForRole(r).slice(0, 5)}...
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-neutral-300">
                            <Mail className="h-3.5 w-3.5" /> {a.email}
                          </div>
                          {a.phone && (
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-dark dark:text-neutral-400">
                              <Phone className="h-3.5 w-3.5" /> {a.phone}
                            </div>
                          )}
                        </td>
                        <td className="p-3 hidden sm:table-cell">
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
                        <td className="p-3 pb-1 sm:p-3">
                          <div className="flex items-center justify-between sm:block">
                            <span className="text-[11px] font-medium uppercase text-dark/50 dark:text-neutral-500 sm:hidden">
                              Status
                            </span>
                            {a.active ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                                <CheckCircle className="h-3.5 w-3.5" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                <Ban className="h-3.5 w-3.5" /> Inactive
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-xs text-dark dark:text-neutral-400 hidden lg:table-cell">
                          {fmtDate(a.createdAt)}
                          <div className="opacity-70">
                            {a.lastActive
                              ? `Last activity: ${fmtDate(a.lastActive)}`
                              : "—"}
                          </div>
                        </td>
                        <td className="p-3 pt-1 text-right sm:p-3">
                          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-gray-300 px-2 text-[10px] dark:border-neutral-700 sm:px-3 sm:text-sm"
                              onClick={() => onOpenDetail(a)}
                            >
                              <Eye className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-gray-300 px-2 text-[10px] dark:border-neutral-700 sm:px-3 sm:text-sm"
                              onClick={() => onToggleActive(a.id)}
                              title={a.active ? "Deactivate" : "Activate"}
                            >
                              {a.active ? (
                                <>
                                  <XCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />{" "}
                                  Activate
                                </>
                              )}
                            </Button>
                            {!a.active && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-blue-300 px-2 text-[10px] text-blue-600 dark:border-blue-700 dark:text-blue-400 sm:px-3 sm:text-sm"
                                onClick={() => onResendActivation(a.id, a.email, a.name)}
                                title="Resend activation email"
                              >
                                <Mail className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Email
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-red-200 px-2 text-[10px] text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40 sm:px-3 sm:text-sm"
                              onClick={() => setDeleteConfirm(a)}
                              title="Delete user"
                            >
                              <Trash2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Delete
                            </Button>
                          </div>
                        </td>

                        {/* SZCZEGÓŁY INLINE - MOBILE ONLY */}
                        {detail?.id === a.id && (
                          <td className="w-full border-t border-dashed border-gray-200 bg-stone-50/40 p-4 dark:border-neutral-800 dark:bg-neutral-900/30 lg:hidden">
                            <div className="space-y-4 text-sm">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">Account details</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setDetail(null)}
                                >
                                  Close
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-[11px] font-medium uppercase text-dark/50 dark:text-neutral-500">
                                      E-mail
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                                      {detail.email}
                                    </div>
                                  </div>
                                  {detail.phone && (
                                    <div>
                                      <div className="text-[11px] font-medium uppercase text-dark/50 dark:text-neutral-500">
                                        Phone
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                                        {detail.phone}
                                      </div>
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-[11px] font-medium uppercase text-dark/50 dark:text-neutral-500">
                                      S4S Statistics
                                    </div>
                                    {loadingDetailStats ? (
                                      <div className="animate-pulse text-xs text-gray-400">Loading...</div>
                                    ) : detailStats ? (
                                      <div className="mt-1 space-y-1 text-xs">
                                        <div>Players: <b>{detailStats.playersTotal}</b> (Active: {detailStats.playersActive})</div>
                                        <div>Observations: <b>{detailStats.observationsTotal}</b> (Draft: {detailStats.observationsDraft})</div>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-gray-400">No data</div>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div>
                                    <div className="text-[11px] font-medium uppercase text-dark/50 dark:text-neutral-500">
                                      Dates
                                    </div>
                                    <div className="space-y-0.5 text-xs text-dark/70 dark:text-neutral-400">
                                      <div>Created: {fmtDate(detail.createdAt)}</div>
                                      <div>Activity: {detail.lastActive ? fmtDate(detail.lastActive) : "none"}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-medium uppercase text-dark/50 dark:text-neutral-500">
                                      Quick actions
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => onToggleActive(detail.id)}
                                      >
                                        {detail.active ? "Deactivate" : "Activate"}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 border-red-200 text-xs text-red-600 dark:border-red-900/40"
                                        onClick={() => setDeleteConfirm(detail)}
                                      >
                                        Delete account
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  {!loadingAccounts && filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-6 text-center text-sm text-dark dark:text-neutral-400"
                      >
                        No results — change filters or add a new
                        user.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel szczegółów po prawej - DESKTOP ONLY */}
          <div className="hidden lg:block rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Account details</div>
              {detail && (
                <span className="text-[11px] text-dark/70 dark:text-neutral-400">
                  ID: {detail.id.slice(0, 8)}…
                </span>
              )}
            </div>

            {!detail && (
              <div className="text-xs text-dark dark:text-neutral-400">
                Select a user from the list to see account details.
              </div>
            )}

            {detail && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-dark dark:text-neutral-400">
                    Full name
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
                      Phone
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5" />
                      {detail.phone}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-medium text-dark dark:text-neutral-400">
                    Role
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    <span className="text-sm">
                      {labelForRole(detail.role)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-dark dark:text-neutral-400">
                    Status
                  </div>
                  {detail.active ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                      <CheckCircle className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      <Ban className="h-3.5 w-3.5" /> Inactive
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-medium text-dark dark:text-neutral-400">
                      Created
                    </div>
                    <div className="mt-0.5 text-dark dark:text-neutral-300">
                      {fmtDate(detail.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-dark dark:text-neutral-400">
                      Last activity
                    </div>
                    <div className="mt-0.5 text-dark dark:text-neutral-300">
                      {detail.lastActive ? fmtDate(detail.lastActive) : "—"}
                    </div>
                  </div>
                </div>

                {/* Activity in Supabase */}
                <div className="mt-1 space-y-2 border-t border-dashed border-gray-200 pt-2 dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-dark dark:text-neutral-400">
                      Activity in S4S (Supabase)
                    </div>
                    {loadingDetailStats && (
                      <span className="text-[11px] text-dark/60 dark:text-neutral-500">
                        Loading…
                      </span>
                    )}
                  </div>

                  {detailStatsError && (
                    <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                      {detailStatsError}
                    </div>
                  )}

                  {detailStats && !detailStatsError && (
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-md bg-stone-100 p-2 dark:bg-neutral-900">
                        <div className="font-medium text-dark dark:text-neutral-200">
                          Players
                        </div>
                        <div className="mt-1 space-y-0.5 text-dark/80 dark:text-neutral-300">
                          <div>
                            Total: <b>{detailStats.playersTotal}</b>
                          </div>
                          <div>
                            Active: <b>{detailStats.playersActive}</b>
                          </div>
                          <div>
                            Trash: <b>{detailStats.playersTrash}</b>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md bg-stone-100 p-2 dark:bg-neutral-900">
                        <div className="font-medium text-dark dark:text-neutral-200">
                          Observations
                        </div>
                        <div className="mt-1 space-y-0.5 text-dark/80 dark:text-neutral-300">
                          <div>
                            Total: <b>{detailStats.observationsTotal}</b>
                          </div>
                          <div>
                            Draft: <b>{detailStats.observationsDraft}</b>
                          </div>
                          <div>
                            Other statuses:{" "}
                            <b>{detailStats.observationsOther}</b>
                          </div>
                          {detailStats.lastObservationAt && (
                            <div className="mt-1 text-[10px] text-dark/70 dark:text-neutral-400">
                              Last observation:{" "}
                              {fmtDate(detailStats.lastObservationAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!loadingDetailStats &&
                    !detailStats &&
                    !detailStatsError && (
                      <div className="text-[11px] text-dark/60 dark:text-neutral-500">
                        No player or observation data for this user.
                      </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-gray-200 pt-2 dark:border-neutral-800">
                  <div className="text-[11px] text-dark/70 dark:text-neutral-500">
                    Manage user status.
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
                          <XCircle className="mr-1 h-4 w-4" /> Deactivate
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-1 h-4 w-4" /> Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-red-200 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                      onClick={() => setDeleteConfirm(detail)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Delete account
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-gray-300 text-xs dark:border-neutral-700"
                      onClick={() => setDetail(null)}
                    >
                      Clear selection
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </InterfaceSection>

      {/* ===== Modals (invites, add user, delete confirm) ===== */}
      {inviteOpen && (
        <Modal
          onClose={() => setInviteOpen(false)}
          title="Invite new scout"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Full name (optional)
              </label>
              <Input
                value={iName}
                onChange={(e) => setIName(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                E-mail (required for e-mail channel)
              </label>
              <Input
                type="email"
                value={iEmail}
                onChange={(e) => setIEmail(e.target.value)}
                placeholder="e.g. john@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Role
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
                Channel
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
                <option value="link">Copy link</option>
                <option value="system-share">System sharing</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Expires (days)
              </label>
              <Input
                type="number"
                min={0}
                value={iExpiresDays}
                onChange={(e) =>
                  setIExpiresDays(Number(e.target.value || 0))
                }
                placeholder="e.g. 14"
              />
              <div className="mt-1 text-[11px] text-dark dark:text-neutral-400">
                0 = no expiration
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => setInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={onCreateInvite}
              disabled={
                creatingInvite || (iChannel === "email" && !iEmail.trim())
              }
              title={
                iChannel === "email" && !iEmail.trim()
                  ? "Provide e-mail or choose another channel"
                  : ""
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {creatingInvite ? "Creating…" : "Send invitation"}
            </Button>
          </div>
        </Modal>
      )}

      {addOpen && (
        <Modal
          onClose={() => setAddOpen(false)}
          title="Add user manually"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Full name
              </label>
              <Input
                value={nName}
                onChange={(e) => setNName(e.target.value)}
                placeholder="e.g. John Smith"
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
                placeholder="e.g. john@example.com"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-dark dark:text-neutral-400">
                Phone (optional)
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
                <span>{nActive ? "Active" : "Inactive"}</span>
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
              Cancel
            </Button>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={onAddUser}
              disabled={savingUser || !nName.trim() || !nEmail.trim()}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {savingUser ? "Saving…" : "Add user"}
            </Button>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal
          onClose={() => setDeleteConfirm(null)}
          title="Delete user"
        >
          <p className="text-sm text-dark dark:text-neutral-200">
            Are you sure you want to delete the account{" "}
            <span className="font-semibold">{deleteConfirm.name}</span>?
            <br />
            This operation cannot be undone.
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => onDeleteUser(deleteConfirm.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete user
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
      className="h-8 w-full rounded-md border border-transparent bg-white px-2 text-sm outline-none focus:border-indigo-500 dark:bg-neutral-950 dark:focus:border-indigo-400"
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

/* ======================= Interface section (accordion) ======================= */
function InterfaceSection({
  icon,
  title,
  description,
  badge,
  defaultOpen = true,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden border-gray-200 shadow-sm dark:border-neutral-800">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 bg-stone-50/70 px-4 py-3 text-left hover:bg-stone-100/80 dark:bg-neutral-950/70 dark:hover:bg-neutral-900/80"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-dark ring-1 ring-gray-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-dark dark:text-neutral-50">
              {title}
            </div>
            {description && (
              <div className="mt-0.5 text-[11px] text-dark/70 dark:text-neutral-400">
                {description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <ChevronDown
            className={`h-4 w-4 text-dark/70 transition-transform dark:text-neutral-300 ${open ? "rotate-180" : ""
              }`}
          />
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
          {children}
        </div>
      )}
    </Card>
  );
}

/* ======================== Small components ====================== */

function labelForRole(r: Role) {
  if (r === "admin") return "Admin";
  if (r === "scout-agent") return "Scout Agent";
  return "Scout";
}
function channelLabel(c: InviteChannel) {
  if (c === "email") return "E-mail";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "messenger") return "Messenger";
  if (c === "system-share") return "Share";
  return "Link";
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
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

/* Minimal modal – global, fullscreen, blur */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  const root = document.getElementById(MODAL_ROOT_ID) ?? document.body;

  return createPortal(
    <>
      {/* Fullscreen blur overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Popup */}
      <div
        className="fixed inset-0 z-[101] flex items-start justify-center overflow-y-auto pt-[8vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-3 mb-10 w-full max-w-2xl rounded-md border border-gray-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-3 flex flex-wrap items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Shield className="h-4 w-4" />
              <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <button
              className="rounded-md p-1 text-dark hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>,
    root
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
