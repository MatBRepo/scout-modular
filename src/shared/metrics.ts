// src/shared/metrics.ts
export type Metric = {
  id: string;        // stable id, do not change in runtime
  key: string;       // short key for internal mapping
  label: string;     // visible label (editable in Manage)
  enabled: boolean;  // show/hide
};
export type MetricGroupKey = "BASE" | "GK" | "DEF" | "MID" | "ATT";
export type MetricsConfig = Record<MetricGroupKey, Metric[]>;

const KEY = "s4s.obs.metrics";

export const DEFAULT_METRICS: MetricsConfig = {
  BASE: [
    { id: "base_decisions", key: "decyzje", label: "Decyzje pod presją — wybór i szybkość decyzji w 1–2 s, minimalizacja strat.", enabled: true },
    { id: "base_firstTouch", key: "pierwszyKontakt", label: "Pierwszy kontakt & utrzymanie — jakość przyjęcia, kierunkowe przyjęcie, ochrona piłki.", enabled: true },
    { id: "base_progression", key: "progresja", label: "Progresja gry — przesuwanie akcji do przodu: podaniem, prowadzeniem lub ruchem (praktyczny „meter gain”).", enabled: true },
    { id: "base_offBall", key: "offBall", label: "Gra bez piłki (skanowanie, pozycjonowanie, pressing) — skan, ustawienie, reakcja po stracie (5 s).", enabled: true },
    { id: "base_duels", key: "pojedynki", label: "Pojedynki & intensywność — 1v1 w ziemi/powietrzu, determinacja, doskok, powroty.", enabled: true },
    { id: "base_dynamics", key: "dynamika", label: "Dynamika & tempo pracy — pierwsze kroki, przyspieszenie, powtarzalność sprintów.", enabled: true },
  ],
  GK: [
    { id: "gk_shot", key: "shot", label: "Shot-stopping & 1v1 — czas reakcji, skracanie kątów.", enabled: true },
    { id: "gk_air", key: "air", label: "Gra w powietrzu & wyjścia — dośrodkowania, timing, chwyt.", enabled: true },
    { id: "gk_feet", key: "feet", label: "Gra nogami & budowanie — decyzje w budowie, długie wznowienia.", enabled: true },
  ],
  DEF: [
    { id: "def_1v1", key: "oneVone", label: "1v1 w defensywie — pozycja ciała, timing, bezfaulowość.", enabled: true },
    { id: "def_air", key: "air", label: "Gra w powietrzu — pozycjonowanie, wygrane główki.", enabled: true },
    { id: "def_build", key: "build", label: "Wyprowadzenie pod pressingiem — odwaga, łamanie linii, diagonale.", enabled: true },
    { id: "def_cross", key: "cross", label: "Dośrodkowanie & wejścia (FB/WB) — jakość i wybór strefy.", enabled: true },
  ],
  MID: [
    { id: "mid_pressRes", key: "pressRes", label: "Odporność na pressing / obrót — gra półobrotem, wyjście z presji.", enabled: true },
    { id: "mid_creation", key: "creation", label: "Kreacja / ostatnie podanie — jakość i timing zagrań kluczowych.", enabled: true },
    { id: "mid_tempoCtrl", key: "tempoCtrl", label: "Kontrola tempa — przyspieszanie/zwalnianie rytmu, wybór trzeciego człowieka.", enabled: true },
  ],
  ATT: [
    { id: "att_lineRun", key: "lineRun", label: "Ruch na linii / atak przestrzeni — timing startów, spalone.", enabled: true },
    { id: "att_finish", key: "finish", label: "Wykończenie — techniki strzału (P/L/głowa), spokój w polu karnym.", enabled: true },
    { id: "att_link", key: "link", label: "Łączenie gry / gra na ścianę — zgrywanie, podwójne akcje.", enabled: true },
  ],
};

export function loadMetrics(): MetricsConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_METRICS;
    const parsed = JSON.parse(raw) as MetricsConfig;
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_METRICS;
  }
}

export function saveMetrics(cfg: MetricsConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
  window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(cfg) }));
}

function mergeWithDefaults(userCfg?: Partial<MetricsConfig>): MetricsConfig {
  const base = DEFAULT_METRICS;
  const out: any = {};
  (Object.keys(base) as MetricGroupKey[]).forEach((g) => {
    const user = userCfg?.[g] || [];
    const map = new Map<string, Metric>();
    base[g].forEach((m) => map.set(m.id, m));
    user.forEach((m) => map.set(m.id, { ...map.get(m.id), ...m } as Metric));
    out[g] = Array.from(map.values());
  });
  return out as MetricsConfig;
}
