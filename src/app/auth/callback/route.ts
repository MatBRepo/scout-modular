// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?e=missing_code", url.origin));
  }

  // Response, do którego Supabase zapisze cookies
  const response = NextResponse.redirect(new URL("/auth/finish", url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // cookies z requestu
          return (request as any).cookies?.getAll?.() ?? [];
        },
        setAll(cookiesToSet) {
          // zapis do response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchange error:", error);
    return NextResponse.redirect(new URL("/login?e=oauth_exchange", url.origin));
  }

  return response;
}
