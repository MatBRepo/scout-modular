// src/app/not-found.tsx
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold">Nie znaleziono</h1>
      <p className="mt-2 text-sm text-dark dark:text-neutral-400">
        Strona, której szukasz, nie istnieje lub została przeniesiona.
      </p>
    </div>
  );
}
