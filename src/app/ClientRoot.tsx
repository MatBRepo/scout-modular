// src/app/ClientRoot.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "next-themes";
import AppSidebar from "@/widgets/app-sidebar/AppSidebar";
import PageTransition from "@/shared/ui/PageTransition";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogIn } from "lucide-react";
import CommentLayer from "@/features/comments/CommentLayer";


/* ===== Keys ===== */
const AUTH_KEY = "s4s.auth";
const ROLE_KEY = "s4s.role";

/* ===== Types ===== */
type Role = "admin" | "scout" | "scout-agent";
type AuthState =
  | { ok: true; role: Role; user: string }
  | { ok: false };

/* ===== Helpers ===== */
const parseRole = (v: any): Role =>
  v === "admin" || v === "scout" || v === "scout-agent" ? v : "scout";

const readAuth = (): AuthState => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { ok: false };
    const parsed = JSON.parse(raw);
    if (parsed?.ok && parsed?.role) {
      return { ok: true, role: parseRole(parsed.role), user: parsed.user || "demo" };
    }
  } catch {}
  return { ok: false };
};

function dispatchRole(role: Role | null) {
  try {
    // StorageEvent to notify other tabs
    window.dispatchEvent(
      new StorageEvent("storage", { key: ROLE_KEY, newValue: role ?? null as any })
    );
    // CustomEvent to update same-tab instantly
    window.dispatchEvent(new CustomEvent("s4s:role", { detail: role }));
  } catch {}
}

function dispatchAuth(auth: AuthState | null) {
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: AUTH_KEY,
        newValue: auth ? JSON.stringify(auth) : null as any,
      })
    );
    window.dispatchEvent(new CustomEvent("s4s:auth", { detail: auth }));
  } catch {}
}

/* ===== T-Shirt Inline Draw Loader (loop; no rotation) ===== */
function TshirtDrawLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6">
      <svg
        className="h-10 w-10"
        viewBox="0 0 16 16"
        aria-hidden="true"
        fill="none"
        stroke="#000"
        strokeWidth="0.222"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "#000" }}
      >
        <path
          d="M13.5867 2.30659L10.6667 1.33325C10.6667 2.0405 10.3857 2.71877 9.88565 3.21887C9.38555 3.71897 8.70727 3.99992 8.00003 3.99992C7.29278 3.99992 6.61451 3.71897 6.11441 3.21887C5.61431 2.71877 5.33336 2.0405 5.33336 1.33325L2.41336 2.30659C2.11162 2.40711 1.85575 2.6122 1.69193 2.88481C1.52811 3.15743 1.46715 3.47963 1.52003 3.79325L1.90669 6.10659C1.93208 6.26319 2.01248 6.40562 2.13345 6.50826C2.25443 6.61091 2.40804 6.66704 2.56669 6.66659H4.00003V13.3333C4.00003 14.0666 4.60003 14.6666 5.33336 14.6666H10.6667C11.0203 14.6666 11.3595 14.5261 11.6095 14.2761C11.8596 14.026 12 13.6869 12 13.3333V6.66659H13.4334C13.592 6.66704 13.7456 6.61091 13.8666 6.50826C13.9876 6.40562 14.068 6.26319 14.0934 6.10659L14.48 3.79325C14.5329 3.47963 14.4719 3.15743 14.3081 2.88481C14.1443 2.6122 13.8884 2.40711 13.5867 2.30659Z"
          className="animate-[tshirt-draw_1.6s_ease-in-out_infinite]"
          style={{
            strokeDasharray: 60,
            strokeDashoffset: 60,
          }}
        />
      </svg>
      <div className="text-sm text-gray-700 dark:text-neutral-200">Ładowanie kokpitu…</div>
      <style jsx>{`
        @keyframes tshirt-draw {
          0%   { stroke-dashoffset: 60; opacity: .9; }
          40%  { stroke-dashoffset: 0;  opacity: 1; }
          60%  { stroke-dashoffset: 0;  opacity: 1; }
          100% { stroke-dashoffset: -60; opacity: .95; }
        }
      `}</style>
    </div>
  );
}

/* ===== Auth Gate (centered login/register) ===== */
function AuthGate({ onLoggedIn }: { onLoggedIn: (auth: AuthState) => void }) {
  const [pending, setPending] = useState<Role | null>(null);

  const loginAs = (role: Role) => {
    setPending(role);
    // Fake loading to show animation on dashboard later
    setTimeout(() => {
      const auth: AuthState = { ok: true, role, user: role.toUpperCase() + " DEMO" };
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
      localStorage.setItem(ROLE_KEY, role);
      dispatchAuth(auth);
      dispatchRole(role);
      onLoggedIn(auth);
    }, 350);
  };

  return (
    <div className="grid  place-items-center p-0">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70">
        <div className="mb-4 flex items-center justify-center gap-2">
          <div className="rounded-full bg-indigo-600/10 p-2">
            <LogIn className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-lg font-semibold">Logowanie / Rejestracja</h1>
        </div>

        {/* Demo accounts */}
        <div className="space-y-2 text-sm">
          <button
            onClick={() => loginAs("admin")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-left hover:bg-gray-50 active:scale-[0.99] dark:border-neutral-700 dark:hover:bg-neutral-900"
            disabled={!!pending}
          >
            <div className="flex flex-wrap items-center justify-between">
              <span className="font-medium">Zaloguj jako Admin</span>
              <span className="text-xs text-gray-500">demo</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">Uprawnienia pełne</div>
          </button>
          <button
            onClick={() => loginAs("scout-agent")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-left hover:bg-gray-50 active:scale-[0.99] dark:border-neutral-700 dark:hover:bg-neutral-900"
            disabled={!!pending}
          >
            <div className="flex flex-wrap items-center justify-between">
              <span className="font-medium">Zaloguj jako Scout Agent</span>
              <span className="text-xs text-gray-500">demo</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">Uprawnienia pośrednie</div>
          </button>
          <button
            onClick={() => loginAs("scout")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-left hover:bg-gray-50 active:scale-[0.99] dark:border-neutral-700 dark:hover:bg-neutral-900"
            disabled={!!pending}
          >
            <div className="flex flex-wrap items-center justify-between">
              <span className="font-medium">Zaloguj jako Scout</span>
              <span className="text-xs text-gray-500">demo</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">Uprawnienia ograniczone</div>
          </button>
        </div>

        <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
          <div className="font-semibold">Dane przykładowe:</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Admin · Scout Agent · Scout — bez hasła (demo)</li>
            <li>Rola ustawia nawigację w AppSidebar natychmiast po zalogowaniu.</li>
          </ul>
        </div>

        {pending && (
          <div className="mt-4">
            <TshirtDrawLoader />
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Shell with Sidebar & Topbar ===== */
function AppShell({
  children,
  onOpenMobile,
}: {
  children: React.ReactNode;
  onOpenMobile: () => void;
}) {
  return (
    <>
      {/* Fixed sidebar (desktop) handled inside <ClientRoot> with AppSidebar */}
      <div className="pl-64 max-lg:pl-0">
        {/* Sticky glass top bar */}
        <header
          className="
            sticky top-0 z-40 border-b border-transparent
            bg-white/65 backdrop-blur supports-[backdrop-filter]:bg-white/55
            dark:bg-neutral-950/55
          "
          role="banner"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                className="rounded-md p-2 lg:hidden hover:bg-gray-100 dark:hover:bg-neutral-900"
                aria-label="Otwórz menu"
                onClick={onOpenMobile}
              >
                <Menu className="h-5 w-5" />
              </button>
              <span
                aria-hidden
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500/80 ring-4 ring-indigo-500/10"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                S4S · Workspace
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">{/* global actions slot */}</div>
          </div>
        </header>

        {/* Content container */}
<main id="content" className="mx-auto max-w-7xl px-4 py-6"> 
           <PageTransition>
            <div
              className="
                rounded-2xl border border-gray-200/70 bg-white/70
                p-4 shadow-sm backdrop-blur-sm
                dark:border-neutral-800/70 dark:bg-neutral-950/60
                md:p-6
              "
            >
              {children}
            </div>
          </PageTransition>
        </main>

        <footer
          className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-xs text-gray-500 dark:text-neutral-400"
          role="contentinfo"
        >
          © {new Date().getFullYear()} entrisoScounting • v1.0
        </footer>
      </div>
      <div id="portal-root" />
    </>
  );
}

/* ===== ClientRoot ===== */
export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [auth, setAuth] = useState<AuthState>({ ok: false });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBootLoader, setShowBootLoader] = useState(false);

  // Hydrate auth from localStorage
  useEffect(() => {
    setAuth(readAuth());
  }, []);

  // React to cross-tab & same-tab auth changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_KEY) {
        setAuth(readAuth());
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as AuthState | null;
      setAuth(detail ?? { ok: false });
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("s4s:auth", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("s4s:auth", onCustom as EventListener);
    };
  }, []);

  // When auth flips to ok => show boot loader briefly then land where user was (or "/")
  useEffect(() => {
    if (auth.ok) {
      setShowBootLoader(true);
      const t = setTimeout(() => setShowBootLoader(false), 900);
      // If the user sits on /auth/*, route home
      if (pathname?.startsWith("/auth")) router.replace("/");
      return () => clearTimeout(t);
    } else {
      // unauthenticated: close mobile drawer; if user browses a page, keep gate anyway
      setMobileOpen(false);
    }
  }, [auth.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  const content = useMemo(() => {
    if (!auth.ok) {
      return <AuthGate onLoggedIn={(a) => setAuth(a)} />;
    }
    if (showBootLoader) {
      return (
        <div className="grid min-h-screen place-items-center">
          <TshirtDrawLoader />
        </div>
      );
    }
    return children;
  }, [auth.ok, showBootLoader, children]);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {/* Mobile sidebar (drawer) */}
      <AppSidebar variant="mobile" open={mobileOpen} onClose={() => setMobileOpen(false)} />
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      <AppShell onOpenMobile={() => setMobileOpen(true)}>{content}</AppShell>

<CommentLayer
  pageKey={pathname}
  containerSelector="#content"
  currentUser={{
    id: (auth.ok ? (auth as any).userId : undefined), // if you store a UUID
    name: auth.ok ? (auth as any).user : "demo",
  }}
/>


    </ThemeProvider>

    
  );
}
