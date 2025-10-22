"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useComments } from "./useComments";

/**
 * CommentLayer
 * - Desktop: Alt+Klik w obszarze treści => nowa pinezka + okno wpisu
 * - Mobile/Tablet: włącz "Dodaj pinezkę", potem tapnij w obszar, aby dodać
 * - Najazd (hover) => podgląd skrótu
 * - Kliknięcie pinezki => otwiera wątek (komentarz + odpowiedzi)
 * - Przeciąganie pinezki => zmiana pozycji (zapis po puszczeniu)
 * - Przełącznik widoku: Desktop / Tablet / Mobile -> osobne zestawy komentarzy
 */

type ViewKind = "desktop" | "tablet" | "mobile";

export default function CommentLayer({
  pageKey,
  containerSelector = "#content",
  currentUser,
  initialView = "desktop",
}: {
  pageKey: string | null; // np. pathname
  containerSelector?: string; // CSS selektor wrappera
  currentUser?: { id?: string; name?: string } | null;
  initialView?: ViewKind;
}) {
  // ===== view switch: namespace comments per view =====
  const [view, setView] = useState<ViewKind>(initialView);
  const key = (pageKey ?? "global") + "::" + view;

  // ===== hook to Supabase comments =====
  const { roots, repliesByThread, addPoint, addReply, movePoint, remove } = useComments(key);

  // ===== container / geometry =====
  const [rect, setRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // ===== UI state =====
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [hoverThreadId, setHoverThreadId] = useState<string | null>(null);

  // Composer to create a new root comment
  const [composer, setComposer] = useState<{ xPct: number; yPct: number; left: number; top: number } | null>(null);
  const [draft, setDraft] = useState("");

  // “Add pin” mode for touch devices
  const [addMode, setAddMode] = useState(false);

  // Drag state (no-jump + rAF)
  const [drag, setDrag] = useState<{
    id: string;
    // where the cursor grabbed the pin (offset from pin center), px
    grabOffsetX: number;
    grabOffsetY: number;
    // live position (percentages)
    livePctX: number;
    livePctY: number;
    moved: boolean;
  } | null>(null);
  const moveRAF = useRef<number | null>(null);

  // ===== container rect & hydration-safe mount =====
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

  // Helpers: screen coords → percentages within container
  function toPctFromClient(clientX: number, clientY: number) {
    if (!rect) return { xPct: 0, yPct: 0, left: 0, top: 0 };
    const xPct = clamp01((clientX - rect.left) / rect.width);
    const yPct = clamp01((clientY - rect.top) / rect.height);
    return { xPct, yPct, left: clientX - rect.left, top: clientY - rect.top };
  }
  function pinPos(xPct: number, yPct: number) {
    if (!rect) return { left: -9999, top: -9999 };
    return { left: rect.left + xPct * rect.width, top: rect.top + yPct * rect.height };
  }

  // ===== placing pins =====

  // Desktop: Alt+click places composer
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rect || !e.altKey) return;
      const wrap = containerRef.current;
      if (!wrap || !wrap.contains(e.target as Node)) return;
      e.preventDefault();
      const p = toPctFromClient(e.clientX, e.clientY);
      setOpenThreadId(null);
      setHoverThreadId(null);
      setDraft("");
      setComposer({ xPct: p.xPct, yPct: p.yPct, left: p.left, top: p.top });
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [rect]);

  // Touch / mobile: “addMode” tap anywhere inside container to place
  useEffect(() => {
    if (!addMode) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const wrap = containerRef.current;
      if (!wrap) return;
      const target = e.target as Node;
      if (!wrap.contains(target)) return;

      let clientX = 0,
        clientY = 0;
      if (e instanceof TouchEvent) {
        const t = e.touches[0] || e.changedTouches[0];
        if (!t) return;
        clientX = t.clientX;
        clientY = t.clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      const p = toPctFromClient(clientX, clientY);
      setOpenThreadId(null);
      setHoverThreadId(null);
      setDraft("");
      setComposer({ xPct: p.xPct, yPct: p.yPct, left: p.left, top: p.top });
      setAddMode(false); // single-shot place
    };

    // Use capture on click to beat inner elements
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

  // ===== Pin interactions (NO-JUMP drag with cursor–center offset) =====
  function startDrag(e: React.MouseEvent, id: string, xPct: number, yPct: number) {
    e.preventDefault();
    setComposer(null);
    setOpenThreadId(null);
    setHoverThreadId(null);

    // Calculate offset: how far the cursor is from pin center at grab time
    const pinCenter = pinPos(xPct, yPct); // absolute px
    const centerX = pinCenter.left;
    const centerY = pinCenter.top;

    const grabOffsetX = e.clientX - centerX;
    const grabOffsetY = e.clientY - centerY;

    setDrag({
      id,
      grabOffsetX,
      grabOffsetY,
      livePctX: xPct,
      livePctY: yPct,
      moved: false,
    });
  }

  // rAF-throttled mouse move
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag || !rect) return;

      const targetCenterX = e.clientX - drag.grabOffsetX;
      const targetCenterY = e.clientY - drag.grabOffsetY;

      // clamp to container
      const clampedX = Math.min(Math.max(targetCenterX, rect.left), rect.right);
      const clampedY = Math.min(Math.max(targetCenterY, rect.top), rect.bottom);

      const next = toPctFromClient(clampedX, clampedY);
      const moved = drag.moved || true; // treat as moved when mouse moves

      if (moveRAF.current) cancelAnimationFrame(moveRAF.current);
      moveRAF.current = requestAnimationFrame(() => {
        setDrag((d) =>
          d && d.id === drag.id
            ? {
                ...d,
                livePctX: next.xPct,
                livePctY: next.yPct,
                moved,
              }
            : d
        );
      });
    }

    async function onUp() {
      if (!drag) return;
      if (!drag.moved) {
        // treat as click -> open thread
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

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, rect, movePoint]);

  // Keyboard delete on open thread
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!openThreadId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(openThreadId);
        setOpenThreadId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openThreadId, remove]);

  // ===== compute threads with live positions =====
  const threads = useMemo(() => {
    return roots.map((r) => ({
      root: r,
      replies: repliesByThread[r.id] ?? [],
      liveX: drag?.id === r.id ? drag.livePctX : r.x ?? 0,
      liveY: drag?.id === r.id ? drag.livePctY : r.y ?? 0,
    }));
  }, [roots, repliesByThread, drag]);

  if (!rect) return null;

  return (
    <>
      {/* Helper panel: instructions + view switch + add pin toggle */}
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

      {/* Composer bubble (new thread) */}
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

      {/* Pins + hover previews + thread cards */}
      {threads.map(({ root, replies, liveX, liveY }) => {
        const pos = pinPos(liveX, liveY);
        const isOpen = openThreadId === root.id;
        const isHover = hoverThreadId === root.id && !drag;

        return (
          <div key={root.id} style={{ pointerEvents: "none" }}>
            {/* Pin button */}
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
                transition: drag?.id === root.id ? "none" : "transform 140ms ease-out, box-shadow 140ms ease-out, background-color 120ms ease-out",
              }}
              className="relative inline-flex h-[30px] w-[30px] items-center justify-center active:scale-[.97]"
              onClick={(e) => {
                e.stopPropagation(); // avoid bubbling while toggling
                if (drag?.id) return; // ignore click at the end of drag
                setOpenThreadId((id) => (id === root.id ? null : root.id));
              }}
            >
              {/* The pin UI (chat bubble icon you requested) */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow ring-2 ring-white hover:bg-indigo-700">
                <ChatBubblePin />
              </div>
              {/* Tail */}
              <span className="absolute -bottom-1 left-1/2 block h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] bg-indigo-600" />
            </button>

            {/* Hover preview */}
            {isHover && !isOpen && (
              <HoverPreview
                left={pos.left + 14}
                top={pos.top - 8}
                body={root.body}
                author={root.author_name || "Gość"}
                createdAt={root.created_at}
              />
            )}

            {/* Thread card */}
            {isOpen && (
              <ThreadCard
                left={pos.left + 14}
                top={pos.top - 8}
                root={root}
                replies={replies}
                onClose={() => setOpenThreadId(null)}
                onRemove={() => {
                  remove(root.id);
                  setOpenThreadId(null);
                }}
                onReply={async (text) => {
                  const t = text.trim();
                  if (!t) return;
                  await addReply(root.id, {
                    body: t,
                    authorId: currentUser?.id ?? null,
                    authorName: currentUser?.name ?? null,
                  });
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ===================== Visuals & UI bits ===================== */

function clamp01(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Your chat-bubble-with-dots pin (exact path; color via currentColor) */
function ChatBubblePin() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"
      />
    </svg>
  );
}

/** Tiny hover preview */
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

/** Thread card with replies + composer + delete */
function ThreadCard({
  left,
  top,
  root,
  replies,
  onClose,
  onRemove,
  onReply,
}: {
  left: number;
  top: number;
  root: { id: string; body: string; author_name: string | null; created_at: string };
  replies: { id: string; body: string; author_name: string | null; created_at: string }[];
  onClose: () => void;
  onRemove: () => void;
  onReply: (text: string) => Promise<void>;
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
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            title="Usuń pinezkę"
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
        <div className="mb-2 max-h-40 space-y-2 overflow-auto border-l-2 border-gray-200 pl-2 pr-1 dark:border-neutral-800">
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

/** Floating helper with instructions + view switch + add-pin toggle */
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
        <li>Kliknij pinezkę, aby otworzyć wątek, dodawać odpowiedzi lub przeciągnąć, by zmienić pozycję.</li>
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
