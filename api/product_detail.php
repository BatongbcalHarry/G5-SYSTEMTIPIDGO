<?php
// ============================================================
// GET /api/product_detail.php?id=1
// Returns one product + its price comparison across stores
// (sorted cheapest first) + its price history.
// ============================================================

header('Content-Type: application/json');
require 'db.php';

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

$stmt = $conn->prepare("SELECT * FROM products WHERE id = ?");
$stmt->bind_param('i', $id);
$stmt->execute();
$product = $stmt->get_result()->fetch_assoc();

if (!$product) {
    http_response_code(404);
    echo json_encode(['error' => 'Product not found']);
    exit;
}

// price comparison across stores, cheapest first
$priceStmt = $conn->prepare("
    SELECT p.price, p.last_updated, s.id AS store_id, s.name AS store_name, s.verified
    FROM prices p
    JOIN stores s ON p.store_id = s.id
    WHERE p.product_id = ?
    ORDER BY p.price ASC
");
$priceStmt->bind_param('i', $id);
$priceStmt->execute();
$priceResult = $priceStmt->get_result();

$prices = [];
while ($row = $priceResult->fetch_assoc()) {
    $prices[] = [
        'storeId'     => (int)$row['store_id'],
        'storeName'   => $row['store_name'],
        'verified'    => (bool)$row['verified'],
        'price'       => (float)$row['price'],
        'lastUpdated' => $row['last_updated']
    ];
}

// price history (oldest to newest)
$historyStmt = $conn->prepare("
    SELECT price, recorded_date
    FROM price_history
    WHERE product_id = ?
    ORDER BY recorded_date ASC
");
$historyStmt->bind_param('i', $id);
$historyStmt->execute();
$historyResult = $historyStmt->get_result();

$history = [];
while ($row = $historyResult->fetch_assoc()) {
    $history[] = [
        'price' => (float)$row['price'],
        'date'  => $row['recorded_date']
    ];
}

echo json_encode([
    'product' => [
        'id'        => (int)$product['id'],
        'name'      => $product['name'],
        'category'  => $product['category'],
        'basePrice' => (float)$product['base_price'],
        'image'     => $product['image'] ?? null
    ],
    'prices'  => $prices,
    'history' => $history
]);
?>
