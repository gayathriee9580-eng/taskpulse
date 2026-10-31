import axios from 'axios';

// Clean base URL handling: supports relative '/api' in local dev proxy and full HTTPS URLs in production
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const clean = envUrl.trim().replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Standardize error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const responseData = error.response?.data;
    const message = responseData?.message || error.message || 'An unexpected error occurred';

    // If 401 Unauthorized, token might be invalid or expired
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    return Promise.reject({
      message,
      statusCode: error.response?.status || 500,
      errors: responseData?.errors,
    });
  }
);

export default api;
