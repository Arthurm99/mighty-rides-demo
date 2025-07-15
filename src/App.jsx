import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Book from './pages/Book';
import ThankYou from './pages/ThankYou';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<Book />} />
        <Route path="/thankyou" element={<ThankYou />} />
      </Routes>
    </Router>
  );
}

export default App;
