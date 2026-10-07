<?php
// ============================================================
// ONE-TIME SETUP: open this file once in your browser
// (http://localhost/tipidgo/api/setup.php?key=YOUR_SETUP_KEY)
// to create staff accounts. Safe to run more than once - it
// skips accounts that already exist.
//
// SECURITY: this only runs with the correct ?key= value below.
// Change SETUP_KEY to your own secret before using this, and
// consider deleting this file entirely once your accounts are
// created - it should not stay reachable on a public/live site.
// ============================================================

define('SETUP_KEY', 'change-this-before-running');

$providedKey = $_GET['key'] ?? '';
if (!hash_equals(SETUP_KEY, $providedKey)) {
    http_response_code(403);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Missing or incorrect setup key']));
}

header('Content-Type: application/json');
require 'db.php';

$conn->query("CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at DATE NOT NULL
)");

$conn->query("CREATE TABLE IF NOT EXISTS store_owner_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    store_id INT NULL,
    store_name VARCHAR(100) NOT NULL,
    store_location VARCHAR(150) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    reviewed_by INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
)");

$storeIdColumn = $conn->query("SHOW COLUMNS FROM store_owner_applications LIKE 'store_id'");
if ($storeIdColumn->num_rows === 0) {
    $conn->query('ALTER TABLE store_owner_applications ADD COLUMN store_id INT NULL AFTER user_id');
}

$photoMimeColumn = $conn->query("SHOW COLUMNS FROM store_owner_applications LIKE 'store_photo_mime'");
if ($photoMimeColumn->num_rows === 0) {
    $conn->query('ALTER TABLE store_owner_applications ADD COLUMN store_photo_mime VARCHAR(30) NULL AFTER store_location');
}

$photoColumn = $conn->query("SHOW COLUMNS FROM store_owner_applications LIKE 'store_photo'");
if ($photoColumn->num_rows === 0) {
    $conn->query('ALTER TABLE store_owner_applications ADD COLUMN store_photo MEDIUMBLOB NULL AFTER store_photo_mime');
}

$approvedApplications = $conn->query("SELECT id, store_name, store_location FROM store_owner_applications WHERE status = 'approved' AND store_id IS NULL");
while ($application = $approvedApplications->fetch_assoc()) {
    $storeCheck = $conn->prepare('SELECT id FROM stores WHERE name = ? AND location = ? ORDER BY id LIMIT 1');
    $storeCheck->bind_param('ss', $application['store_name'], $application['store_location']);
    $storeCheck->execute();
    $store = $storeCheck->get_result()->fetch_assoc();

    if (!$store) {
        $createStore = $conn->prepare('INSERT INTO stores (name, location, verified) VALUES (?, ?, 0)');
        $createStore->bind_param('ss', $application['store_name'], $application['store_location']);
        $createStore->execute();
        $storeId = $conn->insert_id;
    } else {
        $storeId = (int)$store['id'];
    }

    $linkStore = $conn->prepare('UPDATE store_owner_applications SET store_id = ? WHERE id = ?');
    $linkStore->bind_param('ii', $storeId, $application['id']);
    $linkStore->execute();
}

$accounts = [
    ['full_name' => 'Admin User', 'email' => 'admin@tipidgo.com', 'password' => 'admin123', 'role' => 'admin'],
    ['full_name' => 'Moderator User', 'email' => 'moderator@tipidgo.com', 'password' => 'moderator123', 'role' => 'moderator'],
];

$created = [];
$skipped = [];

foreach ($accounts as $acc) {
    $check = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $check->bind_param('s', $acc['email']);
    $check->execute();
    $exists = $check->get_result()->fetch_assoc();

    if ($exists) {
        $skipped[] = $acc['email'];
        continue;
    }

    $hash = password_hash($acc['password'], PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, CURDATE())");
    $stmt->bind_param('ssss', $acc['full_name'], $acc['email'], $hash, $acc['role']);
    $stmt->execute();
    $created[] = $acc['email'];
}

echo json_encode([
    'created' => $created,
    'skipped_existing' => $skipped,
    'note' => 'Admin: admin@tipidgo.com / admin123; Moderator: moderator@tipidgo.com / moderator123'
]);
?>
