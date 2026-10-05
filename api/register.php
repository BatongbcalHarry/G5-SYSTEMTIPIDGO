<?php
// ============================================================
// POST /api/register.php
// body: { "full_name": "...", "email": "...", "password": "..." }
// Creates a new user account with role "user".
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
session_start();
require 'db.php';

$data = json_decode(file_get_contents('php://input'), true);

$fullName = isset($data['full_name']) ? trim($data['full_name']) : '';
$email    = isset($data['email']) ? trim($data['email']) : '';
$password = isset($data['password']) ? $data['password'] : '';

if ($fullName === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Full name, email, and password are all required']);
    exit;
}

if (strlen($password) < 8 || !preg_match('/[^A-Za-z0-9]/', $password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters and include at least 1 special character']);
    exit;
}

$check = $conn->prepare("SELECT id FROM users WHERE email = ?");
$check->bind_param('s', $email);
$check->execute();
if ($check->get_result()->fetch_assoc()) {
    http_response_code(409);
    echo json_encode(['error' => 'An account with that email already exists']);
    exit;
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $conn->prepare("INSERT INTO users (full_name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'user', CURDATE())");
$stmt->bind_param('sss', $fullName, $email, $hash);
$stmt->execute();

$userId = $conn->insert_id;

// log the new user in right away
$_SESSION['user_id']   = $userId;
$_SESSION['full_name'] = $fullName;
$_SESSION['email']     = $email;
$_SESSION['role']      = 'user';

echo json_encode([
    'id'        => $userId,
    'full_name' => $fullName,
    'email'     => $email,
    'role'      => 'user'
]);
?>
