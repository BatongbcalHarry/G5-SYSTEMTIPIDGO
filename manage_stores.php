<?php
// Staff store management.
// GET    -> list                                   admin + moderator
// POST   -> add a store (no id)                    admin ONLY
//        -> edit a store (id)                      admin: name/location/verified
//                                                  moderator ("Limited"): location + verified only
// DELETE -> remove a store                         admin ONLY
header('Content-Type: application/json');
session_start();
require 'db.php';
require 'auth.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    require_role(['admin', 'moderator']);
    $r = $conn->query("SELECT id, name, location, verified FROM stores ORDER BY name");
    $out = [];
    while ($row = $r->fetch_assoc()) {
        $out[] = ['id' => (int)$row['id'], 'name' => $row['name'], 'location' => $row['location'], 'verified' => (bool)$row['verified']];
    }
    echo json_encode($out);
    exit;
}

if ($method === 'POST') {
    $user = require_role(['admin', 'moderator']);
    $d = json_body();
    $id = (int)($d['id'] ?? 0);
    $location = mb_substr(trim($d['location'] ?? ''), 0, 200);
    $verified = !empty($d['verified']) ? 1 : 0;

    if ($id > 0) {
        if ($user['role'] === 'admin') {
            $name = trim($d['name'] ?? '');
            if ($name === '' || mb_strlen($name) > 150) fail(400, 'A store name is required');
            $dup = $conn->prepare("SELECT id FROM stores WHERE name = ? AND location = ? AND id <> ?");
            $dup->bind_param('ssi', $name, $location, $id);
            $dup->execute();
            if ($dup->get_result()->fetch_assoc()) fail(409, 'That store already exists at that location');
            $stmt = $conn->prepare("UPDATE stores SET name = ?, location = ?, verified = ? WHERE id = ?");
            $stmt->bind_param('ssii', $name, $location, $verified, $id);
        } else {
            $stmt = $conn->prepare("UPDATE stores SET location = ?, verified = ? WHERE id = ?");
            $stmt->bind_param('sii', $location, $verified, $id);
        }
        $stmt->execute();
        echo json_encode(['id' => $id, 'status' => 'saved']);
        exit;
    }

    if ($user['role'] !== 'admin') fail(403, 'Only an administrator can add stores');
    $name = preg_replace('/\s+/', ' ', trim($d['name'] ?? ''));
    if ($name === '' || mb_strlen($name) > 150) fail(400, 'A store name is required');
    $dup = $conn->prepare("SELECT id FROM stores WHERE name = ? AND location = ?");
    $dup->bind_param('ss', $name, $location);
    $dup->execute();
    if ($dup->get_result()->fetch_assoc()) fail(409, 'That store already exists at that location');
    $stmt = $conn->prepare("INSERT INTO stores (name, location, verified) VALUES (?, ?, ?)");
    $stmt->bind_param('ssi', $name, $location, $verified);
    $stmt->execute();
    echo json_encode(['id' => $conn->insert_id, 'status' => 'saved']);
    exit;
}

if ($method === 'DELETE') {
    require_role(['admin']);
    $id = (int)($_GET['id'] ?? 0);
    if ($id < 1) fail(400, 'A store id is required');
    $stmt = $conn->prepare("DELETE FROM stores WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo json_encode(['id' => $id, 'status' => 'deleted']);
    exit;
}

fail(405, 'Method not allowed');
