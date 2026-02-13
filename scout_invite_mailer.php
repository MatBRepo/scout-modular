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
        // Determine subject and message based on type
        if ($type === 'activation') {
            $subject = "Aktywuj swoje konto - entrisoScouting";
            $message = "Witaj " . ($name ?: "Użytkowniku") . ",\n\n";
            $message .= "Dziękujemy za rejestrację w entrisoScouting!\n\n";
            $message .= "Aby aktywować swoje konto, kliknij w poniższy link:\n\n";
            $message .= $link . "\n\n";
            $message .= "Link jest ważny przez 24 godziny.\n\n";
            $message .= "Jeśli nie zakładałeś konta, zignoruj tę wiadomość.\n\n";
            $message .= "Pozdrawiamy,\nZespół entrisoScouting";
        } else {
            // Default: invitation
            $subject = "Zaproszenie do entrisoScouting";
            $message = "Witaj " . ($name ?: "Scoucie") . ",\n\n";
            $message .= "Zostałeś zaproszony do platformy entrisoScouting.\n";
            $message .= "Kliknij w poniższy link, aby się zalogować (link jest jednorazowy):\n\n";
            $message .= $link . "\n\n";
            $message .= "Pozdrawiamy,\nZespół entrisoScouting";
        }

        $headers = "From: entrisoScouting <no-reply@" . $_SERVER['HTTP_HOST'] . ">\r\n";
        $headers .= "Reply-To: support@" . $_SERVER['HTTP_HOST'] . "\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        if (mail($email, $subject, $message, $headers)) {
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
