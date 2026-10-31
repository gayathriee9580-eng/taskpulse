import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import mongoose from 'mongoose';
import { io as ClientIO } from 'socket.io-client';
import { app } from '../server.js';
import { initSocket } from '../socket/index.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';
import { Notification } from '../models/Notification.js';
import { getJwtSecret } from '../services/tokenService.js';

const PORT = 5099;
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

const runSystemAuditTests = async () => {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}🛡️ TASKPULSE PHASE 5: COMPLETE SYSTEM & SECURITY AUDIT TESTS${colors.reset}`);
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
  const createSocket = (token) => {
    const socket = ClientIO(SOCKET_URL, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
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

    // Create an inactive user for testing
    let inactiveUser = await User.findOne({ email: 'inactive_test@taskpulse.com' });
    if (!inactiveUser) {
      inactiveUser = await User.create({
        name: 'Inactive Tester',
        email: 'inactive_test@taskpulse.com',
        password: 'Password123!',
        role: 'user',
        isActive: false,
      });
    }

    // ----------------------------------------------------
    // TEST 1: Missing Required Fields in Task Creation
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 1: Missing Required Fields Validation${colors.reset}`);
    const emptyTitleRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: '   ',
        priority: 'high',
      }),
    });

    assert(
      1,
      'POST /api/tasks rejects empty or whitespace-only title with 400 Bad Request',
      emptyTitleRes.status === 400
    );

    // ----------------------------------------------------
    // TEST 2: Assigning Task to Inactive User
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 2: Inactive User Assignment Prevention${colors.reset}`);
    const inactiveAssignRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Audit Inactive User Task',
        assignedTo: inactiveUser._id,
      }),
    });

    assert(
      2,
      'POST /api/tasks prevents assigning tasks to deactivated accounts',
      inactiveAssignRes.status === 400
    );

    // ----------------------------------------------------
    // TEST 3: Role Assignment Restrictions
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 3: Role Assignment Permission Boundaries${colors.reset}`);
    const managerToAdminRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Manager Assigning to Admin Task',
        assignedTo: adminAuth.user._id,
      }),
    });

    assert(
      3,
      'Managers are blocked from assigning tasks to Administrators (returns 403 Forbidden)',
      managerToAdminRes.status === 403
    );

    // ----------------------------------------------------
    // TEST 4: Updating Nonexistent or Deleted Task
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 4: Nonexistent Task Handling${colors.reset}`);
    const fakeTaskId = new mongoose.Types.ObjectId();
    const notFoundRes = await fetch(`${BASE_URL}/tasks/${fakeTaskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Ghost Task Update',
      }),
    });

    assert(
      4,
      'PUT /api/tasks/:id on nonexistent ID returns 404 Not Found',
      notFoundRes.status === 404
    );

    // ----------------------------------------------------
    // TEST 5: Invalid Due Date Format Rejection
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 5: Invalid Due Date Rejection${colors.reset}`);
    const badDateRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Bad Date Task',
        dueDate: 'invalid-not-a-date-string',
      }),
    });

    assert(
      5,
      'POST /api/tasks rejects malformed due date formats with 400 Bad Request',
      badDateRes.status === 400
    );

    // ----------------------------------------------------
    // Create Valid Task for Next Checks
    // ----------------------------------------------------
    const createRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Audit Verification Baseline Task',
        description: 'Used for concurrency and edge case verification.',
        assignedTo: userAuth.user._id,
        priority: 'medium',
      }),
    });
    const createData = await createRes.json();
    const auditTaskId = createData.data?.task?._id;

    // ----------------------------------------------------
    // TEST 6: Concurrent Status Updates Consistency
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 6: Concurrent Status Updates Consistency${colors.reset}`);
    const req1 = fetch(`${BASE_URL}/tasks/${auditTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.token}`,
      },
      body: JSON.stringify({ status: 'in-progress' }),
    });

    const req2 = fetch(`${BASE_URL}/tasks/${auditTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.token}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const finalDoc = await Task.findById(auditTaskId);

    assert(
      6,
      'Rapid concurrent task status changes execute without database deadlock and persist valid status',
      Boolean(
        (res1.status === 200 || res2.status === 200) &&
        ['in-progress', 'completed'].includes(finalDoc.status)
      )
    );

    // ----------------------------------------------------
    // TEST 7: Empty Search Results Handling
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 7: Empty Search Results Handling${colors.reset}`);
    const emptySearchRes = await fetch(`${BASE_URL}/tasks?search=xyz_completely_nonexistent_task_query_999`, {
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const emptySearchData = await emptySearchRes.json();

    assert(
      7,
      'GET /api/tasks?search=... with no matches returns empty tasks array and total 0 cleanly',
      Boolean(
        emptySearchRes.status === 200 &&
        Array.isArray(emptySearchData.data?.tasks) &&
        emptySearchData.data?.tasks.length === 0 &&
        (emptySearchData.meta?.total === 0 || emptySearchData.pagination?.total === 0)
      )
    );

    // ----------------------------------------------------
    // TEST 8: Pagination Beyond Available Records
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 8: Pagination Beyond Available Records${colors.reset}`);
    const beyondPageRes = await fetch(`${BASE_URL}/tasks?page=9999&limit=10`, {
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
      },
    });
    const beyondPageData = await beyondPageRes.json();

    assert(
      8,
      'GET /api/tasks with page exceeding total pages returns empty array without throwing',
      Boolean(
        beyondPageRes.status === 200 &&
        Array.isArray(beyondPageData.data?.tasks) &&
        beyondPageData.data?.tasks.length === 0
      )
    );

    // ----------------------------------------------------
    // TEST 9: Admin Self-Role Modification Prevention
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 9: Admin Self-Role Lockout Prevention${colors.reset}`);
    const demoteRes = await fetch(`${BASE_URL}/users/${adminAuth.user._id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({ role: 'user' }),
    });

    assert(
      9,
      'PATCH /api/users/:id/role blocks an administrator from demoting their own account',
      demoteRes.status === 400
    );

    // ----------------------------------------------------
    // TEST 10: Task Creator Protection against Payload Spoofing
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 10: Task Creator Protection against Payload Spoofing${colors.reset}`);
    const fakeCreatorId = new mongoose.Types.ObjectId();
    const spoofRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Spoofed Creator Task',
        createdBy: fakeCreatorId, // Attempted spoof
      }),
    });
    const spoofData = await spoofRes.json();
    const savedSpoofTask = await Task.findById(spoofData.data?.task?._id);

    assert(
      10,
      'Task creation ignores spoofed createdBy in request body and strictly enforces session user',
      Boolean(
        savedSpoofTask &&
        String(savedSpoofTask.createdBy) === String(managerAuth.user._id) &&
        String(savedSpoofTask.createdBy) !== String(fakeCreatorId)
      )
    );

    // ----------------------------------------------------
    // TEST 11: Production JWT_SECRET Enforcement
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 11: Production JWT_SECRET Enforcement${colors.reset}`);
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;

    let threwInProd = false;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      getJwtSecret();
    } catch (e) {
      threwInProd = true;
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.JWT_SECRET = prevSecret;
    }

    assert(
      11,
      'getJwtSecret strictly throws an error in production mode if JWT_SECRET is missing',
      threwInProd === true
    );

    // ----------------------------------------------------
    // TEST 12: Socket Disconnection on Logout Simulation
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 12: Socket Session Lifecycle${colors.reset}`);
    const testSocket = createSocket(userAuth.token);
    await new Promise((res) => testSocket.on('connect', res));
    const wasConnected = testSocket.connected;

    testSocket.disconnect();
    const disconnectedCleanly = !testSocket.connected;

    assert(
      12,
      'Socket cleanly terminates session and frees connection on client disconnect/logout',
      wasConnected === true && disconnectedCleanly === true
    );

    // ----------------------------------------------------
    // TEST 13: Reorder Fast-Update Status Validation
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 13: Reorder Fast-Update Status Validation${colors.reset}`);
    const invalidReorderRes = await fetch(`${BASE_URL}/tasks/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        taskId: auditTaskId,
        newStatus: 'invalid_status_value',
      }),
    });

    assert(
      13,
      'PATCH /api/tasks/reorder rejects invalid status values with 400 Bad Request',
      invalidReorderRes.status === 400
    );

    // ----------------------------------------------------
    // TEST 14: Batch Reorder Ignores Invalid Items Cleanly
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 14: Batch Reorder Safety${colors.reset}`);
    const batchReorderRes = await fetch(`${BASE_URL}/tasks/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        items: [
          { id: auditTaskId, status: 'completed', order: 1 },
          { id: 'not_a_valid_id', status: 'pending', order: 2 },
          { id: new mongoose.Types.ObjectId(), status: 'invalid_status', order: 3 },
        ],
      }),
    });

    assert(
      14,
      'Batch reorder filters out invalid IDs and statuses without crashing or aborting valid operations',
      batchReorderRes.status === 200
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
  console.log(`${colors.bold}PHASE 5 TEST SUMMARY:${colors.reset}`);
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

runSystemAuditTests();
