// src/app/not-found.tsx
import Link from "next/link";
import { SearchX, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-md border border-stone-200 bg-white px-6 py-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-200">
          <SearchX className="h-6 w-6" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">
          Błąd 404
        </p>
        <h1 className="mt-2 text-xl font-semibold text-stone-900 dark:text-stone-50">
          Nie znaleziono strony
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
          Strona, której szukasz, nie istnieje, została przeniesiona
          lub adres zawiera błąd.
        </p>

        <div className="mt-6 flex flex-wrap flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button
            asChild
            className="w-full rounded-md sm:w-auto"
            variant="default"
          >
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Przejdź do strony głównej
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full rounded-md border-stone-200 text-xs text-stone-700 sm:w-auto dark:border-stone-700 dark:text-stone-200"
          >
            <Link href="/players">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Wróć do listy zawodników
            </Link>
          </Button>
        </div>

        <p className="mt-4 text-[11px] text-stone-400 dark:text-stone-500">
          Jeśli problem się powtarza, skontaktuj się z administratorem systemu.
        </p>
      </div>
    </div>
  );
}
