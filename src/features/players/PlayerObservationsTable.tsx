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
import { supabase } from "@/lib/supabaseClient";

/* -------------------------------- Types -------------------------------- */

type Bucket = "active" | "trash";
type Mode = "live" | "tv" | "mix";
type PositionKey = string;

// ⬇️ ratings as any aspect map (key -> number 0–5)
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
  ratings?: Record<string, number>;
  /** connection with public.players.id (local player) */
  playerId?: number | null;
  /** connection with public.global_players.id (global player) */
  globalId?: number | null;
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
    return new Date(d).toLocaleDateString("en-US", {
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

/* --------- adapters like in src/features/observations/Observations.tsx --------- */

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
    // ⬇️ WE TRANSFER all ratings and player id
    ratings: (p as any).ratings ?? undefined,
    playerId: (p as any).playerId ?? (p as any).player_id ?? undefined,
    globalId: (p as any).globalId ?? (p as any).global_id ?? undefined,
    voiceUrl: (p as any).voiceUrl ?? null,
  }));

  const editorObj: any = {
    id: row.id,
    reportDate: row.date || "",
    competition: row.competition ?? "",
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
    ratings: p.ratings ?? undefined, // ⬅️ we preserve the aspect map
    voiceUrl: (p as any).voiceUrl ?? null,
    playerId:
      typeof p.playerId === "number"
        ? p.playerId
        : typeof p.player_id === "number"
          ? p.player_id
          : undefined,
    globalId:
      typeof p.globalId === "number"
        ? p.globalId
        : typeof p.global_id === "number"
          ? p.global_id
          : undefined,
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
    competition: anyE.competition ?? prev?.competition ?? null,
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
  playerId,
  globalId,
  onChange,
}: {
  playerName?: string;
  observations?: Observation[];
  /** ID of local player (public.players.id) */
  playerId?: number | null;
  /** ID of global player (public.global_players.id) */
  globalId?: number | null;
  /** optional – if you want to get the next state to the parent */
  onChange?: (next: Observation[]) => void;
}) {
  const source = (observations ?? []) as XO[];

  // local list state (so the UI refreshes after saving from the editor)
  const [rows, setRows] = useState<XO[]>(() =>
    source.map((o) => ({
      bucket: (o as any).bucket ?? "active",
      mode: (o as any).mode ?? "live",
      players: (o as any).players ?? [],
      competition: (o as any).competition ?? null,
      ...o,
    })),
  );

  // when the parent replaces observations – synchronize
  useEffect(() => {
    setRows(
      (observations as XO[]).map((o) => ({
        bucket: (o as any).bucket ?? "active",
        mode: (o as any).mode ?? "live",
        players: (o as any).players ?? [],
        competition: (o as any).competition ?? null,
        ...o,
      })),
    );
  }, [observations]);

  const [pageMode, setPageMode] = useState<"list" | "editor">("list");
  const [editing, setEditing] = useState<XO | null>(null);

  const editorInitial = useMemo<EditorXO | null>(
    () => (editing ? toEditorXO(editing) : null),
    [editing],
  );

  const normalizedPlayerName = (playerName ?? "").trim().toLowerCase();

  // select the "main" player in this observation – first by playerId,
  // then by name, and finally the first on the list
  function getMainPlayer(row: XO): ObsPlayer | null {
    const list = row.players ?? [];
    if (!list.length) return null;

    if (typeof playerId === "number") {
      const byId = list.find(
        (p) =>
          typeof (p as any).playerId === "number" &&
          (p as any).playerId === playerId,
      );
      if (byId) return byId;
    }

    if (!normalizedPlayerName) return list[0];

    const byName = list.find(
      (p) => (p.name ?? "").trim().toLowerCase() === normalizedPlayerName,
    );
    return byName ?? list[0];
  }

  // ⬇️ PERFORMANCE SUMMARY – we take all Ratings from rows
  // and calculate the sum, count, and average (sum / count)
  const performanceSummary = useMemo(() => {
    if (!rows.length) return null;

    const values: number[] = [];

    for (const r of rows) {
      const mainPlayer = getMainPlayer(r);
      if (!mainPlayer) continue;

      const ratingsMap = mainPlayer.ratings;
      if (
        ratingsMap &&
        typeof ratingsMap === "object" &&
        Object.keys(ratingsMap).length > 0
      ) {
        const vals = Object.values(ratingsMap).filter(
          (v): v is number => typeof v === "number" && !Number.isNaN(v),
        );
        if (vals.length) {
          const avgPerObs =
            vals.reduce((acc, v) => acc + v, 0) / vals.length;
          values.push(avgPerObs);
          continue;
        }
      }

      if (
        typeof mainPlayer.overall === "number" &&
        !Number.isNaN(mainPlayer.overall)
      ) {
        values.push(mainPlayer.overall);
      }
    }

    if (!values.length) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const count = values.length;
    const avg = sum / count;

    return { sum, count, avg };
  }, [rows, normalizedPlayerName, playerId]);

  /**
   * Saves "player performance" to Supabase for a single observation:
   * - deletes old observation_ratings for (observation_id, player_id/global_id)
   * - inserts new records based on mainPlayer.ratings + mainPlayer.overall
   */
  async function upsertObservationRatingsForPlayer(row: XO) {
    const obsId = Number(row.id);
    if (!Number.isFinite(obsId) || obsId <= 0) return;

    const main = getMainPlayer(row);
    if (!main) return;

    const targetPlayerId =
      typeof main.playerId === "number"
        ? main.playerId
        : typeof playerId === "number"
          ? playerId
          : null;

    const targetGlobalId =
      typeof main.globalId === "number"
        ? main.globalId
        : typeof globalId === "number"
          ? globalId
          : null;

    // if we don't have any ID associated with players/global_players tables – we don't save
    if (targetPlayerId == null && targetGlobalId == null) return;

    const ratingEntries: { aspect_key: string; rating: number }[] = [];

    const ratingsMap = main.ratings;
    if (ratingsMap && typeof ratingsMap === "object") {
      for (const [key, val] of Object.entries(ratingsMap)) {
        const num =
          typeof val === "number"
            ? val
            : Number.parseFloat(String(val).replace(",", "."));
        if (!Number.isFinite(num) || num < 0 || num > 5) continue;
        ratingEntries.push({ aspect_key: key, rating: num });
      }
    }

    // OVERALL as a separate aspect – useful for further analysis
    if (
      typeof main.overall === "number" &&
      Number.isFinite(main.overall) &&
      main.overall >= 0 &&
      main.overall <= 5
    ) {
      ratingEntries.push({
        aspect_key: "OVERALL",
        rating: main.overall,
      });
    }

    try {
      // delete previous records for this observation_id + player
      let delQuery = supabase
        .from("observation_ratings")
        .delete()
        .eq("observation_id", obsId);

      if (targetPlayerId != null) {
        delQuery = delQuery.eq("player_id", targetPlayerId);
      } else if (targetGlobalId != null) {
        delQuery = delQuery.eq("global_id", targetGlobalId);
      }

      const { error: delError } = await delQuery;
      if (delError) {
        console.error(
          "[PlayerObservationsTable] delete observation_ratings error:",
          delError,
        );
      }

      if (!ratingEntries.length) return;

      const payload = ratingEntries.map((r) => ({
        observation_id: obsId,
        player_id: targetPlayerId,
        global_id: targetGlobalId,
        aspect_key: r.aspect_key,
        rating: r.rating,
      }));

      const { error: insError } = await supabase
        .from("observation_ratings")
        .insert(payload);
      if (insError) {
        console.error(
          "[PlayerObservationsTable] insert observation_ratings error:",
          insError,
        );
      }
    } catch (e) {
      console.error(
        "[PlayerObservationsTable] upsert observation_ratings failed:",
        e,
      );
    }
  }

  function addNew() {
    const mainName = (playerName ?? "").trim() || "Unknown player";

    const newRow: XO = {
      id: 0 as any, // temporary ID, Observations/Editor/server can assign final one
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
          overall: 0,
          playerId: typeof playerId === "number" ? playerId : null,
          globalId: typeof globalId === "number" ? globalId : null,
        },
      ],
    };
    setEditing(newRow);
    setPageMode("editor");
  }

  function save(obs: XO) {
    const mainName = (playerName ?? "").trim() || "Unknown player";

    // make sure the main player is the one from the editor
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

    // try to save the "player performance" to Supabase (observation_ratings)
    if (typeof patched.id === "number" && patched.id > 0) {
      void upsertObservationRatingsForPlayer(patched);
    }

    setPageMode("list");
    setEditing(null);
  }

  /* ========= editor view ========= */
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

  /* ========= table view ========= */
  return (
    <div className="w-full space-y-3">
      {/* section header in accordion */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Player observations</h3>
          <p className="text-xs text-muted-foreground">
            All observations linked to:{" "}
            <strong>{(playerName ?? "").trim() || "Unknown player"}</strong>
          </p>

          {performanceSummary && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Average rating from{" "}
              <strong>{performanceSummary.count}</strong> performances:{" "}
              <strong>{performanceSummary.avg.toFixed(2)}</strong>
            </p>
          )}
        </div>

        <Button size="sm" className="h-9 gap-1" onClick={addNew}>
          <Plus className="h-4 w-4" />
          Add observation
        </Button>
      </div>

      <div className="w-full overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-xs font-medium uppercase text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
            <tr>
              <th className="px-2 py-2 text-left sm:px-3">Match</th>
              <th className="px-2 py-2 text-left sm:px-3">
                Player performance
              </th>
              <th className="px-2 py-2 text-left sm:px-3">League</th>
              <th className="px-2 py-2 text-right sm:px-3">Actions</th>
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

              // ⬇️ AVG of all ratings in mainPlayer.ratings; fallback to .overall
              const ratingLabel = (() => {
                const ratingsMap = mainPlayer?.ratings;
                if (
                  ratingsMap &&
                  typeof ratingsMap === "object" &&
                  Object.keys(ratingsMap).length > 0
                ) {
                  const vals = Object.values(ratingsMap).filter(
                    (v): v is number =>
                      typeof v === "number" && !Number.isNaN(v),
                  );
                  if (vals.length) {
                    const avg =
                      vals.reduce((acc, v) => acc + v, 0) / vals.length;
                    return avg.toFixed(1);
                  }
                }

                if (typeof mainPlayer?.overall === "number") {
                  return mainPlayer.overall.toFixed(1);
                }
                return undefined;
              })();

              const statusLabel =
                r.status === "final" ? "Final report" : "Draft";

              return (
                <tr
                  key={r.id}
                  className="border-t border-gray-200 align-top transition-colors hover:bg-stone-50/70 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                >
                  {/* Match + meta */}
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

                  {/* Player performance */}
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
                              Rating: {ratingLabel}
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
                        No performance data
                      </span>
                    )}
                  </td>

                  {/* League */}
                  <td className="px-2 py-2 sm:px-3">
                    <span className="inline-flex items-center rounded-md bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-800 dark:bg-neutral-800 dark:text-neutral-100">
                      {(r as any).competition ||
                        (r as any).opponentLevel ||
                        "—"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-2 text-right sm:px-3">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 border-gray-300 p-0 text-gray-800 hover:border-gray-400 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                      onClick={() => {
                        setEditing(r);
                        setPageMode("editor");
                      }}
                      aria-label="Edit observation"
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
                  This player does not have any observations yet.
                  <br />
                    {/* <Button size="sm" className="mt-3" onClick={addNew}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add the first observation
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
