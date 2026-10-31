import { User } from '../models/User.js';
import { generateToken } from '../services/tokenService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('A user with this email address already exists.', 409));
  }

  // Explicit check against admin role registration
  if (role === 'admin') {
    return next(new AppError('Public registration with the admin role is prohibited.', 403));
  }

  // Create user (role default is user, manager allowed if selected)
  const assignedRole = role === 'manager' ? 'manager' : 'user';

  const user = await User.create({
    name,
    email,
    password,
    role: assignedRole,
  });

  const token = generateToken({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  return sendSuccess(res, 201, 'User registered successfully', { user: userData, token });
});

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide both email and password.', 400));
  }

  // Find user and explicitly select password
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return next(new AppError('Invalid email or password credentials.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('This account is inactive. Please contact your administrator.', 403));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return next(new AppError('Invalid email or password credentials.', 401));
  }

  // Update last login timestamp
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    lastLogin: user.lastLogin,
  };

  return sendSuccess(res, 200, 'Authentication successful', { user: userData, token });
});

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, 'User profile retrieved successfully', { user: req.user });
});

export default {
  register,
  login,
  getMe,
};
