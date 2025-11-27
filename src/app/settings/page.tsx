// app/settings/page.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import { useRouter } from "next/navigation";
import { Crumb, ToolbarFull } from "@/shared/ui/atoms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarClock,
  ChevronDown,
  Globe2,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Shield,
  User,
} from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useHeaderActions } from "@/app/ClientRoot";

/* ======================= Types ======================= */

type Role = "admin" | "scout" | "scout-agent";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  active: boolean | null;
  last_active: string | null;
  country?: string | null; // requires profiles.country
};

/* ======================= Utils ======================= */

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function roleLabel(r?: Role | string | null) {
  if (r === "admin") return "Admin";
  if (r === "scout-agent") return "Scout-agent";
  if (r === "scout") return "Scout";
  return "Nieznana rola";
}

const stepPillClass =
  "inline-flex h-6 items-center rounded-md bg-stone-100 px-2.5 text-[11px] tracking-wide text-stone-600 dark:bg-neutral-900 dark:text-neutral-200";

/* ======================= Countries & Combobox ======================= */

type Country = { code: string; name: string; flag: string };

const COUNTRIES: Country[] = [
  { code: "PL", name: "Polska", flag: "🇵🇱" },
  { code: "DE", name: "Niemcy", flag: "🇩🇪" },
  { code: "GB", name: "Anglia", flag: "🇬🇧" },
  { code: "ES", name: "Hiszpania", flag: "🇪🇸" },
  { code: "IT", name: "Włochy", flag: "🇮🇹" },
  { code: "FR", name: "Francja", flag: "🇫🇷" },
  { code: "NL", name: "Holandia", flag: "🇳🇱" },
  { code: "PT", name: "Portugalia", flag: "🇵🇹" },
  { code: "SE", name: "Szwecja", flag: "🇸🇪" },
  { code: "NO", name: "Norwegia", flag: "🇳🇴" },
  { code: "DK", name: "Dania", flag: "🇩🇰" },
  { code: "BE", name: "Belgia", flag: "🇧🇪" },
  { code: "CH", name: "Szwajcaria", flag: "🇨🇭" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "CZ", name: "Czechy", flag: "🇨🇿" },
  { code: "SK", name: "Słowacja", flag: "🇸🇰" },
  { code: "UA", name: "Ukraina", flag: "🇺🇦" },
  { code: "LT", name: "Litwa", flag: "🇱🇹" },
  { code: "LV", name: "Łotwa", flag: "🇱🇻" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "HU", name: "Węgry", flag: "🇭🇺" },
  { code: "RO", name: "Rumunia", flag: "🇷🇴" },
  { code: "HR", name: "Chorwacja", flag: "🇭🇷" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SI", name: "Słowenia", flag: "🇸🇮" },
  { code: "GR", name: "Grecja", flag: "🇬🇷" },
  { code: "TR", name: "Turcja", flag: "🇹🇷" },
  { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "BR", name: "Brazylia", flag: "🇧🇷" },
  { code: "AR", name: "Argentyna", flag: "🇦🇷" },
];

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";

function CountrySearchCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm transition",
            "hover:bg:white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-0",
            "dark:border-neutral-700 dark:bg-neutral-950"
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected ? (
              <>
                <span className="text-lg leading-none">{selected.flag}</span>
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Wybierz kraj</span>
            )}
          </span>
          <ChevronsUpDown
            aria-hidden="true"
            className="ml-2 h-4 w-4 shrink-0 text-muted-foreground/80"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-[--radix-popover-trigger-width] p-0",
          "border border-gray-300 dark:border-neutral-700"
        )}
      >
        <Command>
          <CommandInput
            placeholder="Szukaj kraju..."
            className={cn(
              "m-2 h-9 w-[calc(100%-1rem)] rounded-md border border-stone-200 bg-background px-3 text-sm",
              "shadow-none outline-none",
              "focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:ring-offset-0",
              "dark:border-neutral-700 dark:bg-neutral-950"
            )}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>Brak wyników.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((country) => {
                const isActive = selected?.code === country.code;
                return (
                  <CommandItem
                    key={country.code}
                    value={country.name}
                    onSelect={() => {
                      onChange(country.name);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <span className="text-lg leading-none">
                      {country.flag}
                    </span>
                    <span className="truncate">{country.name}</span>
                    {isActive && (
                      <Check className="ml-auto h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ======================= Small UI helpers ======================= */

type SaveState = "idle" | "saving" | "saved";

function SavePill({
  state,
  size = "compact",
}: {
  state: SaveState;
  size?: "default" | "compact";
}) {
  const base =
    size === "compact"
      ? "inline-flex h-8 items-center rounded-md px-2 text-xs leading-none"
      : "inline-flex h-10 items-center rounded-md px-3 text-sm leading-none";

  const colorMap = {
    saving: "text-amber-700 dark:text-amber-200",
    saved: "text-emerald-700 dark:text-emerald-200",
    idle: "text-gray-600 dark:text-neutral-300",
  } as const;

  if (state === "idle") return null;

  return (
    <span className={cn(base, colorMap[state])} aria-live="polite">
      {state === "saving" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
          <span className="hidden md:inline">Autozapis…</span>
        </>
      ) : (
        <>
          <Check className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Zapisano</span>
        </>
      )}
    </span>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 text-[11px] transition-colors hover:border-stone-200 dark:hover:border-neutral-700">
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => onCheckedChange(!!val)}
        className="mt-0.5 h-3.5 w-3.5 border-gray-300 text-gray-900 dark:border-neutral-600"
      />
      <span className="space-y-0.5">
        <div className="font-medium text-gray-900 dark:text-neutral-100">
          {label}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {description}
        </p>
      </span>
    </label>
  );
}

const countTruthy = (vals: Array<unknown>) =>
  vals.filter((v) => {
    if (typeof v === "number") return v > 0;
    return !!(v !== null && v !== undefined && String(v).trim() !== "");
  }).length;

/* ======================= Page ======================= */

export default function SettingsPage() {
  const router = useRouter();
  const { setActions } = useHeaderActions();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    country: "",
  });
  const [email, setEmail] = useState<string>("");

  // steps open/close
  const [basicOpen, setBasicOpen] = useState(true);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // password change
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // preferences (local-only for now)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [productNews, setProductNews] = useState(false);
  const [darkSidebar, setDarkSidebar] = useState(false);

  // autosave
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string | null>(null);

  /* ---------- load profile & auth user ---------- */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabase();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) {
          if (!mounted) return;
          setProfile(null);
          setLoading(false);
          return;
        }

        const userId = user.id;

        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (profError) throw profError;
        if (!mounted) return;

        if (!prof) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const p = prof as ProfileRow;
        setProfile(p);
        setForm({
          fullName: p.full_name || "",
          phone: p.phone || "",
          country: p.country || "",
        });
        setEmail(p.email || user.email || "");
      } catch (e: any) {
        console.error("[SettingsPage] load error:", e);
        if (!mounted) return;
        setError(e?.message || "Nie udało się pobrać ustawień konta.");
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- profile completion (for header) ---------- */

  const profileCompletion = useMemo(() => {
    const fields = [
      form.fullName,
      email,
      form.phone,
      form.country && form.country !== "" ? form.country : "",
    ];
    const total = fields.length;
    const filled = fields.filter(
      (v) => v !== undefined && v !== null && String(v).trim() !== ""
    ).length;
    if (!total) return 0;
    return Math.round((filled / total) * 100);
  }, [form.fullName, form.phone, form.country, email]);

  const cntBasic = countTruthy([
    form.fullName,
    email,
    form.phone,
    form.country,
  ]);
  const basicMax = 4;

  /* ---------- autosave profile (full_name, phone, country) ---------- */

  useEffect(() => {
    let cancelled = false;

    if (!profile?.id) {
      setSaveState("idle");
      return;
    }

    // snapshot of what we really save
    const currentSnapshot = JSON.stringify({
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      country: form.country || "",
    });

    if (lastSavedSnapshotRef.current === currentSnapshot) {
      return;
    }

    setSaveError(null);
    setSaveState("saving");

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      (async () => {
        try {
          const supabase = getSupabase();

          const updates: Partial<ProfileRow> = {
            full_name: form.fullName.trim() || null,
            phone: form.phone.trim() || null,
            country: form.country || null,
          };

          const { error: updateError } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", profile.id);

          if (updateError) {
            console.error("[SettingsPage] Supabase update error:", updateError);
            if (!cancelled) {
              setSaveState("idle");
              setSaveError("Nie udało się zapisać danych profilu.");
            }
            return;
          }

          if (!cancelled) {
            lastSavedSnapshotRef.current = currentSnapshot;
            setSaveState("saved");
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    full_name: updates.full_name ?? prev.full_name,
                    phone: updates.phone ?? prev.phone,
                    country: updates.country ?? prev.country,
                  }
                : prev
            );
          }
        } catch (err) {
          console.error("[SettingsPage] Supabase update exception:", err);
          if (!cancelled) {
            setSaveState("idle");
            setSaveError("Wystąpił błąd podczas zapisu profilu.");
          }
        }
      })();
    }, 700);

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [profile?.id, form.fullName, form.phone, form.country]);

  /* ---------- change password ---------- */

  async function handleChangePassword() {
    setPasswordError(null);

    if (!newPassword || !newPasswordConfirm) {
      setPasswordError("Wpisz nowe hasło w oba pola.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError("Hasła nie są takie same.");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setNewPassword("");
      setNewPasswordConfirm("");
      toast.success("Hasło zostało zmienione.");
    } catch (e: any) {
      console.error("[SettingsPage] change password error:", e);
      setPasswordError(
        e?.message ||
          "Nie udało się zmienić hasła. Spróbuj ponownie lub użyj resetu hasła e-mailem."
      );
      toast.error("Błąd podczas zmiany hasła.");
    } finally {
      setSavingPassword(false);
    }
  }

  /* ---------- header actions (SavePill + progress) ---------- */

  useEffect(() => {
    const node = (
      <div className="flex items-center gap-3">
        <SavePill state={saveState} size="compact" />
        <div className="flex flex-col items-end gap-0.5">
          <span className="hidden text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:inline">
            Kompletność profilu
          </span>
          <div className="flex items-center gap-2">
            <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-stone-200 dark:bg-neutral-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-stone-700 dark:text-neutral-200">
              {profileCompletion}%
            </span>
          </div>
        </div>
      </div>
    );

    setActions(node);
    return () => {
      setActions(null);
    };
  }, [setActions, saveState, profileCompletion]);

  /* ---------- title node ---------- */

  const titleNode = (
    <div className="w-full">
      <div className="flex w-full items-center gap-2">
        <h2 className="mt-1 text-xl font-semibold leading-none tracking-tight">
          Ustawienia konta
        </h2>
        {profile && (
          <span className="ml-auto inline-flex items-center rounded bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-200 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700">
            {roleLabel(profile.role as Role)}
          </span>
        )}
      </div>
    </div>
  );

  /* ---------- not logged-in state ---------- */

  if (!loading && !profile && !error) {
    return (
      <div className="w-full space-y-4">
        <Crumb
          items={[
            { label: "Start", href: "/" },
            { label: "Ustawienia konta" },
          ]}
        />
        <ToolbarFull title={titleNode} right={null} />
        <Card className="border-gray-300 bg-white/70 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
          <CardContent className="flex flex-col items-start gap-3 p-4 text-sm text-dark dark:text-neutral-300 sm:flex-row sm:items-center sm:justify-between">
            <span>Musisz być zalogowany, aby zarządzać ustawieniami konta.</span>
            <Button onClick={() => router.push("/login")}>Zaloguj się</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- main render ---------- */

  return (
    <div className="w-full space-y-4">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Ustawienia konta" },
        ]}
      />

      <ToolbarFull title={titleNode} right={null} />

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* skeleton */}
      {loading && (
        <Card className="border-dashed border-stone-300 bg-stone-50/80 dark:border-neutral-800 dark:bg-neutral-950/60">
          <CardContent className="px-4 py-6 text-sm text-stone-600 dark:text-neutral-300">
            Ładowanie ustawień konta…
          </CardContent>
        </Card>
      )}

      {!loading && profile && (
        <div className="space-y-4">
          {/* STEP 1 – Dane profilu */}
          <Card className="mt-1">
            <CardHeader
              className={cn(
                "group flex items-center justify-between rounded-md border-gray-200 p-0 transition-colors hover:bg-stone-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
                basicOpen && "bg-stone-100 dark:bg-neutral-900/70"
              )}
            >
              <button
                type="button"
                aria-expanded={basicOpen}
                aria-controls="basic-panel"
                onClick={() => setBasicOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <div>
                  <div className={stepPillClass}>Krok 1 · Dane profilu</div>
                  <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                    Podstawowe informacje
                  </div>
                  <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                    Imię i nazwisko, dane kontaktowe i kraj — baza do
                    dopasowywania widoków i rozgrywek.
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                    {cntBasic}/{basicMax}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 transition-transform",
                      basicOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </div>
              </button>
            </CardHeader>
            <CardContent className="px-4 py-0 md:px-4">
              <Accordion
                type="single"
                collapsible
                value={basicOpen ? "basic" : undefined}
                onValueChange={(v) => setBasicOpen(v === "basic")}
                className="w-full"
              >
                <AccordionItem value="basic" className="border-0">
                  <AccordionContent id="basic-panel" className="pt-4 pb-5">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label className="text-sm">Imię i nazwisko</Label>
                          <div className="relative mt-1">
                            <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                            </span>
                            <Input
                              className="pl-9"
                              placeholder="Twoje imię i nazwisko"
                              value={form.fullName}
                              onChange={(e) =>
                                setForm((s) => ({
                                  ...s,
                                  fullName: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm">E-mail logowania</Label>
                          <div className="relative mt-1">
                            <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                            </span>
                            <Input
                              className="pl-9"
                              value={email}
                              disabled
                              readOnly
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Zmiana adresu logowania wymaga osobnego procesu
                            bezpieczeństwa.
                          </p>
                        </div>

                        <div>
                          <Label className="text-sm">Telefon</Label>
                          <div className="relative mt-1">
                            <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                            </span>
                            <Input
                              className="pl-9"
                              placeholder="+48 123 456 789"
                              value={form.phone}
                              onChange={(e) =>
                                setForm((s) => ({
                                  ...s,
                                  phone: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm">Kraj</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <Globe2 className="hidden h-4 w-4 text-muted-foreground md:inline" />
                            <div className="w-full">
                              <CountrySearchCombobox
                                value={form.country}
                                onChange={(val) =>
                                  setForm((s) => ({ ...s, country: val }))
                                }
                              />
                            </div>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Kraj pomaga dopasować domyślne rozgrywki, strefę
                            czasową i rekomendacje.
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          Rola:{" "}
                          <span className="font-medium">
                            {roleLabel(profile.role as Role)}
                          </span>
                        </span>
                        {profile.last_active && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" />
                            ostatnia aktywność: {fmtDate(profile.last_active)}
                          </span>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* STEP 2 – Bezpieczeństwo */}
          <Card className="mt-1">
            <CardHeader
              className={cn(
                "group flex items-center justify-between rounded-md border-gray-200 p-0 transition-colors hover:bg-stone-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
                securityOpen && "bg-stone-100 dark:bg-neutral-900/70"
              )}
            >
              <button
                type="button"
                aria-expanded={securityOpen}
                aria-controls="security-panel"
                onClick={() => setSecurityOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <div>
                  <div className={stepPillClass}>Krok 2 · Bezpieczeństwo</div>
                  <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                    Hasło i dostęp
                  </div>
                  <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                    Zmień hasło do logowania. Hasło nie jest pokazywane ani
                    przechowywane w panelu administracyjnym.
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 transition-transform",
                      securityOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </div>
              </button>
            </CardHeader>
            <CardContent className="px-4 py-0 md:px-4">
              <Accordion
                type="single"
                collapsible
                value={securityOpen ? "security" : undefined}
                onValueChange={(v) => setSecurityOpen(v === "security")}
                className="w-full"
              >
                <AccordionItem value="security" className="border-0">
                  <AccordionContent id="security-panel" className="pt-4 pb-5">
                    <div className="space-y-3 text-sm">
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        Po zmianie hasła możesz zostać wylogowany z innych
                        urządzeń. Użyj unikalnego hasła, którego nie używasz w
                        innych serwisach.
                      </p>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Nowe hasło
                          </Label>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Minimum 8 znaków"
                            value={newPassword}
                            onChange={(e) =>
                              setNewPassword(e.target.value)
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Powtórz nowe hasło
                          </Label>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            value={newPasswordConfirm}
                            onChange={(e) =>
                              setNewPasswordConfirm(e.target.value)
                            }
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {passwordError && (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                          {passwordError}
                        </div>
                      )}

                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={handleChangePassword}
                          disabled={savingPassword}
                          className="min-w-[180px] bg-gray-900 text-white hover:bg-gray-800"
                        >
                          <LockKeyhole className="mr-2 h-4 w-4" />
                          {savingPassword ? "Zmieniam hasło…" : "Zmień hasło"}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* STEP 3 – Preferencje */}
          <Card className="mt-1">
            <CardHeader
              className={cn(
                "group flex items-center justify-between rounded-md border-gray-200 p-0 transition-colors hover:bg-stone-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
                prefsOpen && "bg-stone-100 dark:bg-neutral-900/70"
              )}
            >
              <button
                type="button"
                aria-expanded={prefsOpen}
                aria-controls="prefs-panel"
                onClick={() => setPrefsOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-4 text-left"
              >
                <div>
                  <div className={stepPillClass}>Krok 3 · Preferencje</div>
                  <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                    Powiadomienia i wygląd
                  </div>
                  <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                    Lekkie ustawienia dotyczące powiadomień i tonu interfejsu.
                    Na razie przechowywane lokalnie w przeglądarce.
                  </p>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 transition-transform",
                      prefsOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </div>
              </button>
            </CardHeader>
            <CardContent className="px-4 py-0 md:px-4">
              <Accordion
                type="single"
                collapsible
                value={prefsOpen ? "prefs" : undefined}
                onValueChange={(v) => setPrefsOpen(v === "prefs")}
                className="w-full"
              >
                <AccordionItem value="prefs" className="border-0">
                  <AccordionContent id="prefs-panel" className="pt-4 pb-5">
                    <div className="space-y-4 text-xs text-dark dark:text-neutral-300">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Powiadomienia e-mail
                        </div>
                        <ToggleRow
                          label="Podsumowania scoutingowe"
                          description="Otrzymuj zestawienia, gdy pojawiają się nowi zawodnicy lub ważne zmiany."
                          checked={emailNotifications}
                          onCheckedChange={setEmailNotifications}
                        />
                        <ToggleRow
                          label="Nowości produktowe Entriso Scouting"
                          description="Informacje o nowych funkcjach i zmianach w panelu."
                          checked={productNews}
                          onCheckedChange={setProductNews}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Wygląd
                        </div>
                        <ToggleRow
                          label="Ciemniejszy sidebar i akcenty"
                          description="Wymusza ciemniejsze tony w bocznym panelu (lokalne ustawienie – możesz później wynieść do Supabase)."
                          checked={darkSidebar}
                          onCheckedChange={setDarkSidebar}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {saveError && (
            <p className="mt-2 text-sm text-red-600">{saveError}</p>
          )}
        </div>
      )}
    </div>
  );
}
