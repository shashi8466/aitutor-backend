#!/usr/bin/env node

/**
 * Notification System Test Script
 * Test all notification channels and functionality
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import notification service
import NotificationService from '../src/server/services/NotificationService.js';
import NotificationTemplates from '../src/server/services/NotificationTemplates.js';

console.log('🔔 Testing Notification System\n');

// Test configuration
const testConfig = {
  email: 'test@example.com', // Replace with your test email
  phone: '+1234567890',     // Replace with your test phone
  studentName: 'Test Student',
  testName: 'SAT Math Practice Test',
  score: 85,
  totalScore: 100,
  percentage: 85
};

async function testEmailNotification() {
  console.log('📧 Testing Email Notification...');
  
  try {
    const notificationService = new NotificationService();
    const template = NotificationTemplates.getTestCompletionTemplate(
      testConfig.studentName,
      testConfig.testName,
      testConfig.score,
      testConfig.totalScore,
      testConfig.percentage
    );

    const result = await notificationService.sendEmail(
      testConfig.email,
      template.emailSubject,
      template.emailHtml
    );

    if (result.success) {
      console.log('✅ Email sent successfully');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ Email failed to send');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ Email test error:', error.message);
  }
  
  console.log('');
}

async function testSMSNotification() {
  console.log('📱 Testing SMS Notification...');
  
  try {
    const notificationService = new NotificationService();
    const template = NotificationTemplates.getTestCompletionTemplate(
      testConfig.studentName,
      testConfig.testName,
      testConfig.score,
      testConfig.totalScore,
      testConfig.percentage
    );

    const result = await notificationService.sendSMS(testConfig.phone, template.smsMessage);

    if (result.success) {
      console.log('✅ SMS sent successfully');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ SMS failed to send');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ SMS test error:', error.message);
  }
  
  console.log('');
}

async function testWhatsAppNotification() {
  console.log('💬 Testing WhatsApp Notification...');
  
  try {
    const notificationService = new NotificationService();
    const template = NotificationTemplates.getTestCompletionTemplate(
      testConfig.studentName,
      testConfig.testName,
      testConfig.score,
      testConfig.totalScore,
      testConfig.percentage
    );

    const result = await notificationService.sendWhatsApp(testConfig.phone, template.whatsappMessage);

    if (result.success) {
      console.log('✅ WhatsApp message sent successfully');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('❌ WhatsApp message failed to send');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ WhatsApp test error:', error.message);
  }
  
  console.log('');
}

async function testWeeklyProgressReport() {
  console.log('📊 Testing Weekly Progress Report Template...');
  
  try {
    const progressData = {
      testsAttempted: 3,
      averageScore: 78,
      lessonsCompleted: 12,
      studyHours: 6,
      currentMathScore: 650,
      currentRWScore: 720,
      currentTotalScore: 1370,
      courseProgress: [
        { name: 'SAT Math', score: 650, progress: 75 },
        { name: 'SAT Reading & Writing', score: 720, progress: 80 }
      ],
      achievements: [
        'Completed 3 tests this week!',
        'Maintained 78% average score!',
        'Completed 12 lessons!'
      ],
      recommendations: [
        'Focus on reviewing algebra concepts',
        'Practice timed reading passages',
        'Continue with current study pace'
      ]
    };

    const template = NotificationTemplates.getWeeklyProgressTemplate(
      testConfig.studentName,
      progressData
    );

    console.log('✅ Weekly progress template generated successfully');
    console.log(`   Subject: ${template.emailSubject}`);
    console.log(`   SMS Length: ${template.smsMessage.length} characters`);
    
    // Optionally send the email
    if (process.env.SEND_WEEKLY_TEST === 'true') {
      const notificationService = new NotificationService();
      const result = await notificationService.sendEmail(
        testConfig.email,
        template.emailSubject,
        template.emailHtml
      );
      
      if (result.success) {
        console.log('✅ Weekly progress email sent successfully');
      } else {
        console.log('❌ Weekly progress email failed:', result.error);
      }
    }
  } catch (error) {
    console.log('❌ Weekly progress test error:', error.message);
  }
  
  console.log('');
}

async function testDueDateReminder() {
  console.log('⏰ Testing Due Date Reminder Template...');
  
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const template = NotificationTemplates.getTestDueDateTemplate(
      testConfig.studentName,
      testConfig.testName,
      tomorrow.toISOString()
    );

    console.log('✅ Due date reminder template generated successfully');
    console.log(`   Subject: ${template.emailSubject}`);
    console.log(`   SMS Length: ${template.smsMessage.length} characters`);
    
    // Optionally send the email
    if (process.env.SEND_REMINDER_TEST === 'true') {
      const notificationService = new NotificationService();
      const result = await notificationService.sendEmail(
        testConfig.email,
        template.emailSubject,
        template.emailHtml
      );
      
      if (result.success) {
        console.log('✅ Due date reminder email sent successfully');
      } else {
        console.log('❌ Due date reminder email failed:', result.error);
      }
    }
  } catch (error) {
    console.log('❌ Due date reminder test error:', error.message);
  }
  
  console.log('');
}

function checkEnvironment() {
  console.log('🔍 Checking Environment Configuration...\n');
  
  const requiredVars = [
    'EMAIL_USER',
    'EMAIL_PASS',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_FROM_NUMBER'
  ];
  
  const optionalVars = [
    'WHATSAPP_FROM_NUMBER',
    'FRONTEND_URL'
  ];
  
  let allRequiredPresent = true;
  
  console.log('Required Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    const display = value ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : 'MISSING';
    console.log(`  ${status} ${varName}: ${display}`);
    if (!value) allRequiredPresent = false;
  });
  
  console.log('\nOptional Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '⚠️';
    const display = value || 'Not set';
    console.log(`  ${status} ${varName}: ${display}`);
  });
  
  console.log('\n');
  
  if (!allRequiredPresent) {
    console.log('❌ Some required environment variables are missing!');
    console.log('Please update your .env file with the missing values.');
    return false;
  }
  
  console.log('✅ All required environment variables are present!');
  return true;
}

async function runTests() {
  console.log('🚀 Starting Notification System Tests\n');
  
  // Check environment first
  const envOk = checkEnvironment();
  if (!envOk) {
    process.exit(1);
  }
  
  // Update test config from environment
  if (process.env.TEST_EMAIL) {
    testConfig.email = process.env.TEST_EMAIL;
  }
  if (process.env.TEST_PHONE) {
    testConfig.phone = process.env.TEST_PHONE;
  }
  
  console.log('Test Configuration:');
  console.log(`  Email: ${testConfig.email}`);
  console.log(`  Phone: ${testConfig.phone}`);
  console.log(`  Student: ${testConfig.studentName}`);
  console.log('');
  
  // Run tests
  await testEmailNotification();
  await testSMSNotification();
  await testWhatsAppNotification();
  await testWeeklyProgressReport();
  await testDueDateReminder();
  
  console.log('🎉 Notification System Tests Complete!');
  console.log('\nTo enable actual sending of test emails, set:');
  console.log('  SEND_WEEKLY_TEST=true');
  console.log('  SEND_REMINDER_TEST=true');
  console.log('\nTo customize test recipients, set:');
  console.log('  TEST_EMAIL=your-email@example.com');
  console.log('  TEST_PHONE=+1234567890');
}

// Run the tests
runTests().catch(console.error);
