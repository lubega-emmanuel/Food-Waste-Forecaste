<?php
header("Content-Type: application/json");
require_once "../config/db.php";
require_once "../config/auth.php";
require_login();

$days = isset($_GET["days"]) ? (int)$_GET["days"] : 28;
if ($days < 1 || $days > 365) {
    $days = 28;
}

// 1) Waste per day (units and money)
$stmt = $conn->prepare(
    "SELECT r.record_date,
            SUM(r.wasted) AS units,
            SUM(r.wasted * m.unit_cost) AS cost
     FROM daily_records r
     JOIN menu_items m ON m.id = r.item_id
     WHERE r.record_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY r.record_date
     ORDER BY r.record_date"
);
$stmt->bind_param("i", $days);
$stmt->execute();
$daily = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// 2) Waste per item over the period
$stmt = $conn->prepare(
    "SELECT m.name,
            SUM(r.prepared) AS prepared,
            SUM(r.wasted) AS wasted,
            SUM(r.wasted * m.unit_cost) AS cost
     FROM menu_items m
     JOIN daily_records r ON r.item_id = m.id
     WHERE r.record_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY m.id, m.name
     ORDER BY cost DESC"
);
$stmt->bind_param("i", $days);
$stmt->execute();
$perItem = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// 3) Waste cost for the last 7 days
$weekCost = (float)$conn->query(
    "SELECT COALESCE(SUM(r.wasted * m.unit_cost), 0) AS cost
     FROM daily_records r
     JOIN menu_items m ON m.id = r.item_id
     WHERE r.record_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
)->fetch_assoc()["cost"];

// 4) Per-item numbers for the last 7 days (used by alerts)
$weekItems = $conn->query(
    "SELECT m.name,
            SUM(r.prepared) AS prepared,
            SUM(r.wasted) AS wasted
     FROM menu_items m
     JOIN daily_records r ON r.item_id = m.id
     WHERE r.record_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY m.id, m.name"
)->fetch_all(MYSQLI_ASSOC);

// 5) Days since anything was logged
$row = $conn->query(
    "SELECT DATEDIFF(CURDATE(), MAX(record_date)) AS d FROM daily_records"
)->fetch_assoc();
$daysSince = $row["d"] === null ? null : (int)$row["d"];

// Summary numbers
$totalPrepared = array_sum(array_column($perItem, "prepared"));
$totalWasted = array_sum(array_column($perItem, "wasted"));
$avgWastePct = $totalPrepared > 0 ? round(($totalWasted / $totalPrepared) * 100, 1) : 0;
$worst = (count($perItem) > 0 && (float)$perItem[0]["cost"] > 0)
    ? $perItem[0]["name"]
    : null;

echo json_encode([
    "days" => $days,
    "daily" => $daily,
    "per_item" => $perItem,
    "week_items" => $weekItems,
    "days_since_last" => $daysSince,
    "summary" => [
        "week_cost" => $weekCost,
        "avg_waste_pct" => $avgWastePct,
        "worst_item" => $worst,
    ],
]);