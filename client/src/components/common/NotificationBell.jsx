import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket.js';
import notificationService from '../../services/notificationService.js';
import { formatRelativeTime } from '../../utils/helpers.js';
import {
  Bell,
  CheckCheck,
  Check,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  UserCheck,
  Layers,
  X,
} from 'lucide-react';

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { lastNotification, unreadCount, setUnreadCount, refreshUnreadCount } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications when opened
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationService.getNotifications({ limit: 15 });
      setNotifications(res?.data?.notifications || []);
      if (res?.data?.unreadCount !== undefined) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  // Handle incoming live socket notification
  useEffect(() => {
    if (lastNotification) {
      setNotifications((prev) => [lastNotification, ...prev]);
      setToastNotification(lastNotification);
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastNotification]);

  // Mark single notification as read
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Handle clicking notification item
  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif._id);
    }
    setIsOpen(false);
    if (notif.task) {
      navigate('/tasks');
    }
  };

  // Get icon and styling by notification type
  const getTypeMeta = (type) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return {
          icon: UserCheck,
          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        };
      case 'TASK_STATUS_CHANGED':
        return {
          icon: RotateCcw,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        };
      case 'TASK_COMPLETED':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        };
      case 'TASK_UPDATED':
      case 'TASK_REORDERED':
        return {
          icon: Sparkles,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        };
      default:
        return {
          icon: Layers,
          color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
        };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={toggleDropdown}
        title="Notifications"
        className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List Area */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400 px-4">
                <div className="w-10 h-10 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-2 text-slate-500">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-slate-300">You're all caught up!</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Task updates and assignments will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const meta = getTypeMeta(notif.type);
                const IconComponent = meta.icon;
                return (
                  <div
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 flex gap-3 transition-colors cursor-pointer group ${
                      !notif.isRead
                        ? 'bg-indigo-950/20 hover:bg-indigo-950/30'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Type Icon */}
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.color}`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4
                          className={`text-xs font-semibold truncate ${
                            !notif.isRead ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span
                            className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1"
                            title="Unread"
                          />
                        )}
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/40 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(notif.createdAt)}
                        </span>

                        {!notif.isRead && (
                          <button
                            onClick={(e) => handleMarkAsRead(notif._id, e)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/40 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/tasks');
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium py-1 w-full text-center cursor-pointer"
            >
              View All Tasks & Workspace Activity
            </button>
          </div>
        </div>
      )}

      {/* Real-time Toast Banner for incoming notifications */}
      {toastNotification && !isOpen && (
        <div className="fixed bottom-6 right-6 max-w-sm w-full z-50 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 p-4 shadow-2xl shadow-indigo-500/10 flex items-start gap-3 animate-slideUp">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Bell className="w-4 h-4 animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
                New Notification
              </span>
              <button
                onClick={() => setToastNotification(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <h5 className="text-xs font-bold text-white mt-0.5 truncate">
              {toastNotification.title}
            </h5>
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
              {toastNotification.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
