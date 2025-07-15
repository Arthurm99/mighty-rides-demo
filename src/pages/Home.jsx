import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 text-center p-6">
      <h1 className="text-3xl font-bold mb-4">Mighty Rides / Viajes Privados</h1>
      <p className="mb-6">Safe and private transportation in Orlando / Transporte seguro y privado en Orlando</p>
      <div className="flex justify-center gap-4">
        <Link to="/book" className="bg-blue-600 text-white px-4 py-2 rounded">📅 Book Now / Reservar</Link>
        <a href="https://wa.me/16892728874" className="bg-green-600 text-white px-4 py-2 rounded">📲 WhatsApp</a>
        <a href="https://buy.stripe.com/test_dRm3cxb6N8WudY25iPaZi00" className="bg-purple-600 text-white px-4 py-2 rounded">💳 Pay / Pagar</a>
      </div>
    </div>
  );
}