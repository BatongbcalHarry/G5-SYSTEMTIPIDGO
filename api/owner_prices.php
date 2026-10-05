<?php
// POST /api/owner_prices.php -> { "product_id": 1, "price": 45.50 }
// Store ownership is derived from the approved session, never from client input.

header('Content-Type: application/json');
session_start();
require 'db.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'store_owner') {
    http_response_code(403);
    echo json_encode(['error' => 'Store-owner access required']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$ownerQuery = $conn->prepare("SELECT store_id FROM store_owner_applications WHERE user_id = ? AND status = 'approved'");
$ownerQuery->bind_param('i', $userId);
$ownerQuery->execute();
$owner = $ownerQuery->get_result()->fetch_assoc();

if (!$owner || !$owner['store_id']) {
    http_response_code(403);
    echo json_encode(['error' => 'An approved store-owner application is required']);
    exit;
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

$storeId = (int)$owner['store_id'];
$conn->begin_transaction();
try {
    $current = $conn->prepare('SELECT id, price FROM prices WHERE store_id = ? AND product_id = ? ORDER BY id LIMIT 1 FOR UPDATE');
    $current->bind_param('ii', $storeId, $productId);
    $current->execute();
    $existing = $current->get_result()->fetch_assoc();

    if ($existing && round((float)$existing['price'], 2) === round($price, 2)) {
        $conn->commit();
        echo json_encode(['status' => 'unchanged', 'price' => round($price, 2)]);
        exit;
    }

    if ($existing) {
        $priceId = (int)$existing['id'];
        $update = $conn->prepare('UPDATE prices SET price = ?, last_updated = CURDATE() WHERE id = ? AND store_id = ?');
        $update->bind_param('dii', $price, $priceId, $storeId);
        $update->execute();
        $status = 'updated';
    } else {
        $insert = $conn->prepare('INSERT INTO prices (product_id, store_id, price, last_updated) VALUES (?, ?, ?, CURDATE())');
        $insert->bind_param('iid', $productId, $storeId, $price);
        $insert->execute();
        $status = 'added';
    }

    $history = $conn->prepare('INSERT INTO price_history (product_id, store_id, price, recorded_date) VALUES (?, ?, ?, CURDATE())');
    $history->bind_param('iid', $productId, $storeId, $price);
    $history->execute();
    $conn->commit();

    echo json_encode(['status' => $status, 'price' => round($price, 2)]);
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['error' => 'Could not save the store price']);
}
?>