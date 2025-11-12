// server/routes/googlesheets.router.js
/**
 * Google Sheets Router (Express)
 * Endpoints:
 *   POST /google-sheets/link           -> link a sheet for future reads/writes
 *   GET  /google-sheets/rows           -> read all rows from FIRST tab
 *   PUT  /google-sheets/complete       -> set Completed=true for a Device
 *   PUT  /google-sheets/incomplete     -> set Completed=false for a Device
 *   PUT  /google-sheets/comment        -> update Comment for a Device
 *
 * Auth:
 *   Service Account with Sheets API. Share the spreadsheet with the SA email.
 *
 * Env:
 *   ACTIVE_SHEET_STORE               optional path to persist active sheet id
 *   GOOGLE_APPLICATION_CREDENTIALS   absolute path to SA JSON key
 *      OR
 *   GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY
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

/** Authenticated Google Sheets client (READ/WRITE scope) */
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  // WRITE scope so we can update cells
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

function normalizeSpreadsheetId(input) {
  if (!input || typeof input !== "string") return null;
  if (!input.includes("http")) return input.trim();
  const match = input.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function getSpreadsheetMetadata(spreadsheetId) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "spreadsheetId,properties.title,sheets(properties.title,properties.index,properties.sheetId)",
  });
  return resp.data;
}

async function readAllRowsFromFirstTab(spreadsheetId) {
  const sheets = await getSheetsClient();
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  if (!meta.sheets || meta.sheets.length === 0) {
    throw new Error("The spreadsheet has no visible sheets.");
  }
  const first = [...meta.sheets].sort(
    (a, b) => (a.properties.index ?? 0) - (b.properties.index ?? 0)
  )[0];
  const firstTitle = first.properties.title;

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

// A1 helpers
function columnIndexToA1(colIdxZeroBased) {
  let idx = colIdxZeroBased + 1; // 1-based
  let s = "";
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    idx = Math.floor((idx - 1) / 26);
  }
  return s;
}

async function getFirstTabHeader(spreadsheetId) {
  const { sheetTitle, rows } = await readAllRowsFromFirstTab(spreadsheetId);
  if (!rows || rows.length === 0) {
    throw new Error("Spreadsheet has no data.");
  }
  const header = rows[0];
  return { tabName: sheetTitle, header, rows };
}

/** Find the 1-based row number (including header) where header[colName] === value (ci). */
function findRowByHeaderValue(rows, header, colName, needle) {
  const colIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === String(colName).trim().toLowerCase());
  if (colIdx === -1) return { rowIndex1: -1, colIndex0: -1 };
  const target = String(needle ?? "").trim().toLowerCase();
  for (let r = 1; r < rows.length; r++) { // skip header at r=0
    const cell = rows[r]?.[colIdx];
    if (String(cell ?? "").trim().toLowerCase() === target) {
      return { rowIndex1: r + 1, colIndex0: colIdx }; // A1 row is 1-based
    }
  }
  return { rowIndex1: -1, colIndex0: colIdx };
}

// ---------------- Routes ----------------

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

/**
 * PUT /google-sheets/complete
 * Body: { device: string }
 * Sets the "Completed" cell to TRUE for the row whose "Device" matches.
 */
router.put("/complete", async (req, res) => {
  try {
    const spreadsheetId = loadActiveSpreadsheetId();
    if (!spreadsheetId) return res.status(400).json({ ok: false, error: "No spreadsheet linked." });

    const device = String(req.body?.device || "").trim();
    if (!device) return res.status(400).json({ ok: false, error: "Device is required." });

    const sheets = await getSheetsClient();
    const { tabName, header, rows } = await getFirstTabHeader(spreadsheetId);

    const completedIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "completed");
    if (completedIdx === -1) throw new Error("Header 'Completed' not found.");

    const { rowIndex1 } = findRowByHeaderValue(rows, header, "Device", device);
    if (rowIndex1 === -1) return res.status(404).json({ ok: false, error: `Device '${device}' not found.` });

    const colA1 = columnIndexToA1(completedIdx);
    const range = `${tabName}!${colA1}${rowIndex1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["TRUE"]] },
    });

    return res.status(200).json({ ok: true, device, completed: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to mark complete", details: err.message });
  }
});

/**
 * PUT /google-sheets/incomplete
 * Body: { device: string }
 * Sets the "Completed" cell to FALSE for the row whose "Device" matches.
 */
router.put("/incomplete", async (req, res) => {
  try {
    const spreadsheetId = loadActiveSpreadsheetId();
    if (!spreadsheetId) return res.status(400).json({ ok: false, error: "No spreadsheet linked." });

    const device = String(req.body?.device || "").trim();
    if (!device) return res.status(400).json({ ok: false, error: "Device is required." });

    const sheets = await getSheetsClient();
    const { tabName, header, rows } = await getFirstTabHeader(spreadsheetId);

    const completedIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "completed");
    if (completedIdx === -1) throw new Error("Header 'Completed' not found.");

    const { rowIndex1 } = findRowByHeaderValue(rows, header, "Device", device);
    if (rowIndex1 === -1) return res.status(404).json({ ok: false, error: `Device '${device}' not found.` });

    const colA1 = columnIndexToA1(completedIdx);
    const range = `${tabName}!${colA1}${rowIndex1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["FALSE"]] },
    });

    return res.status(200).json({ ok: true, device, completed: false });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to mark incomplete", details: err.message });
  }
});

/**
 * PUT /google-sheets/comment
 * Body: { device: string, comment: string }
 * Updates the "Comment" cell for the row whose "Device" matches.
 */
router.put("/comment", async (req, res) => {
  try {
    const spreadsheetId = loadActiveSpreadsheetId();
    if (!spreadsheetId) return res.status(400).json({ ok: false, error: "No spreadsheet linked." });

    const device = String(req.body?.device ?? "").trim();
    const comment = String(req.body?.comment ?? "");

    if (!device) return res.status(400).json({ ok: false, error: "Device is required." });

    const sheets = await getSheetsClient();
    const { tabName, header, rows } = await getFirstTabHeader(spreadsheetId);

    const commentIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "comment");
    if (commentIdx === -1) throw new Error("Header 'Comment' not found.");

    const { rowIndex1 } = findRowByHeaderValue(rows, header, "Device", device);
    if (rowIndex1 === -1) return res.status(404).json({ ok: false, error: `Device '${device}' not found.` });

    const colA1 = columnIndexToA1(commentIdx);
    const range = `${tabName}!${colA1}${rowIndex1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[comment]] },
    });

    return res.status(200).json({ ok: true, device, comment });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to update comment", details: err.message });
  }
});

module.exports = router;