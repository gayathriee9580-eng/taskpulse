import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Get all users (for task assignments & admin directory)
 * @route   GET /api/users
 * @access  Private
 */
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ isActive: true }).select('name email role avatar lastLogin createdAt');
  return sendSuccess(res, 200, 'Users retrieved successfully', { users });
});

/**
 * @desc    Update user role (Admin only)
 * @route   PATCH /api/users/:id/role
 * @access  Private (Admin)
 */
export const updateUserRole = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('Invalid user identifier format.', 400));
  }

  // Prevent administrator from changing their own role (lockout prevention)
  if (String(req.params.id) === String(req.user._id)) {
    return next(new AppError('Administrators cannot change their own role.', 400));
  }

  const { role } = req.body;

  if (!['admin', 'manager', 'user'].includes(role)) {
    return next(new AppError('Invalid role specified. Allowed roles: admin, manager, user', 400));
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  ).select('name email role');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  return sendSuccess(res, 200, 'User role updated successfully', { user });
});

export default {
  getUsers,
  updateUserRole,
};
