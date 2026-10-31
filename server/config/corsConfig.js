/**
 * Dynamic resolution of permitted frontend origins
 */
const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ];

  if (process.env.CLIENT_URL) {
    const urls = process.env.CLIENT_URL.split(',').map((u) => u.trim().replace(/\/+$/, ''));
    origins.push(...urls);
  }

  if (process.env.ALLOWED_ORIGINS) {
    const urls = process.env.ALLOWED_ORIGINS.split(',').map((u) => u.trim().replace(/\/+$/, ''));
    origins.push(...urls);
  }

  return [...new Set(origins)];
};

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, uptime monitors)
    if (!origin) return callback(null, true);

    const origins = getAllowedOrigins();
    const cleanOrigin = origin.replace(/\/+$/, '');

    // Allow in development mode or exact match
    if (process.env.NODE_ENV === 'development' || origins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // Allow Vercel preview deployments if a vercel origin is configured
    if (cleanOrigin.endsWith('.vercel.app') && origins.some((o) => o.includes('.vercel.app'))) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by TaskPulse CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['set-cookie'],
};

export default corsOptions;
