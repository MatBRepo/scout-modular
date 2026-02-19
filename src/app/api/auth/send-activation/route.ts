// src/app/api/auth/send-activation/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { email, name, userId } = await req.json();

        if (!email || !userId) {
            return NextResponse.json(
                { error: "Email i userId są wymagane." },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Generate magic link for email confirmation
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: email,
            options: {
                data: {
                    full_name: name,
                },
                redirectTo: `${req.headers.get("origin") || "https://scouting-s4s-dev.entriso.com"}/`,
            },
        });

        if (linkError) {
            console.error("Błąd generowania linku aktywacyjnego:", linkError);
            return NextResponse.json(
                { error: `Błąd Supabase: ${linkError.message}` },
                { status: 500 }
            );
        }

        let activationLink = linkData.properties.action_link;

        // Force correction of redirect_to parameter if it's wrong or pointing to supabase
        try {
            const urlObj = new URL(activationLink);
            const frontendUrl = "https://scouting-s4s-dev.entriso.com/auth/callback";
            urlObj.searchParams.set("redirect_to", frontendUrl);
            activationLink = urlObj.toString();
        } catch (e) {
            console.warn("Could not parse activationLink for correction:", e);
        }

        // Send activation email via PHP mailer
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
                        type: "activation",
                        email,
                        name,
                        link: activationLink,
                    }),
                });

                if (mailRes.ok) {
                    mailSent = true;
                } else {
                    mailError = `PHP Mailer returned ${mailRes.status}`;
                }
            } catch (err: any) {
                mailError = err.message;
                console.error("Błąd połączenia z PHP Mailer:", err);
            }
        } else {
            console.warn("PHP_MAILER_URL nie jest skonfigurowany.");
        }

        return NextResponse.json({
            success: true,
            mailSent,
            mailError,
            link: activationLink, // Fallback for manual sending
        });
    } catch (err: any) {
        console.error("Fatalny błąd API send-activation:", err);
        return NextResponse.json(
            { error: err.message || "Wewnętrzny błąd serwera." },
            { status: 500 }
        );
    }
}
