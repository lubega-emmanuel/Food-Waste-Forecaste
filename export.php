<?php
require_once "../config/db.php";
require_once "../config/auth.php";
require_login();

function valid_date($d) {
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) {
        return false;
    }
    return checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
}

$from = $_GET["from"] ?? "";
$to = $_GET["to"] ?? "";

if (!valid_date($from) || !valid_date($to) || $from > $to) {
    http_response_code(400);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Invalid date range"]);
    exit;
}

$stmt = $conn->prepare(
    "SELECT r.record_date, m.name, m.category, m.unit_cost,
            r.prepared, r.sold, r.wasted
     FROM daily_records r
     JOIN menu_items m ON m.id = r.item_id
     WHERE r.record_date BETWEEN ? AND ?
     ORDER BY r.record_date, m.name"
);
$stmt->bind_param("ss", $from, $to);
$stmt->execute();
$result = $stmt->get_result();

header("Content-Type: text/csv; charset=utf-8");
header('Content-Disposition: attachment; filename="waste-records-' . $from . '-to-' . $to . '.csv"');

$out = fopen("php://output", "w");
fwrite($out, "\xEF\xBB\xBF"); // helps Excel read the file correctly

fputcsv($out, ["Date", "Item", "Category", "Unit cost", "Prepared", "Sold", "Wasted", "Waste %", "Waste cost"], ",", "\"", "\\");

while ($r = $result->fetch_assoc()) {
    $prepared = (int)$r["prepared"];
    $wasted = (int)$r["wasted"];
    $pct = $prepared > 0 ? round($wasted / $prepared * 100, 1) : 0;
    $cost = $wasted * (float)$r["unit_cost"];

    fputcsv($out, [
        $r["record_date"], $r["name"], $r["category"], $r["unit_cost"],
        $prepared, (int)$r["sold"], $wasted, $pct, $cost,
    ], ",", "\"", "\\");
}

fclose($out);