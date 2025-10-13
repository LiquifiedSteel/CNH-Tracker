// googleSheets.saga.js
import axios from "axios";
import { all, call, put, takeLatest, select, delay } from "redux-saga/effects";

export const SHEETS = {
  LINK: {
    REQUEST: "GOOGLE_SHEETS/LINK_REQUEST",
    SUCCESS: "GOOGLE_SHEETS/LINK_SUCCESS",
    FAILURE: "GOOGLE_SHEETS/LINK_FAILURE",
  },
  ROWS: {
    REQUEST: "GOOGLE_SHEETS/ROWS_REQUEST",
    SUCCESS: "GOOGLE_SHEETS/ROWS_SUCCESS",
    FAILURE: "GOOGLE_SHEETS/ROWS_FAILURE",
  },
};

// If the frontend is served by this same Express app, a relative base works.
const api = axios.create({
  baseURL: "", // leave empty if client and server share origin (your express `build` + /api)
  headers: { "Content-Type": "application/json" },
});

// Optional selector if you keep a pending spreadsheetId in state
const selectSpreadsheetId = (state) => state.sheets?.pendingSpreadsheetId || null;

function normalizeError(err) {
  const status = err?.response?.status || null;
  const data = err?.response?.data || null;
  const message =
    data?.details || data?.error || err?.message || "Unknown error contacting Google Sheets service";
  return { status, data, message };
}

// ************** API calls — note the /api/googleSheets prefix **************
function postLinkSheet(spreadsheetId) {
  return api.post("/api/googleSheets/link", { spreadsheetId });
}
function getRows() {
  return api.get("/api/googleSheets/rows");
}

// ************** Workers **************
function* linkSheetWorker(action) {
  try {
    const idFromAction = action?.payload?.spreadsheetId;
    const fallbackId = yield select(selectSpreadsheetId);
    const spreadsheetId = (idFromAction || fallbackId || "").trim();
    if (!spreadsheetId) throw new Error("No spreadsheetId provided.");

    const { data } = yield call(postLinkSheet, spreadsheetId);
    if (!data?.ok) throw new Error(data?.error || "Failed to link spreadsheet.");

    yield put({
      type: SHEETS.LINK.SUCCESS,
      payload: {
        spreadsheetId: data.spreadsheetId,
        spreadsheetTitle: data.spreadsheetTitle || null,
        message: data.message || "Spreadsheet linked.",
      },
    });

    // Auto-fetch rows after linking
    yield put({ type: SHEETS.ROWS.REQUEST });
  } catch (err) {
    yield put({ type: SHEETS.LINK.FAILURE, error: true, payload: normalizeError(err) });
  }
}

function* fetchRowsWorker() {
  try {
    const MAX_ATTEMPTS = 3;
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { data } = yield call(getRows);
        if (!data?.ok) throw new Error(data?.error || "Failed to read rows.");
        yield put({
          type: SHEETS.ROWS.SUCCESS,
          payload: {
            spreadsheetId: data.spreadsheetId,
            spreadsheetTitle: data.spreadsheetTitle || null,
            sheetTitle: data.sheetTitle || null,
            rows: Array.isArray(data.rows) ? data.rows : [],
          },
        });
        return;
      } catch (inner) {
        lastError = normalizeError(inner);
        if (lastError.status === 400) break; // not linked yet
        yield delay(250 * attempt);
      }
    }
    throw lastError || new Error("Unknown error fetching rows.");
  } catch (err) {
    yield put({ type: SHEETS.ROWS.FAILURE, error: true, payload: normalizeError(err) });
  }
}

// ************** Watchers / Root **************
function* watchLinkSheet() {
  yield takeLatest(SHEETS.LINK.REQUEST, linkSheetWorker);
}
function* watchFetchRows() {
  yield takeLatest(SHEETS.ROWS.REQUEST, fetchRowsWorker);
}
export default function* googleSheetsSaga() {
  yield all([watchLinkSheet(), watchFetchRows()]);
}