<?php
// ============================================================
// POST /api/login.php
// body: { "email": "...", "password": "..." }
// Verifies credentials against the users table and starts a
// PHP session on success.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
session_start();
require 'db.php';

$data = json_decode(file_get_contents('php://input'), true);

$email    = isset($data['email']) ? trim($data['email']) : '';
$password = isset($data['password']) ? $data['password'] : '';

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required']);
    exit;
}

$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Incorrect email or password']);
    exit;
}

if (!in_array($user['role'], ['admin', 'moderator', 'store_owner'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'This sign-in is for staff only']);
    exit;
}

if ($user['role'] === 'store_owner') {
    $application = $conn->prepare('SELECT status FROM store_owner_applications WHERE user_id = ?');
    $application->bind_param('i', $user['id']);
    $application->execute();
    $ownerApplication = $application->get_result()->fetch_assoc();

    if (!$ownerApplication || $ownerApplication['status'] !== 'approved') {
        http_response_code(403);
        $message = !$ownerApplication || $ownerApplication['status'] === 'pending'
            ? 'Your store-owner application is awaiting moderator approval.'
            : 'Your store-owner application was not approved.';
        echo json_encode(['error' => $message]);
        exit;
    }
}

$_SESSION['user_id']   = $user['id'];
$_SESSION['full_name'] = $user['full_name'];
$_SESSION['email']     = $user['email'];
$_SESSION['role']      = $user['role'];

echo json_encode([
    'id'        => (int)$user['id'],
    'full_name' => $user['full_name'],
    'email'     => $user['email'],
    'role'      => $user['role']
]);
?>
