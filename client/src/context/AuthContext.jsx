import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService.js';
import socketService from '../services/socketService.js';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize and verify user on startup
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const res = await authService.getMe();
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          socketService.connect(storedToken);
        } catch (err) {
          console.warn('Session expired or invalid token:', err.message);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await authService.login({ email, password });
      const { user: loggedInUser, token: authToken } = res.data;

      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(loggedInUser));

      setToken(authToken);
      setUser(loggedInUser);
      socketService.connect(authToken);

      return { success: true, user: loggedInUser };
    } catch (err) {
      setError(err.message || 'Login failed');
      return { success: false, message: err.message };
    }
  };

  const register = async (userData) => {
    setError(null);
    try {
      const res = await authService.register(userData);
      const { user: registeredUser, token: authToken } = res.data;

      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(registeredUser));

      setToken(authToken);
      setUser(registeredUser);
      socketService.connect(authToken);

      return { success: true, user: registeredUser };
    } catch (err) {
      setError(err.message || 'Registration failed');
      return { success: false, message: err.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    socketService.disconnect();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
