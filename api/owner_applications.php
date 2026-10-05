<?php
// GET  /api/owner_applications.php -> applications visible to the current staff role
// POST /api/owner_applications.php -> { id, decision: "approved"|"rejected" }

header('Content-Type: application/json');
session_start();
require 'db.php';

$role = $_SESSION['role'] ?? '';
if (!isset($_SESSION['user_id']) || !in_array($role, ['admin', 'moderator'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Staff access required']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($role === 'admin') {
        $result = $conn->query("SELECT a.id, a.user_id, a.store_name, a.store_location, a.store_photo_mime, a.status, a.submitted_at, a.reviewed_at, u.full_name, u.email
            FROM store_owner_applications a
            JOIN users u ON u.id = a.user_id
            ORDER BY FIELD(a.status, 'pending', 'approved', 'rejected'), a.submitted_at DESC");
    } else {
        $result = $conn->query("SELECT a.id, a.user_id, a.store_name, a.store_location, a.store_photo_mime, a.status, a.submitted_at, a.reviewed_at, u.full_name, u.email
            FROM store_owner_applications a
            JOIN users u ON u.id = a.user_id
            WHERE a.status = 'pending'
            ORDER BY a.submitted_at ASC");
    }

    $applications = [];
    while ($row = $result->fetch_assoc()) {
        $applications[] = [
            'id' => (int)$row['id'],
            'userId' => (int)$row['user_id'],
            'fullName' => $row['full_name'],
            'email' => $row['email'],
            'storeName' => $row['store_name'],
            'storeLocation' => $row['store_location'],
            'photoAvailable' => $row['store_photo_mime'] !== null,
            'status' => $row['status'],
            'submittedAt' => $row['submitted_at'],
            'reviewedAt' => $row['reviewed_at']
        ];
    }

    echo json_encode($applications);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];
$id = isset($data['id']) ? (int)$data['id'] : 0;
$decision = isset($data['decision']) ? $data['decision'] : '';

if ($id < 1 || !in_array($decision, ['approved', 'rejected'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid application and decision are required']);
    exit;
}

$conn->begin_transaction();
try {
    $applicationQuery = $conn->prepare('SELECT store_id, store_name, store_location, store_photo_mime, status FROM store_owner_applications WHERE id = ? FOR UPDATE');
    $applicationQuery->bind_param('i', $id);
    $applicationQuery->execute();
    $application = $applicationQuery->get_result()->fetch_assoc();

    if (!$application) {
        $conn->rollback();
        http_response_code(404);
        echo json_encode(['error' => 'Application not found']);
        exit;
    }

    if ($role === 'moderator' && $application['status'] !== 'pending') {
        $conn->rollback();
        http_response_code(409);
        echo json_encode(['error' => 'Moderators can only review pending applications']);
        exit;
    }

    $reviewedBy = (int)$_SESSION['user_id'];
    if ($decision === 'approved') {
        if ($application['store_photo_mime'] === null) {
            $conn->rollback();
            http_response_code(409);
            echo json_encode(['error' => 'This application cannot be approved because it has no store photo']);
            exit;
        }

        $storeId = $application['store_id'] ? (int)$application['store_id'] : 0;
        if ($storeId === 0) {
            $createStore = $conn->prepare('INSERT INTO stores (name, location, verified) VALUES (?, ?, 0)');
            $createStore->bind_param('ss', $application['store_name'], $application['store_location']);
            $createStore->execute();
            $storeId = $conn->insert_id;
        }

        $update = $conn->prepare('UPDATE store_owner_applications SET status = ?, store_id = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?');
        $update->bind_param('siii', $decision, $storeId, $reviewedBy, $id);
    } else {
        $update = $conn->prepare('UPDATE store_owner_applications SET status = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?');
        $update->bind_param('sii', $decision, $reviewedBy, $id);
    }

    $update->execute();
    $conn->commit();
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['error' => 'Could not update the store-owner application']);
    exit;
}

echo json_encode(['id' => $id, 'status' => $decision]);
?>