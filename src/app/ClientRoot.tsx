// src/app/ClientRoot.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import AppSidebar from "@/widgets/app-sidebar/AppSidebar";
import PageTransition from "@/shared/ui/PageTransition";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

/* ===== Simple breadcrumb builder ===== */
function buildBreadcrumb(pathname: string) {
  const parts = pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);
  const items = [{ label: "Home", href: "/" }];
  let acc = "";
  for (const p of parts) {
    acc += "/" + p;
    items.push({
      label: decodeURIComponent(p).replace(/-/g, " "),
      href: acc,
    });
  }
  return items;
}

// ---- helpers (module-scope): available to all components ----
export const titleCaseAll = (input: string) =>
  String(input ?? "")
    .replace(/[-_/]+/g, " ") // treat -, _, / as word breaks
    .trim()
    .split(/\s+/) // split on spaces
    .map((w) => (w ? w[0].toLocaleUpperCase() + w.slice(1) : ""))
    .join(" ");

/* ===== Shell with Sidebar & Topbar ===== */
function AppShell({
  children,
  onOpenMobile,
  onAddPlayer,
  onAddObservation,
  isAuthed,
  pathname,
}: {
  children: React.ReactNode;
  onOpenMobile: () => void;
  onAddPlayer: () => void;
  onAddObservation: () => void;
  isAuthed: boolean;
  pathname: string;
}) {
  const crumbs = buildBreadcrumb(pathname);
  const search = useSearchParams();
  const prefersReduced = useReducedMotion();

  const isObsCreateQuery =
    pathname.startsWith("/observations") && search.get("create") === "1";

  const hideHeaderActions =
    /^\/players\/new(?:\/|$)/.test(pathname) || // add player
    /^\/players\/\d+(?:\/|$)/.test(pathname) || // player details
    /^\/observations\/new(?:\/|$)/.test(pathname) || // add observation
    /^\/observations\/\d+(?:\/|$)/.test(pathname) || // observation details
    isObsCreateQuery;

  return (
    <>
      <div className="pl-64 max-lg:pl-0">
        {/* Sticky top bar */}
        <header
          className="sticky top-0 z-40 border-b border-transparent bg-transparent backdrop-blur supports-[backdrop-filter]:bg-transparent dark:bg-transparent"
          role="banner"
        >
          <div className="relative mx-auto w-full">
            {/* Hamburger (mobile) */}
            {isAuthed && (
              <button
                className="lg:hidden absolute left-2 top-1/2 -translate-y-1/2 rounded-md border border-gray-300/70 p-2 hover:bg-white/60 dark:border-neutral-700/60 dark:hover:bg-neutral-900/60"
                aria-label="Otwórz menu"
                onClick={onOpenMobile}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* Breadcrumbs */}
            <nav
              aria-label="Breadcrumb"
              className="absolute left-[55px] top-1/2 -translate-y-1/2 min-w-0 pr-2 lg:left-3"
            >
              <ol className="flex items-center gap-1 text-sm text-slate-600 dark:text-neutral-300">
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  const raw = c.label || "Home";
                  const label = titleCaseAll(raw);

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

            {/* Actions row */}
            <div className="flex items-end mx-auto justify-end py-2 md:py-3 w-full max-w-[1400px] px-3 md:px-0">
              {isAuthed ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: easeOutCustom }}
                  className={`ml-2 flex shrink-0 items-center gap-2 min-h-[36px] ${
                    hideHeaderActions ? "invisible pointer-events-none" : ""
                  }`}
                >
                  {/* Mobile: icon-only buttons, tight paddings */}
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
                      className="h-9 w-9 rounded-md border-gray-300 dark:border-neutral-700"
                      aria-label="Dodaj obserwacje"
                      onClick={onAddObservation}
                      title="Dodaj obserwacje"
                    >
                      <AddObservationIcon className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Desktop: full buttons */}
                  <div className="hidden items-center gap-2 md:flex">
                    <Button
                      onClick={onAddPlayer}
                      className="h-9 rounded-md bg-gray-900 text-white hover:bg-gray-800"
                      aria-label="Dodaj zawodnika"
                    >
                      <AddPlayerIcon className="mr-2 h-4 w-4" />
                      Dodaj zawodnika
                    </Button>
                    <Button
                      onClick={onAddObservation}
                      variant="outline"
                      className="h-9 rounded-md border-gray-300 dark:border-neutral-700"
                      aria-label="Dodaj obserwacje"
                    >
                      <AddObservationIcon className="mr-2 h-4 w-4" />
                      Dodaj obserwacje
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="min-h-[36px]" />
              )}
            </div>
          </div>
        </header>

 {/* Content */}
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
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);

  // prosta animacja paska przy zmianie routa
  useEffect(() => {
    if (prefersReduced) return;
    setRouteLoading(true);
    const t = setTimeout(() => setRouteLoading(false), 260);
    return () => clearTimeout(t);
  }, [pathname, prefersReduced]);

  const handleAddPlayer = () => router.push("/players/new");
  const handleAddObservation = () => router.push("/observations?create=1");

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {/* Top progress bar */}
      <div
        className={`fixed inset-x-0 top-0 z-[60] h-0.5 bg-indigo-500 transition-opacity ${
          routeLoading ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />

      {/* Sidebars */}
      <AppSidebar
        variant="mobile"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Shell */}
      <AppShell
        onOpenMobile={() => setMobileOpen(true)}
        onAddPlayer={handleAddPlayer}
        onAddObservation={handleAddObservation}
        isAuthed={true} // AuthGate (Supabase) siedzi wyżej i przepuszcza tylko zalogowanych
        pathname={pathname || "/"}
      >
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
