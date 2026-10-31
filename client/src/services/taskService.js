import api from './api.js';

export const taskService = {
  /**
   * Fetch all tasks with optional filters, pagination, and sorting
   */
  getTasks: async (params = {}) => {
    return api.get('/tasks', { params });
  },

  /**
   * Fetch task statistics directly from MongoDB
   */
  getTaskStats: async () => {
    return api.get('/tasks/stats');
  },

  /**
   * Fetch individual task details
   */
  getTaskById: async (id) => {
    return api.get(`/tasks/${id}`);
  },

  /**
   * Create a new task (Admin & Manager)
   */
  createTask: async (taskData) => {
    return api.post('/tasks', taskData);
  },

  /**
   * Update task details (Admin & Manager)
   */
  updateTask: async (id, taskData) => {
    return api.put(`/tasks/${id}`, taskData);
  },

  /**
   * Update task status (All authorized roles)
   */
  updateTaskStatus: async (id, status, order = 0) => {
    return api.patch(`/tasks/${id}/status`, { status, order });
  },

  /**
   * Save drag-and-drop ordering across columns
   */
  reorderTasks: async (reorderData) => {
    return api.patch('/tasks/reorder', reorderData);
  },

  /**
   * Delete a task
   */
  deleteTask: async (id) => {
    return api.delete(`/tasks/${id}`);
  },
};

export default taskService;
