import axios from 'axios';
import { takeLatest, put } from 'redux-saga/effects';

function* budgetRootSaga() {
    yield takeLatest('UPDATE_BUDGET', updateBudget);
    yield takeLatest('GRAB_BUDGET', grabBudget);
}
  
function* updateBudget(action) {
    try {
        yield axios.put(`/api/budget/`, action.payload);
        yield put({type: 'GRAB_BUDGET'});
    } catch (error) {
        console.error('Budget PUT request failed', error);
    }
}

function* grabBudget() {
    try {
        const response = yield axios.get(`/api/budget/`);
        yield put({ type: 'FETCH_NEW_BUDGET', payload: response.data});
    } catch (error) {
        console.error('Budget GET request failed', error);
    }
}

export default budgetRootSaga;