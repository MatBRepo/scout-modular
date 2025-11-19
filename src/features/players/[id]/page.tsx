// src/app/(players)/players/[id]/page.tsx
"use client";

import PlayerEditorPage from "../PlayerEditorPage";
// jeśli plik jest gdzie indziej, dostosuj ścieżkę, np.:
// import PlayerEditorPage from "@/features/players/PlayerEditorPage";

export default function PlayerDetailsRoute({
  params,
}: {
  params: { id: string };
}) {
  return <PlayerEditorPage id={params.id} />;
}
