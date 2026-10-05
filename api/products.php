<?php
// ============================================================
// GET /api/products.php
// GET /api/products.php?category=hygiene
// Returns all products, each with its lowest price across stores.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require 'db.php';

$category = isset($_GET['category']) ? $_GET['category'] : 'all';

if ($category !== 'all') {
    $stmt = $conn->prepare("SELECT * FROM products WHERE category = ?");
    $stmt->bind_param('s', $category);
    $stmt->execute();
    $result = $stmt->get_result();
} else {
    $result = $conn->query("SELECT * FROM products");
}

$products = [];
while ($row = $result->fetch_assoc()) {
    $pid = $row['id'];

    // find the lowest price across all stores for this product
    $priceStmt = $conn->prepare("SELECT MIN(price) AS lowest FROM prices WHERE product_id = ?");
    $priceStmt->bind_param('i', $pid);
    $priceStmt->execute();
    $lowestRow = $priceStmt->get_result()->fetch_assoc();

    $products[] = [
        'id'          => (int)$row['id'],
        'name'        => $row['name'],
        'category'    => $row['category'],
        'basePrice'   => (float)$row['base_price'],
        'image'       => $row['image'] ?? null,
        'lowestPrice' => $lowestRow['lowest'] !== null ? (float)$lowestRow['lowest'] : (float)$row['base_price']
    ];
}

echo json_encode($products);
?>
