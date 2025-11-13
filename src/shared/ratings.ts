// src/shared/ratings.ts

export type RatingAspect = {
  id: string;
  key: string;
  label: string;
  tooltip?: string;
  enabled: boolean;
};

export type RatingsConfig = RatingAspect[];

const STORAGE_KEY = "s4s.playerRatings.v1";

const DEFAULT_RATINGS: RatingsConfig = [
  {
    id: "r-phys",
    key: "phys",
    label: "Atrybuty fizyczne",
    tooltip: "Szybkość, dynamika, siła, wytrzymałość, skoczność.",
    enabled: true,
  },
  {
    id: "r-mental",
    key: "mental",
    label: "Atrybuty mentalno-behawioralne",
    tooltip: "Nastawienie, koncentracja, reakcja na stres, zaangażowanie.",
    enabled: true,
  },
  {
    id: "r-tech",
    key: "tech",
    label: "Atrybuty techniczne",
    tooltip: "Prowadzenie, przyjęcie, podanie, strzał, drybling.",
    enabled: true,
  },
  {
    id: "r-tactic",
    key: "tactic",
    label: "Atrybuty taktyczne",
    tooltip: "Ustawienie, czytanie gry, decyzje, fazy przejściowe.",
    enabled: true,
  },
  {
    id: "r-sfg-att",
    key: "sfg_attack",
    label: "Stałe fragmenty w ataku",
    tooltip: "Wykonanie i udział przy SFG ofensywnych (rogi, wolne, wrzutki).",
    enabled: true,
  },
  {
    id: "r-sfg-def",
    key: "sfg_defense",
    label: "Stałe fragmenty w obronie",
    tooltip: "Organizacja i zachowania przy stałych fragmentach przeciwnika.",
    enabled: true,
  },
];

export function loadRatings(): RatingsConfig {
  if (typeof window === "undefined") {
    return DEFAULT_RATINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RATINGS;
    const parsed = JSON.parse(raw) as RatingsConfig;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_RATINGS;
    return parsed;
  } catch {
    return DEFAULT_RATINGS;
  }
}

export function saveRatings(cfg: RatingsConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    // wymuszenie odświeżenia w innych zakładkach / komponentach
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(cfg) })
    );
  } catch {
    // ignore
  }
}

// Przyda się do generowania nowych ID w konfiguratorze
export function safeRatingId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `r-${Math.random().toString(36).slice(2)}`;
  }
}

// Sanitizer dla key – może się przydać też w konfiguratorze
export function slugRatingKey(s: string) {
  const base = s.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-");
  return base || `rating-${Math.random().toString(36).slice(2, 7)}`;
}
