<?php
// Staff product management.
// GET    -> list (admin, moderator)
// POST   -> add (no id) or edit (id)           admin + moderator ("Limited")
// DELETE -> remove a product and its prices    admin ONLY
header('Content-Type: application/json');
session_start();
require 'db.php';
require 'auth.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    require_role(['admin', 'moderator']);
    $r = $conn->query("SELECT id, name, category, base_price, image FROM products ORDER BY name");
    $out = [];
    while ($row = $r->fetch_assoc()) {
        $out[] = ['id' => (int)$row['id'], 'name' => $row['name'], 'category' => $row['category'],
                  'basePrice' => (float)$row['base_price'], 'image' => $row['image']];
    }
    echo json_encode($out);
    exit;
}

if ($method === 'POST') {
    require_role(['admin', 'moderator']);
    $d = json_body();
    $id = (int)($d['id'] ?? 0);
    $name = trim($d['name'] ?? '');
    $category = trim($d['category'] ?? '');
    $base = isset($d['base_price']) && is_numeric($d['base_price']) ? (float)$d['base_price'] : -1;
    if ($name === '' || mb_strlen($name) > 150 || $category === '' || mb_strlen($category) > 50 || $base < 0 || $base > 1000000) {
        fail(400, 'Enter a name, a category and a valid base price');
    }
    $name = preg_replace('/\s+/', ' ', $name);
    $dup = $conn->prepare("SELECT id FROM products WHERE name = ? AND id <> ?");
    $dup->bind_param('si', $name, $id);
    $dup->execute();
    if ($dup->get_result()->fetch_assoc()) fail(409, 'A product with that name already exists');
    $base = round($base, 2);
    if ($id > 0) {
        $stmt = $conn->prepare("UPDATE products SET name = ?, category = ?, base_price = ? WHERE id = ?");
        $stmt->bind_param('ssdi', $name, $category, $base, $id);
        $stmt->execute();
    } else {
        $stmt = $conn->prepare("INSERT INTO products (name, category, base_price) VALUES (?, ?, ?)");
        $stmt->bind_param('ssd', $name, $category, $base);
        $stmt->execute();
        $id = $conn->insert_id;
    }
    echo json_encode(['id' => $id, 'status' => 'saved']);
    exit;
}

if ($method === 'DELETE') {
    require_role(['admin']);
    $id = (int)($_GET['id'] ?? 0);
    if ($id < 1) fail(400, 'A product id is required');
    $stmt = $conn->prepare("DELETE FROM products WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    echo json_encode(['id' => $id, 'status' => 'deleted']);
    exit;
}

fail(405, 'Method not allowed');
