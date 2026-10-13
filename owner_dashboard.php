<?php
// GET /api/owner_dashboard.php -> approved owner's store, products, and its prices

header('Content-Type: application/json');
session_start();
require 'db.php';

require 'auth.php';
$user = require_role(['store_owner', 'admin']);
if ($user['role'] === 'admin') {
    // Administrators can work on any store's prices.
    $storeId = (int)($_GET['store_id'] ?? 0);
    if ($storeId < 1) {
        $first = $conn->query('SELECT id FROM stores ORDER BY name LIMIT 1')->fetch_assoc();
        $storeId = $first ? (int)$first['id'] : 0;
    }
    if (!$storeId) fail(404, 'No stores yet');
    $sq = $conn->prepare('SELECT name, location FROM stores WHERE id = ?');
    $sq->bind_param('i', $storeId);
    $sq->execute();
    $store = $sq->get_result()->fetch_assoc();
    if (!$store) fail(404, 'Store not found');
    $owner = ['linked_store_name' => $store['name'], 'linked_store_location' => $store['location']];
} else {
    $storeId = owner_store_id($conn, $user['id']);
    if (!$storeId) fail(403, 'An approved store-owner application is required');
    $sq = $conn->prepare('SELECT name, location FROM stores WHERE id = ?');
    $sq->bind_param('i', $storeId);
    $sq->execute();
    $store = $sq->get_result()->fetch_assoc();
    $owner = ['linked_store_name' => $store['name'], 'linked_store_location' => $store['location']];
}

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