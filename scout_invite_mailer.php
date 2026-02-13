<?php
/**
 * entrisoScouting - Manual Email Handler
 * Handles both scout invitations and account activations
 * Host this script on your PHP server and update PHP_MAILER_URL in .env.local
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    
    $type = isset($data['type']) ? trim($data['type']) : 'invitation'; // 'invitation' or 'activation'
    $email = isset($data['email']) ? trim($data['email']) : '';
    $name = isset($data['name']) ? trim($data['name']) : '';
    $link = isset($data['link']) ? trim($data['link']) : '';

    if ($email && $link) {
        $accentColor = "#10b981"; // Green from the app "Dodaj zawodnika" button
        $textColor = "#18181b";
        $mutedColor = "#71717a";
        
        // Determine subject and message based on type
        if ($type === 'activation') {
            $title = "Aktywuj swoje konto";
            $subject = "Aktywuj swoje konto - entrisoScouting";
            $buttonText = "Aktywuj konto";
            $mainText = "Twoje konto w platformie entrisoScouting zostało utworzone. Aby móc się zalogować, potwierdź swój adres e-mail klikając w poniższy przycisk.";
        } else {
            $title = "Zaproszenie do platformy";
            $subject = "Zaproszenie do entrisoScouting";
            $buttonText = "Dołącz teraz";
            $mainText = "Zostałeś zaproszony do dołączenia do grona skautów entrisoScouting. Kliknij w przycisk poniżej, aby dokończyć konfigurację konta.";
        }

        // Ultra Minimalist HTML Template
        $htmlMessage = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <style>
                body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: $textColor; -webkit-font-smoothing: antialiased; }
                .container { max-width: 500px; margin: 0 auto; padding: 60px 20px; }
                .logo { font-size: 18px; font-weight: 700; color: #000; letter-spacing: -0.02em; margin-bottom: 48px; }
                .logo span { color: $accentColor; }
                h1 { font-size: 24px; font-weight: 700; margin: 0 0 16px 0; color: #000; letter-spacing: -0.02em; }
                p { font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; color: #4b5563; }
                .button { background-color: $accentColor; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px; transition: opacity 0.2s; }
                .footer { margin-top: 64px; padding-top: 32px; border-top: 1px solid #f3f4f6; font-size: 13px; color: $mutedColor; }
                .link-fallback { margin-top: 32px; font-size: 12px; color: $mutedColor; word-break: break-all; }
                .link-fallback a { color: $accentColor; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='logo'>entriso<span>Scouting</span></div>
                <h1>$title</h1>
                <p>$mainText</p>
                <a href='$link' class='button'>$buttonText</a>
                
                <div class='link-fallback'>
                    Jeśli przycisk nie działa, skopiuj ten link:<br>
                    <a href='$link'>$link</a>
                </div>

                <div class='footer'>
                    &copy; " . date("Y") . " entrisoScouting. Minimalizm w skautingu.<br>
                    Wiadomość wysłana automatycznie.
                </div>
            </div>
        </body>
        </html>
        ";

        $headers = "From: entrisoScouting <no-reply@" . $_SERVER['HTTP_HOST'] . ">\r\n";
        $headers .= "Reply-To: support@" . $_SERVER['HTTP_HOST'] . "\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";

        if (mail($email, $subject, $htmlMessage, $headers)) {
            echo json_encode(["status" => "success", "type" => $type]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Błąd mail() - sprawdź logi serwera PHP."]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Brak wymaganych parametrów (email, link)."]);
    }
} else {
    http_response_code(405);
    echo "Method Not Allowed";
}
?>
