"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  Users,
  Target,
  Calendar,
  MapPin,
  Activity,
  TrendingUp,
  Info
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/shared/supabase-client";

/* =================== TYPES & HELPERS =================== */

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
  main_position?: string;
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
    "Name in home country", "Date of birth/Age", "Place of birth", "Height",
    "Citizenship", "Position", "Foot", "Player agent", "Current club",
    "Joined", "Contract expires", "Last contract extension"
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
    return text.slice(from, end).trim() || null;
  };

  return {
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
}

const TM_DETAILS_ENDPOINT = "/api/tm/player/details";
const TM_PAGE_SIZE = 100;

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

/* =================== MAIN COMPONENT =================== */

export default function TmScraperPanel() {
  const [country, setCountry] = useState("135");
  const [season, setSeason] = useState("2025");
  const [rows, setRows] = useState<TmPlayerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [stats, setStats] = useState({ competitions: 0, clubs: 0, players: 0 });
  const [downloadedAt, setDownloadedAt] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<TmPlayerRow | null>(null);
  const [playerDetails, setPlayerDetails] = useState<PlayerDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const loadPlayers = async (opts?: { page?: number }) => {
    const targetPage = opts?.page ?? 1;
    setLoading(true);
    setSelectedIds([]);
    setSelectedPlayer(null);
    setPlayerDetails(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const from = (targetPage - 1) * TM_PAGE_SIZE;
      const to = from + TM_PAGE_SIZE - 1;

      let query = supabase
        .from("tm_flat_competition_players")
        .select("*", { count: "exact" })
        .range(from, to);

      if (country && country.toLowerCase() !== "all") query = query.eq("country_id", country.trim());
      if (season && season.toLowerCase() !== "all") {
        const sNum = Number.parseInt(season.trim(), 10);
        if (!Number.isNaN(sNum)) query = query.eq("season_id", sNum);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const list = (data || []) as TmPlayerRow[];
      setRows(list);
      setPage(targetPage);
      setTotalRows(count);

      // Simple stats from current batch
      const comps = new Set(list.map(p => p.competition_name));
      const clubs = new Set(list.map(p => p.club_name));
      setStats({
        competitions: comps.size,
        clubs: clubs.size,
        players: count ?? list.length
      });

      if (list.length > 0) {
        const latest = list.reduce((max, curr) =>
          curr.downloaded_at && (!max || new Date(curr.downloaded_at) > new Date(max)) ? curr.downloaded_at : max,
          list[0].downloaded_at
        );
        setDownloadedAt(latest);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers({ page: 1 });
  }, []);

  const competitionOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(p => p.competition_name && set.add(p.competition_name));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
  }, [rows]);

  const filtered = useMemo(() => {
    let data = [...rows];
    if (competitionFilter !== "all") data = data.filter(p => p.competition_name === competitionFilter);
    if (posFilter !== "all") {
      data = data.filter(p => {
        const pos = (p.position || "").toUpperCase();
        if (posFilter === "GK") return pos.startsWith("GK");
        if (posFilter === "DF") return pos.startsWith("DF") || pos.includes("BACK");
        if (posFilter === "MF") return pos.startsWith("MF") || pos.includes("MIDFIELD");
        if (posFilter === "FW") return pos.startsWith("FW") || pos.includes("STRIKER") || pos.includes("WINGER");
        return true;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      data = data.filter(p =>
        p.player_name.toLowerCase().includes(q) ||
        p.club_name.toLowerCase().includes(q) ||
        (p.competition_name || "").toLowerCase().includes(q)
      );
    }
    return data;
  }, [rows, search, competitionFilter, posFilter]);

  const totalPages = totalRows ? Math.ceil(totalRows / TM_PAGE_SIZE) : null;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllVisible = () => setSelectedIds(filtered.map(p => p.tm_player_id));
  const clearSelection = () => setSelectedIds([]);
  const isSelected = (id: number) => selectedIds.includes(id);

  const loadPlayerDetails = async (player: TmPlayerRow) => {
    if (selectedPlayer?.tm_player_id === player.tm_player_id) {
      setSelectedPlayer(null);
      return;
    }
    setSelectedPlayer(player);
    setPlayerDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const res = await fetch(`${TM_DETAILS_ENDPOINT}?path=${encodeURIComponent(player.player_path || "")}`);
      if (!res.ok) throw new Error("Failed to fetch details");
      const json = await res.json();
      setPlayerDetails(json);
    } catch (e: any) {
      setDetailsError(e.message);
      toast.error(e.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const saveSinglePlayer = async (p: TmPlayerRow) => {
    setSaving(true);
    try {
      const payload = {
        key: `tm:${p.tm_player_id}`,
        name: p.player_name,
        pos: p.position || "UNK",
        age: p.age,
        club: p.club_name,
        source: "tm",
        ext_id: String(p.tm_player_id),
        meta: p,
        added_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("global_players").upsert(payload, { onConflict: "key" });
      if (error) throw error;
      toast.success(`Saved ${p.player_name}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedOrVisible = async () => {
    const targets = selectedIds.length > 0 ? filtered.filter(p => selectedIds.includes(p.tm_player_id)) : filtered;
    if (targets.length === 0) return;
    setSaving(true);
    try {
      const payloads = targets.map(p => ({
        key: `tm:${p.tm_player_id}`,
        name: p.player_name,
        pos: p.position || "UNK",
        age: p.age,
        club: p.club_name,
        source: "tm",
        ext_id: String(p.tm_player_id),
        meta: p,
        added_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("global_players").upsert(payloads, { onConflict: "key" });
      if (error) throw error;
      toast.success(`Imported ${payloads.length} players`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const facts = useMemo(() => playerDetails?.profile?.main_position ? parseFactsBlob(playerDetails.profile.main_position) : null, [playerDetails]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <aside className="space-y-6 lg:col-span-3">
        <div>
          <Card className="rounded overflow-hidden border-stone-200/60 bg-white/70 shadow-xl backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/70">
            <div className="bg-stone-900 px-4 py-3 dark:bg-white">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white dark:text-black">Filtrowanie</h3>
            </div>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-stone-400">Wyszukaj</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    placeholder="Nazwisko, klub, liga..."
                    className="h-9 rounded border-stone-200 bg-white/50 pl-9 text-xs dark:border-neutral-800 dark:bg-neutral-900/50"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-stone-400">Pozycja</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {["all", "GK", "DF", "MF", "FW"].map((pos) => (
                    <Button
                      key={pos}
                      variant={posFilter === pos ? "default" : "outline"}
                      className={`h-8 text-[10px] rounded ${posFilter === pos ? "bg-stone-900 text-white dark:bg-white dark:text-black" : "bg-white/50"}`}
                      onClick={() => setPosFilter(pos)}
                    >
                      {pos === "all" ? "Wszystkie" : pos}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-stone-400">Liga</Label>
                <select
                  className="w-full rounded border border-stone-200 bg-white/50 px-3 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/50"
                  value={competitionFilter}
                  onChange={(e) => setCompetitionFilter(e.target.value)}
                >
                  <option value="all">Wszystkie rozgrywki</option>
                  {competitionOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <Button variant="outline" className="w-full h-9 rounded text-xs" onClick={() => loadPlayers({ page: 1 })}>
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Odśwież
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded border-stone-200/60 bg-white/70 shadow-lg backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/70 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Statystyki</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span>Ligi</span><span className="font-bold">{stats.competitions}</span></div>
            <div className="flex justify-between"><span>Kluby</span><span className="font-bold">{stats.clubs}</span></div>
            <div className="flex justify-between"><span>Razem</span><span className="font-bold">{totalRows ?? 0}</span></div>
          </div>
        </Card>
      </aside>

      <main className="space-y-4 lg:col-span-9 md:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-stone-200/60 bg-white/40 p-4 backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-stone-900 flex items-center justify-center text-white dark:bg-white dark:text-black">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-stone-400">WYNIKI</div>
              <div className="text-lg font-black">{filtered.length} <span className="text-xs font-normal text-stone-400">/ {totalRows || 0}</span></div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAllVisible} className="h-9 rounded text-xs">
              <CopyCheck className="mr-2 h-4 w-4" /> Zaznacz widocznych
            </Button>
            <Button size="sm" onClick={saveSelectedOrVisible} disabled={saving} className="h-9 rounded bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 text-xs">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Importuj ({selectedIds.length || "widocznych"})
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded border border-stone-200/60 bg-white/70 shadow-xl backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/70">
          <table className="w-full text-sm">
            <thead className="bg-stone-100/80 backdrop-blur-md dark:bg-neutral-900/80 border-b">
              <tr className="text-left text-[10px] font-bold uppercase text-stone-400">
                <th className="p-4 w-12"><Checkbox checked={filtered.length > 0 && filtered.every(p => isSelected(p.tm_player_id))} onCheckedChange={c => c ? selectAllVisible() : clearSelection()} /></th>
                <th className="p-4">Zawodnik</th>
                <th className="p-4">Klub / Liga</th>
                <th className="p-4">Wiek</th>
                <th className="p-4">Pozycja</th>
                <th className="p-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-900">
              {filtered.map((p, idx) => (
                <React.Fragment key={p.tm_player_id}>
                  <tr
                    className={`group hover:bg-stone-50/50 dark:hover:bg-neutral-900/50 ${isSelected(p.tm_player_id) ? "bg-stone-100/50" : ""}`}
                  >
                    <td className="p-4"><Checkbox checked={isSelected(p.tm_player_id)} onCheckedChange={() => toggleSelect(p.tm_player_id)} /></td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded bg-stone-100 flex items-center justify-center overflow-hidden border">
                          <img src={p.player_path ? `https://tmssl.akamaized.net/images/portrait/small/${p.tm_player_id}.jpg` : "/placeholder-user.png"} alt="" onError={e => e.currentTarget.src = "/placeholder-user.png"} />
                        </div>
                        <div className="font-bold">{p.player_name}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{p.club_name}</div>
                      <div className="text-[10px] text-stone-400">{p.competition_name}</div>
                    </td>
                    <td className="p-4">{p.age || "—"}</td>
                    <td className="p-4">
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-bold">{p.position || "UNK"}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded" onClick={() => loadPlayerDetails(p)}><Info className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded" onClick={() => saveSinglePlayer(p)}><Database className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                  {selectedPlayer?.tm_player_id === p.tm_player_id && (
                    <tr className="bg-stone-50/30">
                      <td colSpan={6} className="p-0">
                        <div className="overflow-hidden p-6 border-t border-b">
                          {detailsLoading ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-stone-400" /></div>
                          ) : playerDetails ? (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                              <div className="space-y-4">
                                <div className="aspect-square rounded overflow-hidden border-4 border-white shadow-xl">
                                  <img src={playerDetails.profile?.portrait_url || ""} className="w-full h-full object-cover" alt="" />
                                </div>
                                <Button className="w-full h-8 text-xs bg-stone-900 rounded" asChild>
                                  <a href={openTmUrl(p.player_path) || "#"} target="_blank">Profil TM <ExternalLink className="ml-2 h-3 w-3" /></a>
                                </Button>
                              </div>
                              <div className="md:col-span-3 space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {[
                                    { label: "Wiek", val: p.age, icon: Calendar },
                                    { label: "Wzrost", val: playerDetails.profile?.height_cm ? `${playerDetails.profile.height_cm} cm` : "—", icon: Activity },
                                    { label: "Noga", val: playerDetails.profile?.foot || "—", icon: TrendingUp },
                                    { label: "Wycena", val: playerDetails.profile?.market_value_eur ? `€${(playerDetails.profile.market_value_eur / 1000000).toFixed(1)}M` : "—", icon: Target },
                                  ].map((stat, i) => (
                                    <div key={i} className="rounded border bg-white/50 p-3">
                                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400">
                                        <stat.icon className="h-3 w-3" /> {stat.label}
                                      </div>
                                      <div className="mt-1 text-sm font-bold">{stat.val}</div>
                                    </div>
                                  ))}
                                </div>
                                {playerDetails.tables?.["Summary"] && (
                                  <div className="rounded border bg-white overflow-hidden text-[11px]">
                                    <table className="w-full">
                                      <thead className="bg-stone-50 border-b">
                                        <tr>{playerDetails.tables["Summary"].headers.map((h, i) => <th key={i} className="p-2 text-left">{h}</th>)}</tr>
                                      </thead>
                                      <tbody>
                                        {playerDetails.tables["Summary"].rows.map((row, i) => (
                                          <tr key={i} className="border-b last:border-0">
                                            {row.map((cell, j) => <td key={j} className="p-2">{cell}</td>)}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : <div className="p-4 text-center text-rose-500 rounded">{detailsError || "No details found"}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t bg-stone-50/50 flex justify-between items-center text-xs">
            <div className="text-stone-400">Strona <b>{page}</b> z {totalPages || 1}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded" disabled={page <= 1 || loading} onClick={() => loadPlayers({ page: page - 1 })}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="rounded" disabled={!totalPages || page >= totalPages || loading} onClick={() => loadPlayers({ page: page + 1 })}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

