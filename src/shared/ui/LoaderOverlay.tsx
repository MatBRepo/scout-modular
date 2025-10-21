"use client";

export default function LoaderOverlay({
  text = "Ładowanie kokpitu…",
}: { text?: string }) {
  return (
    <div
      className="
        fixed inset-0 z-[200]
        grid place-items-center gap-3
        bg-white/75 backdrop-blur-sm
        dark:bg-neutral-950/75
      "
      role="status"
      aria-live="polite"
    >
      {/* Inline SVG icon (animated) */}
      <div className="flex items-center justify-center rounded-full border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <svg
          className="h-6 w-6 animate-spin text-gray-800 dark:text-neutral-200"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            d="M13.5867 2.30659L10.6667 1.33325C10.6667 2.0405 10.3857 2.71877 9.88565 3.21887C9.38555 3.71897 8.70727 3.99992 8.00003 3.99992C7.29278 3.99992 6.61451 3.71897 6.11441 3.21887C5.61431 2.71877 5.33336 2.0405 5.33336 1.33325L2.41336 2.30659C2.11162 2.40711 1.85575 2.6122 1.69193 2.88481C1.52811 3.15743 1.46715 3.47963 1.52003 3.79325L1.90669 6.10659C1.93208 6.26319 2.01248 6.40562 2.13345 6.50826C2.25443 6.61091 2.40804 6.66704 2.56669 6.66659H4.00003V13.3333C4.00003 14.0666 4.60003 14.6666 5.33336 14.6666H10.6667C11.0203 14.6666 11.3595 14.5261 11.6095 14.2761C11.8596 14.026 12 13.6869 12 13.3333V6.66659H13.4334C13.592 6.66704 13.7456 6.61091 13.8666 6.50826C13.9876 6.40562 14.068 6.26319 14.0934 6.10659L14.48 3.79325C14.5329 3.47963 14.4719 3.15743 14.3081 2.88481C14.1443 2.6122 13.8884 2.40711 13.5867 2.30659Z"
            stroke="currentColor"
            strokeWidth="0.222"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
      <div className="text-sm text-gray-700 dark:text-neutral-300">{text}</div>
    </div>
  );
}
