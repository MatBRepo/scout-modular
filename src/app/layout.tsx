// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import ClientRoot from "./ClientRoot";
import { Inter } from "next/font/google";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "entrisoScouting",
  description: " entrisoScouting zarządzanie graczami",
};

// Inter (self-hosted), with latin-ext for Polish
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
  weight: ["100","200","300","400","500","600","700","800","900"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans min-h-screen bg-white text-gray-900 antialiased dark:bg-neutral-950 dark:text-neutral-100`}
      >
        {/* ===== Background: Aurora Veil (grain-only) ===== */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 hidden md:block [mask-image:radial-gradient(75%_65%_at_50%_35%,black,transparent_90%)]"
        >
          {/* soft radial wash */}
          <div className="absolute inset-0 bg-[radial-gradient(55%_40%_at_50%_-8%,rgba(59,130,246,0.14),transparent_60%)] dark:bg-[radial-gradient(55%_40%_at_50%_-8%,rgba(99,102,241,0.18),transparent_62%)]" />

          {/* ultra-subtle film grain (data-URI, very light) */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.05] mix-blend-soft-light"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27140%27 height=%27140%27 viewBox=%270 0 140 140%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%271%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")',
            }}
          />

          {/* soft edge vignette (barely visible) */}
          <div className="absolute inset-0 bg-[radial-gradient(100%_80%_at_50%_35%,transparent,rgba(0,0,0,0.10))] dark:bg-[radial-gradient(100%_80%_at_50%_35%,transparent,rgba(0,0,0,0.26))] motion-safe:animate-vignette" />
        </div>

        {/* Wrap client subtree in Suspense so useSearchParams() can bail out safely */}
        <Suspense fallback={null}>
          <ClientRoot>
            <Suspense fallback={null}>{children}</Suspense>
          </ClientRoot>
        </Suspense>
      </body>
    </html>
  );
}
