// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import ClientRoot from "./ClientRoot";

export const metadata: Metadata = {
  title: "S4S Modular",
  description: "Modular features demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {/* ===== Background (server-rendered only) ===== */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden md:block">
          {/* Radial glow (top) */}
          <div className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_-10%,rgba(59,130,246,0.16),transparent_60%)] dark:bg-[radial-gradient(60%_45%_at_50%_-10%,rgba(99,102,241,0.20),transparent_65%)]" />
          {/* Color blobs (very subtle) */}
          <div className="absolute left-[15%] top-[25%] h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/10" />
          <div className="absolute right-[10%] top-[40%] h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl dark:bg-emerald-500/10" />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:28px_28px] [color:#0f172a] dark:[color:#e5e7eb]" />
          {/* Soft vignette edges */}
          <div className="absolute inset-0 [mask-image:radial-gradient(65%_65%_at_50%_35%,black,transparent_85%)]" />
        </div>

        {/* Skip link (a11y) */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow dark:focus:bg-neutral-900"
        >
          Przejdź do treści
        </a>

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
