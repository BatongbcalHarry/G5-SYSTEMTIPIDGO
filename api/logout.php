<?php
// ============================================================
// POST /api/logout.php
// Destroys the current session.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
session_start();

$_SESSION = [];
session_destroy();

echo json_encode(['message' => 'Logged out']);
?>
