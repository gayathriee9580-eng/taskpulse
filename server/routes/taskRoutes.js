import { Router } from 'express';
import {
  getTasks,
  getTaskStats,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  reorderTasks,
  deleteTask,
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';

const router = Router();

// Protect all task routes with JWT authentication
router.use(protect);

// Specific named endpoints (must precede parameter routes)
router.get('/stats', getTaskStats);
router.patch('/reorder', reorderTasks);

// Collection endpoints
router.get('/', getTasks);
router.post('/', restrictTo('admin', 'manager'), createTask);

// Individual resource endpoints
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.patch('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

export default router;
