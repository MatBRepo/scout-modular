"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Users, NotebookPen, Sun, Moon, Globe,
  Settings, Map, Trophy, RefreshCw, ChevronDown,
  TrendingUp, TriangleAlert, LogOut, X
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { MyPlayersIconDefault } from "@/components/icons";

/* ========= Types & keys ========= */
type Role = "admin" | "scout" | "scout-agent";
type Rank = "bronze" | "silver" | "gold" | "platinum";
type SidebarVariant = "desktop" | "mobile";

const AUTH_KEY = "s4s.auth";
const ROLE_KEY = "s4s.role";

/* ========= Rank helpers ========= */
const RANK_THRESHOLDS: Record<Rank, number> = { bronze: 0, silver: 20, gold: 50, platinum: 100 };
const calcScore = (players: number, observations: number) => players * 2 + observations;
function calcRank(players: number, observations: number) {
  const score = calcScore(players, observations);
  if (score >= RANK_THRESHOLDS.platinum) return { rank: "platinum" as Rank, score };
  if (score >= RANK_THRESHOLDS.gold) return { rank: "gold" as Rank, score };
  if (score >= RANK_THRESHOLDS.silver) return { rank: "silver" as Rank, score };
  return { rank: "bronze" as Rank, score };
}
function nextRankInfo(rank: Rank, score: number) {
  const order: Rank[] = ["bronze", "silver", "gold", "platinum"];
  const idx = order.indexOf(rank);
  const next = order[idx + 1] ?? "platinum";
  const currentMin = RANK_THRESHOLDS[rank];
  const nextMin = RANK_THRESHOLDS[next];
  const span = Math.max(1, nextMin - currentMin);
  const progressed = Math.max(0, score - currentMin);
  const pct = Math.min(100, Math.round((progressed / span) * 100));
  const remaining = Math.max(0, nextMin - score);
  return { next, pct, remaining };
}
const rankLabel = (r: Rank) =>
  r === "platinum" ? "Platinum" : r === "gold" ? "Gold" : r === "silver" ? "Silver" : "Bronze";
function rankClass(r: Rank) {
  switch (r) {
    case "platinum": return "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-800/70";
    case "gold": return "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/70";
    case "silver": return "bg-stone-100 text-slate-800 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:ring-slate-700/70";
    default: return "bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:ring-orange-800/70";
  }
}
function rankTrophyColor(r: Rank) {
  switch (r) {
    case "platinum": return "text-indigo-500";
    case "gold": return "text-amber-500";
    case "silver": return "text-slate-400";
    default: return "text-orange-500";
  }
}
const formatNum = (n: number) => new Intl.NumberFormat("pl-PL").format(n);

/* ========= Helpers ========= */
const parseRole = (v: any): Role =>
  v === "admin" || v === "scout" || v === "scout-agent" ? v : "scout";

const readAuthed = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.ok);
  } catch {
    return false;
  }
};

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
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => setMounted(true), []);

  // auth + role
  const [role, setRole] = useState<Role>("scout");
  const syncAuth = () => setIsAuthed(readAuthed());
  const pullRole = () => {
    try {
      const r = parseRole(localStorage.getItem(ROLE_KEY));
      setRole(r);
    } catch {}
  };

  useEffect(() => {
    if (!mounted) return;
    syncAuth();
    pullRole();
  }, [mounted]);

  // react to storage/custom events
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_KEY) syncAuth();
      if (e.key === ROLE_KEY) pullRole();
    };
    const onAuth = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsAuthed(Boolean(detail?.ok));
    };
    const onCustomRole = (e: Event) => {
      const detail = (e as CustomEvent).detail as Role | null;
      if (detail) setRole(detail); else pullRole();
    };
    const onFocus = () => { syncAuth(); pullRole(); };
    const onVis = () => { if (document.visibilityState === "visible") { syncAuth(); pullRole(); } };

    window.addEventListener("storage", onStorage);
    window.addEventListener("s4s:auth", onAuth as EventListener);
    window.addEventListener("s4s:role", onCustomRole as EventListener);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("s4s:auth", onAuth as EventListener);
      window.removeEventListener("s4s:role", onCustomRole as EventListener);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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

  /* ===== Counters & rank ===== */
  const [playersCount, setPlayersCount] = useState(0);
  const [obsCount, setObsCount] = useState(0);
  const { rank, score } = calcRank(playersCount, obsCount);
  const { next, pct, remaining } = nextRankInfo(rank, score);

  const readCounts = () => {
    try {
      const pRaw = localStorage.getItem("s4s.players");
      const oRaw = localStorage.getItem("s4s.observations");
      const pArr = pRaw ? JSON.parse(pRaw) : [];
      const oArr = oRaw ? JSON.parse(oRaw) : [];
      setPlayersCount(Array.isArray(pArr) ? pArr.filter((p: any) => p?.status === "active").length : 0);
      setObsCount(Array.isArray(oArr) ? oArr.length : 0);
    } catch {
      setPlayersCount(0); setObsCount(0);
    }
  };
  useEffect(() => {
    if (!mounted || !isAuthed) return;
    readCounts();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "s4s.players" || e.key === "s4s.observations") readCounts();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mounted, isAuthed]);

  /* ===== Shortcuts ===== */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag && /INPUT|TEXTAREA|SELECT/i.test(tag)) return;
      if (e.key.toLowerCase() === "t") setTheme(theme === "dark" ? "light" : "dark");
      if (e.key.toLowerCase() === "g") router.push("/players/global/search");
      if (e.key.toLowerCase() === "o") router.push("/observations");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theme, setTheme, router]);

  /* ===== Active flags ===== */
  const isGlobalSection = pathname?.startsWith("/players/global");
  const isPlayersSection = pathname?.startsWith("/players") && !isGlobalSection;
  const globalBaseActive = isGlobalSection && (pathname === "/players/global" || pathname === "/players/global/");
  const globalSearchActive = isGlobalSection && pathname?.startsWith("/players/global/search");
  const playersBadge = mounted && isAuthed && playersCount > 0 ? String(playersCount) : undefined;
  const obsBadge = mounted && isAuthed && obsCount > 0 ? String(obsCount) : undefined;

  /* ===== Logout ===== */
  function handleLogout() {
    try {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(ROLE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: AUTH_KEY }));
      window.dispatchEvent(new StorageEvent("storage", { key: ROLE_KEY }));
      window.dispatchEvent(new CustomEvent("s4s:auth", { detail: { ok: false } }));
      window.dispatchEvent(new CustomEvent("s4s:role", { detail: null }));
    } finally {
      window.location.href = "/";
    }
  }

  /* ===== Early return ===== */
  const hidden = !mounted || !isAuthed;
  if (hidden) return null;

  /* ===== Role switcher ===== */
  function setRoleAndClose(v: Role) {
    try {
      localStorage.setItem(ROLE_KEY, v);
      window.dispatchEvent(new StorageEvent("storage", { key: ROLE_KEY, newValue: v }));
      window.dispatchEvent(new CustomEvent("s4s:role", { detail: v }));
    } catch {}
    setRole(v);
    setAccountOpen(false);
    onClose?.();
  }

  /* ===== Components ===== */
  const InnerNav = () => (
    <nav className="space-y-1 text-sm" onClick={() => onClose?.()}>
      {(role === "scout" || role === "scout-agent" || role === "admin") && (
        <div className="mt-1">
          <div className="pb-1 text-[11px] font-semibold tracking-wide text-gray-800 dark:text-neutral-400">
            Zawodnicy
          </div>

          {/* Simplified: plain link, no dropdown, no chevron */}
          <NavItem
            href="/players"
            icon={<MyPlayersIconDefault />}
            label="Moi zawodnicy"
            active={isPlayersSection}
            badge={playersBadge}
            badgeTitle="Aktywni zawodnicy"
          />
        </div>
      )}

      <NavItem
        href="/observations"
        icon={<NotebookPen className="h-4 w-4" />}
        label="Obserwacje"
        active={pathname === "/observations" || pathname?.startsWith("/observations/")}
        badge={obsBadge}
        badgeTitle="Liczba obserwacji"
      />

      {role === "admin" && (
        <>
          {/* ===== Better highlighted ADMIN section ===== */}
          <div className="mt-4 rounded border border-slate-200 bg-stone-50/70 p-2.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-semibold ring-1 ring-slate-200 dark:bg-neutral-950 dark:ring-neutral-800">
                <Settings className="h-3.5 w-3.5" />
                Administracja
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-indigo-300/50 to-transparent dark:from-indigo-700/30" />
            </div>

            <div className="space-y-0.5">
              <div>
                <NavItem
                  href="/players/global"
                  icon={<Globe className="h-4 w-4" />}
                  label="Zawodnicy (global)"
                  active={isGlobalSection}
                />
                <div className="mt-0.5 space-y-0.5 pl-9">
                  <SubNavItem href="/players/global"        label="Globalna baza" active={globalBaseActive} />
                  <SubNavItem href="/players/global/search" label="Wyszukaj"      active={globalSearchActive} />
                </div>
              </div>

              <NavItem
                href="/admin/manage"
                icon={<Settings className="h-4 w-4" />}
                label="Zarządzanie"
                active={pathname?.startsWith("/admin/manage")}
              />

              <NavItem
                href="/scouts"
                icon={<Users className="h-4 w-4" />}
                label="Lista scoutów"
                active={pathname === "/scouts" || pathname?.startsWith("/scouts/")}
              />

              <NavItem
                href="/duplicates"
                icon={<TriangleAlert className="h-4 w-4" />}
                label="Duplikaty"
                active={pathname === "/duplicates"}
              />
            </div>
          </div>
        </>
      )}
    </nav>
  );

  /* ===== Brand: Flat, rounded, no gradient ===== */
  function BrandMark({ showName }: { showName: boolean }) {
    return (
      <a href="/" className="group flex items-center gap-2" aria-label="entrisoScouting - Start">
        <div className="grid h-8 w-8 place-items-center rounded bg-gray-900 text-white dark:bg-white dark:text-neutral-900">
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between">
        <Link
          href="/"
          className="flex gap-2 rounded font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 place-items-center"
          title="Wróć na kokpit"
          onClick={onClose}
        >
          <BrandMark showName={!isAuthed} /> S4S
        </Link>
      </div>

      {/* Nav (role-grouped) */}
      <InnerNav />

      {/* Sticky bottom (account + theme + rank) */}
      <div className="sticky bottom-0 -mx-3 mt-6 border-t border-gray-200 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/90">
        <div ref={accountRef} className="relative">
          <button
            onClick={() => setAccountOpen(v => !v)}
            className="flex w-full items-center justify-between rounded py-2 text-sm text-gray-800 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-neutral-100 dark:hover:bg-neutral-900"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
          >
            <span className="flex items-center gap-1 text-xs opacity-70">
              {labelForRole(role)}
            </span>
            <motion.span
              aria-hidden
              animate={{ rotate: accountOpen ? 180 : 0 }}
              transition={{ duration: prefersReduced ? 0 : 0.16, ease: [0.2, 0.7, 0.2, 1] }}
              className="inline-flex"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {accountOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: prefersReduced ? 0 : 0.14, ease: "easeOut" }}
                className="absolute bottom-12 left-0 right-0 z-40 w-auto max-w-full overflow-x-hidden rounded border border-gray-200 bg-white p-2 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
              >
                {/* START rank quick card */}
                {role === "scout" && (
                  <div className="mx-1 mb-2 rounded bg-stone-100 p-3 text-xs ring-1 ring-gray-200 dark:bg-neutral-900 dark:ring-neutral-800">
                    <div className="mb-1 flex flex-wrap items-center justify-between">
                      <span className="font-semibold whitespace-normal break-words">Twój poziom</span>
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ring-1 ${rankClass(rank)}`}>
                        <Trophy className="h-3.5 w-3.5" />
                        {rankLabel(rank)}
                      </span>
                    </div>

                    <div className="mt-1">
                      <div className="mb-1 flex flex-wrap items-center justify-between whitespace-normal break-words">
                        <span className="opacity-70">Postęp do {rankLabel(next as Rank)}</span>
                        <span className="opacity-70">{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded bg-gray-200 dark:bg-neutral-800">
                        <div className="h-2 rounded bg-indigo-500 transition-[width]" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-[10px] opacity-70 whitespace-normal break-words">
                        Brakuje {remaining} pkt (np. {Math.ceil(remaining / 2)} aktywnych zawodników lub {remaining} obserwacji).
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                      <div className="rounded p-2">
                        <div className="opacity-60">Zawodnicy</div>
                        <div className="text-sm font-semibold">{formatNum(playersCount)}</div>
                      </div>
                      <div className="rounded p-2">
                        <div className="opacity-60">Obserwacje</div>
                        <div className="text-sm font-semibold">{formatNum(obsCount)}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-[11px] transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-neutral-700 dark:hover:bg-neutral-800"
                        onClick={readCounts}
                        title="Odśwież liczniki (LocalStorage)"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Odśwież
                      </button>
                    </div>
                  </div>
                )}
                {/* END rank quick card */}

                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-neutral-400">
                  Szybkie akcje
                </div>
                <Link role="menuitem" className="flex flex-wrap items-center gap-2 rounded px-2 py-2 text-sm hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-neutral-900" href="/settings" onClick={onClose}>
                  <Settings className="h-4 w-4" /> Ustawienia
                </Link>
                <Link role="menuitem" className="flex flex-wrap items-center gap-2 rounded px-2 py-2 text-sm hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-neutral-900" href="/settings/navigation" onClick={onClose}>
                  <Map className="h-4 w-4" /> Nawigacja
                </Link>

                <div className="my-2 h-px bg-gray-200 dark:bg-neutral-800" />

                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-800 dark:text-neutral-400">
                  Rola
                </div>
                <RoleOption current={role} value="admin"       label="Admin"       onChange={setRoleAndClose} />
                <RoleOption current={role} value="scout-agent" label="Scout Agent" onChange={setRoleAndClose} />
                <RoleOption current={role} value="scout"       label="Scout"       onChange={setRoleAndClose} />

                <div className="my-2 h-px bg-gray-200 dark:bg-neutral-800" />

                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 dark:text-red-400 dark:hover:bg-red-900/20"
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
                className="hidden min-w-0 shrink items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 sm:flex dark:border-neutral-800 dark:text-neutral-300"
                title={`Aktywni: ${playersCount} • Obserwacje: ${obsCount} • Score: ${score}`}
              >
                <TrendingUp className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{formatNum(playersCount)} / {formatNum(obsCount)}</span>
              </div>
              <button
                className="rounded border border-gray-300 p-1.5 text-xs transition hover:bg-stone-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-neutral-700 dark:hover:bg-neutral-900"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Przełącz motyw (T)"
                title="Przełącz motyw (T)"
              >
                {theme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ====== PANEL STYLES (shadcn-ish) ====== */
  const asideDesktop =
    "h-screen w-64 overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-0";

  const asideMobile =
    "h-screen w-[75vw] max-w-[380px] overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white p-3 shadow-xl ring-1 ring-slate-100 dark:border-neutral-800 dark:bg-neutral-950 dark:ring-0";

  if (variant === "mobile") {
    return (
      <>
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
              transition={{ type: prefersReduced ? "tween" : "spring", stiffness: 420, damping: 34, mass: 0.9 }}
            >
              {/* Close ("X") */}
              <button
                onClick={onClose}
                aria-label="Zamknij panel"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
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
    <aside className={`fixed left-0 top-0 z-40 ${asideDesktop}`} aria-label="Główna nawigacja">
      {inner}
    </aside>
  );
}

/* ========= Small components ========= */
function NavItem({
  href, icon, label, active, badge, badgeTitle,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  badgeTitle?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-w-0 items-center gap-2 rounded px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        active
          ? "bg-stone-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
          : "text-gray-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }`}
      title={badge && badgeTitle ? `${badgeTitle}: ${badge}` : undefined}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-sm transition-all ${
          active
            ? "w-1 bg-indigo-500"
            : "w-0 bg-transparent group-hover:w-1 group-hover:bg-slate-300 dark:group-hover:bg-neutral-700"
        }`}
      />
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className="ml-auto inline-flex max-w-[6rem] shrink-0 items-center rounded bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
          title={badgeTitle}
        >
          <span className="truncate">{badge}</span>
        </span>
      )}
    </Link>
  );
}

function SubNavItem({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-0 items-center gap-2 rounded px-3 py-1.5 text-[14px] transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        active ? "bg-stone-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
               : "text-gray-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded ${active ? "bg-indigo-500" : "bg-slate-300 dark:bg-neutral-700"}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function RoleOption({
  current, value, label, onChange,
}: {
  current: Role;
  value: Role;
  label: string;
  onChange: (v: Role) => void;
}) {
  const selected = current === value;
  return (
    <button
      role="menuitemradio"
      aria-checked={selected}
      onClick={() => onChange(value)}
      className={`mb-1 flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-neutral-900 ${
        selected ? "bg-stone-100 dark:bg-neutral-900" : ""
      }`}
    >
      <span className="whitespace-normal break-words">{label}</span>
      <span className={`h-2.5 w-2.5 rounded ${selected ? "bg-gray-900 dark:bg-neutral-200" : "border border-gray-300 dark:border-neutral-700"}`} />
    </button>
  );
}

function labelForRole(r: Role) {
  if (r === "admin") return "Admin";
  if (r === "scout-agent") return "Scout Agent";
  return "Scout";
}
