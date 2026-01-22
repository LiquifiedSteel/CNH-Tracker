<?php
// ================== BOOTSTRAP ==================

require_once __DIR__ . "/vendor/autoload.php";

use Google\Client;
use Google\Service\Sheets;

// ---------- Headers ----------
header("Content-Type: application/json");
header("X-Robots-Tag: noindex, nofollow");

// ---------- CORS ----------
$CORS_ORIGIN = getenv("CORS_ORIGIN") ?: "*";
header("Access-Control-Allow-Origin: $CORS_ORIGIN");
header("Access-Control-Allow-Headers: Content-Type, X-API-Key");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

// ---------- API Key ----------
$CONFIGURED_KEY = getenv("API_KEY");

if ($CONFIGURED_KEY) {
    $providedKey = $_SERVER["HTTP_X_API_KEY"] ?? "";
    if ($providedKey !== $CONFIGURED_KEY) {
        http_response_code(401);
        echo json_encode(["ok" => false, "error" => "Unauthorized"]);
        exit;
    }
}

// ---------- JSON Body ----------
$BODY = json_decode(file_get_contents("php://input"), true) ?? [];

// ---------- Storage ----------
$STORE_PATH = getenv("ACTIVE_SHEET_STORE") ?: __DIR__ . "/activeSheet.json";

// ================== HELPERS ==================

function errorResponse($status, $msg, $details = null) {
    http_response_code($status);
    $out = ["ok" => false, "error" => $msg];
    if ($details && getenv("NODE_ENV") !== "production") {
        $out["details"] = $details;
    }
    echo json_encode($out);
    exit;
}

function getSheetsClient(): Sheets {
    static $svc = null;
    if ($svc) return $svc;

    $client = new Client();
    $client->setScopes([Sheets::SPREADSHEETS]);

    $creds = getenv("GOOGLE_APPLICATION_CREDENTIALS");
    if (!$creds) {
        errorResponse(500, "GOOGLE_APPLICATION_CREDENTIALS not set");
    }

    $client->setAuthConfig($creds);
    $svc = new Sheets($client);
    return $svc;
}

function normalizeSpreadsheetId($input) {
    if (!$input) return null;
    if (strpos($input, "http") === false) return trim($input);
    preg_match("/spreadsheets\/d\/([a-zA-Z0-9-_]+)/", $input, $m);
    return $m[1] ?? null;
}

function loadSpreadsheetId($path) {
    if (!file_exists($path)) return null;
    $j = json_decode(file_get_contents($path), true);
    return $j["spreadsheetId"] ?? null;
}

function saveSpreadsheetId($path, $id) {
    file_put_contents(
        $path,
        json_encode(["spreadsheetId" => $id, "updatedAt" => date("c")], JSON_PRETTY_PRINT)
    );
}

function columnToA1($idx) {
    $s = "";
    $n = $idx + 1;
    while ($n > 0) {
        $r = ($n - 1) % 26;
        $s = chr(65 + $r) . $s;
        $n = intdiv($n - 1, 26);
    }
    return $s;
}

// ================== ROUTING ==================

$method = $_SERVER["REQUEST_METHOD"];
$action = $_GET["action"] ?? "";

// ---------- POST /link ----------
if ($method === "POST" && $action === "link") {
    $spreadsheetId = normalizeSpreadsheetId($BODY["spreadsheetId"] ?? "");
    if (!$spreadsheetId) {
        errorResponse(400, "Invalid spreadsheetId");
    }

    $sheets = getSheetsClient();
    $meta = $sheets->spreadsheets->get($spreadsheetId);

    saveSpreadsheetId($STORE_PATH, $meta->spreadsheetId);

    echo json_encode([
        "ok" => true,
        "spreadsheetId" => $meta->spreadsheetId,
        "spreadsheetTitle" => $meta->properties->title
    ]);
    exit;
}

// ---------- GET /rows ----------
if ($method === "GET" && $action === "rows") {
    $spreadsheetId = loadSpreadsheetId($STORE_PATH);
    if (!$spreadsheetId) {
        errorResponse(400, "No spreadsheet linked");
    }

    $sheets = getSheetsClient();
    $meta = $sheets->spreadsheets->get($spreadsheetId);
    $tab = $meta->sheets[0]->properties->title;

    $values = $sheets->spreadsheets_values->get($spreadsheetId, $tab);

    echo json_encode([
        "ok" => true,
        "spreadsheetId" => $spreadsheetId,
        "sheetTitle" => $tab,
        "rows" => $values->values ?? []
    ]);
    exit;
}

// ---------- PUT /complete /incomplete /comment ----------
if ($method === "PUT" && in_array($action, ["complete", "incomplete", "comment"])) {
    $spreadsheetId = loadSpreadsheetId($STORE_PATH);
    if (!$spreadsheetId) errorResponse(400, "No spreadsheet linked");

    $device = trim((string)($BODY["device"] ?? ""));
    if (!$device) errorResponse(400, "Device is required");

    $sheets = getSheetsClient();
    $meta = $sheets->spreadsheets->get($spreadsheetId);
    $tab = $meta->sheets[0]->properties->title;

    $data = $sheets->spreadsheets_values->get($spreadsheetId, $tab)->values ?? [];
    $header = $data[0] ?? [];

    $deviceCol = array_search("Device", $header);
    if ($deviceCol === false) errorResponse(500, "Device column not found");

    $targetColName = $action === "comment" ? "Comment" : "Completed";
    $targetCol = array_search($targetColName, $header);
    if ($targetCol === false) errorResponse(500, "$targetColName column not found");

    $rowIndex = -1;
    for ($i = 1; $i < count($data); $i++) {
        if (strcasecmp(trim((string)($data[$i][$deviceCol] ?? "")), $device) === 0) {
            $rowIndex = $i + 1;
            break;
        }
    }

    if ($rowIndex === -1) errorResponse(404, "Device not found");

    if ($action === "comment") {
        $value = $BODY["comment"] ?? "";
        if (preg_match("/^[=+\\-@]/", $value)) $value = "'" . $value;
    } else {
        $value = $action === "complete" ? "TRUE" : "FALSE";
    }

    $range = $tab . "!" . columnToA1($targetCol) . $rowIndex;

    $sheets->spreadsheets_values->update(
        $spreadsheetId,
        $range,
        new Google\Service\Sheets\ValueRange([
            "values" => [[$value]]
        ]),
        ["valueInputOption" => "USER_ENTERED"]
    );

    echo json_encode(["ok" => true]);
    exit;
}

errorResponse(404, "Route not found");
