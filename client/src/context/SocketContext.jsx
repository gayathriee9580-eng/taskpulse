import React, { createContext, useEffect, useState, useCallback } from 'react';
import socketService from '../services/socketService.js';
import notificationService from '../services/notificationService.js';
import { useAuth } from '../hooks/useAuth.js';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refresh unread count from API
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationService.getUnreadCount();
      if (res?.data?.count !== undefined) {
        setUnreadCount(res.data.count);
      }
    } catch (err) {
      // Quiet fail if not yet loaded
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && token) {
      const socket = socketService.connect(token);

      const handleConnect = () => {
        setIsConnected(true);
        refreshUnreadCount();
      };

      const handleDisconnect = () => setIsConnected(false);

      const handleNotification = (data) => {
        const notif = data?.notification || data;
        setLastNotification(notif);
        setUnreadCount((prev) => prev + 1);
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('notification:new', handleNotification);
      socket.on('notification', handleNotification);

      setIsConnected(socket.connected);
      refreshUnreadCount();

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('notification:new', handleNotification);
        socket.off('notification', handleNotification);
      };
    } else {
      socketService.disconnect();
      setIsConnected(false);
      setUnreadCount(0);
      setLastNotification(null);
    }
  }, [isAuthenticated, token, refreshUnreadCount]);

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        lastNotification,
        unreadCount,
        setUnreadCount,
        refreshUnreadCount,
        socketService,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
