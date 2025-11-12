// redux/reducers/googleSheets.reducer.js

const TYPES = {
  LINK_REQUEST: "GOOGLE_SHEETS/LINK_REQUEST",
  LINK_SUCCESS: "GOOGLE_SHEETS/LINK_SUCCESS",
  LINK_FAILURE: "GOOGLE_SHEETS/LINK_FAILURE",

  ROWS_REQUEST: "GOOGLE_SHEETS/ROWS_REQUEST",
  ROWS_SUCCESS: "GOOGLE_SHEETS/ROWS_SUCCESS",
  ROWS_FAILURE: "GOOGLE_SHEETS/ROWS_FAILURE",

  COMPLETE_REQUEST: "GOOGLE_SHEETS/COMPLETE_REQUEST",
  COMPLETE_SUCCESS: "GOOGLE_SHEETS/COMPLETE_SUCCESS",
  COMPLETE_FAILURE: "GOOGLE_SHEETS/COMPLETE_FAILURE",

  INCOMPLETE_REQUEST: "GOOGLE_SHEETS/INCOMPLETE_REQUEST",
  INCOMPLETE_SUCCESS: "GOOGLE_SHEETS/INCOMPLETE_SUCCESS",
  INCOMPLETE_FAILURE: "GOOGLE_SHEETS/INCOMPLETE_FAILURE",

  COMMENT_UPDATE_REQUEST: "GOOGLE_SHEETS/COMMENT_UPDATE_REQUEST",
  COMMENT_UPDATE_SUCCESS: "GOOGLE_SHEETS/COMMENT_UPDATE_SUCCESS",
  COMMENT_UPDATE_FAILURE: "GOOGLE_SHEETS/COMMENT_UPDATE_FAILURE",

  CLEAR_ROWS: "GOOGLE_SHEETS/CLEAR_ROWS",
  RESET: "GOOGLE_SHEETS/RESET",
};

const initialState = {
  rows: [],
  spreadsheetId: null,
  spreadsheetTitle: null,
  sheetTitle: null,

  isLinking: false,
  linkError: null,

  isLoading: false,
  rowsError: null,

  updatingDevice: null,        // for complete/incomplete buttons
  toggleError: null,

  updatingCommentFor: null,    // for comment editing
  commentError: null,

  updatedAt: null,
};

export default function googleSheetsReducer(state = initialState, action) {
  switch (action.type) {
    // ----- Link flow -----
    case TYPES.LINK_REQUEST:
      return { ...state, isLinking: true, linkError: null };
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
    case TYPES.LINK_FAILURE:
      return { ...state, isLinking: false, linkError: action.payload || { message: "Failed to link spreadsheet." } };

    // ----- Rows flow -----
    case TYPES.ROWS_REQUEST:
      return { ...state, isLoading: true, rowsError: null };
    case TYPES.ROWS_SUCCESS: {
      const { spreadsheetId, spreadsheetTitle, sheetTitle, rows = [] } = action.payload || {};
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
    case TYPES.ROWS_FAILURE:
      return { ...state, isLoading: false, rowsError: action.payload || { message: "Failed to fetch rows." } };

    // ----- COMPLETE (optimistic true) -----
    case TYPES.COMPLETE_REQUEST: {
      const device = String(action?.payload?.device || "").trim();
      if (!device || !Array.isArray(state.rows) || state.rows.length === 0) {
        return { ...state, updatingDevice: device || null, toggleError: null };
      }
      const header = state.rows[0] || [];
      const deviceIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "device");
      const completedIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "completed");
      if (deviceIdx === -1 || completedIdx === -1) {
        return { ...state, updatingDevice: device, toggleError: null };
      }
      const newRows = state.rows.map((row, ri) => {
        if (ri === 0) return row;
        const matches =
          String(row?.[deviceIdx] ?? "").trim().toLowerCase() === device.toLowerCase();
        if (!matches) return row;
        const next = row.slice();
        next[completedIdx] = true;
        return next;
      });
      return { ...state, updatingDevice: device, toggleError: null, rows: newRows };
    }
    case TYPES.COMPLETE_SUCCESS:
      return { ...state, updatingDevice: null, toggleError: null };
    case TYPES.COMPLETE_FAILURE:
      return { ...state, updatingDevice: null, toggleError: action.payload || { message: "Failed to mark complete." } };

    // ----- INCOMPLETE (optimistic false) -----
    case TYPES.INCOMPLETE_REQUEST: {
      const device = String(action?.payload?.device || "").trim();
      if (!device || !Array.isArray(state.rows) || state.rows.length === 0) {
        return { ...state, updatingDevice: device || null, toggleError: null };
      }
      const header = state.rows[0] || [];
      const deviceIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "device");
      const completedIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "completed");
      if (deviceIdx === -1 || completedIdx === -1) {
        return { ...state, updatingDevice: device, toggleError: null };
      }
      const newRows = state.rows.map((row, ri) => {
        if (ri === 0) return row;
        const matches =
          String(row?.[deviceIdx] ?? "").trim().toLowerCase() === device.toLowerCase();
        if (!matches) return row;
        const next = row.slice();
        next[completedIdx] = false;
        return next;
      });
      return { ...state, updatingDevice: device, toggleError: null, rows: newRows };
    }
    case TYPES.INCOMPLETE_SUCCESS:
      return { ...state, updatingDevice: null, toggleError: null };
    case TYPES.INCOMPLETE_FAILURE:
      return { ...state, updatingDevice: null, toggleError: action.payload || { message: "Failed to mark incomplete." } };

    // ----- COMMENT UPDATE (optimistic) -----
    case TYPES.COMMENT_UPDATE_REQUEST: {
      const device  = String(action?.payload?.device || "").trim();
      const comment = String(action?.payload?.comment ?? "");
      if (!device || !Array.isArray(state.rows) || state.rows.length === 0) {
        return { ...state, updatingCommentFor: device || null, commentError: null };
      }
      const header = state.rows[0] || [];
      const deviceIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "device");
      const commentIdx = header.findIndex((h) => String(h || "").trim().toLowerCase() === "comment");
      if (deviceIdx === -1 || commentIdx === -1) {
        return { ...state, updatingCommentFor: device, commentError: null };
      }
      const newRows = state.rows.map((row, ri) => {
        if (ri === 0) return row;
        const matches =
          String(row?.[deviceIdx] ?? "").trim().toLowerCase() === device.toLowerCase();
        if (!matches) return row;
        const next = row.slice();
        next[commentIdx] = comment;
        return next;
      });
      return { ...state, updatingCommentFor: device, commentError: null, rows: newRows };
    }
    case TYPES.COMMENT_UPDATE_SUCCESS:
      return { ...state, updatingCommentFor: null, commentError: null };
    case TYPES.COMMENT_UPDATE_FAILURE:
      return { ...state, updatingCommentFor: null, commentError: action.payload || { message: "Failed to update comment." } };

    // ----- Utilities -----
    case TYPES.CLEAR_ROWS:
      return { ...state, rows: [], updatedAt: null };
    case TYPES.RESET:
      return initialState;

    default:
      return state;
  }
}

/* Selectors */
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

  updatingDevice: state.sheets?.updatingDevice || null,
  toggleError: state.sheets?.toggleError || null,

  updatingCommentFor: state.sheets?.updatingCommentFor || null,
  commentError: state.sheets?.commentError || null,

  updatedAt: state.sheets?.updatedAt || null,
});