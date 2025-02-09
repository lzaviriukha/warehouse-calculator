import React, { createContext, useReducer } from 'react';

const initialState = { items: [] };
const WarehouseContext = createContext(initialState);

const warehouseReducer = (state, action) => {
    switch (action.type) {
        case 'ADD_ITEM':
            return { ...state, items: [...state.items, action.payload] };
        // Добавьте другие действия по необходимости
        default:
            return state;
    }
};

export const WarehouseProvider = ({ children }) => {
    const [state, dispatch] = useReducer(warehouseReducer, initialState);

    return (
        <WarehouseContext.Provider value={{ state, dispatch }}>
            {children}
        </WarehouseContext.Provider>
    );
};

export default WarehouseContext;