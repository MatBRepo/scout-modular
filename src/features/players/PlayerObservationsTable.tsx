// src/features/players/PlayerObservationsTable.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import type { Observation } from "@/shared/types";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  PlayCircle,
  Monitor,
  CheckCircle2,
  Plus,
  Pencil,
} from "lucide-react";

import { ObservationEditor } from "@/features/observations/ObservationEditor";
import type { XO as EditorXO } from "@/features/observations/ObservationEditor";

/* -------------------------------- Types -------------------------------- */

type Bucket = "active" | "trash";
type Mode = "live" | "tv";
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
    competition: "",
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
      ...o,
    }))
  );

  // jeśli parent podmieni observations z zewnątrz, zsynchronizuj
  useEffect(() => {
    if (!observations || observations.length === 0) return;
    setRows(
      (observations as XO[]).map((o) => ({
        bucket: (o as any).bucket ?? "active",
        mode: (o as any).mode ?? "live",
        players: (o as any).players ?? [],
        ...o,
      }))
    );
  }, [observations]);

  // tylko obserwacje tego zawodnika
  const playerRows = useMemo(() => {
    const upper = (playerName ?? "").trim().toLowerCase();
    if (!upper) return rows;

    return rows.filter((r) => {
      const metaPlayer = ((r as any).player ?? "").toLowerCase();
      const listMetaPlayer = ((r as any).__listMeta?.player ?? "").toLowerCase();
      const inPlayers = (r.players ?? []).some(
        (p) => (p.name ?? "").toLowerCase() === upper
      );
      return metaPlayer === upper || listMetaPlayer === upper || inPlayers;
    });
  }, [rows, playerName]);

  const [pageMode, setPageMode] = useState<"list" | "editor">("list");
  const [editing, setEditing] = useState<XO | null>(null);

  // MEMO: stabilizujemy initial dla ObservationEditor, żeby uniknąć pętli
  const editorInitial = useMemo<EditorXO | null>(
    () => (editing ? toEditorXO(editing) : null),
    [editing]
  );

  function addNew() {
    const mainName = (playerName ?? "").trim() || "Nieznany zawodnik";

    const newRow: XO = {
      // tymczasowe ID, Observations/Editor sobie z tym poradzą
      id: 0 as any,
      player: mainName,
      match: "",
      date: "",
      time: "",
      status: "draft",
      bucket: "active",
      mode: "live",
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
              <th className="hidden px-2 py-2 text-left sm:table-cell sm:px-3">
                Data
              </th>
              <th className="hidden px-2 py-2 text-left sm:table-cell sm:px-3">
                Tryb
              </th>
              <th className="px-2 py-2 text-left sm:px-3">Status</th>
              <th className="px-2 py-2 text-right sm:px-3">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {playerRows.map((r) => {
              const mode = r.mode ?? "live";
              const status = r.status ?? "draft";

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
                      </div>
                    </div>
                  </td>

                  {/* Data – desktop */}
                  <td className="hidden px-2 py-2 text-sm text-gray-800 dark:text-neutral-100 sm:table-cell sm:px-3">
                    {fmtDate(r.date)}
                  </td>

                  {/* Tryb – desktop */}
                  <td className="hidden px-2 py-2 sm:table-cell sm:px-3">
                    {mode === "live" ? "Live" : "TV"}
                  </td>

                  {/* Status */}
                  <td className="px-2 py-2 sm:px-3">
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium " +
                        (status === "final"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {status === "final" ? "Finalna" : "Szkic"}
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

            {playerRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Ten zawodnik nie ma jeszcze żadnych obserwacji.
                  <br />
                  <Button size="sm" className="mt-3" onClick={addNew}>
                    <Plus className="mr-1 h-4 w-4" />
                    Dodaj pierwszą obserwację
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
