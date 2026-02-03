"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/shared/supabase-client";

export default function AuthFinishPage() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    const run = async () => {
      const started = Date.now();
      const timeoutMs = 2200;

      while (alive && Date.now() - started < timeoutMs) {
        const { data, error } = await supabase.auth.getSession();

        // jak sesja już jest -> lecimy do appki
        if (!error && data?.session) {
          router.replace("/");
          return;
        }

        // mała pauza i ponów
        await new Promise((r) => setTimeout(r, 150));
      }

      // fallback: jak sesji dalej brak, wróć na login z parametrem
      router.replace("/login?e=session_missing");
    };

    run();

    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-100 text-stone-900 dark:bg-slate-950 dark:text-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.16),transparent_60%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-3">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-sm rounded-md bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.18)] ring-1 ring-stone-200/80 backdrop-blur-xl dark:bg-slate-950/70 dark:ring-stone-800/80"
        >
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10">
              <motion.div className="absolute inset-0 rounded-md border border-stone-300/70 dark:border-stone-700/70" />
              <motion.div
                className="absolute inset-0 rounded-md border-2 border-stone-900/80 dark:border-stone-100/80"
                style={{
                  borderRightColor: "transparent",
                  borderBottomColor: "transparent",
                }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              />
              <motion.div
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.1,
                  ease: "easeInOut",
                }}
              />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
                kończenie logowania
              </p>
              <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-50">
                Chwilka… ustawiamy Twoją sesję
              </p>
              <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-300">
                Zaraz przeniesiemy Cię do panelu.
              </p>
            </div>
          </div>

          <div className="mt-4 h-1.5 w-full rounded-md bg-stone-200 dark:bg-stone-800">
            <motion.div
              className="h-1.5 rounded-md bg-stone-900 dark:bg-stone-100"
              initial={{ width: "10%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.85, ease: "easeOut" }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400">
            <span>entrisoScouting</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              OAuth
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
