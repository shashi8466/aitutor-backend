/**
 * Send Test Emails to Shashi
 * Sends weekly report and due date notification for testing
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Test data for Shashi
const shashiEmail = 'ssky5771@gmail.com';
const shashiName = 'Shashi';

async function sendTestEmails() {
  try {
    console.log('📧 Sending test emails to Shashi...');
    console.log('📧 Target email:', shashiEmail);
    console.log('=' .repeat(60));

    // Test 1: Send Weekly Report
    console.log('📊 1. Sending Weekly Report...');
    try {
      const weeklyResponse = await axios.post(`${API_BASE}/notifications/send-weekly-progress`, {
        studentId: 'test-student-shashi',
        customEmail: shashiEmail,
        includeDetails: true,
        progressData: {
          testsAttempted: 5,
          averageScore: 78,
          currentTotalScore: 1240,
          targetScore: 1600,
          weeklyGoal: 150,
          streakDays: 7,
          practiceTime: 12.5,
          weakAreas: ['Algebra', 'Geometry'],
          strongAreas: ['Reading Comprehension', 'Grammar'],
          achievements: ['Completed 5 tests this week!', 'Maintained 78% average score!'],
          recommendations: ['Focus on reviewing fundamentals where scores are lower'],
          upcomingTests: [
            {
              testName: 'Full Practice Test #3',
              dueDate: '2026-04-05T23:59:59Z',
              priority: 'high'
            }
          ]
        }
      });

      if (weeklyResponse.data.success) {
        console.log('✅ Weekly report sent successfully!');
        console.log('📊 Response:', weeklyResponse.data.message);
      } else {
        console.error('❌ Weekly report failed:', weeklyResponse.data.error);
      }
    } catch (error) {
      console.error('💥 Weekly report error:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }

    console.log('\n' + '=' .repeat(60));

    // Test 2: Send Due Date Notification
    console.log('📅 2. Sending Due Date Notification...');
    try {
      const dueDateResponse = await axios.post(`${API_BASE}/notifications/send-due-date-reminder`, {
        studentId: 'test-student-shashi',
        testName: 'Full Practice Test #3 - SAT Math & Reading',
        dueDate: '2026-04-05T23:59:59Z',
        priority: 'high',
        customEmail: shashiEmail,
        studentName: shashiName,
        daysUntilDue: 8,
        courseDetails: {
          subject: 'SAT Preparation',
          level: 'Advanced',
          duration: '3 hours'
        }
      });

      if (dueDateResponse.data.success) {
        console.log('✅ Due date notification sent successfully!');
        console.log('📅 Response:', dueDateResponse.data.message);
        console.log('📅 Due date info:', dueDateResponse.data.dueDateInfo);
      } else {
        console.error('❌ Due date notification failed:', dueDateResponse.data.error);
      }
    } catch (error) {
      console.error('💥 Due date notification error:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }

    console.log('\n' + '=' .repeat(60));

    // Test 3: Send Parent Notification (for checking parents)
    console.log('👨‍👩‍👧‍👦 3. Sending Parent Notification...');
    try {
      const parentResponse = await axios.post(`${API_BASE}/notifications/send-weekly-progress`, {
        studentId: 'test-student-shashi',
        parentId: 'test-parent-shashi',
        customEmail: shashiEmail, // Send to Shashi for testing
        includeDetails: true,
        progressData: {
          testsAttempted: 5,
          averageScore: 78,
          currentTotalScore: 1240,
          targetScore: 1600,
          weeklyGoal: 150,
          streakDays: 7,
          practiceTime: 12.5,
          weakAreas: ['Algebra', 'Geometry'],
          strongAreas: ['Reading Comprehension', 'Grammar'],
          achievements: ['Great progress this week!', 'Consistent practice schedule'],
          recommendations: ['Continue daily practice for best results'],
          upcomingTests: [
            {
              testName: 'Full Practice Test #3',
              dueDate: '2026-04-05T23:59:59Z',
              priority: 'high'
            }
          ]
        }
      });

      if (parentResponse.data.success) {
        console.log('✅ Parent notification sent successfully!');
        console.log('👨‍👩‍👧‍👦 Response:', parentResponse.data.message);
      } else {
        console.error('❌ Parent notification failed:', parentResponse.data.error);
      }
    } catch (error) {
      console.error('💥 Parent notification error:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 All test emails sent to Shashi!');
    console.log('📧 Check inbox:', shashiEmail);
    console.log('📊 Weekly Report: Should contain progress details and charts');
    console.log('📅 Due Date: Should contain test reminder with countdown');
    console.log('👨‍👩‍👧‍👦 Parent: Should contain child progress summary');
    console.log('⏰ Check spam folder if emails not in inbox');

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
}

// Simple form data simulation
function simulateFormData() {
  console.log('📝 Simulating form data submission...');
  console.log('📝 Student Name:', shashiName);
  console.log('📝 Email:', shashiEmail);
  console.log('📝 Weekly Report: Enabled');
  console.log('📝 Due Date: Enabled');
  console.log('📝 Parent Notification: Enabled');
  console.log('📝 Priority: High');
  console.log('=' .repeat(60));
  return true;
}

// Main execution
async function main() {
  console.log('🚀 Starting Email Test for Shashi');
  console.log('📧 Recipient: Shashi (ssky5771@gmail.com)');
  console.log('📊 Purpose: Test Weekly Report & Due Date Notifications');
  console.log('=' .repeat(60));

  // Simulate form data
  simulateFormData();

  // Send test emails
  await sendTestEmails();
}

// Run the test
main().catch(console.error);
