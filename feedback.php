<?php
// ============================================================
// GET  /api/feedback.php           -> list all feedback (admin/moderator only)
// POST /api/feedback.php           -> add new feedback
//      body: { "user": "...", "type": "Comments", "message": "..." }
// ============================================================

header('Content-Type: application/json');
session_start();
require 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {

    // Reading submitted feedback is a staff action. Visitors can only submit.
    require 'auth.php';
    require_role(['admin', 'moderator']);

    $result = $conn->query("SELECT * FROM feedback ORDER BY created_at DESC, id DESC");

    $feedback = [];
    while ($row = $result->fetch_assoc()) {
        $feedback[] = [
            'id'      => (int)$row['id'],
            'user'    => $row['user_name'],
            'type'    => $row['type'],
            'message' => $row['message'],
            'date'    => $row['created_at']
        ];
    }

    echo json_encode($feedback);

} elseif ($method === 'POST') {

    $data = json_decode(file_get_contents('php://input'), true);

    // Visitors browse as guests (only staff can sign in), so anyone may leave
    // feedback. A signed-in staff member is shown under their own name.
    $user    = $_SESSION['full_name'] ?? 'Guest';
    $type    = isset($data['type']) ? $data['type'] : 'Comments';
    $message = isset($data['message']) ? trim($data['message']) : '';

    if (!in_array($type, ['Comments', 'Rating', 'Suggestion'], true)) {
        $type = 'Comments';
    }

    if (mb_strlen($message) > 1000) {
        http_response_code(400);
        echo json_encode(['error' => 'Feedback must be 1000 characters or fewer']);
        exit;
    }

    if ($message === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Feedback message is required']);
        exit;
    }

    $dup = $conn->prepare("SELECT id FROM feedback WHERE user_name = ? AND message = ? AND created_at = CURDATE()");
    $dup->bind_param('ss', $user, $message);
    $dup->execute();
    if ($dup->get_result()->fetch_assoc()) {
        http_response_code(409);
        echo json_encode(['error' => 'You already sent this feedback today']);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO feedback (user_name, type, message, created_at) VALUES (?, ?, ?, CURDATE())");
    $stmt->bind_param('sss', $user, $type, $message);
    $stmt->execute();

    echo json_encode([
        'id'      => $conn->insert_id,
        'user'    => $user,
        'type'    => $type,
        'message' => $message,
        'date'    => date('Y-m-d')
    ]);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>
