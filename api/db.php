<?php
// ============================================================
// Database connection - used by every file in /api
// Default XAMPP MySQL settings: user "root", no password.
// Change these if your MySQL setup is different.
// ============================================================

// ============================================================
// Cross-site request protection.
// Browsers always attach an Origin header to cross-site POSTs.
// If a POST comes from a different website than the one serving
// this API, refuse it - so another site cannot make a signed-in
// admin/moderator/owner submit actions without knowing.
// ============================================================
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && !empty($_SERVER['HTTP_ORIGIN'])) {
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

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]));
}

$conn->set_charset('utf8mb4');
?>
