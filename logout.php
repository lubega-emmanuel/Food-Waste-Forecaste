<?php
header("Content-Type: application/json");
require_once "../config/auth.php";

$_SESSION = [];
session_destroy();

echo json_encode(["success" => true]);