// src/features/comments/useComments.ts
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

/** Row shape that matches your DB schema */
export type CommentRow = {
  id: string;
  page_key: string;
  thread_id: string | null;  // root has thread_id = id
  body: string;              // NOT NULL
  author_id: string | null;
  author_name: string | null;
  x: number | null;          // 0..1 for root pins
  y: number | null;
  created_at: string;
};

function isUUID(v?: string) {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function useComments(pageKey: string) {
  // supabase client is created on the client only
  const supabase = useRef(getSupabase()).current;

  const [rows, setRows] = useState<CommentRow[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("page_key", pageKey)
      .order("created_at", { ascending: true });
    if (!error && data) setRows(data as CommentRow[]);
    if (error) console.error(error);
  }, [pageKey, supabase]);

  useEffect(() => {
    // initial load
    refresh();

    // realtime subscription scoped to pageKey
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`comments:${pageKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `page_key=eq.${pageKey}` },
        () => refresh()
      )
      .subscribe();

    // IMPORTANT: cleanup must NOT return a Promise
    return () => {
      try {
        channelRef.current?.unsubscribe();
      } catch {}
    };
  }, [pageKey, refresh, supabase]);

  /** Create a root pin (thread). Then make it the root by setting thread_id=id. */
  async function addPoint(opts: {
    xPct: number; yPct: number;
    body: string;
    authorId?: string | null;
    authorName?: string | null;
  }) {
    const payload: any = {
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

    if (data && data.id && !data.thread_id) {
      const { error: e2 } = await supabase
        .from("comments")
        .update({ thread_id: data.id })
        .eq("id", data.id);
      if (e2) throw e2;
    }
  }

  /** Move a root pin */
  async function movePoint(id: string, xPct: number, yPct: number) {
    const { error } = await supabase.from("comments").update({ x: xPct, y: yPct }).eq("id", id);
    if (error) throw error;
  }

  /** Delete a single comment (reply or orphan) */
  async function remove(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) throw error;
  }

  /** Delete a whole thread: root + its replies */
  async function removeThread(threadId: string) {
    const { error } = await supabase
      .from("comments")
      .delete()
      .or(`id.eq.${threadId},thread_id.eq.${threadId}`);
    if (error) throw error;
  }

  /** Add a reply to a thread */
  async function addReply(threadId: string, opts: {
    body: string;
    authorId?: string | null;
    authorName?: string | null;
  }) {
    const payload: any = {
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

  // split into roots & replies
  const roots = rows.filter(r => r.thread_id === r.id);
  const repliesByThread = useMemo(() => {
    return rows
      .filter(r => r.thread_id && r.thread_id !== r.id)
      .reduce<Record<string, CommentRow[]>>((acc, r) => {
        (acc[r.thread_id!] ||= []).push(r);
        return acc;
      }, {});
  }, [rows]);

  return { rows, roots, repliesByThread, addPoint, addReply, movePoint, remove, removeThread };
}
