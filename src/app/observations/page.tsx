"use client";
import ObservationsFeature from "@/features/observations/Observations";
import type { Observation } from "@/shared/types";
import { useState } from "react";

const initial: Observation[] = [
  { id:1, player:"Jan Kowalski", match:"U19 Liga", date:"2025-05-02", time:"17:30", status:"final"},
  { id:2, player:"Marco Rossi", match:"Sparing A", date:"2025-05-10", time:"12:00", status:"draft"}
];

export default function Page(){
  const [data, setData] = useState<Observation[]>(initial);
  return <ObservationsFeature data={data} onChange={(next)=> setData(typeof next === "function" ? (next as any)(data) : next)} />;
}
