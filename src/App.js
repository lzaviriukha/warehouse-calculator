// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GlobalStyle from './GlobalStyles';
import Settings from './components/Settings/Settings';
import UpdateData from './components/UpdateData/UpdateData';
import Analytics from './components/Analytics/Analytics';
import NavBar from './components/NavBar';

function App() {
  return (
    <>
      <GlobalStyle />
      <Router>
        <NavBar />
        <Routes>
          <Route path="/" element={<Settings />} />
          <Route path="/update" element={<UpdateData />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
