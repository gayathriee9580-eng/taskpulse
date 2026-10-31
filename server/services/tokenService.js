import jwt from 'jsonwebtoken';

/**
 * Safely retrieve JWT Secret key from environment
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY ALERT: JWT_SECRET environment variable is missing in production!');
    }
    // Safe placeholder development key only used in non-production environments
    return 'taskpulse_development_only_jwt_secret_placeholder_2026';
  }
  return secret;
};

/**
 * Generate a JWT token for user payload
 */
export const generateToken = (payload) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify a JWT token
 */
export const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};

export default {
  getJwtSecret,
  generateToken,
  verifyToken,
};
