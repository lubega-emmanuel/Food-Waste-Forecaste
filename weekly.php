<?php
header("Content-Type: application/json");
require_once "../config/db.php";
require_once "../config/auth.php";
require_login();

$sql = "SELECT m.name, m.unit_cost,
    COALESCE(SUM(CASE WHEN r.record_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN r.prepared END), 0) AS prepared,
    COALESCE(SUM(CASE WHEN r.record_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN r.sold END), 0) AS sold,
    COALESCE(SUM(CASE WHEN r.record_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN r.wasted END), 0) AS wasted,
    COALESCE(SUM(CASE WHEN r.record_date <  DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN r.prepared END), 0) AS prev_prepared,
    COALESCE(SUM(CASE WHEN r.record_date <  DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN r.wasted END), 0) AS prev_wasted
  FROM menu_items m
  LEFT JOIN daily_records r
    ON r.item_id = m.id
   AND r.record_date >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
   AND r.record_date <= CURDATE()
  GROUP BY m.id, m.name, m.unit_cost
  ORDER BY m.name";

$result = $conn->query($sql);

function percent_of($part, $whole) {
    return $whole > 0 ? round($part / $whole * 100, 1) : 0;
}

$items = [];
$t = [
    "prepared" => 0, "sold" => 0, "wasted" => 0, "cost" => 0,
    "prev_prepared" => 0, "prev_wasted" => 0, "prev_cost" => 0,
];

while ($r = $result->fetch_assoc()) {
    $cost = (int)$r["wasted"] * (float)$r["unit_cost"];
    $prevCost = (int)$r["prev_wasted"] * (float)$r["unit_cost"];

    $items[] = [
        "name" => $r["name"],
        "prepared" => (int)$r["prepared"],
        "sold" => (int)$r["sold"],
        "wasted" => (int)$r["wasted"],
        "waste_pct" => percent_of((int)$r["wasted"], (int)$r["prepared"]),
        "cost" => round($cost),
        "prev_cost" => round($prevCost),
    ];

    $t["prepared"] += (int)$r["prepared"];
    $t["sold"] += (int)$r["sold"];
    $t["wasted"] += (int)$r["wasted"];
    $t["cost"] += $cost;
    $t["prev_prepared"] += (int)$r["prev_prepared"];
    $t["prev_wasted"] += (int)$r["prev_wasted"];
    $t["prev_cost"] += $prevCost;
}

$t["waste_pct"] = percent_of($t["wasted"], $t["prepared"]);
$t["prev_waste_pct"] = percent_of($t["prev_wasted"], $t["prev_prepared"]);
$t["cost"] = round($t["cost"]);
$t["prev_cost"] = round($t["prev_cost"]);

echo json_encode([
    "from" => date("Y-m-d", strtotime("-6 days")),
    "to" => date("Y-m-d"),
    "items" => $items,
    "totals" => $t,
]);