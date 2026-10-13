<?php
// Store owner: view / edit THEIR OWN store only (the store id comes from the
// approved application in the session, never from the browser).
// GET  -> { id, name, location, verified }
// POST -> { name, location }
header('Content-Type: application/json');
session_start();
require 'db.php';
require 'auth.php';

$user = require_role(['store_owner']);
$storeId = owner_store_id($conn, $user['id']);
if (!$storeId) fail(403, 'An approved store-owner application is required');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $d = json_body();
    $name = trim($d['name'] ?? '');
    $location = trim($d['location'] ?? '');
    if ($name === '' || mb_strlen($name) > 150 || $location === '' || mb_strlen($location) > 200) {
        fail(400, 'Enter a store name and a location');
    }
    $stmt = $conn->prepare("UPDATE stores SET name = ?, location = ? WHERE id = ?");
    $stmt->bind_param('ssi', $name, $location, $storeId);
    $stmt->execute();
} elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail(405, 'Method not allowed');
}

$q = $conn->prepare("SELECT id, name, location, verified FROM stores WHERE id = ?");
$q->bind_param('i', $storeId);
$q->execute();
$s = $q->get_result()->fetch_assoc();
echo json_encode(['id' => (int)$s['id'], 'name' => $s['name'], 'location' => $s['location'], 'verified' => (bool)$s['verified']]);
