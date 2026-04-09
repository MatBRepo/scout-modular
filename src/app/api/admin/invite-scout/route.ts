// src/app/api/admin/invite-scout/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { email, name, role = "scout" } = await req.json();

        if (!email || !name) {
            return NextResponse.json(
                { error: "Email and name are required." },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();

        // 1. Check if user already exists (optional, but we must create a profile anyway)
        // Supabase generateLink will create the user in Auth if they don't exist.

        // 2. Generate magic link
        // Note: generateLink returns a link that expires and is one-time use.
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: email,
            options: {
                data: {
                    full_name: name,
                    role: role,
                },
                // You can set redirectTo if you want
                // redirectTo: `${new URL(req.url).origin}/auth/callback`,
            },
        });

        if (linkError) {
            console.error("Error generating link:", linkError);
            return NextResponse.json(
                { error: `Supabase error: ${linkError.message}` },
                { status: 500 }
            );
        }

        const magicLink = linkData.properties.action_link;

        // 3. (Optional) Create profile in profiles table if it doesn't exist yet
        // Sometimes triggers do this, but it's better to ensure manually if the system requires it.
        const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
            id: linkData.user.id,
            full_name: name,
            email: email,
            role: role,
            active: true,
        });

        if (profileError) {
            console.warn("Error creating profile (auth user created):", profileError);
        }

        // 4. Send e-mail via PHP mailer
        const phpMailerUrl = process.env.PHP_MAILER_URL;
        let mailSent = false;
        let mailError = null;

        if (phpMailerUrl) {
            try {
                const mailRes = await fetch(phpMailerUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email,
                        name,
                        link: magicLink,
                    }),
                });

                if (mailRes.ok) {
                    mailSent = true;
                } else {
                    mailError = `PHP Mailer returned ${mailRes.status}`;
                }
            } catch (err: any) {
                mailError = err.message;
                console.error("Error connecting to PHP Mailer:", err);
            }
        } else {
            console.warn("PHP_MAILER_URL is not configured. Link generated, but e-mail not sent.");
        }

        return NextResponse.json({
            success: true,
            mailSent,
            mailError,
            // Returning link in response as fallback for admin (for manual copy)
            link: magicLink,
        });
    } catch (err: any) {
        console.error("Fatal invite-scout API error:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error." },
            { status: 500 }
        );
    }
}
