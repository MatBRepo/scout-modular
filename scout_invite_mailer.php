<?php
/**
 * entrisoScouting - Manual Invite PHP Mailer
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
    
    $email = isset($data['email']) ? trim($data['email']) : '';
    $name = isset($data['name']) ? trim($data['name']) : '';
    $link = isset($data['link']) ? trim($data['link']) : '';

    if ($email && $link) {
        $subject = "Zaproszenie do entrisoScouting";
        
        // Treść wiadomości
        $message = "Witaj " . ($name ?: "Scoucie") . ",\n\n";
        $message .= "Zostałeś zaproszony do platformy entrisoScouting.\n";
        $message .= "Kliknij w poniższy link, aby się zalogować (link jest jednorazowy):\n\n";
        $message .= $link . "\n\n";
        $message .= "Pozdrawiamy,\nZespół entrisoScouting";

        $headers = "From: entrisoScouting <no-reply@" . $_SERVER['HTTP_HOST'] . ">\r\n";
        $headers .= "Reply-To: support@" . $_SERVER['HTTP_HOST'] . "\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        if (mail($email, $subject, $message, $headers)) {
            echo json_encode(["status" => "success"]);
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
