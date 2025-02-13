import React, { Suspense, lazy } from 'react';

const Calculator = lazy(() => import('./Calculator'));

function App() {
    return (
        <Suspense fallback={<div>Загрузка...</div>}>
            <Calculator />
        </Suspense>
    );
}

export default App;