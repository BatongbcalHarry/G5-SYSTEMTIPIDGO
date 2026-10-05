<?php
// ============================================================
// Database connection - used by every file in /api
// Default XAMPP MySQL settings: user "root", no password.
// Change these if your MySQL setup is different.
// ============================================================

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
