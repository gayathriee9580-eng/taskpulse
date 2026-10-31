import { io } from 'socket.io-client';

/**
 * Resilient Socket.IO URL resolution:
 * 1. Uses VITE_SOCKET_URL if provided
 * 2. Derives host origin from VITE_API_URL (e.g. https://taskpulse.onrender.com)
 * 3. Falls back to localhost in dev environment
 */
const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    const socketUrl = getSocketUrl();
    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('⚡ Socket connected successfully:', this.socket.id);
    });

    this.socket.on('connect_error', (error) => {
      console.warn('⚠️ Socket connection error:', error.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Subscribe to task lifecycle real-time events
   */
  subscribeToTaskUpdates(callbacks = {}) {
    if (!this.socket) return () => {};

    if (callbacks.onCreated) this.socket.on('task:created', callbacks.onCreated);
    if (callbacks.onUpdated) this.socket.on('task:updated', callbacks.onUpdated);
    if (callbacks.onStatusChanged) {
      this.socket.on('task:statusChanged', callbacks.onStatusChanged);
      this.socket.on('task:status_changed', callbacks.onStatusChanged);
    }
    if (callbacks.onReordered) this.socket.on('task:reordered', callbacks.onReordered);
    if (callbacks.onDeleted) this.socket.on('task:deleted', callbacks.onDeleted);
    if (callbacks.onNotification) {
      this.socket.on('notification:new', callbacks.onNotification);
      this.socket.on('notification', callbacks.onNotification);
    }

    return () => {
      if (!this.socket) return;
      if (callbacks.onCreated) this.socket.off('task:created', callbacks.onCreated);
      if (callbacks.onUpdated) this.socket.off('task:updated', callbacks.onUpdated);
      if (callbacks.onStatusChanged) {
        this.socket.off('task:statusChanged', callbacks.onStatusChanged);
        this.socket.off('task:status_changed', callbacks.onStatusChanged);
      }
      if (callbacks.onReordered) this.socket.off('task:reordered', callbacks.onReordered);
      if (callbacks.onDeleted) this.socket.off('task:deleted', callbacks.onDeleted);
      if (callbacks.onNotification) {
        this.socket.off('notification:new', callbacks.onNotification);
        this.socket.off('notification', callbacks.onNotification);
      }
    };
  }
}

export const socketService = new SocketService();
export default socketService;
