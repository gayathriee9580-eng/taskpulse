import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { app } from '../server.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';

const PORT = 5066;
const BASE_URL = `http://localhost:${PORT}/api`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const runTaskSystemTests = async () => {
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}📋 TASKPULSE PHASE 3: TASK MANAGEMENT SYSTEM TESTS${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  let testServer;
  try {
    testServer = app.listen(PORT);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (err) {
    console.error('Failed to bind test server port:', err);
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

  try {
    // ----------------------------------------------------
    // Authenticate Admin, Manager, and User
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

    let adminCreatedTaskId;
    let managerCreatedTaskId;
    let adminConfidentialTaskId;

    // ----------------------------------------------------
    // TEST 1: Admin creates a task
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 1: Admin Creates a Task${colors.reset}`);
    const res1 = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Core Architecture Optimization',
        description: 'Refactor database query indexes for high concurrency.',
        priority: 'high',
        assignedTo: userAuth.user._id,
      }),
    });
    const body1 = await res1.json();
    adminCreatedTaskId = body1.data?.task?._id;
    assert(
      1,
      'Admin successfully creates a task with 201 Created',
      res1.status === 201 && body1.success === true && body1.data?.task?.priority === 'high',
      `Status: ${res1.status}`
    );

    // ----------------------------------------------------
    // TEST 2: Manager creates a task
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 2: Manager Creates a Task${colors.reset}`);
    const res2 = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Weekly Sprint Backlog Grooming',
        description: 'Triage pending user stories and estimate story points.',
        priority: 'medium',
        assignedTo: userAuth.user._id,
      }),
    });
    const body2 = await res2.json();
    managerCreatedTaskId = body2.data?.task?._id;
    assert(
      2,
      'Manager successfully creates a task with 201 Created',
      res2.status === 201 && body2.success === true && body2.data?.task?.priority === 'medium',
      `Status: ${res2.status}`
    );

    // ----------------------------------------------------
    // TEST 3: User cannot create a task
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 3: User Cannot Create a Task${colors.reset}`);
    const res3 = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Task Creation Attempt',
        description: 'Should be blocked by role authorization.',
        priority: 'low',
      }),
    });
    const body3 = await res3.json();
    assert(
      3,
      'User is blocked from creating a task with 403 Forbidden',
      res3.status === 403 && body3.success === false,
      `Status: ${res3.status}`
    );

    // ----------------------------------------------------
    // TEST 4: Admin can view all tasks
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 4: Admin Can View All Tasks${colors.reset}`);
    const res4 = await fetch(`${BASE_URL}/tasks?limit=50`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const body4 = await res4.json();
    const adminTaskCount = body4.data?.tasks?.length || 0;
    assert(
      4,
      'Admin retrieves all workspace tasks across all users',
      res4.status === 200 && adminTaskCount >= 5,
      `Count: ${adminTaskCount}`
    );

    // ----------------------------------------------------
    // TEST 5: User sees only permitted tasks
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 5: User Sees Only Permitted Tasks${colors.reset}`);
    const res5 = await fetch(`${BASE_URL}/tasks?limit=50`, {
      headers: { Authorization: `Bearer ${userAuth.token}` },
    });
    const body5 = await res5.json();
    const userTasks = body5.data?.tasks || [];
    const allPermitted = userTasks.every(
      (t) =>
        String(t.assignedTo?._id || t.assignedTo) === String(userAuth.user._id) ||
        String(t.createdBy?._id || t.createdBy) === String(userAuth.user._id)
    );
    assert(
      5,
      'User only sees tasks assigned to them or created by them',
      res5.status === 200 && allPermitted && userTasks.length > 0,
      `Permitted: ${allPermitted}, Count: ${userTasks.length}`
    );

    // ----------------------------------------------------
    // TEST 6: Manager cannot access unauthorized tasks
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 6: Manager Cannot Access Unauthorized Tasks${colors.reset}`);
    // Admin creates an internal admin-only task (not assigned to manager or created by manager)
    const adminPrivateRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Executive Financial Audit',
        description: 'Restricted administrative audit.',
        priority: 'high',
        assignedTo: adminAuth.user._id,
      }),
    });
    const adminPrivateData = await adminPrivateRes.json();
    adminConfidentialTaskId = adminPrivateData.data?.task?._id;

    // Manager attempts to view this private task
    const res6 = await fetch(`${BASE_URL}/tasks/${adminConfidentialTaskId}`, {
      headers: { Authorization: `Bearer ${managerAuth.token}` },
    });
    assert(
      6,
      'Manager is blocked from viewing unauthorized admin tasks with 403 Forbidden',
      res6.status === 403,
      `Status: ${res6.status}`
    );

    // ----------------------------------------------------
    // TEST 7: Task update works
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 7: Task Update Works${colors.reset}`);
    const res7 = await fetch(`${BASE_URL}/tasks/${managerCreatedTaskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Weekly Sprint Backlog Grooming - Updated',
        priority: 'high',
      }),
    });
    const body7 = await res7.json();
    assert(
      7,
      'Manager successfully updates details on their created task',
      res7.status === 200 && body7.data?.task?.title.includes('Updated') && body7.data?.task?.priority === 'high',
      `Status: ${res7.status}`
    );

    // ----------------------------------------------------
    // TEST 8: Task deletion permissions work
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 8: Task Deletion Permissions Work${colors.reset}`);
    // A. User cannot delete
    const res8a = await fetch(`${BASE_URL}/tasks/${managerCreatedTaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAuth.token}` },
    });
    // B. Manager cannot delete admin's task
    const res8b = await fetch(`${BASE_URL}/tasks/${adminCreatedTaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerAuth.token}` },
    });
    // C. Manager CAN delete their own task
    const res8c = await fetch(`${BASE_URL}/tasks/${managerCreatedTaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerAuth.token}` },
    });
    assert(
      8,
      'Deletion permissions correctly enforced across User, Manager, and Admin',
      res8a.status === 403 && res8b.status === 403 && res8c.status === 200,
      `UserDelete: ${res8a.status}, ManagerDeleteAdminTask: ${res8b.status}, ManagerDeleteOwn: ${res8c.status}`
    );

    // ----------------------------------------------------
    // TEST 9: Invalid task data is rejected
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 9: Invalid Task Data is Rejected${colors.reset}`);
    // Empty title
    const res9a = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAuth.token}` },
      body: JSON.stringify({ title: '' }),
    });
    // Invalid priority
    const res9b = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAuth.token}` },
      body: JSON.stringify({ title: 'Valid Title', priority: 'ultra-critical' }),
    });
    // Nonexistent assigned user
    const res9c = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAuth.token}` },
      body: JSON.stringify({ title: 'Valid Title', assignedTo: '600000000000000000000099' }),
    });
    // Manager assigning to Admin
    const res9d = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerAuth.token}` },
      body: JSON.stringify({ title: 'Manager to Admin', assignedTo: adminAuth.user._id }),
    });
    assert(
      9,
      'Invalid title, invalid priority, nonexistent user, and illegal role assignment are rejected',
      res9a.status === 400 && res9b.status === 400 && res9c.status === 400 && res9d.status === 403,
      `EmptyTitle: ${res9a.status}, BadPriority: ${res9b.status}, NonexistentUser: ${res9c.status}, ManagerToAdmin: ${res9d.status}`
    );

    // ----------------------------------------------------
    // TEST 10: Task status updates work
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 10: Task Status Updates Work${colors.reset}`);
    // User updates status of task assigned to them
    const res10 = await fetch(`${BASE_URL}/tasks/${adminCreatedTaskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAuth.token}`,
      },
      body: JSON.stringify({ status: 'in-progress' }),
    });
    const body10 = await res10.json();
    assert(
      10,
      'Assigned user successfully advances task status to in-progress',
      res10.status === 200 && body10.data?.task?.status === 'in-progress',
      `Status: ${res10.status}, TaskStatus: ${body10.data?.task?.status}`
    );

    // ----------------------------------------------------
    // TEST 11: Pagination works
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 11: Pagination Works${colors.reset}`);
    const res11 = await fetch(`${BASE_URL}/tasks?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const body11 = await res11.json();
    const meta = body11.meta;
    assert(
      11,
      'Pagination correctly respects limit=2 and returns structured metadata',
      res11.status === 200 &&
        body11.data?.tasks?.length === 2 &&
        meta?.page === 1 &&
        meta?.limit === 2 &&
        meta?.totalPages >= 2,
      `Length: ${body11.data?.tasks?.length}, Meta: ${JSON.stringify(meta)}`
    );

    // ----------------------------------------------------
    // TEST 12: Search and filtering work
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 12: Search and Filtering Work${colors.reset}`);
    const res12a = await fetch(`${BASE_URL}/tasks?status=in-progress`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const body12a = await res12a.json();
    const allInProgress = body12a.data?.tasks?.every((t) => t.status === 'in-progress');

    const res12b = await fetch(`${BASE_URL}/tasks?search=Retrospective`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    const body12b = await res12b.json();
    const foundSearch = body12b.data?.tasks?.some((t) => t.title.includes('Retrospective'));

    assert(
      12,
      'Search by keyword and filtering by status work accurately',
      res12a.status === 200 && allInProgress && res12b.status === 200 && foundSearch,
      `AllInProgress: ${allInProgress}, FoundSearch: ${foundSearch}`
    );

    // ----------------------------------------------------
    // TEST 13: Drag-and-drop ordering persists
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 13: Drag-and-Drop Ordering Persists${colors.reset}`);
    const res13 = await fetch(`${BASE_URL}/tasks/reorder`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.token}`,
      },
      body: JSON.stringify({
        taskId: adminCreatedTaskId,
        newStatus: 'completed',
        newOrder: 42,
      }),
    });
    const body13 = await res13.json();

    // Verify persisted record in DB
    const persistedTask = await Task.findById(adminCreatedTaskId);
    assert(
      13,
      'Reordering persists updated status and sequence order in MongoDB',
      res13.status === 200 &&
        persistedTask &&
        persistedTask.status === 'completed' &&
        persistedTask.order === 42,
      `PersistedStatus: ${persistedTask?.status}, PersistedOrder: ${persistedTask?.order}`
    );

    // Clean up temporary test tasks
    await Task.deleteMany({ _id: { $in: [adminCreatedTaskId, adminConfidentialTaskId] } });

    console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
    const allPassed = results.every((r) => r.status === 'PASS');
    if (allPassed) {
      console.log(`${colors.bold}${colors.green}🎉 ALL 13 TASK SYSTEM TESTS PASSED SUCCESSFULLY!${colors.reset}`);
    } else {
      console.log(`${colors.bold}${colors.red}❌ SOME TASK SYSTEM TESTS FAILED.${colors.reset}`);
    }
    console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

    testServer.close();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Task test execution error:', error);
    if (testServer) testServer.close();
    process.exit(1);
  }
};

runTaskSystemTests();
