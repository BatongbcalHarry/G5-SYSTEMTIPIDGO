<?php
// ============================================================
// GET  /api/requests.php   -> list all requests (admin/moderator only)
// POST /api/requests.php   -> submit new request
//      body: { "type": "Price Update", "details": "..." }
// ============================================================

header('Content-Type: application/json');
session_start();
require 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {

    // Reading submitted requests is a staff action. Visitors can only submit.
    require 'auth.php';
    require_role(['admin', 'moderator']);

    $result = $conn->query("SELECT * FROM requests ORDER BY created_at DESC, id DESC");

    $requests = [];
    while ($row = $result->fetch_assoc()) {
        $requests[] = [
            'id'      => (int)$row['id'],
            'type'    => $row['type'],
            'details' => $row['details'],
            'status'  => $row['status'],
            'date'    => $row['created_at']
        ];
    }

    echo json_encode($requests);

} elseif ($method === 'POST') {

    $data = json_decode(file_get_contents('php://input'), true);

    $type    = isset($data['type']) ? trim($data['type']) : '';
    $details = isset($data['details']) ? trim($data['details']) : '';

    if (!in_array($type, ['Price Update', 'New Product'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Choose a valid request type']);
        exit;
    }
    if ($details === '' || mb_strlen($details) > 1000) {
        http_response_code(400);
        echo json_encode(['error' => 'Details are required (1000 characters at most)']);
        exit;
    }

    // the same request sent twice today (double-click, refresh) is only saved once
    $dup = $conn->prepare("SELECT id FROM requests WHERE type = ? AND details = ? AND created_at = CURDATE()");
    $dup->bind_param('ss', $type, $details);
    $dup->execute();
    if ($dup->get_result()->fetch_assoc()) {
        http_response_code(409);
        echo json_encode(['error' => 'You already sent this request today']);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO requests (type, details, status, created_at) VALUES (?, ?, 'Pending', CURDATE())");
    $stmt->bind_param('ss', $type, $details);
    $stmt->execute();

    echo json_encode([
        'id'      => $conn->insert_id,
        'type'    => $type,
        'details' => $details,
        'status'  => 'Pending',
        'date'    => date('Y-m-d')
    ]);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>
