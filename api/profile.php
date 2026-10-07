<?php
// ============================================================
// GET  /api/profile.php -> the signed-in account's details
// POST /api/profile.php -> { "full_name": "...",
//                            "current_password": "...",   (only to change password)
//                            "new_password": "..." }      (optional)
// Only the signed-in person's own account can be read or changed.
// ============================================================

header('Content-Type: application/json');
session_start();
require 'db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Please sign in first']);
    exit;
}

$userId = (int)$_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $conn->prepare('SELECT id, full_name, email, role, created_at FROM users WHERE id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'Account not found']);
        exit;
    }

    echo json_encode([
        'id'        => (int)$user['id'],
        'full_name' => $user['full_name'],
        'email'     => $user['email'],
        'role'      => $user['role'],
        'joined'    => $user['created_at']
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$fullName        = isset($data['full_name']) ? trim($data['full_name']) : '';
$currentPassword = isset($data['current_password']) ? $data['current_password'] : '';
$newPassword     = isset($data['new_password']) ? $data['new_password'] : '';

if ($fullName === '' || mb_strlen($fullName) > 100) {
    http_response_code(400);
    echo json_encode(['error' => 'Enter your name (100 characters or fewer)']);
    exit;
}

$stmt = $conn->prepare('SELECT password_hash FROM users WHERE id = ?');
$stmt->bind_param('i', $userId);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'Account not found']);
    exit;
}

if ($newPassword !== '') {
    if (!password_verify($currentPassword, $user['password_hash'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Your current password is incorrect']);
        exit;
    }
    if (strlen($newPassword) < 8 || !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters and include at least 1 special character']);
        exit;
    }
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $update = $conn->prepare('UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?');
    $update->bind_param('ssi', $fullName, $hash, $userId);
} else {
    $update = $conn->prepare('UPDATE users SET full_name = ? WHERE id = ?');
    $update->bind_param('si', $fullName, $userId);
}
$update->execute();

$_SESSION['full_name'] = $fullName;

echo json_encode([
    'full_name'       => $fullName,
    'passwordChanged' => $newPassword !== ''
]);
?>
