<?php
// Reports inbox: visitor requests and feedback.      admin + moderator
// GET  -> { requests: [...], feedback: [...] }
// POST -> { id, status: "Pending"|"Reviewed"|"Resolved" }  updates a request
header('Content-Type: application/json');
session_start();
require 'db.php';
require 'auth.php';

require_role(['admin', 'moderator']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $d = json_body();
    $id = (int)($d['id'] ?? 0);
    $status = $d['status'] ?? '';
    if ($id < 1 || !in_array($status, ['Pending', 'Reviewed', 'Resolved'], true)) fail(400, 'A valid request and status are required');
    $stmt = $conn->prepare("UPDATE requests SET status = ? WHERE id = ?");
    $stmt->bind_param('si', $status, $id);
    $stmt->execute();
    echo json_encode(['id' => $id, 'status' => $status]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail(405, 'Method not allowed');

$requests = [];
$r = $conn->query("SELECT id, type, details, status, created_at FROM requests ORDER BY FIELD(status,'Pending','Reviewed','Resolved'), created_at DESC, id DESC");
while ($row = $r->fetch_assoc()) {
    $requests[] = ['id' => (int)$row['id'], 'type' => $row['type'], 'details' => $row['details'], 'status' => $row['status'], 'date' => $row['created_at']];
}
$feedback = [];
$r = $conn->query("SELECT id, user_name, type, message, created_at FROM feedback ORDER BY created_at DESC, id DESC");
while ($row = $r->fetch_assoc()) {
    $feedback[] = ['id' => (int)$row['id'], 'user' => $row['user_name'], 'type' => $row['type'], 'message' => $row['message'], 'date' => $row['created_at']];
}
echo json_encode(['requests' => $requests, 'feedback' => $feedback]);
