<?php
// POST /api/owner_prices.php -> { "product_id": 1, "price": 45.50 }
// Store ownership is derived from the approved session, never from client input.

header('Content-Type: application/json');
session_start();
require 'db.php';

require 'auth.php';
$user = require_role(['store_owner', 'admin']);
if ($user['role'] === 'admin') {
    $storeId = (int)(json_decode(file_get_contents('php://input'), true)['store_id'] ?? 0);
    if ($storeId < 1) fail(400, 'Choose a store');
} else {
    $storeId = owner_store_id($conn, $user['id']);
    if (!$storeId) fail(403, 'An approved store-owner application is required');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$productId = isset($data['product_id']) ? (int)$data['product_id'] : 0;
$price = isset($data['price']) && is_numeric($data['price']) ? (float)$data['price'] : 0;

if ($productId < 1 || !is_finite($price) || $price <= 0 || $price > 1000000) {
    http_response_code(400);
    echo json_encode(['error' => 'Choose a product and enter a price greater than 0']);
    exit;
}

$product = $conn->prepare('SELECT id FROM products WHERE id = ?');
$product->bind_param('i', $productId);
$product->execute();
if (!$product->get_result()->fetch_assoc()) {
    http_response_code(404);
    echo json_encode(['error' => 'Product not found']);
    exit;
}

$conn->begin_transaction();
try {
    $current = $conn->prepare('SELECT price FROM prices WHERE store_id = ? AND product_id = ? FOR UPDATE');
    $current->bind_param('ii', $storeId, $productId);
    $current->execute();
    $existing = $current->get_result()->fetch_assoc();

    if ($existing && round((float)$existing['price'], 2) === round($price, 2)) {
        $conn->commit();
        echo json_encode(['status' => 'unchanged', 'price' => round($price, 2)]);
        exit;
    }

    // one row per store + product (the database enforces it); update it in place
    $save = $conn->prepare('INSERT INTO prices (product_id, store_id, price, last_updated) VALUES (?, ?, ?, CURDATE())
        ON DUPLICATE KEY UPDATE price = VALUES(price), last_updated = CURDATE()');
    $save->bind_param('iid', $productId, $storeId, $price);
    $save->execute();
    $status = $existing ? 'updated' : 'added';

    // history keeps ONE entry per store, product and day (the day's last price)
    $today = $conn->prepare('SELECT id FROM price_history WHERE product_id = ? AND store_id = ? AND recorded_date = CURDATE() LIMIT 1');
    $today->bind_param('ii', $productId, $storeId);
    $today->execute();
    $row = $today->get_result()->fetch_assoc();
    if ($row) {
        $historyId = (int)$row['id'];
        $history = $conn->prepare('UPDATE price_history SET price = ? WHERE id = ?');
        $history->bind_param('di', $price, $historyId);
    } else {
        $history = $conn->prepare('INSERT INTO price_history (product_id, store_id, price, recorded_date) VALUES (?, ?, ?, CURDATE())');
        $history->bind_param('iid', $productId, $storeId, $price);
    }
    $history->execute();
    $conn->commit();

    echo json_encode(['status' => $status, 'price' => round($price, 2)]);
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['error' => 'Could not save the store price']);
}
