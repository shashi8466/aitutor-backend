import axios from 'axios';

async function testDemoAPI() {
  const BACKEND_URL = 'https://aitutor-backend-u7h3.onrender.com';
  
  console.log('🧪 Testing Demo API...\n');
  
  // Test 1: Health Check
  console.log('1️⃣ Testing Health Endpoint...');
  try {
    const health = await axios.get(`${BACKEND_URL}/api/health`);
    console.log('✅ Health Check PASSED:', health.data.status);
    console.log('   Server uptime:', Math.round(health.data.uptime), 'seconds\n');
  } catch (error) {
    console.log('❌ Health Check FAILED:', error.message);
    console.log('   The backend might not be deployed or is still starting up.\n');
    return;
  }
  
  // Test 2: Submit Demo Lead
  console.log('2️⃣ Testing Demo Lead Submission...');
  try {
    const response = await axios.post(`${BACKEND_URL}/api/demo/submit-lead`, {
      courseId: 1,
      fullName: 'Test User',
      grade: '10',
      email: 'test@example.com',
      phone: '+1234567890',
      level: 'Easy',
      scoreDetails: {
        correctCount: 5,
        totalQuestions: 10,
        currentLevelPercentage: 50,
        easyPercentage: 0,
        mediumPercentage: 0,
        hardPercentage: 50,
        scaledScore: 1200
      }
    });
    console.log('✅ Lead Submission PASSED:', response.data.message);
    console.log('   Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.log('❌ Lead Submission FAILED with status:', error.response.status);
      console.log('   Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 404) {
        console.log('\n💡 SOLUTION: The backend code needs to be redeployed on Render.');
        console.log('   Go to: https://dashboard.render.com');
        console.log('   Find your backend service and trigger a new deployment.\n');
      } else if (error.response.status === 500) {
        console.log('\n💡 SOLUTION: The database table "demo_leads" might not exist.');
        console.log('   Run the migration SQL in Supabase SQL Editor.');
        console.log('   File: src/supabase/migrations/1776510000000-add_demo_course_flag.sql\n');
      }
    } else {
      console.log('❌ Network Error:', error.message);
      console.log('   Check your internet connection or backend URL.\n');
    }
  }
}

testDemoAPI();
