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
                { error: "Email i nazwa są wymagane." },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();

        // 1. Sprawdź czy użytkownik już istnieje (opcjonalnie, ale profile i tak musimy stworzyć)
        // Supabase generateLink stworzy użytkownika w Auth jeśli nie istnieje.

        // 2. Generuj magic link
        // Zauważ: generateLink zwraca link, który wygasa i jest jednorazowy.
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: email,
            options: {
                data: {
                    full_name: name,
                    role: role,
                },
                // Możesz ustawić redirectTo jeśli chcesz
                // redirectTo: `${new URL(req.url).origin}/auth/callback`,
            },
        });

        if (linkError) {
            console.error("Błąd generowania linku:", linkError);
            return NextResponse.json(
                { error: `Błąd Supabase: ${linkError.message}` },
                { status: 500 }
            );
        }

        const magicLink = linkData.properties.action_link;

        // 3. (Opcjonalnie) Stwórz profil w tabeli profiles jeśli jeszcze go nie ma
        // Czasem triggery to robią, ale lepiej upewnić się ręcznie jeśli system tego wymaga.
        const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
            id: linkData.user.id,
            full_name: name,
            email: email,
            role: role,
            active: true,
        });

        if (profileError) {
            console.warn("Błąd tworzenia profilu (użytkownik auth stworzony):", profileError);
        }

        // 4. Wyślij e-mail przez PHP mailer
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
                console.error("Błąd połączenia z PHP Mailer:", err);
            }
        } else {
            console.warn("PHP_MAILER_URL nie jest skonfigurowany. Link wygenerowany, ale e-mail nie został wysłany.");
        }

        return NextResponse.json({
            success: true,
            mailSent,
            mailError,
            // Zwracamy link w odpowiedzi jako fallback dla admina (do ręcznego skopiowania)
            link: magicLink,
        });
    } catch (err: any) {
        console.error("Fatalny błąd API invite-scout:", err);
        return NextResponse.json(
            { error: err.message || "Wewnętrzny błąd serwera." },
            { status: 500 }
        );
    }
}
