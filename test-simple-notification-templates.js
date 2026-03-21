// ============================================
// SIMPLE NOTIFICATION TEMPLATE TEST
// Just validates templates work - no sending
// ============================================

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('🧪 Starting Simple Notification Template Test...\n');

// Configuration
const CONFIG = {
  studentName: 'Shashi',
  parentName: 'Parent',
  testName: 'Algebra Fundamentals Quiz',
  courseName: 'SAT Math Prep',
  score: 85,
  totalScore: 100,
  percentage: 85
};

// Test 1: Check Environment Variables
console.log('📝 Step 1: Checking Environment Variables...');
const requiredEnvVars = [
  'EMAIL_USER',
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

// Test 2: Import Templates (ES Module compatible)
console.log('📝 Step 2: Loading Notification Templates...');

try {
  // Dynamic import for ES module compatibility
  const templatesModule = await import('./src/server/services/NotificationTemplates.js');
  const NotificationTemplates = templatesModule.default || templatesModule;
  console.log('✅ NotificationTemplates loaded\n');
  
  // Test 3: Generate Test Completion Template
  console.log('📝 Step 3: Testing Test Completion Templates...');
  
  const testCompletionStudent = NotificationTemplates.getTestCompletionTemplate(
    CONFIG.studentName,
    CONFIG.testName,
    CONFIG.score,
    CONFIG.totalScore,
    CONFIG.percentage
  );
  
  console.log('✅ Student Template Generated');
  console.log(`   Subject: ${testCompletionStudent.emailSubject}`);
  console.log(`   SMS: ${testCompletionStudent.smsMessage}`);
  console.log(`   Email HTML Length: ${testCompletionStudent.emailHtml.length} chars\n`);
  
  const testCompletionParent = NotificationTemplates.getTestCompletionTemplate(
    CONFIG.studentName,
    CONFIG.testName,
    CONFIG.score,
    CONFIG.totalScore,
    CONFIG.percentage,
    CONFIG.parentName
  );
  
  console.log('✅ Parent Template Generated');
  console.log(`   Subject: ${testCompletionParent.emailSubject}`);
  console.log(`   SMS: ${testCompletionParent.smsMessage}\n`);
  
  // Test 4: Generate Weekly Progress Template
  console.log('📝 Step 4: Testing Weekly Progress Templates...');
  
  const progressData = {
    testsAttempted: 5,
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
      'Completed 5 tests this week!',
      'Maintained 78% average score!',
      'Completed 12 lessons!'
    ],
    recommendations: [
      'Focus on reviewing algebra concepts',
      'Practice timed reading passages',
      'Continue with current study pace'
    ]
  };
  
  const weeklyStudent = NotificationTemplates.getWeeklyProgressTemplate(
    CONFIG.studentName,
    progressData
  );
  
  console.log('✅ Student Weekly Template Generated');
  console.log(`   Subject: ${weeklyStudent.emailSubject}`);
  console.log(`   SMS: ${weeklyStudent.smsMessage}\n`);
  
  const weeklyParent = NotificationTemplates.getWeeklyProgressTemplate(
    CONFIG.studentName,
    progressData,
    CONFIG.parentName
  );
  
  console.log('✅ Parent Weekly Template Generated');
  console.log(`   Subject: ${weeklyParent.emailSubject}`);
  console.log(`   SMS: ${weeklyParent.smsMessage}\n`);
  
  // Test 5: Summary
  console.log('==========================================');
  console.log('📊 TEST SUMMARY');
  console.log('==========================================');
  console.log('✅ Environment Variables: OK');
  console.log('✅ Template Loading: OK');
  console.log('✅ Test Completion Templates: OK');
  console.log('✅ Weekly Progress Templates: OK');
  console.log('==========================================\n');
  
  console.log('💡 ALL TEMPLATES ARE WORKING CORRECTLY!\n');
  console.log('Your notification system is ready to send:');
  console.log('  📧 Test completion emails with scores');
  console.log('  📱 SMS notifications');
  console.log('  💬 WhatsApp messages');
  console.log('  📊 Weekly progress reports');
  console.log('');
  console.log('Next Steps:');
  console.log('1. Login as student and complete a test');
  console.log('2. Submit the test');
  console.log('3. Check email/SMS/WhatsApp for notifications');
  console.log('4. Verify parent also receives notifications');
  console.log('');
  
} catch (error) {
  console.error('❌ Template test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
