// src/features/observations/ObservationEditor.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ReactNode,
} from "react";
import { Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Observation, Player } from "@/shared/types";
import { useRequiredFields } from "@/shared/requiredFields";
import {
  Users,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  FileEdit,
  Loader2,
  CheckCircle2,
  PlayCircle,
  GitCompare,
  Monitor,
  Search,
  Plus,
  Trash2,
  Mic,
} from "lucide-react";
import StarRating from "@/shared/ui/StarRating";
import {
  syncMetricsFromSupabase,
  type MetricsConfig,
} from "@/shared/metrics";
import { AddPlayerIcon } from "@/components/icons";
import { getSupabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { DateTimePicker24h } from "@/shared/ui/DateTimePicker24h";
import { useHeaderActions } from "@/app/ClientRoot";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/* ------------ Types ------------ */
type Mode = "live" | "tv" | "mix";
type PositionKey =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "CMD"
  | "CM"
  | "CAM"
  | "LW"
  | "RW"
  | "ST";

type ObsPlayer = {
  id: string;
  type: "known" | "unknown";
  name?: string;
  shirtNo?: string;

  position?: PositionKey;
  minutes?: number;
  overall?: number;

  base?: Record<string, number>;
  gk?: Record<string, number>;
  def?: Record<string, number>;
  mid?: Record<string, number>;
  att?: Record<string, number>;
  ratings?: Record<string, number>; // ⬅️ płaska mapa wszystkich ocen (BASE/GK/DEF/MID/ATT)

  note?: string;
};

export type XO = Observation & {
  reportDate?: string;
  competition?: string;
  teamA?: string;
  teamB?: string;
  conditions?: Mode;
  contextNote?: string;
  note?: string;
  players?: ObsPlayer[];
  __listMeta?: {
    id: number;
    status: "draft" | "final";
    bucket: "active" | "trash";
    time: string;
    player: string;
  };
};

/* ------------- Utils ------------- */
function fmtDateHuman(date?: string, time?: string) {
  try {
    const d = date ? new Date(date) : null;
    if (!d) return "—";
    const dd = d.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return time ? `${dd}, ${time}` : dd;
  } catch {
    return "—";
  }
}

function isNumberLike(value: string) {
  return /^[0-9]{1,3}$/.test(value.trim());
}

/* 💊 SavePill – stan zapisu (bez localStorage) */
function SavePill({
  state,
  size = "default",
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
    <span className={cn(base, map[state])} aria-live="polite">
      {state === "saving" ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Zapisywanie…
        </>
      ) : (
        <>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Zapisano
        </>
      )}
    </span>
  );
}

/* Znacznik “Wymagane” przy polu */
function ReqChip({ text = "Wymagane" }: { text?: string }) {
  return (
    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
      {text}
    </span>
  );
}

/** Compact metric item (no hooks). */
function MetricItem({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="group flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs shadow-sm transition  dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
      title={label}
    >
      <div className="w-full break-words pr-2 text-[12px] text-gray-700 dark:text-neutral-300">
        {label}
      </div>
      <div className="shrink-0">
        <StarRating
          value={value ?? 0}
          onChange={onChange}
          /* @ts-ignore */
          max={5}
        />
      </div>
    </div>
  );
}

/* Przycisk do nagrywania notatki głosowej i transkrypcji do pola */
function VoiceNoteButton({
  onTranscription,
}: {
  onTranscription: (text: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SR =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SR) {
        setIsSupported(true);
      }
    }

    return () => {
      const rec = recognitionRef.current;
      if (rec && rec.stop) {
        rec.stop();
      }
    };
  }, []);

  const handleClick = () => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      alert(
        "Twoja przeglądarka nie obsługuje rozpoznawania mowy. Spróbuj w Chrome na desktopie."
      );
      return;
    }

    if (!isRecording) {
      const recognition = new SR();
      recognition.lang = "pl-PL";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        try {
          const text = event.results[0][0].transcript;
          if (text) {
            onTranscription(text);
          }
        } catch (e) {
          console.error("[VoiceNoteButton] Błąd w onresult:", e);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("[VoiceNoteButton] Błąd rozpoznawania:", event);
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          alert(
            "Brak dostępu do mikrofonu lub funkcja jest zablokowana. Sprawdź uprawnienia przeglądarki i HTTPS."
          );
        } else if (event.error === "network") {
          alert(
            "Wystąpił problem sieciowy podczas rozpoznawania mowy. Spróbuj ponownie."
          );
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } else {
      if (recognitionRef.current && recognitionRef.current.stop) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "inline-flex items-center gap-0 rounded-md border px-2 py-1 text-[11px]",
          "border-gray-300 text-gray-400 opacity-60 cursor-not-allowed dark:border-neutral-700 dark:text-neutral-500"
        )}
      >
        <Mic className="h-3.5 w-3.5" />
        <span>Notatka głosowa niedostępna w tej przeglądarce</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-0 rounded-md border px-2 py-1 text-[11px]",
        "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800",
        isRecording &&
          "border-red-500 text-red-600 bg-red-50 dark:border-red-500 dark:text-red-200 dark:bg-red-950/40"
      )}
    >
      <Mic className="h-3.5 w-3.5" />
      <span>
        {isRecording
          ? "Nagrywanie… kliknij, aby zatrzymać"
          : "Nagraj notatkę głosową"}
      </span>
    </button>
  );
}

/* ========================= Editor ========================= */
export function ObservationEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: XO;
  onSave: (o: XO) => void;
  onClose: () => void;
}) {
  const { setActions } = useHeaderActions();

  const stepPillClass =
    "inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200";

  const frozenInitialRef = useRef<XO>(initial);

  const initialIdRef =
    (frozenInitialRef.current as any)?.id ??
    (frozenInitialRef.current as any)?.__listMeta?.id ??
    0;

  const isNewObservation = !initialIdRef || initialIdRef === 0;

  const [o, setO] = useState<XO>(() => {
    const base = frozenInitialRef.current;
    const normalizedBase: XO = {
      ...base,
      reportDate:
        base.reportDate ?? ((base as any).date as string | undefined),
    };
    const meta =
      normalizedBase.__listMeta ?? {
        id: normalizedBase.id ?? 0,
        status: (normalizedBase as any).status ?? "draft",
        bucket: "active" as const,
        time: (normalizedBase as any).time ?? "",
        player: (normalizedBase as any).player ?? "",
      };
    return {
      conditions: "live",
      ...normalizedBase,
      __listMeta: meta,
    };
  });

  const { isRequiredField, loading: requiredLoading } = useRequiredFields();
  const isRequired = (fieldKey: string) =>
    isRequiredField("observations_main", fieldKey);

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          if (!cancelled) setAllPlayers([]);
          return;
        }

        const { data, error } = await supabase
          .from("players")
          .select("*")
          .eq("user_id", user.id)
          .order("name", { ascending: true });

        if (error) throw error;
        if (!cancelled && data) {
          setAllPlayers(data as Player[]);
        }
      } catch (err) {
        console.error(
          "[ObservationEditor] Błąd ładowania players z Supabase:",
          err
        );
        if (!cancelled) setAllPlayers([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const [metrics, setMetrics] = useState<MetricsConfig>({
    BASE: [],
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cfg = await syncMetricsFromSupabase();
        if (!cancelled && cfg) {
          setMetrics(cfg);
        }
      } catch (err) {
        console.error("[ObservationEditor] Błąd ładowania metryk:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function setField<K extends keyof XO>(key: K, val: XO[K]) {
    setO((prev) => ({ ...prev, [key]: val }));
  }

  function setMeta<K extends keyof NonNullable<XO["__listMeta"]>>(
    key: K,
    val: NonNullable<XO["__listMeta"]>[K]
  ) {
    setO((prev) => ({
      ...prev,
      __listMeta: { ...(prev.__listMeta as any), [key]: val },
    }));
  }

  const POSITIONS: PositionKey[] = [
    "GK",
    "CB",
    "LB",
    "RB",
    "CMD",
    "CM",
    "CAM",
    "LW",
    "RW",
    "ST",
  ];
  const POS_INFO: Record<PositionKey, string> = {
    GK: "Bramkarz",
    CB: "Środkowy obrońca",
    LB: "Lewy obrońca",
    RB: "Prawy obrońca",
    CMD: "Defensywny pomocnik (6)",
    CM: "Środkowy pomocnik (8)",
    CAM: "Ofensywny pomocnik (10)",
    LW: "Lewy skrzydłowy (11)",
    RW: "Prawy skrzydłowy (7)",
    ST: "Środkowy napastnik (9)",
  };

  const [teamA, setTeamA] = useState(o.teamA ?? "");
  const [teamB, setTeamB] = useState(o.teamB ?? "");

  useEffect(() => {
    setTeamA(o.teamA ?? "");
    setTeamB(o.teamB ?? "");
  }, [o.teamA, o.teamB]);

  function updateMatchFromTeams(a: string, b: string) {
    setTeamA(a);
    setTeamB(b);
    setField("teamA", a);
    setField("teamB", b);
    const composed =
      a.trim() && b.trim()
        ? `${a.trim()} vs ${b.trim()}`
        : (a + " " + b).trim();
    setField("match", composed);
  }

  const headerMeta = `${fmtDateHuman(
    o.reportDate || (o as any).date,
    o.__listMeta?.time || (o as any).time
  )} • ${(o.players?.length ?? 0)} zawodników`;

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const [quickInput, setQuickInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredPlayers = useMemo(() => {
    const q = quickInput.trim().toLowerCase();
    if (!q || isNumberLike(q)) return [];
    return allPlayers
      .filter((p: any) => p.status === "active")
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.club || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [allPlayers, quickInput]);

  function addPlayerKnown(name: string, shirtNo?: string) {
    const p: ObsPlayer = {
      id: crypto.randomUUID(),
      type: "known",
      name: name.trim(),
      shirtNo,
      position: undefined,
      overall: 0, // default 0
      base: {},
      gk: {},
      def: {},
      mid: {},
      att: {},
      ratings: {}, // ⬅️ start z pustą mapą
    };
    setO((prev) => ({ ...prev, players: [...(prev.players ?? []), p] }));
    setExpandedId(p.id); // expand Ocena for new player
  }

  function addPlayerUnknownFromNumber(no: string) {
    const n = no.trim();
    if (!n) return;
    const p: ObsPlayer = {
      id: crypto.randomUUID(),
      type: "unknown",
      shirtNo: n,
      name: `#${n}`,
      position: undefined,
      overall: 0, // default 0
      base: {},
      gk: {},
      def: {},
      mid: {},
      att: {},
      ratings: {}, // ⬅️
    };
    setO((prev) => ({ ...prev, players: [...(prev.players ?? []), p] }));
    setExpandedId(p.id); // expand Ocena for new player
  }

  function updatePlayer(id: string, patchPartial: Partial<ObsPlayer>) {
    setO((prev) => ({
      ...prev,
      players: (prev.players ?? []).map((p) =>
        p.id === id ? ({ ...p, ...patchPartial } as ObsPlayer) : p
      ),
    }));
  }

  function updateMetric(
    group: "base" | "gk" | "def" | "mid" | "att",
    _id: string,
    key: string,
    value: number,
    player: ObsPlayer
  ) {
    setO((prev) => {
      const players = (prev.players ?? []).map((p) => {
        if (p.id !== player.id) return p;

        const currentGroup =
          ((p as any)[group] as Record<string, number> | undefined) ?? {};
        const nextGroup: Record<string, number> = {
          ...currentGroup,
          [key]: value,
        };

        const nextRatings: Record<string, number> = {
          ...(p.ratings ?? {}),
          [key]: value,
        };

        return {
          ...p,
          [group]: nextGroup,
          ratings: nextRatings, // ⬅️ aktualizujemy płaską mapę
        } as ObsPlayer;
      });
      return { ...prev, players };
    });
  }

  function removePlayer(id: string) {
    setO((prev) => ({
      ...prev,
      players: (prev.players ?? []).filter((p) => p.id !== id),
    }));
  }

  function addPlayerFromInput(source?: Player) {
    if (source) {
      addPlayerKnown(source.name || "", (source as any).shirtNo);
      setQuickInput("");
      return;
    }

    const raw = quickInput.trim();
    if (!raw) return;

    if (isNumberLike(raw)) {
      addPlayerUnknownFromNumber(raw);
      setQuickInput("");
      return;
    }

    const found = allPlayers.find(
      (p) => (p.name || "").toLowerCase() === raw.toLowerCase()
    );
    if (found && found.name) {
      addPlayerKnown(found.name, (found as any).shirtNo);
    } else {
      const p: ObsPlayer = {
        id: crypto.randomUUID(),
        type: "unknown",
        name: raw,
        position: undefined,
        overall: 0, // default 0
        base: {},
        gk: {},
        def: {},
        mid: {},
        att: {},
        ratings: {}, // ⬅️
      };
      setO((prev) => ({ ...prev, players: [...(prev.players ?? []), p] }));
      setExpandedId(p.id); // expand Ocena for new player
    }
    setQuickInput("");
  }

  const CONDITIONS: Mode[] = ["live", "tv", "mix"];

  const [promotePlayer, setPromotePlayer] = useState<ObsPlayer | null>(null);
  const [newPlayerClub, setNewPlayerClub] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] =
    useState<PositionKey | "">("");

  async function handlePromotePlayerSave() {
    if (!promotePlayer) return;
    const rawName = (promotePlayer.name || "").replace(/^#/, "").trim();
    if (!rawName) {
      setPromotePlayer(null);
      return;
    }

    const exists = allPlayers.some(
      (p) => (p.name || "").toLowerCase() === rawName.toLowerCase()
    );
    if (exists) {
      setPromotePlayer(null);
      return;
    }

    const payload: any = {
      name: rawName,
      pos: (newPlayerPosition || promotePlayer.position || "CM") as string,
      club: newPlayerClub.trim() || "Do uzupełnienia",
      age: 0,
      status: "active",
      meta: {
        source: "observation",
        fromObservationId: o.id ?? null,
        shirtNo: promotePlayer.shirtNo ?? null,
      },
    };

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("players")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        console.error(
          "[ObservationEditor] Błąd insert do players (promote):",
          error
        );
      } else if (data) {
        setAllPlayers((prev) => [...prev, data as Player]);
      }
    } catch (err) {
      console.error("[ObservationEditor] Wyjątek przy zapisie players:", err);
    }

    setPromotePlayer(null);
    setNewPlayerClub("");
    setNewPlayerPosition("");
  }

  const playerCount = o.players?.length ?? 0;
  const hasTeamA = !!teamA.trim();
  const hasTeamB = !!teamB.trim();
  const hasDate = !!o.reportDate;
  const hasTime = !!(o.__listMeta?.time && o.__listMeta.time.trim());
  const hasCompetition = !!(o.competition ?? "").trim();
  const hasNote = !!(o.note ?? "").trim();
  const hasConditions = !!(o.conditions ?? "live");

  const matchDate = o.reportDate ?? "";
  const matchTime = o.__listMeta?.time ?? "";

  const canSaveObservation =
    (!isRequired("teamA") || hasTeamA) &&
    (!isRequired("teamB") || hasTeamB) &&
    (!isRequired("reportDate") || hasDate) &&
    (!isRequired("time") || hasTime) &&
    (!isRequired("competition") || hasCompetition) &&
    (!isRequired("conditions") || hasConditions) &&
    (!isRequired("players") || playerCount > 0) &&
    (!isRequired("note") || hasNote);

  const missingRequirements = useMemo(() => {
    const items: string[] = [];
    if (isRequired("teamA") && !hasTeamA) items.push("ustaw drużynę A");
    if (isRequired("teamB") && !hasTeamB) items.push("ustaw drużynę B");
    if (isRequired("reportDate") && !hasDate)
      items.push("wybierz datę meczu");
    if (isRequired("time") && !hasTime) items.push("ustaw godzinę meczu");
    if (isRequired("competition") && !hasCompetition)
      items.push("uzupełnij ligę / turniej");
    if (isRequired("conditions") && !hasConditions)
      items.push("wybierz tryb meczu (Live / TV / MIX)");
    if (isRequired("players") && playerCount === 0)
      items.push("dodaj przynajmniej jednego zawodnika");
    if (isRequired("note") && !hasNote)
      items.push("dodaj notatkę do obserwacji");
    return items;
  }, [
    hasTeamA,
    hasTeamB,
    hasDate,
    hasTime,
    hasCompetition,
    hasConditions,
    hasNote,
    playerCount,
    isRequired,
  ]);

  const autoStatus: "draft" | "final" =
    hasTeamA && hasTeamB ? "final" : "draft";

  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const autoSaveKey = JSON.stringify({
    id: o.id ?? initialIdRef,
    teamA,
    teamB,
    reportDate: matchDate,
    time: matchTime,
    competition: o.competition ?? "",
    conditions: o.conditions ?? "live",
    players: o.players ?? [],
    note: o.note ?? "",
  });

  const autoSaveLastKeyRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  async function saveObservation(opts?: {
    closeAfter?: boolean;
    externalSave?: boolean;
    force?: boolean;
  }) {
    const { closeAfter = false, externalSave = false, force = false } =
      opts ?? {};

    if (!force && !canSaveObservation) {
      return;
    }

    const supabase = getSupabase();
    setSaveState("saving");
    setDuplicateError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[ObservationEditor] Brak użytkownika przy zapisie", {
        userError,
      });
      setSaveState("idle");
      return;
    }

    let id =
      (o.id as number | undefined) ??
      ((o.__listMeta as any)?.id as number | undefined) ??
      initialIdRef;

    if (!id || id === 0) {
      id = Date.now();
    }

    const baseMeta =
      o.__listMeta ??
      ({
        id,
        status: "draft",
        bucket: "active",
        time: (o as any).time ?? "",
        player: (o as any).player ?? "",
      } as XO["__listMeta"]);

    const primaryPlayerName =
      (baseMeta?.player && baseMeta.player.trim().length > 0
        ? baseMeta.player
        : (o.players && o.players[0]
            ? (o.players[0].name ||
                (o.players[0].shirtNo
                  ? `#${o.players[0].shirtNo}`
                  : "")) ?? ""
            : "")) || "";

    const meta: XO["__listMeta"] = {
      ...baseMeta,
      id,
      player: primaryPlayerName,
      status: autoStatus,
    };

    const matchDate = o.reportDate ?? "";
    const matchTime = o.__listMeta?.time ?? "";

    const trimmedTeamA = (teamA || "").trim();
    const trimmedTeamB = (teamB || "").trim();
    const composedMatch =
      trimmedTeamA && trimmedTeamB
        ? `${trimmedTeamA} vs ${trimmedTeamB}`
        : o.match ?? (trimmedTeamA || trimmedTeamB || "");

    const payload: XO = {
      ...o,
      id,
      match: composedMatch,
      reportDate: matchDate || undefined,
      __listMeta: {
        ...meta,
        time: matchTime || "",
      },
    };

    const rowDate = payload.reportDate ?? (payload as any).date ?? null;
    const rowTime = payload.__listMeta?.time || null;
    const rowTeamA = payload.teamA ?? (trimmedTeamA || null);
    const rowTeamB = payload.teamB ?? (trimmedTeamB || null);
    const rowCompetition = payload.competition ?? null;

    const row: any = {
      id,
      user_id: user.id,
      player: primaryPlayerName || null,
      match: composedMatch || null,
      team_a: rowTeamA,
      team_b: rowTeamB,
      competition: rowCompetition,
      date: rowDate,
      time: rowTime,
      status: meta.status,
      bucket: meta.bucket,
      mode: (payload.conditions ?? "live") as string,
      note: payload.note ?? null,
      players: (payload.players ?? []) as any,
      payload,
    };

    const { data, error } = await supabase
      .from("observations")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      console.error("[ObservationEditor] Supabase upsert error:", error);
      setSaveState("idle");
      return;
    }

    if (!o.id && data?.id) {
      setO((prev) => ({
        ...prev,
        id: data.id,
        __listMeta: {
          ...(prev.__listMeta ?? meta),
          id: data.id,
          player: primaryPlayerName,
        },
      }));
    }

    setSaveState("saved");

    if (externalSave) {
      onSave(payload);
    }
    if (closeAfter) {
      onClose();
    }

    return payload;
  }

  useEffect(() => {
    if (!canSaveObservation || requiredLoading) return;

    if (autoSaveKey === autoSaveLastKeyRef.current) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveObservation({
        closeAfter: false,
        externalSave: false,
        force: false,
      }).then(() => {
        autoSaveLastKeyRef.current = autoSaveKey;
      });
    }, 1200) as unknown as number;

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveKey, canSaveObservation, requiredLoading]);

  const infoCardRef = useRef<HTMLDivElement | null>(null);

  const [infoOpen, setInfoOpen] = useState(true);
  const [playersOpen, setPlayersOpen] = useState(true);
  const [noteOpen, setNoteOpen] = useState(true);

  const openPositionSelect = (playerId: string) => {
    if (typeof document === "undefined") return;
    const trigger = document.getElementById(`pos-${playerId}`);
    if (trigger instanceof HTMLElement) {
      trigger.focus();
      trigger.click();
    }
  };

  useEffect(() => {
    setActions(
      <div className="flex items-center gap-2">
        <SavePill state={saveState} size="compact" />
        <Button
          variant="outline"
          size="sm"
          className="flex h-8 items-center justify-center px-2 text-xs"
          onClick={() => {
            void saveObservation({
              closeAfter: true,
              externalSave: true,
              force: true,
            });
          }}
        >
          <ChevronLeft className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Wróć do listy</span>
        </Button>
      </div>
    );

    return () => {
      setActions(null);
    };
  }, [setActions, saveState]);

  const handleVoiceTranscription = (text: string) => {
    setO((prev) => {
      const prevNote = prev.note ?? "";
      const next = prevNote ? `${prevNote.trim()}\n${text}` : text;
      return { ...prev, note: next };
    });
  };

  return (
    <div className="w-full">
      <Toolbar
        title={
          <div className="mb-3 flex flex-col gap-1">
            <span className="text-2xl font-semibold">
              Mecz:&nbsp;{o.match || "—"}
            </span>
            <span className="text-xs text-dark dark:text-neutral-300">
              {headerMeta}
            </span>
          </div>
        }
      />

      {!requiredLoading &&
        !canSaveObservation &&
        missingRequirements.length > 0 && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="font-semibold">
              Uzupełnij wymagane pola, aby zapisać obserwację:
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {missingRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

      {duplicateError && (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
          {duplicateError}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* KROK 1 – Informacje ogólne */}
        <Card className="mt-1" ref={infoCardRef}>
          <CardHeader
            className={cn(
              "group flex itemscenter justify-between rounded-md border-gray-200 transition-colors hover:bg-stone-50/80 p-0 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              infoOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={infoOpen}
              aria-controls="info-panel"
              onClick={() => setInfoOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left px-4 py-4"
            >
              <div>
                <div className={stepPillClass}>Krok 1 · Informacje ogólne</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Dane meczu
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Wpisz drużyny oraz datę meczu – nazwa meczu zbuduje się
                  automatycznie.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    infoOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={infoOpen ? "info" : undefined}
              onValueChange={(v) => setInfoOpen(v === "info")}
              className="w-full"
            >
              <AccordionItem value="info" className="border-0">
                <AccordionContent id="info-panel" className="pt-4 pb-5">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label className="text-sm">Drużyna A</Label>
                        <div className="relative mt-1">
                          <Input
                            value={teamA}
                            onChange={(e) =>
                              updateMatchFromTeams(e.target.value, teamB)
                            }
                            placeholder="np. Gospodarze U19"
                            className={cn(
                              "rounded-md",
                              isRequired("teamA") && !teamA.trim()
                                ? "pr-24"
                                : ""
                            )}
                          />
                          {isRequired("teamA") && !teamA.trim() && <ReqChip />}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm">Drużyna B</Label>
                        <div className="relative mt-1">
                          <Input
                            value={teamB}
                            onChange={(e) =>
                              updateMatchFromTeams(teamA, e.target.value)
                            }
                            placeholder="np. Goście U19"
                            className={cn(
                              "rounded-md",
                              isRequired("teamB") && !teamB.trim()
                                ? "pr-24"
                                : ""
                            )}
                          />
                          {isRequired("teamB") && !teamB.trim() && <ReqChip />}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Data i godzina meczu</Label>
                        <div className="mt-1 rounded-md">
                          <DateTimePicker24h
                            value={{ date: matchDate, time: matchTime }}
                            onChange={({ date, time }) => {
                              setField("reportDate", date || undefined);
                              setMeta("time", (time || "") as any);
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Tryb meczu</Label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {CONDITIONS.map((mode) => {
                          const isActive = (o.conditions ?? "live") === mode;
                          const isLive = mode === "live";
                          const isTv = mode === "tv";
                          const isMix = mode === "mix";

                          const title = isLive ? "Live" : isTv ? "TV" : "MIX";
                          const subtitle = isLive
                            ? "Na żywo z boiska"
                            : isTv
                            ? "Transmisja / wideo"
                            : "Część na żywo, część z wideo";

                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setField("conditions", mode)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition",
                                isActive
                                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 dark:border-indigo-400 dark:bg-indigo-900/30 dark:ring-indigo-500/60"
                                  : "border-gray-200 bg-white hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {isLive ? (
                                  <PlayCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                                ) : isTv ? (
                                  <Monitor className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                                ) : (
                                  <GitCompare className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                                )}
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-800 dark:text-neutral-50">
                                    {title}
                                  </div>
                                  <div className="text-[11px] text-stone-500 dark:text-neutral-400">
                                    {subtitle}
                                  </div>
                                </div>
                              </div>
                              {isActive && (
                                <span className="ml-2 h-2 w-2 rounded-md bg-indigo-500 shadow-[0_0_0_4px_rgba(79,70,229,0.25)] dark:bg-indigo-300" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Liga / turniej</Label>
                      <div className="relative mt-1">
                        <Input
                          value={o.competition ?? ""}
                          onChange={(e) =>
                            setField("competition", e.target.value)
                          }
                          placeholder="np. CLJ U19, Puchar Polski"
                          className={cn(
                            "rounded-md",
                            isRequired("competition") && !hasCompetition
                              ? "pr-24"
                              : ""
                          )}
                        />
                        {isRequired("competition") && !hasCompetition && (
                          <ReqChip />
                        )}
                      </div>
                      {isRequired("competition") && !hasCompetition && (
                        <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-200">
                          Pole ustawione jako wymagane w konfiguracji.
                        </p>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* KROK 2 – Zawodnicy */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group flex itemscenter justify-between rounded-md border-gray-200 transition-colors hover:bg-stone-50/80 p-0 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              playersOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={playersOpen}
              aria-controls="players-panel"
              onClick={() => setPlayersOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left px-4 py-4"
            >
              <div>
                <div className={stepPillClass}>Krok 2 · Zawodnicy</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Obserwowani zawodnicy
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Jeden input – numer lub nazwisko, dropdown z wynikami i
                  szczegóły pod wierszem zawodnika.
                </p>
              </div>
             <div className="flex items-center gap-3 pl-4">
  <span className="whitespace-nowrap rounded-md border px-2 py-0.5 text-xs text-muted-foreground dark:border-neutral-700">
    {o.players?.length ?? 0} pozycja
  </span>

  <ChevronDown
    className={cn(
      "h-5 w-5 transition-transform",
      playersOpen ? "rotate-180" : "rotate-0"
    )}
  />
</div>

            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={playersOpen ? "players" : undefined}
              onValueChange={(v) => setPlayersOpen(v === "players")}
              className="w-full"
            >
              <AccordionItem value="players" className="border-0">
                <AccordionContent id="players-panel" className="pt-4 pb-5">
                  <div className="space-y-4 sm:space-y-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="relative w-full sm:w-[360px]">
                        <Label className="text-sm">
                          Numer lub nazwisko zawodnika
                        </Label>
                        <div className="relative mt-1">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <Input
                            value={quickInput}
                            onChange={(e) => setQuickInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addPlayerFromInput();
                              }
                            }}
                            placeholder="np. 9 lub Piotr Nowak"
                            className="rounded-md pl-8 pr-24"
                          />
                          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                            Enter ↵, aby dodać
                          </div>
                        </div>

                        {filteredPlayers.length > 0 && (
                          <div className="absolute left-0 right-0 top-[100%] z-20 mt-1 rounded-md border border-gray-200 bg-white text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-950">
                            {filteredPlayers.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-neutral-800"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => addPlayerFromInput(p)}
                              >
                                <span>{p.name}</span>
                                {(p as any).club && (
                                  <span className="text-[11px] text-gray-500 dark:text-neutral-400">
                                    {(p as any).club}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        className="mt-1 h-10 rounded-md border border-[#089569] text-[#089569] bg-white hover:bg-[#089569]/5 dark:border-[#089569] dark:text-[#089569] sm:mt-6"
                        onClick={() => addPlayerFromInput()}
                        disabled={!quickInput.trim()}
                        title="Dodaj do listy"
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Dodaj do listy
                      </Button>
                    </div>

                        {/* ====== LISTA ZAWODNIKÓW: MOBILE (karty) ====== */}
<div className="sm:hidden space-y-2">
  {(o.players ?? []).map((p) => {
    const isOpen = expandedId === p.id;
    const isConfirmDelete = confirmDeleteId === p.id;

    const pos = p.position;
    const showGK = pos === "GK";
    const showDEF = pos === "CB" || pos === "LB" || pos === "RB";
    const showMID = pos === "CMD" || pos === "CM" || pos === "CAM";
    const showATT = pos === "LW" || pos === "RW" || pos === "ST";

    const hasPosition = !!p.position;

    const displayName =
      p.type === "known"
        ? p.name ?? "—"
        : p.name ?? (p.shirtNo ? `#${p.shirtNo}` : "—");

    const isUnknownPlayer =
      p.type === "unknown" || (displayName && displayName.trim().startsWith("#"));

    const normalizedName = (p.name || "").replace(/^#/, "").trim();

    const inBase =
      !!normalizedName &&
      allPlayers.some(
        (bp) => (bp.name || "").toLowerCase() === normalizedName.toLowerCase()
      );

    return (
      <div
        key={p.id}
        className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-neutral-100">
                {displayName}
              </div>

              {isUnknownPlayer && (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  nieznany
                </span>
              )}
            </div>

            {p.shirtNo && (
              <div className="mt-0.5 text-[11px] text-stone-700 dark:text-stone-200">
                Nr: {p.shirtNo}
              </div>
            )}
          </div>

          {/* actions (top-right) */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-md border-gray-300 px-2 text-xs dark:border-neutral-700"
              onClick={() => {
                setExpandedId((cur) => (cur === p.id ? null : p.id));
                setConfirmDeleteId(null);
              }}
              title={isOpen ? "Ukryj oceny" : "Pokaż oceny"}
            >
              {isOpen ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  Ukryj
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  Oceny
                </>
              )}
            </Button>

            {!isConfirmDelete ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 rounded-md border-gray-300 p-0 text-red-600 dark:border-neutral-700"
                onClick={() => setConfirmDeleteId(p.id)}
                title="Usuń zawodnika"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <div className="inline-flex items-center gap-1">
                <Button
                  size="sm"
                  className="h-8 rounded-md bg-red-600 px-2 text-xs text-white hover:bg-red-700"
                  onClick={() => {
                    removePlayer(p.id);
                    setConfirmDeleteId(null);
                  }}
                >
                  Tak
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-md border-gray-300 px-2 text-xs dark:border-neutral-700"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Nie
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* fields */}
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <div className="col-span-2">
            <Label className="text-[11px] text-stone-600 dark:text-neutral-400">
              Pozycja w meczu
            </Label>
            <div className="mt-1">
              <Select
                value={p.position ?? "__none"}
                onValueChange={(value) =>
                  updatePlayer(p.id, {
                    position:
                      value === "__none" ? undefined : (value as PositionKey),
                  })
                }
              >
                <SelectTrigger
                  id={`pos-${p.id}`}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  title={
                    p.position
                      ? `${p.position} — ${POS_INFO[p.position]}`
                      : "Wybierz pozycję"
                  }
                >
                  <SelectValue placeholder="— wybierz pozycję —" />
                </SelectTrigger>

                <SelectContent className="w-[16rem] max-w-xs bg-white dark:bg-neutral-950">
                  <SelectItem value="__none">— bez pozycji —</SelectItem>
                  {POSITIONS.map((posKey) => (
                    <SelectItem key={posKey} value={posKey}>
                      {posKey}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-stone-600 dark:text-neutral-400">
              Minuty
            </Label>
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
              placeholder="0–120"
              className="mt-1 h-9 w-full rounded-md"
            />
          </div>

          <div>
            <Label className="text-[11px] text-stone-600 dark:text-neutral-400">
              Ocena
            </Label>
            <div className="mt-1">
              <StarRating
                value={p.overall ?? 0}
                onChange={(v) => updatePlayer(p.id, { overall: v })}
                /* @ts-ignore */
                max={5}
              />
            </div>
          </div>

          {!inBase && normalizedName && (
            <div className="col-span-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full rounded-md border-black bg-black text-white hover:bg-zinc-900 hover:text-white dark:border-black dark:bg-black dark:hover:bg-zinc-900"
                onClick={() => {
                  setPromotePlayer(p);
                  setNewPlayerClub("");
                  setNewPlayerPosition(p.position ?? "");
                }}
              >
                <AddPlayerIcon className="mr-2 h-6 w-6" strokeColorAll="#ffffff" />
                Dodaj do mojej bazy
              </Button>
            </div>
          )}
        </div>

        {/* expanded */}
        {isOpen && (
          <div className="border-t border-gray-200 bg-[#E8FBF5] p-3 dark:border-neutral-800">
            <div className="relative">
              {!hasPosition && (
                <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-white/70 px-4 text-center backdrop-blur-sm dark:bg-neutral-950/80">
                  <p className="mb-3 text-xs text-stone-700 dark:text-neutral-200">
                    Aby wprowadzić oceny, najpierw uzupełnij <b>Pozycja w meczu</b>.
                  </p>
                  <button
                    type="button"
                    onClick={() => openPositionSelect(p.id)}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Pozycja w meczu
                  </button>
                </div>
              )}

              <div className={cn("space-y-4", !hasPosition && "pointer-events-none blur-[1.5px]")}>
                <Group title="Kategorie bazowe">
                  {metrics.BASE.filter((m) => m.enabled).map((m) => (
                    <MetricItem
                      key={m.id}
                      label={m.label}
                      value={p.base?.[m.key]}
                      onChange={(v) => updateMetric("base", m.id, m.key, v, p)}
                    />
                  ))}
                </Group>

                {showGK && (
                  <Group title="Bramkarz (GK)">
                    {metrics.GK.filter((m) => m.enabled).map((m) => (
                      <MetricItem
                        key={m.id}
                        label={m.label}
                        value={p.gk?.[m.key]}
                        onChange={(v) => updateMetric("gk", m.id, m.key, v, p)}
                      />
                    ))}
                  </Group>
                )}

                {showDEF && (
                  <Group title="Obrońca (CB/FB/WB)">
                    {metrics.DEF.filter((m) => m.enabled).map((m) => (
                      <MetricItem
                        key={m.id}
                        label={m.label}
                        value={p.def?.[m.key]}
                        onChange={(v) => updateMetric("def", m.id, m.key, v, p)}
                      />
                    ))}
                  </Group>
                )}

                {showMID && (
                  <Group title="Pomocnik (6/8/10)">
                    {metrics.MID.filter((m) => m.enabled).map((m) => (
                      <MetricItem
                        key={m.id}
                        label={m.label}
                        value={p.mid?.[m.key]}
                        onChange={(v) => updateMetric("mid", m.id, m.key, v, p)}
                      />
                    ))}
                  </Group>
                )}

                {showATT && (
                  <Group title="Napastnik (9/7/11)">
                    {metrics.ATT.filter((m) => m.enabled).map((m) => (
                      <MetricItem
                        key={m.id}
                        label={m.label}
                        value={p.att?.[m.key]}
                        onChange={(v) => updateMetric("att", m.id, m.key, v, p)}
                      />
                    ))}
                  </Group>
                )}

                <div className="mt-2 rounded-md bg-none p-0 shadow-sm dark:bg-neutral-950/80">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-700 dark:text-neutral-200">
                    Notatka do zawodnika
                  </div>
                  <Textarea
                    value={p.note ?? ""}
                    onChange={(e) => updatePlayer(p.id, { note: e.target.value })}
                    placeholder="Notatka o zawodniku…"
                    className="min-h-[80px] rounded-md bg-white/90 text-sm dark:bg-neutral-950"
                  />
                  <p className="mt-1 text-[11px] text-stone-500 dark:text-neutral-400">
                    Wewnętrzna notatka – widoczna tylko w tej obserwacji.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  })}

  {(o.players ?? []).length === 0 && (
    <div className="rounded-md border border-gray-200 bg-white p-4 text-center text-sm text-dark shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
      {isRequired("players")
        ? "Musisz dodać przynajmniej jednego zawodnika, aby zapisać obserwację (pole ustawione jako wymagane)."
        : "Brak zawodników — wpisz numer lub nazwisko i kliknij Enter lub przycisk dodawania."}
    </div>
  )}
</div>

{/* ====== LISTA ZAWODNIKÓW: DESKTOP (tabela) ====== */}
<div className="hidden sm:block w-full rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
  <table className="w-full table-auto text-sm">
    <thead className="bg-stone-50 text-dark dark:bg-neutral-900 dark:text-neutral-300">
      <tr className="text-xs sm:text-sm">
        <th className="p-3 text-left font-medium">Zawodnik</th>
        <th className="p-3 text-left font-medium">Pozycja w meczu</th>
        <th className="p-3 text-left font-medium">Minuty</th>
        <th className="p-3 text-left font-medium">Ocena</th>
        <th className="p-3 text-right font-medium">Akcje</th>
      </tr>
    </thead>

    <tbody>
      {(o.players ?? []).map((p) => {
        const isOpen = expandedId === p.id;
        const isConfirmDelete = confirmDeleteId === p.id;

        const pos = p.position;
        const showGK = pos === "GK";
        const showDEF = pos === "CB" || pos === "LB" || pos === "RB";
        const showMID = pos === "CMD" || pos === "CM" || pos === "CAM";
        const showATT = pos === "LW" || pos === "RW" || pos === "ST";

        const hasPosition = !!p.position;

        const displayName =
          p.type === "known"
            ? p.name ?? "—"
            : p.name ?? (p.shirtNo ? `#${p.shirtNo}` : "—");

        const isUnknownPlayer =
          p.type === "unknown" || (displayName && displayName.trim().startsWith("#"));

        const normalizedName = (p.name || "").replace(/^#/, "").trim();

        const inBase =
          !!normalizedName &&
          allPlayers.some(
            (bp) => (bp.name || "").toLowerCase() === normalizedName.toLowerCase()
          );

        return (
          <Fragment key={p.id}>
            <tr className="border-t border-gray-200 align-middle hover:bg-stone-50/60 dark:border-neutral-800 dark:hover:bg-neutral-900/60">
              <td className="p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-neutral-100">
                      {displayName}
                    </div>

                    {isUnknownPlayer && (
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        nieznany
                      </span>
                    )}
                  </div>

                  {p.shirtNo && (
                    <div className="mt-0.5 text-[11px] text-stone-700 dark:text-stone-200">
                      Nr: {p.shirtNo}
                    </div>
                  )}
                </div>
              </td>

              <td className="p-3">
                <div className="w-full max-w-[11rem]">
                  <Select
                    value={p.position ?? "__none"}
                    onValueChange={(value) =>
                      updatePlayer(p.id, {
                        position: value === "__none" ? undefined : (value as PositionKey),
                      })
                    }
                  >
                    <SelectTrigger
                      id={`pos-${p.id}`}
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:text-sm dark:border-neutral-700 dark:bg-neutral-950"
                      title={
                        p.position
                          ? `${p.position} — ${POS_INFO[p.position]}`
                          : "Wybierz pozycję"
                      }
                    >
                      <SelectValue placeholder="— wybierz pozycję —" />
                    </SelectTrigger>

                    <SelectContent className="w-[16rem] max-w-xs bg-white dark:bg-neutral-950">
                      <SelectItem value="__none">— bez pozycji —</SelectItem>
                      {POSITIONS.map((posKey) => (
                        <SelectItem key={posKey} value={posKey}>
                          {posKey}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  placeholder="min"
                  className="h-8 w-16 rounded-md sm:w-20"
                />
              </td>

              <td className="p-3">
                <StarRating
                  value={p.overall ?? 0}
                  onChange={(v) => updatePlayer(p.id, { overall: v })}
                  /* @ts-ignore */
                  max={5}
                />
              </td>

              <td className="p-3 text-right">
                <div className="inline-flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-md border-gray-300 dark:border-neutral-700"
                    onClick={() => {
                      setExpandedId((cur) => (cur === p.id ? null : p.id));
                      setConfirmDeleteId(null);
                    }}
                  >
                    {isOpen ? (
                      <>
                        <ChevronUp className="mr-1 h-4 w-4" />
                        <span className="hidden sm:inline">Ukryj oceny</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1 h-4 w-4" />
                        <span className="hidden sm:inline">Oceny</span>
                      </>
                    )}
                  </Button>

                  {!isConfirmDelete ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 rounded-md border-gray-300 p-0 text-red-600 dark:border-neutral-700"
                      onClick={() => setConfirmDeleteId(p.id)}
                      title="Usuń zawodnika"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="sm"
                        className="h-8 rounded-md bg-red-600 px-2 text-xs text-white hover:bg-red-700"
                        onClick={() => {
                          removePlayer(p.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        Tak
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-md border-gray-300 px-2 text-xs dark:border-neutral-700"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Nie
                      </Button>
                    </div>
                  )}

                  {!inBase && normalizedName && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-fit rounded-md border-black bg-black text-white hover:bg-zinc-900 hover:text-white dark:border-black dark:bg-black dark:hover:bg-zinc-900"
                      onClick={() => {
                        setPromotePlayer(p);
                        setNewPlayerClub("");
                        setNewPlayerPosition(p.position ?? "");
                      }}
                    >
                      <AddPlayerIcon className="h-7 w-7" strokeColorAll="#ffffff" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>

            {isOpen && (
              <tr>
                <td colSpan={5} className="bg-[#E8FBF5] p-3 text-sm">
                  <div className="relative">
                    {!hasPosition && (
                      <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-white/70 px-4 text-center backdrop-blur-sm dark:bg-neutral-950/80">
                        <p className="mb-3 text-xs text-stone-700 dark:text-neutral-200 sm:text-sm">
                          Aby wprowadzić oceny, najpierw uzupełnij <b>Pozycja w meczu</b>.
                        </p>
                        <button
                          type="button"
                          onClick={() => openPositionSelect(p.id)}
                          className="inline-flex h-9 items-center justify-center rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
                        >
                          Pozycja w meczu
                        </button>
                      </div>
                    )}

                    <div className={cn("space-y-4", !hasPosition && "pointer-events-none blur-[1.5px]")}>
                      <Group title="Kategorie bazowe">
                        {metrics.BASE.filter((m) => m.enabled).map((m) => (
                          <MetricItem
                            key={m.id}
                            label={m.label}
                            value={p.base?.[m.key]}
                            onChange={(v) => updateMetric("base", m.id, m.key, v, p)}
                          />
                        ))}
                      </Group>

                      {showGK && (
                        <Group title="Bramkarz (GK)">
                          {metrics.GK.filter((m) => m.enabled).map((m) => (
                            <MetricItem
                              key={m.id}
                              label={m.label}
                              value={p.gk?.[m.key]}
                              onChange={(v) => updateMetric("gk", m.id, m.key, v, p)}
                            />
                          ))}
                        </Group>
                      )}

                      {showDEF && (
                        <Group title="Obrońca (CB/FB/WB)">
                          {metrics.DEF.filter((m) => m.enabled).map((m) => (
                            <MetricItem
                              key={m.id}
                              label={m.label}
                              value={p.def?.[m.key]}
                              onChange={(v) => updateMetric("def", m.id, m.key, v, p)}
                            />
                          ))}
                        </Group>
                      )}

                      {showMID && (
                        <Group title="Pomocnik (6/8/10)">
                          {metrics.MID.filter((m) => m.enabled).map((m) => (
                            <MetricItem
                              key={m.id}
                              label={m.label}
                              value={p.mid?.[m.key]}
                              onChange={(v) => updateMetric("mid", m.id, m.key, v, p)}
                            />
                          ))}
                        </Group>
                      )}

                      {showATT && (
                        <Group title="Napastnik (9/7/11)">
                          {metrics.ATT.filter((m) => m.enabled).map((m) => (
                            <MetricItem
                              key={m.id}
                              label={m.label}
                              value={p.att?.[m.key]}
                              onChange={(v) => updateMetric("att", m.id, m.key, v, p)}
                            />
                          ))}
                        </Group>
                      )}

                      <div className="mt-2 rounded-md bg-none p-0 shadow-sm dark:bg-neutral-950/80">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-700 dark:text-neutral-200">
                          Notatka do zawodnika
                        </div>
                        <Textarea
                          value={p.note ?? ""}
                          onChange={(e) => updatePlayer(p.id, { note: e.target.value })}
                          placeholder="Notatka o zawodniku…"
                          className="min-h-[80px] rounded-md bg-white/90 text-sm dark:bg-neutral-950"
                        />
                        <p className="mt-1 text-[11px] text-stone-500 dark:text-neutral-400">
                          Wewnętrzna notatka – widoczna tylko w tej obserwacji.
                        </p>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}

      {(o.players ?? []).length === 0 && (
        <tr>
          <td colSpan={5} className="p-6 text-center text-sm text-dark dark:text-neutral-400">
            {isRequired("players")
              ? "Musisz dodać przynajmniej jednego zawodnika, aby zapisać obserwację (pole ustawione jako wymagane)."
              : "Brak zawodników — wpisz numer lub nazwisko i kliknij Enter lub przycisk dodawania."}
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>


                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* KROK 3 – Notatka ogólna */}
        <Card className="mt-1">
          <CardHeader
            className={cn(
              "group flex itemscenter justify-between rounded-md border-gray-200 transition-colors hover:bg-stone-50/80 p-0 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
              noteOpen && "bg-stone-100 dark:bg-neutral-900/70"
            )}
          >
            <button
              type="button"
              aria-expanded={noteOpen}
              aria-controls="note-panel"
              onClick={() => setNoteOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left px-4 py-4"
            >
              <div>
                <div className={stepPillClass}>Krok 3 · Notatka</div>
                <div className="mt-1 text-xl font-semibold leading-none tracking-tight">
                  Notatka do obserwacji
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
                  Krótki opis, kontekst, obserwacje ogólne.
                </p>
              </div>
              <div className="flex items-center gap-3 pl-4">
                {isRequired("note") && !hasNote && (
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-100">
                    Wymagane wg konfiguracji
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-5 w-5 transition-transform",
                    noteOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </div>
            </button>
          </CardHeader>
          <CardContent className="px-4 py-0 md:px-4">
            <Accordion
              type="single"
              collapsible
              value={noteOpen ? "note" : undefined}
              onValueChange={(v) => setNoteOpen(v === "note")}
              className="w-full"
            >
              <AccordionItem value="note" className="border-0">
                <AccordionContent id="note-panel" className="pt-4 pb-5">
                  <div className="space-y-2">
                    <Label className="text-sm">Notatka tekstowa</Label>
                    <Textarea
                      value={o.note ?? ""}
                      onChange={(e) => setField("note", e.target.value)}
                      placeholder="Krótka notatka…"
                      className="min-h-[140px] rounded-md"
                    />
                    <div className="inline-flex flex-wrap items-center gap-2 text-xs text-dark dark:text-neutral-400">
                      <VoiceNoteButton
                        onTranscription={handleVoiceTranscription}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {promotePlayer && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/40"
            onClick={() => setPromotePlayer(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[111] max-h-[80vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-gray-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Dodaj zawodnika do bazy
              </h2>
              <button
                className="rounded-md p-1 text-dark hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                onClick={() => setPromotePlayer(null)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-xs">Imię i nazwisko</Label>
                <Input
                  className="mt-1 rounded-md"
                  value={(promotePlayer.name || "").replace(/^#/, "").trim()}
                  readOnly
                />
                <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">
                  Nazwa z obserwacji – edycję zrobisz później w „Mojej bazie”.
                </p>
              </div>

              <div>
                <Label className="text-xs">Klub (opcjonalnie)</Label>
                <Input
                  className="mt-1 rounded-md"
                  value={newPlayerClub}
                  onChange={(e) => setNewPlayerClub(e.target.value)}
                  placeholder="np. Lech U19"
                />
              </div>

              <div>
                <Label className="text-xs">
                  Domyślna pozycja (opcjonalnie)
                </Label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={newPlayerPosition}
                  onChange={(e) =>
                    setNewPlayerPosition(
                      (e.target.value || "") as PositionKey | ""
                    )
                  }
                >
                  <option value="">— bez pozycji —</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos} — {POS_INFO[pos]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-md border-gray-300 dark:border-neutral-700"
                onClick={() => setPromotePlayer(null)}
              >
                Anuluj
              </Button>
              <Button
                className="rounded-md bg-gray-900 text-white hover:bg-gray-800"
                onClick={handlePromotePlayerSave}
              >
                Dodaj do mojej bazy
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* Group helper */
function Group({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-md bg-none p-0 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
          <span className="h-1.5 w-1.5 rounded-md bg-stone-500" />
          {title}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

export default ObservationEditor;
