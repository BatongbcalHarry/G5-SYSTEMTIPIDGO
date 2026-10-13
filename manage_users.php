<?php
// User and moderator management.                     admin ONLY
// GET  ?group=users       -> registered users and store owners
// GET  ?group=moderators  -> moderator accounts
// POST { action: "create_moderator", full_name, email, password }
// POST { action: "delete", id }   (never an admin, never yourself)
header('Content-Type: application/json');
session_start();
require 'db.php';
require 'auth.php';

$admin = require_role(['admin']);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $group = $_GET['group'] ?? 'users';
    if ($group === 'moderators') {
        $sql = "SELECT id, full_name, email, role, created_at FROM users WHERE role = 'moderator' ORDER BY full_name";
    } else {
        $sql = "SELECT id, full_name, email, role, created_at FROM users WHERE role IN ('user','store_owner') ORDER BY created_at DESC, id DESC";
    }
    $out = [];
    $r = $conn->query($sql);
    while ($row = $r->fetch_assoc()) {
        $out[] = ['id' => (int)$row['id'], 'fullName' => $row['full_name'], 'email' => $row['email'], 'role' => $row['role'], 'created' => $row['created_at']];
    }
    echo json_encode($out);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Method not allowed');

$d = json_body();
$action = $d['action'] ?? '';

if ($action === 'create_moderator') {
    $name = trim($d['full_name'] ?? '');
    $email = strtolower(trim($d['email'] ?? ''));
    $password = $d['password'] ?? '';
    if ($name === '' || mb_strlen($name) > 100) fail(400, 'Enter the moderator\'s name');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Enter a valid email address');
    if (strlen($password) < 8 || !preg_match('/[^A-Za-z0-9]/', $password)) fail(400, 'Password needs at least 8 characters and 1 special character');

    $check = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $check->bind_param('s', $email);
    $check->execute();
    if ($check->get_result()->fetch_assoc()) fail(409, 'That email is already registered');

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'moderator', CURDATE())");
    $stmt->bind_param('sss', $name, $email, $hash);
    $stmt->execute();
    echo json_encode(['id' => $conn->insert_id, 'status' => 'created']);
    exit;
}

if ($action === 'delete') {
    $id = (int)($d['id'] ?? 0);
    if ($id < 1) fail(400, 'A user id is required');
    if ($id === $admin['id']) fail(409, 'You cannot delete your own account');
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ? AND role <> 'admin'");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    if ($stmt->affected_rows < 1) fail(404, 'User not found, or it is an administrator account');
    echo json_encode(['id' => $id, 'status' => 'deleted']);
    exit;
}

fail(400, 'Unknown action');
