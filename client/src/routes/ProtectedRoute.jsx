import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';

export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-slate-400 mt-4 animate-pulse">
          Authenticating secure session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <div className="p-6 rounded-2xl glass-card border border-rose-500/20 text-rose-300">
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-sm text-slate-300">
            Your role (<span className="font-semibold capitalize">{user?.role}</span>) does not
            have permission to access this area.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
