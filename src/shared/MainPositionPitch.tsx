// src/components/MainPositionPitch.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type DetailedPos =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "CDM"
  | "CM"
  | "CAM"
  | "LW"
  | "RW"
  | "ST";

export const POS_DATA: Array<{
  value: DetailedPos;
  code: string;
  name: string;
  desc: string;
}> = [
  {
    value: "GK",
    code: "GK",
    name: "Bramkarz",
    desc: "Odbicia, gra na linii, wyjścia i gra nogami.",
  },
  {
    value: "CB",
    code: "CB",
    name: "Środkowy obrońca",
    desc: "Gra w powietrzu, ustawienie, wyprowadzenie.",
  },
  {
    value: "LB",
    code: "LB",
    name: "Lewy obrońca",
    desc: "Obrona strony, dośrodkowania, wsparcie ataku.",
  },
  {
    value: "RB",
    code: "RB",
    name: "Prawy obrońca",
    desc: "Obrona strony, dośrodkowania, wsparcie ataku.",
  },
  {
    value: "CDM",
    code: "CDM",
    name: "Śr. pomocnik defensywny",
    desc: "Odbiór, asekuracja, pierwsze podanie.",
  },
  {
    value: "CM",
    code: "CM",
    name: "Środkowy pomocnik",
    desc: "Równowaga defensywa/kreacja.",
  },
  {
    value: "CAM",
    code: "CAM",
    name: "Ofensywny pomocnik",
    desc: "Ostatnie podanie, kreacja, strzał.",
  },
  {
    value: "LW",
    code: "LW",
    name: "Lewy pomocnik/skrzydłowy",
    desc: "1v1, dośrodkowania, zejścia do strzału.",
  },
  {
    value: "RW",
    code: "RW",
    name: "Prawy pomocnik/skrzydłowy",
    desc: "1v1, dośrodkowania, zejścia do strzału.",
  },
  {
    value: "ST",
    code: "ST",
    name: "Napastnik",
    desc: "Wykończenie, gra tyłem, ruch w polu karnym.",
  },
];

const POS_LAYOUT: Record<DetailedPos, { top: string; left: string }> = {
  GK: { top: "50%", left: "10%" },

  LB: { top: "22.3%", left: "24.1%" },
  CB: { top: "50%", left: "24.1%" },
  RB: { top: "78%", left: "24.1%" },

  CDM: { top: "50%", left: "36.95%" },
  CM: { top: "50%", left: "49.83%" },
  CAM: { top: "50%", left: "63.05%" },

  LW: { top: "22.3%", left: "63.05%" },
  RW: { top: "78%", left: "63.05%" },

  ST: { top: "50%", left: "76.27%" },
};

type MainPositionPitchProps = {
  value: DetailedPos | "";
  onChange: (next: DetailedPos) => void;
};

export function MainPositionPitch({ value, onChange }: MainPositionPitchProps) {
  const [hovered, setHovered] = useState<DetailedPos | null>(null);

  const activeKey = (hovered || value || null) as DetailedPos | null;
  const activeMeta = activeKey
    ? POS_DATA.find((p) => p.value === activeKey) ?? null
    : null;

  return (
    <section className="mt-2 mb-2 bg-transparent border-none dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-medium text-foreground text-sm">
            Boisko – główna pozycja
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
            Kliknij na znacznik na boisku, aby ustawić główną pozycję zawodnika.
          </p>
        </div>
        {activeMeta && (
          <span className="inline-flex items-center self-start rounded bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700  ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60 hidden">
            {activeMeta.code} · {activeMeta.name}
          </span>
        )}
      </div>

      {/* >>> ZAMIANA tej części za <div ...> w dokumencie <<< */}
      <div className="mx-auto w-full max-w-[700px] rounded border-none bg-transparent">
        <div className="relative w-full overflow-hidden rounded-[20px] bg-[#76C35D] aspect-[4/3] sm:aspect-[590/350]">
          <svg
            viewBox="0 0 590 350"
            className="pointer-events-none absolute inset-0 h-full w-full p-2 sm:p-0"
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="geometricPrecision"
          >
            <rect
              x="18.5139"
              y="16.2588"
              width="274.939"
              height="317.482"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="18.5139"
              y="79.2017"
              width="104.178"
              height="192.55"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="18.5139"
              y="112.58"
              width="47.2579"
              height="124.839"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="8.66235"
              y="112.58"
              width="10.0408"
              height="124.839"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />

            <path
              d="M31.7444 15.2588C31.7444 21.5792 25.9524 26.7031 18.8079 26.7031C18.3711 26.7031 17.9395 26.6819 17.5139 26.6445V15.2588H31.7444Z"
              fill="white"
              fillOpacity="0.1"
            />
            <path
              d="M17.5139 322.344C24.7684 322.344 30.6497 327.39 30.6497 333.614C30.6497 333.995 30.6262 334.37 30.5833 334.741L17.5139 334.741L17.5139 322.344Z"
              fill="white"
              fillOpacity="0.1"
            />

            <rect
              x="-1"
              y="1"
              width="278.223"
              height="317.482"
              transform="matrix(-1 0 0 1 570.486 15.2588)"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="-1"
              y="1"
              width="104.178"
              height="192.55"
              transform="matrix(-1 0 0 1 570.486 78.2017)"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="-1"
              y="1"
              width="47.2579"
              height="124.839"
              transform="matrix(-1 0 0 1 570.486 111.58)"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <rect
              x="-1"
              y="1"
              width="10.0408"
              height="124.839"
              transform="matrix(-1 0 0 1 580.338 111.58)"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />

            <path
              d="M558.256 15.2588C558.256 21.5792 564.048 26.7031 571.192 26.7031C571.629 26.7031 572.06 26.6819 572.486 26.6445V15.2588H558.256Z"
              fill="white"
              fillOpacity="0.1"
            />
            <path
              d="M572.486 322.344C565.232 322.344 559.35 327.39 559.35 333.614C559.35 333.995 559.374 334.37 559.417 334.741L572.486 334.741L572.486 322.344Z"
              fill="white"
              fillOpacity="0.1"
            />

            <path
              d="M122 106.618C139.904 124.296 151 148.852 151 176C151 203.148 139.903 227.703 122 245.381V106.618Z"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <path
              d="M468 106.618C450.096 124.296 439 148.852 439 176C439 203.148 450.097 227.703 468 245.381V106.618Z"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />

            <line
              x1="295"
              y1="16"
              x2="295"
              y2="334"
              stroke="white"
              strokeWidth="1.5"
            />

            <circle cx="496" cy="174" r="1" fill="white" />
            <circle cx="94" cy="174" r="1" fill="white" />
          </svg>

          {POS_DATA.map((pos) => {
            const layout = POS_LAYOUT[pos.value];
            if (!layout) return null;

            const isSelected = value === pos.value;

            return (
              <button
                key={pos.value}
                type="button"
                className={cn(
                  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm transition-transform duration-150",
                  "h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9",
                  isSelected
                    ? "border-2 border-red-500 bg-white text-black shadow-[0_0_0_2px_rgba(248,113,113,0.7)]"
                    : "border-white/80 bg-black text-white hover:scale-[1.05] hover:bg-black/90"
                )}
                style={{ top: layout.top, left: layout.left }}
                onClick={() => onChange(pos.value)}
                onMouseEnter={() => setHovered(pos.value)}
                onMouseLeave={() =>
                  setHovered((prev) => (prev === pos.value ? null : prev))
                }
              >
                {pos.code}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 text-center text-[11px] leading-relaxed text-slate-600 dark:text-neutral-300 sm:text-left">
        {activeMeta ? (
          <>
            <span className="font-semibold">
              {activeMeta.code} – {activeMeta.name}
            </span>
            <span className="ml-1.5 text-slate-600 dark:text-neutral-300">
              {activeMeta.desc}
            </span>
          </>
        ) : (
          <span>
            Najedź na znacznik i kliknij, aby wybrać główną pozycję zawodnika.
          </span>
        )}
      </div>
    </section>
  );
}
