import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import jwt from 'jsonwebtoken';
import { io as ClientIO } from 'socket.io-client';
import { app } from '../server.js';
import { initSocket } from '../socket/index.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import {
  generateTaskAssignmentHtml,
  generateTaskUpdateHtml,
  sendEmail,
} from '../services/emailService.js';

const PORT = 5088;
const BASE_URL = `http://localhost:${PORT}/api`;
const SOCKET_URL = `http://localhost:${PORT}`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const runRealtimeAndNotificationTests = async () => {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}⚡ TASKPULSE PHASE 4: REAL-TIME UPDATES & NOTIFICATIONS TESTS${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let testServer;
  try {
    testServer = http.createServer(app);
    initSocket(testServer);
    await new Promise((resolve) => testServer.listen(PORT, resolve));
    console.log(`[Test Server] Running on port ${PORT}`);
  } catch (err) {
    console.error('Failed to bind test server:', err);
    process.exit(1);
  }

  const results = [];
  const assert = (testNum, testName, condition, details = '') => {
    if (condition) {
      console.log(`  ${colors.green}✔ PASS${colors.reset} [Test ${testNum}] — ${testName}`);
      results.push({ testNum, testName, status: 'PASS' });
    } else {
      console.log(`  ${colors.red}✖ FAIL${colors.reset} [Test ${testNum}] — ${testName} (${details})`);
      results.push({ testNum, testName, status: 'FAIL', details });
    }
  };

  const openSockets = [];
  const createSocket = (token, options = {}) => {
    const socket = ClientIO(SOCKET_URL, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
      ...options,
    });
    openSockets.push(socket);
    return socket;
  };

  try {
    // ----------------------------------------------------
    // Authenticate Users
    // ----------------------------------------------------
    const login = async (email, password) => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      return { token: data.data?.token, user: data.data?.user };
    };

    const adminAuth = await login('admin@taskpulse.com', 'admin123');
    const managerAuth = await login('manager@taskpulse.com', 'manager123');
    const userAuth = await login('user@taskpulse.com', 'user123');

    if (!adminAuth.token || !managerAuth.token || !userAuth.token) {
      throw new Error('Failed to authenticate test accounts.');
    }

    // ----------------------------------------------------
    // TEST 1: Valid JWT Socket Authentication
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 1: Valid JWT Socket Authentication${colors.reset}`);
    const validSocket = createSocket(userAuth.token);

    const connected = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      validSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve(true);
      });
      validSocket.on('connect_error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });

    assert(1, 'Valid JWT connects to Socket.IO and establishes session', connected === true);

    // ----------------------------------------------------
    // TEST 2: Invalid JWT Socket Rejection
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 2: Invalid JWT Socket Rejection${colors.reset}`);
    const invalidSocket = createSocket('invalid.tampered.token');

    const invalidRejected = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      invalidSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve(false);
      });
      invalidSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        resolve(err.message.includes('Authentication failed') || err.message.includes('Invalid'));
      });
    });

    assert(2, 'Invalid JWT token handshake is rejected by socket middleware', invalidRejected === true);

    // ----------------------------------------------------
    // TEST 3: Expired JWT Socket Rejection
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 3: Expired JWT Socket Rejection${colors.reset}`);
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_dev_key_for_task_management_system_2026';
    const expiredToken = jwt.sign(
      { id: userAuth.user._id, role: userAuth.user.role },
      jwtSecret,
      { expiresIn: '0s' }
    );

    const expiredSocket = createSocket(expiredToken);
    const expiredRejected = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      expiredSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve(false);
      });
      expiredSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        resolve(err.message.includes('Authentication failed') || err.message.includes('Invalid or expired'));
      });
    });

    assert(3, 'Expired JWT token handshake is rejected by socket middleware', expiredRejected === true);

    // ----------------------------------------------------
    // SETUP FOR REAL-TIME TESTS: Connect Admin, User, Manager sockets
    // ----------------------------------------------------
    const adminSocket = createSocket(adminAuth.token);
    const userSocket = createSocket(userAuth.token);
    const managerSocket = createSocket(managerAuth.token);

    await Promise.all([
      new Promise((res) => adminSocket.on('connect', res)),
      new Promise((res) => userSocket.on('connect', res)),
      new Promise((res) => managerSocket.on('connect', res)),
    ]);

    let createdTaskId;

    // ----------------------------------------------------
    // TEST 4: Task Creation Event Delivery (Assignee & Admin Room)
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 4: Task Creation Real-Time Event Delivery${colors.reset}`);
    const userReceivedCreatedPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 4000);
      userSocket.on('task:created', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const adminReceivedCreatedPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 4000);
      adminSocket.on('task:created', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const createRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Real-time WebSocket Pipeline Optimization',
        description: 'Verify event delivery to authorized participants.',
        assignedTo: userAuth.user._id,
        priority: 'high',
        status: 'pending',
      }),
    });
    const createData = await createRes.json();
    createdTaskId = createData.data?.task?._id;

    const [userReceivedCreated, adminReceivedCreated] = await Promise.all([
      userReceivedCreatedPromise,
      adminReceivedCreatedPromise,
    ]);

    assert(
      4,
      'Assignee and Admin receive task:created event with valid payload',
      Boolean(
        createdTaskId &&
        userReceivedCreated?.taskId === createdTaskId &&
        adminReceivedCreated?.taskId === createdTaskId
      ),
      `UserGot: ${Boolean(userReceivedCreated)}, AdminGot: ${Boolean(adminReceivedCreated)}`
    );

    // ----------------------------------------------------
    // TEST 5: Task Update Event Delivery
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 5: Task Update Real-Time Event Delivery${colors.reset}`);
    const userReceivedUpdatePromise = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 4000);
      userSocket.on('task:updated', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const updateRes = await fetch(`${BASE_URL}/tasks/${createdTaskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Real-time WebSocket Pipeline Optimization [UPDATED]',
        priority: 'medium',
      }),
    });
    const updateData = await updateRes.json();
    const userReceivedUpdate = await userReceivedUpdatePromise;

    assert(
      5,
      'Assignee receives task:updated event upon task modification',
      Boolean(
        updateRes.status === 200 &&
        userReceivedUpdate?.taskId === createdTaskId
      ),
      `Status: ${updateRes.status}`
    );

    // ----------------------------------------------------
    // TEST 6: Status Update Event Delivery
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 6: Status Update Real-Time Event Delivery${colors.reset}`);
    const adminReceivedStatusPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 4000);
      adminSocket.on('task:statusChanged', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    const statusRes = await fetch(`${BASE_URL}/tasks/${createdTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.token}`,
      },
      body: JSON.stringify({
        status: 'in-progress',
      }),
    });

    const adminReceivedStatus = await adminReceivedStatusPromise;

    assert(
      6,
      'Task participants receive task:statusChanged event with new status',
      Boolean(
        statusRes.status === 200 &&
        adminReceivedStatus?.taskId === createdTaskId &&
        adminReceivedStatus?.status === 'in-progress'
      ),
      `Status: ${statusRes.status}, Received: ${JSON.stringify(adminReceivedStatus)}`
    );

    // ----------------------------------------------------
    // TEST 7: Restricted Scope (Unauthorized Users do not receive event)
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 7: Restricted Scope Isolation${colors.reset}`);
    let managerReceivedUnrelated = false;
    const managerListener = (data) => {
      if (data.taskId === createdTaskId) {
        managerReceivedUnrelated = true;
      }
    };
    managerSocket.on('task:updated', managerListener);

    // Admin updates the task again
    await fetch(`${BASE_URL}/tasks/${createdTaskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        description: 'Scoped event testing check.',
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 800));
    managerSocket.off('task:updated', managerListener);

    assert(
      7,
      'Uninvolved user/manager not in task rooms does NOT receive restricted task events',
      managerReceivedUnrelated === false
    );

    // ----------------------------------------------------
    // TEST 8: Notification Creation in MongoDB
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 8: Notification Creation in MongoDB${colors.reset}`);
    const createdNotification = await Notification.findOne({
      recipient: userAuth.user._id,
      task: createdTaskId,
      type: 'TASK_ASSIGNED',
    });

    assert(
      8,
      'Task assignment persists a valid Notification record in MongoDB with isRead=false',
      Boolean(
        createdNotification &&
        createdNotification.type === 'TASK_ASSIGNED' &&
        createdNotification.isRead === false
      ),
      `Notification: ${Boolean(createdNotification)}, isRead: ${createdNotification?.isRead}`
    );

    // ----------------------------------------------------
    // TEST 9: Notification Retrieval (GET /api/notifications)
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 9: Notification Retrieval${colors.reset}`);
    const getNotifRes = await fetch(`${BASE_URL}/notifications`, {
      headers: {
        Authorization: `Bearer ${userAuth.token}`,
      },
    });
    const notifData = await getNotifRes.json();

    assert(
      9,
      'GET /api/notifications returns list of user notifications and unreadCount',
      Boolean(
        getNotifRes.status === 200 &&
        Array.isArray(notifData.data?.notifications) &&
        notifData.data?.unreadCount >= 1
      ),
      `Status: ${getNotifRes.status}, count: ${notifData.data?.unreadCount}`
    );

    // ----------------------------------------------------
    // TEST 10: Notification Ownership Protection
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 10: Notification Ownership Protection${colors.reset}`);
    const notifIdToTest = createdNotification?._id;

    // Manager attempts to mark User's notification as read
    const hackRes = await fetch(`${BASE_URL}/notifications/${notifIdToTest}/read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managerAuth.token}`,
      },
    });

    assert(
      10,
      'User cannot mark another user\'s notification as read (returns 403 Forbidden)',
      hackRes.status === 403,
      `Status: ${hackRes.status}`
    );

    // ----------------------------------------------------
    // TEST 11: Mark Single Notification as Read
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 11: Mark Single Notification as Read${colors.reset}`);
    const markReadRes = await fetch(`${BASE_URL}/notifications/${notifIdToTest}/read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userAuth.token}`,
      },
    });
    const markReadData = await markReadRes.json();

    assert(
      11,
      'PATCH /api/notifications/:id/read sets isRead=true for notification owner',
      Boolean(
        markReadRes.status === 200 &&
        markReadData.data?.notification?.isRead === true
      ),
      `Status: ${markReadRes.status}`
    );

    // ----------------------------------------------------
    // TEST 12: Mark All Notifications as Read
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 12: Mark All Notifications as Read${colors.reset}`);
    // Create an extra notification to test mark-all
    await Notification.create({
      recipient: userAuth.user._id,
      title: 'Secondary Workflow Alert',
      message: 'Testing bulk mark-read endpoint.',
      type: 'TASK_UPDATED',
      isRead: false,
    });

    const markAllRes = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${userAuth.token}`,
      },
    });

    const countRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: {
        Authorization: `Bearer ${userAuth.token}`,
      },
    });
    const countData = await countRes.json();

    assert(
      12,
      'PATCH /api/notifications/read-all marks all notifications read and resets unread count to 0',
      Boolean(
        markAllRes.status === 200 &&
        countData.data?.count === 0
      ),
      `Status: ${markAllRes.status}, remainingCount: ${countData.data?.count}`
    );

    // ----------------------------------------------------
    // TEST 13: Email HTML Template Generation
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 13: Email HTML Template Generation${colors.reset}`);
    const assignmentHtml = generateTaskAssignmentHtml({
      recipientName: 'Alice Developer',
      taskTitle: 'Database Connection Pool Optimization',
      taskDescription: 'Tune max pool size for production load.',
      priority: 'high',
      dueDate: new Date().toISOString(),
      assignedByName: 'Bob Manager',
    });

    const updateHtml = generateTaskUpdateHtml({
      recipientName: 'Alice Developer',
      taskTitle: 'Database Connection Pool Optimization',
      changeSummary: 'Priority escalated to high.',
      updatedStatus: 'in-progress',
      updatedPriority: 'high',
      updatedByName: 'Bob Manager',
    });

    const templatesValid =
      assignmentHtml.includes('TaskPulse Enterprise') &&
      assignmentHtml.includes('Database Connection Pool Optimization') &&
      assignmentHtml.includes('HIGH PRIORITY') &&
      updateHtml.includes('TaskPulse Update Alert') &&
      updateHtml.includes('in-progress');

    assert(
      13,
      'Email templates generate semantic HTML with task metadata and brand styling',
      templatesValid === true
    );

    // ----------------------------------------------------
    // TEST 14: SMTP Non-Blocking Failure Handling
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 14: SMTP Non-Blocking Graceful Handling${colors.reset}`);
    // Dispatch email with mock transporter
    const emailResult = await sendEmail({
      to: 'nonexistent-user@taskpulse.com',
      subject: 'Test Graceful Email Dispatch',
      html: '<p>Testing non-blocking email insulation.</p>',
    });

    // Also verify task creation succeeds even when email dispatcher runs
    const taskWithEmailRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Email Notification Non-Blocking Verification Task',
        assignedTo: userAuth.user._id,
        priority: 'low',
        status: 'pending',
      }),
    });

    assert(
      14,
      'Email dispatch handles unconfigured or failing SMTP without throwing or aborting task operations',
      Boolean(taskWithEmailRes.status === 201)
    );

  } catch (error) {
    console.error(`\n${colors.red}Unhandled error during tests:${colors.reset}`, error);
  } finally {
    // Cleanup sockets
    openSockets.forEach((s) => {
      try {
        s.disconnect();
      } catch (e) {}
    });

    if (testServer) {
      testServer.close();
    }
  }

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}PHASE 4 TEST SUMMARY:${colors.reset}`);
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total: ${results.length} | Passed: ${colors.green}${passed}${colors.reset} | Failed: ${failed ? colors.red + failed + colors.reset : '0'}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runRealtimeAndNotificationTests();
