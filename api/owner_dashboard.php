<?php
// GET /api/owner_dashboard.php -> approved owner's store, products, and its prices

header('Content-Type: application/json');
session_start();
require 'db.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'store_owner') {
    http_response_code(403);
    echo json_encode(['error' => 'Store-owner access required']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$ownerQuery = $conn->prepare("SELECT a.store_id, a.store_name, a.store_location, s.name AS linked_store_name, s.location AS linked_store_location
    FROM store_owner_applications a
    LEFT JOIN stores s ON s.id = a.store_id
    WHERE a.user_id = ? AND a.status = 'approved'");
$ownerQuery->bind_param('i', $userId);
$ownerQuery->execute();
$owner = $ownerQuery->get_result()->fetch_assoc();

if (!$owner || !$owner['store_id']) {
    http_response_code(403);
    echo json_encode(['error' => 'An approved store-owner application is required']);
    exit;
}

$storeId = (int)$owner['store_id'];
$productResult = $conn->query('SELECT id, name, category, base_price FROM products ORDER BY name');
$products = [];
while ($row = $productResult->fetch_assoc()) {
    $products[] = [
        'id' => (int)$row['id'],
        'name' => $row['name'],
        'category' => $row['category'],
        'basePrice' => (float)$row['base_price']
    ];
}

$priceQuery = $conn->prepare('SELECT p.product_id, pr.name, pr.category, p.price, p.last_updated FROM prices p JOIN products pr ON pr.id = p.product_id WHERE p.store_id = ? ORDER BY pr.name');
$priceQuery->bind_param('i', $storeId);
$priceQuery->execute();
$priceResult = $priceQuery->get_result();
$prices = [];
while ($row = $priceResult->fetch_assoc()) {
    $prices[] = [
        'productId' => (int)$row['product_id'],
        'name' => $row['name'],
        'category' => $row['category'],
        'price' => (float)$row['price'],
        'lastUpdated' => $row['last_updated']
    ];
}

echo json_encode([
    'store' => [
        'id' => $storeId,
        'name' => $owner['linked_store_name'],
        'location' => $owner['linked_store_location']
    ],
    'products' => $products,
    'prices' => $prices
]);
?>