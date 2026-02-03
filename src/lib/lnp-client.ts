// lib/lnp-client.ts
export type LnpSex = "Male" | "Female";

export type LnpSeason = { id: string; name: string; isCurrent: boolean };
export type LnpLeague = { group?: string; league: string; league_id: string };
export type LnpPlay = { id: string; name: string };
export type LnpTeam = { team: string; team_id: string; points?: number | null };
export type LnpPlayer = {
  player_id: string;
  firstname: string;
  lastname: string;
  name?: string | null;
  number?: string | number | null;
  position?: string | null;
  club?: string | null;
};

function base() {
  // set NEXT_PUBLIC_LNP_API_BASE=http://localhost:8000 (or your deployed URL)
  return (process.env.NEXT_PUBLIC_LNP_API_BASE || "").replace(/\/$/, "");
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const lnp = {
  seasons: (sex: LnpSex) => j<LnpSeason[]>(`${base()}/seasons?sex=${sex}`),
  leagues: (sex: LnpSex, seasonId: string) =>
    j<LnpLeague[]>(
      `${base()}/leagues?sex=${sex}&seasonId=${encodeURIComponent(seasonId)}`
    ),
  plays: (sex: LnpSex, seasonId: string, leagueId: string) =>
    j<LnpPlay[]>(
      `${base()}/plays?sex=${sex}&seasonId=${encodeURIComponent(
        seasonId
      )}&leagueId=${encodeURIComponent(leagueId)}`
    ),
  teams: (sex: LnpSex, playId: string) =>
    j<LnpTeam[]>(
      `${base()}/teams?sex=${sex}&playId=${encodeURIComponent(playId)}`
    ),
  players: (sex: LnpSex, teamId: string) =>
    j<LnpPlayer[]>(
      `${base()}/players?sex=${sex}&teamId=${encodeURIComponent(teamId)}`
    ),
};
