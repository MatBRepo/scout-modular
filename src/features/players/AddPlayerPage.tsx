"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Player } from "@/shared/types";
import { User2, Shirt } from "lucide-react";

type Pos = Player["pos"];

export default function AddPlayerPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<"known" | "unknown" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // --- Znam zawodnika ---
  const [known, setKnown] = useState({
    firstName: "",
    lastName: "",
    pos: "MF" as Pos,
    age: "",
    club: "",
    birthDate: "",
    nationality: "",
  });

  // --- Nie znam zawodnika ---
  const [unknown, setUnknown] = useState({
    optionalName: "",
    jerseyNumber: "",
    pos: "MF" as Pos,
    age: "",
    club: "",
  });

  function validateStep1() {
    if (!choice) {
      setErrors({ choice: "Wybierz jedną z opcji." });
      return false;
    }
    setErrors({});
    return true;
  }

  function validateStep2() {
    const next: Record<string, string> = {};
    if (choice === "known") {
      if (!known.firstName.trim()) next["known.firstName"] = "Imię jest wymagane.";
      if (!known.lastName.trim()) next["known.lastName"] = "Nazwisko jest wymagane.";
    } else {
      if (!unknown.optionalName.trim() && !unknown.jerseyNumber.trim()) {
        next["unknown.jerseyNumber"] =
          "Podaj numer na koszulce lub imię i nazwisko.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function save() {
    const id = Date.now();
    let newPlayer: Player;

    if (choice === "known") {
      const name =
        `${known.firstName.trim()} ${known.lastName.trim()}`.trim() || "Bez nazwy";
      newPlayer = {
        id,
        name,
        pos: known.pos,
        club: known.club.trim(),
        age: known.age ? parseInt(known.age, 10) || 0 : 0,
        status: "active",
        firstName: known.firstName.trim() || undefined,
        lastName: known.lastName.trim() || undefined,
        birthDate: known.birthDate || undefined,
        nationality: known.nationality || undefined,
      };
    } else {
      const labelName =
        unknown.optionalName.trim() ||
        (unknown.jerseyNumber ? `#${unknown.jerseyNumber.trim()}` : "") ||
        "Szkic zawodnika";
      newPlayer = {
        id,
        name: labelName,
        pos: unknown.pos,
        club: unknown.club.trim(),
        age: unknown.age ? parseInt(unknown.age, 10) || 0 : 0,
        status: "active",
      };
    }

    try {
      const raw = localStorage.getItem("s4s.players");
      const arr: Player[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem("s4s.players", JSON.stringify([newPlayer, ...arr]));
    } catch {}

    router.push(`/players/${id}`);
  }

  return (
    <div className="w-full">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Baza zawodników", href: "/players" },
          { label: "Dodaj zawodnika" },
        ]}
      />
      <Toolbar title="Dodaj zawodnika" />

      {/* --- KROK 1 --- */}
      {step === 1 && (
        <div className="max-w-xl space-y-3">
          {/* Znam zawodnika (z ikoną) */}
          <button
            onClick={() => {
              setChoice("known");
              setErrors({});
            }}
            className={
              "w-full rounded-lg border p-4 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-900 " +
              (choice === "known"
                ? "border-gray-900 bg-gray-900/5 dark:border-neutral-300"
                : "border-gray-300 dark:border-neutral-700")
            }
          >
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <User2 className="h-4 w-4" />
              Znam zawodnika
            </div>
            <div className="text-xs text-gray-500">
              Wpisz imię, nazwisko i podstawowe informacje. Resztę ustawisz później
              w profilu.
            </div>
          </button>

          {/* Nie znam zawodnika (z ikoną koszulki) */}
          <button
            onClick={() => {
              setChoice("unknown");
              setErrors({});
            }}
            className={
              "w-full rounded-lg border p-4 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-900 " +
              (choice === "unknown"
                ? "border-gray-900 bg-gray-900/5 dark:border-neutral-300"
                : "border-gray-300 dark:border-neutral-700")
            }
          >
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <Shirt className="h-4 w-4" />
              Nie znam zawodnika
            </div>
            <div className="text-xs text-gray-500">
              Podaj numer na koszulce (lub imię i nazwisko, jeśli chcesz).
            </div>
          </button>

          {errors["choice"] && (
            <p className="text-xs text-red-600">{errors["choice"]}</p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => history.back()}
              className="border-gray-300 dark:border-neutral-700"
            >
              Anuluj
            </Button>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
            >
              Dalej
            </Button>
          </div>
        </div>
      )}

      {/* --- KROK 2: ZNAM --- */}
      {step === 2 && choice === "known" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Lewa kolumna (50%) — podstawowe wymagane */}
          <Card>
            <CardHeader>
              <CardTitle>Podstawowe dane</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>
                    Imię <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    value={known.firstName}
                    onChange={(e) =>
                      setKnown((d) => ({ ...d, firstName: e.target.value }))
                    }
                    aria-invalid={!!errors["known.firstName"]}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  {errors["known.firstName"] && (
                    <p className="text-xs text-red-600">
                      {errors["known.firstName"]}
                    </p>
                  )}
                </div>
                <div>
                  <Label>
                    Nazwisko <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    value={known.lastName}
                    onChange={(e) =>
                      setKnown((d) => ({ ...d, lastName: e.target.value }))
                    }
                    aria-invalid={!!errors["known.lastName"]}
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                  {errors["known.lastName"] && (
                    <p className="text-xs text-red-600">
                      {errors["known.lastName"]}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pozycja</Label>
                  <Select
                    value={known.pos}
                    onValueChange={(v) =>
                      setKnown((d) => ({ ...d, pos: v as Pos }))
                    }
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
                  <Label>Wiek (opcjonalnie)</Label>
                  <Input
                    type="number"
                    value={known.age}
                    onChange={(e) =>
                      setKnown((d) => ({ ...d, age: e.target.value }))
                    }
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Klub</Label>
                  <Input
                    value={known.club}
                    onChange={(e) =>
                      setKnown((d) => ({ ...d, club: e.target.value }))
                    }
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <Label>Narodowość</Label>
                  <Input
                    value={known.nationality}
                    onChange={(e) =>
                      setKnown((d) => ({ ...d, nationality: e.target.value }))
                    }
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div>
                <Label>Data urodzenia</Label>
                <Input
                  type="date"
                  value={known.birthDate}
                  onChange={(e) =>
                    setKnown((d) => ({ ...d, birthDate: e.target.value }))
                  }
                  className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="border-gray-300 dark:border-neutral-700"
                >
                  Wstecz
                </Button>
                <Button
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  onClick={() => {
                    if (validateStep2()) save();
                  }}
                >
                  Zapisz
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Prawa kolumna — Accordion + Tabs (opcjonalne) */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Rozszerzone informacje (opcjonalne)</CardTitle>
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
                                value={known.club}
                                onChange={(e) =>
                                  setKnown((d) => ({ ...d, club: e.target.value }))
                                }
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

            <Card>
              <CardHeader>
                <CardTitle>Komentarze</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="comments">
                    <AccordionTrigger>Rozwiń / Zwiń</AccordionTrigger>
                    <AccordionContent>
                      <Tabs defaultValue="notes" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="notes">Notatki</TabsTrigger>
                          <TabsTrigger value="final">Final</TabsTrigger>
                        </TabsList>

                        <TabsContent value="notes" className="mt-4">
                          <Input placeholder="Krótka notatka…" />
                        </TabsContent>
                        <TabsContent value="final" className="mt-4">
                          <Input placeholder="Final comment…" />
                        </TabsContent>
                      </Tabs>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- KROK 2: NIE ZNAM --- */}
      {step === 2 && choice === "unknown" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Lewa kolumna — numer na koszulce + pola pomocnicze */}
          <Card>
            <CardHeader>
              <CardTitle>Szkic zawodnika</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Imię i nazwisko (opcjonalnie)</Label>
                <Input
                  value={unknown.optionalName}
                  onChange={(e) =>
                    setUnknown((d) => ({ ...d, optionalName: e.target.value }))
                  }
                  className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>

              <div>
                <Label>
                  Numer na koszulce{" "}
                  {unknown.optionalName ? (
                    <span className="text-gray-400">(opcjonalnie)</span>
                  ) : (
                    <span className="text-red-600">*</span>
                  )}
                </Label>
                <Input
                  value={unknown.jerseyNumber}
                  onChange={(e) =>
                    setUnknown((d) => ({ ...d, jerseyNumber: e.target.value }))
                  }
                  aria-invalid={!!errors["unknown.jerseyNumber"]}
                  placeholder="np. 27"
                  className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                />
                {errors["unknown.jerseyNumber"] && (
                  <p className="text-xs text-red-600">
                    {errors["unknown.jerseyNumber"]}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pozycja</Label>
                  <Select
                    value={unknown.pos}
                    onValueChange={(v) =>
                      setUnknown((d) => ({ ...d, pos: v as Pos }))
                    }
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
                  <Label>Wiek (opcjonalnie)</Label>
                  <Input
                    type="number"
                    value={unknown.age}
                    onChange={(e) =>
                      setUnknown((d) => ({ ...d, age: e.target.value }))
                    }
                    className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div>
                <Label>Klub (jeśli znany)</Label>
                <Input
                  value={unknown.club}
                  onChange={(e) =>
                    setUnknown((d) => ({ ...d, club: e.target.value }))
                  }
                  className="border-gray-300 dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="border-gray-300 dark:border-neutral-700"
                >
                  Wstecz
                </Button>
                <Button
                  className="bg-gray-900 text-white hover:bg-gray-800"
                  onClick={() => {
                    if (validateStep2()) save();
                  }}
                >
                  Zapisz
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Prawa kolumna — PREVIEW z Twoim SVG */}
          <Card className="flex items-center justify-center">
            <div className="p-6">
              <JerseyPreview number={unknown.jerseyNumber} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Podgląd koszulki (Twoje SVG) + realtime numer */
function JerseyPreview({ number }: { number: string }) {
  const n = (number || "").trim().slice(0, 3);

  return (
    <div className="relative mx-auto h-[320px] w-[320px]">
      {/* SVG skalowane z Twojego pliku (kolor przez currentColor, działa w dark) */}
      <svg
        className="h-full w-full text-gray-800 dark:text-neutral-200"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <path
          d="M13.5867 2.30659L10.6667 1.33325C10.6667 2.0405 10.3857 2.71877 9.88565 3.21887C9.38555 3.71897 8.70727 3.99992 8.00003 3.99992C7.29278 3.99992 6.61451 3.71897 6.11441 3.21887C5.61431 2.71877 5.33336 2.0405 5.33336 1.33325L2.41336 2.30659C2.11162 2.40711 1.85575 2.6122 1.69193 2.88481C1.52811 3.15743 1.46715 3.47963 1.52003 3.79325L1.90669 6.10659C1.93208 6.26319 2.01248 6.40562 2.13345 6.50826C2.25443 6.61091 2.40804 6.66704 2.56669 6.66659H4.00003V13.3333C4.00003 14.0666 4.60003 14.6666 5.33336 14.6666H10.6667C11.0203 14.6666 11.3595 14.5261 11.6095 14.2761C11.8596 14.026 12 13.6869 12 13.3333V6.66659H13.4334C13.592 6.66704 13.7456 6.61091 13.8666 6.50826C13.9876 6.40562 14.068 6.26319 14.0934 6.10659L14.48 3.79325C14.5329 3.47963 14.4719 3.15743 14.3081 2.88481C14.1443 2.6122 13.8884 2.40711 13.5867 2.30659Z"
          stroke="currentColor"
          strokeWidth="0.33333"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* Numer overlay, wycentrowany */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="select-none text-7xl font-extrabold leading-none text-gray-900 dark:text-neutral-100">
          {n || "—"}
        </span>
      </div>
    </div>
  );
}
