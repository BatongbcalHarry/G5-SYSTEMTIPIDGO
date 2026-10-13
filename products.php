<?php
// ============================================================
// GET /api/products.php
// GET /api/products.php?category=hygiene
// Returns all products, each with its lowest price (and the store that has
// it) and highest price across stores. One query for the whole list.
// ============================================================

header('Content-Type: application/json');
require 'db.php';

$category = isset($_GET['category']) ? $_GET['category'] : 'all';

$sql = "SELECT p.id, p.name, p.category, p.base_price, p.image,
               MIN(pr.price) AS lowest,
               MAX(pr.price) AS highest,
               (SELECT s.name FROM prices x JOIN stores s ON s.id = x.store_id
                 WHERE x.product_id = p.id ORDER BY x.price ASC, x.id ASC LIMIT 1) AS lowest_store
        FROM products p
        LEFT JOIN prices pr ON pr.product_id = p.id";

if ($category !== 'all') {
    $stmt = $conn->prepare($sql . " WHERE p.category = ? GROUP BY p.id, p.name, p.category, p.base_price, p.image");
    $stmt->bind_param('s', $category);
    $stmt->execute();
    $result = $stmt->get_result();
} else {
    $result = $conn->query($sql . " GROUP BY p.id, p.name, p.category, p.base_price, p.image");
}

$products = [];
while ($row = $result->fetch_assoc()) {
    $products[] = [
        'id'           => (int)$row['id'],
        'name'         => $row['name'],
        'category'     => $row['category'],
        'basePrice'    => (float)$row['base_price'],
        'image'        => $row['image'] ?? null,
        // a product no store has priced yet falls back to its base price
        'lowestPrice'  => $row['lowest'] !== null ? (float)$row['lowest'] : (float)$row['base_price'],
        'lowestStore'  => $row['lowest_store'],
        'highestPrice' => $row['highest'] !== null ? (float)$row['highest'] : null
    ];
}

echo json_encode($products);
