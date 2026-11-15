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

function clean_item($data) {
    $name = trim($data["name"] ?? "");
    $category = trim($data["category"] ?? "");
    $cost = $data["unit_cost"] ?? null;

    if ($name === "" || $category === "") {
        fail(400, "Name and category are required");
    }
    if (strlen($name) > 100) {
        fail(400, "Name is too long");
    }
    if (!is_numeric($cost) || $cost < 0) {
        fail(400, "Unit cost must be 0 or more");
    }
    return [$name, $category, (float)$cost];
}

$method = $_SERVER["REQUEST_METHOD"];
$input = json_decode(file_get_contents("php://input"), true) ?? [];

// List items
if ($method === "GET") {
    $result = $conn->query("SELECT id, name, category, unit_cost FROM menu_items ORDER BY name");
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    echo json_encode($rows);
    exit;
}

// Add an item
if ($method === "POST") {
    [$name, $category, $cost] = clean_item($input);

    $stmt = $conn->prepare("SELECT id FROM menu_items WHERE name = ?");
    $stmt->bind_param("s", $name);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        fail(409, "An item with that name already exists");
    }

    $stmt = $conn->prepare("INSERT INTO menu_items (name, category, unit_cost) VALUES (?, ?, ?)");
    $stmt->bind_param("ssd", $name, $category, $cost);
    $stmt->execute();

    echo json_encode(["success" => true, "id" => $conn->insert_id]);
    exit;
}

// Edit an item
if ($method === "PUT") {
    $id = (int)($input["id"] ?? 0);
    if ($id <= 0) {
        fail(400, "Missing item id");
    }
    [$name, $category, $cost] = clean_item($input);

    $stmt = $conn->prepare("SELECT id FROM menu_items WHERE name = ? AND id <> ?");
    $stmt->bind_param("si", $name, $id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        fail(409, "Another item already has that name");
    }

    $stmt = $conn->prepare("UPDATE menu_items SET name = ?, category = ?, unit_cost = ? WHERE id = ?");
    $stmt->bind_param("ssdi", $name, $category, $cost, $id);
    $stmt->execute();

    echo json_encode(["success" => true]);
    exit;
}

// Delete an item (its records are deleted too)
if ($method === "DELETE") {
    $id = (int)($_GET["id"] ?? 0);
    if ($id <= 0) {
        fail(400, "Missing item id");
    }

    $stmt = $conn->prepare("DELETE FROM menu_items WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();

    echo json_encode(["success" => true]);
    exit;
}

fail(405, "Method not allowed");