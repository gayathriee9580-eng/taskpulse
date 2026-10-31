import { Router } from 'express';
import { getUsers, updateUserRole } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';

const router = Router();

router.use(protect);

router.get('/', getUsers);
router.patch('/:id/role', restrictTo('admin'), updateUserRole);

export default router;
