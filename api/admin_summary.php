<?php
// GET /api/admin_summary.php -> system-wide dashboard counts

header('Content-Type: application/json');
session_start();
require 'db.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Administrator access required']);
    exit;
}

$counts = [];
foreach (['products', 'stores', 'prices', 'feedback', 'requests', 'users'] as $table) {
    $result = $conn->query("SELECT COUNT(*) AS total FROM `$table`");
    $counts[$table] = (int)$result->fetch_assoc()['total'];
}

$result = $conn->query("SELECT COUNT(*) AS total FROM store_owner_applications WHERE status = 'pending'");
$counts['pendingOwnerApplications'] = (int)$result->fetch_assoc()['total'];

echo json_encode($counts);
?>