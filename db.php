<?php
// ============================================================
// Database connection - used by every file in /api
// Default XAMPP MySQL settings: user "root", no password.
// Change these if your MySQL setup is different.
// ============================================================

// ============================================================
// Cross-site request protection (POST and DELETE).
// Browsers always attach an Origin header to cross-site POST/DELETE requests.
// If a POST comes from a different website than the one serving
// this API, refuse it - so another site cannot make a signed-in
// admin/moderator/owner submit actions without knowing.
// ============================================================
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET','HEAD','OPTIONS'], true) && !empty($_SERVER['HTTP_ORIGIN'])) {
    $originHost = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
    $originPort = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_PORT);
    $serverHost = $_SERVER['HTTP_HOST'] ?? '';
    $originFull = $originHost . ($originPort ? ':' . $originPort : '');
    if ($originHost === null || strcasecmp($originFull, $serverHost) !== 0) {
        http_response_code(403);
        header('Content-Type: application/json');
        die(json_encode(['error' => 'Cross-site request blocked']));
    }
}

$host   = 'localhost';
$user   = 'root';
$pass   = '';
$dbname = 'tipidgo_db';

// Database problems (duplicate record, record still in use, ...) become a clear
// JSON message instead of a PHP error page. Details never reach the browser.
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
set_exception_handler(function ($e) {
    if (!headers_sent()) header('Content-Type: application/json');
    $code = $e instanceof mysqli_sql_exception ? (int)$e->getCode() : 0;
    if ($code === 1062)                   { http_response_code(409); echo json_encode(['error' => 'That record already exists']); }
    elseif ($code === 1451 || $code === 1452) { http_response_code(409); echo json_encode(['error' => 'That record is still in use by other data']); }
    elseif ($code === 4025 || $code === 3819) { http_response_code(400); echo json_encode(['error' => 'A value is outside the allowed range']); }
    else                                  { http_response_code(500); echo json_encode(['error' => 'Something went wrong on the server']); error_log($e); }
});

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]));
}

$conn->set_charset('utf8mb4');
?>
