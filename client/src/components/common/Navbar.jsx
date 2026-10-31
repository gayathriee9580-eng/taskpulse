import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useSocket } from '../../hooks/useSocket.js';
import { RoleBadge } from './Badge.jsx';
import { getInitials } from '../../utils/helpers.js';
import NotificationBell from './NotificationBell.jsx';
import {
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Radio,
  User as UserIcon,
  Users,
} from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="glass-header sticky top-0 z-50 px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
      {/* Brand */}
      <div className="flex items-center gap-8">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <CheckSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
              TaskPulse
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                Enterprise
              </span>
            </span>
          </div>
        </Link>

        {/* Navigation links */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            to="/dashboard"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/dashboard')
                ? 'bg-slate-800 text-white border border-slate-700/80 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            to="/tasks"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/tasks')
                ? 'bg-slate-800 text-white border border-slate-700/80 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Tasks
          </Link>
          {['admin', 'manager'].includes(user?.role) && (
            <Link
              to="/users"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive('/users')
                  ? 'bg-slate-800 text-white border border-slate-700/80 shadow-inner'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Users className="w-4 h-4" />
              Team
            </Link>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Real-time connection indicator */}
        <div
          title={isConnected ? 'Live WebSocket connected' : 'Connecting to real-time server...'}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900 border border-slate-800"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <Radio className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-300 hidden sm:inline">
            {isConnected ? 'Real-time' : 'Reconnecting'}
          </span>
        </div>

        {/* Notifications Bell */}
        {user && <NotificationBell />}

        {/* User status */}
        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
              {getInitials(user.name)}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-sm font-medium text-slate-200 leading-tight">
                {user.name}
              </span>
              <div className="mt-0.5">
                <RoleBadge role={user.role} />
              </div>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
