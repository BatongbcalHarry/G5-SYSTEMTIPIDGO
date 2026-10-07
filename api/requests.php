<?php
// ============================================================
// GET  /api/requests.php   -> list all requests
// POST /api/requests.php   -> submit new request
//      body: { "type": "Price Update", "details": "..." }
// ============================================================

header('Content-Type: application/json');
require 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {

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

    if ($type === '' || $details === '') {
        http_response_code(400);
        echo json_encode(['error' => 'type and details are required']);
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
