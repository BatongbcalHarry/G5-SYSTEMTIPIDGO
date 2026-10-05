<?php
// ============================================================
// GET /api/stores.php
// Returns all stores.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require 'db.php';

$result = $conn->query("SELECT * FROM stores");

$stores = [];
while ($row = $result->fetch_assoc()) {
    $stores[] = [
        'id'       => (int)$row['id'],
        'name'     => $row['name'],
        'location' => $row['location'],
        'verified' => (bool)$row['verified']
    ];
}

echo json_encode($stores);
?>
