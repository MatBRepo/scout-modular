"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** Row shape that matches your DB schema */
export type CommentRow = {
  id: string;
  page_key: string;
  thread_id: string | null;         // root has thread_id = id
  body: string;                     // NOT NULL
  author_id: string | null;
  author_name: string | null;
  x: number | null;                 // 0..1 for root pins
  y: number | null;
  created_at: string;
};

function isUUID(v?: string) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function useComments(pageKey: string) {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("page_key", pageKey)
      .order("created_at", { ascending: true });

    if (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return;
    }
    setRows((data ?? []) as CommentRow[]);
  }, [pageKey]);

  useEffect(() => {
    // initial load
    refresh();

    // tear down previous channel (don’t return the promise!)
    if (channelRef.current) {
      void channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    // subscribe for this pageKey
    const ch = supabase
      .channel(`comments:${pageKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `page_key=eq.${pageKey}` },
        () => { void refresh(); }
      )
      .subscribe();

    channelRef.current = ch;

    // cleanup: fire-and-forget promise so React sees a sync function
    return () => {
      void ch.unsubscribe();
    };
  }, [pageKey, refresh]);

  /** Create a root pin (anchor) and set thread_id = id */
  async function addPoint(opts: {
    xPct: number; yPct: number;
    body: string;
    authorId?: string | null;
    authorName?: string | null;
  }) {
    const payload: Record<string, any> = {
      page_key: pageKey,
      body: opts.body,
      x: opts.xPct,
      y: opts.yPct,
      author_name: opts.authorName ?? null,
    };
    if (opts.authorId && isUUID(opts.authorId)) payload.author_id = opts.authorId;

    const { data, error } = await supabase
      .from("comments")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    // Make it the thread root (thread_id = id)
    if (data?.id && !data.thread_id) {
      const { error: e2 } = await supabase
        .from("comments")
        .update({ thread_id: data.id })
        .eq("id", data.id);
      if (e2) throw e2;
    }
  }

  /** Move a root pin */
  async function movePoint(id: string, xPct: number, yPct: number) {
    const { error } = await supabase
      .from("comments")
      .update({ x: xPct, y: yPct })
      .eq("id", id);
    if (error) throw error;
  }

  /** Delete any comment (root or reply) */
  async function remove(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) throw error;
  }

  /** Add a reply to threadId */
  async function addReply(
    threadId: string,
    opts: { body: string; authorId?: string | null; authorName?: string | null }
  ) {
    const payload: Record<string, any> = {
      page_key: pageKey,
      thread_id: threadId,
      body: opts.body,
      author_name: opts.authorName ?? null,
      x: null,
      y: null,
    };
    if (opts.authorId && isUUID(opts.authorId)) payload.author_id = opts.authorId;

    const { error } = await supabase.from("comments").insert(payload);
    if (error) throw error;
  }

  // Split into roots and replies
  const roots = rows.filter((r) => r.thread_id === r.id);
  const repliesByThread = rows
    .filter((r) => r.thread_id && r.thread_id !== r.id)
    .reduce<Record<string, CommentRow[]>>((acc, r) => {
      (acc[r.thread_id!] ||= []).push(r);
      return acc;
    }, {});

  return { rows, roots, repliesByThread, addPoint, addReply, movePoint, remove };
}
