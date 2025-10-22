// src/shared/ui/StarRating.tsx
"use client";

import { useId } from "react";
import { Star } from "lucide-react";

type Props = {
  value: number;             // 1..6
  onChange: (v: number) => void;
  max?: number;              // default 6
  size?: number;             // px, default 18
  readOnly?: boolean;
  className?: string;
  label?: string;            // optional aria-label
};

export default function StarRating({
  value,
  onChange,
  max = 6,
  size = 18,
  readOnly,
  className = "",
  label = "Ocena w gwiazdkach",
}: Props) {
  const id = useId();
  const v = Math.max(0, Math.min(max, value || 0));

  return (
    <div className={`inline-flex items-center gap-1 ${className}`} role="radiogroup" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const filled = n <= v;
        return (
          <button
            key={`${id}-${n}`}
            type="button"
            role="radio"
            aria-checked={filled && n === v}
            disabled={readOnly}
            onClick={() => !readOnly && onChange(n)}
            className={`rounded p-0.5 transition focus-visible:outline-none focus-visible:ring focus-visible:ring-indigo-500/60 ${
              readOnly ? "cursor-default" : "cursor-pointer hover:scale-105 active:scale-95"
            }`}
            title={`${n}/${max}`}
          >
            <Star
              width={size}
              height={size}
              className={filled ? "fill-amber-400 stroke-amber-500" : "stroke-gray-400"}
            />
          </button>
        );
      })}
    </div>
  );
}