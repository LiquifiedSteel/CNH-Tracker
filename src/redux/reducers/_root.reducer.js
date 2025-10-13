import { combineReducers } from "redux";
import errors from "./errors.reducer";
import googleSheetsReducer from "./googleSheets.reducer";

// rootReducer is the primary reducer for our entire project
// It bundles up all of the other reducers so our project can use them.
// This is imported in store.js as rootReducer

// Lets make a bigger object for our store, with the objects from our reducers.
// This is what we get when we use 'state' inside of 'mapStateToProps'
const rootReducer = combineReducers({
  errors, // contains registrationMessage and loginMessage
  sheets: googleSheetsReducer,
});

export default rootReducer;
