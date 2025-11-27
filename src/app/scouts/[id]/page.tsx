// app/scouts/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users,
  NotebookPen,
  Mail,
  MapPin,
  CalendarClock,
} from "lucide-react";
import type { Player, Observation } from "@/shared/types";
import { getSupabase } from "@/lib/supabaseClient";

/* ======================= Types ======================= */

type Scout = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  region?: string;
  role: "scout" | "scout-agent";
  playersCount: number;
  observationsCount: number;
  lastActive?: string;
  note?: string;
};

type DbScoutRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  region: string | null;
  role: string | null;
  players_count: number | null;
  observations_count: number | null;
  last_active: string | null;
  note: string | null;
};

/* ======================= Utils ======================= */

function fmtDate(d?: string) {
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
    return d;
  }
}

function daysSince(iso?: string) {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t <= 0) return 999;
  const diff = Date.now() - t;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function activityLabel(lastActive?: string) {
  const d = daysSince(lastActive);
  if (d >= 999) return "Brak aktywności";
  if (d === 0) return "Aktywny dzisiaj";
  if (d <= 7) return `Aktywny ${d} dni temu`;
  if (d <= 30) return `Rzadko aktywny (${d} dni temu)`;
  return `Dawno nieaktywny (${d} dni temu)`;
}

function activityDotClass(lastActive?: string) {
  const d = daysSince(lastActive);
  if (d >= 999) return "bg-gray-400";
  if (d === 0) return "bg-emerald-500";
  if (d <= 7) return "bg-emerald-400";
  if (d <= 30) return "bg-amber-400";
  return "bg-orange-500";
}

function playerCompletion(p: Player): number {
  const fields = [
    (p as any).firstName,
    (p as any).lastName,
    (p as any).pos,
    (p as any).age,
    (p as any).club,
    (p as any).nationality,
    (p as any).birthDate,
    (p as any).photo,
  ];
  const total = fields.length;
  const filled = fields.filter(
    (v) =>
      v !== undefined &&
      v !== null &&
      String(v).trim() !== "" &&
      String(v) !== "0"
  ).length;
  if (!total) return 0;
  return Math.round((filled / total) * 100);
}

/* ======================= Page ======================= */

export default function ScoutProfilePage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const router = useRouter();

  const [scout, setScout] = useState<Scout | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [tab, setTab] = useState<"info" | "players" | "obs">("info");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // load scout + players + observations from Supabase
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabase();

        // 1) scout details from scouts_admin_view
        const { data: scoutRow, error: scoutError } = await supabase
          .from("scouts_admin_view")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (scoutError) throw scoutError;
        if (!mounted) return;

        if (!scoutRow) {
          setScout(null);
        } else {
          const r = scoutRow as DbScoutRow;
          const mapped: Scout = {
            id: r.id,
            name: r.name || "Bez nazwy",
            email: r.email || undefined,
            phone: r.phone || undefined,
            region: r.region || undefined,
            role: r.role === "scout-agent" ? "scout-agent" : "scout",
            playersCount: r.players_count ?? 0,
            observationsCount: r.observations_count ?? 0,
            lastActive: r.last_active || undefined,
            note: r.note || undefined,
          };
          setScout(mapped);
        }

        // 2) players assigned to this scout (po user_id)
        const { data: playerRows, error: playersError } = await supabase
          .from("players")
          .select("*")
          .eq("user_id", id);

        if (playersError) throw playersError;
        if (!mounted) return;
        setPlayers((playerRows || []) as Player[]);

        // 3) observations created by this scout (po user_id)
        const { data: obsRows, error: obsError } = await supabase
          .from("observations")
          .select("*")
          .eq("user_id", id);

        if (obsError) throw obsError;
        if (!mounted) return;
        setObservations((obsRows || []) as Observation[]);
      } catch (e: any) {
        console.error("Error loading scout profile:", e);
        if (!mounted) return;
        setError(
          e?.message || "Nie udało się pobrać danych scouta z Supabase."
        );
        setScout(null);
        setPlayers([]);
        setObservations([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (id) load();

    return () => {
      mounted = false;
    };
  }, [id]);

  const avgCompletion = useMemo(() => {
    if (!players.length) return 0;
    const sum = players.reduce((acc, p) => acc + playerCompletion(p), 0);
    return Math.round(sum / players.length);
  }, [players]);

  const avgObsPerPlayer = useMemo(() => {
    if (!players.length) return 0;
    return observations.length / players.length;
  }, [players.length, observations.length]);

  /* ---- Loading / Not found ---- */

  if (loading && !scout) {
    return (
      <div className="w-full">
        <Crumb
          items={[
            { label: "Start", href: "/" },
            { label: "Scouts", href: "/scouts" },
            { label: "Profil" },
          ]}
        />
        <Card className="mt-2 border-gray-300 dark:border-neutral-700">
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
            <div className="h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!loading && !scout) {
    return (
      <div className="w-full">
        <Crumb
          items={[
            { label: "Start", href: "/" },
            { label: "Scouts", href: "/scouts" },
            { label: "Profil" },
          ]}
        />
        <Card className="mt-2 border-gray-300 dark:border-neutral-700">
          <CardContent className="flex items-center justify-between p-4 text-sm">
            <span>Nie znaleziono scouta.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/scouts")}
            >
              Wróć do listy
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // from here: scout definitely exists
  const s = scout!;

  return (
    <div className="w-full space-y-3">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Scouts", href: "/scouts" },
          { label: s.name },
        ]}
      />

      <Toolbar
        title={`Profil scouta: ${s.name}`}
        right={
          <Button
            className="bg-gray-900 text-white hover:bg-gray-800"
            onClick={() => router.push("/scouts")}
          >
            Wróć do listy
          </Button>
        }
      />

      {error && (
        <div className="mb-1 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* ===== Top summary row ===== */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        {/* Profile card */}
        <Card className="border-gray-300 bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/70 dark:ring-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-base font-semibold text-gray-900 dark:text-neutral-50">
                  {s.name}
                </div>
                <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                  <RoleBadge role={s.role} />
                  <ActivityTag lastActive={s.lastActive} />
                </div>
              </div>
              <div className="rounded-full bg-stone-100 px-3 py-1 text-[11px] text-muted-foreground ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-700">
                <CalendarClock className="mr-1 inline-block h-3.5 w-3.5" />
                Ostatnio aktywny:{" "}
                <span className="font-medium">{fmtDate(s.lastActive)}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 border-t border-dashed border-stone-200 pt-3 text-sm dark:border-neutral-800 md:grid-cols-2">
            <div className="space-y-1 text-[13px] text-dark dark:text-neutral-300">
              <Line icon={<Mail className="h-4 w-4" />} label="E-mail">
                {s.email || "—"}
              </Line>
              <Line label="Telefon">{s.phone || "—"}</Line>
              <Line icon={<MapPin className="h-4 w-4" />} label="Region">
                {s.region || "—"}
              </Line>
              {s.note && (
                <Line label="Notatka">
                  <span className="line-clamp-3 text-[12px] text-muted-foreground">
                    {s.note}
                  </span>
                </Line>
              )}
            </div>
            <div className="space-y-3 text-[13px] text-dark dark:text-neutral-300">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Zawodnicy przypisani
                </span>
                <span className="text-base font-semibold">
                  {s.playersCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Obserwacje
                </span>
                <span className="text-base font-semibold">
                  {s.observationsCount}
                </span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Średnie wypełnienie profili</span>
                  <span className="font-medium">{avgCompletion}%</span>
                </div>
                <Progress percent={avgCompletion} compact />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Średni wolumen:{" "}
                <span className="font-medium">
                  {avgObsPerPlayer.toFixed(1)}{" "}
                  <span className="font-normal">obserwacji / zawodnika</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI / meta card */}
        <Card className="border-gray-300 bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/70 dark:ring-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-neutral-50">
              Szybkie KPI scouta
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 p-4 pt-1 text-xs sm:grid-cols-3">
            <KpiTile
              label="Zawodników"
              value={s.playersCount}
              icon={<Users className="h-4 w-4" />}
            />
            <KpiTile
              label="Obserwacji"
              value={s.observationsCount}
              icon={<NotebookPen className="h-4 w-4" />}
            />
            <KpiTile
              label="Śr. wypełnienie"
              value={avgCompletion}
              suffix="%"
            />
          </CardContent>
        </Card>
      </div>

      {/* ===== Tabs ===== */}
      <Card className="border-gray-300 bg-white/70 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-neutral-50">
            Dane szczegółowe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-3 rounded-full bg-stone-100/70 p-1 text-xs dark:bg-neutral-900/70">
              <TabsTrigger
                value="info"
                className="rounded-full px-2 py-1 text-xs data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
              >
                Informacje
              </TabsTrigger>
              <TabsTrigger
                value="players"
                className="rounded-full px-2 py-1 text-xs data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
              >
                Zawodnicy ({players.length})
              </TabsTrigger>
              <TabsTrigger
                value="obs"
                className="rounded-full px-2 py-1 text-xs data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"
              >
                Obserwacje ({observations.length})
              </TabsTrigger>
            </TabsList>

            {/* INFO TAB */}
            <TabsContent value="info">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <Info
                  label="E-mail"
                  value={s.email || "—"}
                  icon={<Mail className="h-4 w-4" />}
                />
                <Info label="Telefon" value={s.phone || "—"} />
                <Info
                  label="Region"
                  value={s.region || "—"}
                  icon={<MapPin className="h-4 w-4" />}
                />
                <Info
                  label="Ostatnio aktywny"
                  value={fmtDate(s.lastActive)}
                  icon={<CalendarClock className="h-4 w-4" />}
                />
                <Info
                  label="Zawodnicy (sum.)"
                  value={String(s.playersCount)}
                  icon={<Users className="h-4 w-4" />}
                />
                <Info
                  label="Obserwacje (sum.)"
                  value={String(s.observationsCount)}
                  icon={<NotebookPen className="h-4 w-4" />}
                />
              </div>

              <div className="mt-5 rounded-md border border-gray-200 bg-stone-50/60 p-3 text-xs text-dark dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
                <div className="mb-1 text-sm font-semibold text-gray-900 dark:text-neutral-50">
                  Wypełnienie profili zawodników
                </div>
                <div className="mb-2 text-[11px] text-muted-foreground">
                  Średnie wypełnienie profili zawodników przypisanych do tego
                  scouta (na podstawie danych z Supabase).
                </div>
                <Progress percent={avgCompletion} />
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Średnio <b>{avgCompletion}%</b> pól wypełnionych na zawodnika.
                </div>
              </div>
            </TabsContent>

            {/* PLAYERS TAB */}
            <TabsContent value="players">
              <div className="w-full overflow-x-auto rounded-md border border-gray-200 bg-white/70 text-sm dark:border-neutral-800 dark:bg-neutral-950/70">
                <table className="w-full">
                  <thead className="bg-stone-100 text-xs uppercase tracking-wide text-dark dark:bg-neutral-900 dark:text-neutral-300">
                    <tr>
                      <th className="p-3 text-left font-medium">Zawodnik</th>
                      <th className="p-3 text-left font-medium">Klub</th>
                      <th className="p-3 text-left font-medium">Pozycja</th>
                      <th className="p-3 text-left font-medium">Wiek</th>
                      <th className="p-3 text-left font-medium">
                        Wypełnienie
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {players.map((p) => {
                      const pct = playerCompletion(p);
                      return (
                        <tr key={String((p as any).id)}>
                          <td className="p-3">{(p as any).name}</td>
                          <td className="p-3">{(p as any).club || "—"}</td>
                          <td className="p-3">{(p as any).pos}</td>
                          <td className="p-3">
                            {(p as any).age ?? "—"}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Progress percent={pct} compact />
                              <span className="text-xs text-muted-foreground">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {players.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-5 text-center text-sm text-dark dark:text-neutral-400"
                        >
                          Brak zawodników do wyświetlenia.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* OBSERVATIONS TAB */}
            <TabsContent value="obs">
              <div className="w-full overflow-x-auto rounded-md border border-gray-200 bg-white/70 text-sm dark:border-neutral-800 dark:bg-neutral-950/70">
                <table className="w-full">
                  <thead className="bg-stone-100 text-xs uppercase tracking-wide text-dark dark:bg-neutral-900 dark:text-neutral-300">
                    <tr>
                      <th className="p-3 text-left font-medium">Mecz</th>
                      <th className="p-3 text-left font-medium">Zawodnik</th>
                      <th className="p-3 text-left font-medium">Data</th>
                      <th className="p-3 text-left font-medium">Godz.</th>
                      <th className="p-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {observations.map((o) => (
                      <tr key={String((o as any).id)}>
                        <td className="p-3">{(o as any).match || "—"}</td>
                        <td className="p-3">{(o as any).player || "—"}</td>
                        <td className="p-3">{(o as any).date || "—"}</td>
                        <td className="p-3">{(o as any).time || "—"}</td>
                        <td className="p-3">
                          {(o as any).status === "final"
                            ? "Finalna"
                            : "Szkic"}
                        </td>
                      </tr>
                    ))}
                    {observations.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-5 text-center text-sm text-dark dark:text-neutral-400"
                        >
                          Brak obserwacji powiązanych z tym scoutem.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

/* ======================= Small UI helpers ======================= */

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-transparent p-2 text-dark dark:border-neutral-800">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-sm text-gray-800 dark:text-neutral-100">
        {value}
      </div>
    </div>
  );
}

function Progress({
  percent,
  compact = false,
}: {
  percent: number;
  compact?: boolean;
}) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`relative ${
        compact ? "h-2 w-32" : "h-3 w-full"
      } rounded-full bg-gray-200 dark:bg-neutral-800`}
    >
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-indigo-600 transition-[width]"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

function RoleBadge({ role }: { role: Scout["role"] }) {
  const label = role === "scout-agent" ? "Scout-agent" : "Scout";
  const cls =
    role === "scout-agent"
      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-100"
      : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function ActivityTag({ lastActive }: { lastActive?: string }) {
  const label = activityLabel(lastActive);
  const dotCls = activityDotClass(lastActive);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-muted-foreground dark:bg-neutral-900 dark:text-neutral-300">
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  );
}

function Line({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-sm text-gray-900 dark:text-neutral-100">
        {children}
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg bg-stone-50/80 p-2 text-[11px] ring-1 ring-stone-100 dark:bg-neutral-900/70 dark:ring-neutral-800">
      <div className="mb-1 flex items-center justify-between gap-2 text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-lg font-semibold text-gray-900 dark:text-neutral-50">
        {value}
        {suffix && (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
