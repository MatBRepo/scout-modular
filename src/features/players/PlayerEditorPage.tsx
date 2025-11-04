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
import { AlertTriangle, CheckCircle2, Loader2, ChevronsUpDown, Check } from "lucide-react";
import type { Player } from "@/shared/types";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Detailed positions (same as in AddPlayerPage) + mapping to bucket
------------------------------------------------------------------- */
type BucketPos = "GK" | "DF" | "MF" | "FW";
type DetailedPos =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "CDM"
  | "CM"
  | "CAM"
  | "LW"
  | "RW"
  | "ST";

const POS_DATA: Array<{
  value: DetailedPos;
  code: string;
  name: string;
  desc: string;
}> = [
  { value: "GK", code: "GK", name: "Bramkarz", desc: "Odbicia, gra na linii, wyjścia i gra nogami." },
  { value: "CB", code: "CB", name: "Środkowy obrońca", desc: "Gra w powietrzu, ustawienie, wyprowadzenie." },
  { value: "LB", code: "LB", name: "Lewy obrońca", desc: "Obrona strony, dośrodkowania, wsparcie ataku." },
  { value: "RB", code: "RB", name: "Prawy obrońca", desc: "Obrona strony, dośrodkowania, wsparcie ataku." },
  { value: "CDM", code: "CDM", name: "Śr. pomocnik defensywny", desc: "Odbiór, asekuracja, pierwsze podanie." },
  { value: "CM", code: "CM", name: "Środkowy pomocnik", desc: "Równowaga defensywa/kreacja." },
  { value: "CAM", code: "CAM", name: "Ofensywny pomocnik", desc: "Ostatnie podanie, kreacja, strzał." },
  { value: "LW", code: "LW", name: "Lewy pomocnik/skrzydłowy", desc: "1v1, dośrodkowania, zejścia do strzału." },
  { value: "RW", code: "RW", name: "Prawy pomocnik/skrzydłowy", desc: "1v1, dośrodkowania, zejścia do strzału." },
  { value: "ST", code: "ST", name: "Napastnik", desc: "Wykończenie, gra tyłem, ruch w polu karnym." },
];

const toBucket = (p: DetailedPos): BucketPos => {
  switch (p) {
    case "GK":
      return "GK";
    case "CB":
    case "LB":
    case "RB":
      return "DF";
    case "CDM":
    case "CM":
    case "CAM":
    case "LW":
    case "RW":
      return "MF";
    case "ST":
      return "FW";
  }
};

// Fallback detailed position from bucket if meta.detailedPos missing
function detailedFromBucket(pos?: Player["pos"]): DetailedPos {
  switch (pos) {
    case "GK":
      return "GK";
    case "DF":
      return "CB";
    case "MF":
      return "CM";
    case "FW":
      return "ST";
    default:
      return "CM";
  }
}

/* ----------------------------------------
   Countries (flags) + combobox (same as AddPlayerPage)
----------------------------------------- */
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

function CountryCombobox({
  value,
  onChange,
  error,
}: {
  value: string; // country name
  onChange: (next: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.name === value);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            className={cn(
              "flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm dark:bg-neutral-950",
              error ? "border-red-500" : "border-gray-300 dark:border-neutral-700"
            )}
          >
            <span className={cn("flex min-w-0 items-center gap-2", !selected && "text-muted-foreground")}>
              {selected ? (
                <>
                  <span className="text-base leading-none">{selected.flag}</span>
                  <span className="truncate">{selected.name}</span>
                </>
              ) : (
                "Wybierz kraj"
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter>
            <CommandInput placeholder="Szukaj kraju…" />
            <CommandList>
              <CommandEmpty>Brak wyników.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => {
                  const active = c.name === value;
                  return (
                    <CommandItem
                      key={c.code}
                      value={`${c.name} ${c.code}`}
                      onSelect={() => {
                        onChange(c.name); // (change to c.code if you prefer ISO)
                        setOpen(false);
                      }}
                    >
                      <span className="mr-2 text-base">{c.flag}</span>
                      <span className="mr-2">{c.name}</span>
                      <span className={cn("ml-auto", active ? "opacity-100" : "opacity-0")}>
                        <Check className="h-4 w-4" />
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

/* =========================================
   Page
========================================= */
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
    overwritePlayer(updated as Player);
  }

  // Zmiana szczegółowej pozycji (aktualizuje też bucket)
  function updateDetailedPos(sel: DetailedPos) {
    if (!p) return;
    const next: Player = {
      ...p,
      pos: toBucket(sel) as Pos,
      ...(p as any),
      // store meta.detailedPos alongside (as in AddPlayerPage)
      ...(typeof (p as any).meta === "object"
        ? { meta: { ...(p as any).meta, detailedPos: sel } }
        : { meta: { detailedPos: sel } }),
    } as any;
    bumpSaving();
    overwritePlayer(next);
  }

  // Odczyt aktualnej szczegółowej pozycji do Selecta
  const currentDetailedPos: DetailedPos | null = useMemo(() => {
    if (!p) return null;
    const metaPos = ((p as any).meta?.detailedPos as DetailedPos | undefined) ?? undefined;
    return metaPos ?? detailedFromBucket(p.pos);
  }, [p]);

  // „Anuluj” — przywrócenie snapshotu
  function cancelToOriginal() {
    const orig = originalRef.current;
    if (!orig) return;
    setSaveStatus("saving");
    overwritePlayer(structuredClone(orig));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveStatus("saved"), 450);
  }

  // Ręczne „Zapisz” (potwierdzenie; autosave i tak zapisuje on-change)
  function manualSave() {
    if (!p) return;
    bumpSaving();
    overwritePlayer({ ...p });
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
                {/* === Detailed position selector (like AddPlayerPage) === */}
                <Select
                  value={currentDetailedPos ?? undefined}
                  onValueChange={(v) => updateDetailedPos(v as DetailedPos)}
                >
                  <SelectTrigger className="w-full justify-start border-gray-300 dark:border-neutral-700 dark:bg-neutral-950 [&>svg]:ml-auto">
                    <SelectValue placeholder="Wybierz pozycję" />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_DATA.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="text-left">
                          <div className="font-medium">
                            {opt.code}: {opt.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{opt.desc}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-gray-500">
                  Zapisuje się jako <b>{toBucket((currentDetailedPos ?? "CM") as DetailedPos)}</b> w polu głównym <code>pos</code>.
                </p>
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
                {/* === Country combobox (like AddPlayerPage) === */}
                <CountryCombobox
                  value={p.nationality ?? ""}
                  onChange={(val) => saveBasic({ nationality: val })}
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
