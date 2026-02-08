"use client";

import React, { useState } from "react";

import { Crumb, ToolbarFull } from "@/shared/ui/atoms";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import LnpSearchPanel from "./LnpSearchPanel";
import TmScraperPanel from "./TmScraperPanel";

type ViewTab = "lnp" | "tm";

export default function GlobalSearchPage() {
  const [tab, setTab] = useState<ViewTab>("lnp");

  const pageTitle = (
    <div className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 dark:text-neutral-50">
            Globalna baza zawodników
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-neutral-400">
            Importuj zawodników z LNP lub Transfermarkt do swojej bazy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-stone-400 sm:inline">
            ŹRÓDŁO DANYCH
          </span>

          <Tabs value={tab} onValueChange={(v) => setTab(v as ViewTab)} className="w-auto">
            <TabsList className="relative inline-flex h-11 items-center gap-1 rounded border border-stone-200/60 bg-white/40 p-1.5 backdrop-blur-md dark:border-neutral-800/60 dark:bg-neutral-950/40">
              <TabsTrigger
                value="lnp"
                className="relative z-10 rounded px-6 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-stone-900 data-[state=active]:text-white data-[state=active]:shadow-lg dark:data-[state=active]:bg-neutral-50 dark:data-[state=active]:text-neutral-900"
              >
                LNP
              </TabsTrigger>
              <TabsTrigger
                value="tm"
                className="relative z-10 rounded px-6 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-stone-900 data-[state=active]:text-white data-[state=active]:shadow-lg dark:data-[state=active]:bg-neutral-50 dark:data-[state=active]:text-neutral-900"
              >
                Transfermarkt
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-4">
      <div>
        <Crumb
          items={[
            { label: "Start", href: "/" },
            { label: "Zawodnicy", href: "/players" },
            { label: "Import globalny" },
          ]}
        />
      </div>

      <div className="relative overflow-hidden rounded border border-stone-200/60 bg-white/40 p-6 backdrop-blur-xl dark:border-neutral-800/60 dark:bg-neutral-950/40">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded bg-indigo-500/5 blur-[100px]" />
        <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded bg-emerald-500/5 blur-[100px]" />

        <div className="relative z-10">
          <ToolbarFull title={pageTitle} right={null} />
        </div>
      </div>

      <div className="space-y-4">
        {tab === "lnp" ? <LnpSearchPanel /> : <TmScraperPanel />}
      </div>
    </div>
  );
}
