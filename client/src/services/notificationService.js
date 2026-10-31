import api from './api.js';

export const notificationService = {
  /**
   * Get user's notifications with pagination
   * @param {Object} params - { page, limit }
   */
  getNotifications: async (params = {}) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  /**
   * Get count of unread notifications for current user
   */
  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  /**
   * Mark a single notification as read
   * @param {string} id - Notification ID
   */
  markAsRead: async (id) => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Mark all unread notifications as read
   */
  markAllAsRead: async () => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },
};

export default notificationService;
