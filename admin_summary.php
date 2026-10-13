<?php
// GET /api/admin_summary.php -> system-wide dashboard counts

header('Content-Type: application/json');
session_start();
require 'db.php';

require 'auth.php';
require_role(['admin']);

// all counts in one round trip
$row = $conn->query("SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM stores) AS stores,
    (SELECT COUNT(*) FROM prices) AS prices,
    (SELECT COUNT(*) FROM feedback) AS feedback,
    (SELECT COUNT(*) FROM requests) AS requests,
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM store_owner_applications WHERE status = 'pending') AS pendingOwnerApplications")->fetch_assoc();

echo json_encode(array_map('intval', $row));
