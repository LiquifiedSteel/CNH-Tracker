// googleSheets.reducer.js
// If you exported SHEETS from your saga file, import it. Otherwise, keep the string types inline.
// import { SHEETS } from "../sagas/googleSheets.saga";

const TYPES = {
  LINK_REQUEST: "GOOGLE_SHEETS/LINK_REQUEST",
  LINK_SUCCESS: "GOOGLE_SHEETS/LINK_SUCCESS",
  LINK_FAILURE: "GOOGLE_SHEETS/LINK_FAILURE",
  ROWS_REQUEST: "GOOGLE_SHEETS/ROWS_REQUEST",
  ROWS_SUCCESS: "GOOGLE_SHEETS/ROWS_SUCCESS",
  ROWS_FAILURE: "GOOGLE_SHEETS/ROWS_FAILURE",

  // NEW: optimistic toggle actions
  COMPLETE_REQUEST: "GOOGLE_SHEETS/COMPLETE_REQUEST",
  COMPLETE_SUCCESS: "GOOGLE_SHEETS/COMPLETE_SUCCESS",
  COMPLETE_FAILURE: "GOOGLE_SHEETS/COMPLETE_FAILURE",
  UNCOMPLETE_REQUEST: "GOOGLE_SHEETS/UNCOMPLETE_REQUEST",
  UNCOMPLETE_SUCCESS: "GOOGLE_SHEETS/UNCOMPLETE_SUCCESS",
  UNCOMPLETE_FAILURE: "GOOGLE_SHEETS/UNCOMPLETE_FAILURE",

  // optional utility actions you might dispatch from UI
  CLEAR_ROWS: "GOOGLE_SHEETS/CLEAR_ROWS",
  RESET: "GOOGLE_SHEETS/RESET",
};

/**
 * State shape
 * rows: Array<Array<any>> — each entry is a sheet row (values from A..).
 * spreadsheetId/Title, sheetTitle: metadata from the backend.
 * isLinking/isLoading: request flags; linkError/rowsError: normalized errors.
 */
const initialState = {
  rows: [],
  spreadsheetId: null,
  spreadsheetTitle: null,
  sheetTitle: null,

  isLinking: false,
  linkError: null,

  isLoading: false,
  rowsError: null,

  updatedAt: null, // ISO string for last successful rows fetch

  // NEW: optimistic update helpers
  updatingDevice: null,
  updateError: null,
};

// --- helpers ---
const idxOfHeader = (header, name) =>
  Array.isArray(header)
    ? header.findIndex((h) => String(h ?? "").trim().toLowerCase() === String(name).toLowerCase())
    : -1;

const ciEq = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

/**
 * Returns a new rows array with the "Completed" cell for the matching device
 * set to the provided boolean value. If headers/row not found, returns original rows.
 * rows format is [headerRow, ...dataRows]
 */
function mutateCompleted(rows, device, value) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const [header, ...data] = rows;

  const deviceIdx = idxOfHeader(header, "device");
  const completedIdx = idxOfHeader(header, "completed");
  if (deviceIdx === -1 || completedIdx === -1) return rows;

  let changed = false;
  const nextData = data.map((r) => {
    const row = Array.isArray(r) ? r : [];
    if (ciEq(row[deviceIdx], device)) {
      const clone = [...row];
      clone[completedIdx] = value; // TRUE/FALSE (boolean)
      changed = true;
      return clone;
    }
    return r;
  });

  return changed ? [header, ...nextData] : rows;
}

export default function googleSheetsReducer(state = initialState, action) {
  switch (action.type) {
    // ----- Link flow -----
    case TYPES.LINK_REQUEST: {
      return {
        ...state,
        isLinking: true,
        linkError: null,
      };
    }
    case TYPES.LINK_SUCCESS: {
      const { spreadsheetId, spreadsheetTitle } = action.payload || {};
      return {
        ...state,
        isLinking: false,
        linkError: null,
        spreadsheetId: spreadsheetId ?? state.spreadsheetId,
        spreadsheetTitle: spreadsheetTitle ?? state.spreadsheetTitle,
      };
    }
    case TYPES.LINK_FAILURE: {
      return {
        ...state,
        isLinking: false,
        linkError: action.payload || { message: "Failed to link spreadsheet." },
      };
    }

    // ----- Rows flow -----
    case TYPES.ROWS_REQUEST: {
      return {
        ...state,
        isLoading: true,
        rowsError: null,
      };
    }
    case TYPES.ROWS_SUCCESS: {
      const {
        spreadsheetId,
        spreadsheetTitle,
        sheetTitle,
        rows = [],
      } = action.payload || {};
      return {
        ...state,
        isLoading: false,
        rowsError: null,
        spreadsheetId: spreadsheetId ?? state.spreadsheetId,
        spreadsheetTitle: spreadsheetTitle ?? state.spreadsheetTitle,
        sheetTitle: sheetTitle ?? state.sheetTitle,
        rows: Array.isArray(rows) ? rows : [],
        updatedAt: new Date().toISOString(),
      };
    }
    case TYPES.ROWS_FAILURE: {
      return {
        ...state,
        isLoading: false,
        rowsError: action.payload || { message: "Failed to fetch rows." },
      };
    }

    // ----- Optimistic Completed toggle -----
    case TYPES.COMPLETE_REQUEST: {
      const device = action.payload?.device;
      return {
        ...state,
        rows: mutateCompleted(state.rows, device, true),
        updatingDevice: device || null,
        updateError: null,
      };
    }
    case TYPES.UNCOMPLETE_REQUEST: {
      const device = action.payload?.device;
      return {
        ...state,
        rows: mutateCompleted(state.rows, device, false),
        updatingDevice: device || null,
        updateError: null,
      };
    }

    case TYPES.COMPLETE_SUCCESS:
    case TYPES.UNCOMPLETE_SUCCESS: {
      // Saga will re-fetch rows after success; we just clear flags.
      return {
        ...state,
        updatingDevice: null,
        updateError: null,
      };
    }

    case TYPES.COMPLETE_FAILURE:
    case TYPES.UNCOMPLETE_FAILURE: {
      // We performed an optimistic change; the saga will trigger a fresh read
      // to realign on truth. Record the error & clear the flag.
      return {
        ...state,
        updatingDevice: null,
        updateError: action.payload || { message: "Update failed." },
      };
    }

    // ----- Optional utilities -----
    case TYPES.CLEAR_ROWS: {
      return { ...state, rows: [], updatedAt: null };
    }
    case TYPES.RESET: {
      return initialState;
    }

    default:
      return state;
  }
}

/* ----------------- Optional selectors ----------------- */
export const selectSheetRows = (state) => state.sheets?.rows || [];
export const selectSheetMeta = (state) => ({
  spreadsheetId: state.sheets?.spreadsheetId || null,
  spreadsheetTitle: state.sheets?.spreadsheetTitle || null,
  sheetTitle: state.sheets?.sheetTitle || null,
});
export const selectSheetStatus = (state) => ({
  isLinking: !!state.sheets?.isLinking,
  isLoading: !!state.sheets?.isLoading,
  linkError: state.sheets?.linkError || null,
  rowsError: state.sheets?.rowsError || null,
  updatedAt: state.sheets?.updatedAt || null,
  updatingDevice: state.sheets?.updatingDevice || null,
  updateError: state.sheets?.updateError || null,
});