"use client";
import { Check, X } from "lucide-react";

export default function CommentPin({
  number,
  resolved,
  onClick,
}: {
  number: number;
  resolved?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-white shadow " +
        (resolved ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white")
      }
      title={resolved ? "Rozwiązany" : "Komentarz"}
    >
      {resolved ? <Check className="h-3.5 w-3.5" /> : number}
      <span className="sr-only">{resolved ? "Rozwiązany" : "Komentarz"}</span>
    </button>
  );
}

