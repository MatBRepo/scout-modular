// src/shared/auth/AuthGate.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoaderOverlay from "@/shared/ui/LoaderOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Role = "admin" | "scout" | "scout-agent";
const DEFAULT_ROLE: Role = "scout";

/* ===== Password strength helpers ===== */
function strengthScore(pass: string) {
  let s = 0;
  if (pass.length >= 6) s++;
  if (/[A-Z]/.test(pass)) s++;
  if (/[0-9]/.test(pass)) s++;
  if (/[^A-Za-z0-9]/.test(pass)) s++;
  return s;
}
const strengthLabel = (n: number) =>
  ["Very weak", "Weak", "Medium", "Good", "Very good"][n] ||
  "Very weak";

const easeOutCustom = [0.2, 0.7, 0.2, 1] as const;

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [user, setUser] = useState<any | null | undefined>(undefined);
  const [initialLoading, setInitialLoading] = useState(true);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  /* ===== Mobile detection (do autofocus only on desktop) ===== */
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 768); // < md breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ===== 1. Obecna sesja + nasłuch zmian auth =====
  useEffect(() => {
    let isMounted = true;

    (async () => {
      console.log("[AuthGate] Pre-loading user session...");
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error || !data?.session?.user) {
        console.log("[AuthGate] No user session found or error:", error);
        setUser(null);
      } else {
        console.log("[AuthGate] User session loaded:", data.session.user.email);
        setUser(data.session.user);
      }
      setInitialLoading(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`[AuthGate] Auth state change event: ${event}`, {
          user: session?.user?.email,
          hasSession: !!session,
        });
        setUser(session?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Autofocus między trybami – tylko desktop
  useEffect(() => {
    if (initialLoading || isMobile) return;
    if (mode === "register" && nameInputRef.current) {
      nameInputRef.current.focus();
      return;
    }
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [mode, initialLoading, isMobile]);

  const passScore = strengthScore(pwd);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !pwd.trim()) return false;
    if (pwd.length < 6) return false;
    if (mode === "register" && !name.trim()) return false;
    return true;
  }, [mode, email, pwd, name]);

  const switchMode = (target: "login" | "register") => {
    if (target === mode) return;
    setError(null);
    setInfo(null);
    setMode(target);
  };

  const toggleMode = () => {
    switchMode(mode === "login" ? "register" : "login");
  };

  // ===== 2. Logowanie =====
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pwd,
      });

      if (error) {
        if (error.code === "email_not_confirmed") {
          setError(
            "Email address has not been confirmed yet. Check your inbox (including SPAM) and click the activation link."
          );
        } else if (
          error.code === "invalid_credentials" ||
          error.code === "invalid_grant"
        ) {
          setError("Invalid email or password.");
        } else {
          setError(error.message || "Failed to log in.");
        }
        return;
      }

      if (!data.user) {
        setError("Login failed – no user in response.");
        return;
      }

      setUser(data.user);
    } catch (err: any) {
      console.error("[AuthGate] Login error:", err);
      setError("Failed to log in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ===== 3. Rejestracja (tylko rola 'scout') =====
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pwd,
        options: {
          data: {
            full_name: name.trim(),
            role: DEFAULT_ROLE,
          },
        },
      });

      if (error) {
        if (error.code === "email_exists") {
          setError("An account with this email address already exists.");
        } else {
          setError(error.message || "Failed to create an account.");
        }
        return;
      }

      if (!data.user) {
        setInfo(
          "Account created. Please check your inbox and confirm your email address, then log in."
        );
        setMode("login");
        return;
      }

      // Create profile with active: false
      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: name.trim(),
          role: DEFAULT_ROLE,
          active: false, // Account starts as inactive
        });
      } catch (e) {
        console.warn("[AuthGate] Failed to save profile:", e);
      }

      // Send activation email via API
      try {
        const activationRes = await fetch("/api/auth/send-activation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim(),
            userId: data.user.id,
          }),
        });

        if (!activationRes.ok) {
          console.warn("Failed to send activation email");
        }
      } catch (err) {
        console.error("Error sending activation email:", err);
      }

      // DO NOT auto-login - show message instead
      setInfo(
        "Account created! Check your email - we've sent an activation link. You'll be able to log in after activation."
      );
      setMode("login");
      // Clear form
      setName("");
      setEmail("");
      setPwd("");
    } catch (err: any) {
      console.error("[AuthGate] Register error:", err);
      setError("Failed to create an account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ===== 3a. Google OAuth (login / utworzenie konta) =====
  const handleGoogleAuth = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error("[AuthGate] Google OAuth error:", error);
        setError(error.message || "Failed to connect with Google.");
        setBusy(false);
        return;
      }

      // Supabase i tak robi pełny redirect,
      // ale zostawiamy fallback:
      setBusy(false);
    } catch (err: any) {
      console.error("[AuthGate] Google OAuth error:", err);
      setError("Failed to connect with Google. Please try again.");
      setBusy(false);
    }
  };

  // ===== 4. Wylogowanie =====
  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error("[AuthGate] Logout error:", err);
    }
  };

  // ===== 5. Ładowanie początkowe =====
  if (initialLoading) {
    return <LoaderOverlay text="Loading account…" />;
  }

  // ✅ IMPORTANT: nie blokuj ścieżek, które finalizują OAuth
  // (inaczej AuthGate pokaże login i callback nie wykona exchangeCodeForSession)
  if (
    pathname?.startsWith("/auth/callback") ||
    pathname?.startsWith("/auth/finish")
  ) {
    return <>{children}</>;
  }

  // ===== 6. Widok logowania / rejestracji =====
  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-stone-100 text-stone-900 dark:bg-slate-950 dark:text-stone-50">
        {/* Gradient + noise background (może zostać, UI w środku jest zaokrąglony-md) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.16),transparent_60%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-soft-light"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.9'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10 flex min-h-screen items-start justify-center px-3 py-8 pb-24 sm:py-10 md:items-center md:pb-10">
          <div className="w-full max-w-lg">
            {/* Główny nagłówek */}
            <div className="mb-5 text-center">
              <p className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>entrisoScouting • login panel</span>
              </p>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                entrisoScouting
              </h1>
              <p className="mt-2 text-[13px] text-stone-600 dark:text-stone-300">
                A modern environment for managing your player database,
                observations and reports in one consistent system.
              </p>
            </div>

            {/* Strzałki + karta */}
            <div
              className="relative mx-auto flex items-center justify-center"
              style={{ perspective: "1200px" }}
            >
              {/* Karta – teraz rounded-md */}
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: easeOutCustom }}
                className="w-full rounded-md bg-white/90 p-4 text-stone-900 shadow-[0_18px_60px_rgba(15,23,42,0.18)] ring-1 ring-stone-200/80 backdrop-blur-xl dark:bg-slate-950/70 dark:text-stone-50 dark:ring-stone-800/80 md:p-6"
              >
                {/* Przełącznik Logowanie / Rejestracja */}
                <div className="mb-4 flex flex-col gap-2">
                  <div className="flex justify-center">
                    <div className="inline-flex rounded-md bg-stone-100/80 p-1 text-xs ring-1 ring-stone-200 dark:bg-stone-900/80 dark:ring-stone-700/80">
                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className={`rounded-md px-4 py-1.5 text-[11px] transition-all ${mode === "login"
                          ? "bg-stone-900 text-stone-50 shadow-sm dark:bg-stone-100 dark:text-slate-950"
                          : "text-stone-700 hover:text-stone-900 dark:text-stone-200 dark:hover:text-stone-50"
                          }`}
                      >
                        Login
                      </button>
                      <button
                        type="button"
                        onClick={() => switchMode("register")}
                        className={`rounded-md px-4 py-1.5 text-[11px] transition-all ${mode === "register"
                          ? "bg-stone-900 text-stone-50 shadow-sm dark:bg-stone-100 dark:text-slate-950"
                          : "text-stone-700 hover:text-stone-900 dark:text-stone-200 dark:hover:text-stone-50"
                          }`}
                      >
                        Register
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={mode}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="pt-3 pb-3 text-center text-[11px] text-stone-600 dark:text-stone-300"
                    >
                      {mode === "login" ? (
                        <>
                          Log in to continue working on the player database,
                          observations, and reports assigned to your account.
                        </>
                      ) : (
                        <>
                          By registering, you create your own workspace in{" "}
                          <span className="font-medium">entrisoScouting</span> —{" "}
                          build a player database, add match observations.
                        </>
                      )}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Obszar formularza – bez fixed height, bez absolute, height = content */}
                <div className="mt-1">
                  <AnimatePresence mode="wait">
                    {mode === "login" ? (
                      <motion.form
                        key="login"
                        id="auth-login-form"
                        onSubmit={handleLogin}
                        className="flex flex-col space-y-3"
                        autoComplete="on"
                        initial={{ opacity: 0, x: -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 18 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                        <div>
                          <label className="mb-1 block text-[11px] text-stone-700 dark:text-stone-200">
                            E-mail
                          </label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <Input
                              ref={emailInputRef}
                              type="email"
                              className="mx-auto flex h-10 w-[calc(100%-4px)] rounded-md border border-stone-300 bg-white/90 px-3 py-2 pl-8 pr-3 text-sm text-stone-900 placeholder:text-stone-400 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-300"
                              placeholder="e.g. john@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              autoComplete="email"
                              inputMode="email"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] text-stone-700 dark:text-stone-200">
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <Input
                              type={showPass ? "text" : "password"}
                              className="mx-auto flex h-10 w-[calc(100%-4px)] rounded-md border border-stone-300 bg-white/90 px-3 py-2 pl-8 pr-9 text-sm text-stone-900 placeholder:text-stone-400 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-300"
                              placeholder="Password"
                              value={pwd}
                              onChange={(e) => setPwd(e.target.value)}
                              onKeyUp={(e) =>
                                setCapsOn(
                                  (e as any).getModifierState &&
                                  (e as any).getModifierState("CapsLock")
                                )
                              }
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPass((s) => !s)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50"
                              aria-label={showPass ? "Hide password" : "Show password"}
                            >
                              {showPass ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <div className="mt-1 flex justify-between text-[10px] text-stone-500 dark:text-stone-400">
                            {capsOn && (
                              <span className="text-amber-500">
                                Caps Lock is on – watch your case sensitivity.
                              </span>
                            )}
                          </div>
                        </div>

                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-md border border-rose-500/40 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/60 dark:text-rose-100"
                          >
                            {error}
                          </motion.div>
                        )}

                        {info && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100"
                          >
                            {info}
                          </motion.div>
                        )}

                        {/* Desktop CTA; na mobile korzystamy z paska dolnego */}
                        <div className="mt-auto hidden md:block">
                          <Button
                            type="submit"
                            disabled={!canSubmit || busy}
                            className="h-9 w-full rounded-md bg-stone-900 text-[11px] font-semibold uppercase tracking-wide text-stone-50 hover:bg-black disabled:opacity-60 dark:bg-stone-100 dark:text-slate-950 dark:hover:bg-white"
                          >
                            {busy ? "Logging in..." : "Log in"}
                          </Button>
                        </div>
                      </motion.form>
                    ) : (
                      <motion.form
                        key="register"
                        id="auth-register-form"
                        onSubmit={handleRegister}
                        className="flex flex-col space-y-3"
                        autoComplete="on"
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -18 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                        <div>
                          <label className="mb-1 block text-[11px] text-stone-700 dark:text-stone-200">
                            Full name
                          </label>
                          <div className="relative">
                            <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <Input
                              ref={nameInputRef}
                              className="mx-auto flex h-10 w-[calc(100%-4px)] rounded-md border border-stone-300 bg-white/90 px-3 py-2 pl-8 pr-3 text-sm text-stone-900 placeholder:text-stone-400 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-300"
                              placeholder="e.g. John Doe"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              autoComplete="name"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] text-stone-700 dark:text-stone-200">
                            E-mail
                          </label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <Input
                              ref={emailInputRef}
                              type="email"
                              className="mx-auto flex h-10 w-[calc(100%-4px)] rounded-md border border-stone-300 bg-white/90 px-3 py-2 pl-8 pr-3 text-sm text-stone-900 placeholder:text-stone-400 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-300"
                              placeholder="e.g. john@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              autoComplete="email"
                              inputMode="email"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] text-stone-700 dark:text-stone-200">
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <Input
                              type={showPass ? "text" : "password"}
                              className="mx-auto flex h-10 w-[calc(100%-4px)] rounded-md border border-stone-300 bg-white/90 px-3 py-2 pl-8 pr-9 text-sm text-stone-900 placeholder:text-stone-400 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-300"
                              placeholder="min. 6 characters"
                              value={pwd}
                              onChange={(e) => setPwd(e.target.value)}
                              onKeyUp={(e) =>
                                setCapsOn(
                                  (e as any).getModifierState &&
                                  (e as any).getModifierState("CapsLock")
                                )
                              }
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPass((s) => !s)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-50"
                              aria-label={showPass ? "Hide password" : "Show password"}
                            >
                              {showPass ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <div className="mt-1 flex justify-between text-[10px] text-stone-500 dark:text-stone-400">
                            {capsOn && (
                              <span className="text-amber-500">
                                Caps Lock is on – watch your case sensitivity.
                              </span>
                            )}
                          </div>

                          {/* Segmentowy wskaźnik siły hasła – rounded-md */}
                          <div className="mt-2">
                            <div className="mb-1 flex items-center justify-between text-[11px] text-stone-700 dark:text-stone-200">
                              <span className="inline-flex items-center gap-1 opacity-80">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Password strength
                              </span>
                              <span className="opacity-80">
                                {strengthLabel(passScore)}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {[0, 1, 2, 3].map((i) => {
                                const isActive = i < passScore;
                                const activeColor =
                                  passScore <= 1
                                    ? "bg-rose-500"
                                    : passScore === 2
                                      ? "bg-amber-500"
                                      : passScore === 3
                                        ? "bg-emerald-500"
                                        : "bg-green-500";
                                return (
                                  <div
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-md transition-colors ${isActive
                                      ? activeColor
                                      : "bg-stone-200 dark:bg-stone-800"
                                      }`}
                                  />
                                );
                              })}
                            </div>
                            <p className="mt-1 text-[10px] text-stone-500 dark:text-stone-400">
                              A good password contains at least 6 characters, uppercase letter,
                              digit, and special character.
                            </p>
                          </div>
                        </div>

                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-md border border-rose-500/40 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/60 dark:text-rose-100"
                          >
                            {error}
                          </motion.div>
                        )}

                        {info && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100"
                          >
                            {info}
                          </motion.div>
                        )}

                        {/* Desktop CTA; na mobile korzystamy z paska dolnego */}
                        <div className="mt-auto hidden md:block">
                          <Button
                            type="submit"
                            disabled={!canSubmit || busy}
                            className="h-9 w-full rounded-md bg-stone-900 text-[11px] font-semibold uppercase tracking-wide text-stone-50 hover:bg-black disabled:opacity-60 dark:bg-stone-100 dark:text-slate-950 dark:hover:bg-white"
                          >
                            {busy ? "Creating account…" : "Create Scout account"}
                          </Button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>

                {/* Separator + Google */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                    <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
                    <span className="uppercase tracking-[0.18em]">or</span>
                    <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
                  </div>
                  <Button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={busy}
                    variant="outline"
                    className="inline-flex w-full items-center justify-center gap-3 rounded-[4px] border border-[#dadce0] bg-white h-10 px-4 text-sm font-medium text-[#3c4043] transition-colors hover:bg-[#f8f9fa] hover:border-[#d2d4d7] focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#dadce0] dark:bg-white dark:border-[#dadce0] dark:text-[#3c4043] dark:hover:bg-[#f8f9fa]"
                  >
                    <svg
                      width="18"
                      height="18"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                    >
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                    <span className="truncate">
                      {busy
                        ? "Connecting with Google…"
                        : mode === "login"
                          ? "Log in with Google"
                          : "Create account with Google"}
                    </span>
                  </Button>
                  <p className="text-center text-[10px] text-stone-500 dark:text-stone-400">
                    A Google account automatically creates or links your
                    entrisoScouting account based on the email address.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Mobilny pasek z CTA przyklejony do dołu */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-3 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.22)] backdrop-blur-sm dark:border-stone-800/80 dark:bg-slate-950/95 md:hidden">
            <Button
              type="submit"
              form={mode === "login" ? "auth-login-form" : "auth-register-form"}
              disabled={!canSubmit || busy}
              className="h-10 w-full rounded-md bg-stone-900 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-50 hover:bg-black disabled:opacity-50 dark:bg-stone-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {busy
                ? mode === "login"
                  ? "Logging in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 7. Zalogowany użytkownik -> aplikacja =====
  return <>{children}</>;
}
