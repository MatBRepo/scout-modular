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
  ShieldAlert,
} from "lucide-react";
import type { Player, Observation } from "@/shared/types";
import { getSupabase } from "@/lib/supabaseClient";

type Role = "admin" | "scout" | "scout-agent";

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

export default function ScoutProfilePage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const router = useRouter();

  // DEV: domyślnie admin, żeby nie blokować widoku
  const [role, setRole] = useState<Role>("admin");

  const [scout, setScout] = useState<Scout | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [tab, setTab] = useState<"info" | "players" | "obs">("info");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // próbujemy nadpisać rolę z localStorage, jeśli jest
  useEffect(() => {
    try {
      const r = localStorage.getItem("s4s.role");
      if (r === "admin" || r === "scout" || r === "scout-agent") {
        setRole(r);
      }
    } catch {
      // ignore
    }
  }, []);

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

  const isAdmin = role === "admin";

  const avgCompletion = useMemo(() => {
    if (!players.length) return 0;
    const sum = players.reduce((acc, p) => acc + playerCompletion(p), 0);
    return Math.round(sum / players.length);
  }, [players]);

  // --- Guards (na razie zostawiamy, ale domyślnie jesteś adminem) ---

  if (!isAdmin) {
    return (
      <div className="w-full">
        <Crumb
          items={[
            { label: "Start", href: "/" },
            { label: "Scouts", href: "/scouts" },
            { label: "Profil" },
          ]}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="h-5 w-5" />
              Brak uprawnień
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/scouts")}>
              Wróć
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <Card>
          <CardContent className="p-4 text-sm">
            Ładowanie danych scouta…
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
        <Card>
          <CardContent className="p-4 text-sm">
            Nie znaleziono scouta.
          </CardContent>
        </Card>
      </div>
    );
  }

  // from here: scout definitely exists
  return (
    <div className="w-full">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Scouts", href: "/scouts" },
          { label: scout!.name },
        ]}
      />

      <Toolbar
        title={`Profil scouta: ${scout!.name}`}
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
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      <Card className="border-gray-300 dark:border-neutral-700">
        <CardHeader>
          <CardTitle>Szczegóły</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informacje</TabsTrigger>
              <TabsTrigger value="players">
                Zawodnicy ({players.length})
              </TabsTrigger>
              <TabsTrigger value="obs">
                Obserwacje ({observations.length})
              </TabsTrigger>
            </TabsList>

            {/* INFO TAB */}
            <TabsContent value="info">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info
                  label="E-mail"
                  value={scout!.email || "—"}
                  icon={<Mail className="h-4 w-4" />}
                />
                <Info label="Telefon" value={scout!.phone || "—"} />
                <Info
                  label="Region"
                  value={scout!.region || "—"}
                  icon={<MapPin className="h-4 w-4" />}
                />
                <Info
                  label="Ostatnio aktywny"
                  value={fmtDate(scout!.lastActive)}
                />
                <Info
                  label="Zawodnicy (sum.)"
                  value={String(scout!.playersCount)}
                  icon={<Users className="h-4 w-4" />}
                />
                <Info
                  label="Obserwacje (sum.)"
                  value={String(scout!.observationsCount)}
                  icon={<NotebookPen className="h-4 w-4" />}
                />
              </div>

              <div className="mt-5 rounded-md border border-gray-200 p-3 dark:border-neutral-800">
                <div className="mb-2 text-sm font-semibold">
                  Wypełnienie profili zawodników
                </div>
                <div className="mb-2 text-xs text-dark dark:text-neutral-400">
                  Średnie wypełnienie profili zawodników przypisanych do tego
                  scouta (na podstawie danych z Supabase).
                </div>
                <Progress percent={avgCompletion} />
                <div className="mt-1 text-xs text-dark dark:text-neutral-400">
                  Średnio <b>{avgCompletion}%</b> pól wypełnionych na zawodnika.
                </div>
              </div>
            </TabsContent>

            {/* PLAYERS TAB */}
            <TabsContent value="players">
              <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-800">
                <table className="w-full text-sm">
                  <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
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
                  <tbody>
                    {players.map((p) => {
                      const pct = playerCompletion(p);
                      return (
                        <tr
                          key={String((p as any).id)}
                          className="border-t border-gray-200 dark:border-neutral-800"
                        >
                          <td className="p-3">{(p as any).name}</td>
                          <td className="p-3">{(p as any).club || "—"}</td>
                          <td className="p-3">{(p as any).pos}</td>
                          <td className="p-3">
                            {(p as any).age ?? "—"}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Progress percent={pct} compact />
                              <span className="text-xs">{pct}%</span>
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
              <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-800">
                <table className="w-full text-sm">
                  <thead className="bg-stone-100 text-dark dark:bg-neutral-900 dark:text-neutral-300">
                    <tr>
                      <th className="p-3 text-left font-medium">Mecz</th>
                      <th className="p-3 text-left font-medium">Zawodnik</th>
                      <th className="p-3 text-left font-medium">Data</th>
                      <th className="p-3 text-left font-medium">Godz.</th>
                      <th className="p-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.map((o) => (
                      <tr
                        key={String((o as any).id)}
                        className="border-t border-gray-200 dark:border-neutral-800"
                      >
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
    <div className="rounded-md p-2 text-dark dark:border-neutral-800">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium tracking-wide text-dark dark:text-neutral-400">
        {icon} {label}
      </div>
      <div className="text-gray-800 dark:text-neutral-100">{value}</div>
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
        compact ? "h-2 w-40" : "h-3 w-64"
      } rounded-md bg-gray-200 dark:bg-neutral-800`}
    >
      <div
        className="absolute left-0 top-0 h-full rounded-md bg-indigo-600 transition-[width]"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}
