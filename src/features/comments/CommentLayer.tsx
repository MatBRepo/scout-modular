// src/features/comments/CommentLayer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useComments } from "./useComments";

/* ================= types ================= */

type ViewKind = "desktop" | "tablet" | "mobile";
type Orientation = "portrait" | "landscape";

type ResolutionMeta = {
  view?: ViewKind;
  presetId?: string | null; // id from PRESETS[view]
  orientation?: Orientation;
  width?: number | null; // derived from preset + orientation
  height?: number | null; // derived from preset + orientation
  note?: string | null;
};

/* =============== constants =============== */

const NAME_KEY = "s4s.comments.displayName";
const PANEL_KEY = "s4s.comments.panel";
const META_FALLBACK_KEY = "s4s.comments.meta"; // { [commentId]: ResolutionMeta }

// Most-used logical viewport sizes (CSS px).
const PRESETS: Record<ViewKind, { id: string; label: string; w: number; h: number }[]> = {
  desktop: [
    { id: "d-1920x1080", label: "1920×1080 (FHD)", w: 1920, h: 1080 },
    { id: "d-1536x864", label: "1536×864", w: 1536, h: 864 },
    { id: "d-1440x900", label: "1440×900", w: 1440, h: 900 },
    { id: "d-1366x768", label: "1366×768", w: 1366, h: 768 },
    { id: "d-1280x720", label: "1280×720 (HD)", w: 1280, h: 720 },
    { id: "d-2560x1440", label: "2560×1440 (QHD)", w: 2560, h: 1440 },
    { id: "d-2560x1600", label: "2560×1600 (WQXGA)", w: 2560, h: 1600 },
    { id: "d-3840x2160", label: "3840×2160 (4K)", w: 3840, h: 2160 },
  ],
  tablet: [
    { id: "t-768x1024", label: "iPad 9.7/10.2 – 768×1024", w: 768, h: 1024 },
    { id: "t-820x1180", label: "iPad 10th – 820×1180", w: 820, h: 1180 },
    { id: "t-834x1112", label: "iPad Pro 10.5 – 834×1112", w: 834, h: 1112 },
    { id: "t-834x1194", label: "iPad Air/Pro 11 – 834×1194", w: 834, h: 1194 },
    { id: "t-744x1133", label: "iPad mini – 744×1133", w: 744, h: 1133 },
    { id: "t-800x1280", label: "Android 8” – 800×1280", w: 800, h: 1280 },
  ],
  mobile: [
    { id: "m-360x800", label: "Android common – 360×800", w: 360, h: 800 },
    { id: "m-375x667", label: "iPhone 6/7/8 – 375×667", w: 375, h: 667 },
    { id: "m-375x812", label: "iPhone X/11/12 mini – 375×812", w: 375, h: 812 },
    { id: "m-390x844", label: "iPhone 12/13/14 – 390×844", w: 390, h: 844 },
    { id: "m-393x852", label: "Pixel 7 – 393×852", w: 393, h: 852 },
    { id: "m-393x873", label: "iPhone 14 Pro – 393×873", w: 393, h: 873 },
    { id: "m-414x896", label: "iPhone XR/11 – 414×896", w: 414, h: 896 },
    { id: "m-428x926", label: "iPhone 13/14 Pro Max – 428×926", w: 428, h: 926 },
  ],
};

/* Safe PostgREST config (client-side). If missing, we gracefully degrade. */
const REST_BASE =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`) ||
  "";
const ANON =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || "";

/* Helpers to use PostgREST only if envs are present */
function hasRest() {
  return Boolean(REST_BASE && ANON);
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw (await res.json().catch(() => res.text()));
  return res.json();
}

async function patchJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw (await res.json().catch(() => res.text()));
  return res.json();
}

/* =============== component =============== */

export default function CommentLayer({
  pageKey,
  // comment anywhere (sidebar + main content)
  containerSelector = "body",
  currentUser,
  initialView = "desktop",
}: {
  pageKey: string | null;
  containerSelector?: string;
  currentUser?: { id?: string; name?: string } | null;
  initialView?: ViewKind;
}) {
  const keyBase = pageKey ?? "global";

  /* ===== Current view namespace ===== */
  const [view, setView] = useState<ViewKind>(initialView);
  const key = `${keyBase}::${view}`;

  /* ===== Supabase-backed hook for this view ===== */
  const { roots, repliesByThread, addPoint, addReply, movePoint, removeThread } = useComments(key);

  /* ===== Author display name ===== */
  const [displayName, setDisplayName] = useState<string>("");
  const [askName, setAskName] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAME_KEY);
      if (raw) setDisplayName(JSON.parse(raw));
    } catch {}
  }, []);
  function saveName(v: string) {
    setDisplayName(v);
    try {
      localStorage.setItem(NAME_KEY, JSON.stringify(v));
    } catch {}
  }
  async function ensureName() {
    if (!displayName && !currentUser?.name) setAskName(true);
    return displayName || currentUser?.name || "";
  }

  /* ===== D/T/M counters ===== */
  const [counts, setCounts] = useState<{ desktop: number | string; tablet: number | string; mobile: number | string }>({
    desktop: "–",
    tablet: "–",
    mobile: "–",
  });

  async function countRootsFor(v: ViewKind) {
    if (!hasRest()) return null;
    const q = new URLSearchParams();
    q.set("select", "id,thread_id");
    q.set("page_key", `eq.${keyBase}::${v}`);
    const data = (await getJSON<any[]>(`${REST_BASE}/comments?${q.toString()}`)) || [];
    return data.filter((r) => r.thread_id && r.thread_id === r.id).length;
  }

  async function refreshCounts() {
    if (hasRest()) {
      try {
        const [d, t, m] = await Promise.all([countRootsFor("desktop"), countRootsFor("tablet"), countRootsFor("mobile")]);
        setCounts({ desktop: d ?? "–", tablet: t ?? "–", mobile: m ?? "–" });
      } catch {
        setCounts({ desktop: "–", tablet: "–", mobile: "–" });
      }
    } else {
      const c = roots.filter((r) => r.thread_id === r.id).length;
      setCounts({
        desktop: view === "desktop" ? c : "–",
        tablet: view === "tablet" ? c : "–",
        mobile: view === "mobile" ? c : "–",
      });
    }
  }
  useEffect(() => {
    refreshCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyBase]);
  useEffect(() => {
    refreshCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots.length, view]);

  /* ===== Geometry ===== */
  const [rect, setRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.querySelector(containerSelector) as HTMLElement | null;
    containerRef.current = el || null;

    const updateRect = () => {
      if (!containerRef.current) return setRect(null);
      setRect(containerRef.current.getBoundingClientRect());
    };

    updateRect();
    const ro = new ResizeObserver(updateRect);
    if (el) ro.observe(el);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [containerSelector]);

  // Immediately refresh rect when the view changes (1920 -> 1280, etc.)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setRect(el.getBoundingClientRect());
  }, [view]);

  function toPct(clientX: number, clientY: number) {
    if (!rect) return { xPct: 0, yPct: 0, left: 0, top: 0 };
    const xPct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const yPct = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return { xPct, yPct, left: clientX - rect.left, top: clientY - rect.top };
  }

  function pinPos(xPct: number, yPct: number) {
    if (!rect) return { left: -9999, top: -9999 };
    return { left: rect.left + xPct * rect.width, top: rect.top + yPct * rect.height };
  }

  /* ===== Popover placement + clamping (NEW) ===== */
  function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
  }
  function placePopover(
    baseLeft: number,
    baseTop: number,
    w: number,
    h: number,
    anchor: "below" | "right" = "below"
  ) {
    const M = 8; // viewport margin
    const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
    const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

    if (anchor === "below") {
      const willOverflowBottom = baseTop + M + h > vh;
      const top = willOverflowBottom ? baseTop - M : baseTop + M;
      const transform = `translate(-50%, ${willOverflowBottom ? "-100%" : "0"})`;
      const half = w / 2;
      const left = clamp(baseLeft, M + half, vw - M - half);
      return { left, top, transform };
    }

    let left = baseLeft;
    let top = baseTop;
    left = clamp(left, M, vw - M - w);
    top = clamp(top, M, vh - M - h);
    return { left, top, transform: undefined as string | undefined };
  }
  function pinScreenPos(xPct: number, yPct: number, pinSize = 30) {
    if (!rect) return { left: -9999, top: -9999 };
    const rawLeft = rect.left + xPct * rect.width;
    const rawTop = rect.top + yPct * rect.height;
    const M = Math.ceil(pinSize / 2) + 2;
    const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
    const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
    return {
      left: clamp(rawLeft, M, vw - M),
      top: clamp(rawTop, M, vh - M),
    };
  }

  /* ===== Create (Alt+Click / Add mode) ===== */
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [hoverThreadId, setHoverThreadId] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ xPct: number; yPct: number; left: number; top: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [addMode, setAddMode] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rect || !e.altKey) return;
      const wrap = containerRef.current;
      if (!wrap || !wrap.contains(e.target as Node)) return;
      e.preventDefault();
      const p = toPct(e.clientX, e.clientY);
      setOpenThreadId(null);
      setHoverThreadId(null);
      setDraft("");
      setComposer({ xPct: p.xPct, yPct: p.yPct, left: p.left, top: p.top });
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [rect]);

  useEffect(() => {
    if (!addMode) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const wrap = containerRef.current;
      if (!wrap) return;
      const target = e.target as Node;
      if (!wrap.contains(target)) return;

      let cx = 0,
        cy = 0;
      if (e instanceof TouchEvent) {
        const t = e.changedTouches[0] || e.touches[0];
        if (!t) return;
        cx = t.clientX;
        cy = t.clientY;
      } else {
        cx = (e as MouseEvent).clientX;
        cy = (e as MouseEvent).clientY;
      }
      const p = toPct(cx, cy);
      setOpenThreadId(null);
      setHoverThreadId(null);
      setDraft("");
      setComposer({ xPct: p.xPct, yPct: p.yPct, left: p.left, top: p.top });
      setAddMode(false);
    };
    window.addEventListener("click", handler, true);
    window.addEventListener("touchend", handler, true);
    return () => {
      window.removeEventListener("click", handler, true);
      window.removeEventListener("touchend", handler, true);
    };
  }, [addMode]);

  async function confirmCreate() {
    if (!composer) return;
    const body = draft.trim();
    if (!body) return;
    const authorName = displayName || currentUser?.name || (await ensureName());
    await addPoint({
      xPct: composer.xPct,
      yPct: composer.yPct,
      body,
      authorId: currentUser?.id ?? null,
      authorName,
    });
    setComposer(null);
    setDraft("");
  }
  function cancelCreate() {
    setComposer(null);
    setDraft("");
  }

  /* ===== Drag to move ===== */
  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    startPctX: number;
    startPctY: number;
    livePctX: number;
    livePctY: number;
    moved: boolean;
  } | null>(null);

  function startDrag(e: React.MouseEvent, id: string, xPct: number, yPct: number) {
    e.preventDefault();
    setComposer(null);
    setHoverThreadId(null);
    setOpenThreadId(null);
    setDrag({
      id,
      startX: e.clientX,
      startY: e.clientY,
      startPctX: xPct,
      startPctY: yPct,
      livePctX: xPct,
      livePctY: yPct,
      moved: false,
    });
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag || !rect) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const moved = drag.moved || Math.hypot(dx, dy) > 4;
      const p = toPct(e.clientX, e.clientY);
      setDrag({ ...drag, livePctX: p.xPct, livePctY: p.yPct, moved });
    }
    async function onUp() {
      if (!drag) return;
      if (!drag.moved) {
        setOpenThreadId(drag.id);
        setDrag(null);
        return;
      }
      try {
        await movePoint(drag.id, drag.livePctX, drag.livePctY);
      } finally {
        setDrag(null);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, rect, movePoint]);

  /* ===== Threads (live positions / badges) ===== */
  const threads = useMemo(() => {
    const now = Date.now();
    return roots.map((r) => {
      const replies = repliesByThread[r.id] ?? [];
      const fresh = [r, ...replies].some((c) => now - new Date(c.created_at).getTime() < 12_000);
      return {
        root: r,
        replies,
        liveX: drag?.id === r.id ? drag.livePctX : r.x ?? 0,
        liveY: drag?.id === r.id ? drag.livePctY : r.y ?? 0,
        fresh,
        count: 1 + replies.length,
      };
    });
  }, [roots, repliesByThread, drag]);

  /* ===== Early bail ===== */
  if (!rect) return null;

  const isDraggingId = drag?.id || null;

  return (
    <>
      <HelperPanel
        view={view}
        onView={(v) => {
          setOpenThreadId(null);
          setHoverThreadId(null);
          setComposer(null);
          setView(v);
        }}
        addMode={addMode}
        setAddMode={setAddMode}
        counts={counts}
        displayName={displayName || currentUser?.name || ""}
        onAskName={() => setAskName(true)}
      />

      {askName && (
        <NameModal
          initial={displayName || currentUser?.name || ""}
          onCancel={() => setAskName(false)}
          onSave={(v) => {
            saveName(v.trim());
            setAskName(false);
          }}
        />
      )}

      {/* New comment composer bubble (edge-safe) */}
      {composer &&
        (() => {
          // w-72 => 18rem = 288px; approx height for clamp
          const compW = 288;
          const compH = 180;
          const baseLeft = rect.left + composer.left;
          const baseTop = rect.top + composer.top;
          const placed = placePopover(baseLeft, baseTop, compW, compH, "below");
          return (
            <div
              style={{
                position: "fixed",
                left: placed.left,
                top: placed.top,
                transform: placed.transform,
                zIndex: 70,
                pointerEvents: "auto",
              }}
            >
              <div className="w-72 max-w-[86vw] rounded-lg border border-gray-300 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[11px] text-dark dark:text-neutral-400">
                    {(displayName || currentUser?.name)
                      ? `Komentujesz jako: ${displayName || currentUser?.name}`
                      : "Komentujesz jako: —"}
                  </div>
                  <button
                    onClick={() => setAskName(true)}
                    className="rounded text-[11px] text-dark underline-offset-2 hover:underline dark:text-neutral-300"
                    type="button"
                  >
                    Ustaw nazwę
                  </button>
                </div>
                <textarea
                  autoFocus
                  rows={3}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Dodaj komentarz…"
                  className="w-full resize-none rounded border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-950"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button className="rounded border px-3 py-1 text-sm dark:border-neutral-700" onClick={cancelCreate}>
                    Anuluj
                  </button>
                  <button
                    className={`rounded px-3 py-1 text-sm text-white ${
                      draft.trim() ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-400 opacity-70"
                    }`}
                    disabled={!draft.trim()}
                    onClick={confirmCreate}
                  >
                    Dodaj
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Pins + previews + thread cards */}
      {threads.map(({ root, replies, liveX, liveY, fresh, count }) => {
        // keep pins nicely visible even on drastic viewport changes
        const pos = pinScreenPos(liveX, liveY);
        const isOpen = openThreadId === root.id;
        const isHover = hoverThreadId === root.id && !drag;

        return (
          <div key={root.id} style={{ pointerEvents: "none" }}>
            {/* Pin */}
            <button
              type="button"
              aria-label="Komentarz"
              title="Przeciągnij, aby przenieść. Kliknij, aby otworzyć."
              onMouseEnter={() => setHoverThreadId(root.id)}
              onMouseLeave={() => setHoverThreadId((c) => (c === root.id ? null : c))}
              onMouseDown={(e) => startDrag(e, root.id, root.x ?? 0, root.y ?? 0)}
              style={{
                position: "fixed",
                left: pos.left,
                top: pos.top,
                transform: "translate(-50%, -100%)",
                zIndex: 55,
                pointerEvents: "auto",
                transition:
                  isDraggingId === root.id ? "none" : "left 120ms linear, top 120ms linear, transform 120ms ease",
              }}
              className="group relative inline-flex h-[30px] w-[30px] items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setOpenThreadId(root.id);
              }}
            >
              <ChatBubblePin className="drop-shadow-sm transition-transform group-active:scale-95 text-indigo-600 dark:text-indigo-400" />
              {/* Count */}
              <span
                className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded bg-indigo-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-neutral-950"
                style={{ pointerEvents: "none" }}
              >
                {count}
              </span>
              {/* Fresh ping */}
              {fresh && (
                <span
                  className="absolute -left-1 -bottom-1 inline-block h-2 w-2 animate-ping rounded bg-emerald-500"
                  style={{ pointerEvents: "none" }}
                  aria-hidden
                />
              )}
            </button>

            {/* Hover preview (edge-safe) */}
            {isHover &&
              !isOpen &&
              (() => {
                const prevW = 260,
                  prevH = 90;
                const placed = placePopover(pos.left + 14, pos.top - 8, prevW, prevH, "right");
                return (
                  <HoverPreview
                    left={placed.left}
                    top={placed.top}
                    body={root.body}
                    author={root.author_name || "Gość"}
                    createdAt={root.created_at}
                  />
                );
              })()}

            {/* Thread card (edge-safe) */}
            {isOpen &&
              (() => {
                const cardW = 320,
                  cardH = 420; // approx; clamping keeps it safe
                const placed = placePopover(pos.left + 14, pos.top - 8, cardW, cardH, "right");
                return (
                  <ThreadCard
                    left={placed.left}
                    top={placed.top}
                    root={root}
                    replies={replies}
                    onClose={() => setOpenThreadId(null)}
                    onReply={async (text) => {
                      const t = text.trim();
                      if (!t) return;
                      const authorName = displayName || currentUser?.name || (await ensureName());
                      await addReply(root.id, {
                        body: t,
                        authorId: currentUser?.id ?? null,
                        authorName,
                      });
                    }}
                    onUpdateMeta={async (nextMeta) => {
                      if (hasRest()) {
                        try {
                          await patchJSON(`${REST_BASE}/comments?id=eq.${root.id}`, { meta: nextMeta });
                        } catch {
                          saveMetaLocal(root.id, nextMeta);
                        }
                      } else {
                        saveMetaLocal(root.id, nextMeta);
                      }
                    }}
                    onDelete={async () => {
                      await removeThread(root.id);
                      setOpenThreadId(null);
                    }}
                  />
                );
              })()}
          </div>
        );
      })}
    </>
  );
}

/* ===================== Visuals & UI bits ===================== */

function ChatBubblePin({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="26"
      height="26"
      className={className}
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))", background: "white", borderRadius: 8 }}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"
      />
    </svg>
  );
}

function HoverPreview({
  left,
  top,
  body,
  author,
  createdAt,
}: {
  left: number;
  top: number;
  body: string;
  author: string;
  createdAt: string;
}) {
  const short = body.length > 120 ? body.slice(0, 120) + "…" : body;
  return (
    <div
      style={{ position: "fixed", left, top, zIndex: 60, pointerEvents: "none" }}
      className="max-w-[280px] rounded border border-gray-200 bg-white p-2 text-xs shadow-md dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="mb-1 line-clamp-3 text-gray-800 dark:text-neutral-100">{short || "—"}</div>
      <div className="text-[11px] text-dark dark:text-neutral-400">
        {author} · {new Date(createdAt).toLocaleString()}
      </div>
    </div>
  );
}

/** Thread card with replies + composer + compact preset-only resolution meta + inline delete confirm */
function ThreadCard({
  left,
  top,
  root,
  replies,
  onClose,
  onReply,
  onUpdateMeta,
  onDelete,
}: {
  left: number;
  top: number;
  root: { id: string; body: string; author_name: string | null; created_at: string; meta?: any };
  replies: { id: string; body: string; author_name: string | null; created_at: string }[];
  onClose: () => void;
  onReply: (text: string) => Promise<void>;
  onUpdateMeta: (meta: ResolutionMeta) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  // Seed with existing meta
  const initialMeta: ResolutionMeta = {
    view: (root.meta?.view as ViewKind) ?? undefined,
    presetId: root.meta?.presetId ?? null,
    orientation: (root.meta?.orientation as Orientation) ?? "portrait",
    width: root.meta?.width ?? null,
    height: root.meta?.height ?? null,
    note: root.meta?.note ?? null,
  };
  const [meta, setMeta] = useState<ResolutionMeta>(initialMeta);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmDel, setConfirmDel] = useState(false);

  // Compute current preset list (by selected view; default to desktop)
  const activeView: ViewKind = meta.view ?? "desktop";
  const presetList = PRESETS[activeView];
  const currentPreset = presetList.find((p) => p.id === meta.presetId) || presetList[0];

  // Helper: build derived width/height from preset + orientation
  function dimsFor(preset: { w: number; h: number }, orient: Orientation) {
    return orient === "landscape"
      ? { width: preset.h, height: preset.w }
      : { width: preset.w, height: preset.h };
  }

  // Queue save to store meta (Supabase or local)
  function queueSave(next: ResolutionMeta) {
    setMeta(next);
    setSaving("saving");
    onUpdateMeta(next)
      .then(() => {
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 600);
      })
      .catch(() => setSaving("idle"));
  }

  // Change handlers (keep it minimal, one line)
  function changeView(v: ViewKind) {
    const firstPreset = PRESETS[v][0];
    const { width, height } = dimsFor(firstPreset, meta.orientation ?? "portrait");
    queueSave({ ...meta, view: v, presetId: firstPreset.id, width, height });
  }
  function changePreset(presetId: string) {
    const preset = presetList.find((p) => p.id === presetId) || presetList[0];
    const { width, height } = dimsFor(preset, meta.orientation ?? "portrait");
    queueSave({ ...meta, presetId: preset.id, width, height });
  }
  function changeOrientation(orient: Orientation) {
    const preset = currentPreset;
    const { width, height } = dimsFor(preset, orient);
    queueSave({ ...meta, orientation: orient, width, height });
  }
  function changeNote(val: string) {
    queueSave({ ...meta, note: val || null });
  }

  return (
    <div
      style={{ position: "fixed", left, top, zIndex: 70, pointerEvents: "auto" }}
      className="w-[320px] max-w-[86vw] rounded-lg border border-gray-300 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      role="dialog"
      aria-label="Komentarz"
    >
      {/* Header / root */}
      <div className="mb-2 flex items-start gap-2">
        <div className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-600 text-[10px] font-semibold text-white">
          C
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-dark dark:text-neutral-400">
            {root.author_name || "Gość"} · {new Date(root.created_at).toLocaleString()}
          </div>
          <div className="text-sm">{root.body}</div>
        </div>
        <div className="flex items-center gap-1">
          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              title="Usuń wątek"
            >
              Usuń
            </button>
          ) : (
            <>
              <button
                onClick={async () => {
                  await onDelete();
                }}
                className="rounded px-2 py-1 text-xs text-white bg-rose-600 hover:bg-rose-700"
                title="Tak, usuń"
              >
                Tak
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                title="Nie"
              >
                Nie
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-dark hover:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Zamknij"
          >
            ×
          </button>
        </div>
      </div>

      {/* Compact one-line preset/orientation/note */}
      <div className="mb-2 rounded border border-gray-200 p-2 text-xs dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* View */}
          <select
            value={activeView}
            onChange={(e) => changeView(e.target.value as ViewKind)}
            className="rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-950"
            title="Widok"
          >
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>

          {/* Preset (based on view) */}
          <select
            value={currentPreset.id}
            onChange={(e) => changePreset(e.target.value)}
            className="min-w-[150px] max-w-[180px] flex-1 truncate rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-950"
            title="Preset rozdzielczości"
          >
            {presetList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Orientation */}
          <select
            value={meta.orientation ?? "portrait"}
            onChange={(e) => changeOrientation(e.target.value as Orientation)}
            className="rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-950"
            title="Orientacja"
          >
            <option value="portrait">Pion</option>
            <option value="landscape">Poziom</option>
          </select>

          {/* Note */}
          <input
            type="text"
            placeholder="Notatka"
            value={meta.note ?? ""}
            onChange={(e) => changeNote(e.target.value)}
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-1.5 py-1 dark:border-neutral-700 dark:bg-neutral-950"
            title="Notatka (opcjonalnie)"
          />

          {saving !== "idle" && (
            <span className="text-[11px] text-dark dark:text-neutral-400">
              {saving === "saving" ? "Zapisywanie…" : "Zapisano"}
            </span>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mb-2 space-y-2 border-l-2 border-gray-200 pl-2 text-sm dark:border-neutral-800">
          {replies.map((r) => (
            <div key={r.id}>
              <div className="text-[11px] text-dark dark:text-neutral-400">
                {r.author_name || "Gość"} · {new Date(r.created_at).toLocaleString()}
              </div>
              <div>{r.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Reply composer */}
      <ReplyBox onReply={onReply} />
    </div>
  );
}

function ReplyBox({ onReply }: { onReply: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;
  return (
    <div className="mt-2 flex items-start gap-2">
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Napisz odpowiedź…"
        className="flex-1 resize-none rounded border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-950"
      />
      <button
        disabled={!canSend}
        onClick={async () => {
          if (!canSend) return;
          await onReply(text);
          setText("");
        }}
        className={`self-end rounded px-3 py-1 text-sm text-white ${
          canSend ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-400 opacity-70"
        }`}
      >
        Wyślij
      </button>
    </div>
  );
}

/** Floating helper (counts, view switch, add mode, identity) */
function HelperPanel({
  view,
  onView,
  addMode,
  setAddMode,
  counts,
  displayName,
  onAskName,
}: {
  view: ViewKind;
  onView: (v: ViewKind) => void;
  addMode: boolean;
  setAddMode: (v: boolean) => void;
  counts: { desktop: number | string; tablet: number | string; mobile: number | string };
  displayName: string;
  onAskName: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PANEL_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.collapsed === "boolean") setCollapsed(parsed.collapsed);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify({ collapsed }));
    } catch {}
  }, [collapsed]);

  return (
    <div
      style={{ position: "fixed", right: 16, bottom: 16, zIndex: 90 }}
      className="pointer-events-auto w-[320px] max-w-[92vw] rounded-xl border border-gray-200 bg-white/90 p-3 text-sm shadow-xl backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/85"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">
          Komentarze{" "}
          <span className="ml-2 text-xs text-dark dark:text-neutral-300">
            D:{counts.desktop} · T:{counts.tablet} · M:{counts.mobile}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          aria-expanded={!collapsed}
          title={collapsed ? "Pokaż instrukcje" : "Zwiń panel"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 120ms linear" }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-gray-700 dark:text-neutral-300">
          <li>
            <b>Desktop:</b> przytrzymaj{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-neutral-800">Alt</code> i kliknij — dodasz pinezkę.
          </li>
          <li>
            <b>Mobile/Tablet:</b> włącz <i>Dodaj pinezkę</i>, a następnie tapnij w miejscu komentarza.
          </li>
          <li>Kliknij pinezkę, aby otworzyć wątek, dodać odpowiedź lub przeciągnij, by przenieść.</li>
        </ol>
      )}

      <div className="mb-2 text-xs text-dark dark:text-neutral-300">
        Jako: {displayName || "—"}{" "}
        <button onClick={onAskName} className="ml-2 rounded px-1 text-[11px] underline-offset-2 hover:underline" title="Ustaw nazwę komentującego">
          Zmień
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded border border-gray-300 dark:border-neutral-700">
          {(["desktop", "tablet", "mobile"] as ViewKind[]).map((v) => (
            <button
              key={v}
              className={`px-2.5 py-1.5 text-xs ${
                view === v ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"
              }`}
              onClick={() => onView(v)}
              aria-pressed={view === v}
              title={`Widok: ${v}`}
            >
              {v === "desktop" ? "Desktop" : v === "tablet" ? "Tablet" : "Mobile"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAddMode(!addMode)}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            addMode ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-neutral-100"
          }`}
          title="Tryb dodawania pinezek (Mobile/Tablet)"
        >
          {addMode ? "Dodaj pinezkę: WŁ" : "Dodaj pinezkę"}
        </button>
      </div>
    </div>
  );
}

/** Simple modal to set the display name once */
function NameModal({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial || "");
  const can = name.trim().length > 0;
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-[360px] max-w-[92vw] rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-2 text-sm font-semibold">Twoje imię (widoczne przy komentarzach)</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Jan K."
          className="w-full rounded border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button className="rounded border px-3 py-1 text-sm dark:border-neutral-700" onClick={onCancel}>
            Anuluj
          </button>
          <button
            disabled={!can}
            onClick={() => can && onSave(name)}
            className={`rounded px-3 py-1 text-sm text-white ${
              can ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-400 opacity-70"
            }`}
          >
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== local meta fallback ===================== */

function loadMetaLocalMap(): Record<string, ResolutionMeta> {
  try {
    const raw = localStorage.getItem(META_FALLBACK_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}
function saveMetaLocal(id: string, meta: ResolutionMeta) {
  try {
    const map = loadMetaLocalMap();
    map[id] = meta;
    localStorage.setItem(META_FALLBACK_KEY, JSON.stringify(map));
  } catch {}
}
