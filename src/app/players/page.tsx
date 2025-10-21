// src/app/players/page.tsx (or wherever this page lives)
"use client";

import { useEffect, useState, Suspense } from "react";
import MyPlayersFeature from "@/features/players/MyPlayersFeature";
import type { Player, Observation } from "@/shared/types";

// Avoid static pre-render (quick unblock for useSearchParams, etc.)
export const dynamic = "force-dynamic"; // or: export const revalidate = 0

const seed: Player[] = [
  // znani
  { id: 1,  name: "Jan Kowalski",      firstName:"Jan",   lastName:"Kowalski",   pos:"MF", club:"Lech",     age:19, status:"active"},
  { id: 2,  name: "Marco Rossi",       firstName:"Marco", lastName:"Rossi",      pos:"FW", club:"Roma",     age:20, status:"active"},
  { id: 3,  name: "Ivan Petrov",       firstName:"Ivan",  lastName:"Petrov",     pos:"DF", club:"CSKA",     age:18, status:"trash"},
  { id: 4,  name: "Piotr Zieliński",   firstName:"Piotr", lastName:"Zieliński",  pos:"MF", club:"Napoli",   age:21, status:"active"},
  { id: 5,  name: "Adam Nowak",        firstName:"Adam",  lastName:"Nowak",      pos:"DF", club:"Legia",    age:17, status:"active"},
  { id: 6,  name: "Kacper Wójcik",     firstName:"Kacper",lastName:"Wójcik",     pos:"GK", club:"Wisła",    age:18, status:"active"},
  { id: 9,  name: "Tomasz Malinowski", firstName:"Tomasz",lastName:"Malinowski", pos:"DF", club:"Lechia",   age:19, status:"active"},
  { id: 10, name: "João Silva",        firstName:"João",  lastName:"Silva",      pos:"FW", club:"Benfica",  age:19, status:"active"},
  { id: 11, name: "Luka Novak",        firstName:"Luka",  lastName:"Novak",      pos:"MF", club:"Dinamo",   age:18, status:"active"},
  { id: 12, name: "Andriy Shevchuk",   firstName:"Andriy",lastName:"Shevchuk",   pos:"FW", club:"Shakhtar", age:20, status:"active"},
  { id: 13, name: "Marek Hamsik",      firstName:"Marek", lastName:"Hamsik",     pos:"MF", club:"Fenerbahçe", age:22, status:"active"},
  { id: 14, name: "David Müller",      firstName:"David", lastName:"Müller",     pos:"DF", club:"Bayern",   age:21, status:"active"},
  { id: 15, name: "Oleksii Bondar",    firstName:"Oleksii", lastName:"Bondar",   pos:"GK", club:"Dynamo",   age:19, status:"active"},
  { id: 17, name: "Jakub Zielony",     firstName:"Jakub", lastName:"Zielony",    pos:"MF", club:"Pogoń",    age:20, status:"active"},
  { id: 18, name: "Nicolas Dupont",    firstName:"Nicolas", lastName:"Dupont",   pos:"DF", club:"PSG",      age:18, status:"active"},
  // nieznani
  { id: 7,  name:"#27 (U19 Śląsk)",                       pos:"MF", club:"Śląsk",    age:17, status:"active"},
  { id: 8,  name:"#9 (U17 Akademia)",                     pos:"FW", club:"Akademia", age:16, status:"active"},
  { id: 16, name:"#32 (Bruk-Bet test)",                   pos:"DF", club:"Bruk-Bet", age:18, status:"trash"},
];

const initialObs: Observation[] = [
  { id:1, player:"Jan Kowalski",       match:"U19 Liga",               date:"2025-05-02", time:"17:30", status:"final"},
  { id:2, player:"Marco Rossi",        match:"Sparing A",              date:"2025-05-10", time:"12:00", status:"draft"},
  { id:3, player:"João Silva",         match:"Liga Mł.",               date:"2025-04-21", time:"15:00", status:"final"},
  { id:4, player:"Kacper Wójcik",      match:"Puchar",                 date:"2025-03-30", time:"18:45", status:"draft"},
  { id:5, player:"#27 (U19 Śląsk)",    match:"U19 Śląsk-Zagłębie",     date:"2025-05-18", time:"11:00", status:"draft"},
  { id:6, player:"Adam Nowak",         match:"CLJ U17",                date:"2025-05-05", time:"13:30", status:"final"},
];

export default function Page() {
  const [players, setPlayers] = useState<Player[]>(seed);
  const [observations] = useState<Observation[]>(initialObs);

  // load from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem("s4s.players");
      if (raw) setPlayers(JSON.parse(raw));
    } catch {}
  }, []);

  // persist on change
  useEffect(() => {
    try {
      localStorage.setItem("s4s.players", JSON.stringify(players));
    } catch {}
  }, [players]);

  return (
    <Suspense fallback={null}>
      <MyPlayersFeature
        players={players}
        observations={observations}
        onChangePlayers={setPlayers}
      />
    </Suspense>
  );
}
