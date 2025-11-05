// src/app/ClientRoot.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "next-themes";
import AppSidebar from "@/widgets/app-sidebar/AppSidebar";
import PageTransition from "@/shared/ui/PageTransition";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu, LogIn, UserPlus, PlusCircle,
  Mail, Lock, User as UserIcon, Eye, EyeOff, CheckCircle2
} from "lucide-react";
// import CommentLayer from "@/features/comments/CommentLayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LoaderOverlay from "@/shared/ui/LoaderOverlay";
import { motion, AnimatePresence, cubicBezier, type Variants } from "framer-motion";

/* ===== Keys ===== */
const AUTH_KEY = "s4s.auth";
const ROLE_KEY = "s4s.role";
const USERS_KEY = "s4s.users";

/* ===== Types ===== */
type Role = "admin" | "scout" | "scout-agent";
type AuthState =
  | { ok: true; role: Role; user: string; email?: string; userId?: string }
  | { ok: false };

type StoredUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role; // "scout" for user-registered accounts
};

/* ===== Helpers ===== */
const parseRole = (v: any): Role =>
  v === "admin" || v === "scout" || v === "scout-agent" ? v : "scout";

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const readUsers = (): StoredUser[] => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
};
const writeUsers = (list: StoredUser[]) => {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  } catch {}
};

const readAuth = (): AuthState => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { ok: false };
    const parsed = JSON.parse(raw);
    if (parsed?.ok && parsed?.role) {
      return {
        ok: true,
        role: parseRole(parsed.role),
        user: parsed.user || "demo",
        email: parsed.email,
        userId: parsed.userId,
      };
    }
  } catch {}
  return { ok: false };
};

function dispatchRole(role: Role | null) {
  try {
    window.dispatchEvent(
      new StorageEvent("storage", { key: ROLE_KEY, newValue: role ?? (null as any) })
    );
    window.dispatchEvent(new CustomEvent("s4s:role", { detail: role }));
  } catch {}
}

function dispatchAuth(auth: AuthState | null) {
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: AUTH_KEY,
        newValue: auth ? JSON.stringify(auth) : (null as any),
      })
    );
    window.dispatchEvent(new CustomEvent("s4s:auth", { detail: auth }));
  } catch {}
}

/* ===== Brand: Dark rounded square "S" (hide label when authed) ===== */
function BrandMark({ showName }: { showName: boolean }) {
  return (
    <a
      href="/"
      className="group flex items-center gap-2"
      aria-label="entrisoScouting - Start"
    >
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

/* ===== Auth Gate ===== */
function AuthGate({
  onLoggedIn,
  onLoading,
}: {
  onLoggedIn: (auth: AuthState) => void;
  onLoading: (v: boolean, text?: string) => void;
}) {
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<"login" | "register">("login");

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showPassLogin, setShowPassLogin] = useState(false);
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Register form (always "scout")
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [showPassReg, setShowPassReg] = useState(false);
  const [regErr, setRegErr] = useState<string | null>(null);
  const [regOk, setRegOk] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);

  const doLogin = (email: string, pass: string) => {
    const users = readUsers();
    const found = users.find(
      (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase()
    );
    if (!found || found.password !== pass) {
      throw new Error("Nieprawidłowy e-mail lub hasło.");
    }
    const auth: AuthState = {
      ok: true,
      role: found.role,
      user: found.name || found.email,
      email: found.email,
      userId: found.id,
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    localStorage.setItem(ROLE_KEY, found.role);
    dispatchAuth(auth);
    dispatchRole(found.role);
    onLoggedIn(auth);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    setLoginBusy(true);
    onLoading(true, "Logowanie…");
    try {
      if (!loginEmail.trim() || !loginPass.trim()) {
        throw new Error("Wpisz e-mail i hasło.");
      }
      await new Promise((r) => setTimeout(r, 350));
      doLogin(loginEmail, loginPass);
    } catch (err: any) {
      setLoginErr(err?.message || "Błąd logowania.");
    } finally {
      setLoginBusy(false);
      onLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErr(null);
    setRegOk(null);
    setRegBusy(true);
    try {
      if (!regName.trim()) throw new Error("Podaj imię i nazwisko.");
      if (!regEmail.trim()) throw new Error("Podaj e-mail.");
      if (!/^\S+@\S+\.\S+$/.test(regEmail)) throw new Error("Nieprawidłowy e-mail.");
      if (!regPass.trim() || regPass.length < 6)
        throw new Error("Hasło musi mieć min. 6 znaków.");

      const users = readUsers();
      if (
        users.some(
          (u) => u.email.trim().toLowerCase() === regEmail.trim().toLowerCase()
        )
      ) {
        throw new Error("Konto z tym e-mailem już istnieje.");
      }
      const newUser: StoredUser = {
        id: uid(),
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPass,
        role: "scout",
      };
      writeUsers([newUser, ...users]);
      setRegOk("Konto utworzone. Możesz się zalogować.");
      setTab("login");
      setLoginEmail(newUser.email);
    } catch (err: any) {
      setRegErr(err?.message || "Błąd rejestracji.");
    } finally {
      setRegBusy(false);
    }
  };

  const loginAs = (role: Role) => {
    setPendingRole(role);
    onLoading(true, "Logowanie…");
    setTimeout(() => {
      const auth: AuthState = {
        ok: true,
        role,
        user: role.toUpperCase() + " DEMO",
        userId: uid(),
        email: `${role}@demo.local`,
      };
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
      localStorage.setItem(ROLE_KEY, role);
      dispatchAuth(auth);
      dispatchRole(role);
      onLoggedIn(auth);
      onLoading(false);
    }, 450);
  };

  return (
    <div className="min-h-[calc(100vh-var(--header-h,0px))] w-full">
      <motion.div
        className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-8 px-3 py-6 md:gap-10 md:px-6 md:py-10 md:grid-cols-2"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.08 }}
      >
        {/* LEFT */}
        <motion.section
          variants={colVariants}
          className="relative hidden min-h-[520px] items-center md:flex"
        >
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(55%_40%_at_50%_-8%,rgba(59,130,246,0.12),transparent_60%)] dark:bg-[radial-gradient(55%_40%_at_50%_-8%,rgba(99,102,241,0.16),transparent_62%)]" />
            <div
              className="absolute inset-0 opacity-[0.05] mix-blend-soft-light"
              aria-hidden
              style={{
                backgroundImage:
                  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27140%27 height=%27140%27 viewBox=%270 0 140 140%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%271%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")',
              }}
            />
          </div>

          <div className="mx-auto w-full max-w-[560px] p-2 md:p-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.4, ease: easeOutCustom }}
              className="mb-4 inline-flex items-center gap-2 rounded bg-indigo-600/10 px-3 py-1 text-xs text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:ring-indigo-800/50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              entrisoScouting — panel analityczny
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45, ease: easeOutCustom }}
              className="text-2xl font-semibold leading-tight"
            >
              Zarządzaj bazą zawodników, obserwacjami i raportami — szybko i przejrzyście.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45, ease: easeOutCustom }}
              className="mt-2 text-sm text-muted-foreground"
            >
              Skup się na ocenie talentu. My zajmiemy się filtrowaniem, łączeniem źródeł i wygodnym
              przepływem pracy między skautami a agentami.
            </motion.p>

            <motion.ul
              initial="hidden"
              animate="show"
              transition={{ staggerChildren: 0.06, delayChildren: 0.24 }}
              className="mt-5 space-y-3 text-sm"
            >
              {[
                "Globalna wyszukiwarka (Transfermarkt, Wyscout, SoFIFA + własne źródła)",
                "Obserwacje z ocenami, tagami i historią meczów",
                "Szybkie dodawanie zawodników i obserwacji z każdego miejsca",
              ].map((txt, i) => (
                <motion.li
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    show: { opacity: 1, y: 0, transition: { ease: easeOutCustom } },
                  }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-1 inline-block h-2 w-2 rounded bg-indigo-500" />
                  {txt}
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </motion.section>

        {/* RIGHT */}
        <motion.section variants={colVariants} className="grid place-items-center">
          <div className="w-full max-w-md rounded-2xl bg-white/30 p-4 backdrop-blur-xl dark:bg-neutral-950/30 md:p-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: easeOutCustom }}
              className="mb-4 flex items-center justify-center gap-2"
            >
              <div className="grid h-9 w-9 place-items-center rounded bg-gray-900 text-white dark:bg-white dark:text-neutral-900">
                <span className="text-[13px] font-bold leading-none">S</span>
              </div>
              <h2 className="text-lg font-semibold">Witaj w entrisoScouting</h2>
            </motion.div>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
              <TabsList className="mb-4 w-full justify-between rounded-lg bg-white/30 p-1 backdrop-blur-sm dark:bg-neutral-900/30">
                <TabsTrigger value="login" className="flex-1 px-3 py-2 data-[state=active]:bg-white/60 data-[state=active]:backdrop-blur-sm dark:data-[state=active]:bg-neutral-800/60">
                  Logowanie
                </TabsTrigger>
                <TabsTrigger value="register" className="flex-1 px-3 py-2 data-[state=active]:bg-white/60 data-[state=active]:backdrop-blur-sm dark:data-[state=active]:bg-neutral-800/60">
                  Rejestracja
                </TabsTrigger>
              </TabsList>

              {/* Anti-jump wrapper */}
              <div className="relative min-h-[380px]">
                <AnimatePresence mode="wait">
                  {tab === "login" ? (
                    <motion.div
                      key="login-panel"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: easeOutCustom }}
                      className="absolute inset-0"
                    >
                      <TabsContent value="login" className="space-y-3 data-[state=inactive]:hidden">
                        <form onSubmit={handleLogin} className="space-y-3">
                          <div>
                            <Label htmlFor="l-email">E-mail</Label>
                            <div className="relative mt-1">
                              <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <Input
                                id="l-email"
                                type="email"
                                autoComplete="email"
                                className="pl-8 bg-white/60 backdrop-blur-sm dark:bg-neutral-900/60"
                                placeholder="jan.kowalski@example.com"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="l-pass">Hasło</Label>
                            <div className="relative mt-1">
                              <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <Input
                                id="l-pass"
                                type={showPassLogin ? "text" : "password"}
                                autoComplete="current-password"
                                className="pl-8 pr-9 bg-white/60 backdrop-blur-sm dark:bg-neutral-900/60"
                                placeholder="••••••••"
                                value={loginPass}
                                onChange={(e) => setLoginPass(e.target.value)}
                              />
                              <button
                                type="button"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-white/60 hover:backdrop-blur-sm dark:hover:bg-neutral-800/60"
                                onClick={() => setShowPassLogin((s) => !s)}
                                aria-label={showPassLogin ? "Ukryj hasło" : "Pokaż hasło"}
                              >
                                {showPassLogin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          {loginErr && (
                            <div className="rounded bg-rose-50/80 px-2 py-1 text-xs text-rose-700 backdrop-blur">
                              {loginErr}
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={loginBusy}
                            className="h-9 w-full bg-gray-900/90 text-white hover:bg-gray-900"
                          >
                            Zaloguj się
                          </Button>
                        </form>
                      </TabsContent>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register-panel"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: easeOutCustom }}
                      className="absolute inset-0"
                    >
                      <TabsContent value="register" className="space-y-3 data-[state=inactive]:hidden">
                        <form onSubmit={handleRegister} className="space-y-3">
                          <div>
                            <Label htmlFor="r-name">Imię i nazwisko</Label>
                            <div className="relative mt-1">
                              <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <Input
                                id="r-name"
                                className="pl-8 bg-white/60 backdrop-blur-sm dark:bg-neutral-900/60"
                                placeholder="Jan Kowalski"
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="r-email">E-mail</Label>
                            <div className="relative mt-1">
                              <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <Input
                                id="r-email"
                                type="email"
                                autoComplete="email"
                                className="pl-8 bg-white/60 backdrop-blur-sm dark:bg-neutral-900/60"
                                placeholder="jan.kowalski@example.com"
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="r-pass">Hasło</Label>
                            <div className="relative mt-1">
                              <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <Input
                                id="r-pass"
                                type={showPassReg ? "text" : "password"}
                                autoComplete="new-password"
                                className="pl-8 pr-9 bg-white/60 backdrop-blur-sm dark:bg-neutral-900/60"
                                placeholder="min. 6 znaków"
                                value={regPass}
                                onChange={(e) => setRegPass(e.target.value)}
                              />
                              <button
                                type="button"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-white/60 hover:backdrop-blur-sm dark:hover:bg-neutral-800/60"
                                onClick={() => setShowPassReg((s) => !s)}
                                aria-label={showPassReg ? "Ukryj hasło" : "Pokaż hasło"}
                              >
                                {showPassReg ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          {regErr && (
                            <div className="rounded bg-rose-50/80 px-2 py-1 text-xs text-rose-700 backdrop-blur">
                              {regErr}
                            </div>
                          )}
                          {regOk && (
                            <div className="rounded bg-emerald-50/80 px-2 py-1 text-xs text-emerald-700 backdrop-blur">
                              {regOk}
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={regBusy}
                            className="h-9 w-full bg-gray-900/90 text-white hover:bg-gray-900"
                          >
                            Utwórz konto
                          </Button>
                        </form>
                      </TabsContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Tabs>

            {/* Divider */}
            <div className="my-4 h-px bg-white/40 dark:bg-white/10" />

            {/* Demo roles — single-row each */}
            <div className="space-y-2 text-sm">
              <div className="mb-1 text-[11px] font-medium tracking-wide text-dark dark:text-neutral-400">
                Szybkie logowanie (demo):
              </div>

              <button
                onClick={() => loginAs("admin")}
                className="w-full rounded bg-white/40 px-3 py-2 text-left backdrop-blur hover:bg-white/55 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/55"
                disabled={!!pendingRole}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Admin</span>
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] leading-none text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">demo</span>
                  </div>
                  <span className="text-xs text-dark dark:text-neutral-300">Uprawnienia pełne</span>
                </div>
              </button>

              <button
                onClick={() => loginAs("scout-agent")}
                className="w-full rounded bg-white/40 px-3 py-2 text-left backdrop-blur hover:bg-white/55 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/55"
                disabled={!!pendingRole}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Scout Agent</span>
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] leading-none text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">demo</span>
                  </div>
                  <span className="text-xs text-dark dark:text-neutral-300">Uprawnienia pośrednie</span>
                </div>
              </button>

              <button
                onClick={() => loginAs("scout")}
                className="w-full rounded bg-white/40 px-3 py-2 text-left backdrop-blur hover:bg-white/55 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/55"
                disabled={!!pendingRole}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Scout</span>
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] leading-none text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">demo</span>
                  </div>
                  <span className="text-xs text-dark dark:text-neutral-300">Uprawnienia ograniczone</span>
                </div>
              </button>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}

/* ===== Shell with Sidebar & Topbar ===== */
function AppShell({
  children,
  onOpenMobile,
  onAddPlayer,
  onAddObservation,
  isAuthed,
}: {
  children: React.ReactNode;
  onOpenMobile: () => void;
  onAddPlayer: () => void;
  onAddObservation: () => void;
  isAuthed: boolean;
}) {
  return (
    <>
      <div className="pl-64 max-lg:pl-0">
        {/* Sticky glass top bar */}
        <header
          className="
            sticky top-0 z-40 border-b border-transparent
            backdrop-blur supports-[backdrop-filter]:bg-white/55
            dark:bg-neutral-950/55
          "
          role="banner"
        >
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-2 py-2 md:px-4 md:py-3">
            <div className="flex items-center gap-2">
              {/* HIDE hamburger until logged in; add subtle border & rounding */}
              {isAuthed && (
                <button
                  className="rounded border border-gray-300/70 p-2 backdrop-blur-sm hover:bg-white/60 dark:border-neutral-700/60 dark:hover:bg-neutral-900/60 lg:hidden"
                  aria-label="Otwórz menu"
                  onClick={onOpenMobile}
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              {/* Hide name when authenticated */}
              <BrandMark showName={!isAuthed} />
            </div>

            {/* Global actions — only when authed */}
            {isAuthed ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: easeOutCustom }}
                className="flex items-center gap-2"
              >
                {/* Mobile: icon-only */}
                <div className="flex items-center gap-2 md:hidden">
                  <Button
                    size="icon"
                    className="h-9 w-9 bg-gray-900 text-white hover:bg-gray-800"
                    aria-label="Dodaj zawodnika"
                    onClick={onAddPlayer}
                    title="Dodaj zawodnika"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 border-gray-300 dark:border-neutral-700"
                    aria-label="Dodaj obserwacje"
                    onClick={onAddObservation}
                    title="Dodaj obserwacje"
                  >
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>

                {/* Desktop: icon + label */}
                <div className="hidden items-center gap-2 md:flex">
                  <Button
                    onClick={onAddPlayer}
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    aria-label="Dodaj zawodnika"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Dodaj zawodnika
                  </Button>
                  <Button
                    onClick={onAddObservation}
                    variant="outline"
                    className="border-gray-300 dark:border-neutral-700"
                    aria-label="Dodaj obserwacje"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Dodaj obserwacje
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div />
            )}
          </div>
        </header>

        {/* Content container */}
        <main id="content" className="px-2 py-4 md:px-4 md:py-6">
          <PageTransition>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: easeOutCustom }}
              className="
                mx-auto w-full max-w-[1400px]
                rounded-lg bg-white/70 p-0 shadow-none backdrop-blur-sm
                dark:border-0 dark:bg-neutral-950/60 md:p-6
              "
            >
              {children}
            </motion.div>
          </PageTransition>
        </main>

        <footer
          className="mx-auto w-full max-w-[1400px] px-2 pb-6 pt-2 text-xs text-dark dark:text-neutral-400 md:px-4 md:pb-8"
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
export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [auth, setAuth] = useState<AuthState>({ ok: false });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBootLoader, setShowBootLoader] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [overlay, setOverlay] = useState<{ on: boolean; text?: string }>({ on: false });

  const setOverlayOn = (on: boolean, text?: string) => setOverlay({ on, text });

  // initial auth
  useEffect(() => {
    setAuth(readAuth());
  }, []);

  // listen to auth changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_KEY) setAuth(readAuth());
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

  // boot effect after login
  useEffect(() => {
    if (auth.ok) {
      setShowBootLoader(true);
      const t = setTimeout(() => setShowBootLoader(false), 700);
      if (pathname?.startsWith("/auth")) router.replace("/");
      return () => clearTimeout(t);
    } else {
      setMobileOpen(false);
    }
  }, [auth.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  // subtle route-change overlay
  useEffect(() => {
    setRouteLoading(true);
    const t = setTimeout(() => setRouteLoading(false), 250);
    return () => clearTimeout(t);
  }, [pathname]);

  const content = useMemo(() => {
    if (!auth.ok)
      return <AuthGate onLoggedIn={(a) => setAuth(a)} onLoading={setOverlayOn} />;
    return children;
  }, [auth.ok, children]);

  const handleAddPlayer = () => router.push("/players/new");
  const handleAddObservation = () => router.push("/observations?create=1");

  const showOverlay = overlay.on || showBootLoader || routeLoading;

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {/* Sidebars */}
      <AppSidebar variant="mobile" open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Shell */}
      <AppShell
        onOpenMobile={() => setMobileOpen(true)}
        onAddPlayer={handleAddPlayer}
        onAddObservation={handleAddObservation}
        isAuthed={!!auth.ok}
      >
        {content}
      </AppShell>

      {/* Comments */}
      {/* <CommentLayer
        pageKey={pathname}
        containerSelector="body"
        currentUser={{
          id: auth.ok ? (auth as any).userId : undefined,
          name: auth.ok ? (auth as any).user : "demo",
        }}
      /> */}

      {/* Global overlay loader */}
      {showOverlay && (
        <LoaderOverlay
          text={overlay.text || (showBootLoader ? "Ładowanie kokpitu…" : "Przełączanie widoku…")}
        />
      )}
    </ThemeProvider>
  );
}
