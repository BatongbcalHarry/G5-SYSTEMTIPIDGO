<?php
// ============================================================
// POST /api/login.php
// body: { "email": "...", "password": "..." }
// Verifies credentials against the users table and starts a
// PHP session on success.
// ============================================================

header('Content-Type: application/json');
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

// ---- brute-force protection: 5 failed tries per email+device in 15 minutes ----
$conn->query("CREATE TABLE IF NOT EXISTS login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lookup (email, ip, attempted_at)
)");
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$conn->query("DELETE FROM login_attempts WHERE attempted_at < (NOW() - INTERVAL 1 DAY)");

$recent = $conn->prepare("SELECT COUNT(*) AS total FROM login_attempts WHERE email = ? AND ip = ? AND attempted_at > (NOW() - INTERVAL 15 MINUTE)");
$recent->bind_param('ss', $email, $ip);
$recent->execute();
if ((int)$recent->get_result()->fetch_assoc()['total'] >= 5) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many failed sign-in attempts. Please wait 15 minutes and try again.']);
    exit;
}

$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user || !password_verify($password, $user['password_hash'])) {
    $fail = $conn->prepare("INSERT INTO login_attempts (email, ip) VALUES (?, ?)");
    $fail->bind_param('ss', $email, $ip);
    $fail->execute();
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

$clear = $conn->prepare("DELETE FROM login_attempts WHERE email = ? AND ip = ?");
$clear->bind_param('ss', $email, $ip);
$clear->execute();

session_regenerate_id(true);
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
