<?php
// GET  /api/settings.php -> public: { ownerRegistrationOpen, announcement }
// POST /api/settings.php -> admin only: { owner_registration: bool, announcement: string }
header('Content-Type: application/json');
session_start();
require 'db.php';
require 'auth.php';
require 'settings_helper.php';

$s = settings_load($conn);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_role(['admin']);
    $d = json_body();
    $open = !empty($d['owner_registration']) ? '1' : '0';
    $note = mb_substr(trim($d['announcement'] ?? ''), 0, 300);
    $stmt = $conn->prepare("INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)");
    foreach (['owner_registration' => $open, 'announcement' => $note] as $k => $v) {
        $stmt->bind_param('ss', $k, $v);
        $stmt->execute();
    }
    $s['owner_registration'] = $open;
    $s['announcement'] = $note;
}

echo json_encode(['ownerRegistrationOpen' => $s['owner_registration'] === '1', 'announcement' => $s['announcement']]);
