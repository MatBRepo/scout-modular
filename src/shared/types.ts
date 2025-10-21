export type ScoutId = string;
export type Player = {
  id: number;
  name: string;
  pos: "GK" | "DF" | "MF" | "FW" | "RB" | "CB" | "?" | "CW" | "LW" | "CM";
  club: string;
  age: number;
  status: "active" | "trash";
  // optional fields
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  nationality?: string;
  /** NEW: optional photo URL/base64 */
  photo?: string;
};
export type Observation = {
  id: number;
  player: string;
  match: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  status: "draft" | "final";
};
