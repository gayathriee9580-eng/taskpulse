import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar.jsx';

export const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-500">
        TaskPulse Enterprise Task Management System • Built with MERN Stack, Socket.IO & Tailwind CSS
      </footer>
    </div>
  );
};

export default DashboardLayout;
