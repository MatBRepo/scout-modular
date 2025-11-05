// src/app/players/[id]/page.tsx
"use client";
import { useRouter, useParams } from "next/navigation";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";

export default function PlayerDetailsPage() {
  const router = useRouter();
  const params = useParams(); // { id }
  const id = params?.id as string;

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Baza zawodników", href: "/players" }, { label: `Zawodnik #${id}` }]} />
      <Toolbar
        title={`Zawodnik #${id}`}
        right={<Button onClick={() => router.push("/players")}>Wróć do listy</Button>}
      />
      <div className="rounded border border-dashed p-6 text-sm text-dark dark:border-neutral-700 dark:text-neutral-300">
        Tutaj podłączymy pełny edytor/profil zawodnika.
      </div>
    </div>
  );
}
