// src/shared/auth/AuthGate.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/shared/supabase-client";
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
  ["Bardzo słabe", "Słabe", "Średnie", "Dobre", "Bardzo dobre"][n] ||
  "Bardzo słabe";

const easeOutCustom = [0.2, 0.7, 0.2, 1] as const;

export default function AuthGate({ children }: { children: ReactNode }) {
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
      const { data, error } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (error || !data?.user) {
        setUser(null);
      } else {
        setUser(data.user);
      }
      setInitialLoading(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
            "Adres e-mail nie został jeszcze potwierdzony. Sprawdź skrzynkę (także SPAM) i kliknij link aktywacyjny."
          );
        } else if (
          error.code === "invalid_credentials" ||
          error.code === "invalid_grant"
        ) {
          setError("Nieprawidłowy e-mail lub hasło.");
        } else {
          setError(error.message || "Nie udało się zalogować.");
        }
        return;
      }

      if (!data.user) {
        setError("Logowanie nie powiodło się – brak użytkownika w odpowiedzi.");
        return;
      }

      setUser(data.user);
    } catch (err: any) {
      console.error("[AuthGate] Login error:", err);
      setError("Nie udało się zalogować. Spróbuj ponownie.");
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
          setError("Konto z takim adresem e-mail już istnieje.");
        } else {
          setError(error.message || "Nie udało się utworzyć konta.");
        }
        return;
      }

      if (!data.user) {
        setInfo(
          "Konto zostało utworzone. Sprawdź skrzynkę pocztową i potwierdź adres e-mail, a następnie zaloguj się."
        );
        setMode("login");
        return;
      }

      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: name.trim(),
          role: DEFAULT_ROLE,
        });
      } catch (e) {
        console.warn("[AuthGate] Nie udało się zapisać profilu:", e);
      }

      setUser(data.user);
      setInfo("Konto zostało utworzone i zalogowane.");
    } catch (err: any) {
      console.error("[AuthGate] Register error:", err);
      setError("Nie udało się utworzyć konta. Spróbuj ponownie.");
    } finally {
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
    return <LoaderOverlay text="Ładowanie konta…" />;
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
  <span>entrisoScouting • panel logowania</span>
</p>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                entrisoScouting
              </h1>
              <p className="mt-2 text-[13px] text-stone-600 dark:text-stone-300">
                Nowoczesne środowisko do zarządzania bazą zawodników,
                obserwacjami i raportami w jednym spójnym systemie.
              </p>
            </div>

            {/* Strzałki + karta */}
            <div
              className="relative mx-auto flex items-center justify-center"
              style={{ perspective: "1200px" }}
            >
              {/* Strzałka lewa – desktop only */}
              <button
                type="button"
                onClick={toggleMode}
                className="absolute -left-9 hidden h-9 w-9 items-center justify-center rounded-md text-stone-400 transition-transform duration-200 hover:-translate-x-1 hover:scale-110 hover:text-stone-900 dark:hover:text-stone-50 md:flex"
                aria-label="Przełącz widok"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Strzałka prawa – desktop only */}
              <button
                type="button"
                onClick={toggleMode}
                className="absolute -right-9 hidden h-9 w-9 items-center justify-center rounded-md text-stone-400 transition-transform duration-200 hover:translate-x-1 hover:scale-110 hover:text-stone-900 dark:hover:text-stone-50 md:flex"
                aria-label="Przełącz widok"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

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
                        className={`rounded-md px-4 py-1.5 text-[11px] transition-all ${
                          mode === "login"
                            ? "bg-stone-900 text-stone-50 shadow-sm dark:bg-stone-100 dark:text-slate-950"
                            : "text-stone-700 hover:text-stone-900 dark:text-stone-200 dark:hover:text-stone-50"
                        }`}
                      >
                        Logowanie
                      </button>
                      <button
                        type="button"
                        onClick={() => switchMode("register")}
                        className={`rounded-md px-4 py-1.5 text-[11px] transition-all ${
                          mode === "register"
                            ? "bg-stone-900 text-stone-50 shadow-sm dark:bg-stone-100 dark:text-slate-950"
                            : "text-stone-700 hover:text-stone-900 dark:text-stone-200 dark:hover:text-stone-50"
                        }`}
                      >
                        Rejestracja
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
                          Zaloguj się, aby kontynuować pracę na bazie
                          zawodników, obserwacjach i raportach przypisanych do
                          Twojego konta.
                        </>
                      ) : (
                        <>
                          Rejestrując się, tworzysz własną przestrzeń roboczą w{" "}
                          <span className="font-medium">entrisoScouting</span> —
                          buduj bazę zawodników, dodawaj obserwacje meczowe i
                          generuj raporty. Jeśli korzystasz z systemu klubowo,
                          użyj służbowego adresu e-mail.
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
                              placeholder="np. jan@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              autoComplete="email"
                              inputMode="email"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] text-stone-700 dark:text-stone-200">
                            Hasło
                          </label>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <Input
                              type={showPass ? "text" : "password"}
                              className="mx-auto flex h-10 w-[calc(100%-4px)] rounded-md border border-stone-300 bg-white/90 px-3 py-2 pl-8 pr-9 text-sm text-stone-900 placeholder:text-stone-400 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-300"
                              placeholder="Hasło"
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
                              aria-label={showPass ? "Ukryj hasło" : "Pokaż hasło"}
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
                                Włączony Caps Lock – uważaj na wielkość liter.
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
                            {busy ? "Logowanie…" : "Zaloguj się"}
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
                            Imię i nazwisko
                          </label>
                          <div className="relative">
                            <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <Input
                              ref={nameInputRef}
                              className="mx-auto flex h-10 w-[calc(100%-4px)] rounded-md border border-stone-300 bg-white/90 px-3 py-2 pl-8 pr-3 text-sm text-stone-900 placeholder:text-stone-400 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-300"
                              placeholder="np. Jan Kowalski"
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
                              placeholder="np. jan@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              autoComplete="email"
                              inputMode="email"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] text-stone-700 dark:text-stone-200">
                            Hasło
                          </label>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <Input
                              type={showPass ? "text" : "password"}
                              className="mx-auto flex h-10 w-[calc(100%-4px)] rounded-md border border-stone-300 bg-white/90 px-3 py-2 pl-8 pr-9 text-sm text-stone-900 placeholder:text-stone-400 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-50 dark:placeholder:text-stone-500 dark:focus-visible:ring-stone-300"
                              placeholder="min. 6 znaków"
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
                              aria-label={showPass ? "Ukryj hasło" : "Pokaż hasło"}
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
                                Włączony Caps Lock – uważaj na wielkość liter.
                              </span>
                            )}
                          </div>

                          {/* Segmentowy wskaźnik siły hasła – rounded-md */}
                          <div className="mt-2">
                            <div className="mb-1 flex items-center justify-between text-[11px] text-stone-700 dark:text-stone-200">
                              <span className="inline-flex items-center gap-1 opacity-80">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Siła hasła
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
                                    className={`h-1.5 flex-1 rounded-md transition-colors ${
                                      isActive
                                        ? activeColor
                                        : "bg-stone-200 dark:bg-stone-800"
                                    }`}
                                  />
                                );
                              })}
                            </div>
                            <p className="mt-1 text-[10px] text-stone-500 dark:text-stone-400">
                              Dobre hasło zawiera min. 6 znaków, dużą literę,
                              cyfrę i znak specjalny.
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
                            {busy ? "Tworzenie konta…" : "Utwórz konto Scout"}
                          </Button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>
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
                  ? "Logowanie…"
                  : "Tworzenie konta…"
                : mode === "login"
                ? "Zaloguj się"
                : "Utwórz konto"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 7. Zalogowany użytkownik -> aplikacja =====
  return (
    <>
      {children}
    </>
  );
}
