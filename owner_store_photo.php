<?php
// GET /api/owner_store_photo.php?id=123 -> private store photo for staff review

session_start();
require 'db.php';

require 'auth.php';
require_role(['admin', 'moderator']);

$applicationId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if (!$applicationId || $applicationId < 1) {
    http_response_code(400);
    exit;
}

$stmt = $conn->prepare('SELECT store_photo_mime, store_photo FROM store_owner_applications WHERE id = ?');
$stmt->bind_param('i', $applicationId);
$stmt->execute();
$application = $stmt->get_result()->fetch_assoc();

if (!$application || $application['store_photo_mime'] === null || $application['store_photo'] === null) {
    http_response_code(404);
    exit;
}

if (!in_array($application['store_photo_mime'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
    http_response_code(404);
    exit;
}

header('Content-Type: ' . $application['store_photo_mime']);
header('Content-Length: ' . strlen($application['store_photo']));
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
echo $application['store_photo'];
?>
