// src/app/AuthGate.tsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  useRef,
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
} from "lucide-react";
import { motion } from "framer-motion";

type Role = "admin" | "scout" | "scout-agent";
const DEFAULT_ROLE: Role = "scout";

const easeOutCustom = [0.2, 0.7, 0.2, 1] as const;

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

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // ===== 0. Wczytaj ostatnio użyty e-mail z localStorage =====
  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = window.localStorage.getItem("s4s.lastEmail");
    if (last && !email) {
      setEmail(last);
    }
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

  // Autofocus w zależności od trybu
  useEffect(() => {
    if (mode === "login") {
      emailInputRef.current?.focus();
    } else {
      nameInputRef.current?.focus();
    }
  }, [mode]);

  const passScore = strengthScore(pwd);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !pwd.trim()) return false;
    if (pwd.length < 6) return false;
    if (mode === "register" && !name.trim()) return false;
    return true;
  }, [mode, email, pwd, name]);

  function rememberEmail(currentEmail: string) {
    if (typeof window === "undefined") return;
    const clean = currentEmail.trim().toLowerCase();
    if (!clean) return;
    window.localStorage.setItem("s4s.lastEmail", clean);
  }

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

      rememberEmail(email);
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

      // jeśli wymagane potwierdzenie e-mail – user może być null
      if (!data.user) {
        rememberEmail(email);
        setInfo(
          "Konto zostało utworzone. Sprawdź skrzynkę pocztową i potwierdź adres e-mail, a następnie zaloguj się."
        );
        setMode("login");
        return;
      }

      // Upsert do profiles (powiązanie z auth.users)
      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: name.trim(),
          role: DEFAULT_ROLE,
        });
      } catch (e) {
        console.warn("[AuthGate] Nie udało się zapisać profilu:", e);
      }

      rememberEmail(email);
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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white flex items-center justify-center px-3">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: easeOutCustom }}
          className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/80 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="grid gap-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {/* main form card */}
            <div className="rounded-2xl bg-slate-950/60 p-4 md:p-6">
              {/* Nagłówek */}
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        duration: 0.35,
                        ease: easeOutCustom,
                        delay: 0.05,
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 shadow-sm shadow-black/30"
                    >
                      <span className="text-[13px] font-bold leading-none">
                        S4S
                      </span>
                    </motion.div>
                    <div className="space-y-0.5">
                      <h1 className="text-sm font-semibold">
                        entrisoScouting – panel
                      </h1>
                      <p className="text-[11px] text-slate-300">
                        Zarządzaj bazą zawodników i obserwacjami.
                      </p>
                    </div>
                  </div>
                  <span className="hidden rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30 md:inline-flex">
                    Wersja beta
                  </span>
                </div>
              </div>

              {/* Przełącznik Logowanie / Rejestracja */}
              <div className="mb-4 flex justify-center">
                <div className="inline-flex rounded-full bg-slate-900/80 p-1 text-xs ring-1 ring-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setInfo(null);
                    }}
                    className={`rounded-full px-4 py-1.5 transition-all ${
                      mode === "login"
                        ? "bg-slate-100 text-slate-900 shadow-sm shadow-black/30"
                        : "text-slate-200"
                    }`}
                  >
                    Logowanie
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                      setInfo(null);
                    }}
                    className={`rounded-full px-4 py-1.5 transition-all ${
                      mode === "register"
                        ? "bg-slate-100 text-slate-900 shadow-sm shadow-black/30"
                        : "text-slate-200"
                    }`}
                  >
                    Rejestracja
                  </button>
                </div>
              </div>

              {/* Formularz */}
              <form
                onSubmit={mode === "login" ? handleLogin : handleRegister}
                className="space-y-3"
                autoComplete="on"
              >
                {mode === "register" && (
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-200">
                      Imię i nazwisko
                    </label>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        ref={nameInputRef}
                        className="pl-8 pr-3 text-sm rounded-md border-slate-700 bg-slate-900/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-300"
                        placeholder="np. Jan Kowalski"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[11px] text-slate-200">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      ref={emailInputRef}
                      type="email"
                      className="pl-8 pr-3 text-sm rounded-md border-slate-700 bg-slate-900/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-300"
                      placeholder="np. jan@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Używamy tego adresu do logowania i powiadomień.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-slate-200">
                    Hasło
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      type={showPass ? "text" : "password"}
                      className="pl-8 pr-9 text-sm rounded-md border-slate-700 bg-slate-900/80 text-slate-50 placeholder:text-slate-500 focus-visible:ring-slate-300"
                      placeholder={mode === "login" ? "Hasło" : "min. 6 znaków"}
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      onKeyUp={(e) =>
                        setCapsOn(
                          (e as any).getModifierState &&
                            (e as any).getModifierState("CapsLock")
                        )
                      }
                      autoComplete={
                        mode === "login"
                          ? "current-password"
                          : "new-password"
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-300 hover:bg-slate-800"
                      aria-label={showPass ? "Ukryj hasło" : "Pokaż hasło"}
                    >
                      {showPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                    {capsOn && (
                      <span className="text-amber-400">
                        Włączony Caps Lock – uważaj na wielkość liter.
                      </span>
                    )}
                    <span className="ml-auto">
                      Enter = szybsze wysłanie formularza
                    </span>
                  </div>

                  {/* Pasek siły hasła – tylko w trybie rejestracji */}
                  {mode === "register" && (
                    <div className="mt-2">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-200">
                        <span className="inline-flex items-center gap-1 opacity-80">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Siła hasła
                        </span>
                        <span className="opacity-80">
                          {strengthLabel(passScore)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-2 rounded-full transition-[width] ${
                            passScore <= 1
                              ? "bg-rose-500"
                              : passScore === 2
                              ? "bg-amber-500"
                              : passScore === 3
                              ? "bg-emerald-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${(passScore / 4) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Dobre hasło zawiera min. 6 znaków, dużą literę, cyfrę i
                        znak specjalny.
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-md border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs text-rose-100"
                  >
                    {error}
                  </motion.div>
                )}

                {info && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-md border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-100"
                  >
                    {info}
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={!canSubmit || busy}
                  className="mt-1 h-9 w-full rounded-md bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-900 hover:bg-white disabled:opacity-60 disabled:hover:bg-slate-100"
                >
                  {busy
                    ? mode === "login"
                      ? "Logowanie…"
                      : "Tworzenie konta…"
                    : mode === "login"
                    ? "Zaloguj się"
                    : "Utwórz konto Scout"}
                </Button>

                <p className="mt-2 text-[10px] text-slate-500">
                  Logując się, akceptujesz regulamin i politykę prywatności
                  entrisoScouting.
                </p>
              </form>
            </div>

            {/* right side – opis / “marketing” */}
            <div className="hidden flex-col justify-between rounded-2xl bg-gradient-to-br from-emerald-500/15 via-sky-500/10 to-indigo-500/20 p-4 text-[11px] text-slate-100 ring-1 ring-white/5 md:flex">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                  Dla scoutów & analityków
                </p>
                <p className="text-xs font-medium">
                  Jedno miejsce na Twoją bazę zawodników
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-slate-100/90">
                  <li>• Szybkie dodawanie obserwacji i raportów</li>
                  <li>• Wspólna baza z innymi scoutami</li>
                  <li>• Konfigurowalne metryki oceny i role użytkowników</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-[10px] text-slate-300/90">
                <p className="font-medium text-slate-100">
                  Wskazówka bezpieczeństwa
                </p>
                <p>
                  Nie używaj tego samego hasła co do bankowości lub poczty
                  firmowej. Dbaj o unikalne hasła.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ===== 7. Zalogowany użytkownik -> aplikacja =====
  return (
    <>
      {children}

      {/* Dev helper – możesz usunąć, jak nie będzie potrzebny */}
      <div className="fixed bottom-3 right-3 z-[150]">
        <button
          onClick={logout}
          className="rounded-md border border-slate-600/70 bg-slate-950/80 px-3 py-1 text-xs text-slate-100 shadow-sm shadow-black/40 hover:bg-slate-800"
          title="Wyloguj"
        >
          Wyloguj
        </button>
      </div>
    </>
  );
}
