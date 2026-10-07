<?php
// ============================================================
// GET /api/session.php
// Tells the front-end whether someone is currently logged in.
// Called when the page first loads, so a refresh doesn't log
// the user out.
// ============================================================

header('Content-Type: application/json');
session_start();
require 'db.php';

$role = $_SESSION['role'] ?? '';
$allowedRole = in_array($role, ['admin', 'moderator', 'store_owner'], true);
$ownerApproved = true;

if ($role === 'store_owner' && isset($_SESSION['user_id'])) {
    $application = $conn->prepare("SELECT status FROM store_owner_applications WHERE user_id = ?");
    $application->bind_param('i', $_SESSION['user_id']);
    $application->execute();
    $ownerApplication = $application->get_result()->fetch_assoc();
    $ownerApproved = $ownerApplication && $ownerApplication['status'] === 'approved';
}

if (isset($_SESSION['user_id']) && $allowedRole && $ownerApproved) {
    echo json_encode([
        'loggedIn' => true,
        'user' => [
            'id'        => $_SESSION['user_id'],
            'full_name' => $_SESSION['full_name'],
            'email'     => $_SESSION['email'],
            'role'      => $_SESSION['role']
        ]
    ]);
} else {
    $_SESSION = [];
    session_destroy();
    echo json_encode(['loggedIn' => false]);
}
?>
