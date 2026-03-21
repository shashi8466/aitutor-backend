// ============================================
// QUICK NOTIFICATION TEST SCRIPT
// Run this after deployment to verify everything works
// ============================================

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('🧪 Starting Quick Notification Test...\n');

// Configuration - UPDATE THESE WITH REAL DATA
const CONFIG = {
  studentEmail: 'shashi@example.com',  // Replace with real student email
  studentPhone: '+918466924574',       // Replace with real phone
  studentName: 'Shashi',
  parentEmail: 'parent@example.com',   // Replace with parent email
  parentPhone: '+918466924575',        // Replace if different
  courseName: 'SAT Math Prep',
  testName: 'Algebra Fundamentals Quiz'
};

// Test 1: Check Environment Variables
console.log('📝 Step 1: Checking Environment Variables...');
const requiredEnvVars = [
  'EMAIL_USER',
  'EMAIL_PASS',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'APP_URL'
];

let envOk = true;
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Missing: ${varName}`);
    envOk = false;
  } else {
    console.log(`✅ ${varName} is set`);
  }
});

if (!envOk) {
  console.error('\n❌ Please set missing environment variables in .env file');
  process.exit(1);
}

console.log('\n✅ All required environment variables are set\n');

// Test 2: Import Services
console.log('📝 Step 2: Loading Notification Services...');
let NotificationService, NotificationTemplates;

try {
  const notificationModule = await import('./src/server/services/NotificationService.js');
  NotificationService = notificationModule.default || notificationModule;
  console.log('✅ NotificationService loaded');
  
  const templatesModule = await import('./src/server/services/NotificationTemplates.js');
  NotificationTemplates = templatesModule.default || templatesModule;
  console.log('✅ NotificationTemplates loaded\n');
} catch (error) {
  console.error('❌ Failed to load services:', error.message);
  console.error('Make sure backend dependencies are installed: npm install');
  process.exit(1);
}

// Test 3: Generate Templates
console.log('📝 Step 3: Testing Template Generation...');

try {
  // Test Completion Template
  const testCompletionTemplate = NotificationTemplates.getTestCompletionTemplate(
    CONFIG.studentName,
    CONFIG.testName,
    85,  // score
    100, // totalScore
    85,  // percentage
    'Parent Name'  // for parent template
  );
  
  console.log('✅ Test Completion Template generated');
  console.log(`   Student Email Subject: ${testCompletionTemplate.emailSubject}`);
  console.log(`   SMS Length: ${testCompletionTemplate.smsMessage.length} chars`);
  
  // Weekly Progress Template
  const weeklyProgressData = {
    testsAttempted: 5,
    averageScore: 78,
    lessonsCompleted: 12,
    studyHours: 6,
    currentMathScore: 650,
    currentRWScore: 720,
    currentTotalScore: 1370,
    courseProgress: [
      { name: 'SAT Math', score: 650, progress: 75 },
      { name: 'SAT Reading', score: 720, progress: 80 }
    ],
    achievements: ['Completed 5 tests!', '78% average maintained'],
    recommendations: ['Review algebra concepts', 'Practice timed reading']
  };
  
  const weeklyTemplate = NotificationTemplates.getWeeklyProgressTemplate(
    CONFIG.studentName,
    weeklyProgressData
  );
  
  console.log('✅ Weekly Progress Template generated');
  console.log(`   Email Subject: ${weeklyTemplate.emailSubject}`);
  console.log(`   Email HTML Length: ${weeklyTemplate.emailHtml.length} chars\n`);
  
} catch (error) {
  console.error('❌ Template generation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// Test 4: Send Test Email (Optional)
console.log('📝 Step 4: Email Delivery Test (Optional)...');
console.log('Skip this step? Press Ctrl+C now\n');
await new Promise(resolve => setTimeout(resolve, 3000));

try {
  const notificationService = new NotificationService();
  
  console.log('Sending test email to:', CONFIG.studentEmail);
  
  const result = await notificationService.sendEmail(
    CONFIG.studentEmail,
    `TEST: ${CONFIG.testName} Results`,
    `<h1>Test Email</h1><p>This is a test notification.</p><p>If you receive this, email delivery is working!</p>`
  );
  
  if (result.success) {
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${result.messageId}\n`);
  } else {
    console.error('❌ Email failed:', result.error, '\n');
  }
} catch (error) {
  console.error('❌ Email test error:', error.message, '\n');
}

// Test 5: Send Test SMS (Optional - costs money)
console.log('📝 Step 5: SMS Delivery Test (Optional - requires Twilio credit)...');
console.log('Skip this step? Press Ctrl+C now\n');
await new Promise(resolve => setTimeout(resolve, 3000));

try {
  const notificationService = new NotificationService();
  
  console.log('Sending test SMS to:', CONFIG.studentPhone);
  
  const result = await notificationService.sendSMS(
    CONFIG.studentPhone,
    `TEST: This is a test message from ${process.env.APP_NAME || 'AI Tutor Platform'}`
  );
  
  if (result.success) {
    console.log('✅ SMS sent successfully!');
    console.log(`   Message SID: ${result.messageSid}\n`);
  } else {
    console.error('❌ SMS failed:', result.error, '\n');
  }
} catch (error) {
  console.error('❌ SMS test error:', error.message, '\n');
}

// Final Summary
console.log('==========================================');
console.log('📊 TEST SUMMARY');
console.log('==========================================');
console.log('Environment Variables:', envOk ? '✅ OK' : '❌ Missing');
console.log('Services Loaded:', NotificationService && NotificationTemplates ? '✅ OK' : '❌ Failed');
console.log('Templates Generated:', '✅ OK');
console.log('Email Delivery:', '⚠️ Check inbox');
console.log('SMS Delivery:', '⚠️ Check phone');
console.log('==========================================\n');

console.log('💡 NEXT STEPS:');
console.log('');
console.log('1. Check email inbox for test message');
console.log('   → Should arrive within 1-2 minutes');
console.log('   → Check spam folder if not in inbox');
console.log('');
console.log('2. Check phone for SMS (if sent)');
console.log('   → Should show sender as Twilio or your number');
console.log('   → Verify message content is correct');
console.log('');
console.log('3. Test full workflow:');
console.log('   → Login as student');
console.log('   → Complete a test');
console.log('   → Verify automatic notifications arrive');
console.log('');
console.log('4. Parent notifications:');
console.log('   → Ensure parent is linked to student in database');
console.log('   → Repeat test completion');
console.log('   → Verify parent also receives notifications');
console.log('');
console.log('5. Weekly reports:');
console.log('   → Use admin panel to manually trigger');
console.log('   → Or wait for Monday 9 AM cron job');
console.log('');

console.log('✅ Quick test complete!\n');

// Export for use as module
export default {
  testEmail: async (email) => {
    const service = new NotificationService();
    return await service.sendEmail(email, 'Test', '<h1>Test</h1>');
  },
  testSMS: async (phone) => {
    const service = new NotificationService();
    return await service.sendSMS(phone, 'Test message');
  }
};
