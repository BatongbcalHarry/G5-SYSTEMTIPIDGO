<?php
// Small key/value settings table (created on first use).
function settings_load($conn): array {
    $conn->query("CREATE TABLE IF NOT EXISTS settings (
        name VARCHAR(50) PRIMARY KEY,
        value VARCHAR(500) NOT NULL DEFAULT ''
    )");
    $s = ['owner_registration' => '1', 'announcement' => ''];
    $r = $conn->query("SELECT name, value FROM settings");
    while ($row = $r->fetch_assoc()) $s[$row['name']] = $row['value'];
    return $s;
}
