// src/app/AuthGate.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
  ["Bardzo słabe", "Słabe", "Średnie", "Dobre", "Bardzo dobre"][n] || "Bardzo słabe";

const easeOutCustom = [0.2, 0.7, 0.2, 1] as const;

export default function AuthGate({ children }: { children: React.ReactNode }) {
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

  const passScore = strengthScore(pwd);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !pwd.trim()) return false;
    if (pwd.length < 6) return false;
    if (mode === "register" && !name.trim()) return false;
    return true;
  }, [mode, email, pwd, name]);

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

      setUser(data.user); // onAuthStateChange i tak to przejmie
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
      <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center px-3">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.45, ease: easeOutCustom }}
          className="w-full max-w-md rounded-md border border-gray-200 bg-white p-4 shadow-lg shadow-black/5 dark:border-neutral-800 dark:bg-neutral-950 md:p-6"
        >
          {/* Nagłówek */}
          <div className="mb-4 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: easeOutCustom, delay: 0.05 }}
              className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-gray-900 text-white shadow-sm shadow-black/20 dark:bg-white dark:text-neutral-900"
            >
              <span className="text-sm font-bold leading-none">S4S</span>
            </motion.div>
            <h1 className="text-base font-semibold">
              entrisoScouting – panel logowania
            </h1>
            <p className="mt-1 text-xs text-gray-600 dark:text-neutral-400">
              Zarządzaj bazą zawodników i obserwacjami.{" "}
              <span className="hidden sm:inline">
                Zaloguj się lub utwórz konto (domyślnie rola Scout).
              </span>
            </p>
          </div>

          {/* Przełącznik Logowanie / Rejestracja */}
          <div className="mb-4 flex justify-center">
            <div className="inline-flex rounded-md bg-gray-100 p-1 text-xs dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setInfo(null);
                }}
                className={`rounded-md px-4 py-1.5 transition ${
                  mode === "login"
                    ? "bg-gray-900 text-white shadow-sm shadow-black/20 dark:bg-white dark:text-neutral-900"
                    : "text-gray-700 dark:text-neutral-200"
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
                className={`rounded-md px-4 py-1.5 transition ${
                  mode === "register"
                    ? "bg-gray-900 text-white shadow-sm shadow-black/20 dark:bg-white dark:text-neutral-900"
                    : "text-gray-700 dark:text-neutral-200"
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
          >
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-xs text-gray-700 dark:text-neutral-300">
                  Imię i nazwisko
                </label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-8 pr-3 text-sm rounded-md"
                    placeholder="np. Jan Kowalski"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-gray-700 dark:text-neutral-300">
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="email"
                  className="pl-8 pr-3 text-sm rounded-md"
                  placeholder="np. jan@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-700 dark:text-neutral-300">
                Hasło
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type={showPass ? "text" : "password"}
                  className="pl-8 pr-9 text-sm rounded-md"
                  placeholder={mode === "login" ? "Hasło" : "min. 6 znaków"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  onKeyUp={(e) =>
                    setCapsOn(
                      (e as any).getModifierState &&
                        (e as any).getModifierState("CapsLock")
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  aria-label={showPass ? "Ukryj hasło" : "Pokaż hasło"}
                >
                  {showPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {capsOn && (
                <div className="mt-1 text-[11px] text-amber-600">
                  Włączony Caps Lock – uważaj na wielkość liter.
                </div>
              )}

              {/* Pasek siły hasła – tylko w trybie rejestracji */}
              {mode === "register" && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 opacity-75">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Siła hasła
                    </span>
                    <span className="opacity-75">
                      {strengthLabel(passScore)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-md bg-slate-200 dark:bg-neutral-800">
                    <div
                      className={`h-2 rounded-md transition-[width] ${
                        passScore <= 1
                          ? "bg-rose-500"
                          : passScore === 2
                          ? "bg-amber-500"
                          : passScore === 3
                          ? "bg-emerald-500"
                          : "bg-green-600"
                      }`}
                      style={{ width: `${(passScore / 4) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
                    Dobre hasło zawiera min. 6 znaków, duże litery, cyfry i znak
                    specjalny.
                  </p>
                </div>
              )}
            </div>

            {/* Podgląd roli (informacyjnie) */}
            {mode === "register" && (
              <div className="rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-700 ring-1 ring-slate-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-800">
                <span className="font-semibold">Rola konta:</span>{" "}
                <span className="inline-flex rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-slate-200 dark:text-neutral-900">
                  Scout (domyślnie)
                </span>
                <span className="block mt-1 opacity-80">
                  Uprawnienia Admin / Scout Agent możesz nadać ręcznie w
                  panelu administracyjnym.
                </span>
              </div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100"
              >
                {error}
              </motion.div>
            )}

            {info && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
              >
                {info}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={!canSubmit || busy}
              className="mt-1 h-9 w-full rounded-md bg-gray-900 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {busy
                ? mode === "login"
                  ? "Logowanie…"
                  : "Tworzenie konta…"
                : mode === "login"
                ? "Zaloguj się"
                : "Utwórz konto Scout"}
            </Button>
          </form>
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
          className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-800 shadow-sm hover:bg-stone-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
          title="Wyloguj"
        >
          Wyloguj
        </button>
      </div>
    </>
  );
}
