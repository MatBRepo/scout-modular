// src/app/observations/page.tsx
"use client";

import { Suspense, useState } from "react";
import ObservationsFeature from "@/features/observations/Observations";
import type { Observation } from "@/shared/types";

// If you want to skip SSG for this page (quick unblock):
export const dynamic = "force-dynamic"; // or: export const revalidate = 0

const initial: Observation[] = [
  { id: 1, player: "Jan Kowalski", match: "U19 Liga",   date: "2025-05-02", time: "17:30", status: "final" },
  { id: 2, player: "Marco Rossi",  match: "Sparing A",  date: "2025-05-10", time: "12:00", status: "draft" },
];

export default function Page() {
  const [data, setData] = useState<Observation[]>(initial);

  return (
    <Suspense fallback={null}>
      <ObservationsFeature
        data={data}
        onChange={(next) =>
          setData(typeof next === "function" ? (next as (p: Observation[]) => Observation[])(data) : next)
        }
      />
    </Suspense>
  );
}
