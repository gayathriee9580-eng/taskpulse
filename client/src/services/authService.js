import api from './api.js';

export const authService = {
  /**
   * Register a new user
   */
  register: async (userData) => {
    return api.post('/auth/register', userData);
  },

  /**
   * Login with email and password
   */
  login: async (credentials) => {
    return api.post('/auth/login', credentials);
  },

  /**
   * Fetch current authenticated user profile
   */
  getMe: async () => {
    return api.get('/auth/me');
  },
};

export default authService;
