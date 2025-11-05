// /app/players/global/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crumb, Toolbar } from "@/shared/ui/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Search, NotebookPen, Trash2, Undo2, RefreshCw, ShieldAlert, CheckCircle2,
} from "lucide-react";

/* ============================== Types ============================== */

type RankSource = "tm" | "wyscout" | "sofifa" | "custom";
type GlobalPlayer = {
  id: string;
  name: string;
  club?: string;
  pos?: "GK" | "DF" | "MF" | "FW" | string;
  age?: number;
  nationality?: string;
  source?: RankSource | string;
  extId?: string;
  addedAt?: string;
  adminNote?: string;
  meta?: Record<string, any>;
};

const STORAGE_KEY = "s4s.global.players";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* =========================== Page (Admin) ========================== */

export default function GlobalDatabasePage() {
  const router = useRouter();

  // hooks must be at the top and unconditionally called
  const [role, setRole] = useState<"admin" | "scout" | "scout-agent">("scout");
  const [rows, setRows] = useState<GlobalPlayer[]>([]);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // load role
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem("s4s.role");
      if (savedRole === "admin" || savedRole === "scout" || savedRole === "scout-agent") {
        setRole(savedRole);
      }
    } catch {}
  }, []);

  // load or seed data
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setRows(JSON.parse(raw));
      } else {
        const now = new Date().toISOString();
        const seed: GlobalPlayer[] = [
          { id: uid(), name: "Marco Rossi", club: "Roma", pos: "FW", age: 20, nationality: "IT", source: "tm", extId: "tm:rossi:roma:FW", addedAt: now },
          { id: uid(), name: "João Silva", club: "Benfica", pos: "FW", age: 19, nationality: "PT", source: "wyscout", extId: "wyscout:joao-silva:benfica:FW", addedAt: now },
          { id: uid(), name: "Adam Nowak", club: "Legia", pos: "DF", age: 17, nationality: "PL", source: "sofifa", extId: "sofifa:adam-nowak:legia:DF", addedAt: now },
          { id: uid(), name: "Luka Novak", club: "Dinamo", pos: "MF", age: 18, nationality: "HR", source: "tm", extId: "tm:luka-novak:dinamo:MF", addedAt: now },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        setRows(seed);
      }
    } catch {
      setRows([]);
    }
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = !qq
      ? rows
      : rows.filter((r) =>
          [r.name, r.club, r.nationality, r.pos]
            .map((x) => (x || "").toString().toLowerCase())
            .some((x) => x.includes(qq))
        );
    return [...list].sort((a, b) => {
      const ad = a.addedAt || "";
      const bd = b.addedAt || "";
      if (ad !== bd) return bd > ad ? 1 : -1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [rows, q]);

  function persist(next: GlobalPlayer[]) {
    setRows(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }
  function clearSearch() { setQ(""); }
  function remove(id: string) { persist(rows.filter((r) => r.id !== id)); }
  function startEditNote(r: GlobalPlayer) { setEditingId(r.id); setNoteDraft(r.adminNote ?? ""); }
  function saveNote() {
    if (!editingId) return;
    const next = rows.map((r) => (r.id === editingId ? { ...r, adminNote: noteDraft } : r));
    persist(next);
    setEditingId(null);
    setNoteDraft("");
  }
  function cancelNote() { setEditingId(null); setNoteDraft(""); }
  function refreshFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setRows(raw ? JSON.parse(raw) : []);
    } catch {}
  }

  const isAdmin = role === "admin";

  /* ---------------------------- Render ---------------------------- */

  return (
    <div className="w-full">
      <Crumb items={[{ label: "Start", href: "/" }, { label: "Zawodnicy" }, { label: "Globalna baza" }]} />

      {!isAdmin ? (
        <Card className="border-rose-200 dark:border-rose-900/50">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="h-5 w-5" />
              Brak uprawnień
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-neutral-300">
              Ten widok jest dostępny wyłącznie dla roli <b>Admin</b>.
            </p>
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => router.push("/")}>
              Wróć do kokpitu
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Toolbar
            title="Zawodnicy — globalna baza (Admin)"
            right={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Search className="h-4 w-4 text-dark" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Szukaj po nazwisku, klubie, narodowości…"
                    className="w-72"
                  />
                  {q && (
                    <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={clearSearch}>
                      Wyczyść
                    </Button>
                  )}
                </div>
                <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={refreshFromStorage} title="Wczytaj ponownie z localStorage">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Odśwież
                </Button>
              </div>
            }
          />

          <Card className="border-gray-200 dark:border-neutral-800 mt-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">
                Globalna baza •{" "}
                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {filtered.length} rekordów
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-dark dark:bg-neutral-900 dark:text-neutral-300">
                    <tr>
                      <th className="p-3 text-left font-medium">Zawodnik</th>
                      <th className="p-3 text-left font-medium">Klub</th>
                      <th className="p-3 text-left font-medium">Pozycja</th>
                      <th className="p-3 text-left font-medium">Wiek</th>
                      <th className="p-3 text-left font-medium">Narodowość</th>
                      <th className="p-3 text-left font-medium">Źródło</th>
                      <th className="p-3 text-left font-medium">Dodano</th>
                      <th className="p-3 text-left font-medium">Notatka (Admin)</th>
                      <th className="p-3 text-right font-medium">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const isEditing = editingId === r.id;
                      return (
                        <tr key={r.id} className="border-t border-gray-200 align-top dark:border-neutral-800">
                          <td className="p-3">
                            <div className="font-medium text-gray-900 dark:text-neutral-100">{r.name || "—"}</div>
                            {r.extId && (
                              <div className="text-[11px] text-dark dark:text-neutral-400">{r.extId}</div>
                            )}
                          </td>
                          <td className="p-3">{r.club || "—"}</td>
                          <td className="p-3">
                            {r.pos ? (
                              <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 dark:bg-neutral-800 dark:text-neutral-200">
                                {r.pos}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="p-3">{r.age ?? "—"}</td>
                          <td className="p-3">{r.nationality ?? "—"}</td>
                          <td className="p-3">{labelForSource(r.source)}</td>
                          <td className="p-3">
                            {r.addedAt
                              ? new Date(r.addedAt).toLocaleString("pl-PL", {
                                  day: "2-digit", month: "2-digit", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="p-3">
                            {!isEditing ? (
                              r.adminNote ? (
                                <div className="max-w-xs truncate text-gray-800 dark:text-neutral-100">{r.adminNote}</div>
                              ) : (
                                <span className="text-xs text-dark dark:text-neutral-400">Brak</span>
                              )
                            ) : (
                              <div className="max-w-md space-y-2">
                                <Label className="text-xs">Notatka</Label>
                                <textarea
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  className="h-24 w-full rounded border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                                  placeholder="Twoja prywatna notatka (widoczna tylko dla Admina w tym widoku)…"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button className="bg-gray-900 text-white hover:bg-gray-800" size="sm" onClick={saveNote}>
                                    <CheckCircle2 className="mr-1 h-4 w-4" /> Zapisz
                                  </Button>
                                  <Button variant="outline" size="sm" className="border-gray-300 dark:border-neutral-700" onClick={cancelNote}>
                                    Anuluj
                                  </Button>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {!isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mr-2 h-8 border-gray-300 dark:border-neutral-700"
                                  onClick={() => startEditNote(r)}
                                  title="Edytuj notatkę Administratora"
                                >
                                  <NotebookPen className="mr-1 h-4 w-4" />
                                  Notatka
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-8 bg-gray-900 text-white hover:bg-gray-800"
                                  onClick={() => remove(r.id)}
                                  title="Usuń z globalnej bazy"
                                >
                                  <Trash2 className="mr-1 h-4 w-4" />
                                  Usuń
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-gray-300 dark:border-neutral-700"
                                onClick={cancelNote}
                              >
                                <Undo2 className="mr-1 h-4 w-4" />
                                Anuluj
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-5 text-center text-sm text-dark dark:text-neutral-400">
                          Brak rekordów do wyświetlenia.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ============================ Helpers ============================ */
function labelForSource(src?: string) {
  if (src === "tm") return "Transfermarkt";
  if (src === "wyscout") return "Wyscout";
  if (src === "sofifa") return "SoFIFA";
  if (src === "custom") return "Custom";
  return src || "Źródło";
}
