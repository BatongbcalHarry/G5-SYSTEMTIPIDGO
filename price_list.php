<?php
// ============================================================
// GET /api/price_list.php
// Returns every store and every product with its price at each
// store. Used by the Budget screen's smart shopping list
// (store comparison + cheaper alternatives).
// ============================================================

header('Content-Type: application/json');
require 'db.php';

$stores = [];
$storeResult = $conn->query("SELECT id, name, location, verified FROM stores ORDER BY name");
while ($row = $storeResult->fetch_assoc()) {
    $stores[] = [
        'id'       => (int)$row['id'],
        'name'     => $row['name'],
        'location' => $row['location'],
        'verified' => (bool)$row['verified']
    ];
}

// one pass over products + their prices. If a store somehow has two rows
// for the same product, the most recently updated one wins.
$result = $conn->query("
    SELECT p.id, p.name, p.category, p.base_price, p.image,
           pr.price, pr.last_updated, s.id AS store_id, s.name AS store_name, s.verified
    FROM products p
    LEFT JOIN prices pr ON pr.product_id = p.id
    LEFT JOIN stores s ON s.id = pr.store_id
    ORDER BY p.name ASC, pr.last_updated ASC, pr.id ASC
");

$products = [];
while ($row = $result->fetch_assoc()) {
    $pid = (int)$row['id'];
    if (!isset($products[$pid])) {
        $products[$pid] = [
            'id'        => $pid,
            'name'      => $row['name'],
            'category'  => $row['category'],
            'basePrice' => (float)$row['base_price'],
            'image'     => $row['image'] ?? null,
            'prices'    => []   // keyed by store id so duplicates collapse
        ];
    }
    if ($row['store_id'] !== null && $row['price'] !== null) {
        $products[$pid]['prices'][(int)$row['store_id']] = [
            'storeId'   => (int)$row['store_id'],
            'storeName' => $row['store_name'],
            'verified'  => (bool)$row['verified'],
            'price'     => (float)$row['price']
        ];
    }
}

$out = [];
foreach ($products as $p) {
    $p['prices'] = array_values($p['prices']);
    $out[] = $p;
}

echo json_encode(['stores' => $stores, 'products' => $out]);
?>
