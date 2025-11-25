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
import { Menu, ChevronRight } from "lucide-react";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  motion,
  cubicBezier,
  type Variants,
  useReducedMotion,
} from "framer-motion";

import { AddPlayerIcon, AddObservationIcon } from "@/components/icons";

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
type Crumb = { label: string; href: string; isEllipsis?: boolean };

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

  useEffect(() => {
    setBreadcrumbsExpanded(false);
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

  const totalCrumbs = crumbs.length;
  const shouldCollapse = totalCrumbs > 2 && !breadcrumbsExpanded;

  let displayedCrumbs: Crumb[] = crumbs;

  if (shouldCollapse) {
    displayedCrumbs = [
      crumbs[0],
      { label: "[...]", href: "#", isEllipsis: true },
      crumbs[totalCrumbs - 1],
    ];
  }

  // Crumbs that are hidden inside the tooltip (middle path)
  const hiddenCrumbs =
    totalCrumbs > 2 ? crumbs.slice(1, totalCrumbs - 1) : [];

  return (
    <>
      <div className="pl-64 max-lg:pl-0">
        <header
          className="sticky top-0 z-40 border-b border-transparent bg-transparent backdrop-blur supports-[backdrop-filter]:bg-transparent dark:bg-transparent"
          role="banner"
        >
          <div className="relative mx-auto w-full">
            {isAuthed && (
              <button
                className="lg:hidden absolute left-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-300/70 p-2 hover:bg-white/60 dark:border-neutral-700/60 dark:hover:bg-neutral-900/60"
                aria-label="Otwórz menu"
                onClick={onOpenMobile}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* SHORT BREADCRUMB IN HEADER */}
            <nav
              aria-label="Breadcrumb"
              className="absolute left-[55px] top-1/2 -translate-y-1/2 min-w-0 pr-2 lg:left-3"
            >
              <ol className="flex items-center gap-1 text-sm text-slate-600 dark:text-neutral-300">
                {displayedCrumbs.map((c, i) => {
                  const last = i === displayedCrumbs.length - 1;
                  const label = c.label || "Strona główna";

                  if (c.isEllipsis) {
                    return (
                      <li
                        key="breadcrumb-ellipsis"
                        className="relative flex min-w-0 items-center"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setBreadcrumbsExpanded((prev) => !prev)
                          }
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-neutral-300 dark:ring-neutral-700 dark:hover:bg-neutral-900"
                          aria-label="Pokaż ukrytą ścieżkę nawigacji"
                          title="Pokaż ukrytą ścieżkę nawigacji"
                        >
                          [...]
                        </button>
                        <ChevronRight
                          className="mx-1 h-4 w-4 opacity-60"
                          aria-hidden="true"
                        />

                        {/* TOOLTIP WITH HIDDEN PATH – MOBILE ONLY */}
                        {breadcrumbsExpanded && hiddenCrumbs.length > 0 && (
                          <>
                            {/* click outside area */}
                            <button
                              type="button"
                              className="fixed inset-0 z-[70] cursor-default md:hidden"
                              aria-hidden="true"
                              onClick={() =>
                                setBreadcrumbsExpanded(false)
                              }
                            />
                            <div className="absolute left-0 top-full z-[71] mt-1 max-w-[80vw] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900 md:hidden">
                              <ol className="flex flex-wrap items-center gap-1 text-slate-700 dark:text-neutral-100">
                                {hiddenCrumbs.map((hc, idx) => {
                                  const lastHidden =
                                    idx === hiddenCrumbs.length - 1;
                                  const hiddenLabel =
                                    hc.label || "Strona główna";

                                  return (
                                    <li
                                      key={hc.href}
                                      className="flex min-w-0 items-center"
                                    >
                                      {!lastHidden ? (
                                        <>
                                          <Link
                                            href={hc.href}
                                            className="truncate hover:underline normal-case"
                                            title={hiddenLabel}
                                            onClick={() =>
                                              setBreadcrumbsExpanded(
                                                false
                                              )
                                            }
                                          >
                                            <span className="normal-case">
                                              {hiddenLabel}
                                            </span>
                                          </Link>
                                          <ChevronRight
                                            className="mx-1 h-3.5 w-3.5 opacity-60"
                                            aria-hidden="true"
                                          />
                                        </>
                                      ) : (
                                        <span
                                          className="truncate font-medium text-slate-900 dark:text-neutral-50 normal-case"
                                          title={hiddenLabel}
                                        >
                                          {hiddenLabel}
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  }

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
                          className="truncate font-medium text-slate-900 dark:text-neutral-100 normal-case"
                          title={label}
                        >
                          {label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className="flex items-end mx-auto justify-end py-2 md:py-3 w-full max-w-[1400px] pr-0 sm:px-0">
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
                  ) : (
                    <>
                      <div className="flex items-center gap-2 md:hidden">
                        <Button
                          className="h-9 w-9 rounded-md bg-gray-900 text-white hover:bg-gray-800"
                          aria-label="Dodaj zawodnika"
                          onClick={onAddPlayer}
                          title="Dodaj zawodnika"
                        >
                          <AddPlayerIcon className="h-4 w-4 text-white" />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-md border-none dark:border-neutral-700"
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
          © {new Date().getFullYear()} entrisoScouting • v1.0
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
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);

  const [headerActions, setHeaderActions] = useState<ReactNode | null>(
    null
  );

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
