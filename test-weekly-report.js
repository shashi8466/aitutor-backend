/**
 * Test Weekly Report and Due Date Notifications
 * This script sends a test weekly report to Shashi and checks due date functionality
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

// Test student data for Shashi
const testStudentData = {
  studentId: 'test-student-id', // You'll need to replace with actual student ID
  studentName: 'Shashi',
  studentEmail: 'ssky5771@gmail.com',
  parentId: null, // Send to student directly
  progressData: {
    testsAttempted: 5,
    averageScore: 78,
    currentTotalScore: 1240,
    targetScore: 1600,
    weeklyGoal: 150,
    streakDays: 7,
    practiceTime: 12.5, // hours
    weakAreas: ['Algebra', 'Geometry'],
    strongAreas: ['Reading Comprehension', 'Grammar'],
    upcomingTests: [
      {
        testName: 'Full Practice Test #3',
        dueDate: '2026-04-05T23:59:59Z',
        priority: 'high'
      }
    ]
  }
};

async function sendTestWeeklyReport() {
  try {
    console.log('📧 Sending test weekly report to Shashi...');
    
    const response = await axios.post(`${API_BASE}/notifications/send-weekly-progress`, {
      studentId: testStudentData.studentId,
      parentId: testStudentData.parentId,
      customEmail: testStudentData.studentEmail, // Override email for testing
      includeDetails: true
    });

    if (response.data.success) {
      console.log('✅ Weekly report sent successfully to Shashi!');
      console.log('📊 Report details:', response.data.results);
      console.log('📈 Progress data:', response.data.progressData);
    } else {
      console.error('❌ Failed to send weekly report:', response.data.error);
    }

  } catch (error) {
    console.error('💥 Error sending test weekly report:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

async function testDueDateNotifications() {
  try {
    console.log('📅 Testing due date notifications...');
    
    // Test due date notification
    const dueDateResponse = await axios.post(`${API_BASE}/notifications/send-due-date-reminder`, {
      studentId: testStudentData.studentId,
      testName: 'Full Practice Test #3',
      dueDate: '2026-04-05T23:59:59Z',
      priority: 'high',
      customEmail: testStudentData.studentEmail
    });

    if (dueDateResponse.data.success) {
      console.log('✅ Due date notification sent successfully!');
      console.log('📅 Due date details:', dueDateResponse.data.dueDateInfo);
    } else {
      console.error('❌ Failed to send due date notification:', dueDateResponse.data.error);
    }

  } catch (error) {
    console.error('💥 Error sending due date notification:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

async function checkParentNotifications() {
  try {
    console.log('👨‍👩‍👧‍👦 Testing parent notifications...');
    
    // Test parent notification for checking purposes
    const parentResponse = await axios.post(`${API_BASE}/notifications/send-weekly-progress`, {
      studentId: testStudentData.studentId,
      parentId: 'test-parent-id', // You'll need to replace with actual parent ID
      customEmail: 'ssky5771@gmail.com', // Send to Shashi for testing
      includeDetails: true
    });

    if (parentResponse.data.success) {
      console.log('✅ Parent notification sent successfully!');
      console.log('👨‍👩‍👧‍👦 Parent report details:', parentResponse.data.results);
    } else {
      console.error('❌ Failed to send parent notification:', parentResponse.data.error);
    }

  } catch (error) {
    console.error('💥 Error sending parent notification:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting weekly report and due date notification tests...');
  console.log('📧 Target email: ssky5771@gmail.com (Shashi)');
  console.log('=' .repeat(60));
  
  // Test 1: Send weekly report to Shashi
  await sendTestWeeklyReport();
  
  console.log('\n' + '=' .repeat(60));
  
  // Test 2: Send due date notification
  await testDueDateNotifications();
  
  console.log('\n' + '=' .repeat(60));
  
  // Test 3: Test parent notifications (for checking parents)
  await checkParentNotifications();
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ All tests completed!');
  console.log('📧 Check ssky5771@gmail.com for the weekly report email');
  console.log('📅 Check for due date notifications');
  console.log('👨‍👩‍👧‍👦 Check parent notification system');
}

// Run the tests
main().catch(console.error);
