import { AppError } from '../utils/appError.js';

/**
 * Restrict endpoint access to designated roles
 * @param  {...string} roles - e.g. 'admin', 'manager', 'member'
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Permission denied: Your role (${req.user?.role || 'anonymous'}) is not authorized to perform this action.`,
          403
        )
      );
    }
    next();
  };
};

export default restrictTo;
