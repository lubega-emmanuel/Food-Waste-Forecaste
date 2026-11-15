<?php
date_default_timezone_set("Africa/Kampala");

$isLocal = in_array($_SERVER["SERVER_NAME"] ?? "", ["localhost", "127.0.0.1"]);

if ($isLocal) {
    $host = "localhost";
    $user = "root";
    $pass = "";
    $dbname = "food_forecaster";
} else {
    $host = "sql200.infinityfree.com";
    $user = "if0_43243807";
    $pass = "foodforecaster2026";
    $dbname = "if0_43243807_forecaster";
}

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode(["error" => "Database connection failed"]));
}

$conn->set_charset("utf8mb4");
$conn->query("SET time_zone = '+03:00'"); // keep database dates on Kampala time