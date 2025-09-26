const budget = (state = [{year: 0, amount: 0}], action) => {
    switch (action.type) {
        case 'FETCH_BUDGET':
            return [...state];
        case 'FETCH_NEW_BUDGET':
            return action.payload;
        default:
            return state;
    }
}

export default budget;