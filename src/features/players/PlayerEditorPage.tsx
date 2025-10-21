// src/app/(players)/players/[id]/PlayerEditorPage.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import type { Player } from "@/shared/types";

export default function PlayerEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [p, setP] = useState<Player | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("s4s.players");
      const arr: Player[] = raw ? JSON.parse(raw) : [];
      setPlayers(arr);
      const found = arr.find((x) => String(x.id) === id) || null;
      setP(found);
    } catch {
      setP(null);
    }
  }, [id]);

  const isUnknown = useMemo(
    () => (p ? !(p as any).firstName && !(p as any).lastName : false),
    [p]
  );

  function saveBasic(next: Partial<Player>) {
    if (!p) return;
    const updated = { ...p, ...next };
    setP(updated);
    const arr = players.map((x) => (x.id === updated.id ? updated : x));
    setPlayers(arr);
    try {
      localStorage.setItem("s4s.players", JSON.stringify(arr));
    } catch {}
  }

  if (!p) {
    return (
      <div className="w-full">
        <Crumb
          items={[
            { label: "Start", href: "/" },
            { label: "Baza zawodników", href: "/players" },
            { label: "Profil" },
          ]}
        />
        <Card>
          <CardContent className="p-4">Nie znaleziono zawodnika.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Baza zawodników", href: "/players" },
          { label: p.name },
        ]}
      />
      <Toolbar
        title={`Profil: ${p.name}`}
        right={
          <Button
            className="bg-gray-900 text-white hover:bg-gray-800"
            onClick={() => router.push("/players")}
          >
            Wróć do listy
          </Button>
        }
      />

      {/* Info o nieznanym zawodniku */}
      {isUnknown && (
        <div className="mb-3 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Edytujesz nieznanego zawodnika</div>
            <div className="opacity-90">
              Uzupełnij przynajmniej <b>imię</b> lub <b>nazwisko</b>, aby oznaczyć profil jako znany.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Lewa kolumna */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Podstawowe dane</CardTitle>
            {isUnknown && (
              <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-900/40">
                Nieznany
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Imię</Label>
                <Input
                  value={p.firstName ?? ""}
                  onChange={(e) =>
                    saveBasic({
                      firstName: e.target.value,
                      name: `${e.target.value} ${p.lastName ?? ""}`.trim(),
                    })
                  }
                />
                {isUnknown && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
                    Wpisz imię, by łatwiej go zidentyfikować.
                  </p>
                )}
              </div>
              <div>
                <Label>Nazwisko</Label>
                <Input
                  value={p.lastName ?? ""}
                  onChange={(e) =>
                    saveBasic({
                      lastName: e.target.value,
                      name: `${p.firstName ?? ""} ${e.target.value}`.trim(),
                    })
                  }
                />
                {isUnknown && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
                    Dodanie nazwiska oznaczy zawodnika jako znanego.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pozycja</Label>
                <Input
                  value={p.pos}
                  onChange={(e) => saveBasic({ pos: e.target.value as Player["pos"] })}
                />
              </div>
              <div>
                <Label>Wiek</Label>
                <Input
                  type="number"
                  value={p.age}
                  onChange={(e) => saveBasic({ age: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Klub</Label>
                <Input value={p.club} onChange={(e) => saveBasic({ club: e.target.value })} />
              </div>
              <div>
                <Label>Narodowość</Label>
                <Input
                  value={p.nationality ?? ""}
                  onChange={(e) => saveBasic({ nationality: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Data urodzenia</Label>
              <Input
                type="date"
                value={p.birthDate ?? ""}
                onChange={(e) => saveBasic({ birthDate: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Prawa kolumna */}
        <div className="space-y-4">
          {/* --- Rozszerzone informacje --- */}
          <Card>
            <CardHeader>
              <CardTitle>Rozszerzone informacje</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="ext">
                  <AccordionTrigger>Rozwiń / Zwiń</AccordionTrigger>
                  <AccordionContent>
                    <Tabs defaultValue="basic" className="w-full">
                      <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="basic">Basic</TabsTrigger>
                        <TabsTrigger value="club">Club</TabsTrigger>
                        <TabsTrigger value="physical">Physical</TabsTrigger>
                        <TabsTrigger value="contact">Contact</TabsTrigger>
                        <TabsTrigger value="contract">Contract</TabsTrigger>
                        <TabsTrigger value="stats">Stats</TabsTrigger>
                      </TabsList>

                      <TabsContent value="basic" className="mt-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Pseudonim</Label>
                            <Input placeholder="—" />
                          </div>
                          <div>
                            <Label>Dominująca noga</Label>
                            <Input placeholder="—" />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="club" className="mt-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Klub</Label>
                            <Input
                              value={p.club}
                              onChange={(e) => saveBasic({ club: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Drużyna/Rocznik</Label>
                            <Input placeholder="U19 / Rezerwy…" />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="physical" className="mt-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label>Wzrost (cm)</Label>
                            <Input type="number" placeholder="—" />
                          </div>
                          <div>
                            <Label>Waga (kg)</Label>
                            <Input type="number" placeholder="—" />
                          </div>
                          <div>
                            <Label>Budowa</Label>
                            <Input placeholder="—" />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="contact" className="mt-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>E-mail</Label>
                            <Input type="email" placeholder="—" />
                          </div>
                          <div>
                            <Label>Telefon</Label>
                            <Input placeholder="—" />
                          </div>
                          <div className="col-span-2">
                            <Label>Agent</Label>
                            <Input placeholder="—" />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="contract" className="mt-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label>Do kiedy</Label>
                            <Input type="date" />
                          </div>
                          <div>
                            <Label>Kara/klauzula</Label>
                            <Input placeholder="—" />
                          </div>
                          <div>
                            <Label>Status</Label>
                            <Input placeholder="—" />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="stats" className="mt-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label>Mecze</Label>
                            <Input type="number" placeholder="—" />
                          </div>
                          <div>
                            <Label>Gole</Label>
                            <Input type="number" placeholder="—" />
                          </div>
                          <div>
                            <Label>Asysty</Label>
                            <Input type="number" placeholder="—" />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* --- Ocena --- */}
          <Card>
            <CardHeader>
              <CardTitle>Ocena</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="grade">
                  <AccordionTrigger>Rozwiń / Zwiń</AccordionTrigger>
                  <AccordionContent>
                    <Tabs defaultValue="notes" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="notes">Notatki</TabsTrigger>
                        <TabsTrigger value="aspects">Oceny</TabsTrigger>
                        <TabsTrigger value="final">Final</TabsTrigger>
                      </TabsList>

                      {/* Notatki */}
                      <TabsContent value="notes" className="mt-4 space-y-3">
                        <div className="text-sm font-medium">Scout notes</div>
                        <Textarea placeholder="Short comment…" />
                        <div className="text-xs text-gray-500">Only visible to you</div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Assistant suggestions
                          </Button>
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Generate
                          </Button>
                        </div>
                        <div className="text-xs text-gray-500">
                          1 = poor · 3–4 = solid · 6 = elite
                        </div>
                      </TabsContent>

                      {/* Oceny */}
                      <TabsContent value="aspects" className="mt-4">
                        <div className="space-y-3">
                          {[
                            "Motor skills – speed, stamina",
                            "Strength, duels, agility",
                            "Technique",
                            "Moves with a ball",
                            "Moves without a ball",
                            "Set pieces",
                            "Defensive phase",
                            "Attacking phase",
                            "Transitional phases",
                            "Attitude (mentality)",
                          ].map((k) => (
                            <div
                              key={k}
                              className="grid grid-cols-[1fr_120px] items-center gap-3"
                            >
                              <Label className="text-sm">{k}</Label>
                              <Input type="number" min={1} max={6} placeholder="—" />
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      {/* Final */}
                      <TabsContent value="final" className="mt-4 space-y-3">
                        <Label>Final comment</Label>
                        <Textarea placeholder="—" />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Generate
                          </Button>
                          <Button className="bg-gray-900 text-white hover:bg-gray-800">
                            Insert into “Final comment”
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
