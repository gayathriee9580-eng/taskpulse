import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import taskRoutes from './taskRoutes.js';
import userRoutes from './userRoutes.js';
import notificationRoutes from './notificationRoutes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/notifications', notificationRoutes);

export default apiRouter;
