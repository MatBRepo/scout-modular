// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import ClientRoot from "./ClientRoot";
import AuthGate from "../shared/auth/AuthGate";            // <-- DODAJ
import { Inter } from "next/font/google";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "entrisoScouting",
  description: " entrisoScouting zarządzanie graczami",
};

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
        {/* tło możesz zostawić jak miałeś wcześniej */}

        <Suspense fallback={null}>
          <AuthGate>                         {/* <-- TUTAJ */}
            <ClientRoot>
              <Suspense fallback={null}>{children}</Suspense>
            </ClientRoot>
          </AuthGate>
        </Suspense>
      </body>
    </html>
  );
}
