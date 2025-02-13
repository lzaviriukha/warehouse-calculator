import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { WarehouseProvider } from './context/WarehouseContext';

ReactDOM.render(
    <WarehouseProvider>
        <App />
    </WarehouseProvider>,
    document.getElementById('root')
);