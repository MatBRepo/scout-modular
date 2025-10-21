"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, UserPlus, Shield, Mail, Phone, Search, Eye,
  Pencil, CheckCircle, XCircle, Ban, Plus, X, Link2, Copy, Share2,
  MessageCircle, Send, Filter, Trash2
} from "lucide-react";

/* ----------------------------- Types ----------------------------- */
type Role = "admin" | "scout" | "scout-agent";

type Account = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
  createdAt: string;   // ISO
  lastActive?: string; // ISO
};

type InviteChannel = "email" | "whatsapp" | "messenger" | "link" | "system-share";
type InviteStatus = "pending" | "revoked";
type Invite = {
  id: string;             // token
  name?: string;
  email?: string;
  role: Role;
  channel: InviteChannel;
  createdAt: string;      // ISO
  expiresAt?: string;     // ISO (optional)
  status: InviteStatus;
  url: string;            // shareable link
};

/* -------------------------- Constants --------------------------- */
const ROLES: Role[] = ["admin", "scout", "scout-agent"];

/* ============================ Page ============================== */
export default function ManagePage() {
  /* Users */
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  /* Add user modal */
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Account | null>(null);
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPhone, setNPhone] = useState("");
  const [nRole, setNRole] = useState<Role>("scout");
  const [nActive, setNActive] = useState(true);

  /* Invitations */
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iRole, setIRole] = useState<Role>("scout");
  const [iChannel, setIChannel] = useState<InviteChannel>("email");
  const [iExpiresDays, setIExpiresDays] = useState<number>(14);

  /* --------------------------- Loaders -------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("s4s.accounts");
      if (raw) {
        setAccounts(JSON.parse(raw));
      } else {
        const seed: Account[] = [
          { id: 1, name: "Jan Kowalski",  email: "jan.kowalski@example.com",  phone: "+48 555 111 222", role: "scout",        active: true,  createdAt: isoDaysAgo(30), lastActive: isoDaysAgo(1) },
          { id: 2, name: "Anna Nowak",     email: "anna.nowak@example.com",     phone: "+48 555 333 444", role: "scout-agent",  active: true,  createdAt: isoDaysAgo(20), lastActive: isoDaysAgo(4) },
          { id: 3, name: "Admin S4S",      email: "admin@example.com",          phone: "",               role: "admin",        active: true,  createdAt: isoDaysAgo(90), lastActive: isoDaysAgo(2) },
          { id: 4, name: "Michał Test",    email: "michal@example.com",         phone: "",               role: "scout",        active: false, createdAt: isoDaysAgo(7)  },
        ];
        setAccounts(seed);
        localStorage.setItem("s4s.accounts", JSON.stringify(seed));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("s4s.invites");
      setInvites(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  /* -------------------------- Persistence ----------------------- */
  function saveAccounts(next: Account[]) {
    try {
      localStorage.setItem("s4s.accounts", JSON.stringify(next));
      setAccounts(next);
      window.dispatchEvent(new StorageEvent("storage", { key: "s4s.accounts" }));
    } catch {}
  }
  function saveInvites(next: Invite[]) {
    try {
      localStorage.setItem("s4s.invites", JSON.stringify(next));
      setInvites(next);
      window.dispatchEvent(new StorageEvent("storage", { key: "s4s.invites" }));
    } catch {}
  }

  /* ----------------------- User management ---------------------- */
  function onChangeRole(id: number, role: Role) {
    const next = accounts.map(a => (a.id === id ? { ...a, role } : a));
    saveAccounts(next);
  }
  function onToggleActive(id: number) {
    const next = accounts.map(a => (a.id === id ? { ...a, active: !a.active } : a));
    saveAccounts(next);
  }
  function onOpenDetail(a: Account) {
    setDetail(a);
  }
  function onAddUser() {
    if (!nName.trim() || !nEmail.trim()) return;
    const nextId = Math.max(0, ...accounts.map(a => a.id)) + 1;
    const newAccount: Account = {
      id: nextId,
      name: nName.trim(),
      email: nEmail.trim().toLowerCase(),
      phone: nPhone.trim() || undefined,
      role: nRole,
      active: nActive,
      createdAt: new Date().toISOString(),
    };
    const next = [newAccount, ...accounts];
    saveAccounts(next);
    setAddOpen(false);
    setNName(""); setNEmail(""); setNPhone(""); setNRole("scout"); setNActive(true);
  }

  /* ------------------------- Invite logic ----------------------- */
  function createInviteLink(token: string): string {
    // You can swap this for your real backend URL later:
    const origin = typeof window !== "undefined" ? window.location.origin : "https://app.example.com";
    return `${origin}/invite/${token}`;
  }

  function generateToken() {
    try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2); }
  }

  function onCreateInvite() {
    const token = generateToken();
    const url = createInviteLink(token);
    const expiresAt = iExpiresDays > 0 ? isoDaysFromNow(iExpiresDays) : undefined;
    const invite: Invite = {
      id: token,
      name: iName.trim() || undefined,
      email: iEmail.trim() || undefined,
      role: iRole,
      channel: iChannel,
      createdAt: new Date().toISOString(),
      expiresAt,
      status: "pending",
      url,
    };
    const next = [invite, ...invites];
    saveInvites(next);
    // Optional direct handoff based on channel:
    quickShare(invite);
    // Reset fields (keep modal open for bulk)
    setIName(""); setIEmail(""); setIRole("scout"); setIChannel("email");
  }

  function quickShare(invite: Invite) {
    // Prefer Web Share if available and channel is "system-share"
    if (invite.channel === "system-share" && typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any).share({
        title: "Zaproszenie do S4S",
        text: buildInviteText(invite),
        url: invite.url,
      }).catch(() => {});
      return;
    }
    if (invite.channel === "email") {
      const subject = encodeURIComponent("Zaproszenie do S4S");
      const body = encodeURIComponent(buildInviteText(invite));
      const to = invite.email ? encodeURIComponent(invite.email) : "";
      window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
      return;
    }
    if (invite.channel === "whatsapp") {
      const text = encodeURIComponent(buildInviteText(invite));
      window.open(`https://wa.me/?text=${text}`, "_blank");
      return;
    }
    if (invite.channel === "messenger") {
      // Web fallback (Messenger share dialog)
      const link = encodeURIComponent(invite.url);
      window.open(`https://www.facebook.com/dialog/send?link=${link}`, "_blank");
      return;
    }
    if (invite.channel === "link") {
      copy(invite.url);
      alert("Skopiowano link zaproszenia do schowka.");
    }
  }

  function buildInviteText(inv: Invite) {
    const who = inv.name ? inv.name : "nowy scout";
    const roleTxt = `rola: ${labelForRole(inv.role)}`;
    const exp = inv.expiresAt ? ` (wygasa: ${fmtDate(inv.expiresAt)})` : "";
    return `Cześć ${who}!\n\nZapraszam Cię do S4S (${roleTxt}).\nDołącz: ${inv.url}${exp}\n\nDzięki!`;
  }

  function copy(txt: string) {
    try { navigator.clipboard.writeText(txt); } catch {}
  }

const REVOKED: InviteStatus = 'revoked' as InviteStatus;

function revokeInvite(id: string) {
  const next: Invite[] = invites.map(i =>
    i.id === id ? { ...i, status: REVOKED } : i
  );
  saveInvites(next);
}


  /* --------------------------- Derived -------------------------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter(a => {
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.phone || "").toLowerCase().includes(q)
        );
      })
      .filter(a => (roleFilter ? a.role === roleFilter : true))
      .filter(a => {
        if (!statusFilter) return true;
        return statusFilter === "active" ? a.active : !a.active;
      })
      .sort((a,b) => Number(b.active) - Number(a.active));
  }, [accounts, query, roleFilter, statusFilter]);

  const pendingInvites = invites.filter(i => i.status === "pending");

  /* ============================ UI ============================== */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zarządzanie użytkownikami</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-neutral-300">
            Rejestr scoutów • Zmieniaj role, aktywuj/deaktywuj, zapraszaj nowych i przeglądaj szczegóły kont.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => setInviteOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Zaproś scouta
          </Button>
          <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Dodaj ręcznie
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-gray-200 dark:border-neutral-800">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Filter className="h-4 w-4" />
            Filtry i wyszukiwanie
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Szukaj po imieniu, e-mailu lub telefonie…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Rola</label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={roleFilter}
                onChange={(e) => setRoleFilter((e.target.value || "") as Role | "")}
              >
                <option value="">Wszystkie</option>
                {ROLES.map(r => <option key={r} value={r}>{labelForRole(r)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Status</label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target.value || "") as any)}
              >
                <option value="">Wszystkie</option>
                <option value="active">Aktywne</option>
                <option value="inactive">Nieaktywne</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      <Card className="border-gray-200 dark:border-neutral-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">
            Oczekujące zaproszenia ({pendingInvites.length})
          </CardTitle>
          <div className="text-xs text-gray-500 dark:text-neutral-400">Udostępnij link lub wyślij przez e-mail/komunikator.</div>
        </CardHeader>
        <CardContent className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="p-3 text-left font-medium">Osoba</th>
                <th className="p-3 text-left font-medium">Rola</th>
                <th className="p-3 text-left font-medium">Kanał</th>
                <th className="p-3 text-left font-medium">Wysłano</th>
                <th className="p-3 text-left font-medium">Wygasa</th>
                <th className="p-3 text-right font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map(inv => (
                <tr key={inv.id} className="border-t border-gray-200 align-middle dark:border-neutral-700">
                  <td className="p-3">
                    <div className="font-medium">{inv.name || "—"}</div>
                    <div className="text-xs text-gray-500 dark:text-neutral-400">{inv.email || "brak e-maila"}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                      <Shield className="h-3.5 w-3.5" /> {labelForRole(inv.role)}
                    </span>
                  </td>
                  <td className="p-3 text-xs capitalize">{channelLabel(inv.channel)}</td>
                  <td className="p-3 text-xs text-gray-600 dark:text-neutral-400">{fmtDate(inv.createdAt)}</td>
                  <td className="p-3 text-xs text-gray-600 dark:text-neutral-400">{inv.expiresAt ? fmtDate(inv.expiresAt) : "—"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-gray-300 dark:border-neutral-700"
                        onClick={() => { copy(inv.url); }}
                        title="Kopiuj link"
                      >
                        <Copy className="mr-1 h-4 w-4" /> Kopiuj
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-gray-300 dark:border-neutral-700"
                        onClick={() => quickShare({ ...inv, channel: "system-share" })}
                        title="Udostępnij"
                      >
                        <Share2 className="mr-1 h-4 w-4" /> Udostępnij
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-gray-300 text-red-600 dark:border-neutral-700"
                        onClick={() => revokeInvite(inv.id)}
                        title="Cofnij zaproszenie"
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Cofnij
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingInvites.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-gray-500 dark:text-neutral-400">
                    Brak aktywnych zaproszeń — użyj „Zaproś scouta”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Users list */}
      <Card className="border-gray-200 dark:border-neutral-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Użytkownicy ({filtered.length})
            </div>
          </CardTitle>
          <div className="text-xs text-gray-500 dark:text-neutral-400">
            Kliknij nazwę aby zobaczyć szczegóły
          </div>
        </CardHeader>
        <CardContent className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-neutral-900 dark:text-neutral-300">
              <tr>
                <th className="p-3 text-left font-medium">Użytkownik</th>
                <th className="p-3 text-left font-medium">Kontakt</th>
                <th className="p-3 text-left font-medium">Rola</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Utworzono</th>
                <th className="p-3 text-right font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-t border-gray-200 align-middle dark:border-neutral-700">
                  <td className="p-3">
                    <button className="text-left font-medium hover:underline" onClick={() => onOpenDetail(a)} title="Szczegóły">
                      {a.name}
                    </button>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500 dark:text-neutral-400">
                      <Shield className="h-3.5 w-3.5" />
                      {labelForRole(a.role)}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-neutral-300">
                      <Mail className="h-3.5 w-3.5" /> {a.email}
                    </div>
                    {a.phone && (
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
                        <Phone className="h-3.5 w-3.5" /> {a.phone}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <select
                      className="rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                      value={a.role}
                      onChange={(e) => onChangeRole(a.id, e.target.value as Role)}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{labelForRole(r)}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    {a.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                        <CheckCircle className="h-3.5 w-3.5" /> Aktywne
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        <Ban className="h-3.5 w-3.5" /> Nieaktywne
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-500 dark:text-neutral-400">
                    {fmtDate(a.createdAt)}
                    <div className="opacity-70">{a.lastActive ? `Ost. aktywność: ${fmtDate(a.lastActive)}` : "—"}</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8 border-gray-300 dark:border-neutral-700" onClick={() => onOpenDetail(a)}>
                        <Eye className="mr-1 h-4 w-4" /> Szczegóły
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-gray-300 dark:border-neutral-700"
                        onClick={() => onToggleActive(a.id)}
                        title={a.active ? "Deaktywuj" : "Aktywuj"}
                      >
                        {a.active ? (
                          <>
                            <XCircle className="mr-1 h-4 w-4" /> Deaktywuj
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-1 h-4 w-4" /> Aktywuj
                          </>
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-gray-500 dark:text-neutral-400">
                    Brak wyników — zmień filtry lub dodaj nowego użytkownika.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Invite modal */}
      {inviteOpen && (
        <Modal onClose={() => setInviteOpen(false)} title="Zaproś nowego scouta">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Imię i nazwisko (opcjonalnie)</label>
              <Input value={iName} onChange={(e) => setIName(e.target.value)} placeholder="np. Jan Kowalski" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">E-mail (wymagany dla kanału e-mail)</label>
              <Input type="email" value={iEmail} onChange={(e) => setIEmail(e.target.value)} placeholder="np. jan@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Rola</label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={iRole}
                onChange={(e) => setIRole(e.target.value as Role)}
              >
                {ROLES.map(r => <option key={r} value={r}>{labelForRole(r)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Kanał</label>
              <select
                className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={iChannel}
                onChange={(e) => setIChannel(e.target.value as InviteChannel)}
              >
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="messenger">Messenger</option>
                <option value="link">Kopiuj link</option>
                <option value="system-share">Udostępnianie systemowe</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-neutral-400">Wygasa (dni)</label>
              <Input
                type="number"
                min={0}
                value={iExpiresDays}
                onChange={(e) => setIExpiresDays(Number(e.target.value || 0))}
                placeholder="np. 14"
              />
              <div className="mt-1 text-[11px] text-gray-500 dark:text-neutral-400">0 = bez wygaśnięcia</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" className="border-gray-300 dark:border-neutral-700" onClick={() => setInviteOpen(false)}>
              Anuluj
            </Button>
            <Button
              className="bg-gray-900 text-white hover:bg-gray-800"
              onClick={onCreateInvite}
              disabled={iChannel === "email" && !iEmail.trim()}
              title={iChannel === "email" && !iEmail.trim() ? "Podaj e-mail albo wybierz inny kanał" : ""}
            >
              <Send className="mr-2 h-4 w-4" />
              Wyślij zaproszenie
            </Button>
          </div>
        </Modal>
      )}

      {/* Details modal */}
      {detail && (
        <Modal onClose={() => setDetail(null)} title="Szczegóły konta">
          <div className="space-y-3 text-sm">
            <Row label="Imię i nazwisko" value={detail.name} />
            <Row label="E-mail" value={detail.email} icon={<Mail className="h-3.5 w-3.5" />} />
            {detail.phone && <Row label="Telefon" value={detail.phone} icon={<Phone className="h-3.5 w-3.5" />} />}
            <Row label="Rola" value={labelForRole(detail.role)} icon={<Shield className="h-3.5 w-3.5" />} />
            <Row
              label="Status"
              value={
                detail.active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    <CheckCircle className="h-3.5 w-3.5" /> Aktywne
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    <Ban className="h-3.5 w-3.5" /> Nieaktywne
                  </span>
                )
              }
            />
            <Row label="Utworzono" value={fmtDate(detail.createdAt)} />
            <Row label="Ost. aktywność" value={detail.lastActive ? fmtDate(detail.lastActive) : "—"} />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => onToggleActive(detail.id)}
            >
              {detail.active ? (
                <>
                  <XCircle className="mr-2 h-4 w-4" /> Deaktywuj
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" /> Aktywuj
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="border-gray-300 dark:border-neutral-700"
              onClick={() => setDetail(prev => (prev ? { ...prev, role: cycleRole(prev.role), active: prev.active } : prev))}
              title="Szybka zmiana roli (demo)"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Zmień rolę
            </Button>
            <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => setDetail(null)}>
              Zamknij
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ======================== Small components ====================== */

function labelForRole(r: Role) {
  if (r === "admin") return "Admin";
  if (r === "scout-agent") return "Scout Agent";
  return "Scout";
}
function cycleRole(r: Role): Role {
  const order: Role[] = ["scout", "scout-agent", "admin"];
  const i = order.indexOf(r);
  return order[(i + 1) % order.length];
}
function channelLabel(c: InviteChannel) {
  if (c === "email") return "E-mail";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "messenger") return "Messenger";
  if (c === "system-share") return "Udostępnij";
  return "Link";
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pl-PL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return iso; }
}
function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="col-span-1 text-xs font-medium text-gray-500 dark:text-neutral-400">{label}</div>
      <div className="col-span-2">
        <div className="inline-flex items-center gap-2">{icon}{value}</div>
      </div>
    </div>
  );
}

/* Minimal modal (no external deps) */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} />
      <div
        className="
          fixed inset-x-3 top-[8vh] z-[101] mx-auto max-w-2xl
          rounded-xl border border-gray-200 bg-white p-4 shadow-2xl
          dark:border-neutral-800 dark:bg-neutral-950
        "
        role="dialog" aria-modal="true"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            onClick={onClose}
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
