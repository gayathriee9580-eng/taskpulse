import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button.jsx';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
        <HelpCircle className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">404</h1>
      <h2 className="text-xl font-semibold text-slate-300 mb-4">Page Not Found</h2>
      <p className="text-sm text-slate-500 max-w-sm mb-8">
        The workspace path or resource you requested does not exist or has been moved.
      </p>
      <Link to="/dashboard">
        <Button className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
