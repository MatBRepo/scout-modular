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
          <h2 className="mt-1 text-xl font-semibold leading-none tracking-tight">
            Globalna baza zawodników – import
          </h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-neutral-400">
            Wyszukuj zawodników w LNP lub bazie Transfermarkt i zapisuj ich do
            tabeli <code className="text-[11px]">global_players</code> w Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
            Źródło danych
          </span>

          <Tabs value={tab} onValueChange={(v) => setTab(v as ViewTab)} className="w-auto">
            <TabsList className="inline-flex gap-1 rounded-md bg-stone-100 p-1 text-[11px] dark:bg-neutral-900">
              <TabsTrigger value="lnp" className="px-2.5 py-1 text-[11px] leading-none">
                LNP
              </TabsTrigger>
              <TabsTrigger value="tm" className="px-2.5 py-1 text-[11px] leading-none">
                Transfermarkt
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <Crumb
        items={[
          { label: "Start", href: "/" },
          { label: "Zawodnicy", href: "/players" },
          { label: "Globalna baza – import" },
        ]}
      />

      <ToolbarFull title={pageTitle} right={null} />

      <div className="space-y-4">{tab === "lnp" ? <LnpSearchPanel /> : <TmScraperPanel />}</div>
    </div>
  );
}
