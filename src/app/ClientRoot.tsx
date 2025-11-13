// src/app/ClientRoot.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import AppSidebar from "@/widgets/app-sidebar/AppSidebar";
import PageTransition from "@/shared/ui/PageTransition";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Menu, Mail, Lock, User as UserIcon, Eye, EyeOff, CheckCircle2,
  Loader2, ChevronRight
} from "lucide-react";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LoaderOverlay from "@/shared/ui/LoaderOverlay";
import { motion, AnimatePresence, cubicBezier, type Variants, useReducedMotion } from "framer-motion";

import {  AddPlayerIcon,
  AddObservationIcon } from "@/components/icons";

/* ===== Keys ===== */
const AUTH_KEY = "s4s.auth";
const ROLE_KEY = "s4s.role";
const USERS_KEY = "s4s.users";
const AUTH_TAB_KEY = "s4s.auth.tab";

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
  role: Role;
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

/* ===== Password strength (simple): 0-4 ===== */
function strengthScore(pass: string) {
  let s = 0;
  if (pass.length >= 6) s++;
  if (/[A-Z]/.test(pass)) s++;
  if (/[0-9]/.test(pass)) s++;
  if (/[^A-Za-z0-9]/.test(pass)) s++;
  return s;
}
const strengthLabel = (n: number) =>
  ["Bardzo słabe", "Słabe", "Średnie", "Dobre", "Bardzo dobre"][n];

/* ===== Auth Gate ===== */
function AuthGate({
  onLoggedIn,
  onLoading,
}: {
  onLoggedIn: (auth: AuthState) => void;
  onLoading: (v: boolean, text?: string) => void;
}) {
  const prefersReduced = useReducedMotion();

  const initialTab =
    (typeof window !== "undefined" && (localStorage.getItem(AUTH_TAB_KEY) as "login" | "register")) ||
    "login";
  const [tab, setTab] = useState<"login" | "register">(initialTab);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showPassLogin, setShowPassLogin] = useState(false); // <-- keep variable name
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginCaps, setLoginCaps] = useState(false);

  // Register form
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [showPassReg, setShowPassReg] = useState(false);
  const [regErr, setRegErr] = useState<string | null>(null);
  const [regOk, setRegOk] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);
  const [regCaps, setRegCaps] = useState(false);

  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  useEffect(() => {
    try { localStorage.setItem(AUTH_TAB_KEY, tab); } catch {}
  }, [tab]);

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

  const loginCardRef = useRef<HTMLDivElement>(null);

  

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
      if (loginCardRef.current && !prefersReduced) {
        loginCardRef.current.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-6px)" },
            { transform: "translateX(6px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 300, easing: "ease-in-out" }
        );
      }
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
      setPendingRole(null);
    }, 550);
  };

  const regStrength = strengthScore(regPass);

  return (
    <div className="min-h-[calc(100vh-var(--header-h,0px))] w-full">
      <motion.div
        className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-8 px-3 py-6 md:grid-cols-2 md:gap-10 md:px-6 md:py-10"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.08 }}
      >
        {/* LEFT */}
        <motion.section variants={colVariants} className="relative hidden min-h-[540px] items-center md:flex">
          <div className="mx-auto w-full max-w-[620px] p-2 md:p-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded bg-stone-100 px-3 py-1.5 text-xs text-slate-800 dark:bg-neutral-900 dark:text-neutral-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              entrisoScouting — panel analityczny
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45, ease: easeOutCustom }}
              className="text-3xl font-semibold leading-tight tracking-tight"
            >
              Zarządzaj bazą zawodników, obserwacjami i raportami — szybko i przejrzyście.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45, ease: easeOutCustom }}
              className="mt-3 text-[15px] text-muted-foreground"
            >
              Skup się na ocenie talentu. My zajmiemy się filtrowaniem, łączeniem źródeł i wygodnym
              przepływem pracy między skautami a agentami.
            </motion.p>

            <motion.ul
              initial="hidden"
              animate="show"
              transition={{ staggerChildren: 0.06, delayChildren: 0.24 }}
              className="mt-6 space-y-3 text-[15px]"
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
                  <span className="mt-2 inline-block h-1.5 w-1.5 rounded bg-indigo-500" />
                  {txt}
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </motion.section>

        {/* RIGHT — Auth card */}
        <motion.section variants={colVariants} className="grid place-items-center">
          <div ref={loginCardRef} className="w-full max-w-md rounded-2xl p-5 md:p-6">
            {/* Mobile short description */}
            <div className="mb-3 block md:hidden">
              <div className="rounded bg-stone-100 p-3 text-xs text-slate-700 dark:bg-neutral-900 dark:text-neutral-300">
                <div className="mb-1 font-medium text-slate-900 dark:text-neutral-100">
                  Szybka platforma dla scoutów
                </div>
                Dodawaj zawodników i obserwacje, przeglądaj globalną bazę i współpracuj z zespołem —
                wszystko w jednym miejscu.
              </div>
            </div>

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
              <TabsList className="mb-4 grid w-full grid-cols-2 gap-1 rounded bg-transparent p-0">
                <TabsTrigger
                  value="login"
                  className="rounded px-4 py-2 data-[state=active]:bg-stone-100 dark:data-[state=active]:bg-neutral-900"
                >
                  Logowanie
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded px-4 py-2 data-[state=active]:bg-stone-100 dark:data-[state=active]:bg-neutral-900"
                >
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
                                className="rounded bg-white pl-8 dark:bg-neutral-900"
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
                                className="rounded bg-white pl-8 pr-9 dark:bg-neutral-900"
                                placeholder="••••••••"
                                value={loginPass}
                                onChange={(e) => setLoginPass(e.target.value)}
                                onKeyUp={(e) => setLoginCaps((e as any).getModifierState?.("CapsLock"))}
                              />
                              <button
                                type="button"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-stone-100 dark:hover:bg-neutral-800"
                                onClick={() => setShowPassLogin((s) => !s)}
                                aria-label={showPassLogin ? "Ukryj hasło" : "Pokaż hasło"}
                              >
                                {showPassLogin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {loginCaps && (
                              <div className="mt-1 text-xs text-amber-600">Włączony Caps Lock</div>
                            )}
                          </div>

                          {loginErr && (
                            <div className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">
                              {loginErr}
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={loginBusy}
                            className="h-9 w-full rounded bg-gray-900 text-white hover:bg-gray-800"
                          >
                            {loginBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                                className="rounded bg-white pl-8 dark:bg-neutral-900"
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
                                className="rounded bg-white pl-8 dark:bg-neutral-900"
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
                                className="rounded bg-white pl-8 pr-9 dark:bg-neutral-900"
                                placeholder="min. 6 znaków"
                                value={regPass}
                                onChange={(e) => setRegPass(e.target.value)}
                                onKeyUp={(e) => setRegCaps((e as any).getModifierState?.("CapsLock"))}
                              />
                              <button
                                type="button"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-stone-100 dark:hover:bg-neutral-800"
                                onClick={() => setShowPassReg((s) => !s)}
                                aria-label={showPassReg ? "Ukryj hasło" : "Pokaż hasło"}
                              >
                                {showPassReg ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {regCaps && (
                              <div className="mt-1 text-xs text-amber-600">Włączony Caps Lock</div>
                            )}

                            {/* Strength meter */}
                            <div className="mt-2">
                              <div className="mb-1 flex items-center justify-between text-[11px]">
                                <span className="opacity-70">Siła hasła</span>
                                <span className="opacity-70">{strengthLabel(regStrength)}</span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded bg-slate-200 dark:bg-neutral-800">
                                <div
                                  className={`h-2 rounded transition-[width] ${
                                    regStrength <= 1
                                      ? "bg-rose-500"
                                      : regStrength === 2
                                      ? "bg-amber-500"
                                      : regStrength === 3
                                      ? "bg-emerald-500"
                                      : "bg-green-600"
                                  }`}
                                  style={{ width: `${(regStrength / 4) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {regErr && (
                            <div className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">
                              {regErr}
                            </div>
                          )}
                          {regOk && (
                            <div className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                              {regOk}
                            </div>
                          )}

                          <Button
                            type="submit"
                            disabled={regBusy}
                            className="h-9 w-full rounded bg-gray-900 text-white hover:bg-gray-800"
                          >
                            {regBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
            <div className="my-4 h-px bg-slate-200 dark:bg-neutral-800" />

            {/* Demo roles */}
            <div className="space-y-2 text-sm">
              <div className="mb-1 text-[11px] font-medium tracking-wide text-dark dark:text-neutral-400">
                Szybkie logowanie (demo):
              </div>

              <button
                onClick={() => loginAs("admin")}
                className="w-full rounded bg-white px-3 py-2 text-left hover:bg-slate-50 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                disabled={!!pendingRole}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Admin</span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] leading-none text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
                      demo
                    </span>
                  </div>
                  <span className="flex items-center gap-2 text-xs text-dark dark:text-neutral-300">
                    {pendingRole === "admin" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Uprawnienia pełne
                  </span>
                </div>
              </button>

              <button
                onClick={() => loginAs("scout-agent")}
                className="w-full rounded bg-white px-3 py-2 text-left hover:bg-slate-50 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                disabled={!!pendingRole}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Scout Agent</span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] leading-none text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
                      demo
                    </span>
                  </div>
                  <span className="flex items-center gap-2 text-xs text-dark dark:text-neutral-300">
                    {pendingRole === "scout-agent" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Uprawnienia pośrednie
                  </span>
                </div>
              </button>

              <button
                onClick={() => loginAs("scout")}
                className="w-full rounded bg-white px-3 py-2 text-left hover:bg-slate-50 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                disabled={!!pendingRole}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Scout</span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] leading-none text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
                      demo
                    </span>
                  </div>
                  <span className="flex items-center gap-2 text-xs text-dark dark:text-neutral-300">
                    {pendingRole === "scout" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Uprawnienia ograniczone
                  </span>
                </div>
              </button>
            </div>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}

/* ===== Simple breadcrumb builder ===== */
function buildBreadcrumb(pathname: string) {
  const parts = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
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

  const isObsCreateQuery =
    pathname.startsWith("/observations") && search.get("create") === "1";

  const hideHeaderActions =
    /^\/players\/new(?:\/|$)/.test(pathname) ||       // add player
    /^\/players\/\d+(?:\/|$)/.test(pathname) ||       // player details (e.g. /players/8)
    /^\/observations\/new(?:\/|$)/.test(pathname) ||  // add observation
    /^\/observations\/\d+(?:\/|$)/.test(pathname) ||  // observation details
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
            {/* Hamburger */}
            {isAuthed && (
              <button
                className="lg:hidden absolute left-2 top-1/2 -translate-y-1/2 rounded border border-gray-300/70 p-2 hover:bg-white/60 dark:border-neutral-700/60 dark:hover:bg-neutral-900/60"
                aria-label="Otwórz menu"
                onClick={onOpenMobile}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}


<nav
  aria-label="Breadcrumb"
  className="absolute left-[55px] top-1/2 -translate-y-1/2 min-w-0 pr-2 lg:left-3"
>
  <ol className="flex items-center gap-1 text-sm text-slate-600 dark:text-neutral-300">
    {crumbs.map((c, i) => {
      const last = i === crumbs.length - 1;
      const raw = c.label || "Home";
      const label = titleCaseAll(raw); // <-- ALL words capitalized

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
                  <HomeIcon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span className="normal-case">{label}</span>
                )}
              </Link>
              <ChevronRight className="mx-1 h-4 w-4 opacity-60" aria-hidden="true" />
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
                  className={`ml-2 flex shrink-0 items-center gap-2 min-h-[36px] ${hideHeaderActions ? "invisible pointer-events-none" : ""}`}
                >
                  {/* Mobile: icons */}
                  <div className="flex items-center gap-2 md:hidden">
<Button
  
  className="h-9 w-9 rounded bg-gray-900 text-white hover:bg-gray-800"
  aria-label="Dodaj zawodnika"
  onClick={onAddPlayer}
  title="Dodaj zawodnika"
>
  <AddPlayerIcon
    className="h-4 w-4 text-white"
  />
</Button>




                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 rounded border-gray-300 dark:border-neutral-700"
                      aria-label="Dodaj obserwacje"
                      onClick={onAddObservation}
                      title="Dodaj obserwacje"
                    >
                      <AddObservationIcon className="h-4 w-4"  />
                    </Button>
                  </div>

                  {/* Desktop: full buttons */}
                  <div className="hidden items-center gap-2 md:flex">
                    <Button
                      onClick={onAddPlayer}
                      className="h-9 rounded bg-gray-900 text-white hover:bg-gray-800"
                      aria-label="Dodaj zawodnika"
                    >
                      <AddPlayerIcon className="mr-2 h-4 w-4" />
                      Dodaj zawodnika
                    </Button>
                    <Button
                      onClick={onAddObservation}
                      variant="outline"
                      className="h-9 rounded border-gray-300 dark:border-neutral-700"
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
        <main id="content" className="px-3 py-4 md:px-6 md:py-6">
          <PageTransition>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: easeOutCustom }}
              className="mx-auto w-full max-w-[1400px] rounded bg-transparent p-0 shadow-none"
            >
              {children}
            </motion.div>
          </PageTransition>
        </main>

        <footer
          className="mx-auto w-full max-w-[1400px]  pb-6 pt-2 text-xs text-dark dark:text-neutral-400  md:pb-8 p-3"
          role="contentinfo"
        >
          © {new Date().getFullYear()} entrisoScouting • v1.0
        </footer>
      </div>
      <div id="portal-root" />
    </>
  );
}


// ---- helpers (module-scope): available to all components ----
export const titleCaseAll = (input: string) =>
  String(input ?? "")
    .replace(/[-_/]+/g, " ")   // treat -, _, / as word breaks
    .trim()
    .split(/\s+/)              // split on spaces
    .map(w => (w ? w[0].toLocaleUpperCase() + w.slice(1) : ""))
    .join(" ");

/* ===== ClientRoot ===== */
export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  const [auth, setAuth] = useState<AuthState>({ ok: false });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBootLoader, setShowBootLoader] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [overlay, setOverlay] = useState<{ on: boolean; text?: string }>({ on: false });

  const setOverlayOn = (on: boolean, text?: string) => setOverlay({ on, text });

  useEffect(() => {
    setAuth(readAuth());
  }, []);

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

  useEffect(() => {
    if (prefersReduced) return;
    setRouteLoading(true);
    const t = setTimeout(() => setRouteLoading(false), 260);
    return () => clearTimeout(t);
  }, [pathname, prefersReduced]);

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
      {/* Top progress bar */}
      <div
        className={`fixed inset-x-0 top-0 z-[60] h-0.5 bg-indigo-500 transition-opacity ${
          routeLoading ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />

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
        pathname={pathname || "/"}
      >
        {content}
      </AppShell>

      {/* Global overlay loader */}
      {showOverlay && (
        <LoaderOverlay
          text={overlay.text || (showBootLoader ? "Ładowanie kokpitu…" : "Przełączanie widoku…")}
        />
      )}
    </ThemeProvider>
  );
}
