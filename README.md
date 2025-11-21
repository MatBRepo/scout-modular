# S4S – Platforma scoutingowa

Webowa platforma do zarządzania **bazą zawodników**, **obserwacjami meczowymi** oraz **raportami scoutingowymi**.  
Zbudowana na **Next.js + Supabase + Tailwind/shadcn** z naciskiem na UX scouta (szybkie wprowadzanie danych, autozapis, czytelne widoki).

---

## 🧱 Stack technologiczny

**Frontend**

- Next.js 14+ – App Router, `use client` w widokach
- React 18
- TypeScript
- Tailwind CSS – utilsy + tokeny designu
- shadcn/ui – przyciski, inputy, karty, tabele itp.
- Lucide Icons – ikony (Users, Lock, Search, itp.)
- Framer Motion – animacje (np. w layoutach / hero)

**Backend / Baza**

- Supabase
  - `players` – główna baza zawodników
  - `observations` – dziennik obserwacji meczowych
  - `field_requirements` – konfiguracja pól wymaganych (np. w ObservationEditor)
  - inne tabele pomocnicze (np. `global_players`, konfiguracje metryk/ocen)

**Inne moduły**

- `@/shared/metrics` – konfiguracja metryk ocen (BASE, GK, DEF, MID, ATT)
- `@/shared/ratings` – konfiguracja ocen zawodnika
- `@/shared/requiredFields` – logika “required fields” z Supabase
- `@/shared/ui/StarRating` – gwiazdkowa ocena
- `@/components/icons` – ikony domenowe (np. `KnownPlayerIcon`, `AddPlayerIcon`)

---

## 🚀 Uruchomienie (dev / “launch”)

### 1. Wymagania

- Node.js w wersji co najmniej 18 (zalecana 18 LTS)
- npm / pnpm / yarn – dowolny menedżer pakietów
- Konto w Supabase + skonfigurowana baza z wymaganymi tabelami

### 2. Instalacja zależności

```bash
# npm
npm install

# lub pnpm
pnpm install

# lub yarn
yarn
