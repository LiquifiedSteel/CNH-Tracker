// If you exported SHEETS from your saga file, import it. Otherwise, keep the string types inline.
// import { SHEETS } from "../sagas/googleSheets.saga";

const TYPES = {
  LINK_REQUEST: "GOOGLE_SHEETS/LINK_REQUEST",
  LINK_SUCCESS: "GOOGLE_SHEETS/LINK_SUCCESS",
  LINK_FAILURE: "GOOGLE_SHEETS/LINK_FAILURE",
  ROWS_REQUEST: "GOOGLE_SHEETS/ROWS_REQUEST",
  ROWS_SUCCESS: "GOOGLE_SHEETS/ROWS_SUCCESS",
  ROWS_FAILURE: "GOOGLE_SHEETS/ROWS_FAILURE",

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
};

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
});