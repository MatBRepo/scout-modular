// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import ClientRoot from "./ClientRoot";
import AuthGate from "../shared/auth/AuthGate";
import ScrollToTop from "./ScrollToTop";
import { DM_Sans } from "next/font/google";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "entrisoScouting",
  description: "entrisoScouting zarządzanie graczami",
};

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${dmSans.variable} font-sans min-h-screen bg-white text-gray-900 antialiased dark:bg-neutral-950 dark:text-neutral-100`}
      >
        {/* Globalny root na modale – wszystko portaluje się tutaj */}
        <div id="global-modal-root" />

        <Suspense fallback={null}>
          <AuthGate>
            <ClientRoot>
              {/* przewijanie do góry przy zmianie strony */}
              <ScrollToTop />
              <Suspense fallback={null}>{children}</Suspense>
            </ClientRoot>
          </AuthGate>
        </Suspense>
      </body>
    </html>
  );
}
