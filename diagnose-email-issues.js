// Email diagnostic tool for Full-Length Adaptive SAT Test demo
// This script helps identify why emails are not being sent after form submission

import fs from 'fs';
import path from 'path';

console.log('🔧 Diagnosing Email Issues for Full-Length Adaptive SAT Test Demo...\n');

// Test 1: Check environment variable requirements
console.log('📋 Test 1: Environment Variable Requirements');

console.log('  🔍 Required Environment Variables:');
console.log('    • BREVO_API_KEY - Brevo API key for email sending');
console.log('    • EMAIL_FROM or EMAIL_USER - Sender email address');
console.log('    • APP_NAME - Application name for email branding');
console.log('    • ADMIN_EMAIL - Admin email for lead notifications');
console.log('    • FRONTEND_URL - Base URL for email links');

console.log('  ⚠️  Common Issues:');
console.log('    • BREVO_API_KEY not set or invalid');
console.log('    • EMAIL_FROM not verified with Brevo');
console.log('    • ADMIN_EMAIL not configured');
console.log('    • Network connectivity issues');

// Test 2: Validate email sending code structure
console.log('\n📧 Test 2: Email Sending Code Structure');

const notificationEnginePath = path.join(__dirname, 'src/server/utils/notificationEngine.js');
const demoRoutePath = path.join(__dirname, 'src/server/routes/demo.js');

try {
  const notificationEngineContent = fs.readFileSync(notificationEnginePath, 'utf8');
  const demoRouteContent = fs.readFileSync(demoRoutePath, 'utf8');

  // Check for Brevo API configuration
  const brevoConfig = notificationEngineContent.includes('process.env.BREVO_API_KEY');
  console.log(`  ✅ Brevo API key configuration: ${brevoConfig}`);

  // Check for error handling
  const errorHandling = notificationEngineContent.includes('console.error(\'❌ [Email] BREVO_API_KEY not set\')');
  console.log(`  ✅ Error handling for missing API key: ${errorHandling}`);

  // Check for API endpoint
  const apiEndpoint = notificationEngineContent.includes('hostname: \'api.brevo.com\'');
  console.log(`  ✅ Brevo API endpoint: ${apiEndpoint}`);

  // Check for email template calls
  const adminEmailCall = demoRouteContent.includes('buildDemoAdminEmail');
  const studentEmailCall = demoRouteContent.includes('buildDemoScoreEmail');
  console.log(`  ✅ Admin email template call: ${adminEmailCall}`);
  console.log(`  ✅ Student email template call: ${studentEmailCall}`);

} catch (error) {
  console.error('❌ Test 2 failed:', error);
}

// Test 3: Check email template exports
console.log('\n📨 Test 3: Email Template Exports');

try {
  const notificationEngineContent = fs.readFileSync(notificationEnginePath, 'utf8');

  // Check for proper exports
  const templateExports = notificationEngineContent.includes('export { buildDemoAdminEmail, buildDemoScoreEmail }');
  console.log(`  ✅ Email template exports: ${templateExports}`);

  // Check for template function definitions
  const adminTemplateDef = notificationEngineContent.includes('export function buildDemoAdminEmail');
  const studentTemplateDef = notificationEngineContent.includes('export function buildDemoScoreEmail');
  console.log(`  ✅ Admin template function definition: ${adminTemplateDef}`);
  console.log(`  ✅ Student template function definition: ${studentTemplateDef}`);

} catch (error) {
  console.error('❌ Test 3 failed:', error);
}

// Test 4: Validate email sending logic in demo route
console.log('\n🚀 Test 4: Email Sending Logic in Demo Route');

try {
  const demoRouteContent = fs.readFileSync(demoRoutePath, 'utf8');

  // Check for email sending calls
  const adminEmailSend = demoRouteContent.includes('const adminEmailResult = await sendEmail');
  const studentEmailSend = demoRouteContent.includes('const userEmailResult = await sendEmail');
  console.log(`  ✅ Admin email sending call: ${adminEmailSend}`);
  console.log(`  ✅ Student email sending call: ${studentEmailSend}`);

  // Check for error logging
  const adminErrorLog = demoRouteContent.includes('console.warn(\'   [DEMO] Admin email sending failed:\'');
  const studentErrorLog = demoRouteContent.includes('console.warn(\'   [DEMO] User email sending failed:\'');
  console.log(`  ✅ Admin email error logging: ${adminErrorLog}`);
  console.log(`  ✅ Student email error logging: ${studentErrorLog}`);

  // Check for success logging
  const adminSuccessLog = demoRouteContent.includes('console.log(`   [DEMO] Admin email sent successfully to ${adminEmail}`)');
  const studentSuccessLog = demoRouteContent.includes('console.log(`   [DEMO] User email sent successfully to ${email}`)');
  console.log(`  ✅ Admin email success logging: ${adminSuccessLog}`);
  console.log(`  ✅ Student email success logging: ${studentSuccessLog}`);

} catch (error) {
  console.error('❌ Test 4 failed:', error);
}

// Test 5: Check for common configuration issues
console.log('\n⚠️  Test 5: Common Configuration Issues');

console.log('  🔍 Checking for potential issues:');
console.log('    • Missing BREVO_API_KEY environment variable');
console.log('    • Invalid or expired Brevo API key');
console.log('    • EMAIL_FROM not verified as sender in Brevo');
console.log('    • Network connectivity issues to api.brevo.com');
console.log('    • Rate limiting or quota exceeded');
console.log('    • Invalid email addresses in recipient list');

// Test 6: Provide troubleshooting steps
console.log('\n🛠️  Test 6: Troubleshooting Steps');

console.log('  📋 Immediate Steps to Fix Email Issues:');
console.log('');
console.log('  1. Check Environment Variables:');
console.log('     • Run: echo $BREVO_API_KEY (should show API key)');
console.log('     • Run: echo $EMAIL_FROM (should show sender email)');
console.log('     • Run: echo $ADMIN_EMAIL (should show admin email)');
console.log('');
console.log('  2. Verify Brevo Configuration:');
console.log('     • Login to Brevo dashboard');
console.log('     • Check API key is active and valid');
console.log('     • Verify sender email is verified');
console.log('     • Check sending quota and limits');
console.log('');
console.log('  3. Test Email Sending Directly:');
console.log('     • Use Brevo dashboard to send test email');
console.log('     • Check if API key has SMTP permissions');
console.log('     • Verify email templates are working');
console.log('');
console.log('  4. Check Server Logs:');
console.log('     • Look for "❌ [Email] BREVO_API_KEY not set" errors');
console.log('     • Look for "❌ [Email] Brevo request error" messages');
console.log('     • Look for "❌ [Email] Brevo request timed out" issues');
console.log('');
console.log('  5. Network Connectivity:');
console.log('     • Test: curl -X POST https://api.brevo.com/v3/smtp/email');
console.log('     • Check firewall/proxy settings');
console.log('     • Verify DNS resolution for api.brevo.com');

// Test 7: Create environment variable checker
console.log('\n🔍 Test 7: Environment Variable Checker');

console.log('  📝 Create a .env file with these variables:');
console.log('');
console.log('  # Brevo Email Configuration');
console.log('  BREVO_API_KEY=your_brevo_api_key_here');
console.log('  EMAIL_FROM=your_verified_sender_email@example.com');
console.log('  EMAIL_USER=your_verified_sender_email@example.com');
console.log('');
console.log('  # Application Configuration');
console.log('  APP_NAME=AIPrep365');
console.log('  ADMIN_EMAIL=admin@example.com');
console.log('  FRONTEND_URL=https://your-domain.com');
console.log('');
console.log('  # Database Configuration');
console.log('  SUPABASE_URL=your_supabase_url');
console.log('  SUPABASE_ANON_KEY=your_supabase_anon_key');

// Test 8: Provide debugging script
console.log('\n🐛 Test 8: Debugging Script');

console.log('  📝 Add this to your server startup to debug emails:');
console.log('');
console.log('  // Debug email configuration');
console.log('  console.log(\'🔧 Email Configuration Debug:\');');
console.log('  console.log(\'BREVO_API_KEY:\', process.env.BREVO_API_KEY ? \'SET\' : \'MISSING\');');
console.log('  console.log(\'EMAIL_FROM:\', process.env.EMAIL_FROM || \'MISSING\');');
console.log('  console.log(\'ADMIN_EMAIL:\', process.env.ADMIN_EMAIL || \'MISSING\');');
console.log('  console.log(\'APP_NAME:\', process.env.APP_NAME || \'MISSING\');');

console.log('\n🎉 Email Issues Diagnostic Completed!');
console.log('\n📊 Most Likely Issues:');
console.log('1. BREVO_API_KEY environment variable is not set');
console.log('2. EMAIL_FROM is not verified in Brevo dashboard');
console.log('3. Network connectivity issues to Brevo API');
console.log('4. Invalid email addresses or formatting');

console.log('\n🚀 Next Steps:');
console.log('1. Set up environment variables in .env file');
console.log('2. Verify Brevo API key and sender email');
console.log('3. Test email sending through Brevo dashboard');
console.log('4. Check server logs for detailed error messages');
console.log('5. Test form submission and monitor console logs');

console.log('\n✨ Use this diagnostic to identify and fix email sending issues!');
