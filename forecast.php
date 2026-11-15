<?php
header("Content-Type: application/json");
require_once "../config/db.php";
require_once "../config/auth.php";
require_login();

$BUFFER = 1.05; // 5% safety margin

// Target date: ?date=YYYY-MM-DD, default is tomorrow
$date = $_GET["date"] ?? date("Y-m-d", strtotime("+1 day"));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !strtotime($date)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid date"]);
    exit;
}

$targetWeekday = date("N", strtotime($date));

// Last 28 days of records before the target date
$stmt = $conn->prepare(
    "SELECT m.id, m.name, m.category, m.unit_cost,
            r.record_date, r.prepared, r.sold, r.wasted
     FROM menu_items m
     LEFT JOIN daily_records r
       ON r.item_id = m.id
      AND r.record_date < ?
      AND r.record_date >= DATE_SUB(?, INTERVAL 28 DAY)
     ORDER BY m.name, r.record_date"
);
$stmt->bind_param("ss", $date, $date);
$stmt->execute();
$result = $stmt->get_result();

// Group rows by item
$items = [];
while ($row = $result->fetch_assoc()) {
    $id = $row["id"];
    if (!isset($items[$id])) {
        $items[$id] = [
            "name" => $row["name"],
            "category" => $row["category"],
            "unit_cost" => (float)$row["unit_cost"],
            "all" => [],
            "sameDay" => [],
        ];
    }
    if ($row["record_date"] !== null) {
        $rec = [
            "prepared" => (int)$row["prepared"],
            "sold" => (int)$row["sold"],
            "wasted" => (int)$row["wasted"],
        ];
        $items[$id]["all"][] = $rec;
        if (date("N", strtotime($row["record_date"])) == $targetWeekday) {
            $items[$id]["sameDay"][] = $rec;
        }
    }
}

function avg($rows, $field) {
    if (count($rows) === 0) return 0;
    return array_sum(array_column($rows, $field)) / count($rows);
}

$output = [];
foreach ($items as $id => $item) {
    if (count($item["all"]) === 0) {
        $output[] = [
            "item_id" => $id,
            "name" => $item["name"],
            "category" => $item["category"],
            "forecast" => null,
            "suggested_prep" => null,
            "avg_prepared" => null,
            "avg_wasted" => null,
            "potential_saving" => null,
            "basis" => "No history yet",
        ];
        continue;
    }

    // Prefer the same weekday, fall back to everything
    if (count($item["sameDay"]) >= 2) {
        $basisRows = $item["sameDay"];
        $basis = "Same weekday (" . count($basisRows) . " days)";
    } else {
        $basisRows = $item["all"];
        $basis = "All recent days (" . count($basisRows) . " days)";
    }

    $forecast = avg($basisRows, "sold");
    $suggested = (int)ceil($forecast * $BUFFER);
    $avgPrepared = avg($basisRows, "prepared");
    $avgWasted = avg($basisRows, "wasted");
    $saving = max(0, $avgPrepared - $suggested) * $item["unit_cost"];

    $output[] = [
        "item_id" => $id,
        "name" => $item["name"],
        "category" => $item["category"],
        "forecast" => round($forecast, 1),
        "suggested_prep" => $suggested,
        "avg_prepared" => round($avgPrepared, 1),
        "avg_wasted" => round($avgWasted, 1),
        "potential_saving" => round($saving),
        "basis" => $basis,
    ];
}

echo json_encode([
    "date" => $date,
    "weekday" => date("l", strtotime($date)),
    "items" => $output,
]);

