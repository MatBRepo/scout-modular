// src/app/api/admin/activate-account/route.ts
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json(
                { error: "userId jest wymagany." },
                { status: 400 }
            );
        }

        const supabase = getSupabase();

        // Update profile to set active = true
        const { error } = await supabase
            .from("profiles")
            .update({ active: true })
            .eq("id", userId);

        if (error) {
            console.error("Błąd aktywacji konta:", error);
            return NextResponse.json(
                { error: `Błąd Supabase: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Konto zostało aktywowane.",
        });
    } catch (err: any) {
        console.error("Fatalny błąd API activate-account:", err);
        return NextResponse.json(
            { error: err.message || "Wewnętrzny błąd serwera." },
            { status: 500 }
        );
    }
}
