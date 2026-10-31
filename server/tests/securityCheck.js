import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import http from 'http';
import { app, server } from '../server.js';
import { User } from '../models/User.js';
import { Task } from '../models/Task.js';

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}/api`;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const runSecurityTests = async () => {
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}🔒 TASKPULSE PHASE 2: SECURITY & AUTHORIZATION TESTS${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  let testServer;
  try {
    testServer = app.listen(PORT);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (err) {
    console.error('Failed to bind test port:', err);
    process.exit(1);
  }

  const results = [];

  const assert = (testName, condition, details = '') => {
    if (condition) {
      console.log(`  ${colors.green}✔ PASS${colors.reset} — ${testName}`);
      results.push({ testName, status: 'PASS' });
    } else {
      console.log(`  ${colors.red}✖ FAIL${colors.reset} — ${testName} (${details})`);
      results.push({ testName, status: 'FAIL', details });
    }
  };

  try {
    // ----------------------------------------------------
    // TEST 1: Invalid login credentials
    // ----------------------------------------------------
    console.log(`${colors.yellow}Test 1: Invalid Login Credentials${colors.reset}`);
    const res1 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@taskpulse.com', password: 'incorrectPassword999' }),
    });
    const body1 = await res1.json();
    assert(
      'Rejects invalid password with 401 Unauthorized',
      res1.status === 401 && body1.success === false,
      `Status: ${res1.status}`
    );

    // ----------------------------------------------------
    // TEST 2: Duplicate registration
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 2: Duplicate Registration Prevention${colors.reset}`);
    const res2 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Test',
        email: 'user@taskpulse.com', // Already registered in DB
        password: 'password123',
        role: 'user',
      }),
    });
    const body2 = await res2.json();
    assert(
      'Rejects duplicate registration with 409 Conflict',
      res2.status === 409 && body2.success === false,
      `Status: ${res2.status}`
    );

    // ----------------------------------------------------
    // TEST 3: Missing JWT token on protected route
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 3: Missing JWT Token Check${colors.reset}`);
    const res3 = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
    });
    const body3 = await res3.json();
    assert(
      'Rejects request missing Authorization header with 401 Unauthorized',
      res3.status === 401 && body3.success === false,
      `Status: ${res3.status}`
    );

    // ----------------------------------------------------
    // TEST 4: Invalid / Malformed JWT token
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 4: Invalid JWT Token Signature${colors.reset}`);
    const res4 = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: 'Bearer totally.invalid.tokenstring12345' },
    });
    const body4 = await res4.json();
    assert(
      'Rejects invalid JWT token signature with 401 Unauthorized',
      res4.status === 401 && body4.success === false,
      `Status: ${res4.status}`
    );

    // ----------------------------------------------------
    // TEST 5: Expired JWT token
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 5: Expired JWT Token Handling${colors.reset}`);
    const expiredToken = jwt.sign(
      { id: '6ae5da36b82fdcdfc1580c6b', role: 'admin' },
      process.env.JWT_SECRET || 'super_secret_jwt_dev_key_for_task_management_system_2026',
      { expiresIn: '-10s' } // Expired 10 seconds ago
    );
    const res5 = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const body5 = await res5.json();
    assert(
      'Rejects expired JWT token with 401 Unauthorized',
      res5.status === 401 && body5.success === false,
      `Status: ${res5.status}`
    );

    // ----------------------------------------------------
    // Obtain valid tokens for Manager and User roles
    // ----------------------------------------------------
    const managerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@taskpulse.com', password: 'manager123' }),
    });
    const managerData = await managerLoginRes.json();
    const managerToken = managerData.data?.token;

    const userLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@taskpulse.com', password: 'user123' }),
    });
    const userData = await userLoginRes.json();
    const userToken = userData.data?.token;
    const userId = userData.data?.user?._id;

    // ----------------------------------------------------
    // TEST 6: Admin route accessed by Manager
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 6: Admin Route Protection (Manager Attempt)${colors.reset}`);
    const res6 = await fetch(`${BASE_URL}/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });
    const body6 = await res6.json();
    assert(
      'Blocks Manager from admin role-update route with 403 Forbidden',
      res6.status === 403 && body6.success === false,
      `Status: ${res6.status}`
    );

    // ----------------------------------------------------
    // TEST 7: Manager route accessed by User
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 7: Manager Route Protection (User Attempt)${colors.reset}`);
    const res7 = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Task by User',
        description: 'Should be rejected',
        priority: 'high',
      }),
    });
    const body7 = await res7.json();
    assert(
      'Blocks User from creating tasks (Manager/Admin only) with 403 Forbidden',
      res7.status === 403 && body7.success === false,
      `Status: ${res7.status}`
    );

    // ----------------------------------------------------
    // TEST 8: Public registration attempting to create Admin
    // ----------------------------------------------------
    console.log(`\n${colors.yellow}Test 8: Public Registration Admin Role Prohibition${colors.reset}`);
    const res8 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Registration',
        email: 'hacker_admin@taskpulse.com',
        password: 'password123',
        role: 'admin',
      }),
    });
    const body8 = await res8.json();
    assert(
      'Rejects public registration with role=admin (400 Bad Request or 403 Forbidden)',
      (res8.status === 400 || res8.status === 403) && body8.success === false,
      `Status: ${res8.status}`
    );

    // Clean up if created
    await User.deleteOne({ email: 'hacker_admin@taskpulse.com' });

    console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
    const allPassed = results.every((r) => r.status === 'PASS');
    if (allPassed) {
      console.log(`${colors.bold}${colors.green}🎉 ALL 8 SECURITY CHECKS PASSED SUCCESSFULLY!${colors.reset}`);
    } else {
      console.log(`${colors.bold}${colors.red}❌ SOME SECURITY CHECKS FAILED.${colors.reset}`);
    }
    console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

    testServer.close();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Test execution error:', error);
    if (testServer) testServer.close();
    process.exit(1);
  }
};

runSecurityTests();
