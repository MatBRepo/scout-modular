import { NextRequest, NextResponse } from "next/server";

const BASE =
  process.env.LNP_SERVICE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8765";

async function proxy(req: NextRequest, pathParts: string[]) {
  const url = new URL(req.url);
  const target = new URL(`${BASE}/${pathParts.join("/")}`);

  // przenieś query string
  target.search = url.search;

  // przenieś nagłówki (bez hosta)
  const headers = new Headers(req.headers);
  headers.delete("host");

  const method = req.method.toUpperCase();

  const init: RequestInit = {
    method,
    headers,
    // body tylko dla metod z body
    body:
      method === "GET" || method === "HEAD"
        ? undefined
        : await req.arrayBuffer(),
    redirect: "manual",
    cache: "no-store",
  };

  const res = await fetch(target, init);

  // Skopiuj status + content-type
  const outHeaders = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) outHeaders.set("content-type", ct);

  const buf = await res.arrayBuffer();

  return new NextResponse(buf, {
    status: res.status,
    headers: outHeaders,
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path || []);
}
