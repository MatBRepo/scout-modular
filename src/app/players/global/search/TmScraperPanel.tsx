"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

import {
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  CopyCheck,
  Database,
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import { supabase } from "@/shared/supabase-client";

/* =================== TM – scraper (Transfermarkt, tm_flat_competition_players) =================== */

type TmPlayerRow = {
  country_id: string;
  season_id: number;

  tm_player_id: number;
  player_name: string;
  player_path: string | null;

  competition_code: string;
  competition_name: string;
  tier_label: string | null;

  club_tm_id: number | null;
  club_name: string;
  club_profile_path: string | null;

  number: string | null;
  position: string | null;
  age: number | null;
  nationalities: string[];
  height_cm: number | null;
  foot: string | null;
  date_of_birth: string | null;
  contract_until: string | null;
  downloaded_at: string | null;
};

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

type PlayerProfileMeta = {
  name?: string;
  portrait_url?: string;
  height_cm?: number | null;
  main_position?: string; // NOTE: in your original code this field was used as a "facts blob"
  other_positions?: string[];
  nationalities?: string[];
  current_club?: string;
  agent?: string;
  contract_until?: string;
  contract_until_text?: string;
  market_value_eur?: number | null;
  foot?: string | null;
  [key: string]: any;
};

type PlayerDetailsResponse = {
  slug: string;
  playerId: string;
  urls: Record<string, string>;
  profile?: PlayerProfileMeta | null;
  tables?: Record<string, ParsedTable | null>;
  errors?: Record<string, string>;
};

type ParsedFacts = {
  nativeName?: string | null;
  birth?: string | null;
  birthPlace?: string | null;
  height?: string | null;
  citizenship?: string | null;
  position?: string | null;
  foot?: string | null;
  agent?: string | null;
  currentClub?: string | null;
  joined?: string | null;
  contractExpires?: string | null;
  lastExtension?: string | null;
};

function parseFactsBlob(blob?: string | null): ParsedFacts | null {
  if (!blob) return null;
  const trimmed = blob.replace(/\s+/g, " ").trim();

  if (trimmed.length < 60) return null;
  if (!trimmed.includes("Date of birth") && !trimmed.includes("Height")) return null;

  const text = trimmed;

  const LABELS = [
    "Name in home country",
    "Date of birth/Age",
    "Place of birth",
    "Height",
    "Citizenship",
    "Position",
    "Foot",
    "Player agent",
    "Current club",
    "Joined",
    "Contract expires",
    "Last contract extension",
  ];

  const findValue = (label: string): string | null => {
    const marker = `${label}:`;
    const start = text.indexOf(marker);
    if (start === -1) return null;
    const from = start + marker.length;

    let end = text.length;
    for (const other of LABELS) {
      if (other === label) continue;
      const idx = text.indexOf(`${other}:`, from);
      if (idx !== -1 && idx < end) end = idx;
    }

    const val = text.slice(from, end).trim();
    return val || null;
  };

  const result: ParsedFacts = {
    nativeName: findValue("Name in home country"),
    birth: findValue("Date of birth/Age"),
    birthPlace: findValue("Place of birth"),
    height: findValue("Height"),
    citizenship: findValue("Citizenship"),
    position: findValue("Position"),
    foot: findValue("Foot"),
    agent: findValue("Player agent"),
    currentClub: findValue("Current club"),
    joined: findValue("Joined"),
    contractExpires: findValue("Contract expires"),
    lastExtension: findValue("Last contract extension"),
  };

  const hasAny = Object.values(result).some((v) => typeof v === "string" && v.trim() !== "");
  return hasAny ? result : null;
}

const TM_DETAILS_ENDPOINT = "/api/tm/player/details";
const TM_PAGE_SIZE = 500;

type PosFilter = "all" | "GK" | "DF" | "MF" | "FW" | "other";

function openTmUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://www.transfermarkt.com${path}`;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export default function TmScraperPanel() {
  const [country, setCountry] = useState("135");
  const [season, setSeason] = useState("2025");

  const [rows, setRows] = useState<TmPlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const [stats, setStats] = useState<{ competitions: number; clubs: number; players: number }>({
    competitions: 0,
    clubs: 0,
    players: 0,
  });

  const [saving, setSaving] = useState(false);
  const [downloadedAt, setDownloadedAt] = useState<string | null>(null);

  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [selectedPlayer, setSelectedPlayer] = useState<TmPlayerRow | null>(null);
  const [playerDetails, setPlayerDetails] = useState<PlayerDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState<number | null>(null);

  const [sidebarClub, setSidebarClub] = useState<string | null>(null);

  // accordion per club
  const [collapsedClubs, setCollapsedClubs] = useState<Record<string, boolean>>({});

  const toggleClubCollapsed = (clubName: string) => {
    setCollapsedClubs((prev) => ({ ...prev, [clubName]: !prev[clubName] }));
  };

  const competitionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of rows) if (p.competition_name) set.add(p.competition_name);
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "pl"));
  }, [rows]);

  const loadPlayers = async (opts?: { page?: number }) => {
    const targetPage = opts?.page ?? 1;

    setLoading(true);
    setErrorMsg(null);
    setLastMsg(null);
    setSelectedIds([]);
    setSelectedPlayer(null);
    setPlayerDetails(null);
    setDetailsError(null);
    setSidebarClub(null);
    setCollapsedClubs({});

    try {
      const from = (targetPage - 1) * TM_PAGE_SIZE;
      const to = from + TM_PAGE_SIZE - 1;

      let query = supabase
        .from("tm_flat_competition_players")
        .select(
          "country_id, season_id, competition_code, competition_name, tier_label, club_tm_id, club_name, club_profile_path, tm_player_id, player_name, player_path, number, position, age, nationalities, height_cm, foot, date_of_birth, contract_until, downloaded_at",
          { count: "exact" }
        )
        .range(from, to);

      const c = country.trim();
      const s = season.trim();

      if (c && c.toLowerCase() !== "all") query = query.eq("country_id", c);

      if (s && s.toLowerCase() !== "all") {
        const seasonNum = Number.parseInt(s, 10);
        if (!Number.isNaN(seasonNum)) query = query.eq("season_id", seasonNum);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const rowsRaw = (data || []) as any[];

      const list: TmPlayerRow[] = rowsRaw.map((row: any) => ({
        country_id: String(row.country_id),
        season_id: Number(row.season_id),

        competition_code: String(row.competition_code ?? ""),
        competition_name: String(row.competition_name ?? ""),
        tier_label: row.tier_label === undefined || row.tier_label === null ? null : String(row.tier_label),

        club_tm_id: row.club_tm_id === undefined || row.club_tm_id === null ? null : Number(row.club_tm_id),
        club_name: String(row.club_name ?? ""),
        club_profile_path: row.club_profile_path ?? null,

        tm_player_id: Number(row.tm_player_id ?? row.player_id ?? row.id ?? 0),
        player_name: String(row.player_name ?? row.name ?? ""),
        player_path: row.player_path ?? row.profile_path ?? null,

        number: row.number === undefined || row.number === null ? null : String(row.number),
        position: row.position ?? null,
        age: typeof row.age === "number" ? row.age : row.age ? Number(row.age) : null,
        nationalities: Array.isArray(row.nationalities) ? row.nationalities.map((n: any) => String(n)) : [],
        height_cm: typeof row.height_cm === "number" ? row.height_cm : row.height_cm ? Number(row.height_cm) : null,
        foot: row.foot ?? null,
        date_of_birth: row.date_of_birth ?? null,
        contract_until: row.contract_until ?? null,
        downloaded_at: row.downloaded_at ?? null,
      }));

      setRows(list);
      setPage(targetPage);
      setTotalRows(typeof count === "number" ? count : null);

      // stats / latest downloaded
      const compsSet = new Set<string>();
      const clubsSet = new Set<string>();
      let latest: Date | null = null;

      for (const r of rowsRaw) {
        if (r.competition_name) compsSet.add(String(r.competition_name));
        if (r.club_name) clubsSet.add(String(r.club_name));
        if (r.downloaded_at) {
          const d = new Date(r.downloaded_at);
          if (!Number.isNaN(d.getTime())) if (!latest || d > latest) latest = d;
        }
      }

      setStats({
        competitions: compsSet.size,
        clubs: clubsSet.size,
        players: typeof count === "number" ? count : list.length,
      });

      setDownloadedAt(latest ? latest.toISOString() : null);

      const msg = `Załadowano stronę ${targetPage} (${list.length} rekordów) z ${count ?? "?"} pasujących w tm_flat_competition_players`;
      setLastMsg(msg);
      toast.success(msg);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.message || "Nie udało się pobrać listy zawodników z tm_flat_competition_players";
      setErrorMsg(msg);
      setRows([]);
      setStats({ competitions: 0, clubs: 0, players: 0 });
      setDownloadedAt(null);
      setTotalRows(null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlayers({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyPath = async (path?: string | null) => {
    if (!path) return;
    try {
      await copyTextToClipboard(path);
      toast.success("Ścieżka została skopiowana");
    } catch {
      toast.error("Nie udało się skopiować ścieżki");
    }
  };

  const total = rows.length;

  const filtered = useMemo(() => {
    let data = [...rows];

    if (competitionFilter !== "all") {
      data = data.filter((p) => p.competition_name === competitionFilter);
    }

    if (posFilter !== "all") {
      data = data.filter((p) => {
        const pos = (p.position || "").toUpperCase();
        if (!pos) return false;

        if (posFilter === "GK") return pos.startsWith("GK");
        if (posFilter === "DF") return pos.startsWith("DF") || pos.includes("BACK");
        if (posFilter === "MF") return pos.startsWith("MF") || pos.includes("MIDFIELD");
        if (posFilter === "FW")
          return pos.startsWith("FW") || pos.includes("STRIKER") || pos.includes("WINGER");
        if (posFilter === "other")
          return !(
            pos.startsWith("GK") ||
            pos.startsWith("DF") ||
            pos.startsWith("MF") ||
            pos.startsWith("FW")
          );
        return true;
      });
    }

    const q = search.trim().toLowerCase();
    if (!q) return data;
    const tokens = q.split(/\s+/).filter(Boolean);

    return data.filter((p) => {
      const haystack = (
        p.player_name +
        " " +
        p.club_name +
        " " +
        (p.position || "") +
        " " +
        (p.nationalities || []).join(" ") +
        " " +
        p.competition_name +
        " " +
        (p.tier_label || "")
      )
        .toLowerCase()
        .replace(/\s+/g, " ");

      return tokens.every((t) => haystack.includes(t));
    });
  }, [rows, search, competitionFilter, posFilter]);

  const visible = filtered.length;
  const totalAll = totalRows ?? total;
  const totalPages =
    totalRows && totalRows > 0 ? Math.ceil(totalRows / TM_PAGE_SIZE) : null;

  const isSelected = (id: number) => selectedIds.includes(id);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedIds([]);
  const selectAllVisible = () => setSelectedIds(filtered.map((p) => p.tm_player_id));

  const allVisibleSelected =
    visible > 0 && filtered.every((p) => selectedIds.includes(p.tm_player_id));

  const selectedCount = selectedIds.length;

  const groupedByClub = useMemo(() => {
    type ClubGroup = {
      club_name: string;
      competitions: Set<string>;
      players: TmPlayerRow[];
    };

    const map = new Map<string, ClubGroup>();

    for (const p of filtered) {
      const name = p.club_name || "Bez klubu";
      let entry = map.get(name);
      if (!entry) {
        entry = { club_name: name, competitions: new Set<string>(), players: [] };
        map.set(name, entry);
      }
      if (p.competition_name) entry.competitions.add(p.competition_name);
      entry.players.push(p);
    }

    return Array.from(map.values()).sort((a, b) => a.club_name.localeCompare(b.club_name, "pl"));
  }, [filtered]);

  const clubsAgg = useMemo(() => {
    const map = new Map<string, { club_name: string; playersCount: number }>();

    for (const p of filtered) {
      const name = p.club_name || "Bez klubu";
      const existing = map.get(name);
      if (existing) existing.playersCount += 1;
      else map.set(name, { club_name: name, playersCount: 1 });
    }

    return Array.from(map.values()).sort((a, b) => a.club_name.localeCompare(b.club_name, "pl"));
  }, [filtered]);

  const sortedPlayers = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => a.player_name.localeCompare(b.player_name, "pl"));
    return list;
  }, [filtered]);

  const sidebarPlayers = useMemo(() => {
    const base = sidebarClub
      ? filtered.filter((p) => (p.club_name || "Bez klubu") === sidebarClub)
      : sortedPlayers;

    return [...base];
  }, [sidebarClub, filtered, sortedPlayers]);

  const mapToPayload = (p: TmPlayerRow) => ({
    key: `tm:${p.tm_player_id}`,
    name: p.player_name,
    pos: p.position || "UNK",
    age: p.age ?? null,
    club: p.club_name || null,
    nationality: p.nationalities && p.nationalities.length ? p.nationalities.join(", ") : null,
    source: "tm",
    ext_id: String(p.tm_player_id),
    birth_date: p.date_of_birth,
    meta: {
      competition_code: p.competition_code,
      competition_name: p.competition_name,
      tier_label: p.tier_label,
      club_tm_id: p.club_tm_id,
      club_profile_path: p.club_profile_path,
      number: p.number,
      height_cm: p.height_cm,
      foot: p.foot,
      contract_until: p.contract_until,
      player_path: p.player_path,
      country,
      season,
    },
    added_at: new Date().toISOString(),
  });

  const saveSelectedOrVisible = async () => {
    const baseList =
      selectedIds.length > 0
        ? filtered.filter((p) => selectedIds.includes(p.tm_player_id))
        : filtered;

    if (!baseList.length) {
      toast.message("Brak zawodników do zapisu (widocznych / zaznaczonych).");
      return;
    }

    setSaving(true);
    try {
      const payload = baseList.map(mapToPayload);
      const { error } = await supabase.from("global_players").upsert(payload, { onConflict: "key" });
      if (error) throw error;

      toast.success(`Zapisano ${payload.length} zawodników do tabeli global_players`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Błąd zapisu do Supabase: ${e?.message || "nieznany błąd"}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSinglePlayer = async (p: TmPlayerRow) => {
    setSaving(true);
    try {
      const payload = [mapToPayload(p)];
      const { error } = await supabase.from("global_players").upsert(payload, { onConflict: "key" });
      if (error) throw error;

      toast.success(`Zapisano zawodnika: ${p.player_name}`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Błąd zapisu zawodnika: ${e?.message || "nieznany błąd"}`);
    } finally {
      setSaving(false);
    }
  };

  const deletePlayer = (id: number) => {
    setRows((prev) => prev.filter((p) => p.tm_player_id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    if (selectedPlayer?.tm_player_id === id) {
      setSelectedPlayer(null);
      setPlayerDetails(null);
      setDetailsError(null);
    }
  };

  const deleteSelected = () => {
    if (!selectedIds.length) return;
    setRows((prev) => prev.filter((p) => !selectedIds.includes(p.tm_player_id)));
    if (selectedPlayer && selectedIds.includes(selectedPlayer.tm_player_id)) {
      setSelectedPlayer(null);
      setPlayerDetails(null);
      setDetailsError(null);
    }
    setSelectedIds([]);
    toast.success("Usunięto zaznaczonych zawodników z listy (tylko lokalnie).");
  };

  const loadPlayerDetails = async (player: TmPlayerRow) => {
    if (!player.player_path) {
      toast.error("Brak ścieżki TM dla tego zawodnika");
      return;
    }

    setSelectedPlayer(player);
    setPlayerDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25000);

    try {
      const url = `${TM_DETAILS_ENDPOINT}?path=` + encodeURIComponent(player.player_path);

      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      const text = await res.text();

      if (!res.ok) {
        let errMsg = "";
        try {
          const parsed = JSON.parse(text);
          errMsg = parsed?.error || "";
        } catch {
          // ignore
        }
        throw new Error(errMsg || text || `HTTP ${res.status} przy pobieraniu detali TM`);
      }

      let json: PlayerDetailsResponse | null = null;
      try {
        json = text ? (JSON.parse(text) as PlayerDetailsResponse) : null;
      } catch {
        throw new Error("Nieprawidłowy JSON z endpointu detali TM");
      }

      if (!json) {
        setDetailsError("Endpoint nie zwrócił danych JSON.");
        return;
      }

      setPlayerDetails(json);
    } catch (e: any) {
      console.error("[TM DETAILS ERROR]", e);
      const msg =
        e?.name === "AbortError"
          ? "Timeout podczas pobierania detali TM"
          : e?.message || "Nie udało się pobrać detali zawodnika z TM";
      setDetailsError(msg);
      toast.error(msg);
    } finally {
      window.clearTimeout(timeoutId);
      setDetailsLoading(false);
    }
  };

  const renderParsedTable = (table?: ParsedTable | null) => {
    if (!table) {
      return (
        <div className="text-[11px] text-muted-foreground">
          Brak danych w tej zakładce (lub tabela nie została rozpoznana).
        </div>
      );
    }

    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead className="bg-stone-100 text-[11px] font-semibold text-stone-700 dark:bg-neutral-900 dark:text-neutral-200">
            <tr>
              {table.headers.map((h, idx) => (
                <th
                  key={`${h}-${idx}`}
                  className="border-b border-stone-200 px-2 py-1 text-left dark:border-neutral-800"
                >
                  {h || "—"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 && (
              <tr>
                <td
                  colSpan={table.headers.length || 1}
                  className="px-2 py-2 text-center text-xs text-muted-foreground"
                >
                  Brak wierszy w tabeli.
                </td>
              </tr>
            )}
            {table.rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="border-b border-dashed border-stone-200 last:border-b-0 dark:border-neutral-800"
              >
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2 py-1 align-top text-[11px]">
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const facts = useMemo<ParsedFacts | null>(() => {
    const blob = playerDetails?.profile?.main_position;
    return parseFactsBlob(blob);
  }, [playerDetails?.profile?.main_position]);

  const shortPosition: string | null = useMemo(() => {
    if (facts?.position) return facts.position;
    const mainPos = playerDetails?.profile?.main_position;
    if (mainPos && mainPos.length < 40) return mainPos;
    return selectedPlayer?.position || null;
  }, [facts?.position, playerDetails?.profile?.main_position, selectedPlayer]);

  const renderDetailsRow = (rowPlayer: TmPlayerRow, isRowDetailsLoading: boolean) => {
    if (!selectedPlayer || selectedPlayer.tm_player_id !== rowPlayer.tm_player_id) return null;

    return (
      <tr className="border-t border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/70 dark:bg-emerald-950/20">
        <td colSpan={10} className="p-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3 text-[11px] text-card-foreground shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-[220px] flex-1 items-start gap-3">
                {playerDetails?.profile?.portrait_url && (
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-emerald-200 bg-white dark:border-emerald-800 dark:bg-neutral-900">
                    <img
                      src={playerDetails.profile.portrait_url}
                      alt={playerDetails.profile.name || selectedPlayer.player_name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold ring-1 ring-emerald-200 dark:bg-neutral-950 dark:ring-emerald-800">
                      {selectedPlayer.player_name}
                    </span>
                    {shortPosition && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-700">
                        {shortPosition}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    {facts?.currentClub ||
                      playerDetails?.profile?.current_club ||
                      selectedPlayer.club_name ||
                      "Bez klubu"}{" "}
                    • {selectedPlayer.competition_name || "—"}
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    {selectedPlayer.age !== null && (
                      <>
                        Wiek: {selectedPlayer.age}
                        {facts?.birth && facts.birth.includes("(") && (
                          <> ({facts.birth.split("(")[1]?.replace(")", "")})</>
                        )}
                      </>
                    )}
                    {selectedPlayer.date_of_birth && <> • ur. {selectedPlayer.date_of_birth}</>}
                    {!selectedPlayer.date_of_birth && facts?.birth && (
                      <> • ur. {facts.birth.split("(")[0]?.trim()}</>
                    )}
                  </div>

                  {(facts?.birthPlace || facts?.citizenship) && (
                    <div className="text-[11px] text-muted-foreground">
                      {facts?.birthPlace && <>Miejsce ur.: {facts.birthPlace}</>}
                      {facts?.birthPlace && facts?.citizenship && " • "}
                      {facts?.citizenship && <>Obywatelstwo: {facts.citizenship}</>}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
               <div className="flex flex-wrap items-center gap-2">
  {selectedPlayer.player_path && (
    <a
      href={openTmUrl(selectedPlayer.player_path) ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-neutral-900 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
    >
      <ExternalLink className="mr-1 h-3 w-3" />
      Otwórz profil TM
    </a>
  )}

  {isRowDetailsLoading && (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-100 dark:ring-emerald-800">
      <Loader2 className="h-3 w-3 animate-spin" />
      Ładowanie detali TM…
    </span>
  )}
</div>


                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {(facts?.height || typeof playerDetails?.profile?.height_cm === "number") && (
                    <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-800">
                      {typeof playerDetails?.profile?.height_cm === "number"
                        ? `${playerDetails.profile.height_cm} cm`
                        : facts?.height}
                    </span>
                  )}

                  {(facts?.foot || playerDetails?.profile?.foot) && (
                    <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-800">
                      Noga:{" "}
                      {(facts?.foot || playerDetails?.profile?.foot || "")
                        .toString()
                        .toLowerCase()
                        .replace("right", "prawa")
                        .replace("left", "lewa")}
                    </span>
                  )}

                  {(facts?.agent || playerDetails?.profile?.agent) && (
                    <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-800">
                      Agent: {facts?.agent || playerDetails?.profile?.agent}
                    </span>
                  )}

                  {typeof playerDetails?.profile?.market_value_eur === "number" && (
                    <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-800">
                      MV: {playerDetails.profile.market_value_eur.toLocaleString("de-DE")} €
                    </span>
                  )}

                  {(facts?.contractExpires ||
                    playerDetails?.profile?.contract_until_text ||
                    selectedPlayer.contract_until) && (
                    <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-800">
                      Umowa do:{" "}
                      {facts?.contractExpires ||
                        playerDetails?.profile?.contract_until_text ||
                        selectedPlayer.contract_until}
                    </span>
                  )}

                  {facts?.joined && (
                    <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-800">
                      W klubie od: {facts.joined}
                    </span>
                  )}

                  {facts?.lastExtension && (
                    <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-800">
                      Ostatnie przedłużenie: {facts.lastExtension}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {detailsError && (
              <div className="mb-2 flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900">
                <AlertTriangle className="h-3 w-3" />
                {detailsError}
              </div>
            )}

            {!detailsLoading && !playerDetails && !detailsError && (
              <div className="text-[11px] text-muted-foreground">
                Brak danych szczegółowych (endpoint nie zwrócił JSON). Sprawdź, czy działa{" "}
                <code>/api/tm/player/details</code>.
              </div>
            )}

            {playerDetails && (
              <Tabs defaultValue="currentSeason" className="mt-1 w-full text-xs">
                <TabsList className="mb-2 flex flex-wrap gap-1 bg-emerald-100/60 p-1 text-[11px] text-muted-foreground/70 dark:bg-emerald-950/40">
                  <TabsTrigger value="currentSeason">Current season</TabsTrigger>
                  <TabsTrigger value="allSeasons">All seasons</TabsTrigger>
                  <TabsTrigger value="byClub">Stats by club</TabsTrigger>
                  <TabsTrigger value="injuries">Injury history</TabsTrigger>
                  <TabsTrigger value="marketValue">Market value</TabsTrigger>
                </TabsList>

                <TabsContent value="currentSeason" className="mt-0">
                  {renderParsedTable(playerDetails.tables?.["statsCurrentSeason"])}
                </TabsContent>
                <TabsContent value="allSeasons" className="mt-0">
                  {renderParsedTable(playerDetails.tables?.["statsAllSeasons"])}
                </TabsContent>
                <TabsContent value="byClub" className="mt-0">
                  {renderParsedTable(playerDetails.tables?.["statsByClub"])}
                </TabsContent>
                <TabsContent value="injuries" className="mt-0">
                  {renderParsedTable(playerDetails.tables?.["injuryHistory"])}
                </TabsContent>
                <TabsContent value="marketValue" className="mt-0">
                  {renderParsedTable(playerDetails.tables?.["marketValue"])}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5">
      <Card className="border-gray-200 bg-white/80 p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-950/80">
        <CardHeader className="flex flex-col gap-3 p-0 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex h-6 items-center rounded-md bg-stone-100 px-2.5 text-[11px] font-medium uppercase tracking-wide text-stone-600 dark:bg-neutral-900 dark:text-neutral-200">
                Krok 2 · Scraper Transfermarkt
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4" />
                Scraper zawodników (Transfermarkt – kraj / sezon)
              </div>

              {downloadedAt && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                    Ostatni zapis w bazie TM: {new Date(downloadedAt).toLocaleString("pl-PL")}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                Rozgrywek: {stats.competitions}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                Klubów: {stats.clubs}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                Zawodników (w bazie): {stats.players}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                Widoczne po filtrach: {visible}/{totalAll}
              </span>
              {selectedCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900">
                  Zaznaczonych: {selectedCount}
                </span>
              )}
              {loading && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Ładowanie z bazy TM…
                </span>
              )}
              {totalPages && (
                <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-800">
                  Strona {page} z {totalPages}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="h-8 px-3 text-xs">
                <Link href="/admin/scraper/data">Historia pobrań</Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="mt-3 space-y-3 p-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-muted-foreground">Kraj (ID TM)</label>
              <Input
                className="h-8 w-20 text-xs"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                onBlur={() => void loadPlayers({ page: 1 })}
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-muted-foreground">Sezon</label>
              <Input
                className="h-8 w-20 text-xs"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                onBlur={() => void loadPlayers({ page: 1 })}
                disabled={loading}
              />
            </div>

            <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filtruj po nazwie / klubie…"
                  className="h-8 pl-7 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearch("")}
                disabled={!search || loading}
                className="h-8 px-2 text-[11px]"
              >
                Wyczyść
              </Button>
            </div>

            <div className="w-full border-t pt-2" />

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Rozgrywki:</span>
                <select
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-[11px] dark:border-neutral-700 dark:bg-neutral-900"
                  value={competitionFilter}
                  onChange={(e) => setCompetitionFilter(e.target.value)}
                  disabled={loading}
                >
                  <option value="all">Wszystkie</option>
                  {competitionOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] text-muted-foreground">Pozycja:</span>
                {(["all", "GK", "DF", "MF", "FW", "other"] as PosFilter[]).map((key) => {
                  const label =
                    key === "all" ? "Wszystkie" : key === "other" ? "Inne" : key;
                  const active = posFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPosFilter(key)}
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/70 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full border-t pt-2" />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-[11px]"
                onClick={() => void loadPlayers({ page: 1 })}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Odśwież z bazy
              </Button>

              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-[11px]"
                onClick={() => void loadPlayers({ page: Math.max(1, page - 1) })}
                disabled={loading || !totalPages || page <= 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Poprzednia strona
              </Button>

              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-[11px]"
                onClick={() =>
                  void loadPlayers({
                    page: totalPages && page < totalPages ? page + 1 : page,
                  })
                }
                disabled={loading || !totalPages || page >= (totalPages ?? 1)}
              >
                Następna strona
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-[11px]"
                onClick={selectAllVisible}
                disabled={!visible || loading}
              >
                <CopyCheck className="h-3.5 w-3.5" />
                Zaznacz widocznych
              </Button>

              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-[11px]"
                onClick={clearSelection}
                disabled={!selectedCount || loading}
              >
                <XCircle className="h-3.5 w-3.5" />
                Wyczyść zaznaczenie
              </Button>

              <Button
                variant="outline"
                className="h-8 gap-1.5 px-3 text-[11px] text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                onClick={deleteSelected}
                disabled={!selectedCount || loading}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Usuń zaznaczonych (tylko z listy)
              </Button>

              <Button
                className="h-8 gap-1.5 bg-emerald-600 px-3 text-[11px] text-white hover:bg-emerald-500"
                onClick={() => void saveSelectedOrVisible()}
                disabled={saving || !visible}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Zapisywanie…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Zapisz {selectedCount ? "zaznaczonych" : "wszystkich widocznych"} do global_players
                  </>
                )}
              </Button>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 p-2 text-[11px] text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900">
              <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {lastMsg && !errorMsg && (
            <div className="mt-2 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900">
              {lastMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista klubów + boczny podgląd */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-gray-200 bg-white/80 p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-950/80">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Lista klubów (z aktualnego filtra)</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] dark:bg-neutral-800">
              {clubsAgg.length}
            </span>
          </CardTitle>

          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto text-[12px]">
            {clubsAgg.length === 0 && (
              <div className="text-muted-foreground">Brak klubów w aktualnym widoku.</div>
            )}

            {clubsAgg.map((c) => (
              <button
                key={c.club_name}
                type="button"
                onClick={() => setSidebarClub(c.club_name || "Bez klubu")}
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-stone-100 dark:hover:bg-neutral-800"
              >
                <span className="truncate">{c.club_name || "Bez klubu"}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {c.playersCount} {c.playersCount === 1 ? "zawodnik" : "zawodników"}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="border-gray-200 bg-white/80 p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-950/80">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {sidebarClub && (
                <button
                  type="button"
                  onClick={() => setSidebarClub(null)}
                  className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  <ChevronLeft className="mr-1 h-3 w-3" />
                  Wróć do wszystkich
                </button>
              )}
              <span>Lista zawodników{sidebarClub ? ` – ${sidebarClub}` : " (alfabetycznie)"}</span>
            </div>

            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] dark:bg-neutral-800">
              {sidebarPlayers.length}
            </span>
          </CardTitle>

          <div className="mt-2 max-h-64 overflow-y-auto text-[12px]">
            {sidebarPlayers.length === 0 && (
              <div className="text-muted-foreground">Brak zawodników w aktualnym widoku.</div>
            )}

            {sidebarPlayers.map((p) => (
              <div
                key={p.tm_player_id}
                className="flex items-center justify-between gap-2 border-b border-dashed border-stone-200 py-1 last:border-b-0 dark:border-neutral-800"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.player_name || "—"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {p.club_name || "—"}
                    {p.position && ` • ${p.position}`}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] text-muted-foreground">{p.age ?? ""}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tabela TM z akordeonem klubów + wierszem detali */}
      <Card className="border-gray-200 bg-stone-50 p-0 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-stone-100 text-[11px] font-medium text-stone-700 shadow-sm dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="w-[32px] px-2 py-2.5">
                  <div className="flex justify-center">
                    <Checkbox
                      className="h-3.5 w-3.5"
                      checked={allVisibleSelected}
                      onCheckedChange={(v) => (v ? selectAllVisible() : clearSelection())}
                      aria-label="Zaznacz wszystkich widocznych"
                    />
                  </div>
                </th>
                <th className="p-2.5 text-left">Rozgrywki</th>
                <th className="p-2.5 text-left">Klub</th>
                <th className="p-2.5 text-left">Zawodnik</th>
                <th className="p-2.5 text-left hidden sm:table-cell">Pozycja</th>
                <th className="p-2.5 text-left hidden sm:table-cell">Wiek</th>
                <th className="p-2.5 text-left hidden md:table-cell">Narodowość</th>
                <th className="p-2.5 text-left hidden md:table-cell">Data ur.</th>
                <th className="p-2.5 text-left hidden lg:table-cell">Kontrakt do</th>
                <th className="p-2.5 text-right">Akcje</th>
              </tr>
            </thead>

            <tbody>
              {loading && !rows.length && (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ładowanie danych z bazy TM…
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                groupedByClub.map((group) => {
                  const comps = Array.from(group.competitions.values());
                  const keyName = group.club_name || "Bez klubu";
                  const isCollapsed = !!collapsedClubs[keyName];

                  return (
                    <React.Fragment key={`club-${keyName}`}>
                      {/* CLUB HEADER */}
                      <tr className="border-t border-stone-200 bg-stone-100/80 text-[11px] font-semibold uppercase tracking-wide text-stone-700 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-200">
                        <td colSpan={10} className="p-0">
                          <button
                            type="button"
                            onClick={() => toggleClubCollapsed(keyName)}
                            className="flex w-full items-center justify-between px-2.5 py-2 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-stone-700 shadow-sm ring-1 ring-stone-200 dark:bg-neutral-950 dark:text-neutral-100 dark:ring-neutral-700">
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform ${
                                    isCollapsed ? "-rotate-90" : "rotate-0"
                                  }`}
                                />
                              </span>

                              <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-700">
                                {group.club_name || "Bez klubu"}
                              </span>

                              <span className="text-[11px] text-muted-foreground">
                                Zawodników: {group.players.length}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {comps.map((c) => (
                                <span
                                  key={c}
                                  className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-700"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </button>
                        </td>
                      </tr>

                      {/* CLUB PLAYERS */}
                      {!isCollapsed &&
                        group.players.map((p, idx) => {
                          const tmHref = openTmUrl(p.player_path || undefined);
                          const showClubName = idx === 0;
                          const rowSelected = isSelected(p.tm_player_id);
                          const isRowDetailsLoading =
                            detailsLoading && selectedPlayer?.tm_player_id === p.tm_player_id;

                          return (
                            <React.Fragment key={p.tm_player_id}>
                              <tr
                                className={[
                                  "border-t border-gray-200 align-top transition-colors dark:border-neutral-800",
                                  rowSelected
                                    ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                                    : "hover:bg-stone-50 dark:hover:bg-neutral-900",
                                ].join(" ")}
                              >
                                <td className="px-2 py-2.5 align-middle">
                                  <div className="flex justify-center">
                                    <Checkbox
                                      className="h-3.5 w-3.5"
                                      checked={rowSelected}
                                      onCheckedChange={() => toggleSelect(p.tm_player_id)}
                                      aria-label={`Zaznacz ${p.player_name}`}
                                    />
                                  </div>
                                </td>

                                <td className="p-2.5">
                                  <div className="truncate text-[12px] font-medium">{p.competition_name}</div>
                                  {p.tier_label && (
                                    <div className="mt-0.5 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-stone-200 dark:bg-neutral-950 dark:ring-neutral-700">
                                      {p.tier_label}
                                    </div>
                                  )}
                                </td>

                                <td className="p-2.5">
                                  {showClubName && (
                                    <div className="truncate text-sm text-stone-800 dark:text-neutral-100">
                                      {p.club_name || "—"}
                                    </div>
                                  )}
                                </td>

                                <td className="p-2.5">
                                  <button
                                    type="button"
                                    onClick={() => void loadPlayerDetails(p)}
                                    className="truncate text-left text-sm font-medium text-stone-900 underline-offset-2 hover:underline dark:text-neutral-50"
                                  >
                                    {p.player_name || "—"}
                                  </button>

                                  <div className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">
                                    {p.position && <span>{p.position}</span>}
                                    {p.age !== null && (
                                      <>
                                        {p.position && " • "}
                                        <span>{p.age} lat</span>
                                      </>
                                    )}
                                  </div>
                                </td>

                                <td className="p-2.5 hidden sm:table-cell">
                                  {p.position ? (
                                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800 ring-1 ring-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700">
                                      {p.position}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td className="p-2.5 hidden text-sm text-stone-800 dark:text-neutral-200 sm:table-cell">
                                  {p.age ?? "—"}
                                </td>

                                <td className="hidden p-2.5 text-sm text-stone-800 dark:text-neutral-200 md:table-cell">
                                  {p.nationalities && p.nationalities.length > 0
                                    ? p.nationalities.join(", ")
                                    : "—"}
                                </td>

                                <td className="hidden p-2.5 text-sm text-stone-800 dark:text-neutral-200 md:table-cell">
                                  {p.date_of_birth ? p.date_of_birth : "—"}
                                </td>

                                <td className="hidden p-2.5 text-sm text-stone-800 dark:text-neutral-200 lg:table-cell">
                                  {p.contract_until ? p.contract_until : "—"}
                                </td>

                                <td className="p-2.5 text-right align-middle">
                                  <div className="flex flex-wrap justify-end gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      className="h-7 w-7 border-stone-300 text-[11px] dark:border-neutral-700"
                                      onClick={() => void loadPlayerDetails(p)}
                                      title="Pokaż panel szczegółów TM"
                                    >
                                      {isRowDetailsLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Database className="h-3.5 w-3.5" />
                                      )}
                                    </Button>

                                    {tmHref && (
                                      <Button
                                        asChild
                                        size="icon"
                                        variant="outline"
                                        className="h-7 w-7 border-stone-300 text-[11px] dark:border-neutral-700"
                                        title="Otwórz na Transfermarkt"
                                      >
                                        <a href={tmHref} target="_blank" rel="noreferrer">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      </Button>
                                    )}

                                    {p.player_path && (
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className="hidden h-7 w-7 border-stone-300 text-[11px] sm:inline-flex dark:border-neutral-700"
                                        title="Skopiuj ścieżkę TM"
                                        onClick={() => void copyPath(p.player_path)}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    )}

                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      className="h-7 w-7 border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                                      title="Zapisz tylko tego zawodnika do global_players"
                                      onClick={() => void saveSinglePlayer(p)}
                                      disabled={saving}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </Button>

                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                                      title="Usuń z tej listy (lokalnie)"
                                      onClick={() => deletePlayer(p.tm_player_id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>

                              {renderDetailsRow(p, isRowDetailsLoading)}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  );
                })}

              {!loading && !groupedByClub.length && (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-sm text-muted-foreground">
                    Brak zawodników spełniających podane filtry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
