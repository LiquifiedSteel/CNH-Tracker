/**
 * Google Sheets Router (Express) — Link a spreadsheet file and read all rows
 * -------------------------------------------------------------------------
 * Endpoints
 *   POST /google-sheets/link
 *     Body: { "spreadsheetId": "<id or full URL>" }
 *     Links the server to a specific Google Sheet file. Validates access and
 *     persists the active spreadsheet ID to disk for reuse across restarts.
 *
 *   GET  /google-sheets/rows
 *     Returns every used row from the FIRST sheet tab of the currently linked
 *     spreadsheet (majorDimension=ROWS). Designed to be simple and predictable.
 *
 * Authentication
 *   Uses a Google Service Account with the Google Sheets API enabled.
 *   Share the sheet with the service account email as an Editor or Viewer.
 *
 * Environment Variables
 *   ACTIVE_SHEET_STORE               Optional JSON file path to persist link (default: ./activeSheet.json)
 *   GOOGLE_APPLICATION_CREDENTIALS   Absolute path to service account JSON key file
 *     OR
 *   GOOGLE_SA_CLIENT_EMAIL           Service account email
 *   GOOGLE_SA_PRIVATE_KEY            Service account private key (supports literal \n)
 *
 * Notes
 *   - The read endpoint always targets the FIRST tab in the linked spreadsheet.
 *   - If you need a specific tab later, extend read logic to accept a query param.
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
 * Scope includes read to allow metadata + values and future writes if needed.
 */
async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

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

/**
 * Extracts the spreadsheetId from either a raw ID or a full Google Sheets URL.
 */
function normalizeSpreadsheetId(input) {
  if (!input || typeof input !== "string") return null;

  // If it's already an ID, just return it (IDs are typically long, URL-safe strings without slashes).
  if (!input.includes("http")) return input.trim();

  // If it's a full URL, pull the /spreadsheets/d/<ID>/ segment.
  const match = input.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Returns metadata for the spreadsheet (title + list of sheets).
 * Used to validate that the link works and to discover the first tab name.
 */
async function getSpreadsheetMetadata(spreadsheetId) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "spreadsheetId,properties.title,sheets(properties.title,properties.index,properties.sheetId)",
  });
  return resp.data;
}

/**
 * Reads all used cells from the FIRST tab in the spreadsheet.
 */
async function readAllRowsFromFirstTab(spreadsheetId) {
  const sheets = await getSheetsClient();

  // Discover the first tab title
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  if (!meta.sheets || meta.sheets.length === 0) {
    throw new Error("The spreadsheet has no visible sheets.");
  }
  // Sort by index and use the first tab
  const first = [...meta.sheets].sort(
    (a, b) => (a.properties.index ?? 0) - (b.properties.index ?? 0)
  )[0];
  const firstTitle = first.properties.title;

  // Request all used cells by passing just the tab title as the range
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

// ---------------- Routes ----------------

/**
 * POST /google-sheets/link
 * Links the server to a specific Google Sheets file for future reads.
 * Body: { "spreadsheetId": "<id or full URL>" }
 */
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

    // Validate access and existence by fetching minimal metadata
    const meta = await getSpreadsheetMetadata(spreadsheetId);

    // Persist link
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

/**
 * GET /google-sheets/rows
 * Returns every used row from the FIRST tab of the currently linked spreadsheet.
 */
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

module.exports = router;
