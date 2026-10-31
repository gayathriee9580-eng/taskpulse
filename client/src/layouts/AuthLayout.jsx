import React from 'react';
import { Outlet, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { CheckSquare } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

export const AuthLayout = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-slate-400 mt-4 animate-pulse">
          Loading authentication...
        </p>
      </div>
    );
  }

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[350px] h-[350px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand logo header */}
      <div className="mb-8 flex flex-col items-center relative z-10">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <CheckSquare className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-white">
            TaskPulse
          </span>
        </Link>
        <p className="text-sm text-slate-400 mt-2 font-medium">
          Enterprise Multi-Role Task Management System
        </p>
      </div>

      {/* Card container */}
      <div className="w-full max-w-md relative z-10">
        <Outlet />
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-slate-600 relative z-10">
        Phase 2 • Complete Authentication & Role-Based Authorization
      </div>
    </div>
  );
};

export default AuthLayout;
