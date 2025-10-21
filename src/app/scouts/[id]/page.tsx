// app/scouts/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Users, NotebookPen, Mail, Phone, MapPin, ShieldAlert } from "lucide-react";
import type { Player, Observation } from "@/shared/types";

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
  playerIds?: number[];
};

const STORAGE_SCOUTS = "s4s.admin.scouts";

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pl-PL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function playerCompletion(p: Player): number {
  const fields = [
    p.firstName, p.lastName, p.pos, p.age, p.club, p.nationality, p.birthDate, (p as any).photo,
  ];
  const total = fields.length;
  const filled = fields.filter((v) => v !== undefined && v !== null && String(v).trim() !== "" && String(v) !== "0").length;
  return Math.round((filled / total) * 100);
}

export default function ScoutProfilePage() {
  const params = useParams(); // robust vs TS inference
  const id = String(params?.id ?? "");
  const router = useRouter();

  const [role, setRole] = useState<Role>("scout");
  const [scout, setScout] = useState<Scout | null>(null);
  const [tab, setTab] = useState<"info" | "players" | "obs">("info");

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allObs, setAllObs] = useState<Observation[]>([]);

  useEffect(() => {
    try {
      const r = localStorage.getItem("s4s.role");
      if (r === "admin" || r === "scout" || r === "scout-agent") setRole(r);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SCOUTS);
      const arr: Scout[] = raw ? JSON.parse(raw) : [];
      setScout(arr.find((s) => s.id === id) ?? null);
    } catch {
      setScout(null);
    }
  }, [id]);

  useEffect(() => {
    try {
      const pRaw = localStorage.getItem("s4s.players");
      setAllPlayers(pRaw ? JSON.parse(pRaw) : []);
    } catch {}
    try {
      const oRaw = localStorage.getItem("s4s.observations");
      setAllObs(oRaw ? JSON.parse(oRaw) : []);
    } catch {}
  }, []);

  const isAdmin = role === "admin";

  const assignedPlayers = useMemo(() => {
    if (!scout) return [] as Player[];
    if (Array.isArray(scout.playerIds) && scout.playerIds.length) {
      return allPlayers.filter((p) => scout.playerIds!.includes(Number(p.id)));
    }
    return allPlayers.filter((p) => p.status === "active");
  }, [scout, allPlayers]);

  const assignedObs = useMemo(() => {
    if (!scout) return [] as Observation[];
    const names = new Set(assignedPlayers.map((p) => p.name));
    return allObs.filter((o) => names.has(o.player));
  }, [assignedPlayers, allObs, scout]);

  const avgCompletion = useMemo(() => {
    if (assignedPlayers.length === 0) return 0;
    const sum = assignedPlayers.reduce((acc, p) => acc + playerCompletion(p), 0);
    return Math.round(sum / assignedPlayers.length);
  }, [assignedPlayers]);

  if (!isAdmin) {
    return (
      <div className="w-full">
        <Crumb items={[{ label: "Start", href: "/" }, { label: "Scouts", href: "/scouts" }, { label: "Profil" }]} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="h-5 w-5" />
              Brak uprawnień
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/scouts")}>Wróć</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!scout) {
    // Route exists, but ID not found in storage
    return (
      <div className="w-full">
        <Crumb items={[{ label: "Start", href: "/" }, { label: "Scouts", href: "/scouts" }, { label: "Profil" }]} />
        <Card><CardContent className="p-4">Nie znaleziono scouta.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Scouts", href: "/scouts" }, { label: scout.name }]} />
      <Toolbar
        title={`Profil scouta: ${scout.name}`}
        right={<Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => router.push("/scouts")}>Wróć do listy</Button>}
      />

      <Card className="border-gray-300 dark:border-neutral-700">
        <CardHeader>
          <CardTitle>Szczegóły</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informacje</TabsTrigger>
              <TabsTrigger value="players">Zawodnicy ({assignedPlayers.length})</TabsTrigger>
              <TabsTrigger value="obs">Obserwacje ({assignedObs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="E-mail" value={scout.email || "—"} icon={<Mail className="h-4 w-4" />} />
                <Info label="Telefon" value={scout.phone || "—"} />
                <Info label="Region" value={scout.region || "—"} icon={<MapPin className="h-4 w-4" />} />
                <Info label="Ostatnio aktywny" value={fmtDate(scout.lastActive)} />
                <Info label="Zawodnicy (sum.)" value={String(scout.playersCount)} icon={<Users className="h-4 w-4" />} />
                <Info label="Obserwacje (sum.)" value={String(scout.observationsCount)} icon={<NotebookPen className="h-4 w-4" />} />
              </div>

              <div className="mt-5 rounded-md border border-gray-200 p-3 dark:border-neutral-800">
                <div className="mb-2 text-sm font-semibold">Wypełnienie profili zawodników</div>
                <div className="mb-2 text-xs text-gray-600 dark:text-neutral-400">
                  {Array.isArray(scout.playerIds) && scout.playerIds.length
                    ? "Średnie wypełnienie przypisanych zawodników."
                    : "Brak przypisanych zawodników – pokazano metryki globalne (aktywni)."}
                </div>
                <Progress percent={avgCompletion} />
                <div className="mt-1 text-xs text-gray-600 dark:text-neutral-400">
                  Średnio <b>{avgCompletion}%</b> pól wypełnionych na zawodnika.
                </div>
              </div>
            </TabsContent>

            <TabsContent value="players">
              <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
                    <tr>
                      <th className="p-3 text-left font-medium">Zawodnik</th>
                      <th className="p-3 text-left font-medium">Klub</th>
                      <th className="p-3 text-left font-medium">Pozycja</th>
                      <th className="p-3 text-left font-medium">Wiek</th>
                      <th className="p-3 text-left font-medium">Wypełnienie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedPlayers.map((p) => {
                      const pct = playerCompletion(p);
                      return (
                        <tr key={p.id} className="border-t border-gray-200 dark:border-neutral-800">
                          <td className="p-3">{p.name}</td>
                          <td className="p-3">{p.club || "—"}</td>
                          <td className="p-3">{p.pos}</td>
                          <td className="p-3">{p.age ?? "—"}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Progress percent={pct} compact />
                              <span className="text-xs">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {assignedPlayers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-5 text-center text-sm text-gray-500 dark:text-neutral-400">
                          Brak zawodników do wyświetlenia.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="obs">
              <div className="w-full overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
                    <tr>
                      <th className="p-3 text-left font-medium">Mecz</th>
                      <th className="p-3 text-left font-medium">Zawodnik</th>
                      <th className="p-3 text-left font-medium">Data</th>
                      <th className="p-3 text-left font-medium">Godz.</th>
                      <th className="p-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedObs.map((o) => (
                      <tr key={o.id} className="border-t border-gray-200 dark:border-neutral-800">
                        <td className="p-3">{o.match || "—"}</td>
                        <td className="p-3">{o.player || "—"}</td>
                        <td className="p-3">{o.date || "—"}</td>
                        <td className="p-3">{o.time || "—"}</td>
                        <td className="p-3">{o.status === "final" ? "Finalna" : "Szkic"}</td>
                      </tr>
                    ))}
                    {assignedObs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-5 text-center text-sm text-gray-500 dark:text-neutral-400">
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

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 p-2 dark:border-neutral-800">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400">
        {icon} {label}
      </div>
      <div className="text-gray-800 dark:text-neutral-100">{value}</div>
    </div>
  );
}

function Progress({ percent, compact = false }: { percent: number; compact?: boolean }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={`relative ${compact ? "h-2 w-40" : "h-3 w-64"} rounded-full bg-gray-200 dark:bg-neutral-800`}>
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-indigo-600 transition-[width]"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}
