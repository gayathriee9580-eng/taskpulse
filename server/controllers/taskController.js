import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyTaskParticipants } from '../socket/index.js';
import { createNotification } from './notificationController.js';
import { sendTaskAssignmentEmail, sendTaskUpdateEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

/**
 * Helper to build permission-scoped base query
 */
const getScopedFilter = (user) => {
  if (user.role === 'admin') {
    return {};
  }
  if (user.role === 'manager') {
    return {
      $or: [
        { createdBy: user._id },
        { assignedTo: user._id },
        { assignedBy: user._id },
      ],
    };
  }
  // Standard user: assigned to them or created by them
  return {
    $or: [
      { assignedTo: user._id },
      { createdBy: user._id },
    ],
  };
};

/**
 * @desc    Get tasks with pagination, filtering, search, and sorting
 * @route   GET /api/tasks
 * @access  Private
 */
export const getTasks = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    priority,
    assignedTo,
    dueBefore,
    dueAfter,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Pagination validation
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    return next(new AppError('Page number must be a positive integer (>= 1).', 400));
  }
  if (isNaN(limitNum) || limitNum < 1) {
    return next(new AppError('Limit must be a positive integer (>= 1).', 400));
  }

  // Base scope from role
  const filter = getScopedFilter(req.user);

  // Status filtering
  if (status) {
    const validStatuses = ['pending', 'in-progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Allowed values: ${validStatuses.join(', ')}`, 400));
    }
    filter.status = status;
  }

  // Priority filtering
  if (priority) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return next(new AppError(`Invalid priority. Allowed values: ${validPriorities.join(', ')}`, 400));
    }
    filter.priority = priority;
  }

  // Assigned user filtering
  if (assignedTo) {
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return next(new AppError('Invalid assigned user identifier.', 400));
    }
    filter.assignedTo = assignedTo;
  }

  // Due date filtering
  if (dueBefore || dueAfter) {
    filter.dueDate = {};
    if (dueBefore) {
      const dBefore = new Date(dueBefore);
      if (isNaN(dBefore.getTime())) {
        return next(new AppError('Invalid dueBefore date format.', 400));
      }
      filter.dueDate.$lte = dBefore;
    }
    if (dueAfter) {
      const dAfter = new Date(dueAfter);
      if (isNaN(dAfter.getTime())) {
        return next(new AppError('Invalid dueAfter date format.', 400));
      }
      filter.dueDate.$gte = dAfter;
    }
  }

  // Text search on title and description
  if (search && search.trim()) {
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ],
    });
  }

  // Sorting
  const sortOptions = {};
  const orderDirection = sortOrder === 'asc' ? 1 : -1;
  if (sortBy === 'order') {
    sortOptions.order = 1;
    sortOptions.createdAt = -1;
  } else if (['dueDate', 'priority', 'title'].includes(sortBy)) {
    sortOptions[sortBy] = orderDirection;
  } else {
    sortOptions.createdAt = orderDirection;
  }

  const skip = (pageNum - 1) * limitNum;
  const total = await Task.countDocuments(filter);
  const tasks = await Task.find(filter)
    .populate('assignedTo', 'name email role avatar')
    .populate('assignedBy', 'name email role')
    .populate('createdBy', 'name email role avatar')
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNum);

  const totalPages = Math.ceil(total / limitNum) || 1;

  return sendSuccess(
    res,
    200,
    'Tasks retrieved successfully',
    { tasks },
    {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    }
  );
});

/**
 * @desc    Get dashboard task statistics directly from MongoDB records
 * @route   GET /api/tasks/stats
 * @access  Private
 */
export const getTaskStats = asyncHandler(async (req, res) => {
  const scopeFilter = getScopedFilter(req.user);
  const now = new Date();

  const [total, pending, inProgress, completed, overdue] = await Promise.all([
    Task.countDocuments(scopeFilter),
    Task.countDocuments({ ...scopeFilter, status: 'pending' }),
    Task.countDocuments({ ...scopeFilter, status: 'in-progress' }),
    Task.countDocuments({ ...scopeFilter, status: 'completed' }),
    Task.countDocuments({
      ...scopeFilter,
      status: { $ne: 'completed' },
      dueDate: { $ne: null, $lt: now },
    }),
  ]);

  return sendSuccess(res, 200, 'Task statistics retrieved successfully', {
    total,
    pending,
    inProgress,
    completed,
    overdue,
  });
});

/**
 * @desc    Get single task details
 * @route   GET /api/tasks/:id
 * @access  Private
 */
export const getTaskById = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('Invalid task identifier format.', 400));
  }

  const task = await Task.findById(req.params.id)
    .populate('assignedTo', 'name email role avatar')
    .populate('assignedBy', 'name email role')
    .populate('createdBy', 'name email role avatar');

  if (!task) {
    return next(new AppError('Task not found.', 404));
  }

  // Permission check
  if (req.user.role === 'user') {
    const isAssigned = task.assignedTo && String(task.assignedTo._id) === String(req.user._id);
    const isCreator = String(task.createdBy._id) === String(req.user._id);
    if (!isAssigned && !isCreator) {
      return next(new AppError('You are not authorized to view this task.', 403));
    }
  }

  if (req.user.role === 'manager') {
    const isCreator = String(task.createdBy._id) === String(req.user._id);
    const isAssigned = task.assignedTo && String(task.assignedTo._id) === String(req.user._id);
    const isAssigner = task.assignedBy && String(task.assignedBy._id) === String(req.user._id);
    if (!isCreator && !isAssigned && !isAssigner) {
      return next(new AppError('You are not authorized to access this task.', 403));
    }
  }

  return sendSuccess(res, 200, 'Task retrieved successfully', { task });
});

/**
 * @desc    Create a new task
 * @route   POST /api/tasks
 * @access  Private (Admin & Manager only)
 */
export const createTask = asyncHandler(async (req, res, next) => {
  const { title, description, priority, dueDate, assignedTo, order } = req.body;

  if (!title || !title.trim()) {
    return next(new AppError('Task title is required.', 400));
  }

  // Validate priority
  const taskPriority = priority || 'medium';
  if (!['low', 'medium', 'high'].includes(taskPriority)) {
    return next(new AppError('Invalid priority. Allowed: low, medium, high', 400));
  }

  // Validate due date
  let parsedDueDate = null;
  if (dueDate) {
    parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return next(new AppError('Invalid due date format.', 400));
    }
  }

  let validAssignedTo = null;
  let validAssignedBy = null;
  let targetUser = null;

  // Validate assigned user
  if (assignedTo) {
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return next(new AppError('Invalid assigned user identifier format.', 400));
    }

    targetUser = await User.findById(assignedTo);
    if (!targetUser || !targetUser.isActive) {
      return next(new AppError('Assigned user does not exist or is inactive.', 400));
    }

    // Role assignment enforcement: Manager can only assign to regular users
    if (req.user.role === 'manager' && targetUser.role !== 'user') {
      return next(
        new AppError('Managers are only permitted to assign tasks to regular users.', 403)
      );
    }

    validAssignedTo = targetUser._id;
    validAssignedBy = req.user._id;
  }

  // Highest order for Kanban default
  let taskOrder = typeof order === 'number' ? order : 0;
  if (typeof order !== 'number') {
    const highestOrderTask = await Task.findOne({ status: 'pending' }).sort({ order: -1 });
    taskOrder = highestOrderTask ? highestOrderTask.order + 1 : 0;
  }

  const task = await Task.create({
    title: title.trim(),
    description: description ? description.trim() : '',
    status: 'pending',
    priority: taskPriority,
    dueDate: parsedDueDate,
    assignedTo: validAssignedTo,
    assignedBy: validAssignedBy,
    createdBy: req.user._id, // Enforce from session
    order: taskOrder,
  });

  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email role avatar')
    .populate('assignedBy', 'name email role')
    .populate('createdBy', 'name email role avatar');

  // 1. Emit live Socket.IO event to participants & admin room
  notifyTaskParticipants(populatedTask, 'task:created');

  // 2. Dispatch persistent notification and email to assignee (if assigned to someone else)
  if (validAssignedTo && String(validAssignedTo) !== String(req.user._id)) {
    createNotification({
      recipient: validAssignedTo,
      sender: req.user._id,
      title: 'New Task Assigned',
      message: `You were assigned "${populatedTask.title}" by ${req.user.name}.`,
      type: 'TASK_ASSIGNED',
      task: populatedTask._id,
    });

    if (targetUser?.email) {
      sendTaskAssignmentEmail({
        to: targetUser.email,
        recipientName: targetUser.name,
        task: populatedTask,
        assignedByName: req.user.name,
      }).catch((err) => logger.warn(`Assignment email error: ${err.message}`));
    }
  }

  return sendSuccess(res, 201, 'Task created successfully', { task: populatedTask });
});

/**
 * @desc    Update task details
 * @route   PUT /api/tasks/:id
 * @access  Private (Admin, or Manager if creator)
 */
export const updateTask = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('Invalid task identifier format.', 400));
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return next(new AppError('Task not found.', 404));
  }

  // Authorization check
  if (req.user.role === 'user') {
    return next(new AppError('Users are not authorized to edit task details.', 403));
  }

  if (req.user.role === 'manager' && String(task.createdBy) !== String(req.user._id)) {
    return next(new AppError('Managers can only edit tasks they created.', 403));
  }

  const oldAssignedTo = task.assignedTo ? String(task.assignedTo) : null;
  const oldStatus = task.status;
  const oldPriority = task.priority;
  const { title, description, priority, status, dueDate, assignedTo, order } = req.body;

  if (title !== undefined) {
    if (!title || !title.trim()) {
      return next(new AppError('Task title cannot be empty.', 400));
    }
    task.title = title.trim();
  }

  if (description !== undefined) {
    task.description = description ? description.trim() : '';
  }

  if (priority !== undefined) {
    if (!['low', 'medium', 'high'].includes(priority)) {
      return next(new AppError('Invalid priority. Allowed: low, medium, high', 400));
    }
    task.priority = priority;
  }

  if (status !== undefined) {
    if (!['pending', 'in-progress', 'completed'].includes(status)) {
      return next(new AppError('Invalid status. Allowed: pending, in-progress, completed', 400));
    }
    task.status = status;
  }

  if (dueDate !== undefined) {
    if (dueDate === null || dueDate === '') {
      task.dueDate = null;
    } else {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        return next(new AppError('Invalid due date format.', 400));
      }
      task.dueDate = parsed;
    }
  }

  let newAssignedUser = null;
  if (assignedTo !== undefined) {
    if (assignedTo === null || assignedTo === '') {
      task.assignedTo = null;
      task.assignedBy = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return next(new AppError('Invalid assigned user identifier format.', 400));
      }
      newAssignedUser = await User.findById(assignedTo);
      if (!newAssignedUser || !newAssignedUser.isActive) {
        return next(new AppError('Assigned user does not exist or is inactive.', 400));
      }
      if (req.user.role === 'manager' && newAssignedUser.role !== 'user') {
        return next(
          new AppError('Managers are only permitted to assign tasks to regular users.', 403)
        );
      }
      task.assignedTo = newAssignedUser._id;
      task.assignedBy = req.user._id;
    }
  }

  if (typeof order === 'number') {
    task.order = order;
  }

  await task.save();

  const updatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email role avatar')
    .populate('assignedBy', 'name email role')
    .populate('createdBy', 'name email role avatar');

  // 1. Emit live Socket.IO update event to all relevant participants & admin room
  notifyTaskParticipants(updatedTask, 'task:updated');

  // 2. Notification and Email dispatch
  const currentAssignedId = updatedTask.assignedTo?._id ? String(updatedTask.assignedTo._id) : null;

  // Case A: Task newly reassigned to someone new
  if (currentAssignedId && currentAssignedId !== oldAssignedTo && currentAssignedId !== String(req.user._id)) {
    createNotification({
      recipient: updatedTask.assignedTo._id,
      sender: req.user._id,
      title: 'Task Reassigned',
      message: `You were assigned task "${updatedTask.title}" by ${req.user.name}.`,
      type: 'TASK_ASSIGNED',
      task: updatedTask._id,
    });

    if (updatedTask.assignedTo?.email) {
      sendTaskAssignmentEmail({
        to: updatedTask.assignedTo.email,
        recipientName: updatedTask.assignedTo.name,
        task: updatedTask,
        assignedByName: req.user.name,
      }).catch((err) => logger.warn(`Reassignment email warning: ${err.message}`));
    }
  }
  // Case B: Meaningful update on existing assigned task
  else if (currentAssignedId && currentAssignedId !== String(req.user._id)) {
    const changes = [];
    if (oldStatus !== updatedTask.status) changes.push(`Status changed to ${updatedTask.status}`);
    if (oldPriority !== updatedTask.priority) changes.push(`Priority changed to ${updatedTask.priority}`);
    if (changes.length > 0) {
      const summary = changes.join(', ');
      createNotification({
        recipient: updatedTask.assignedTo._id,
        sender: req.user._id,
        title: 'Task Updated',
        message: `${req.user.name} updated "${updatedTask.title}": ${summary}.`,
        type: 'TASK_UPDATED',
        task: updatedTask._id,
      });

      if (updatedTask.assignedTo?.email) {
        sendTaskUpdateEmail({
          to: updatedTask.assignedTo.email,
          recipientName: updatedTask.assignedTo.name,
          task: updatedTask,
          changeSummary: summary,
          updatedByName: req.user.name,
          updatedStatus: updatedTask.status,
          updatedPriority: updatedTask.priority,
          updatedDueDate: updatedTask.dueDate,
        }).catch((err) => logger.warn(`Update email warning: ${err.message}`));
      }
    }
  }

  return sendSuccess(res, 200, 'Task updated successfully', { task: updatedTask });
});

/**
 * @desc    Update task status (e.g. Kanban column transition)
 * @route   PATCH /api/tasks/:id/status
 * @access  Private
 */
export const updateTaskStatus = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('Invalid task identifier format.', 400));
  }

  const { status, order } = req.body;
  if (!status) {
    return next(new AppError('Status is required.', 400));
  }

  const validStatuses = ['pending', 'in-progress', 'completed'];
  if (!validStatuses.includes(status)) {
    return next(
      new AppError(`Invalid status. Allowed values: ${validStatuses.join(', ')}`, 400)
    );
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return next(new AppError('Task not found.', 404));
  }

  // Authorization check
  if (req.user.role === 'user') {
    const isAssigned = task.assignedTo && String(task.assignedTo) === String(req.user._id);
    const isCreator = String(task.createdBy) === String(req.user._id);
    if (!isAssigned && !isCreator) {
      return next(new AppError('You are not authorized to update progress on this task.', 403));
    }
  }

  if (req.user.role === 'manager') {
    const isCreator = String(task.createdBy) === String(req.user._id);
    const isAssigned = task.assignedTo && String(task.assignedTo) === String(req.user._id);
    const isAssigner = task.assignedBy && String(task.assignedBy) === String(req.user._id);
    if (!isCreator && !isAssigned && !isAssigner) {
      return next(new AppError('You are not authorized to update this task.', 403));
    }
  }

  const oldStatus = task.status;
  task.status = status;
  if (typeof order === 'number') {
    task.order = order;
  }
  await task.save();

  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email role avatar')
    .populate('assignedBy', 'name email role')
    .populate('createdBy', 'name email role avatar');

  // 1. Emit live Socket.IO statusChanged event
  notifyTaskParticipants(populatedTask, 'task:statusChanged', {
    oldStatus,
    newStatus: status,
  });

  // 2. Persistent notification & email when status changes
  if (oldStatus !== status) {
    // If updated by someone else, notify assignee
    if (
      populatedTask.assignedTo &&
      String(populatedTask.assignedTo._id) !== String(req.user._id)
    ) {
      createNotification({
        recipient: populatedTask.assignedTo._id,
        sender: req.user._id,
        title: 'Status Updated',
        message: `${req.user.name} moved "${populatedTask.title}" to ${status}.`,
        type: 'STATUS_CHANGED',
        task: populatedTask._id,
      });

      if (populatedTask.assignedTo?.email) {
        sendTaskUpdateEmail({
          to: populatedTask.assignedTo.email,
          recipientName: populatedTask.assignedTo.name,
          task: populatedTask,
          changeSummary: `Status updated from ${oldStatus} to ${status}`,
          updatedByName: req.user.name,
          updatedStatus: status,
        }).catch((err) => logger.warn(`Status email error: ${err.message}`));
      }
    }

    // If updated by user, notify manager/creator if distinct
    if (
      populatedTask.createdBy &&
      String(populatedTask.createdBy._id) !== String(req.user._id)
    ) {
      createNotification({
        recipient: populatedTask.createdBy._id,
        sender: req.user._id,
        title: 'Task Progress Updated',
        message: `${req.user.name} advanced "${populatedTask.title}" to ${status}.`,
        type: 'STATUS_CHANGED',
        task: populatedTask._id,
      });
    }
  }

  return sendSuccess(res, 200, 'Task status updated successfully', { task: populatedTask });
});

/**
 * @desc    Save drag-and-drop ordering across columns
 * @route   PATCH /api/tasks/reorder
 * @access  Private
 */
export const reorderTasks = asyncHandler(async (req, res, next) => {
  const { items, taskId, newStatus, newOrder } = req.body;

  // Single task fast-update mode
  if (taskId && newStatus) {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return next(new AppError('Invalid taskId format.', 400));
    }

    const validStatuses = ['pending', 'in-progress', 'completed'];
    if (!validStatuses.includes(newStatus)) {
      return next(
        new AppError(`Invalid status. Allowed values: ${validStatuses.join(', ')}`, 400)
      );
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return next(new AppError('Task not found.', 404));
    }

    // Role check
    if (req.user.role === 'user') {
      const isAssigned = task.assignedTo && String(task.assignedTo) === String(req.user._id);
      const isCreator = String(task.createdBy) === String(req.user._id);
      if (!isAssigned && !isCreator) {
        return next(new AppError('You are not authorized to reorder this task.', 403));
      }
    }

    task.status = newStatus;
    if (typeof newOrder === 'number') {
      task.order = newOrder;
    }
    await task.save();

    // Broadcast reorder event without sending spam emails
    notifyTaskParticipants(task, 'task:reordered', {
      taskId,
      newStatus,
      newOrder,
    });

    return sendSuccess(res, 200, 'Task order updated successfully', { task });
  }

  // Batch items mode: [{ id, status, order }]
  if (Array.isArray(items) && items.length > 0) {
    const validStatuses = ['pending', 'in-progress', 'completed'];
    const updateOps = items
      .map((item) => {
        if (!item || !mongoose.Types.ObjectId.isValid(item.id)) return null;
        if (item.status && !validStatuses.includes(item.status)) return null;
        return {
          updateOne: {
            filter: { _id: item.id },
            update: {
              $set: {
                ...(item.status ? { status: item.status } : {}),
                ...(typeof item.order === 'number' ? { order: item.order } : {}),
              },
            },
          },
        };
      })
      .filter(Boolean);

    if (updateOps.length > 0) {
      await Task.bulkWrite(updateOps);

      // Notify connected clients that task sequences were modified
      notifyTaskParticipants(null, 'task:reordered', {
        updatedCount: updateOps.length,
      });
    }

    return sendSuccess(res, 200, 'Tasks reordered successfully', {
      updatedCount: updateOps.length,
    });
  }

  return next(new AppError('Please provide items array or taskId with status and order.', 400));
});

/**
 * @desc    Delete task
 * @route   DELETE /api/tasks/:id
 * @access  Private (Admin, or Manager if created by them)
 */
export const deleteTask = asyncHandler(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('Invalid task identifier format.', 400));
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return next(new AppError('Task not found.', 404));
  }

  // Authorization check
  if (req.user.role === 'user') {
    return next(new AppError('Users are not authorized to delete tasks.', 403));
  }

  if (req.user.role === 'manager' && String(task.createdBy) !== String(req.user._id)) {
    return next(new AppError('Managers can only delete tasks they created.', 403));
  }

  // Emit event before removal so participants receive the taskId and title
  notifyTaskParticipants(task, 'task:deleted', {
    taskId: task._id,
    title: task.title,
  });

  // Notify assigned user if distinct from deleter
  if (task.assignedTo && String(task.assignedTo) !== String(req.user._id)) {
    createNotification({
      recipient: task.assignedTo,
      sender: req.user._id,
      title: 'Task Deleted',
      message: `Task "${task.title}" was removed by ${req.user.name}.`,
      type: 'TASK_DELETED',
    });
  }

  await task.deleteOne();

  return sendSuccess(res, 200, 'Task deleted successfully', { taskId: req.params.id });
});

export default {
  getTasks,
  getTaskStats,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  reorderTasks,
  deleteTask,
};
