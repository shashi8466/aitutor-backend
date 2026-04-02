// ============================================
// TEST WELCOME EMAIL DIRECTLY
// Run this to verify Brevo integration works
// ============================================

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 Testing Welcome Email System...\n');

async function testWelcomeEmail() {
  const testEmail = process.argv[2] || 'YOUR_TEST_EMAIL@gmail.com';
  
  console.log('📝 Test Configuration:');
  console.log('   BREVO_API_KEY:', process.env.BREVO_API_KEY ? '✅ Configured' : '❌ Missing');
  console.log('   EMAIL_FROM:', process.env.EMAIL_FROM || 'Not set');
  console.log('   APP_URL:', process.env.APP_URL || 'Not set');
  console.log('   Test Email:', testEmail);
  console.log('');

  // Check if running on deployed backend or local
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const endpoint = `${backendUrl}/api/auth/test-welcome-email`;
  
  console.log('📡 Calling endpoint:', endpoint);
  console.log('');

  try {
    const response = await axios.post(endpoint, {
      email: testEmail
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('✅ SUCCESS! Response:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n📧 Check your email inbox at:', testEmail);
    console.log('   Subject: "Welcome to AI Tutor 🎉"');
    console.log('   Should arrive within 10-20 seconds\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received - backend may not be running');
      console.error('   Start backend with: npm start');
    } else {
      console.error('   Request failed:', error.message);
    }

    console.log('\n🔧 Troubleshooting Steps:');
    console.log('   1. Make sure backend is running: npm start');
    console.log('   2. Check .env has BREVO_API_KEY configured');
    console.log('   3. Verify backend logs for errors');
    console.log('   4. Try again with a different email address\n');
  }
}

testWelcomeEmail();
