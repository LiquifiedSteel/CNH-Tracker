// redux/sagas/googleSheets.saga.js
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
  COMPLETE: {
    REQUEST: "GOOGLE_SHEETS/COMPLETE_REQUEST",
    SUCCESS: "GOOGLE_SHEETS/COMPLETE_SUCCESS",
    FAILURE: "GOOGLE_SHEETS/COMPLETE_FAILURE",
  },
  INCOMPLETE: {
    REQUEST: "GOOGLE_SHEETS/INCOMPLETE_REQUEST",
    SUCCESS: "GOOGLE_SHEETS/INCOMPLETE_SUCCESS",
    FAILURE: "GOOGLE_SHEETS/INCOMPLETE_FAILURE",
  },
  COMMENT_UPDATE: {
    REQUEST: "GOOGLE_SHEETS/COMMENT_UPDATE_REQUEST",
    SUCCESS: "GOOGLE_SHEETS/COMMENT_UPDATE_SUCCESS",
    FAILURE: "GOOGLE_SHEETS/COMMENT_UPDATE_FAILURE",
  },
};

const api = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

const selectSpreadsheetId = (state) => state.sheets?.pendingSpreadsheetId || null;

function normalizeError(err) {
  const status = err?.response?.status || null;
  const data = err?.response?.data || null;
  const message =
    data?.details || data?.error || err?.message || "Unknown error contacting Google Sheets service";
  return { status, data, message };
}

// --- API calls ---
function postLinkSheet(spreadsheetId) {
  return api.post("/api/googleSheets/link", { spreadsheetId });
}
function getRows() {
  return api.get("/api/googleSheets/rows");
}
function putComplete(device) {
  return api.put("/api/googleSheets/complete", { device });
}
function putIncomplete(device) {
  return api.put("/api/googleSheets/incomplete", { device });
}
function putUpdateComment(device, comment) {
  return api.put("/api/googleSheets/comment", { device, comment });
}

// --- Workers ---
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
        if (lastError.status === 400) break;
        yield delay(250 * attempt);
      }
    }
    throw lastError || new Error("Unknown error fetching rows.");
  } catch (err) {
    yield put({ type: SHEETS.ROWS.FAILURE, error: true, payload: normalizeError(err) });
  }
}

function* completeWorker(action) {
  try {
    const device = String(action?.payload?.device || "").trim();
    if (!device) throw new Error("Device is required.");
    const { data } = yield call(putComplete, device);
    if (!data?.ok) throw new Error(data?.error || "Failed to mark complete.");
    yield put({ type: SHEETS.COMPLETE.SUCCESS, payload: { device } });
  } catch (err) {
    yield put({ type: SHEETS.COMPLETE.FAILURE, error: true, payload: normalizeError(err), meta: { device: action?.payload?.device || null } });
    yield put({ type: SHEETS.ROWS.REQUEST });
  }
}

function* incompleteWorker(action) {
  try {
    const device = String(action?.payload?.device || "").trim();
    if (!device) throw new Error("Device is required.");
    const { data } = yield call(putIncomplete, device);
    if (!data?.ok) throw new Error(data?.error || "Failed to mark incomplete.");
    yield put({ type: SHEETS.INCOMPLETE.SUCCESS, payload: { device } });
  } catch (err) {
    yield put({ type: SHEETS.INCOMPLETE.FAILURE, error: true, payload: normalizeError(err), meta: { device: action?.payload?.device || null } });
    yield put({ type: SHEETS.ROWS.REQUEST });
  }
}

function* updateCommentWorker(action) {
  try {
    const device  = String(action?.payload?.device || "").trim();
    const comment = String(action?.payload?.comment ?? "");
    if (!device) throw new Error("Device is required.");

    const { data } = yield call(putUpdateComment, device, comment);
    if (!data?.ok) throw new Error(data?.error || "Failed to update comment.");

    yield put({ type: SHEETS.COMMENT_UPDATE.SUCCESS, payload: { device, comment } });
  } catch (err) {
    yield put({ type: SHEETS.COMMENT_UPDATE.FAILURE, error: true, payload: normalizeError(err), meta: { device: action?.payload?.device || null } });
    yield put({ type: SHEETS.ROWS.REQUEST });
  }
}

// --- Watchers / Root ---
function* watchLinkSheet()     { yield takeLatest(SHEETS.LINK.REQUEST,       linkSheetWorker); }
function* watchFetchRows()     { yield takeLatest(SHEETS.ROWS.REQUEST,       fetchRowsWorker); }
function* watchComplete()      { yield takeLatest(SHEETS.COMPLETE.REQUEST,    completeWorker); }
function* watchIncomplete()    { yield takeLatest(SHEETS.INCOMPLETE.REQUEST,  incompleteWorker); }
function* watchUpdateComment() { yield takeLatest(SHEETS.COMMENT_UPDATE.REQUEST, updateCommentWorker); }

export default function* googleSheetsSaga() {
  yield all([
    watchLinkSheet(),
    watchFetchRows(),
    watchComplete(),
    watchIncomplete(),
    watchUpdateComment(),
  ]);
}