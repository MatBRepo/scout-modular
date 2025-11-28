// src/widgets/app-sidebar/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  NotebookPen,
  Sun,
  Moon,
  Globe,
  Settings,
  Map,
  Trophy,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  TriangleAlert,
  LogOut,
  X,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";

import { MyPlayersIconDefault } from "@/components/icons";
import { supabase } from "@/shared/supabase-client";

/* ========= Types ========= */
type Role = "admin" | "scout" | "scout-agent";
type Rank = "bronze" | "silver" | "gold" | "platinum";
type SidebarVariant = "desktop" | "mobile";

const RANK_ORDER: Rank[] = ["bronze", "silver", "gold", "platinum"];
const GLOBAL_MODAL_ROOT_ID = "global-modal-root";

/* ========= Default rank thresholds (fallback if DB empty) ========= */
const DEFAULT_RANK_THRESHOLDS: Record<Rank, number> = {
  bronze: 0,
  silver: 20,
  gold: 50,
  platinum: 100,
};

/* ========= Rank helpers ========= */
const calcScore = (players: number, observations: number) =>
  players * 2 + observations;

function calcRank(
  players: number,
  observations: number,
  thresholds: Record<Rank, number>
) {
  const score = calcScore(players, observations);

  if (score >= thresholds.platinum)
    return { rank: "platinum" as Rank, score };
  if (score >= thresholds.gold)
    return { rank: "gold" as Rank, score };
  if (score >= thresholds.silver)
    return { rank: "silver" as Rank, score };
  return { rank: "bronze" as Rank, score };
}

function nextRankInfo(
  rank: Rank,
  score: number,
  thresholds: Record<Rank, number>
) {
  const idx = RANK_ORDER.indexOf(rank);
  const next = RANK_ORDER[idx + 1] ?? "platinum";

  const currentMin = thresholds[rank];
  const nextMin = thresholds[next];

  const span = Math.max(1, nextMin - currentMin);
  const progressed = Math.max(0, score - currentMin);
  const pct = Math.min(100, Math.round((progressed / span) * 100));
  const remaining = Math.max(0, nextMin - score);

  return { next, pct, remaining };
}

const rankLabel = (r: Rank) =>
  r === "platinum"
    ? "Platinum"
    : r === "gold"
    ? "Gold"
    : r === "silver"
    ? "Silver"
    : "Bronze";

function rankClass(r: Rank) {
  switch (r) {
    case "platinum":
      return "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-800/70";
    case "gold":
      return "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/70";
    case "silver":
      return "bg-stone-100 text-stone-800 ring-stone-200 dark:bg-stone-800/40 dark:text-stone-200 dark:ring-stone-700/70";
    default:
      return "bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:ring-orange-800/70";
  }
}
function rankTrophyColor(r: Rank) {
  switch (r) {
    case "platinum":
      return "text-indigo-500";
    case "gold":
      return "text-amber-500";
    case "silver":
      return "text-stone-400";
    default:
      return "text-orange-500";
  }
}
const formatNum = (n: number) => new Intl.NumberFormat("pl-PL").format(n);

function labelForRole(r: Role) {
  if (r === "admin") return "Admin";
  if (r === "scout-agent") return "Scout Agent";
  return "Scout";
}

/* ========= Sidebar ========= */
export default function AppSidebar({
  variant = "desktop",
  open = false,
  onClose,
}: {
  variant?: SidebarVariant;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const prefersReduced = useReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("scout");
  const [displayName, setDisplayName] = useState<string | null>(null);

  // dynamic rank thresholds (managed in Supabase)
  const [rankThresholds, setRankThresholds] = useState<
    Record<Rank, number>
  >(DEFAULT_RANK_THRESHOLDS);

  // stats
  const [playersCount, setPlayersCount] = useState(0);
  const [obsCount, setObsCount] = useState(0);
  const [hasRankData, setHasRankData] = useState(false);

  // rank-up popup
  const [rankPopup, setRankPopup] = useState<{ from: Rank; to: Rank } | null>(
    null
  );

  // loader inside clicked nav item
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const { rank, score } = calcRank(playersCount, obsCount, rankThresholds);
  const { next, pct, remaining } = nextRankInfo(
    rank,
    score,
    rankThresholds
  );

  const handleNavClick = (href: string) => {
    setPendingHref(href);

    // anchor-only (hash) – nie ma zmiany pathname, więc czyścimy szybko sami
    if (href.includes("#")) {
      setTimeout(() => {
        setPendingHref((current) => (current === href ? null : current));
      }, 400);
    }
  };

  /* ===== Mount ===== */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* ===== Reset item loader on route change ===== */
  useEffect(() => {
    if (!mounted) return;
    setPendingHref(null);
  }, [pathname, mounted]);

  /* ===== Load current user from Supabase ===== */
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !data.user) {
        setUserId(null);
        setDisplayName(null);
        return;
      }
      setUserId(data.user.id);

      const meta = (data.user.user_metadata || {}) as any;
      const nameFromMeta =
        meta.full_name || meta.name || meta.display_name || "";
      const finalName = nameFromMeta || data.user.email || "Użytkownik";
      setDisplayName(finalName);
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  /* ===== Load profile (role) from Supabase ===== */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (!error && data?.role) {
        const r = String(data.role) as Role;
        if (r === "admin" || r === "scout" || r === "scout-agent") {
          setRole(r);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* ===== Load rank thresholds from Supabase (admin managed) ===== */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("rank_thresholds")
        .select("rank, min_score");

      if (cancelled || error || !data) return;

      const nextMap: Record<Rank, number> = {
        ...DEFAULT_RANK_THRESHOLDS,
      };

      for (const row of data as { rank: string; min_score: number }[]) {
        const r = row.rank as Rank;
        if (r in nextMap) {
          nextMap[r] = row.min_score;
        }
      }
      setRankThresholds(nextMap);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ===== Load counts (players & observations) from Supabase =====
   * Only "fully filled":
   *  - players: status = 'active'
   *  - observations: status = 'final' AND bucket = 'active'
   */
  const readCounts = async () => {
    if (!userId) return;

    try {
      const [playersRes, obsRes] = await Promise.all([
        supabase
          .from("players")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "active"),
        supabase
          .from("observations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "final")
          .eq("bucket", "active"),
      ]);

      setPlayersCount(playersRes.count ?? 0);
      setObsCount(obsRes.count ?? 0);
      setHasRankData(true);
    } catch {
      setPlayersCount(0);
      setObsCount(0);
      setHasRankData(true);
    }
  };

  useEffect(() => {
    if (!userId) return;
    readCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ===== Detect rank upgrade & trigger popup ONCE per rank ===== */
  useEffect(() => {
    if (!mounted || !hasRankData) return;
    if (typeof window === "undefined") return;

    const key = "s4s.rank.last";
    const stored = window.localStorage.getItem(key);
    const isRank = (v: any): v is Rank =>
      v === "bronze" || v === "silver" || v === "gold" || v === "platinum";

    const last = isRank(stored) ? stored : null;

    // pierwszy raz – tylko zapisz
    if (!last) {
      window.localStorage.setItem(key, rank);
      return;
    }

    // awans – nowy rank > poprzedni => popup JEDEN raz dla tego awansu
    if (RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(last)) {
      setRankPopup({ from: last, to: rank });
    }

    // aktualizuj zawsze – dzięki temu ten sam rank nie odpali popupu 2x
    window.localStorage.setItem(key, rank);
  }, [rank, mounted, hasRankData]);

  /* ===== Shortcuts ===== */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag && /INPUT|TEXTAREA|SELECT/i.test(tag)) return;
      const k = e.key.toLowerCase();
      if (k === "t") setTheme(theme === "dark" ? "light" : "dark");
      if (k === "g") router.push("/players/global/search");
      if (k === "o") router.push("/observations");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theme, setTheme, router]);

  /* ===== Account popover ===== */
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!accountRef.current) return;
      if (!accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  useEffect(() => setAccountOpen(false), [pathname]);

  /* ===== Active flags ===== */
  const isGlobalSection = pathname?.startsWith("/players/global");
  const isPlayersSection = pathname?.startsWith("/players") && !isGlobalSection;

  const globalBaseActive =
    isGlobalSection &&
    (pathname === "/players/global" || pathname === "/players/global/");
  const globalSearchActive =
    isGlobalSection && pathname?.startsWith("/players/global/search");

  // Zarządzanie + podstrony
  const isManageSection = pathname?.startsWith("/admin/manage");
  const manageBaseActive =
    isManageSection &&
    (pathname === "/admin/manage" || pathname === "/admin/manage/");
  const manageMetricsActive = pathname?.startsWith("/admin/manage/metrics");
  const manageRatingsActive = pathname?.startsWith("/admin/manage/ratings");
  const manageRanksActive = pathname?.startsWith("/admin/manage/ranks");
  const manageRequiredActive = pathname?.startsWith(
    "/admin/manage/required-fields"
  );

  const playersBadge = playersCount > 0 ? String(playersCount) : undefined;
  const obsBadge = obsCount > 0 ? String(obsCount) : undefined;

  /* ===== Mobile/desktop accordion state for "Zarządzanie" ===== */
  const [manageOpen, setManageOpen] = useState(variant === "desktop");

  /* ===== Logout via Supabase ===== */
  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/"); // AuthGate wywali usera z panelu
    }
  }

  /* ===== Early return ===== */
  const hidden = !mounted || !userId;
  if (hidden) return null;

  /* ===== Nav ===== */
  const InnerNav = () => (
    <nav
      className="space-y-1 text-sm"
      onClick={() => onClose?.()}
    >
      {(role === "scout" || role === "scout-agent" || role === "admin") && (
        <div className="mt-1">
          <div className="pb-1 text-[11px] font-semibold tracking-wide text-gray-800 dark:text-neutral-400">
            Zawodnicy
          </div>

          <NavItem
            href="/players"
            icon={<MyPlayersIconDefault />}
            label="Moi zawodnicy"
            active={isPlayersSection}
            badge={playersBadge}
            badgeTitle="Aktywni zawodnicy (pełne profile)"
            pending={pendingHref === "/players"}
            onClickHref={handleNavClick}
          />
        </div>
      )}

      <NavItem
        href="/observations"
        icon={<NotebookPen className="h-4 w-4" />}
        label="Obserwacje"
        active={
          pathname === "/observations" ||
          pathname?.startsWith("/observations/")
        }
        badge={obsBadge}
        badgeTitle="Zakończone obserwacje (final, active)"
        pending={pendingHref === "/observations"}
        onClickHref={handleNavClick}
      />
    </nav>
  );

  function BrandMark({ showName }: { showName: boolean }) {
    return (
      <a
        href="/"
        className="group flex items-center gap-2"
        aria-label="entrisoScouting - Start"
      >
        <div className="grid h-8 w-8 place-items-center rounded-md bg-gray-900 text-white dark:bg.white dark:text-neutral-900">
          <span className="text-[13px] font-bold leading-none">S</span>
        </div>
        {showName && (
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            entrisoScouting
          </span>
        )}
      </a>
    );
  }

  const inner = (
    <div className="grid h-full grid-rows-[auto,1fr,auto]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between">
        <Link
          href="/"
          className="flex gap-2 rounded-md font-semibold tracking-tight focus:ring-indigo-500 place-items-center"
          title="Wróć na kokpit"
          onClick={onClose}
        >
          <BrandMark showName={true} />
        </Link>
      </div>

      {/* Middle scrollable */}
      <div className="min-h-0 overflow-y-auto pr-1">
        <InnerNav />
      </div>

      {/* Bottom fixed panel */}
      <div className="-mx-3 mt-6 border-t border-gray-200 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/90">
        {role === "admin" && (
          <>
            {/* ADMIN section */}
            <div className="mt-1 rounded-md border border-stone-200 bg-stone-50/70 p-2.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                  <Settings className="h-3.5 w-3.5" />
                  Administracja
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-indigo-300/50 to-transparent dark:from-indigo-700/30" />
              </div>

              <div className="space-y-0.5">
                {/* Global players + submenu */}
                <div>
                  <NavItem
                    href="/players/global"
                    icon={<Globe className="h-4 w-4" />}
                    label="Zawodnicy (global)"
                    active={isGlobalSection}
                    pending={pendingHref === "/players/global"}
                    onClickHref={handleNavClick}
                  />
                  <div className="mt-0.5 space-y-0.5 pl-9">
                    <SubNavItem
                      href="/players/global"
                      label="Globalna baza"
                      active={globalBaseActive}
                      pending={pendingHref === "/players/global"}
                      onClickHref={handleNavClick}
                    />
                    <SubNavItem
                      href="/players/global/search"
                      label="Wyszukaj"
                      active={globalSearchActive}
                      pending={pendingHref === "/players/global/search"}
                      onClickHref={handleNavClick}
                    />
                    {/* 3rd level under Wyszukaj */}
                    <div className="space-y-0.5 pl-6">
                      <SubNavItem
                        href="/players/global/search#tm"
                        label="Transfermarkt"
                        pending={
                          pendingHref === "/players/global/search#tm"
                        }
                        onClickHref={handleNavClick}
                      />
                      <SubNavItem
                        href="/players/global/search#lnp"
                        label="LNP"
                        pending={
                          pendingHref === "/players/global/search#lnp"
                        }
                        onClickHref={handleNavClick}
                      />
                    </div>
                  </div>
                </div>

                {/* Zarządzanie + submenu: Metryki & Oceny & Ranki */}
                {variant === "desktop" ? (
                  <div>
                    {/* Accordion header (button) on desktop */}
                    <button
                      type="button"
                      onClick={() => setManageOpen((v) => !v)}
                      aria-expanded={manageOpen}
                      className={`group flex w-full min-w-0 items-center justify-between rounded-md px-3 py-2 text-sm transition focus:ring-indigo-500 ${
                        isManageSection
                          ? "bg-stone-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
                          : "text-gray-700 hover:bg-stone-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0">
                          <Settings className="h-4 w-4" />
                        </span>
                        <span className="truncate">
                          Zarządzanie
                        </span>
                      </span>
                      <motion.span
                        aria-hidden
                        initial={false}
                        animate={{ rotate: manageOpen ? 180 : 0 }}
                        transition={{
                          duration: prefersReduced ? 0 : 0.18,
                          ease: [0.2, 0.7, 0.2, 1],
                        }}
                        className="ml-2 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[11px] opacity-70"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </motion.span>
                    </button>

                    {/* Accordion content (submenu) on desktop */}
                    <AnimatePresence initial={false}>
                      {manageOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{
                            duration: prefersReduced ? 0 : 0.18,
                            ease: "easeOut",
                          }}
                          className="overflow-hidden"
                        >
                          <div className="mt-0.5 space-y-0.5 pl-9">
                            <SubNavItem
                              href="/admin/manage"
                              label="Użytkownicy"
                              active={manageBaseActive}
                              pending={
                                pendingHref === "/admin/manage"
                              }
                              onClickHref={handleNavClick}
                            />
                            <SubNavItem
                              href="/admin/manage/metrics"
                              label="Metryki obserwacji"
                              active={manageMetricsActive}
                              pending={
                                pendingHref ===
                                "/admin/manage/metrics"
                              }
                              onClickHref={handleNavClick}
                            />
                            <SubNavItem
                              href="/admin/manage/ratings"
                              label="Oceny zawodnika"
                              active={manageRatingsActive}
                              pending={
                                pendingHref ===
                                "/admin/manage/ratings"
                              }
                              onClickHref={handleNavClick}
                            />
                            <SubNavItem
                              href="/admin/manage/ranks"
                              label="Rangi użytkowników"
                              active={manageRanksActive}
                              pending={pendingHref === "/admin/manage/ranks"}
                              onClickHref={handleNavClick}
                            />
                            <SubNavItem
                              href="/admin/manage/required-fields"
                              label="Wymagane pola"
                              active={manageRequiredActive}
                              pending={
                                pendingHref ===
                                "/admin/manage/required-fields"
                              }
                              onClickHref={handleNavClick}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div>
                    {/* Accordion header (button) on mobile */}
                    <button
                      type="button"
                      onClick={() => setManageOpen((v) => !v)}
                      aria-expanded={manageOpen}
                      className={`group flex w-full min-w-0 items-center justify-between rounded-md px-3 py-2 text-sm transition focus:ring-indigo-500 ${
                        isManageSection
                          ? "bg-stone-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
                          : "text-gray-700 hover:bg-stone-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0">
                          <Settings className="h-4 w-4" />
                        </span>
                        <span className="truncate">
                          Zarządzanie
                        </span>
                      </span>
                      <motion.span
                        aria-hidden
                        initial={false}
                        animate={{ rotate: manageOpen ? 180 : 0 }}
                        transition={{
                          duration: prefersReduced ? 0 : 0.18,
                          ease: [0.2, 0.7, 0.2, 1],
                        }}
                        className="ml-2 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[11px] opacity-70"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </motion.span>
                    </button>

                    {/* Accordion content (submenu) on mobile */}
                    <AnimatePresence initial={false}>
                      {manageOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{
                            duration: prefersReduced ? 0 : 0.18,
                            ease: "easeOut",
                          }}
                          className="overflow-hidden"
                        >
                          <div className="mt-0.5 space-y-0.5 pl-9">
                            <SubNavItem
                              href="/admin/manage"
                              label="Użytkownicy"
                              active={manageBaseActive}
                              pending={
                                pendingHref === "/admin/manage"
                              }
                              onClickHref={handleNavClick}
                            />
                            <SubNavItem
                              href="/admin/manage/metrics"
                              label="Metryki obserwacji"
                              active={manageMetricsActive}
                              pending={
                                pendingHref ===
                                "/admin/manage/metrics"
                              }
                              onClickHref={handleNavClick}
                            />
                            <SubNavItem
                              href="/admin/manage/ratings"
                              label="Oceny zawodnika"
                              active={manageRatingsActive}
                              pending={
                                pendingHref ===
                                "/admin/manage/ratings"
                              }
                              onClickHref={handleNavClick}
                            />
                            <SubNavItem
                              href="/admin/manage/ranks"
                              label="Rangi użytkowników"
                              active={manageRanksActive}
                              pending={
                                pendingHref === "/admin/manage/ranks"
                              }
                              onClickHref={handleNavClick}
                            />
                            <SubNavItem
                              href="/admin/manage/required-fields"
                              label="Wymagane pola"
                              active={manageRequiredActive}
                              pending={
                                pendingHref ===
                                "/admin/manage/required-fields"
                              }
                              onClickHref={handleNavClick}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <NavItem
                  href="/scouts"
                  icon={<Users className="h-4 w-4" />}
                  label="Lista scoutów"
                  active={
                    pathname === "/scouts" || pathname?.startsWith("/scouts/")
                  }
                  pending={pendingHref === "/scouts"}
                  onClickHref={handleNavClick}
                />

                <NavItem
                  href="/duplicates"
                  icon={<TriangleAlert className="h-4 w-4" />}
                  label="Duplikaty"
                  active={pathname === "/duplicates"}
                  pending={pendingHref === "/duplicates"}
                  onClickHref={handleNavClick}
                />
              </div>
            </div>
          </>
        )}

        {/* SEPARATOR między Administracja a account-row */}
        <div className="my-2 h-px bg-gray-200 dark:bg-neutral-800" />

        <div ref={accountRef} className="relative">
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-md py-2 text-sm text-gray-800 transition hover:bg-stone-100 focus:ring-indigo-500 dark:text-neutral-100 dark:hover:bg-neutral-900"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
          >
            {/* Name | Role */}
            <span className="flex min-w-0 items-center gap-1 text-[11px] opacity-80">
              <span className="truncate">
                {displayName || "Użytkownik"}
              </span>
              <span aria-hidden className="opacity-40">
                |
              </span>
              <span className="truncate">
                {labelForRole(role)}
              </span>
            </span>

            {/* + / − zamiast chevrona */}
            <motion.span
              aria-hidden
              initial={false}
              animate={{ scale: accountOpen ? 1.05 : 1 }}
              transition={{
                duration: prefersReduced ? 0 : 0.12,
                ease: [0.2, 0.7, 0.2, 1],
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded border border-gray-300 text-xs text-gray-700 dark:border-neutral-600 dark:text-neutral-100"
            >
              {accountOpen ? "−" : "+"}
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {accountOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{
                  duration: prefersReduced ? 0 : 0.14,
                  ease: "easeOut",
                }}
                className="
  absolute bottom-[40px] left-0 right-0 z-40 w-auto max-w-full
  overflow-x-hidden rounded-md rounded-l-none border border-gray-200 bg-white p-2 shadow-2xl
    lg:left-full lg:right-auto lg:ml-3
    lg:min-w-[260px] lg:max-w-[420px]
  "
              >
                {/* Rank card */}
                <div className="mx-1 mb-2 rounded-md bg-stone-100 p-3 text-xs ring-1 ring-gray-200 dark:bg-neutral-900 dark:ring-neutral-800">
                  <div className="mb-1 flex flex-wrap items-center justify-between">
                    <span className="font-semibold whitespace-normal break-words">
                      Twój poziom
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${rankClass(
                        rank
                      )}`}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      {rankLabel(rank)}
                    </span>
                  </div>

                  <div className="mt-1">
                    <div className="mb-1 flex flex-wrap items-center justify-between whitespace-normal break-words">
                      <span className="opacity-70">
                        Postęp do {rankLabel(next as Rank)}
                      </span>
                      <span className="opacity-70">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-md bg-gray-200 dark:bg-neutral-800">
                      <div
                        className="h-2 rounded-md bg-indigo-500 transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] opacity-70 whitespace-normal break-words">
                      Brakuje {remaining} pkt (np.{" "}
                      {Math.ceil(remaining / 2)} aktywnych zawodników lub{" "}
                      {remaining} obserwacji).
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                    <div className="rounded-md p-2">
                      <div className="opacity-60">Zawodnicy</div>
                      <div className="text-sm font-semibold">
                        {formatNum(playersCount)}
                      </div>
                    </div>
                    <div className="rounded-md p-2">
                      <div className="opacity-60">Obserwacje</div>
                      <div className="text-sm font-semibold">
                        {formatNum(obsCount)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] transition hover:bg-stone-100 focus:ring-indigo-500 dark:border-neutral-700 dark:hover:bg-neutral-800"
                      onClick={readCounts}
                      title="Odśwież liczniki"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Odśwież
                    </button>
                  </div>
                </div>

                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-neutral-400">
                  Szybkie akcje
                </div>
                <Link
                  role="menuitem"
                  className="flex flex-wrap items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-stone-100 focus:ring-indigo-500 dark:hover:bg-neutral-900"
                  href="/settings"
                  onClick={() => {
                    onClose?.();
                    handleNavClick("/settings");
                  }}
                >
                  <Settings className="h-4 w-4" /> Ustawienia
                </Link>
                <Link
                  role="menuitem"
                  className="flex flex-wrap items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-stone-100 focus:ring-indigo-500 dark:hover:bg-neutral-900"
                  href="/settings/navigation"
                  onClick={() => {
                    onClose?.();
                    handleNavClick("/settings/navigation");
                  }}
                >
                  <Map className="h-4 w-4" /> Nawigacja
                </Link>

                <div className="my-2 h-px bg-gray-200 dark:bg-neutral-800" />

                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-neutral-400">
                  Rola
                </div>
                <div className="px-2 pb-2 text-sm text-dark dark:text-neutral-200">
                  {displayName
                    ? `${displayName} | ${labelForRole(role)}`
                    : labelForRole(role)}
                </div>

                <div className="my-2 h-px bg-gray-200 dark:bg-neutral-800" />

                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:ring-red-400 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Wyloguj się"
                >
                  <LogOut className="h-4 w-4" />
                  Wyloguj
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className={`h-3.5 w-3.5 ${rankTrophyColor(rank)}`} />
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="hidden min-w-0 shrink items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-700 sm:flex dark:border-neutral-800 dark:text-neutral-300"
                title={`Aktywni: ${playersCount} • Obserwacje: ${obsCount} • Score: ${score}`}
              >
                <TrendingUp className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">
                  {formatNum(playersCount)} / {formatNum(obsCount)}
                </span>
              </div>
              <button
                className="rounded-md border border-gray-300 p-1.5 text-xs transition hover:bg-stone-100 active:scale-[0.98] focus:ring-indigo-500 dark:border-neutral-700 dark:hover:bg-neutral-900"
                onClick={() =>
                  setTheme(theme === "dark" ? "light" : "dark")
                }
                aria-label="Przełącz motyw (T)"
                title="Przełącz motyw (T)"
              >
                {theme === "dark" ? (
                  <Sun className="h-3 w-3" />
                ) : (
                  <Moon className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const rankUpgradeOverlay = (
    <RankUpgradeOverlay
      popup={rankPopup}
      onClose={() => setRankPopup(null)}
    />
  );

  /* ====== PANEL STYLES ====== */
  const asideDesktop =
    "h-screen w-64 overflow-visible border-r border-stone-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.10)] ring-1 ring-stone-100 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-0 dark:shadow-[0_10px_30px_rgba(0,0,0,0.55)]";

  const asideMobile =
    "h-screen w-full max-w-[380px] overflow-hidden border-r border-stone-200 bg-white p-3 shadow-xl ring-1 ring-stone-100 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-0";

  if (variant === "mobile") {
    return (
      <>
        {rankUpgradeOverlay}

        {/* Backdrop */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="sb-backdrop"
              className="fixed inset-0 z-50 bg-black/70 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReduced ? 0 : 0.16 }}
              onClick={onClose}
              aria-hidden
            />
          )}
        </AnimatePresence>

        {/* Sliding sheet */}
        <AnimatePresence>
          {open && (
            <motion.aside
              key="sb-sheet"
              className={`fixed left-0 top-0 z-50 lg:hidden ${asideMobile}`}
              role="dialog"
              aria-modal="true"
              aria-label="Nawigacja"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{
                type: prefersReduced ? "tween" : "spring",
                stiffness: 420,
                damping: 34,
                mass: 0.9,
              }}
            >
              <button
                onClick={onClose}
                aria-label="Zamknij panel"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-stone-50 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>

              {inner}
            </motion.aside>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      {rankUpgradeOverlay}
      <aside
        className={`fixed left-0 top-0 z-40 ${asideDesktop}`}
        aria-label="Główna nawigacja"
      >
        {inner}
      </aside>
    </>
  );
}

/* ========= Rank upgrade overlay (global popup) ========= */
function RankUpgradeOverlay({
  popup,
  onClose,
}: {
  popup: { from: Rank; to: Rank } | null;
  onClose: () => void;
}) {
  if (!popup) return null;
  if (typeof document === "undefined") return null;

  const root =
    document.getElementById(GLOBAL_MODAL_ROOT_ID) ?? document.body;

  const { from, to } = popup;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[121] flex items-center justify-center px-4">
        <div
          className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 ${rankClass(
                  to
                )}`}
              >
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">
                  Gratulacje! Awans rangi
                </div>
                <div className="text-xs text-gray-600 dark:text-neutral-400">
                  Twoje konto zostało podniesione z{" "}
                  <span className="font-semibold">
                    {rankLabel(from)}
                  </span>{" "}
                  do{" "}
                  <span className="font-semibold">
                    {rankLabel(to)}
                  </span>
                  .
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Zamknij"
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 rounded-md bg-stone-50 p-3 text-xs text-gray-700 dark:bg-neutral-900 dark:text-neutral-300">
            <p>
              Ranking rośnie, gdy dodajesz{" "}
              <span className="font-semibold">aktywnych zawodników</span>{" "}
              i kończysz{" "}
              <span className="font-semibold">obserwacje</span>.
            </p>
            <p className="mt-1">
              Aktualny poziom:{" "}
              <span className="font-semibold">
                {rankLabel(to)}
              </span>
              .
            </p>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-stone-100 focus:ring-indigo-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              OK, super
            </button>
          </div>
        </div>
      </div>
    </>,
    root
  );
}

/* ========= Small components ========= */
function NavItem({
  href,
  icon,
  label,
  active,
  badge,
  badgeTitle,
  pending,
  onClickHref,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  badgeTitle?: string;
  pending?: boolean;
  onClickHref?: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition focus:ring-indigo-500 ${
        active
          ? "bg-stone-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
          : "text-gray-700 hover:bg-stone-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }`}
      title={badge && badgeTitle ? `${badgeTitle}: ${badge}` : undefined}
      onClick={() => onClickHref?.(href)}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-md transition-all ${
          active
            ? "w-1 bg-indigo-500"
            : "w-0 bg-transparent group-hover:w-1 group-hover:bg-stone-300 dark:group-hover:bg-neutral-700"
        }`}
      />
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>

      <span className="ml-auto flex items-center gap-1">
        {badge && (
          <span
            className="inline-flex max-w-[6rem] shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[10px] font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-200"
            title={badgeTitle}
          >
            <span className="truncate">{badge}</span>
          </span>
        )}
        {pending && (
          <Loader2 className="h-3 w-3 animate-spin opacity-70" />
        )}
      </span>
    </Link>
  );
}

function SubNavItem({
  href,
  label,
  active,
  pending,
  onClickHref,
}: {
  href: string;
  label: string;
  active?: boolean;
  pending?: boolean;
  onClickHref?: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-[14px] transition focus:ring-indigo-500 ${
        active
          ? "bg-stone-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
          : "text-gray-700 hover:bg-stone-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }`}
      onClick={() => onClickHref?.(href)}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-md ${
          active ? "bg-indigo-500" : "bg-stone-300 dark:bg-neutral-700"
        }`}
      />
      <span className="truncate">{label}</span>
      {pending && (
        <Loader2 className="ml-auto h-3 w-3 animate-spin opacity-70" />
      )}
    </Link>
  );
}
