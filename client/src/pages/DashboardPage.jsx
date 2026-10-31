import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { RoleBadge } from '../components/common/Badge.jsx';
import api from '../services/api.js';
import taskService from '../services/taskService.js';
import {
  CheckCircle2,
  Clock,
  Layers,
  AlertTriangle,
  RotateCcw,
  Server,
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
} from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { socketService } = useSocket();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  });
  const [health, setHealth] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch live MongoDB statistics
  const loadStats = async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        taskService.getTaskStats(),
        api.get('/health'),
      ]);
      if (statsRes?.data) {
        setStats(statsRes.data);
      }
      if (healthRes?.data) {
        setHealth(healthRes.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Real-time metrics refresh on task lifecycle events
  useEffect(() => {
    if (!socketService) return;

    const unsubscribe = socketService.subscribeToTaskUpdates({
      onCreated: () => loadStats(),
      onUpdated: () => loadStats(),
      onStatusChanged: () => loadStats(),
      onReordered: () => loadStats(),
      onDeleted: () => loadStats(),
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [socketService]);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/20 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
                Workspace Dashboard
              </span>
              <RoleBadge role={user?.role} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {user?.name || 'User'}!
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Real-time task tracking, MongoDB-backed analytics, and multi-role access controls are operational.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/tasks"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/30 transition-all hover:translate-x-0.5"
            >
              <Layers className="w-4 h-4" />
              Open Task Board
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Task Dashboard Statistics Cards (Direct from MongoDB records) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Task Overview & Key Metrics
          </h2>
          <span className="text-xs text-slate-500">Live database counts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Total Tasks */}
          <div className="glass-card rounded-xl p-4 border border-slate-800 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Tasks</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {loadingStats ? '—' : stats.total}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">In your accessible scope</p>
          </div>

          {/* Pending Tasks */}
          <div className="glass-card rounded-xl p-4 border border-slate-800 hover:border-amber-500/20 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Pending</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 tracking-tight">
              {loadingStats ? '—' : stats.pending}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Awaiting execution</p>
          </div>

          {/* In Progress Tasks */}
          <div className="glass-card rounded-xl p-4 border border-slate-800 hover:border-sky-500/20 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">In Progress</span>
              <RotateCcw className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-sky-300 tracking-tight">
              {loadingStats ? '—' : stats.inProgress}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Active work</p>
          </div>

          {/* Completed Tasks */}
          <div className="glass-card rounded-xl p-4 border border-slate-800 hover:border-emerald-500/20 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-300 tracking-tight">
              {loadingStats ? '—' : stats.completed}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Finished deliverables</p>
          </div>

          {/* Overdue Tasks */}
          <div className="glass-card rounded-xl p-4 border border-slate-800 hover:border-rose-500/20 transition-all col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Overdue</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-300 tracking-tight">
              {loadingStats ? '—' : stats.overdue}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Passed due date</p>
          </div>
        </div>
      </div>

      {/* Role Capabilities & Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Privileges Overview */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Your Role Privileges ({user?.role})</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            {user?.role === 'admin' && (
              <>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <Zap className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <span><strong>Full System Access:</strong> View all tasks, create, edit, reorder, and delete any task across all users.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <Users className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <span><strong>User Management:</strong> Modify team roles (Admin, Manager, User) and assign tasks to users and managers.</span>
                </div>
              </>
            )}

            {user?.role === 'manager' && (
              <>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span><strong>Task Creation & Assignment:</strong> Create new project tasks and assign them to regular users.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <RotateCcw className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span><strong>Management & Reordering:</strong> Edit, reorder, and delete tasks you created, and monitor team status progression.</span>
                </div>
              </>
            )}

            {user?.role === 'user' && (
              <>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <Zap className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <span><strong>Assigned Tasks:</strong> View your assigned tasks and track execution status.</span>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <RotateCcw className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <span><strong>Status Progression:</strong> Move your assigned tasks between Pending, In Progress, and Completed.</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Database & System Diagnostic */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">System Diagnostics</h2>
              </div>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Database Engine:
                </span>
                <span className="font-semibold text-white">
                  MongoDB ({health?.database?.status || 'connected'})
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Server Environment:</span>
                <span className="font-semibold text-indigo-300 uppercase">
                  {health?.environment || 'development'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Uptime:</span>
                <span className="font-semibold text-white">{health?.uptime || 'Active'}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>TaskPulse Enterprise v1.0.0</span>
            <Link to="/tasks" className="text-indigo-400 hover:text-indigo-300 font-medium">
              View Kanban Boards &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
