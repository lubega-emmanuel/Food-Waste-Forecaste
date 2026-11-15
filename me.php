<?php
header("Content-Type: application/json");
require_once "../config/auth.php";
require_login();

echo json_encode(["username" => $_SESSION["username"]]);