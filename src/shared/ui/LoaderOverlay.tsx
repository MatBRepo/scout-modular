// src/app/LoaderOverlay.tsx
"use client";

import { useEffect, useState } from "react";

export default function LoaderOverlay({
  text = "Ładowanie kokpitu…",
}: { text?: string }) {
  // respect prefers-reduced-motion
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  return (
    <div
      className="
        fixed inset-0 z-[200]
        grid place-items-center
        bg-white/75 backdrop-blur-sm
        dark:bg-neutral-950/75
      "
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center">
        {/* T-shirt animated outline (no frame/border around it) */}
        <svg
          viewBox="0 0 16 16"
          width="56"
          height="56"
          aria-hidden="true"
          className="text-gray-900 dark:text-neutral-100"
        >
          <path
            d="M13.5867 2.30659L10.6667 1.33325C10.6667 2.0405 10.3857 2.71877 9.88565 3.21887C9.38555 3.71897 8.70727 3.99992 8.00003 3.99992C7.29278 3.99992 6.61451 3.71897 6.11441 3.21887C5.61431 2.71877 5.33336 2.0405 5.33336 1.33325L2.41336 2.30659C2.11162 2.40711 1.85575 2.6122 1.69193 2.88481C1.52811 3.15743 1.46715 3.47963 1.52003 3.79325L1.90669 6.10659C1.93208 6.26319 2.01248 6.40562 2.13345 6.50826C2.25443 6.61091 2.40804 6.66704 2.56669 6.66659H4.00003V13.3333C4.00003 14.0666 4.60003 14.6666 5.33336 14.6666H10.6667C11.0203 14.6666 11.3595 14.5261 11.6095 14.2761C11.8596 14.026 12 13.6869 12 13.3333V6.66659H13.4334C13.592 6.66704 13.7456 6.61091 13.8666 6.50826C13.9876 6.40562 14.068 6.26319 14.0934 6.10659L14.48 3.79325C14.5329 3.47963 14.4719 3.15743 14.3081 2.88481C14.1443 2.6122 13.8884 2.40711 13.5867 2.30659Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.22"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={ reduced ? undefined : { strokeDasharray: 120, strokeDashoffset: 120 } }
            className={ reduced ? "" : "animate-[tshirt-draw_1.6s_ease-in-out_infinite]" }
          />
        </svg>

        {/* text directly under the icon */}
        <div className="mt-3 text-sm text-gray-800 dark:text-neutral-200">
          {text}
        </div>
      </div>

      <style jsx>{`
        @keyframes tshirt-draw {
          0%   { stroke-dashoffset: 120; opacity: .92; }
          35%  { stroke-dashoffset: 0;   opacity: 1;   }
          65%  { stroke-dashoffset: 0;   opacity: 1;   }
          100% { stroke-dashoffset: -120; opacity: .96; }
        }
      `}</style>
    </div>
  );
}
