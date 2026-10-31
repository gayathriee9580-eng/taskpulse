import { verifyToken } from '../services/tokenService.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Protect routes by verifying JWT Bearer token
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Authentication required. No token provided.', 401));
  }

  try {
    const decoded = verifyToken(token);

    // Verify user still exists
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('This user account has been deactivated.', 403));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired authentication token.', 401));
  }
});

export default protect;
