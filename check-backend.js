#!/usr/bin/env node

/**
 * Quick Backend Diagnostic Script
 * Run with: node check-backend.js
 */

import http from 'http';

console.log('🔍 Checking Backend Server...\n');

const checkEndpoint = (path, name) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`✅ ${name}: Status ${res.statusCode}`);
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            console.log(`   Response:`, JSON.stringify(json).substring(0, 100));
          } catch (e) {
            console.log(`   Response:`, data.substring(0, 100));
          }
        }
        resolve(true);
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${name}: ${err.message}`);
      if (err.code === 'ECONNREFUSED') {
        console.log(`   → Backend server is NOT running on port 3001`);
      }
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`⏱️  ${name}: Request timeout`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

(async () => {
  const checks = [
    { path: '/api/health', name: 'Health Check' },
    { path: '/api/debug/routes', name: 'Routes Debug' }
  ];

  let allPassed = true;
  
  for (const check of checks) {
    const passed = await checkEndpoint(check.path, check.name);
    if (!passed) allPassed = false;
    console.log('');
  }

  console.log('================================');
  if (allPassed) {
    console.log('✅ Backend is fully operational!');
    console.log('\nYou can now:');
    console.log('  - Upload files in admin panel');
    console.log('  - Access frontend at http://localhost:5173');
  } else {
    console.log('❌ Backend is NOT running properly');
    console.log('\nTo fix:');
    console.log('  1. Run: npm run server');
    console.log('  2. Wait for "Server running" message');
    console.log('  3. Run this script again');
  }
  console.log('================================');
})();
