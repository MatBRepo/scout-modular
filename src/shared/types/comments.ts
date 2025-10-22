export type AnchorType = "point" | "box" | "selector";

export type CommentRow = {
  id: string;
  project: string;
  page_key: string;
  thread_id: string | null;
  body: string;
  author_id: string | null;
  author_name: string | null;
  anchor_type: AnchorType;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  css_selector: string | null;
  meta: any | null;
  created_at: string;
  updated_at: string;
};
