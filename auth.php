<?php
// ============================================================
// Shared role check. Every staff endpoint calls:
//     $user = require_role(['admin', 'moderator']);
// The role always comes from the server-side session, never from
// anything the browser sends, so hiding a button is never the only
// protection - the server refuses the action too.
// ============================================================
function require_role(array $roles) {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $role = $_SESSION['role'] ?? '';
    header('Content-Type: application/json');
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);   // not signed in
        die(json_encode(['error' => 'Please sign in first']));
    }
    // The session could be older than the account: if the user was deleted or
    // their role changed, the old session stops working immediately.
    global $conn;
    if (isset($conn)) {
        $uid = (int)$_SESSION['user_id'];
        $check = $conn->prepare('SELECT role FROM users WHERE id = ?');
        $check->bind_param('i', $uid);
        $check->execute();
        $row = $check->get_result()->fetch_assoc();
        if (!$row || $row['role'] !== $role) {
            $_SESSION = [];
            session_destroy();
            http_response_code(401);
            die(json_encode(['error' => 'Your session is no longer valid. Please sign in again.']));
        }
    }
    if (!in_array($role, $roles, true)) {
        http_response_code(403);   // signed in, but this role is not allowed
        die(json_encode(['error' => 'Your role cannot do this action']));
    }
    return ['id' => (int)$_SESSION['user_id'], 'role' => $role, 'name' => $_SESSION['full_name'] ?? ''];
}

function json_body(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function fail(int $code, string $message) {
    http_response_code($code);
    die(json_encode(['error' => $message]));
}

// Store id of an approved owner (or 0).
function owner_store_id($conn, int $userId): int {
    $q = $conn->prepare("SELECT store_id FROM store_owner_applications WHERE user_id = ? AND status = 'approved'");
    $q->bind_param('i', $userId);
    $q->execute();
    $row = $q->get_result()->fetch_assoc();
    return $row && $row['store_id'] ? (int)$row['store_id'] : 0;
}
