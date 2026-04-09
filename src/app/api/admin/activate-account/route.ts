// src/app/api/admin/activate-account/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required." },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();

        // 1. Confirm email in Supabase Auth (Auth System)
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { email_confirm: true }
        );

        if (authError) {
            console.error("Error activating Auth:", authError);
            return NextResponse.json(
                { error: `Auth Error: ${authError.message}` },
                { status: 500 }
            );
        }

        // 2. Update profile to set active = true (Application Data)
        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .update({ active: true })
            .eq("id", userId);

        if (profileError) {
            console.error("Error activating profile:", profileError);
            return NextResponse.json(
                { error: `Profile Error: ${profileError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Account activated and email confirmed.",
        });
    } catch (err: any) {
        console.error("Fatal activate-account API error:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error." },
            { status: 500 }
        );
    }
}
