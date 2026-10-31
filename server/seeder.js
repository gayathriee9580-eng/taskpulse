import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Task } from './models/Task.js';
import { ActivityLog } from './models/ActivityLog.js';
import { logger } from './utils/logger.js';

const seedData = async () => {
  try {
    await connectDB();

    logger.info('Clearing existing database collections...');
    await User.deleteMany();
    await Task.deleteMany();
    await ActivityLog.deleteMany();

    logger.info('Creating demo role accounts...');
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@taskpulse.com',
      password: 'admin123',
      role: 'admin',
    });

    const manager = await User.create({
      name: 'Project Manager',
      email: 'manager@taskpulse.com',
      password: 'manager123',
      role: 'manager',
    });

    const standardUser = await User.create({
      name: 'Team User',
      email: 'user@taskpulse.com',
      password: 'user123',
      role: 'user',
    });

    logger.success('Users seeded:');
    logger.info(`- Admin:   ${admin.email} / admin123`);
    logger.info(`- Manager: ${manager.email} / manager123`);
    logger.info(`- User:    ${standardUser.email} / user123`);

    logger.info('Creating initial project tasks...');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await Task.create([
      {
        title: 'Configure Production Environment Pipeline',
        description: 'Verify deployment configuration and MongoDB Atlas connectivity for production.',
        status: 'completed',
        priority: 'high',
        assignedTo: standardUser._id,
        assignedBy: manager._id,
        createdBy: manager._id,
        dueDate: nextWeek,
        order: 0,
      },
      {
        title: 'Audit Multi-Role Authorization Rules',
        description: 'Review restrictTo middleware across all endpoints for admin, manager, and user access.',
        status: 'in-progress',
        priority: 'high',
        assignedTo: manager._id,
        assignedBy: admin._id,
        createdBy: admin._id,
        dueDate: nextWeek,
        order: 0,
      },
      {
        title: 'Implement Kanban Board Drag-and-Drop Interaction',
        description: 'Implement drag-and-drop mechanics to move tasks between Pending, In Progress, and Completed.',
        status: 'pending',
        priority: 'medium',
        assignedTo: standardUser._id,
        assignedBy: manager._id,
        createdBy: manager._id,
        dueDate: nextWeek,
        order: 0,
      },
      {
        title: 'Review System Activity and Server Performance',
        description: 'Monitor server response times, active database connections, and memory consumption.',
        status: 'pending',
        priority: 'low',
        assignedTo: standardUser._id,
        assignedBy: admin._id,
        createdBy: admin._id,
        dueDate: nextWeek,
        order: 1,
      },
      {
        title: 'Overdue Sprint Retrospective Documentation',
        description: 'Compile task retrospective notes and sprint deliverable summary.',
        status: 'in-progress',
        priority: 'medium',
        assignedTo: standardUser._id,
        assignedBy: manager._id,
        createdBy: manager._id,
        dueDate: yesterday,
        order: 1,
      },
    ]);

    logger.success('Database seeded successfully with standardized roles and tasks!');
    process.exit(0);
  } catch (error) {
    logger.error(`Database seeding failed: ${error.message}`);
    process.exit(1);
  }
};

seedData();
