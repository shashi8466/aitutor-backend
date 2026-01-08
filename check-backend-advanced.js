#!/usr/bin/env node

/**
 * Advanced Backend Diagnostic Tool
 * Checks everything needed for uploads to work
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

console.log('\n🔍 ADVANCED BACKEND DIAGNOSTIC\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let allChecks = [];

// Helper function to make HTTP requests
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
        if (res.statusCode === 200) {
          console.log(`✅ ${name}: PASS`);
          allChecks.push({ name, status: 'pass' });
          resolve(true);
        } else {
          console.log(`⚠️  ${name}: Status ${res.statusCode}`);
          allChecks.push({ name, status: 'warning', code: res.statusCode });
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${name}: FAIL - ${err.message}`);
      allChecks.push({ name, status: 'fail', error: err.message });
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`⏱️  ${name}: TIMEOUT`);
      allChecks.push({ name, status: 'timeout' });
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

// Check if required files exist
const checkFile = (filePath, name) => {
  const exists = fs.existsSync(filePath);
  if (exists) {
    console.log(`✅ ${name}: EXISTS`);
    allChecks.push({ name, status: 'pass' });
    return true;
  } else {
    console.log(`❌ ${name}: MISSING`);
    allChecks.push({ name, status: 'fail' });
    return false;
  }
};

(async () => {
  console.log('🔍 PHASE 1: File Structure Check\n');
  
  checkFile('.env', '.env file');
  checkFile('src/server/index.js', 'Backend entry point');
  checkFile('src/server/routes/upload.js', 'Upload routes');
  checkFile('src/server/routes/ai.js', 'AI routes');
  checkFile('package.json', 'package.json');
  
  console.log('\n🔍 PHASE 2: Environment Variables Check\n');
  
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    const hasBackendUrl = envContent.includes('VITE_BACKEND_URL');
    const hasOpenAI = envContent.includes('OPENAI_API_KEY');
    const hasPort = envContent.includes('PORT');
    
    console.log(`${hasBackendUrl ? '✅' : '❌'} VITE_BACKEND_URL`);
    console.log(`${hasOpenAI ? '✅' : '❌'} OPENAI_API_KEY`);
    console.log(`${hasPort ? '✅' : '❌'} PORT`);
    
    allChecks.push({ name: 'Environment Variables', status: hasBackendUrl && hasOpenAI && hasPort ? 'pass' : 'fail' });
  }
  
  console.log('\n🔍 PHASE 3: Backend Connection Check\n');
  
  await checkEndpoint('/api/health', 'Health Check');
  await checkEndpoint('/api/debug/routes', 'Routes Debug');
  await checkEndpoint('/api/upload/test', 'Upload Test');
  await checkEndpoint('/api/ai/test', 'AI Test');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const passed = allChecks.filter(c => c.status === 'pass').length;
  const failed = allChecks.filter(c => c.status === 'fail').length;
  const warnings = allChecks.filter(c => c.status === 'warning' || c.status === 'timeout').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log('');
  
  if (failed === 0 && warnings === 0) {
    console.log('🎉 ALL CHECKS PASSED!');
    console.log('');
    console.log('✅ Your backend is fully operational!');
    console.log('✅ You can now upload files in the admin panel.');
    console.log('✅ Frontend: http://localhost:5173');
  } else {
    console.log('🚨 ISSUES DETECTED!');
    console.log('');
    
    const backendDown = allChecks.some(c => 
      c.name.includes('Health') && c.status === 'fail'
    );
    
    if (backendDown) {
      console.log('❌ PRIMARY ISSUE: Backend is NOT running');
      console.log('');
      console.log('🔧 TO FIX:');
      console.log('   1. Open a terminal');
      console.log('   2. Run: npm run server');
      console.log('   3. Wait for "SERVER SUCCESSFULLY STARTED" message');
      console.log('   4. Run this diagnostic again: node check-backend-advanced.js');
    } else {
      console.log('⚠️  Backend is running but some services are unavailable');
      console.log('');
      console.log('🔧 TO FIX:');
      console.log('   1. Stop backend (Ctrl+C)');
      console.log('   2. Run: npm install');
      console.log('   3. Run: npm run server');
      console.log('   4. Check for error messages');
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();