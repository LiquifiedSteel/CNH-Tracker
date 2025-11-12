/**
 * Google Sheets Router (Express) — Link a spreadsheet file, read all rows, toggle "Completed"
 * -------------------------------------------------------------------------------------------
 * Endpoints
 *   POST /google-sheets/link
 *   GET  /google-sheets/rows
 *   PUT  /google-sheets/complete     Body: { device: "<device name>" }     -> Completed = TRUE
 *   PUT  /google-sheets/uncomplete   Body: { device: "<device name>" }     -> Completed = FALSE
 *
 * Auth: Service Account (Sheets API enabled). Share the Sheet with the SA email (Editor for writes).
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const router = express.Router();
router.use(express.json());

// ---------------- Configuration ----------------

const STORE_PATH =
  process.env.ACTIVE_SHEET_STORE && process.env.ACTIVE_SHEET_STORE.trim().length > 0
    ? process.env.ACTIVE_SHEET_STORE
    : path.resolve(process.cwd(), "activeSheet.json");

function loadActiveSpreadsheetId() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.spreadsheetId === "string" ? parsed.spreadsheetId : null;
  } catch {
    return null; // Not linked yet
  }
}

function saveActiveSpreadsheetId(spreadsheetId) {
  const payload = { spreadsheetId, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

// ---------------- Google Auth ----------------

let sheetsClient = null;

/**
 * Returns an authenticated Google Sheets client.
 * NOTE: scope is full read/write so we can update cells.
 */
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  // CHANGED: need write scope now
  const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

  let auth;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    auth = await google.auth.getClient({ scopes: SCOPES });
  } else if (process.env.GOOGLE_SA_CLIENT_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY) {
    const key = process.env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, "\n");
    auth = new google.auth.JWT({
      email: process.env.GOOGLE_SA_CLIENT_EMAIL,
      key,
      scopes: SCOPES,
    });
  } else {
    throw new Error(
      "Google credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY."
    );
  }

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// ---------------- Utilities ----------------

/** Extracts the spreadsheetId from either a raw ID or a full Google Sheets URL. */
function normalizeSpreadsheetId(input) {
  if (!input || typeof input !== "string") return null;
  if (!input.includes("http")) return input.trim();
  const match = input.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/** Fetch spreadsheet metadata (title + list of sheets) */
async function getSpreadsheetMetadata(spreadsheetId) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "spreadsheetId,properties.title,sheets(properties.title,properties.index,properties.sheetId)",
  });
  return resp.data;
}

/** Get the title of the first (leftmost) visible sheet tab */
async function getFirstSheetTitle(spreadsheetId) {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  if (!meta.sheets || meta.sheets.length === 0) {
    throw new Error("The spreadsheet has no visible sheets.");
  }
  const first = [...meta.sheets].sort(
    (a, b) => (a.properties.index ?? 0) - (b.properties.index ?? 0)
  )[0];
  return { firstTitle: first.properties.title, meta };
}

/** Convert 0-based column index to A1 notation (0 -> A, 25 -> Z, 26 -> AA ...) */
function colToA1(indexZeroBased) {
  let n = indexZeroBased + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Read all used cells from the FIRST tab (rows-major). */
async function readAllRowsFromFirstTab(spreadsheetId) {
  const sheets = await getSheetsClient();

  const { firstTitle, meta } = await getFirstSheetTitle(spreadsheetId);

  const valuesResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: firstTitle,
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  return {
    spreadsheetId: meta.spreadsheetId,
    spreadsheetTitle: meta.properties?.title,
    sheetTitle: firstTitle,
    rows: valuesResp.data.values || [],
  };
}

/**
 * Find the row index (1-based) of a device by name (case-insensitive, trimmed),
 * and the column indices (0-based) for "Device" and "Completed".
 * Returns: { sheetTitle, rowIndex1Based, completedColIndex }
 */
async function findDeviceRow(spreadsheetId, deviceName) {
  const sheets = await getSheetsClient();
  const { firstTitle } = await getFirstSheetTitle(spreadsheetId);

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: firstTitle,
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const rows = resp.data.values || [];
  if (rows.length === 0) throw new Error("Sheet is empty.");

  const header = rows[0] || [];
  const deviceColIndex = header.findIndex(
    (h) => String(h || "").trim().toLowerCase() === "device"
  );
  const completedColIndex = header.findIndex(
    (h) => String(h || "").trim().toLowerCase() === "completed"
  );

  if (deviceColIndex === -1) throw new Error('Header "Device" not found.');
  if (completedColIndex === -1) throw new Error('Header "Completed" not found.');

  const targetKey = String(deviceName || "").trim().toLowerCase();
  if (!targetKey) throw new Error("No device name provided.");

  // Search data rows (row 2 onwards). A1 row number is index+1; header is row 1.
  let rowIndex1Based = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const cell = row[deviceColIndex];
    const value = String(cell ?? "").trim().toLowerCase();
    if (value && value === targetKey) {
      rowIndex1Based = i + 1; // convert array index to 1-based row number
      break;
    }
  }

  if (rowIndex1Based === -1) {
    const err = new Error(`Device "${deviceName}" not found.`);
    err.code = "NOT_FOUND";
    throw err;
  }

  return { sheetTitle: firstTitle, rowIndex1Based, completedColIndex };
}

/** Update a single cell in the first sheet: set Completed TRUE/FALSE for a device. */
async function setCompletedForDevice(spreadsheetId, deviceName, completedBool) {
  const sheets = await getSheetsClient();
  const { sheetTitle, rowIndex1Based, completedColIndex } = await findDeviceRow(
    spreadsheetId,
    deviceName
  );

  const colA1 = colToA1(completedColIndex);
  const cellRange = `${sheetTitle}!${colA1}${rowIndex1Based}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: cellRange,
    valueInputOption: "USER_ENTERED", // let "TRUE"/"FALSE" become booleans
    requestBody: {
      values: [[completedBool ? "TRUE" : "FALSE"]],
    },
  });

  return { sheetTitle, rowIndex1Based, colA1, completed: completedBool };
}

// ---------------- Routes ----------------

/** POST /google-sheets/link */
router.post("/link", async (req, res) => {
  try {
    const rawId = (req.body && req.body.spreadsheetId) || "";
    const spreadsheetId = normalizeSpreadsheetId(rawId);

    if (!spreadsheetId) {
      return res.status(400).json({
        ok: false,
        error:
          "Provide 'spreadsheetId' as a raw ID or a full Google Sheets URL containing /spreadsheets/d/<ID>/",
      });
    }

    const meta = await getSpreadsheetMetadata(spreadsheetId);
    saveActiveSpreadsheetId(meta.spreadsheetId);

    return res.status(200).json({
      ok: true,
      spreadsheetId: meta.spreadsheetId,
      spreadsheetTitle: meta.properties?.title || null,
      message: "Spreadsheet linked successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Failed to link spreadsheet",
      details: err.message,
    });
  }
});

/** GET /google-sheets/rows */
router.get("/rows", async (_req, res) => {
  try {
    const spreadsheetId = loadActiveSpreadsheetId();
    if (!spreadsheetId) {
      return res.status(400).json({
        ok: false,
        error:
          "No spreadsheet linked. POST /google-sheets/link with { spreadsheetId } to link a file first.",
      });
    }

    const data = await readAllRowsFromFirstTab(spreadsheetId);
    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Failed to read rows",
      details: err.message,
    });
  }
});

/** PUT /google-sheets/complete  Body: { device } -> Completed = TRUE */
router.put("/complete", async (req, res) => {
  try {
    const spreadsheetId = loadActiveSpreadsheetId();
    if (!spreadsheetId) {
      return res.status(400).json({ ok: false, error: "No spreadsheet linked." });
    }

    const device = String(req.body?.device || "").trim();
    if (!device) {
      return res.status(400).json({ ok: false, error: "Body must include { device }." });
    }

    const result = await setCompletedForDevice(spreadsheetId, device, true);
    return res.status(200).json({ ok: true, message: "Marked as completed.", device, ...result });
  } catch (err) {
    const status = err.code === "NOT_FOUND" ? 404 : 500;
    return res.status(status).json({
      ok: false,
      error: "Failed to mark as completed",
      details: err.message,
    });
  }
});

/** PUT /google-sheets/uncomplete  Body: { device } -> Completed = FALSE */
router.put("/uncomplete", async (req, res) => {
  try {
    const spreadsheetId = loadActiveSpreadsheetId();
    if (!spreadsheetId) {
      return res.status(400).json({ ok: false, error: "No spreadsheet linked." });
    }

    const device = String(req.body?.device || "").trim();
    if (!device) {
      return res.status(400).json({ ok: false, error: "Body must include { device }." });
    }

    const result = await setCompletedForDevice(spreadsheetId, device, false);
    return res.status(200).json({ ok: true, message: "Marked as uncompleted.", device, ...result });
  } catch (err) {
    const status = err.code === "NOT_FOUND" ? 404 : 500;
    return res.status(status).json({
      ok: false,
      error: "Failed to mark as uncompleted",
      details: err.message,
    });
  }
});

module.exports = router;
