// src/features/players/PlayerObservationsTable.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import type { Observation } from "@/shared/types";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  PlayCircle,
  Monitor,
  Plus,
  Pencil,
} from "lucide-react";

import { ObservationEditor } from "@/features/observations/ObservationEditor";
import type { XO as EditorXO } from "@/features/observations/ObservationEditor";

/* -------------------------------- Types -------------------------------- */

type Bucket = "active" | "trash";
type Mode = "live" | "tv" | "mix";
type PositionKey = string;

type ObsPlayer = {
  id: string;
  type: "known" | "unknown";
  name?: string;
  shirtNo?: string;
  minutes?: number;
  position?: PositionKey;
  overall?: number;
  voiceUrl?: string | null;
  note?: string;
  ratings?: { off: number; def: number; tech: number; motor: number };
};

type XO = Observation & {
  bucket?: Bucket;
  mode?: Mode;
  voiceUrl?: string | null;
  note?: string;
  players?: ObsPlayer[];
  competition?: string | null;
};

/* ----------------------------- Helpers ----------------------------- */

function fmtDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function splitMatch(match?: string): { teamA?: string; teamB?: string } {
  if (!match) return {};
  const [a, b] = match
    .split(/vs|VS| Vs | v\. | – | - /i)
    .map((x) => x.trim());
  if (!a || !b) return { teamA: match };
  return { teamA: a, teamB: b };
}

function truncate(text: string | undefined, len = 80): string {
  if (!text) return "";
  if (text.length <= len) return text;
  return text.slice(0, len - 1) + "…";
}

/* --------- adaptery jak w src/features/observations/Observations.tsx --------- */

function toEditorXO(row: XO): EditorXO {
  const { teamA, teamB } = splitMatch(row.match);
  const players = (row.players ?? []).map((p) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    shirtNo: p.shirtNo,
    minutes: p.minutes,
    position: p.position,
    overall: p.overall,
    note: p.note,
  }));

  const editorObj: any = {
    id: row.id,
    reportDate: row.date || "",
    competition: row.competition ?? "", // <- Liga do edytora
    teamA: teamA || "",
    teamB: teamB || "",
    conditions: row.mode ?? "live",
    contextNote: row.note ?? "",
    note: row.note ?? "",
    players,
    __listMeta: {
      id: row.id as number,
      status: row.status,
      bucket: row.bucket ?? "active",
      time: row.time ?? "",
      player: (row as any).player ?? "",
    },
  };

  return editorObj as EditorXO;
}

function fromEditorXO(e: EditorXO, prev?: XO): XO {
  const anyE: any = e;
  const teamA = anyE.teamA ?? "";
  const teamB = anyE.teamB ?? "";
  const match =
    teamA && teamB
      ? `${teamA} vs ${teamB}`
      : teamA || teamB || (prev?.match ?? "");

  const players: ObsPlayer[] = (anyE.players ?? []).map((p: any) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    shirtNo: p.shirtNo,
    minutes: p.minutes,
    position: p.position as PositionKey,
    overall: p.overall,
    note: p.note,
  }));

  const meta = anyE.__listMeta || {};

  const listRow: XO = {
    id: meta.id ?? prev?.id ?? 0,
    player: meta.player ?? prev?.player ?? "",
    match,
    date: anyE.reportDate ?? prev?.date ?? "",
    time: meta.time ?? prev?.time ?? "",
    status: meta.status ?? prev?.status ?? "draft",
    bucket: meta.bucket ?? prev?.bucket ?? "active",
    mode: (anyE.conditions ?? prev?.mode ?? "live") as Mode,
    competition: anyE.competition ?? prev?.competition ?? null, // <- Liga z edytora
    note: anyE.note ?? anyE.contextNote ?? prev?.note ?? "",
    voiceUrl: prev?.voiceUrl ?? null,
    players,
  };

  return listRow;
}

/* ===================== PlayerObservationsTable ===================== */

export default function PlayerObservationsTable({
  playerName = "",
  observations = [],
  onChange,
}: {
  playerName?: string;
  observations?: Observation[];
  /** opcjonalnie – jeśli chcesz dostać next state do parenta */
  onChange?: (next: Observation[]) => void;
}) {
  const source = (observations ?? []) as XO[];

  // lokalny stan listy (żeby UI się odświeżał po zapisie z edytora)
  const [rows, setRows] = useState<XO[]>(() =>
    source.map((o) => ({
      bucket: (o as any).bucket ?? "active",
      mode: (o as any).mode ?? "live",
      players: (o as any).players ?? [],
      competition: (o as any).competition ?? null,
      ...o,
    }))
  );

  // gdy parent podmieni observations – zsynchronizuj
  useEffect(() => {
    setRows(
      (observations as XO[]).map((o) => ({
        bucket: (o as any).bucket ?? "active",
        mode: (o as any).mode ?? "live",
        players: (o as any).players ?? [],
        competition: (o as any).competition ?? null,
        ...o,
      }))
    );
  }, [observations]);

  const [pageMode, setPageMode] = useState<"list" | "editor">("list");
  const [editing, setEditing] = useState<XO | null>(null);

  const editorInitial = useMemo<EditorXO | null>(
    () => (editing ? toEditorXO(editing) : null),
    [editing]
  );

  const normalizedPlayerName = (playerName ?? "").trim().toLowerCase();

  // wybierz "głównego" zawodnika w tej obserwacji – najlepiej tego, który pasuje nazwą,
  // a jeśli się nie uda, bierz pierwszego z listy
  function getMainPlayer(row: XO): ObsPlayer | null {
    const list = row.players ?? [];
    if (!list.length) return null;
    if (!normalizedPlayerName) return list[0];

    const byName = list.find(
      (p) => (p.name ?? "").trim().toLowerCase() === normalizedPlayerName
    );
    return byName ?? list[0];
  }

  function addNew() {
    const mainName = (playerName ?? "").trim() || "Nieznany zawodnik";

    const newRow: XO = {
      id: 0 as any, // tymczasowe ID, Observations/Editor sobie z tym poradzą
      player: mainName,
      match: "",
      date: "",
      time: "",
      status: "draft",
      bucket: "active",
      mode: "live",
      competition: null,
      note: "",
      voiceUrl: null,
      players: [
        {
          id: crypto.randomUUID(),
          type: "known",
          name: mainName,
          overall: 3,
        },
      ],
    };
    setEditing(newRow);
    setPageMode("editor");
  }

  function save(obs: XO) {
    const mainName = (playerName ?? "").trim() || "Nieznany zawodnik";

    // dopilnuj, że główny zawodnik to ten z edytora
    const patched: XO = {
      ...obs,
      player: mainName,
    };

    setRows((prev) => {
      const exists = prev.some((x) => x.id === patched.id);
      if (exists) {
        const next = prev.map((x) => (x.id === patched.id ? patched : x));
        onChange?.(next as unknown as Observation[]);
        return next;
      }
      const maxId = Math.max(0, ...prev.map((x) => Number(x.id) || 0));
      const nextId = maxId + 1;
      const next = [{ ...patched, id: patched.id || (nextId as any) }, ...prev];
      onChange?.(next as unknown as Observation[]);
      return next;
    });

    setPageMode("list");
    setEditing(null);
  }

  /* ========= widok edytora ========= */
  if (pageMode === "editor" && editing && editorInitial) {
    return (
      <ObservationEditor
        initial={editorInitial}
        onSave={(editorObj) => {
          const nextListRow = fromEditorXO(editorObj, editing ?? undefined);
          save(nextListRow);
        }}
        onClose={() => {
          setPageMode("list");
          setEditing(null);
        }}
      />
    );
  }

  /* ========= widok tabeli ========= */
  return (
    <div className="w-full space-y-3">
      {/* nagłówek sekcji w akordeonie */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Obserwacje zawodnika</h3>
          <p className="text-xs text-muted-foreground">
            Wszystkie obserwacje powiązane z:{" "}
            <strong>{(playerName ?? "").trim() || "Nieznany zawodnik"}</strong>
          </p>
        </div>

        <Button size="sm" className="h-9 gap-1" onClick={addNew}>
          <Plus className="h-4 w-4" />
          Dodaj obserwację
        </Button>
      </div>

      <div className="w-full overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-xs font-medium uppercase text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
            <tr>
              <th className="px-2 py-2 text-left sm:px-3">Mecz</th>
              <th className="px-2 py-2 text-left sm:px-3">
                Występ zawodnika
              </th>
              <th className="px-2 py-2 text-left sm:px-3">Liga</th>
              <th className="px-2 py-2 text-right sm:px-3">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mode = (r.mode ?? "live") as Mode;
              const mainPlayer = getMainPlayer(r);

              const minutesLabel =
                typeof mainPlayer?.minutes === "number"
                  ? `${mainPlayer.minutes}′`
                  : undefined;
              const posLabel = mainPlayer?.position || undefined;
              const ratingLabel =
                typeof mainPlayer?.overall === "number"
                  ? mainPlayer.overall.toFixed(1)
                  : undefined;

              const statusLabel =
                r.status === "final" ? "Raport finalny" : "Szkic";

              return (
                <tr
                  key={r.id}
                  className="border-t border-gray-200 align-top transition-colors hover:bg-stone-50/70 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                >
                  {/* Mecz + meta */}
                  <td className="px-2 py-2 sm:px-3">
                    <div className="min-w-[180px]">
                      <div className="truncate font-medium text-gray-900 dark:text-neutral-50">
                        {r.match || "—"}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-600 dark:text-neutral-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {fmtDate(r.date)} {r.time || "—"}
                        </span>
                        {mode === "live" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            <PlayCircle className="h-3.5 w-3.5" />
                            Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            <Monitor className="h-3.5 w-3.5" />
                            TV
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-800 dark:bg-neutral-800 dark:text-neutral-100">
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Występ zawodnika */}
                  <td className="px-2 py-2 sm:px-3">
                    {mainPlayer ? (
                      <div className="space-y-1 text-[12px] text-gray-800 dark:text-neutral-100">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {minutesLabel && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                              {minutesLabel}
                            </span>
                          )}
                          {posLabel && (
                            <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-800 dark:bg-neutral-800 dark:text-neutral-100">
                              {posLabel}
                            </span>
                          )}
                          {ratingLabel && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                              Ocena: {ratingLabel}
                            </span>
                          )}
                        </div>
                        {mainPlayer.note && (
                          <p className="text-[11px] text-stone-500 dark:text-neutral-400">
                            {truncate(mainPlayer.note, 80)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">
                        Brak danych o występie
                      </span>
                    )}
                  </td>

                  {/* Liga */}
                  <td className="px-2 py-2 sm:px-3">
                    <span className="inline-flex items-center rounded-md bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-800 dark:bg-neutral-800 dark:text-neutral-100">
                      {(r as any).competition ||
                        (r as any).opponentLevel ||
                        "—"}
                    </span>
                  </td>

                  {/* Akcje */}
                  <td className="px-2 py-2 text-right sm:px-3">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 border-gray-300 p-0 text-gray-800 hover:border-gray-400 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                      onClick={() => {
                        setEditing(r);
                        setPageMode("editor");
                      }}
                      aria-label="Edytuj obserwację"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Ten zawodnik nie ma jeszcze żadnych obserwacji.
                  <br />
                  {/* <Button size="sm" className="mt-3" onClick={addNew}>
                    <Plus className="mr-1 h-4 w-4" />
                    Dodaj pierwszą obserwację
                  </Button> */}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
