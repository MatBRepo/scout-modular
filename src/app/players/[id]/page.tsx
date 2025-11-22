// src/app/players/[id]/page.tsx
"use client";

import PlayerEditorPage from "@/features/players/PlayerEditorPage";

export default function Page({ params }: { params: { id: string } }) {
  return <PlayerEditorPage/>;
}
