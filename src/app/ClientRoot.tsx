// src/app/ClientRoot.tsx
"use client";

import React, {
  useEffect,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import AppSidebar from "@/widgets/app-sidebar/AppSidebar";
import PageTransition from "@/shared/ui/PageTransition";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { Menu, ChevronRight, ChevronDown } from "lucide-react";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  motion,
  cubicBezier,
  type Variants,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";

import { AddPlayerIcon, AddObservationIcon } from "@/components/icons";
import { getSupabase } from "@/lib/supabaseClient";

/* ===== Easing & Variants ===== */
const easeOutCustom = cubicBezier(0.2, 0.7, 0.2, 1);

const colVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: easeOutCustom },
  },
};

// ---- helpers (module-scope): available to all components ----
export const titleCaseAll = (input: string) =>
  String(input ?? "")
    .replace(/[-_/]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toLocaleUpperCase() + w.slice(1) : ""))
    .join(" ");

/**
 * Mapa pełnych ścieżek na polskie etykiety breadcrumbów
 * (gdy chcemy mieć pełną kontrolę per URL).
 */
const PATH_LABELS: Record<string, string> = {
  "/": "Strona główna",

  // Zawodnicy
  "/players": "Zawodnicy",
  "/players/new": "Dodaj zawodnika",

  // Obserwacje
  "/observations": "Obserwacje",
  "/observations/new": "Nowa obserwacja",

  // Globalni zawodnicy (admin)
  "/players/global": "Zawodnicy (global)",
  "/players/global/search": "Wyszukaj",

  // Administracja / zarządzanie
  "/admin": "Admin",
  "/admin/manage": "Użytkownicy",
  "/admin/manage/metrics": "Metryki",
  "/admin/manage/ratings": "Oceny",
  "/admin/manage/ranks": "Rangi",
  "/admin/manage/required-fields": "Wymagane",

  // Inne
  "/scouts": "Lista scoutów",
  "/duplicates": "Duplikaty",
  "/settings": "Ustawienia",
  "/settings/navigation": "Nawigacja",
};

/**
 * Mapa pojedynczych segmentów (slugów) na polskie etykiety,
 * gdy nie zdefiniowaliśmy konkretnej pełnej ścieżki.
 */
const SEGMENT_LABELS: Record<string, string> = {
  players: "Zawodnicy",
  observations: "Obserwacje",
  "global-players": "Globalna baza",
  global: "Global",
  search: "Wyszukaj",
  admin: "Admin",
  manage: "Zarządzanie",
  metrics: "Metryki",
  ratings: "Oceny",
  ranks: "Rangi",
  "required-fields": "Wymagane pola",
  scouts: "Lista scoutów",
  duplicates: "Duplikaty",
  settings: "Ustawienia",
  navigation: "Nawigacja",
  new: "Nowy",
  edit: "Edycja",
};

function getCrumbLabel(
  fullPath: string,
  segment: string,
  index: number,
  searchParams: ReadonlyURLSearchParams | null
) {
  if (index === 0) return "Strona główna";

  const segmentKey = segment.toLowerCase();

  // ID w ścieżce (np. /players/1763416879293)
  if (/^\d+$/.test(segment)) {
    if (fullPath.startsWith("/players/")) {
      const playerName =
        searchParams?.get("playerName") || searchParams?.get("n") || "";
      if (playerName.trim().length > 0) {
        return playerName;
      }
      return "Zawodnik";
    }

    if (fullPath.startsWith("/observations/")) {
      const obsLabel =
        searchParams?.get("observationName") ||
        searchParams?.get("title") ||
        "";
      if (obsLabel.trim().length > 0) {
        return obsLabel;
      }
      return "Obserwacja";
    }

    return "Szczegóły";
  }

  // 1) priorytet: konkretna pełna ścieżka
  if (PATH_LABELS[fullPath]) return PATH_LABELS[fullPath];

  // 2) fallback: etykieta po samym segmencie
  if (SEGMENT_LABELS[segmentKey]) return SEGMENT_LABELS[segmentKey];

  // 3) ostateczny fallback: ładne Title Case z oryginalnego segmentu
  return titleCaseAll(segment);
}

/* ===== Simple breadcrumb builder ===== */
type Crumb = { label: string; href: string };

function buildBreadcrumb(
  pathname: string,
  searchParams: ReadonlyURLSearchParams | null
): Crumb[] {
  const parts = pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);

  const items: Crumb[] = [];

  items.push({ label: "Strona główna", href: "/" });

  let acc = "";
  parts.forEach((p, index) => {
    acc += "/" + p;
    const decoded = decodeURIComponent(p);
    const label = getCrumbLabel(acc, decoded, index + 1, searchParams);
    items.push({
      label,
      href: acc,
    });
  });

  return items;
}

/* ===== Header actions context (for top-right bar) ===== */
type HeaderActionsCtx = {
  actions: ReactNode | null;
  setActions: (node: ReactNode | null) => void;
};

const HeaderActionsContext = createContext<HeaderActionsCtx | undefined>(
  undefined
);

export function useHeaderActions() {
  const ctx = useContext(HeaderActionsContext);
  if (!ctx) {
    throw new Error("useHeaderActions must be used within ClientRoot");
  }
  return ctx;
}

/* ===== Shell with Sidebar & Topbar ===== */
function AppShell({
  children,
  onOpenMobile,
  onAddPlayer,
  onAddObservation,
  isAuthed,
  pathname,
  headerActions,
}: {
  children: ReactNode;
  onOpenMobile: () => void;
  onAddPlayer: () => void;
  onAddObservation: () => void;
  isAuthed: boolean;
  pathname: string;
  headerActions?: ReactNode | null;
}) {
  const search = useSearchParams();
  const crumbs = buildBreadcrumb(pathname, search);

  const [breadcrumbsExpanded, setBreadcrumbsExpanded] = useState(false);

  // Scroll-based visibility for small quick-add icon
  const [showHeaderQuickActions, setShowHeaderQuickActions] =
    useState(false);

  useEffect(() => {
    setBreadcrumbsExpanded(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      if (typeof window === "undefined") return;
      setShowHeaderQuickActions(window.scrollY > 80);
    };

    if (typeof window !== "undefined") {
      onScroll(); // initial state
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("scroll", onScroll);
      }
    };
  }, [pathname]);

  const isObsCreateQuery =
    pathname.startsWith("/observations") && search.get("create") === "1";

  const isPlayersRoot = pathname === "/players";
  const isObservationsRoot = pathname === "/observations";

  const isPlayersSubpage =
    pathname.startsWith("/players/") && !isPlayersRoot;
  const isObservationsSubpage =
    pathname.startsWith("/observations/") && !isObservationsRoot;

  const hideHeaderActions =
    isPlayersSubpage || isObservationsSubpage || isObsCreateQuery;

  const currentCrumbLabel =
    crumbs.length > 0
      ? crumbs[crumbs.length - 1]?.label || "Bieżąca strona"
      : "Bieżąca strona";

  return (
    <>
      {/* wrapper dla treści: padding-left pod sidebar + padding-top pod fixed header (także na mobile) */}
      <div className="pl-64 max-lg:pl-0 pt-[64px]">
        <header
          className="fixed top-0 left-0 right-0 z-[40] border-b border-transparent bg-transparent backdrop-blur supports-[backdrop-filter]:bg-transparent dark:bg-transparent"
          role="banner"
        >
          {/* osobny container, żeby header też respektował przestrzeń sidebaru */}
          <div className="relative mx-auto w-full lg:pl-64 max-lg:pl-0">
            {isAuthed && (
              <button
                className="lg:hidden absolute left-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-300/70 p-2 hover:bg-white/60 dark:border-neutral-700/60 dark:hover:bg-neutral-900/60"
                aria-label="Otwórz menu"
                onClick={onOpenMobile}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* BREADCRUMB W HEADERZE */}
            <nav
              aria-label="Breadcrumb"
              className="absolute left-[60px] top-[12px] min-w-0 pr-2 lg:relative lg:left-3 lg:top-[30px] lg:-translate-y-5"
            >
              {/* DESKTOP: pełna ścieżka */}
              <ol className="hidden items-center gap-1 text-sm text-stone-600 dark:text-neutral-300 md:flex">
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  const label = c.label || "Strona główna";

                  return (
                    <li key={c.href} className="flex min-w-0 items-center">
                      {!last ? (
                        <>
                          <Link
                            href={c.href}
                            className="truncate hover:underline normal-case"
                            title={label}
                          >
                            {i === 0 ? (
                              <HomeIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            ) : (
                              <span className="normal-case">{label}</span>
                            )}
                          </Link>
                          <ChevronRight
                            className="mx-1 h-4 w-4 opacity-60"
                            aria-hidden="true"
                          />
                        </>
                      ) : (
                        <span
                          className="truncate font-medium text-stone-900 dark:text-neutral-100 normal-case"
                          title={label}
                        >
                          {label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>

              {/* MOBILE: home + bieżąca strona (truncated) + przycisk rozwinięcia pełnej ścieżki */}
              <div className="flex items-center gap-1 text-sm text-stone-600 dark:text-neutral-300 md:hidden">
                <Link
                  href="/"
                  className="flex items-center"
                  aria-label="Strona główna"
                >
                  <HomeIcon className="h-4 w-4" aria-hidden="true" />
                </Link>
                <ChevronRight
                  className="h-4 w-4 opacity-60"
                  aria-hidden="true"
                />
                <span className="max-w-[150px] truncate font-medium text-stone-900 dark:text-neutral-50">
                  {currentCrumbLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setBreadcrumbsExpanded((prev) => !prev)
                  }
                  className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white/80 text-stone-600 shadow-sm hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  aria-label={
                    breadcrumbsExpanded
                      ? "Ukryj pełną ścieżkę nawigacji"
                      : "Pokaż pełną ścieżkę nawigacji"
                  }
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      breadcrumbsExpanded ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {/* MOBILE: panel z pełnym breadcrumbem pod headerem */}
              {breadcrumbsExpanded && (
                <>
                  {/* klik poza zamyka panel */}
                  <button
                    type="button"
                    className="fixed inset-0 z-[70] cursor-default md:hidden"
                    aria-hidden="true"
                    onClick={() => setBreadcrumbsExpanded(false)}
                  />
                  <div className="absolute left-[0px] top-full z-[71] mt-2 max-w-[90vw] rounded-md border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900 md:hidden">
                    <ol className="flex flex-wrap items-center gap-1 text-stone-700 dark:text-neutral-100">
                      {crumbs.map((c, i) => {
                        const last = i === crumbs.length - 1;
                        const label = c.label || "Strona główna";

                        return (
                          <li
                            key={c.href}
                            className="flex min-w-0 items-center"
                          >
                            {!last ? (
                              <>
                                <Link
                                  href={c.href}
                                  className="truncate hover:underline normal-case"
                                  title={label}
                                  onClick={() =>
                                    setBreadcrumbsExpanded(false)
                                  }
                                >
                                  {i === 0 ? (
                                    <HomeIcon
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <span className="normal-case">
                                      {label}
                                    </span>
                                  )}
                                </Link>
                                <ChevronRight
                                  className="mx-1 h-3.5 w-3.5 opacity-60"
                                  aria-hidden="true"
                                />
                              </>
                            ) : (
                              <span
                                className="truncate font-medium text-stone-900 dark:text-neutral-50 normal-case"
                                title={label}
                              >
                                {label}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </>
              )}
            </nav>

            {/* PASEK AKCJI W PRAWYM GÓRNYM ROGU */}
            <div className="flex items-end mx-auto justify-end w-full max-w-[1400px] py-2 md:py-3 pr-0 md:pr-5 2xl:pr-0">
              {isAuthed ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: easeOutCustom }}
                  className="ml-2 mr-2 md:mr-0 flex shrink-0 items-center gap-2 min-h-[36px]"
                >
                  {headerActions ? (
                    <div className="flex items-center gap-2">
                      {headerActions}
                    </div>
                  ) : hideHeaderActions ? (
                    <div className="min-h-[36px]" />
                  ) : isObservationsRoot ? (
                    // Na "Obserwacje": tekstowy przycisk Zawodnicy → zawsze widoczny
                    // + po scrollu mały przycisk Dodaj obserwację (ikona)
                    <div className="flex items-center gap-2">
                      <AnimatePresence>
                        {showHeaderQuickActions && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.9 }}
                            transition={{
                              duration: 0.22,
                              ease: easeOutCustom,
                            }}
                          >
                            <Button
                              size="icon"
                              className="h-9 w-9 secondary rounded-md bg-gray-900 text-white hover:bg-gray-800"
                              aria-label="Dodaj obserwację"
                              title="Dodaj obserwację"
                              onClick={onAddObservation}
                            >
                              <AddObservationIcon className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <Button
                        asChild
                        variant="outline"
                        className="h-9 rounded-md border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
                        aria-label="Zawodnicy"
                      >
                        <Link href="/players">Zawodnicy →</Link>
                      </Button>
                    </div>
                  ) : isPlayersRoot ? (
                    // Na "Zawodnicy": tekstowy przycisk Obserwacje → zawsze widoczny
                    // + po scrollu mały przycisk Dodaj zawodnika (ikona)
                    <div className="flex items-center gap-2">
                      <AnimatePresence>
                        {showHeaderQuickActions && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.9 }}
                            transition={{
                              duration: 0.22,
                              ease: easeOutCustom,
                            }}
                          >
                            <Button
                              size="icon"
                              className="h-9 w-9 primary rounded-md bg-gray-900 text-white hover:bg-gray-800"
                              aria-label="Dodaj zawodnika"
                              title="Dodaj zawodnika"
                              onClick={onAddPlayer}
                            >
                              <AddPlayerIcon className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <Button
                        asChild
                        variant="outline"
                        className="h-9 rounded-md border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-800"
                        aria-label="Obserwacje"
                      >
                        <Link href="/observations">Obserwacje →</Link>
                      </Button>
                    </div>
                  ) : (
                    // Inne widoki: oryginalne przyciski "Dodaj"
                    <>
                      <div className="flex items-center gap-2 md:hidden">
                        <Button
                          className="h-9 w-9 primary rounded-md bg-gray-900 text-white hover:bg-gray-800"
                          aria-label="Dodaj zawodnika"
                          onClick={onAddPlayer}
                          title="Dodaj zawodnika"
                        >
                          <AddPlayerIcon className="h-4 w-4 text-white" />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-md border border-stone-300 dark:border-neutral-700"
                          aria-label="Dodaj obserwację"
                          onClick={onAddObservation}
                          title="Dodaj obserwację"
                        >
                          <AddObservationIcon className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="hidden items-center gap-2 md:flex">
                        <Button
                          onClick={onAddPlayer}
                          className="h-9 rounded-md bg-gray-900 text-white hover:bg-gray-800 primary"
                          aria-label="Dodaj zawodnika"
                        >
                          <AddPlayerIcon className="mr-2 h-4 w-4" />
                          Dodaj zawodnika
                        </Button>
                        <Button
                          onClick={onAddObservation}
                          variant="outline"
                          className="h-9 rounded-md border-none dark:border-neutral-700 secondary"
                          aria-label="Dodaj obserwację"
                        >
                          <AddObservationIcon className="mr-2 h-4 w-4" />
                          Dodaj obserwację
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              ) : (
                <div className="min-h-[36px]" />
              )}
            </div>
          </div>
        </header>

        <main
          id="content"
          className="min-h-screen px-3 py-4 md:px-6 md:py-6"
        >
          <PageTransition>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: easeOutCustom }}
              className="mx-auto w-full max-w-[1400px] rounded-md bg-transparent p-0 shadow-none min-h-screen"
            >
              {children}
            </motion.div>
          </PageTransition>
        </main>

        <footer
          className="mx-auto w-full max-w-[1400px] pb-6 pt-2 text-xs text-dark dark:text-neutral-400 md:pb-8 px-3"
          role="contentinfo"
        >
          © {new Date().getFullYear()} entrisoScouting
        </footer>
      </div>
      <div id="portal-root" />
    </>
  );
}

/* ===== ClientRoot ===== */
export default function ClientRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);

  const [headerActions, setHeaderActions] = useState<ReactNode | null>(
    null
  );

  // ===== LAST ACTIVE TRACKER (Supabase) =====
  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    const touch = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user || cancelled) return;

        await supabase.rpc("touch_profile_last_active");
      } catch (e) {
        console.error("Failed to update last_active:", e);
      }
    };

    // na starcie – jeśli jest sesja, zaktualizuj last_active
    touch();

    // reaguj na zmiany auth (login / logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      supabase.rpc("touch_profile_last_active");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (prefersReduced) return;
    setRouteLoading(true);
    const t = setTimeout(() => setRouteLoading(false), 260);
    return () => clearTimeout(t);
  }, [pathname, prefersReduced]);

  useEffect(() => {
    setHeaderActions(null);
  }, [pathname]);

  const handleAddPlayer = () => router.push("/players/new");
  const handleAddObservation = () =>
    router.push("/observations?create=1");

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
    >
      <div
        className={`fixed inset-x-0 top-0 z-[60] h-0.5 bg-indigo-500 transition-opacity ${
          routeLoading ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />

      <AppSidebar
        variant="mobile"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      <HeaderActionsContext.Provider
        value={{ actions: headerActions, setActions: setHeaderActions }}
      >
        <AppShell
          onOpenMobile={() => setMobileOpen(true)}
          onAddPlayer={handleAddPlayer}
          onAddObservation={handleAddObservation}
          isAuthed={true}
          pathname={pathname || "/"}
          headerActions={headerActions}
        >
          {children}
        </AppShell>
      </HeaderActionsContext.Provider>
    </ThemeProvider>
  );
}
