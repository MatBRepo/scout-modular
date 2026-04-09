// src/app/(players)/players/[id]/PlayerEditorPage.tsx
"use client";
import { computePlayerProfileProgress } from "@/shared/playerProfileProgress";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useParams, useRouter } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";

// shared pitch + positions
import {
  MainPositionPitch,
  POS_DATA,
  type DetailedPos,
} from "@/shared/MainPositionPitch";

import { Toolbar } from "@/shared/ui/atoms";
import { ToolbarFull } from "@/shared/ui/atoms";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import PlayerObservationsTable from "@/features/players/PlayerObservationsTable";

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
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronsUpDown,
  Check,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Copy,
  ClipboardPaste,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CircularProgress } from "@/shared/ui/CircularProgress";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import StarRating from "@/shared/ui/StarRating";
import { KnownPlayerIcon, UnknownPlayerIcon } from "@/components/icons";

import {
  loadRatings,
  syncRatingsFromSupabase,
  type RatingsConfig,
  type RatingAspect,
} from "@/shared/ratings";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

import { getSupabase } from "@/lib/supabaseClient";
import { RadioChipGroup } from "@/components/ui/RadioChipGroup";

// RAC fields
import { BirthDatePicker } from "@/components/ui/birthdate-picker-rac";
import { NumericField } from "@/components/ui/numeric-field-rac";

// header actions (global)
import { useHeaderActions } from "@/app/ClientRoot";

/* ===== ENV / defaults ===== */
const SCOUT_DEFAULT_COUNTRY =
  process.env.NEXT_PUBLIC_SCOUT_DEFAULT_COUNTRY || "";

/* ===== Positions ===== */
type BucketPos = "GK" | "DF" | "MF" | "FW";

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

/* ===== Countries ===== */
type Country = { code: string; name: string; flag: string };
const COUNTRIES: Country[] = [
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹" },
  { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "HR", name: "Croatia", flag: "🇭🇷" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
];

/* ===== Small UI ===== */

function SavePill({
  state,
  size = "compact",
}: {
  state: "idle" | "saving" | "saved";
  size?: "default" | "compact";
  mode?: "known" | "unknown" | null;
}) {
  const base =
    size === "compact"
      ? "inline-flex h-8 items-center rounded-md px-2 text-xs leading-none"
      : "inline-flex h-10 items-center rounded-md px-3 text-sm leading-none";

  const map = {
    saving: "text-amber-700 dark:text-amber-200",
    saved: "text-emerald-700 dark:text-emerald-200",
    idle: "text-gray-600 dark:text-neutral-300",
  } as const;

  if (state === "idle") {
    return null;
  }

  return (
    <>
      <span className={cn(base, map[state], "hidden md:inline-flex")} aria-live="polite">
        {state === "saving" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
            <span className="hidden md:inline">Auto-saving…</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Saved</span>
          </>
        )}
      </span>

      <div className="fixed top-[57px] left-0 right-0 z-[60] h-[3px] md:hidden">
        {state === "saving" && (
          <div className="h-full w-full overflow-hidden bg-gray-500/10">
            <div className="animate-progress-saving h-full w-0" />
          </div>
        )}
        {state === "saved" && (
          <div className="h-full w-full bg-emerald-500" />
        )}
      </div>
    </>
  );
}

/* Country combobox (old – left for the future, not used here) */
function CountryCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.name === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className={cn(
            "relative flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm dark:bg-neutral-950",
            "border-gray-300 dark:border-neutral-700"
          )}
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2",
              !selected && "text-muted-foreground"
            )}
          >
            {selected ? (
              <>
                <span className="text-base leading-none">{selected.flag}</span>
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              "Select country"
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search country…"
            className="border-0 bg-transparent px-3 py-2 text-sm shadow-none focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => {
                const active = c.name === value;
                return (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.code}`}
                    onSelect={() => {
                      onChange(c.name);
                      setOpen(false);
                    }}
                  >
                    <span className="mr-2 text-base">{c.flag}</span>
                    <span className="mr-2">{c.name}</span>
                    <span
                      className={cn(
                        "ml-auto",
                        active ? "opacity-100" : "opacity-0"
                      )}
                    >
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
  );
}

/* NEW: CountrySearchCombobox – same as in AddPlayerPage */
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
            "hover:bg:white focus-visible:outline-none focus-visible:ring-offset-0",
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
              <span className="text-muted-foreground">Select country</span>
            )}
          </span>
          <ChevronDown
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
            placeholder="Search country..."
            className={cn(
              "m-2 h-9 w-[calc(100%-1rem)] rounded-md border border-stone-200 bg-background px-3 text-sm",
              "shadow-none outline-none",
              "focus-visible:outline-none focus-visible:ring-offset-0",
              "dark:border-neutral-700 dark:bg-neutral-950"
            )}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No results.</CommandEmpty>
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

/* Utility: safe text-normalizer for possibly object values */
function safeText(val: any): string {
  if (val == null) return "";
  if (typeof val === "string" || typeof val === "number") return String(val);
  if (typeof val === "object") {
    if ("name" in val) return String((val as any).name);
    if ("label" in val) return String((val as any).label);
  }
  return "";
}

/* DateTime picker 24h – placeholder type for hidden code */
type DateTimeValue = {
  date: string;
  time: string;
};

/* ===== Editor page ===== */
type Choice = "known" | "unknown" | null;

type ObsRec = {
  id: number | string; // IMPORTANT: can be string or number
  match?: string | any;
  date?: string | any;
  time?: string | any;
  status?: "draft" | "final";
  mode?: "live" | "tv" | "mix";
  competition?: string | any; // ⬅️ NEW
  opponentLevel?: string | any;
  players?: any[];
};

type PlayerRatings = Record<string, number>;

function getDefaultExt() {
  return {
    height: "",
    weight: "",
    dominantFoot: "",
    mainPos: "" as DetailedPos | "",
    altPositions: [] as DetailedPos[],

    english: null as null | boolean,
    euPassport: null as null | boolean,
    birthCountry: "",
    contractStatus: "",
    agency: "",
    releaseClause: "",
    leagueLevel: "",
    clipsLinks: "",
    transfermarkt: "",
    wyscout: "",

    injuryHistory: "",
    minutes365: "",
    starts365: "",
    subs365: "",
    goals365: "",

    phone: "",
    email: "",
    fb: "",
    ig: "",
    tiktok: "",
  };
}

type ExtState = ReturnType<typeof getDefaultExt>;
type ExtKey = "profile" | "eligibility" | "stats365" | "contact";

type ExtContentProps = {
  view: ExtKey;
  ext: ExtState;
  setExt: Dispatch<SetStateAction<ExtState>>;
};

function ExtContent({ view, ext, setExt }: ExtContentProps) {
  switch (view) {
    case "profile": {
      const bucketLabels: Record<BucketPos, string> = {
        GK: "Goalkeeper",
        DF: "Defense",
        MF: "Midfield",
        FW: "Attack",
      };

      const byBucket: Record<BucketPos, typeof POS_DATA> = {
        GK: [],
        DF: [],
        MF: [],
        FW: [],
      };

      POS_DATA.forEach((opt) => {
        const bucket = toBucket(opt.value as DetailedPos);
        byBucket[bucket] = [...byBucket[bucket], opt];
      });

      // We do not show the goalkeeper in alternative positions
      const bucketOrder: BucketPos[] = ["DF", "MF", "FW"];

      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label className="text-sm">Height (cm)</Label>
              <NumericField
                value={ext.height === "" ? undefined : Number(ext.height)}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    height: val == null ? "" : String(val),
                  }))
                }
                placeholder="e.g. 182"
              />
            </div>

            <div>
              <Label className="text-sm">Weight (kg)</Label>
              <NumericField
                value={ext.weight === "" ? undefined : Number(ext.weight)}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    weight: val == null ? "" : String(val),
                  }))
                }
                placeholder="e.g. 76"
              />
            </div>

            <div>
              <Label className="text-sm">Dominant foot</Label>
              <Select
                value={ext.dominantFoot || undefined}
                onValueChange={(val) =>
                  setExt((s) => ({ ...s, dominantFoot: val }))
                }
              >
                <SelectTrigger className="w-full border-gray-300 dark:border-neutral-700 dark:bg-neutral-950">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">Right (R)</SelectItem>
                  <SelectItem value="L">Left (L)</SelectItem>
                  <SelectItem value="Both">Both feet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm">Alternative positions</Label>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {bucketOrder.map((bucket) => {
                const group = byBucket[bucket];
                if (!group.length) return null;

                return (
                  <div key={bucket} className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-neutral-400">
                      {bucketLabels[bucket]}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {group.map((opt) => {
                        const checked = ext.altPositions.includes(opt.value);
                        const itemId = `alt-pos-${opt.value}`;

                        return (
                          <div
                            key={opt.value}
                            className={cn(
                              "relative flex w-full items-start gap-2 rounded-md border border-input p-3 text-xs shadow-xs outline-none",
                              "has-[data-state=checked]:border-[#000000] has-[data-state=checked]:bg-primary/5"
                            )}
                          >
                            <Checkbox
                              id={itemId}
                              aria-describedby={`${itemId}-description`}
                              className="order-1 mt-0.5 after:absolute after:inset-0"
                              checked={checked}
                              onCheckedChange={(next) => {
                                const isChecked = Boolean(next);
                                setExt((s) => {
                                  const current = s.altPositions;
                                  const nextPositions = isChecked
                                    ? [...current, opt.value]
                                    : current.filter((x) => x !== opt.value);
                                  return {
                                    ...s,
                                    altPositions: nextPositions,
                                  };
                                });
                              }}
                            />
                            <div className="grid grow gap-1">
                              <Label
                                htmlFor={itemId}
                                className="text-xs font-medium text-foreground"
                              >
                                {opt.code}{" "}
                                <span className="font-normal text-muted-foreground text-[11px] leading-[inherit]">
                                  ({opt.name})
                                </span>
                              </Label>
                              <p
                                className="text-[11px] text-muted-foreground"
                                id={`${itemId}-description`}
                              >
                                {opt.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    case "eligibility":
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <RadioChipGroup
                legend="English language proficiency"
                layout="grid-2"
                value={
                  ext.english === true
                    ? "yes"
                    : ext.english === false
                      ? "no"
                      : ""
                }
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    english:
                      val === "yes" ? true : val === "no" ? false : null,
                  }))
                }
              />
            </div>
            <div>
              <RadioChipGroup
                legend="EU Passport"
                layout="grid-2"
                value={
                  ext.euPassport === true
                    ? "yes"
                    : ext.euPassport === false
                      ? "no"
                      : ""
                }
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    euPassport:
                      val === "yes" ? true : val === "no" ? false : null,
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-sm">Country of birth</Label>
              <CountrySearchCombobox
                value={ext.birthCountry}
                onChange={(val) =>
                  setExt((s) => ({ ...s, birthCountry: val }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <Label className="text-sm">Contract status</Label>
              <Input
                value={ext.contractStatus}
                onChange={(e) =>
                  setExt((s) => ({
                    ...s,
                    contractStatus: e.target.value,
                  }))
                }
                placeholder="e.g. until 2027, free agent…"
              />
            </div>
            <div>
              <Label className="text-sm">Management agency</Label>
              <Input
                value={ext.agency}
                onChange={(e) =>
                  setExt((s) => ({ ...s, agency: e.target.value }))
                }
                placeholder="e.g. XYZ Management"
              />
            </div>
            <div>
              <Label className="text-sm">Release clause</Label>
              <Input
                value={ext.releaseClause}
                onChange={(e) =>
                  setExt((s) => ({
                    ...s,
                    releaseClause: e.target.value,
                  }))
                }
                placeholder="Amount, clause, notes…"
              />
            </div>
            <div>
              <Label className="text-sm">
                League level of current club
              </Label>
              <Input
                value={ext.leagueLevel}
                onChange={(e) =>
                  setExt((s) => ({ ...s, leagueLevel: e.target.value }))
                }
                placeholder="e.g. Ekstraklasa, CLJ U19, 3rd league…"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">Clip links / time-codes</Label>
              <Textarea
                value={ext.clipsLinks}
                onChange={(e) =>
                  setExt((s) => ({ ...s, clipsLinks: e.target.value }))
                }
                placeholder="List of links (one per line)…"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {/* Transfermarkt + copy/paste */}
              <div>
                <Label className="text-sm">Transfermarkt link</Label>
                <div className="relative mt-1">
                  <Input
                    value={ext.transfermarkt}
                    onChange={(e) =>
                      setExt((s) => ({
                        ...s,
                        transfermarkt: e.target.value,
                      }))
                    }
                    placeholder="https://www.transfermarkt…"
                    className="pr-24"
                  />
                  {/* Paste */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-10 top-1/2 h-8 w-8 -translate-y-1/2 border-none"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (!text) return;
                        setExt((s) => ({ ...s, transfermarkt: text }));
                      } catch (err) {
                        console.error("Clipboard paste failed", err);
                      }
                    }}
                  >
                    <ClipboardPaste className="h-3 w-3" />
                  </Button>
                  {/* Copy */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 border-none"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          ext.transfermarkt || ""
                        );
                      } catch (err) {
                        console.error("Clipboard copy failed", err);
                      }
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Laczy Nas Pilka + copy/paste */}
              <div>
                <Label className="text-sm">Laczy Nas Pilka link</Label>
                <div className="relative mt-1">
                  <Input
                    value={ext.wyscout}
                    onChange={(e) =>
                      setExt((s) => ({
                        ...s,
                        wyscout: e.target.value,
                      }))
                    }
                    placeholder="https://www.laczynaspilka.pl/…"
                    className="pr-24"
                  />
                  {/* Paste */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-10 top-1/2 h-8 w-8 -translate-y-1/2 border-none"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (!text) return;
                        setExt((s) => ({ ...s, wyscout: text }));
                      } catch (err) {
                        console.error("Clipboard paste failed", err);
                      }
                    }}
                  >
                    <ClipboardPaste className="h-3 w-3" />
                  </Button>
                  {/* Copy */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 border-none"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          ext.wyscout || ""
                        );
                      } catch (err) {
                        console.error("Clipboard copy failed", err);
                      }
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case "stats365":
      return (
        <div className="space-y-5">
          <div>
            <Label className="text-sm">Injury history (if available)</Label>
            <Textarea
              value={ext.injuryHistory}
              onChange={(e) =>
                setExt((s) => ({
                  ...s,
                  injuryHistory: e.target.value,
                }))
              }
              placeholder="Short description of injuries, breaks, surgeries…"
              className="mt-1"
            />
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            <div>
              <NumericField
                label="Minutes in the last 365 days"
                value={ext.minutes365 === "" ? undefined : Number(ext.minutes365)}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    minutes365: val == null ? "" : String(val),
                  }))
                }
                placeholder="0"
              />
            </div>

            <div>
              <NumericField
                label="Matches as starter"
                value={ext.starts365 === "" ? undefined : Number(ext.starts365)}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    starts365: val == null ? "" : String(val),
                  }))
                }
                placeholder="0"
              />
            </div>

            <div>
              <NumericField
                label="Matches as substitute"
                value={ext.subs365 === "" ? undefined : Number(ext.subs365)}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    subs365: val == null ? "" : String(val),
                  }))
                }
                placeholder="0"
              />
            </div>

            <div>
              <NumericField
                label="Goals in the last 365 days"
                value={ext.goals365 === "" ? undefined : Number(ext.goals365)}
                onChange={(val) =>
                  setExt((s) => ({
                    ...s,
                    goals365: val == null ? "" : String(val),
                  }))
                }
                placeholder="0"
              />
            </div>
          </div>
        </div>
      );

    case "contact":
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <Label className="text-sm">Contact phone</Label>
              <Input
                value={ext.phone}
                onChange={(e) =>
                  setExt((s) => ({ ...s, phone: e.target.value }))
                }
                placeholder="+48…"
              />
            </div>
            <div>
              <Label className="text-sm">Contact e-mail</Label>
              <Input
                type="email"
                value={ext.email}
                onChange={(e) =>
                  setExt((s) => ({ ...s, email: e.target.value }))
                }
                placeholder="mail@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label className="text-sm">FB Link</Label>
              <Input
                value={ext.fb}
                onChange={(e) =>
                  setExt((s) => ({ ...s, fb: e.target.value }))
                }
                placeholder="https://facebook.com/…"
              />
            </div>
            <div>
              <Label className="text-sm">IG Link</Label>
              <Input
                value={ext.ig}
                onChange={(e) =>
                  setExt((s) => ({ ...s, ig: e.target.value }))
                }
                placeholder="https://instagram.com/…"
              />
            </div>
            <div>
              <Label className="text-sm">TikTok Link</Label>
              <Input
                value={ext.tiktok}
                onChange={(e) =>
                  setExt((s) => ({ ...s, tiktok: e.target.value }))
                }
                placeholder="https://tiktok.com/@…"
              />
            </div>
          </div>
        </div>
      );
  }
}

function RatingRow({
  aspect,
  ratings,
  setRatings,
}: {
  aspect: RatingAspect;
  ratings: PlayerRatings;
  setRatings: React.Dispatch<React.SetStateAction<PlayerRatings>>;
}) {
  const val = ratings[aspect.key] ?? 0;
  const hasTooltip = !!aspect.tooltip;

  return (
    <div className="flex w-full max-w-[320px] flex-col justify-between rounded-md border border-stone-200 bg-white/90 p-3 text-xs shadow-sm transition-shadow dark:border-neutral-700 dark:bg-neutral-950/80">
      <div className="mb-2 flex items-start gap-2 flex-1">
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-medium">{aspect.label}</span>
            {hasTooltip && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-snug">
                    {aspect.tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {aspect.tooltip && (
            <p className="mt-1 text-[11px] text-stone-500 dark:text-neutral-400">
              {aspect.tooltip}
            </p>
          )}
        </div>
      </div>
      <div className="mt-1">
        <StarRating
          max={5}
          value={val}
          onChange={(v) =>
            setRatings((prev) => ({
              ...prev,
              [aspect.key]: v,
            }))
          }
        />
      </div>
    </div>
  );
}

function RatingGroup({
  title,
  aspects,
  ratings,
  setRatings,
}: {
  title: string;
  aspects: RatingAspect[];
  ratings: PlayerRatings;
  setRatings: React.Dispatch<React.SetStateAction<PlayerRatings>>;
}) {
  if (!aspects.length) return null;
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
        <span className="h-1.5 w-1.5 rounded-md bg-stone-500" />
        {title}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {aspects.map((aspect) => (
          <RatingRow
            key={aspect.id}
            aspect={aspect}
            ratings={ratings}
            setRatings={setRatings}
          />
        ))}
      </div>
    </div>
  );
}

export default function PlayerEditorPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { setActions } = useHeaderActions();

  const initialId = params?.id ? Number(params.id) : NaN;
  const [playerId] = useState<number | null>(
    Number.isNaN(initialId) ? null : initialId
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [choice, setChoice] = useState<Choice>(null);

  const [basicOpen, setBasicOpen] = useState(true);
  const [extOpen, setExtOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [club, setClub] = useState("");
  const [clubCountry, setClubCountry] = useState("");

  const [jerseyNumber, setJerseyNumber] = useState("");
  const [uNote, setUNote] = useState("");

  const [posDet, setPosDet] = useState<DetailedPos>("CM");
  const [uPosDet, setUPosDet] = useState<DetailedPos>("CM");

  const [ext, setExt] = useState<ExtState>(getDefaultExt);

  const [ratingConfig, setRatingConfig] = useState<RatingsConfig>(() =>
    loadRatings()
  );
  const [ratings, setRatings] = useState<PlayerRatings>({});
  const [notes, setNotes] = useState("");

  const basicRef = useRef<HTMLDivElement | null>(null);

  // default scout country – only if nothing is there
  useEffect(() => {
    if (!SCOUT_DEFAULT_COUNTRY) return;
    setExt((prev) => {
      if (prev.birthCountry) return prev;
      return { ...prev, birthCountry: SCOUT_DEFAULT_COUNTRY };
    });
    setClubCountry((prev) => prev || SCOUT_DEFAULT_COUNTRY);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await syncRatingsFromSupabase();
      if (!cancelled) setRatingConfig(cfg);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledRatingAspects = useMemo<RatingAspect[]>(
    () => ratingConfig.filter((r) => r.enabled !== false),
    [ratingConfig]
  );

  // Ładowanie zawodnika z Supabase do edycji
  const [observations, setObservations] = useState<ObsRec[]>([]);
  const [obsQuery, setObsQuery] = useState("");
  const [obsSelectedId, setObsSelectedId] = useState<number | string | null>(
    null
  );

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .eq("id", playerId)
          .single();

        if (error) {
          console.error("[PlayerEditorPage] load error:", error);
          if (!cancelled) {
            setLoadError("Failed to load player.");
          }
          return;
        }

        if (!cancelled && data) {
          const meta = data.meta || {};
          const basicMeta = meta.basic || {};
          const extended = meta.extended || {};
          const mode: Choice =
            meta.mode === "unknown"
              ? "unknown"
              : meta.mode === "known"
                ? "known"
                : data.firstName || data.lastName
                  ? "known"
                  : "unknown";

          setChoice(mode);

          // Common fields for both modes
          setFirstName(basicMeta.firstName ?? data.firstName ?? "");
          setLastName(basicMeta.lastName ?? data.lastName ?? "");
          setBirthYear(basicMeta.birthYear ?? data.birthDate ?? "");
          setJerseyNumber(basicMeta.jerseyNumber ?? "");
          setClub(basicMeta.club ?? data.club ?? "");
          setClubCountry(
            basicMeta.clubCountry ??
            extended.birthCountry ??
            data.nationality ??
            ""
          );
          setUNote(meta.unknownNote ?? "");

          const mergedExt = {
            ...getDefaultExt(),
            ...(extended || {}),
          };

          const mainPos: DetailedPos =
            (mergedExt.mainPos as DetailedPos | "") ||
            (basicMeta.posDet as DetailedPos | "") ||
            "CM";

          const mergedWithMainPos = { ...mergedExt, mainPos };

          setExt(mergedWithMainPos);
          setPosDet(mainPos);
          setUPosDet(mainPos);

          setRatings(meta.ratings || {});
          setNotes(meta.notes || "");

          const obsMeta = meta.observationsMeta || {};
          setObservations(obsMeta.list || []);
          setObsSelectedId(obsMeta.selectedId ?? null);
        }
      } catch (err) {
        console.error("[PlayerEditorPage] load exception:", err);
        if (!cancelled) {
          setLoadError("An error occurred while loading the player.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  // AUTOMATIC calculation of profile mode (known / unknown) based on fields
  useEffect(() => {
    const hasPersonal = firstName.trim() !== "" && lastName.trim() !== "";

    const hasAnon =
      jerseyNumber.trim() !== "" ||
      uNote.trim() !== "" ||
      (!hasPersonal &&
        (club.trim() !== "" || clubCountry.trim() !== ""));

    let next: Choice;
    if (hasPersonal && !hasAnon) {
      next = "known";
    } else if (!hasPersonal && hasAnon) {
      next = "unknown";
    } else if (hasPersonal && hasAnon) {
      next = "known";
    } else {
      next = null;
    }

    setChoice((prev) => (prev === next ? prev : next));
  }, [firstName, lastName, birthYear, club, clubCountry, jerseyNumber, uNote]);

  // Display name in the player observations table
  const playerDisplayName = useMemo(() => {
    if (choice === "known") {
      const fn = firstName.trim();
      const ln = lastName.trim();
      const full = `${fn} ${ln}`.trim();
      return full || "Unknown player";
    }
    const num = jerseyNumber.trim();
    const clubLabel = club.trim();
    if (num) {
      return `#${num} – ${clubLabel || "No club"}`;
    }
    return clubLabel || "Unknown player";
  }, [choice, firstName, lastName, jerseyNumber, club]);

  const countTruthy = (vals: Array<unknown>) =>
    vals.filter((v) => {
      if (typeof v === "number") return v > 0;
      return !!(v !== null && v !== undefined && String(v).trim() !== "");
    }).length;

  const cntBasicKnown = countTruthy([
    firstName,
    lastName,
    birthYear,
    club,
    clubCountry,
  ]);
  const cntBasicUnknown = countTruthy([
    jerseyNumber,
    club,
    clubCountry,
    uNote,
  ]);
  const badgeBasic =
    choice === "unknown"
      ? cntBasicUnknown
      : choice === "known"
        ? cntBasicKnown
        : 0;
  const basicMax =
    choice === "unknown" ? 4 : choice === "known" ? 5 : 0;

  const cntProfile = countTruthy([
    ext.height,
    ext.weight,
    ext.dominantFoot,
    ext.mainPos,
    ext.altPositions?.length ? 1 : "",
  ]);

  const cntEligibility = countTruthy([
    ext.english ? "yes" : "",
    ext.euPassport ? "yes" : "",
    ext.birthCountry,
    ext.contractStatus,
    ext.agency,
    ext.releaseClause,
    ext.leagueLevel,
    ext.clipsLinks,
    ext.transfermarkt,
    ext.wyscout,
  ]);

  const cntStats365 = countTruthy([
    ext.injuryHistory,
    ext.minutes365,
    ext.starts365,
    ext.subs365,
    ext.goals365,
  ]);

  const cntContact = countTruthy([
    ext.phone,
    ext.email,
    ext.fb,
    ext.ig,
    ext.tiktok,
  ]);

  const totalExt = cntProfile + cntEligibility + cntStats365 + cntContact;
  const totalExtMax = 5 + 10 + 5 + 5;

  const cntRatingsFilled = countTruthy(Object.values(ratings));
  const cntGradeBadge = Number(Boolean(notes)) + cntRatingsFilled;
  const cntGradeMax = 1 + enabledRatingAspects.length;

  const baseAspects = enabledRatingAspects.filter(
    (a) => (a.groupKey ?? "GEN") === "GEN"
  );
  const gkAspects = enabledRatingAspects.filter((a) => a.groupKey === "GK");
  const defAspects = enabledRatingAspects.filter((a) => a.groupKey === "DEF");
  const midAspects = enabledRatingAspects.filter((a) => a.groupKey === "MID");
  const attAspects = enabledRatingAspects.filter((a) => a.groupKey === "FW");

  const effectiveMainPos: DetailedPos | "" =
    (ext.mainPos as DetailedPos | "") || "";
  const effectiveBucket: BucketPos | null = effectiveMainPos
    ? toBucket(effectiveMainPos)
    : null;

  const [qaMatch, setQaMatch] = useState("");
  const [qaDate, setQaDate] = useState("");
  const [qaTime, setQaTime] = useState("");
  const [qaMode, setQaMode] = useState<"live" | "tv">("live");
  const [qaStatus, setQaStatus] = useState<"draft" | "final">("draft");
  const [qaOpponentLevel, setQaOpponentLevel] = useState("");

  const [qaTeamA, setQaTeamA] = useState("");
  const [qaTeamB, setQaTeamB] = useState("");
  const QA_CONDITIONS: ("live" | "tv")[] = ["live", "tv"];

  function updateQaMatchFromTeams(a: string, b: string) {
    setQaTeamA(a);
    setQaTeamB(b);
    const composed =
      a.trim() && b.trim()
        ? `${a.trim()} vs ${b.trim()}`
        : (a + " " + b).trim();
    setQaMatch(composed);
  }

  // Loading observations from the global log – only for this player
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    (async () => {
      try {
        const supabase = getSupabase();

        const { data, error } = await supabase
          .from("observations")
          .select(
            "id, player, match, date, time, status, mode, competition, team_a, team_b, players, payload"
          )
          .order("date", { ascending: false })
          .order("time", { ascending: false });

        if (error) {
          console.error(
            "[PlayerEditorPage] Supabase load observations error:",
            error
          );
          return;
        }

        if (!cancelled && data) {
          const fullName = `${firstName || ""} ${lastName || ""}`
            .trim()
            .toLowerCase();

          const anonName = (() => {
            const num = jerseyNumber.trim();
            const clubLabel = club.trim();
            if (num) {
              return `#${num} – ${clubLabel || "No club"}`.toLowerCase();
            }
            return clubLabel.toLowerCase();
          })();

          const nameCandidates = [fullName, anonName]
            .map((s) => s.trim())
            .filter(Boolean);

          const filteredRows = (data as any[]).filter((row) => {
            const playersArr = Array.isArray(row.players) ? row.players : null;

            const matchesByPlayers =
              !!playerId &&
              !!playersArr &&
              playersArr.some((p: any) => {
                const pid = Number(
                  p.id ?? p.playerId ?? p.player_id ?? p.player_id_fk
                );
                return !Number.isNaN(pid) && pid === playerId;
              });

            const rowPlayer =
              typeof row.player === "string"
                ? row.player.trim().toLowerCase()
                : "";

            const matchesByText =
              rowPlayer &&
              nameCandidates.some((cand) => cand && rowPlayer === cand);

            return matchesByPlayers || matchesByText;
          });

          if (filteredRows.length > 0) {
            const mapped: ObsRec[] = filteredRows.map((row: any) => {
              const payload = (row.payload ?? {}) as any;

              const payloadMatch =
                safeText(payload.match) ||
                (payload.teamA && payload.teamB
                  ? `${safeText(payload.teamA)} vs ${safeText(payload.teamB)}`
                  : "");

              const matchLabel =
                safeText(row.match) ||
                (row.team_a && row.team_b
                  ? `${safeText(row.team_a)} vs ${safeText(row.team_b)}`
                  : "") ||
                payloadMatch;

              const dateVal =
                safeText(row.date) ||
                safeText(payload.reportDate) ||
                safeText(payload.date);

              const timeVal =
                safeText(row.time) ||
                safeText(payload.time) ||
                safeText(payload.kickoff);

              const competitionLabel =
                safeText(row.competition) ||
                safeText(payload.competition) ||
                safeText(payload.league) ||
                safeText(payload.competitionName);

              return {
                id: row.id,
                match: matchLabel,
                date: dateVal,
                time: timeVal,
                status: (row.status as "draft" | "final") ?? "draft",
                mode:
                  (row.mode as "live" | "tv" | "mix") ??
                  ("live" as "live" | "tv" | "mix"),
                competition: competitionLabel,
                opponentLevel: competitionLabel,
                players: row.players ?? [],
              };
            });

            setObservations(mapped);
          }
        }
      } catch (err) {
        console.error(
          "[PlayerEditorPage] Supabase load observations exception:",
          err
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId, firstName, lastName, jerseyNumber, club]);

  function addObservation() {
    const next: ObsRec = {
      id: Date.now(), // local temporary ID
      match: qaMatch.trim() || "—",
      date: qaDate || "",
      time: qaTime || "",
      status: qaStatus,
      mode: qaMode,
      opponentLevel: qaOpponentLevel.trim() || "",
      players: [],
    };
    setObservations((prev) => [next, ...prev]);
    setQaMatch("");
    setQaDate("");
    setQaTime("");
    setQaMode("live");
    setQaStatus("draft");
    setQaOpponentLevel("");
    setQaTeamA("");
    setQaTeamB("");
  }

  const normalizedObservations = useMemo<ObsRec[]>(() => {
    return (observations || []).map((o) => {
      // base normalization
      const base: ObsRec = {
        ...o,
        match: safeText(o.match),
        date: safeText(o.date),
        time: safeText(o.time),
        opponentLevel: safeText(o.opponentLevel),
      };

      // sync player name inside observation.players with current playerDisplayName
      const playersArr = Array.isArray(o.players) ? o.players : [];
      const syncedPlayers = playersArr.map((p: any) => {
        const pid = Number(
          p.id ?? p.playerId ?? p.player_id ?? p.player_id_fk
        );

        if (!Number.isNaN(pid) && pid === playerId) {
          const name = playerDisplayName;
          return {
            ...p,
            // common possible fields used by the editor:
            name,
            label: name,
            displayName: name,
            player: name,
          };
        }

        return p;
      });

      (base as any).players = syncedPlayers;
      return base;
    });
  }, [observations, playerId, playerDisplayName]);


  const existingFiltered = useMemo(() => {
    const q = obsQuery.trim().toLowerCase();
    const arr = [...normalizedObservations].sort((a, b) =>
      ((b.date || "") + (b.time || "")).localeCompare(
        (a.date || "") + (a.time || "")
      )
    );
    if (!q) return arr;
    return arr.filter((o) => {
      const matchText = (o.match || "").toLowerCase();
      const dateText = o.date || "";
      return matchText.includes(q) || dateText.includes(q);
    });
  }, [normalizedObservations, obsQuery]);

  const [editOpen, setEditOpen] = useState(false);
  const [editingObs, setEditingObs] = useState<ObsRec | null>(null);

  function openEditModal(o: ObsRec) {
    setEditingObs({ ...o });
    setEditOpen(true);
  }

  function saveEditedObservation() {
    if (!editingObs) return;
    const next = observations.map((o) =>
      o.id === editingObs.id ? editingObs : o
    );
    setObservations(next);
    setEditOpen(false);
  }

  const [extView, setExtView] = useState<ExtKey>("profile");

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string | null>(null);

  // Auto-save to Supabase (update existing player)
  useEffect(() => {
    let cancelled = false;

    if (!playerId) {
      setSaveState("idle");
      return;
    }

    const hasAnyBasic =
      firstName.trim() ||
      lastName.trim() ||
      birthYear.trim() ||
      jerseyNumber.trim() ||
      club.trim() ||
      clubCountry.trim();

    if (!hasAnyBasic) {
      setSaveState("idle");
      return;
    }

    // snapshot tego, co faktycznie zapisujesz
    const currentSnapshot = JSON.stringify({
      choice,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthYear: birthYear.trim(),
      club: club.trim(),
      clubCountry: clubCountry.trim(),
      jerseyNumber: jerseyNumber.trim(),
      posDet,
      uPosDet,
      ext,
      ratings,
      notes,
      uNote,
      obsSelectedId,
      observations: normalizedObservations,
    });

    // jeśli nic się nie zmieniło – nie odpalaj save
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
          const currentYear = new Date().getFullYear();

          const isKnownX = choice === "known";
          let name: string;
          let clubFinal: string;
          let posBucket: BucketPos;
          let clubCountryFinal: string;
          let age = 0;

          if (isKnownX) {
            const fn = firstName.trim();
            const ln = lastName.trim();
            const fullName = `${fn} ${ln}`.trim();
            name = fullName || "Unknown player";
            clubFinal = club.trim();
            clubCountryFinal = clubCountry.trim();
            posBucket = toBucket(posDet || "CM");

            if (birthYear.trim()) {
              const by = parseInt(birthYear.trim(), 10);
              if (!Number.isNaN(by)) {
                age = Math.max(0, currentYear - by);
              }
            }
          } else {
            const num = jerseyNumber.trim();
            clubFinal = club.trim();
            clubCountryFinal = clubCountry.trim();
            name = num
              ? `#${num} – ${clubFinal || "No club"}`
              : clubFinal || "Unknown player";
            posBucket = toBucket(uPosDet || posDet || "CM");
          }

          const nationalityVal =
            ext.birthCountry.trim() || clubCountryFinal || null;

          const meta = {
            mode: choice,
            extended: ext,
            ratings,
            notes,
            unknownNote: uNote || null,
            basic: {
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
              birthYear: birthYear.trim() || null,
              club: clubFinal,
              clubCountry: clubCountryFinal || null,
              jerseyNumber: jerseyNumber.trim() || null,
              posDet,
              uPosDet,
            },
            observationsMeta: {
              selectedId: obsSelectedId,
              list: normalizedObservations,
            },
          };

          const updatePayload: any = {
            name,
            pos: posBucket,
            club: clubFinal,
            age,
            status: "active",
            firstName: isKnownX ? firstName.trim() || null : null,
            lastName: isKnownX ? lastName.trim() || null : null,
            birthDate: isKnownX ? birthYear.trim() || null : null,
            nationality: nationalityVal,
            photo: null,
            meta,
          };

          const { error } = await supabase
            .from("players")
            .update(updatePayload)
            .eq("id", playerId);

          if (error) {
            console.error("[PlayerEditorPage] Supabase update error:", error);
            if (!cancelled) {
              setSaveState("idle");
              setSaveError(
                "Failed to update player in Supabase."
              );
            }
            return;
          }

          if (!cancelled) {
            lastSavedSnapshotRef.current = currentSnapshot;
            setSaveState("saved");
          }
        } catch (err) {
          console.error("[PlayerEditorPage] Supabase save exception:", err);
          if (!cancelled) {
            setSaveState("idle");
            setSaveError(
              "An error occurred while saving the player to Supabase."
            );
          }
        }
      })();
    }, 700);

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    choice,
    firstName,
    lastName,
    birthYear,
    club,
    clubCountry,
    jerseyNumber,
    posDet,
    uPosDet,
    ext,
    ratings,
    notes,
    normalizedObservations,
    obsSelectedId,
    playerId,
    uNote,
  ]);

  // PROGRESS: global completion percent – shared algorithm as in the table
  const completionPercent = useMemo(() => {
    const virtualPlayer = {
      firstName,
      lastName,
      birthDate: birthYear,
      club,
      nationality: ext.birthCountry || clubCountry,
      meta: {
        mode: choice,
        basic: {
          firstName,
          lastName,
          birthYear,
          club,
          clubCountry,
          jerseyNumber,
        },
        extended: ext,
        ratings,
        notes,
        unknownNote: uNote,
      },
    };

    return computePlayerProfileProgress(virtualPlayer as any);
  }, [
    choice,
    firstName,
    lastName,
    birthYear,
    club,
    clubCountry,
    jerseyNumber,
    ext,
    ratings,
    notes,
    uNote,
  ]);

  const stepPillClass =
    "inline-flex h-6 items-center rounded-md bg-stone-100 px-2.5 text-[11px] tracking-wide text-stone-600 dark:bg-neutral-900 dark:text-neutral-200";

  // Helper to avoid infinite loop in observations onChange
  function mapTableRowsToObservations(rows: any[]): ObsRec[] {
    return (rows || []).map((o: any, index: number) => ({
      id: o.id ?? `tmp-${index}`, // PRESERVE id as-is; only fallback if missing
      match: safeText(o.match),
      date: safeText(o.date),
      time: safeText(o.time),
      status: (o.status as "draft" | "final") ?? "draft",
      mode: (o.mode as "live" | "tv" | "mix") ?? "live",
      competition: safeText(o.competition),
      opponentLevel: safeText(o.opponentLevel ?? o.competition),
      players: o.players ?? [],
    }));
  }

  function areObsListsEqual(a: ObsRec[], b: ObsRec[]): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];

      const sameMeta =
        x.id === y.id &&
        safeText(x.match) === safeText(y.match) &&
        safeText(x.date) === safeText(y.date) &&
        safeText(x.time) === safeText(y.time) &&
        x.status === y.status &&
        x.mode === y.mode &&
        safeText(x.opponentLevel) === safeText(y.opponentLevel) &&
        safeText(x.competition) === safeText(y.competition);

      if (!sameMeta) return false;

      const px = Array.isArray(x.players) ? x.players : [];
      const py = Array.isArray(y.players) ? y.players : [];

      if (JSON.stringify(px) !== JSON.stringify(py)) {
        return false;
      }
    }

    return true;
  }

  // Title with badge + icon (only current stage)
  const editorTitle = (
    <div className="w-full">
      <div className="flex w-full items-center gap-2">
        <h2 className="mt-1 text-xl font-semibold leading-none tracking-tight">
          {playerDisplayName}
        </h2>
        {choice === "known" && (
          <span className="ml-auto inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700 ring-1 ring-emerald-100">
            <KnownPlayerIcon
              className="mr-1.5 h-4 w-4 text-emerald-700"
              strokeWidth={1.4}
            />
            Known
          </span>
        )}
        {choice === "unknown" && (
          <span className="ml-auto inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-[12px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            <UnknownPlayerIcon
              className="mr-1.5 h-4 w-4 text-rose-700"
              strokeWidth={1.4}
            />
            Unknown
          </span>
        )}
      </div>
    </div>
  );

  // Header actions like in AddPlayerPage + PROGRESS BAR – global header
  useEffect(() => {
    const node = (
      <div className="flex items-center gap-3">
        <SavePill state={saveState} size="compact" />

        {/* PROGRESS BAR (global postęp profilu) */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-2">
            <CircularProgress progress={completionPercent} size={32} strokeWidth={2} showValue />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 px-3 text-xs md:inline-flex"
          onClick={() => router.push("/players")}
        >
          Back to list
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="inline-flex h-8 w-8 p-0 md:hidden"
          aria-label="Back to list"
          onClick={() => router.push("/players")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );

    setActions(node);
    return () => {
      // no-op cleanup
    };
  }, [setActions, saveState, router, completionPercent]);

  if (!playerId) {
    return (
      <div className="w-full space-y-4">
        <Toolbar title={editorTitle} right={null} />
        <p className="text-sm text-red-600">
          No valid player ID in the URL.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <ToolbarFull title={editorTitle} right={null} />

      {loading && (
        <Card className="border-dashed border-stone-300 bg-stone-50/80 dark:border-neutral-800 dark:bg-neutral-950/60">
          <CardContent className="px-4 py-6 text-sm text-stone-600 dark:text-neutral-300">
            Loading player data…
          </CardContent>
        </Card>
      )}

      {loadError && (
        <p className="text-sm text-red-600">{loadError}</p>
      )}

      {/* Steps 1–4 – same as in AddPlayerPage */}
      <div className="space-y-4">
        {/* STEP 1 – Basic information + Main position (pitch) */}
        <Card ref={basicRef} className="mt-1">
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
                <div className={stepPillClass}>Step 1 · Base data</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Basic information
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Simply fill in the fields below – the system will decide if the
                  profile is <b>named</b> or <b>anonymous</b>.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {badgeBasic}/{basicMax || "—"}
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
                <AccordionContent id="basic-panel" className="pb-5 pt-4">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                      <div>
                        <Label className="text-sm">First name</Label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="e.g. John"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Last name</Label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="e.g. Smith"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Year of birth</Label>
                        <NumericField
                          value={
                            birthYear === "" ? undefined : Number(birthYear.replace(/\D/g, ""))
                          }
                          onChange={(val) => {
                            if (val == null) {
                              setBirthYear("");
                              return;
                            }

                            const next = String(Math.max(0, val));
                            if (next.length > 4) {
                              return;
                            }

                            setBirthYear(next);
                          }}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <NumericField
                          label="Jersey number"
                          value={
                            jerseyNumber === ""
                              ? undefined
                              : Number(jerseyNumber.replace(/\D/g, ""))
                          }
                          onChange={(val) =>
                            setJerseyNumber(
                              val == null ? "" : String(val)
                            )
                          }
                          placeholder="e.g. 27"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Current club</Label>
                        <Input
                          value={club}
                          onChange={(e) => setClub(e.target.value)}
                          placeholder="e.g. Lech Poznań U19"
                        />
                      </div>
                      <div>
                        <Label className="pb-2 text-sm">
                          Club country / current club
                        </Label>
                        <CountrySearchCombobox
                          value={clubCountry}
                          onChange={(val) => setClubCountry(val)}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <MainPositionPitch
                          value={(ext.mainPos as DetailedPos | "") || ""}
                          onChange={(pos) => {
                            setExt((s) => ({ ...s, mainPos: pos }));
                            setPosDet(pos);
                            setUPosDet(pos);
                          }}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <Label className="text-sm">
                          Personal note (optional)
                        </Label>
                        <Textarea
                          value={uNote}
                          onChange={(e) => setUNote(e.target.value)}
                          placeholder="Brief note about the player, scout context…"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* STEP 2 – Extended information */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group flex items-center justify-between rounded-md border-gray-200 p-0 transition-colors hover:bg-stone-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              extOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={extOpen}
              aria-controls="ext-panel"
              onClick={() => setExtOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <div className={stepPillClass}>Step 2 · Pitch profile</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Extended information
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Additional sports, contract, and contact data – useful in a
                  professional scouting report.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-stone-500 sm:inline">
                    Anonymous profile
                  </span>
                )}
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {totalExt}/{totalExtMax}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    extOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={extOpen ? "ext" : undefined}
              onValueChange={(v) => setExtOpen(v === "ext")}
              className="w-full"
            >
              <AccordionItem value="ext" className="border-0">
                <AccordionContent id="ext-panel" className="pb-5 pt-4">
                    <p className="mb-3 text-[11px] text-stone-500 dark:text-neutral-400">
                      You can gradually complete this data as you ge to know the player better.
                    </p>

                  {/* Mobile – select */}
                  <div className="md:hidden">
                    <Label className="mb-1 block text-sm">Section</Label>
                    <select
                      value={extView}
                      onChange={(e) =>
                        setExtView(e.target.value as ExtKey)
                      }
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                    >
                      <option value="profile">Pitch profile</option>
                      <option value="eligibility">
                        Status &amp; scouting
                      </option>
                      <option value="stats365">Health and statistics</option>
                      <option value="contact">
                        Contact &amp; social
                      </option>
                    </select>
                    <div className="mt-4">
                      <ExtContent view={extView} ext={ext} setExt={setExt} />
                    </div>
                  </div>

                  {/* Desktop – tabs */}
                  <div className="hidden md:block">
                    <Tabs
                      value={extView}
                      onValueChange={(v: any) => setExtView(v)}
                      className="w-full"
                    >
                      <TabsList className="inline-flex w-auto gap-1 rounded-md bg-stone-100 p-1 dark:bg-neutral-900">
                        <TabsTrigger value="profile">
                          Pitch profile
                        </TabsTrigger>
                        <TabsTrigger value="eligibility">
                          Status &amp; scouting
                        </TabsTrigger>
                        <TabsTrigger value="stats365">
                          Health and statistics
                        </TabsTrigger>
                        <TabsTrigger value="contact">
                          Contact &amp; social
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="profile" className="mt-4">
                        <ExtContent view="profile" ext={ext} setExt={setExt} />
                      </TabsContent>
                      <TabsContent value="eligibility" className="mt-4">
                        <ExtContent
                          view="eligibility"
                          ext={ext}
                          setExt={setExt}
                        />
                      </TabsContent>
                      <TabsContent value="stats365" className="mt-4">
                        <ExtContent
                          view="stats365"
                          ext={ext}
                          setExt={setExt}
                        />
                      </TabsContent>
                      <TabsContent value="contact" className="mt-4">
                        <ExtContent
                          view="contact"
                          ext={ext}
                          setExt={setExt}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* STEP 3 – Rating */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group flex items-center justify-between rounded-md border-gray-200 p-0 transition-colors hover:bg-stone-50/80 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              gradeOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={gradeOpen}
              aria-controls="grade-panel"
              onClick={() => setGradeOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <div className={stepPillClass}>Step 3 · Rating</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Player rating
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Break down the rating into technical, mental, and physical
                  categories – you configure them in the "Player rating configuration" module.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-stone-500 sm:inline">
                    Anonymous profile
                  </span>
                )}
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {cntGradeBadge}/{cntGradeMax}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    gradeOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={gradeOpen ? "grade" : undefined}
              onValueChange={(v) => setGradeOpen(v === "grade")}
              className="w-full"
            >
              <AccordionItem value="grade" className="border-0">
                <AccordionContent id="grade-panel" className="pb-5 pt-4">
                    <p className="mb-3 text-[11px] text-stone-500 dark:text-neutral-400">
                      You can fill in ratings even for an anonymous profile –
                      consistency with the main position is important.
                    </p>

                  <div className="relative">
                    <div
                      className={cn(
                        "space-y-6",
                        !effectiveMainPos && "pointer-events-none opacity-40"
                      )}
                    >
                      <div>
                        <Label className="text-sm">General notes</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Brief comment about the player…"
                          className="mt-1"
                        />
                      </div>

                      <div className="space-y-6">
                            the panel "Player rating configuration".
                          </p>

                        <RatingGroup
                          title="Core"
                          aspects={baseAspects}
                          ratings={ratings}
                          setRatings={setRatings}
                        />

                        {effectiveBucket === "GK" && (
                          <RatingGroup
                            title="Goalkeeper (GK)"
                            aspects={gkAspects}
                            ratings={ratings}
                            setRatings={setRatings}
                          />
                        )}
                        {effectiveBucket === "DF" && (
                          <RatingGroup
                            title="Defender (DEF)"
                            aspects={defAspects}
                            ratings={ratings}
                            setRatings={setRatings}
                          />
                        )}
                        {effectiveBucket === "MF" && (
                          <RatingGroup
                            title="Midfielder (MID)"
                            aspects={midAspects}
                            ratings={ratings}
                            setRatings={setRatings}
                          />
                        )}
                        {effectiveBucket === "FW" && (
                          <RatingGroup
                            title="Forward (ATT)"
                            aspects={attAspects}
                            ratings={ratings}
                            setRatings={setRatings}
                          />
                        )}

                        {!effectiveBucket &&
                          enabledRatingAspects.length > 0 && (
                            <p className="text-[11px] text-stone-500 dark:text-neutral-400">
                              Set the <b>Main position</b> in step 1 to
                              see additional rating categories
                              (GK/DEF/MID/ATT).
                            </p>
                          )}
                      </div>
                    </div>

                    {!effectiveMainPos && (
                      <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-white/70 px-4 text-center backdrop-blur-sm dark:bg-neutral-950/80">
                        <p className="mb-3 text-xs text-stone-700 dark:text-neutral-200 sm:text-sm">
                          To enter ratings, first complete the{" "}
                          <b>Main position</b> of the player in step 1.
                        </p>
                        <Button
                          size="sm"
                          type="button"
                          className="bg-gray-900 text-white hover:bg-gray-800"
                          onClick={() => {
                            setBasicOpen(true);
                            basicRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }}
                        >
                          Go to step 1
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* STEP 4 – Observations */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group flex items-center justify-between rounded-md border-gray-200 bg-[#E3E0F9] p-0 transition-colors hover:bg-[#D4CEFF] dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              obsOpen && "bg-[#E3E0F9] dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={obsOpen}
              aria-controls="obs-panel"
              onClick={() => setObsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div>
                <div className={stepPillClass}>Step 4 · Observations</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Observations
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Add matches and assign them to the player profile. You can
                  use the global observation log.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {choice === "unknown" && (
                  <span className="hidden text-[11px] text-stone-500 sm:inline">
                    Anonymous profile
                  </span>
                )}
                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                  {normalizedObservations.length}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    obsOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={obsOpen ? "obs" : undefined}
              onValueChange={(v) => setObsOpen(v === "obs")}
            >
              <AccordionItem value="obs" className="border-0">
                <AccordionContent id="obs-panel" className="pb-5 pt-4">
                    <p className="mb-3 text-[11px] text-stone-500 dark:text-neutral-400">
                      You can also create observations for an anonymous profile
                      – it's important to maintain consistency of match and level.
                    </p>

                  <div className="mb-6">
                    <PlayerObservationsTable
                      playerName={playerDisplayName}
                      observations={normalizedObservations as any}
                      playerId={playerId ?? undefined} // ⬅️ NEW – we link observations to this player
                      onChange={(next) => {
                        const mapped = mapTableRowsToObservations(next as any[]);
                        setObservations((prev) =>
                          areObsListsEqual(prev, mapped) ? prev : mapped
                        );
                      }}
                    />

                  </div>

                  {false && (
                    <>
                      <div className="space-y-8">
                        {/* ... old QA ... */}
                      </div>
                      <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit observation</DialogTitle>
                          </DialogHeader>
                          {editingObs && (
                            <div className="space-y-4">
                              {/* ...old edit form... */}
                            </div>
                          )}
                          <DialogFooter className="mt-4">
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() => setEditOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              className="bg-gray-900 text-white hover:bg-gray-800"
                              onClick={saveEditedObservation}
                            >
                              Save changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {saveError && (
        <p className="mt-3 text-sm text-red-600">{saveError}</p>
      )}
    </div>
  );
}
