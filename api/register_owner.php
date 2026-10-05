<?php
// ============================================================
// POST /api/register_owner.php
// multipart/form-data: applicant/store details, password, and required store_photo image
// Creates a pending store-owner application; approval is required before sign-in.
// ============================================================

header('Content-Type: application/json');
session_start();
require 'db.php';

$fullName      = isset($_POST['full_name']) ? trim($_POST['full_name']) : '';
$storeName     = isset($_POST['store_name']) ? trim($_POST['store_name']) : '';
$storeLocation = isset($_POST['store_location']) ? trim($_POST['store_location']) : '';
$email         = isset($_POST['email']) ? trim($_POST['email']) : '';
$password      = isset($_POST['password']) ? $_POST['password'] : '';

if ($fullName === '' || $storeName === '' || $storeLocation === '' || $email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Name, store name, location, email, and password are required']);
    exit;
}

if (!isset($_FILES['store_photo'])) {
    http_response_code(400);
    echo json_encode(['error' => 'A photo of your store is required']);
    exit;
}

$photo = $_FILES['store_photo'];
if ($photo['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    $message = $photo['error'] === UPLOAD_ERR_INI_SIZE || $photo['error'] === UPLOAD_ERR_FORM_SIZE
        ? 'The store photo must be 5 MB or smaller'
        : 'The store photo could not be uploaded';
    echo json_encode(['error' => $message]);
    exit;
}

if ($photo['size'] < 1 || $photo['size'] > 5 * 1024 * 1024 || !is_uploaded_file($photo['tmp_name'])) {
    http_response_code(400);
    echo json_encode(['error' => 'The store photo must be a valid image no larger than 5 MB']);
    exit;
}

$imageInfo = @getimagesize($photo['tmp_name']);
$finfo = new finfo(FILEINFO_MIME_TYPE);
$photoMime = $finfo->file($photo['tmp_name']);
$allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];
if ($imageInfo === false || !in_array($photoMime, $allowedPhotoTypes, true) || $imageInfo['mime'] !== $photoMime) {
    http_response_code(400);
    echo json_encode(['error' => 'Choose a valid JPEG, PNG, or WebP store photo']);
    exit;
}

$photoContents = file_get_contents($photo['tmp_name']);
if ($photoContents === false) {
    http_response_code(400);
    echo json_encode(['error' => 'The store photo could not be read']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Enter a valid email address']);
    exit;
}

if (strlen($password) < 8 || !preg_match('/[^A-Za-z0-9]/', $password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 8 characters and include at least 1 special character']);
    exit;
}

$check = $conn->prepare('SELECT id FROM users WHERE email = ?');
$check->bind_param('s', $email);
$check->execute();
if ($check->get_result()->fetch_assoc()) {
    http_response_code(409);
    echo json_encode(['error' => 'An account with that email already exists']);
    exit;
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$conn->begin_transaction();
try {
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'store_owner', CURDATE())");
    $stmt->bind_param('sss', $fullName, $email, $hash);
    $stmt->execute();
    $userId = $conn->insert_id;

    $application = $conn->prepare("INSERT INTO store_owner_applications (user_id, store_name, store_location, store_photo_mime, store_photo) VALUES (?, ?, ?, ?, ?)");
    $emptyPhoto = '';
    $application->bind_param('isssb', $userId, $storeName, $storeLocation, $photoMime, $emptyPhoto);
    $application->send_long_data(4, $photoContents);
    $application->execute();
    $conn->commit();
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['error' => 'Could not submit the store-owner application']);
    exit;
}

http_response_code(202);
echo json_encode([
    'status'  => 'pending',
    'message' => 'Your store-owner application is pending moderator approval.'
]);
?>