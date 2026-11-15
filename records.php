<?php
header("Content-Type: application/json");
require_once "../config/db.php";
require_once "../config/auth.php";
require_login();

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(["error" => $msg]);
    exit;
}

function whole($v) {
    return (is_numeric($v) && $v >= 0 && floor($v) == $v) ? (int)$v : null;
}

function valid_date($d) {
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) {
        return false;
    }
    return checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
}

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    $date = $_GET["date"] ?? date("Y-m-d");
    if (!valid_date($date)) {
        fail(400, "Invalid date");
    }

    $stmt = $conn->prepare(
        "SELECT m.id AS item_id, m.name, m.category,
                COALESCE(r.prepared, 0) AS prepared,
                COALESCE(r.sold, 0)     AS sold,
                COALESCE(r.wasted, 0)   AS wasted
         FROM menu_items m
         LEFT JOIN daily_records r
           ON r.item_id = m.id AND r.record_date = ?
         ORDER BY m.name"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $result = $stmt->get_result();

    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    echo json_encode($rows);
    exit;
}

if ($method === "POST") {
    $data = json_decode(file_get_contents("php://input"), true) ?? [];

    $item_id = (int)($data["item_id"] ?? 0);
    $date = $data["record_date"] ?? "";
    $prepared = whole($data["prepared"] ?? 0);
    $sold = whole($data["sold"] ?? 0);
    $wasted = whole($data["wasted"] ?? 0);

    if ($item_id <= 0 || !valid_date($date)) {
        fail(400, "A valid item and date are required");
    }
    if ($prepared === null || $sold === null || $wasted === null) {
        fail(400, "Numbers must be whole numbers, 0 or more");
    }
    if ($sold + $wasted > $prepared) {
        fail(400, "Sold plus wasted can't be more than prepared");
    }

    $stmt = $conn->prepare("SELECT id FROM menu_items WHERE id = ?");
    $stmt->bind_param("i", $item_id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        fail(404, "That menu item no longer exists");
    }

    $stmt = $conn->prepare(
        "INSERT INTO daily_records (item_id, record_date, prepared, sold, wasted)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           prepared = VALUES(prepared),
           sold     = VALUES(sold),
           wasted   = VALUES(wasted)"
    );
    $stmt->bind_param("isiii", $item_id, $date, $prepared, $sold, $wasted);
    $stmt->execute();

    echo json_encode(["success" => true]);
    exit;
}

fail(405, "Method not allowed");