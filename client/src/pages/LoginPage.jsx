import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import Button from '../components/common/Button.jsx';
import { Lock, Mail, AlertCircle, ShieldAlert, UserCheck } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email || !password) {
      setFormError('Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setFormError(result.message || 'Login failed. Please check your credentials.');
    }
  };

  // Quick fill helper for testing
  const fillCredentials = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setFormError('');
  };

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Sign In</h1>
        <p className="text-sm text-slate-400 mt-1">
          Access your task boards and team workspace
        </p>
      </div>

      {formError && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@enterprise.com"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full mt-2 py-2.5 text-sm font-semibold"
        >
          Sign In
        </Button>
      </form>

      {/* Quick Role Fill Presets for Machine Test Validation */}
      <div className="mt-6 pt-5 border-t border-slate-800/80">
        <span className="block text-xs font-medium text-slate-400 mb-2.5">
          Quick Demo Roles (Click to fill credentials):
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => fillCredentials('admin@taskpulse.com', 'admin123')}
            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors text-center cursor-pointer"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('manager@taskpulse.com', 'manager123')}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors text-center cursor-pointer"
          >
            Manager
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('user@taskpulse.com', 'user123')}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors text-center cursor-pointer"
          >
            User
          </button>
        </div>
      </div>

      <div className="mt-6 text-center text-sm text-slate-400">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
        >
          Create account
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
