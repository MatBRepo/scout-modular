// src/features/comments/CommentLayer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useComments } from "./useComments";

type ViewKind = "desktop" | "tablet" | "mobile";

export default function CommentLayer({
  pageKey,
  containerSelector = "#content",
  currentUser,
  initialView = "desktop",
}: {
  pageKey: string | null;
  containerSelector?: string;
  currentUser?: { id?: string; name?: string } | null;
  initialView?: ViewKind;
}) {
  const [view, setView] = useState<ViewKind>(initialView);
  const key = (pageKey ?? "global") + "::" + view;

  const { roots, repliesByThread, addPoint, addReply, movePoint, removeThread } = useComments(key);

  const [rect, setRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [hoverThreadId, setHoverThreadId] = useState<string | null>(null);

  const [composer, setComposer] = useState<{ xPct: number; yPct: number; left: number; top: number } | null>(null);
  const [draft, setDraft] = useState("");

  const [addMode, setAddMode] = useState(false);

  const [drag, setDrag] = useState<{
    id: string;
    startX: number; startY: number;
    startPctX: number; startPctY: number;
    livePctX: number; livePctY: number;
    moved: boolean;
  } | null>(null);

  // mount container + rect
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

  // helpers
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

  // alt+click to compose
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

  // mobile add mode
  useEffect(() => {
    if (!addMode) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const wrap = containerRef.current;
      if (!wrap) return;
      const target = e.target as Node;
      if (!wrap.contains(target)) return;

      let clientX = 0, clientY = 0;
      if (e instanceof TouchEvent) {
        const t = e.changedTouches[0] || e.touches[0];
        if (!t) return;
        clientX = t.clientX; clientY = t.clientY;
      } else {
        clientX = (e as MouseEvent).clientX; clientY = (e as MouseEvent).clientY;
      }
      const p = toPct(clientX, clientY);
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
    await addPoint({
      xPct: composer.xPct,
      yPct: composer.yPct,
      body,
      authorId: currentUser?.id ?? null,
      authorName: currentUser?.name ?? null,
    });
    setComposer(null);
    setDraft("");
  }
  function cancelCreate() {
    setComposer(null);
    setDraft("");
  }

  // drag handlers (with gentle transitions)
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
        // treat as click
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

  const threads = useMemo(() => {
    return roots.map((r) => ({
      root: r,
      replies: repliesByThread[r.id] ?? [],
      liveX: drag?.id === r.id ? drag.livePctX : r.x ?? 0,
      liveY: drag?.id === r.id ? drag.livePctY : r.y ?? 0,
    }));
  }, [roots, repliesByThread, drag]);

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
      />

      {/* composer bubble */}
      {composer && (
        <div
          style={{
            position: "fixed",
            left: rect.left + composer.left,
            top: rect.top + composer.top + 12,
            transform: "translate(-50%, 0)",
            zIndex: 70,
            pointerEvents: "auto",
          }}
        >
          <div className="w-72 max-w-[86vw] rounded-lg border border-gray-300 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Dodaj komentarz…"
              className="w-full resize-none rounded border border-gray-300 p-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button className="rounded-md border px-3 py-1 text-sm dark:border-neutral-700" onClick={cancelCreate}>
                Anuluj
              </button>
              <button
                className={`rounded-md px-3 py-1 text-sm text-white ${
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
      )}

      {/* pins */}
      {threads.map(({ root, replies, liveX, liveY }) => {
        const pos = pinPos(liveX, liveY);
        const isOpen = openThreadId === root.id;
        const isHover = hoverThreadId === root.id && !drag;

        return (
          <div key={root.id} style={{ pointerEvents: "none" }}>
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
                  isDraggingId === root.id
                    ? "none"
                    : "left 120ms linear, top 120ms linear, transform 120ms ease",
              }}
              className="group relative inline-flex h-[30px] w-[30px] items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <ChatBubblePin className="drop-shadow-sm transition-transform group-active:scale-95 text-indigo-600 dark:text-indigo-400" />
            </button>

            {/* hover preview */}
            {isHover && !isOpen && (
              <HoverPreview
                left={pos.left + 14}
                top={pos.top - 8}
                body={root.body}
                author={root.author_name || "Gość"}
                createdAt={root.created_at}
              />
            )}

            {/* thread card */}
            {isOpen && (
              <ThreadCard
                left={pos.left + 14}
                top={pos.top - 8}
                root={root}
                replies={replies}
                onClose={() => setOpenThreadId(null)}
                onReply={async (text) => {
                  const t = text.trim();
                  if (!t) return;
                  await addReply(root.id, {
                    body: t,
                    authorId: currentUser?.id ?? null,
                    authorName: currentUser?.name ?? null,
                  });
                }}
                onDelete={async () => {
                  if (confirm("Usunąć cały wątek komentarzy?")) {
                    await removeThread(root.id);
                    setOpenThreadId(null);
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ===== visuals ===== */

function ChatBubblePin({ className = "" }: { className?: string }) {
  // Your requested icon (chat-bubble with three dots)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="26"
      height="26"
      className={className}
      style={{
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))",
        background: "white",
        borderRadius: 8,
      }}
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
      className="max-w-[280px] rounded-md border border-gray-200 bg-white p-2 text-xs shadow-md dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="mb-1 line-clamp-3 text-gray-800 dark:text-neutral-100">{short || "—"}</div>
      <div className="text-[11px] text-gray-500 dark:text-neutral-400">
        {author} · {new Date(createdAt).toLocaleString()}
      </div>
    </div>
  );
}

function ThreadCard({
  left,
  top,
  root,
  replies,
  onClose,
  onReply,
  onDelete,
}: {
  left: number;
  top: number;
  root: { id: string; body: string; author_name: string | null; created_at: string };
  replies: { id: string; body: string; author_name: string | null; created_at: string }[];
  onClose: () => void;
  onReply: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;

  return (
    <div
      style={{ position: "fixed", left, top, zIndex: 70, pointerEvents: "auto" }}
      className="w-[300px] max-w-[86vw] rounded-lg border border-gray-300 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      role="dialog"
      aria-label="Komentarz"
    >
      {/* Root */}
      <div className="mb-2 flex items-start gap-2">
        <div className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
          C
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-gray-500 dark:text-neutral-400">
            {root.author_name || "Gość"} · {new Date(root.created_at).toLocaleString()}
          </div>
          <div className="text-sm">{root.body}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            title="Usuń wątek"
          >
            Usuń
          </button>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Zamknij"
          >
            ×
          </button>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mb-2 space-y-2 border-l-2 border-gray-200 pl-2 dark:border-neutral-800">
          {replies.map((r) => (
            <div key={r.id} className="text-sm">
              <div className="text-[11px] text-gray-500 dark:text-neutral-400">
                {r.author_name || "Gość"} · {new Date(r.created_at).toLocaleString()}
              </div>
              <div>{r.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Reply composer */}
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
          className={`self-end rounded-md px-3 py-1 text-sm text-white ${
            canSend ? "bg-gray-900 hover:bg-gray-800" : "bg-gray-400 opacity-70"
          }`}
        >
          Wyślij
        </button>
      </div>
    </div>
  );
}

function HelperPanel({
  view,
  onView,
  addMode,
  setAddMode,
}: {
  view: ViewKind;
  onView: (v: ViewKind) => void;
  addMode: boolean;
  setAddMode: (v: boolean) => void;
}) {
  return (
    <div
      style={{ position: "fixed", right: 16, bottom: 16, zIndex: 90 }}
      className="pointer-events-auto w-[320px] max-w-[92vw] rounded-xl border border-gray-200 bg-white/90 p-3 text-sm shadow-xl backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/85"
    >
      <div className="mb-2 font-semibold">Komentarze (Figma-style)</div>

      <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-gray-700 dark:text-neutral-300">
        <li>
          <b>Desktop:</b> przytrzymaj{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-neutral-800">Alt</code> i kliknij — dodasz pinezkę.
        </li>
        <li>
          <b>Mobile/Tablet:</b> włącz <i>Dodaj pinezkę</i>, a następnie tapnij w miejscu komentarza.
        </li>
        <li>Kliknij pinezkę, aby otworzyć wątek, dodawać odpowiedzi lub przeciągnij, by zmienić pozycję.</li>
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-neutral-700">
          {(["desktop", "tablet", "mobile"] as ViewKind[]).map((v) => (
            <button
              key={v}
              className={`px-2.5 py-1.5 text-xs ${
                view === v ? "bg-gray-900 text-white" : "bg-white text-gray-700 dark:bg-neutral-900 dark:text-neutral-200"
              }`}
              onClick={() => onView(v)}
              aria-pressed={view === v}
            >
              {v === "desktop" ? "Desktop" : v === "tablet" ? "Tablet" : "Mobile"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAddMode(!addMode)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
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
