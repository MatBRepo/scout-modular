// src/features/observations/ObservationEditor.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Observation, Player } from "@/shared/types";
import { FileEdit, Info, Users, ListPlus, UserPlus, Hash, GripVertical } from "lucide-react";

/* ------------ Types (aligned with Observations.tsx) ------------ */
type Mode = "live" | "tv";
type ObsPlayer = {
  id: string;
  type: "known" | "unknown";
  name?: string;
  shirtNo?: string;
  minutes?: number;
  position?: string;
  overall?: number;
  voiceUrl?: string | null;
  note?: string;
  ratings: { off: number; def: number; tech: number; motor: number };
};
export type XO = Observation & {
  mode?: Mode;
  voiceUrl?: string | null;
  note?: string;
  players?: ObsPlayer[];
};

/* ----------------------------- Utils ---------------------------- */
function fmtDateHuman(date?: string, time?: string) {
  try {
    const d = date ? new Date(date) : null;
    if (!d) return "—";
    const dd = d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
    return time ? `${dd}, ${time}` : dd;
  } catch {
    return "—";
  }
}

/* -------------------------- Tiny atoms -------------------------- */
function Section({
  title,
  description,
  right,
  children,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-neutral-100">{title}</div>
          {description ? (
            <div className="text-xs text-gray-500 dark:text-neutral-400">{description}</div>
          ) : null}
        </div>
        {right}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-200 dark:ring-slate-700">
      <Info className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

/* ========================= Editor component ========================= */
export function ObservationEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: XO;
  onSave: (o: XO) => void;
  onClose: () => void;
}) {
  // Local state & sync on initial change
  const [o, setO] = useState<XO>(initial);
  useEffect(() => setO(initial), [initial]);

  // Tabs – always controlled
  const [tab, setTab] = useState<"basic" | "players" | "notes">("basic");

  // Quick picker from My Players
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("s4s.players");
      const arr: Player[] = raw ? JSON.parse(raw) : [];
      setAllPlayers(arr);
    } catch {}
  }, []);

  const knownOptions = useMemo(() => {
    return allPlayers
      .filter((p) => p.status === "active")
      .filter((p) => {
        if (!playerSearch.trim()) return true;
        const q = playerSearch.toLowerCase();
        return (p.name || "").toLowerCase().includes(q) || (p.club || "").toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [allPlayers, playerSearch]);

  function set<K extends keyof XO>(key: K, val: XO[K]) {
    setO((prev) => ({ ...prev, [key]: val }));
  }

  function addKnownPlayer(name: string) {
    const p: ObsPlayer = {
      id: crypto.randomUUID(),
      type: "known",
      name,
      ratings: { off: 3, def: 3, tech: 3, motor: 3 },
    };
    setO((prev) => ({ ...prev, players: [...(prev.players ?? []), p] }));
  }

  function addUnknownQuick(shirtNo: string) {
    const p: ObsPlayer = {
      id: crypto.randomUUID(),
      type: "unknown",
      shirtNo,
      name: `#${shirtNo}`,
      ratings: { off: 3, def: 3, tech: 3, motor: 3 },
    };
    setO((prev) => ({ ...prev, players: [...(prev.players ?? []), p] }));
  }

  function updatePlayer(id: string, patch: Partial<ObsPlayer>) {
    setO((prev) => ({
      ...prev,
      players: (prev.players ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function removePlayer(id: string) {
    setO((prev) => ({ ...prev, players: (prev.players ?? []).filter((p) => p.id !== id) }));
  }

  const headerMeta = `${fmtDateHuman(o.date, o.time)} • ${(o.players?.length ?? 0)} zawodn.`;

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Obserwacje", href: "/observations" },
          { label: o.id ? "Edycja" : "Nowa" },
        ]}
      />

      {/* Top toolbar */}
      <Toolbar
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Mecz: {o.match || "—"}</span>
            <span className="text-xs text-gray-500">{headerMeta}</span>
          </div>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={onClose}>
              Anuluj
            </Button>
            <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => onSave(o)}>
              Zapisz
            </Button>
          </div>
        }
      />

      <Card className="border-gray-300 dark:border-neutral-700">
        <CardHeader className="border-b border-gray-200 pb-0 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between">
            <CardTitle>Formularz obserwacji</CardTitle>
            <Helper>Uzupełnij podstawowe dane, potem dodaj zawodników i notatki</Helper>
          </div>

          {/* Sticky-in-card Tabs */}
          <div className="sticky top-0 z-[5] -mx-6 mt-4 border-b border-gray-200 bg-white/90 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80">
            <Tabs
              defaultValue="basic"
              value={tab || "basic"}
              onValueChange={(v) => setTab(v as any)}
              className="py-3"
            >
              <TabsList className="flex w-full justify-start gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-neutral-900">
                <TabsTrigger
                  value="basic"
                  className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm
                             rounded-lg px-3 py-1.5 text-sm text-gray-700 transition dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-neutral-100"
                >
                  Podstawowe
                </TabsTrigger>
                <TabsTrigger
                  value="players"
                  className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm
                             rounded-lg px-3 py-1.5 text-sm text-gray-700 transition dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-neutral-100"
                >
                  Zawodnicy
                  {o.players?.length ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                      {o.players.length}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm
                             rounded-lg px-3 py-1.5 text-sm text-gray-700 transition dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-neutral-100"
                >
                  Notatki
                </TabsTrigger>
              </TabsList>

              <CardContent className="space-y-6 px-0 py-6">
                {/* ========== BASIC ========== */}
                <TabsContent value="basic" className="space-y-6">
                  <Section
                    title="Podstawowe informacje"
                    description="Nazwa meczu, termin, tryb i status obserwacji."
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Label>Mecz (kto vs kto)</Label>
                        <Input
                          value={o.match ?? ""}
                          onChange={(e) => set("match", e.target.value)}
                          placeholder="np. Lech U19 vs Legia U19"
                        />
                      </div>

                      <div>
                        <Label>Data</Label>
                        <Input type="date" value={o.date ?? ""} onChange={(e) => set("date", e.target.value)} />
                      </div>
                      <div>
                        <Label>Godzina</Label>
                        <Input type="time" value={o.time ?? ""} onChange={(e) => set("time", e.target.value)} />
                      </div>

                      <div>
                        <Label>Tryb</Label>
                        <div className="inline-flex overflow-hidden rounded-md border">
                          {(["live", "tv"] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => set("mode", m)}
                              className={`px-3 py-1.5 text-sm ${
                                (o.mode ?? "live") === m
                                  ? "bg-gray-900 text-white"
                                  : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"
                              }`}
                            >
                              {m === "live" ? "Live" : "TV"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label>Status</Label>
                        <div className="inline-flex overflow-hidden rounded-md border">
                          {(["draft", "final"] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => set("status", s)}
                              className={`px-3 py-1.5 text-sm ${
                                (o.status ?? "draft") === s
                                  ? "bg-gray-900 text-white"
                                  : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"
                              }`}
                            >
                              {s === "draft" ? "Szkic" : "Finalna"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Section>

                  <div className="flex flex-wrap items-center justify-between">
                    <Helper>Wskazówka: dokładny tytuł ułatwia wyszukiwanie</Helper>
                    <div className="text-xs text-gray-500">
                      Ostatnia edycja: {fmtDateHuman(o.date, o.time)}
                    </div>
                  </div>
                </TabsContent>

                {/* ========== PLAYERS ========== */}
                <TabsContent value="players" className="space-y-6">
                  <Section
                    title="Dodaj zawodników"
                    description="Wybierz z My Players, wpisz ręcznie lub dodaj nieznanego po numerze."
                    right={
                      <div className="hidden gap-2 md:flex">
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:ring-indigo-800/60">
                          <Users className="h-3.5 w-3.5" /> {o.players?.length ?? 0} zapisanych
                        </span>
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      {/* From My Players */}
                      <div className="space-y-2">
                        <Label>Wybierz z „My Players”</Label>
                        <Input
                          value={playerSearch}
                          onChange={(e) => setPlayerSearch(e.target.value)}
                          placeholder="Szukaj po nazwisku/klubie…"
                          className="mb-2"
                        />
                        <div className="flex gap-2">
                          <select
                            id="known-select"
                            className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                          >
                            <option value="">— wybierz zawodnika —</option>
                            {knownOptions.map((p) => (
                              <option key={p.id} value={p.name || ""}>
                                {p.name} {p.club ? `• ${p.club}` : ""} {p.pos ? `• ${p.pos}` : ""}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            className="shrink-0 border-gray-300 dark:border-neutral-700"
                            onClick={() => {
                              const sel = document.getElementById("known-select") as HTMLSelectElement | null;
                              const val = sel?.value?.trim();
                              if (val) {
                                addKnownPlayer(val);
                                if (sel) sel.value = "";
                              }
                            }}
                          >
                            <ListPlus className="mr-1 h-4 w-4" /> Dodaj
                          </Button>
                        </div>
                      </div>

                      {/* Known free text */}
                      <div className="space-y-2">
                        <Label>Znany (wpisz ręcznie)</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input placeholder="Imię i nazwisko" id="known-name" />
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                            onClick={() => {
                              const el = document.getElementById("known-name") as HTMLInputElement | null;
                              const val = el?.value.trim();
                              if (val) {
                                addKnownPlayer(val);
                                if (el) el.value = "";
                              }
                            }}
                          >
                            <UserPlus className="mr-1 h-4 w-4" />
                            Dodaj
                          </Button>
                        </div>
                      </div>

                      {/* Unknown by shirt no. */}
                      <div className="space-y-2">
                        <Label>Nieznany (numer na koszulce)</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input placeholder="np. 27" id="unknown-no" />
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                            onClick={() => {
                              const el = document.getElementById("unknown-no") as HTMLInputElement | null;
                              const val = el?.value.trim();
                              if (val) {
                                addUnknownQuick(val);
                                if (el) el.value = "";
                              }
                            }}
                          >
                            <Hash className="mr-1 h-4 w-4" />
                            Dodaj
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Section>

                  {/* Players table */}
                  <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
                        <tr>
                          <th className="p-3 text-left font-medium">Zawodnik</th>
                          <th className="p-3 text-left font-medium">Minuty</th>
                          <th className="p-3 text-left font-medium">Pozycja</th>
                          <th className="p-3 text-left font-medium">Ocena</th>
                          <th className="p-3 text-left font-medium">Of.</th>
                          <th className="p-3 text-left font-medium">Def.</th>
                          <th className="p-3 text-left font-medium">Tech.</th>
                          <th className="p-3 text-left font-medium">Motor.</th>
                          <th className="p-3 text-left font-medium">Notatka</th>
                          <th className="p-3 text-right font-medium">Akcje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(o.players ?? []).map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-gray-200 align-top hover:bg-gray-50/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                          >
                            <td className="p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-neutral-100">
                                    {p.type === "known" ? p.name ?? "—" : p.name ?? `#${p.shirtNo ?? ""}`}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-neutral-400">
                                    {p.type === "known" ? "znany" : "nieznany"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min={0}
                                max={120}
                                value={p.minutes ?? ""}
                                onChange={(e) =>
                                  updatePlayer(p.id, {
                                    minutes: e.target.value === "" ? undefined : Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td className="p-3">
                              <Input value={p.position ?? ""} onChange={(e) => updatePlayer(p.id, { position: e.target.value })} />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                value={p.overall ?? ""}
                                onChange={(e) =>
                                  updatePlayer(p.id, {
                                    overall: e.target.value === "" ? undefined : Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                            {(["off", "def", "tech", "motor"] as const).map((k) => (
                              <td key={k} className="p-3">
                                <input
                                  type="range"
                                  min={1}
                                  max={5}
                                  value={p.ratings[k]}
                                  onChange={(e) =>
                                    updatePlayer(p.id, { ratings: { ...p.ratings, [k]: Number(e.target.value) } })
                                  }
                                  className="w-28 accent-indigo-600"
                                />
                                <div className="text-center text-xs">{p.ratings[k]}/5</div>
                              </td>
                            ))}
                            <td className="p-3">
                              <Textarea
                                value={p.note ?? ""}
                                onChange={(e) => updatePlayer(p.id, { note: e.target.value })}
                                placeholder="Notatka…"
                                className="min-h-[70px]"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-gray-300 dark:border-neutral-700"
                                onClick={() => removePlayer(p.id)}
                              >
                                Usuń
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {(o.players ?? []).length === 0 && (
                          <tr>
                            <td colSpan={10} className="p-6 text-center text-sm text-gray-500 dark:text-neutral-400">
                              Brak zawodników — dodaj kogoś powyżej (z listy lub ręcznie).
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* ========== NOTES ========== */}
                <TabsContent value="notes" className="space-y-6">
                  <Section
                    title="Notatka do obserwacji"
                    description="Krótki opis, kontekst, obserwacje ogólne."
                  >
                    <div className="space-y-2">
                      <Label>Notatka tekstowa</Label>
                      <Textarea
                        value={o.note ?? ""}
                        onChange={(e) => set("note", e.target.value)}
                        placeholder="Krótka notatka…"
                        className="min-h-[140px]"
                      />
                      <div className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-400">
                        <FileEdit className="h-3.5 w-3.5" /> Notatka dot. całej obserwacji.
                      </div>
                    </div>
                  </Section>
                </TabsContent>
              </CardContent>
            </Tabs>
          </div>
        </CardHeader>

        {/* Bottom sticky actions (nice on long pages) */}
        <div className="sticky bottom-0 z-[5] -mb-px -mt-px border-t border-gray-200 bg-white/90 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-neutral-950/80">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={onClose}>
              Anuluj
            </Button>
            <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => onSave(o)}>
              Zapisz
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
