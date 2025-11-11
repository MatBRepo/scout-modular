"use client";

import { useEffect, useMemo, useState } from "react";
import LoaderOverlay from "@/shared/ui/LoaderOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = "admin" | "scout" | "scout-agent";
type AuthUser = { name: string; email: string; role: Role };

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);

  // form state
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [role, setRole] = useState<Role>("scout");
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
    // Only gate on localhost; otherwise pass-through
    if (!isLocalhost()) {
      setAuthed(true);
      return;
    }
    try {
      const raw = localStorage.getItem("s4s.auth");
      setAuthed(Boolean(raw));
    } catch {
      setAuthed(false);
    }
  }, []);

  const canSubmit = useMemo(() => {
    if (mode === "login") return email.trim() && pwd.trim();
    return name.trim() && email.trim() && pwd.trim();
  }, [mode, name, email, pwd]);

  function fakeHash(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return String(h);
  }

  function doLogin() {
    setError("");
    try {
      const usersRaw = localStorage.getItem("s4s.users");
      const users = usersRaw ? JSON.parse(usersRaw) as Record<string, any> : {};
      const u = users[email.toLowerCase()];
      if (!u || u.pwd !== fakeHash(pwd)) {
        setError("Nieprawidłowy e-mail lub hasło.");
        return;
      }
      localStorage.setItem("s4s.auth", JSON.stringify({ name: u.name, email: u.email, role: u.role } as AuthUser));
      afterAuth();
    } catch {
      setError("Błąd logowania (LocalStorage).");
    }
  }

  function doRegister() {
    setError("");
    try {
      const usersRaw = localStorage.getItem("s4s.users");
      const users = usersRaw ? JSON.parse(usersRaw) as Record<string, any> : {};
      const key = email.toLowerCase();
      if (users[key]) {
        setError("Użytkownik z tym e-mailem już istnieje.");
        return;
      }
      users[key] = { name: name.trim(), email: key, pwd: fakeHash(pwd), role };
      localStorage.setItem("s4s.users", JSON.stringify(users));
      localStorage.setItem("s4s.auth", JSON.stringify({ name: name.trim(), email: key, role } as AuthUser));
      afterAuth();
    } catch {
      setError("Błąd rejestracji (LocalStorage).");
    }
  }

  function afterAuth() {
    setAuthed(true);
    // short loader to “boot” dashboard
    setLoadingDash(true);
    setTimeout(() => setLoadingDash(false), 900);
    // also seed role into sidebar storage so it stays consistent
    try {
      const auth = JSON.parse(localStorage.getItem("s4s.auth") || "{}") as AuthUser;
      if (auth?.role) localStorage.setItem("s4s.role", auth.role);
      // ping other tabs
      window.dispatchEvent(new StorageEvent("storage", { key: "s4s.role" }));
    } catch {}
  }

  function logout() {
    try {
      localStorage.removeItem("s4s.auth");
      setAuthed(false);
      setMode("login");
      setEmail("");
      setPwd("");
    } catch {}
  }

  // Server render placeholder
  if (!mounted || authed === null) return null;

  // If not localhost → no gate
  if (!isLocalhost()) return <>{children}</>;

  if (!authed) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950">
        <div className="mx-auto max-w-lg px-4 py-12">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              {/* same icon, subtle pulse */}
              <svg className="h-5 w-5 text-gray-800 dark:text-neutral-200" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13.5867 2.30659L10.6667 1.33325C10.6667 2.0405 10.3857 2.71877 9.88565 3.21887C9.38555 3.71897 8.70727 3.99992 8.00003 3.99992C7.29278 3.99992 6.61451 3.71897 6.11441 3.21887C5.61431 2.71877 5.33336 2.0405 5.33336 1.33325L2.41336 2.30659C2.11162 2.40711 1.85575 2.6122 1.69193 2.88481C1.52811 3.15743 1.46715 3.47963 1.52003 3.79325L1.90669 6.10659C1.93208 6.26319 2.01248 6.40562 2.13345 6.50826C2.25443 6.61091 2.40804 6.66704 2.56669 6.66659H4.00003V13.3333C4.00003 14.0666 4.60003 14.6666 5.33336 14.6666H10.6667C11.0203 14.6666 11.3595 14.5261 11.6095 14.2761C11.8596 14.026 12 13.6869 12 13.3333V6.66659H13.4334C13.592 6.66704 13.7456 6.61091 13.8666 6.50826C13.9876 6.40562 14.068 6.26319 14.0934 6.10659L14.48 3.79325C14.5329 3.47963 14.4719 3.15743 14.3081 2.88481C14.1443 2.6122 13.8884 2.40711 13.5867 2.30659Z"
                  stroke="currentColor" strokeWidth="0.222" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h1 className="text-sm font-semibold">Zaloguj się do S4S</h1>
            <p className="mt-1 text-sm text-dark dark:text-neutral-300">Środowisko deweloperskie (localhost)</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 md:p-6">
            {/* tabs */}
            <div className="mb-4 inline-flex overflow-hidden rounded border dark:border-neutral-700">
              {(["login", "register"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className={`px-3 py-1 text-sm ${mode === m ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"}`}
                >
                  {m === "login" ? "Logowanie" : "Rejestracja"}
                </button>
              ))}
            </div>

            {/* form */}
            <div className="grid gap-3">
              {mode === "register" && (
                <>
                  <label className="text-xs text-dark dark:text-neutral-400">Imię i nazwisko</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. Jan Kowalski" />
                </>
              )}

              <label className="text-xs text-dark dark:text-neutral-400">E-mail</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="np. jan@example.com" />

              <label className="text-xs text-dark dark:text-neutral-400">Hasło</label>
              <Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" />

              {mode === "register" && (
                <>
                  <label className="text-xs text-dark dark:text-neutral-400">Rola</label>
                  <select
                    className="w-full rounded border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    value={role}
                    onChange={e => setRole(e.target.value as Role)}
                  >
                    <option value="scout">Scout</option>
                    <option value="scout-agent">Scout Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </>
              )}

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="mt-2 flex items-center justify-end gap-2">
                {mode === "login" ? (
                  <Button
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    disabled={!canSubmit}
                    onClick={doLogin}
                  >
                    Zaloguj
                  </Button>
                ) : (
                  <Button
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    disabled={!canSubmit}
                    onClick={doRegister}
                  >
                    Zarejestruj
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                // quick demo user
                const demo = { name: "Demo Admin", email: "admin@local", role: "admin" as Role };
                localStorage.setItem("s4s.auth", JSON.stringify(demo));
                localStorage.setItem("s4s.role", demo.role);
                setAuthed(true);
                setLoadingDash(true);
                setTimeout(() => setLoadingDash(false), 900);
              }}
              className="text-xs text-dark underline dark:text-neutral-400"
            >
              Wpuść mnie jako demo admin
            </button>
          </div>
        </div>
        {loadingDash && <LoaderOverlay />}
      </div>
    );
  }

  // Authed view
  return (
    <>
      {children}
      {loadingDash && <LoaderOverlay />}
      {/* small logout helper (optional, dev only) */}
      <div className="fixed bottom-3 right-3 z-[150]">
        <button
          onClick={logout}
          className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-dark shadow-sm hover:bg-stone-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
          title="Wyloguj (dev)"
        >
          Wyloguj
        </button>
      </div>
    </>
  );
}
