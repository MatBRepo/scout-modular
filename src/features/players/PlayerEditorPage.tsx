// src/app/(players)/players/[id]/PlayerEditorPage.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { Player } from "@/shared/types";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Pos = Player["pos"]; // "GK" | "DF" | "MF" | "FW"

export default function PlayerEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [p, setP] = useState<Player | null>(null);

  // Oryginalny snapshot (do przycisku „Anuluj”)
  const originalRef = useRef<Player | null>(null);

  // Status autosave
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ładowanie
  useEffect(() => {
    try {
      const raw = localStorage.getItem("s4s.players");
      const arr: Player[] = raw ? JSON.parse(raw) : [];
      setPlayers(arr);
      const found = arr.find((x) => String(x.id) === id) || null;
      setP(found);
      // snapshot
      originalRef.current = found ? structuredClone(found) : null;
    } catch {
      setP(null);
      originalRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // „Nieznany” = brak imienia i nazwiska
  const isUnknown = useMemo(
    () => (p ? !(p as any).firstName && !(p as any).lastName : false),
    [p]
  );

  // Zapis całego obiektu do localStorage
  function overwritePlayer(next: Player) {
    setP(next);
    const arr = players.map((x) => (x.id === next.id ? next : x));
    setPlayers(arr);
    try {
      localStorage.setItem("s4s.players", JSON.stringify(arr));
    } catch {}
  }

  // Debounce UX dla statusu zapisu
  function bumpSaving() {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 450);
  }

  // Autosave — aktualizacja podstawowych pól
  function saveBasic(next: Partial<Player>) {
    if (!p) return;
    const updated = { ...p, ...next };
    bumpSaving();
    overwritePlayer(updated);
  }

  // Ręczne „Zapisz” (potwierdzenie; autosave i tak zapisuje on-change)
  function manualSave() {
    if (!p) return;
    bumpSaving();
    overwritePlayer({ ...p });
  }

  // „Anuluj” — przywrócenie snapshotu
  function cancelToOriginal() {
    const orig = originalRef.current;
    if (!orig) return;
    setSaveStatus("saving");
    overwritePlayer(structuredClone(orig));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 450);
  }

  // Drobna plakietka statusu w toolbarze
  const SaveChip = () => (
    <div
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 " +
        (saveStatus === "saving"
          ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-900/40"
          : saveStatus === "saved"
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-900/40"
          : "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700")
      }
      aria-live="polite"
    >
      {saveStatus === "saving" ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Zapisywanie…
        </>
      ) : saveStatus === "saved" ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" /> Zapisano
        </>
      ) : (
        "—"
      )}
    </div>
  );

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
          <div className="flex items-center gap-2 mb-4">
            <SaveChip />
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={() => router.push("/players")}
            >
              Wróć do listy
            </Button>
          </div>
        }
      />

      {/* Baner „Nieznany zawodnik” + akcje */}
      {isUnknown && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Edytujesz nieznanego zawodnika</div>
              <div className="opacity-90">
                Uzupełnij przynajmniej <b>imię</b> lub <b>nazwisko</b>, aby oznaczyć profil jako znany.
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" className="h-8 border-amber-300 dark:border-amber-800" onClick={cancelToOriginal}>
              Anuluj
            </Button>
            <Button className="h-8 bg-gray-900 text-white hover:bg-gray-800" onClick={manualSave}>
              Zapisz
            </Button>
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
                <Select
                  value={p.pos as Pos}
                  onValueChange={(v) => saveBasic({ pos: v as Pos })}
                >
                  <SelectTrigger className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                    <SelectValue placeholder="Wybierz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GK">GK</SelectItem>
                    <SelectItem value="DF">DF</SelectItem>
                    <SelectItem value="MF">MF</SelectItem>
                    <SelectItem value="FW">FW</SelectItem>
                  </SelectContent>
                </Select>
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
              {/* Tylko jedna sekcja na raz (accordion single) */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="ext">
                  <AccordionTrigger>Rozwiń / Zwiń</AccordionTrigger>
                  <AccordionContent>
                    <Tabs defaultValue="basic" className="w-full">
                      <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="basic">Podstawowe</TabsTrigger>
                        <TabsTrigger value="club">Klub</TabsTrigger>
                        <TabsTrigger value="physical">Fizyczne</TabsTrigger>
                        <TabsTrigger value="contact">Kontakt</TabsTrigger>
                        <TabsTrigger value="contract">Kontrakt</TabsTrigger>
                        <TabsTrigger value="stats">Statystyki</TabsTrigger>
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
              {/* Tylko jedna sekcja na raz (accordion single) */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="grade">
                  <AccordionTrigger>Rozwiń / Zwiń</AccordionTrigger>
                  <AccordionContent>
                    <Tabs defaultValue="notes" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="notes">Notatki</TabsTrigger>
                        <TabsTrigger value="aspects">Oceny</TabsTrigger>
                        <TabsTrigger value="final">Komentarz końcowy</TabsTrigger>
                      </TabsList>

                      {/* Notatki */}
                      <TabsContent value="notes" className="mt-4 space-y-3">
                        <div className="text-sm font-medium">Notatki skauta</div>
                        <Textarea
                          placeholder="Krótki komentarz…"
                          onChange={() => setSaveStatus("idle")}
                        />
                        <div className="text-xs text-gray-500">Widoczne tylko dla Ciebie</div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Sugestie asystenta
                          </Button>
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Kopiuj
                          </Button>
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Generuj
                          </Button>
                        </div>
                        <div className="text-xs text-gray-500">
                          1 = słabo · 3–4 = solidnie · 6 = elita
                        </div>
                      </TabsContent>

                      {/* Oceny (przykładowe pola liczbowo) */}
                      <TabsContent value="aspects" className="mt-4">
                        <div className="space-y-3">
                          {[
                            "Motoryka – szybkość, wytrzymałość",
                            "Siła, pojedynki, zwinność",
                            "Technika",
                            "Gra z piłką",
                            "Gra bez piłki",
                            "Stałe fragmenty",
                            "Faza defensywna",
                            "Faza ofensywna",
                            "Fazy przejściowe",
                            "Postawa (mentalność)",
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

                      {/* Komentarz końcowy */}
                      <TabsContent value="final" className="mt-4 space-y-3">
                        <Label>Komentarz końcowy</Label>
                        <Textarea placeholder="—" />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Kopiuj
                          </Button>
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-neutral-700"
                          >
                            Generuj
                          </Button>
                          <Button className="bg-gray-900 text-white hover:bg-gray-800">
                            Wstaw do „Komentarza końcowego”
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
