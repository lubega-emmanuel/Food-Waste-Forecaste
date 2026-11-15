<?php
header("Content-Type: application/json");
require_once "../config/db.php";
require_once "../config/auth.php";

$data = json_decode(file_get_contents("php://input"), true);
$username = trim($data["username"] ?? "");
$password = $data["password"] ?? "";

$stmt = $conn->prepare("SELECT id, password_hash FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user || !password_verify($password, $user["password_hash"])) {
    http_response_code(401);
    echo json_encode(["error" => "Wrong username or password"]);
    exit;
}

session_regenerate_id(true);
$_SESSION["user_id"] = $user["id"];
$_SESSION["username"] = $username;

echo json_encode(["success" => true]);