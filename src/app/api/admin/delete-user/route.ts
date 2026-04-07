// src/app/api/admin/delete-user/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

        const supabaseAdmin = getSupabaseAdmin();

        // 1. Delete from public.profiles (Application Data)
        // Note: Depending on your schema, you might have foreign key constraints
        // If so, you might want to soft-delete or cascade.
        // For now, let's try a direct delete.
        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .delete()
            .eq("id", userId);

        if (profileError) {
            console.error("Błąd usuwania profilu:", profileError);
            return NextResponse.json(
                { error: `Błąd Profilu: ${profileError.message}` },
                { status: 500 }
            );
        }

        // 2. Delete from Supabase Auth (Auth System)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
            // Some environments might not have Auth setup or user might already be gone
            // We'll log it but if profile is gone, we might consider it partially successful
            console.error("Błąd usuwania Auth:", authError);
            return NextResponse.json(
                { error: `Błąd Auth: ${authError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Użytkownik został pomyślnie usunięty z systemu.",
        });
    } catch (err: any) {
        console.error("Fatalny błąd API delete-user:", err);
        return NextResponse.json(
            { error: err.message || "Wewnętrzny błąd serwera." },
            { status: 500 }
        );
    }
}
