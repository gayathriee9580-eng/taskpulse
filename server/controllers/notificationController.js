import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emitToUser } from '../socket/index.js';
import { logger } from '../utils/logger.js';

/**
 * @desc    Get current user's notifications
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
    return next(new AppError('Invalid pagination parameters.', 400));
  }

  const filter = { recipient: req.user._id };
  const total = await Notification.countDocuments(filter);
  const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });

  const notifications = await Notification.find(filter)
    .populate('sender', 'name email role avatar')
    .populate('task', 'title status priority dueDate')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  return sendSuccess(
    res,
    200,
    'Notifications retrieved successfully',
    { notifications, unreadCount },
    {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    }
  );
});

/**
 * @desc    Get count of unread notifications for current user
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  return sendSuccess(res, 200, 'Unread notification count retrieved', { count });
});

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markAsRead = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('Invalid notification identifier format.', 400));
  }

  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    return next(new AppError('Notification not found.', 404));
  }

  // Strict ownership enforcement
  if (String(notification.recipient) !== String(req.user._id)) {
    return next(
      new AppError('You are not authorized to access or modify this notification.', 403)
    );
  }

  notification.isRead = true;
  await notification.save();

  return sendSuccess(res, 200, 'Notification marked as read', { notification });
});

/**
 * @desc    Mark all notifications as read for current user
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );

  return sendSuccess(res, 200, 'All notifications marked as read', {
    modifiedCount: result.modifiedCount,
  });
});

/**
 * Helper to create and real-time dispatch persistent notifications
 */
export const createNotification = async ({
  recipient,
  sender,
  title,
  message,
  type = 'TASK_UPDATED',
  task = null,
  metadata = {},
}) => {
  try {
    if (!recipient) return null;

    const notification = await Notification.create({
      recipient,
      sender: sender || null,
      title,
      message,
      type,
      task: task?._id || task || null,
      metadata,
    });

    // Populate sender info for frontend toast rendering
    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name email role')
      .populate('task', 'title status priority');

    // Emit live real-time event to recipient's private socket room
    emitToUser(recipient, 'notification:new', { notification: populated });

    return populated;
  } catch (error) {
    logger.error(`Failed to create persistent notification: ${error.message}`);
    return null;
  }
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
};
