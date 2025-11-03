// src/widgets/app-sidebar/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Users, NotebookPen, Home, Sun, Moon, Globe, Shield,
  Settings, Map, Trophy, RefreshCw, ChevronDown, ChevronUp,
  Info, TrendingUp, TriangleAlert, LogOut
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

type Role = "admin" | "scout" | "scout-agent";
type Rank = "bronze" | "silver" | "gold" | "platinum";
type SidebarVariant = "desktop" | "mobile";

const AUTH_KEY = "s4s.auth";
const ROLE_KEY = "s4s.role";

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
const rankLabel = (r: Rank) => (r === "platinum" ? "Platinum" : r === "gold" ? "Gold" : r === "silver" ? "Silver" : "Bronze");
function rankClass(r: Rank) {
  switch (r) {
    case "platinum": return "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-800/70";
    case "gold": return "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800/70";
    case "silver": return "bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:ring-slate-700/70";
    default: return "bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:ring-orange-800/70";
  }
}
// Trophy icon color (stroke/currentColor) by rank
function rankTrophyColor(r: Rank) {
  switch (r) {
    case "platinum": return "text-indigo-500";
    case "gold": return "text-amber-500";
    case "silver": return "text-slate-400";
    default: return "text-orange-500";
  }
}
const formatNum = (n: number) => new Intl.NumberFormat("pl-PL").format(n);

// helpers
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
      if (detail) setRole(detail);
      else pullRole();
    };
    const onFocus = () => {
      syncAuth();
      pullRole();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        syncAuth();
        pullRole();
      }
    };

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

  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // counters
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

  // close popover outside & on route change
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!accountRef.current) return;
      if (!accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  useEffect(() => setAccountOpen(false), [pathname]);

  // shortcuts
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

  // active flags
  const isGlobalSection = pathname?.startsWith("/players/global");
  const isPlayersSection = pathname?.startsWith("/players") && !isGlobalSection;
  const tab = searchParams?.get("tab") ?? null;
  const knownActive = isPlayersSection && (tab === "known" || tab === null);
  const unknownActive = isPlayersSection && tab === "unknown";
  const globalBaseActive = isGlobalSection && (pathname === "/players/global" || pathname === "/players/global/");
  const globalSearchActive = isGlobalSection && pathname?.startsWith("/players/global/search");
  const playersBadge = mounted && isAuthed && playersCount > 0 ? String(playersCount) : undefined;
  const obsBadge = mounted && isAuthed && obsCount > 0 ? String(obsCount) : undefined;

  // accordion: "Moi zawodnicy"
  const [playersOpen, setPlayersOpen] = useState(false);
  useEffect(() => {
    setPlayersOpen(Boolean(isPlayersSection));
  }, [isPlayersSection]);

  // role switcher
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

  // logout
  function handleLogout() {
    try {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(ROLE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: AUTH_KEY }));
      window.dispatchEvent(new StorageEvent("storage", { key: ROLE_KEY }));
      window.dispatchEvent(new CustomEvent("s4s:auth", { detail: { ok: false } }));
      window.dispatchEvent(new CustomEvent("s4s:role", { detail: null }));
    } finally {
      window.location.href = "/"; // Auth gate appears
    }
  }

  // ===== Hide the whole sidebar if user is NOT logged in =====
  if (!mounted || !isAuthed) {
    if (variant === "mobile") return null;
    return null;
  }

  // ===== Role-grouped nav =====
  const InnerNav = () => (
    <nav className="space-y-1 text-sm" onClick={() => onClose?.()}>
      {/* COMMON */}
      {/* <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
        Główne
      </div> */}

      {/* <NavItem
        href="/"
        icon={<Home className="h-4 w-4" />}
        label="Kokpit"
        active={pathname === "/" || pathname?.startsWith("/dashboard")}
      /> */}

      {/* --- ORDER CHANGED: Players FIRST --- */}
      {(role === "scout" || role === "scout-agent" || role === "admin") && (
        <div className="mt-1">
          <div className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            Zawodnicy
          </div>

          <AccordionNav
            href="/players"
            icon={<Users className="h-4 w-4" />}
            label="Moi zawodnicy"
            active={isPlayersSection}
            open={playersOpen}
            onToggle={() => setPlayersOpen(o => !o)}
            badge={playersBadge}
            badgeTitle="Aktywni zawodnicy"
          >
            <div className="mt-1 space-y-1 pl-9">
              <SubNavItem href="/players?tab=known"   label="Znani zawodnicy"    active={knownActive} />
              <SubNavItem href="/players?tab=unknown" label="Nieznani zawodnicy" active={unknownActive} />
            </div>
          </AccordionNav>
        </div>
      )}

      {/* Observations now AFTER players */}
      <NavItem
        href="/observations"
        icon={<NotebookPen className="h-4 w-4" />}
        label="Obserwacje"
        active={pathname === "/observations" || pathname?.startsWith("/observations/")}
        badge={obsBadge}
        badgeTitle="Liczba obserwacji"
      />

      {/* ADMIN */}
      {role === "admin" && (
        <>
          <SectionHeader label="Administracja" />

          <div className="rounded-lg bg-slate-100 p-2.5 dark:bg-neutral-900/40">
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

  const inner = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between">
        <Link
          href="/"
          className="rounded font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title="Wróć na kokpit"
          onClick={onClose}
        >
          S4S
        </Link>
      </div>

      {/* Nav (role-grouped) */}
      <InnerNav />

      <div className="mt-6 border-t border-gray-200 dark:border-neutral-800" />
      <div className="mt-auto" />

      {/* Account */}
      <div ref={accountRef} className="relative">
        <button
          onClick={() => setAccountOpen(v => !v)}
          className="flex w-full items-center justify-between rounded-md  py-2 text-sm text-gray-800 transition hover:bg-gray-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
          aria-haspopup="menu"
          aria-expanded={accountOpen}
        >
          {/* Left: ONLY TROPHY (colored by rank) */}
          {/* <span className="flex min-w-0 items-center gap-2">
            <Trophy className={`h-4 w-4 shrink-0 ${rankTrophyColor(rank)}`} />
          </span> */}

          {/* Right: role label + chevron */}
          <span className="flex items-center gap-1 text-xs opacity-70">
            {labelForRole(role)}
            {accountOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {accountOpen && (
          <div
            role="menu"
            className="absolute bottom-12 left-2 right-2 z-40 w-auto max-w-full overflow-x-hidden rounded-md border border-gray-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 dark:border-neutral-800 dark:bg-neutral-950"
          >
            {role === "scout" && (
              <div className="mx-1 mb-2 rounded-md bg-gray-50 p-3 text-xs dark:bg-neutral-900">
                <div className="mb-1 flex flex-wrap items-center justify-between">
                  <span className="font-semibold whitespace-normal break-words">Twój poziom</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${rankClass(rank)}`}>
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
                  <div className="rounded-md border border-gray-200 p-2 dark:border-neutral-800">
                    <div className="opacity-60">Zawodnicy</div>
                    <div className="text-sm font-semibold">{formatNum(playersCount)}</div>
                  </div>
                  <div className="rounded-md border border-gray-200 p-2 dark:border-neutral-800">
                    <div className="opacity-60">Obserwacje</div>
                    <div className="text-sm font-semibold">{formatNum(obsCount)}</div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] transition hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    onClick={readCounts}
                    title="Odśwież liczniki (LocalStorage)"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Odśwież
                  </button>
                  <div className="inline-flex items-center gap-1 text-[10px] opacity-70 whitespace-normal break-words">
                    <Info className="h-3.5 w-3.5" />
                    Skróty: T=motyw, G=global, O=obserwacje
                  </div>
                </div>
              </div>
            )}

            <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
              Szybkie akcje
            </div>
            <Link role="menuitem" className="flex flex-wrap items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-900" href="/settings" onClick={onClose}>
              <Settings className="h-4 w-4" /> Ustawienia
            </Link>
            <Link role="menuitem" className="flex flex-wrap items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-900" href="/settings/navigation" onClick={onClose}>
              <Map className="h-4 w-4" /> Nawigacja
            </Link>

            <div className="my-2 h-px bg-gray-200 dark:bg-neutral-800" />

            <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
              Rola
            </div>
            <RoleOption current={role} value="admin"       label="Admin"        onChange={setRoleAndClose} />
            <RoleOption current={role} value="scout-agent" label="Scout Agent"  onChange={setRoleAndClose} />
            <RoleOption current={role} value="scout"       label="Scout"        onChange={setRoleAndClose} />

            <div className="my-2 h-px bg-gray-200 dark:bg-neutral-800" />

            <button
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              title="Wyloguj się"
            >
              <LogOut className="h-4 w-4" />
              Wyloguj
            </button>
          </div>
        )}

        {/* === FOOTER under Konto: rank badge + stats chip + theme toggle === */}
              <div className="mt-2 border-t border-gray-200 dark:border-neutral-800" />

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className={`h-3.5 w-3.5 ${rankTrophyColor(rank)}`} />
            {/* <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${rankClass(rank)}`}>
              {rankLabel(rank)}
            </span> */}
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="hidden min-w-0 shrink items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-700 sm:flex dark:border-neutral-800 dark:text-neutral-300"
              title={`Aktywni: ${playersCount} • Obserwacje: ${obsCount} • Score: ${score}`}
            >
              <TrendingUp className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate">{formatNum(playersCount)} / {formatNum(obsCount)}</span>
            </div>
            <button
              className="rounded border border-gray-300 p-1.5 text-xs transition hover:bg-gray-50 active:scale-[0.98] dark:border-neutral-700 dark:hover:bg-neutral-900"
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
  );

  const asideCore =
    "h-screen w-64 overflow-y-auto overflow-x-hidden border-r border-gray-200 bg-white/90 p-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80";

  if (variant === "mobile") {
    return (
      <>
        <div
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={onClose}
          aria-hidden={!open}
        />
        <aside
          className={`fixed left-0 top-0 z-50 transition-transform lg:hidden ${asideCore} ${open ? "translate-x-0" : "-translate-x-full"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Nawigacja"
        >
          {inner}
        </aside>
      </>
    );
  }

  return (
    <aside className={`fixed left-0 top-0 z-40 ${asideCore}`} aria-label="Główna nawigacja">
      {inner}
    </aside>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mt-4 mb-1 flex items-center gap-2 px-2">
      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-neutral-700" />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-200/70 dark:bg-neutral-800/70" />
    </div>
  );
}

/* Small components */
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
      className={`group relative flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
        active ? "bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
               : "text-gray-700 hover:bg-gray-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }`}
      title={badge && badgeTitle ? `${badgeTitle}: ${badge}` : undefined}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-sm transition-all ${
          active ? "w-1 bg-indigo-500"
                 : "w-0 bg-transparent group-hover:w-1 group-hover:bg-gray-300 dark:group-hover:bg-neutral-700"
        }`}
      />
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex max-w-[6rem] shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
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
      className={`flex flex-wrap items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition ${
        active ? "bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
               : "text-gray-600 hover:bg-gray-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${active ? "bg-indigo-500" : "bg-gray-300 dark:bg-neutral-700"}`} />
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
      className={`mb-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-900 ${
        selected ? "bg-gray-100 dark:bg-neutral-900" : ""
      }`}
    >
      <span className="whitespace-normal break-words">{label}</span>
      <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-gray-900 dark:bg-neutral-200" : "border border-gray-300 dark:border-neutral-700"}`} />
    </button>
  );
}

function labelForRole(r: Role) {
  if (r === "admin") return "Admin";
  if (r === "scout-agent") return "Scout Agent";
  return "Scout";
}

function AccordionNav({
  href,
  icon,
  label,
  active,
  open,
  onToggle,
  badge,
  badgeTitle,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  badgeTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-stretch gap-1">
        {/* main link behaves like NavItem */}
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={`group relative flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
            active
              ? "bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
              : "text-gray-700 hover:bg-gray-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
          }`}
          title={badge && badgeTitle ? `${badgeTitle}: ${badge}` : undefined}
        >
          <span
            aria-hidden
            className={`absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-sm transition-all ${
              active
                ? "w-1 bg-indigo-500"
                : "w-0 bg-transparent group-hover:w-1 group-hover:bg-gray-300 dark:group-hover:bg-neutral-700"
            }`}
          />
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
          {badge && (
            <span className="ml-auto inline-flex max-w-[6rem] shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
              <span className="truncate">{badge}</span>
            </span>
          )}
        </Link>

        {/* chevron toggler (does NOT navigate) */}
        <button
          type="button"
          aria-label={open ? "Zwiń sekcję Moi zawodnicy" : "Rozwiń sekcję Moi zawodnicy"}
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          className={`rounded-md px-2 text-xs transition ${
            open
              ? "bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
              : "text-gray-700 hover:bg-gray-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
          }`}
          title={open ? "Zwiń" : "Rozwiń"}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* panel */}
      {open && <div>{children}</div>}
    </div>
  );
}
