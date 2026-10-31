import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import api from '../services/api.js';
import { RoleBadge } from '../components/common/Badge.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import { getInitials, formatDate } from '../utils/helpers.js';
import { Users, Shield, UserCheck, CheckCircle, AlertCircle } from 'lucide-react';

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    setNotification(null);
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
      setNotification({ type: 'success', message: 'User role updated successfully!' });
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to update user role',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Team Directory & Access Control
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isAdmin
              ? 'Manage user accounts and configure role permissions across the system.'
              : 'View team members and their designated workspace roles.'}
          </p>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-xl text-sm flex items-center gap-2.5 ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner size="lg" className="py-16" />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Joined</th>
                  {isAdmin && <th className="px-6 py-4 text-right">Role Management</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {users.map((member) => (
                  <tr key={member._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white">
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <div className="font-medium text-white flex items-center gap-2">
                            {member.name}
                            {member._id === currentUser?._id && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={member.role} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {formatDate(member.createdAt)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        {member._id === currentUser?._id ? (
                          <span className="text-xs text-slate-500 italic">Self (Admin)</span>
                        ) : (
                          <select
                            value={member.role}
                            disabled={updatingId === member._id}
                            onChange={(e) => handleRoleChange(member._id, e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
                          >
                            <option value="user">User</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
