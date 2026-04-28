/**
 * Email Configuration Test Script
 * Run this to verify your Brevo email setup is working
 * 
 * Usage: node test-email-config.js
 */

import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

console.log('\n🔍 Testing Email Configuration...\n');

// Step 1: Check environment variables
console.log('📋 Step 1: Environment Variables');
console.log('='.repeat(60));

const brevoKey = process.env.BREVO_API_KEY;
const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'ssky57771@gmail.com';
const adminEmail = process.env.ADMIN_EMAIL || 'ssky57771@gmail.com';

console.log(`BREVO_API_KEY: ${brevoKey ? '✅ SET (' + brevoKey.substring(0, 10) + '...)' : '❌ MISSING'}`);
console.log(`EMAIL_FROM: ${emailFrom ? '✅ ' + emailFrom : '❌ MISSING'}`);
console.log(`ADMIN_EMAIL: ${adminEmail ? '✅ ' + adminEmail : '❌ MISSING'}`);

if (!brevoKey) {
    console.error('\n❌ ERROR: BREVO_API_KEY is not set!');
    console.error('   Please set it in your .env file or Render dashboard.');
    process.exit(1);
}

// Step 2: Test API key validity
console.log('\n📋 Step 2: Testing Brevo API Key...');
console.log('='.repeat(60));

const testPayload = JSON.stringify({
    sender: { email: emailFrom, name: 'Test' },
    to: [{ email: emailFrom }],
    subject: 'API Key Test',
    htmlContent: '<p>If you see this, your API key is valid!</p>'
});

const options = {
    hostname: 'api.brevo.com',
    path: '/v3/smtp/email',
    method: 'POST',
    headers: {
        'api-key': brevoKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testPayload)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Response Status: ${res.statusCode}`);
        
        if (res.statusCode === 201) {
            console.log('✅ API Key is VALID!');
            console.log('✅ Email sending is working!');
            console.log('\n📧 Test email sent to: ' + emailFrom);
            console.log('   Please check your inbox (and spam folder)');
            console.log('\n✨ Your email configuration is correct!');
        } else {
            console.error('❌ API Key test FAILED');
            console.error(`Status: ${res.statusCode}`);
            console.error(`Response: ${data}`);
            
            try {
                const parsed = JSON.parse(data);
                console.error('\n💡 Troubleshooting:');
                
                if (res.statusCode === 400) {
                    if (parsed.message?.includes('sender')) {
                        console.error('   - Sender email is not verified in Brevo');
                        console.error('   - Go to Brevo Dashboard > Senders & IP > Senders');
                        console.error('   - Add and verify: ' + emailFrom);
                    }
                } else if (res.statusCode === 401) {
                    console.error('   - API key is invalid or expired');
                    console.error('   - Generate a new key at: https://app.brevo.com/settings/keys/api');
                } else if (res.statusCode === 403) {
                    console.error('   - API key lacks SMTP permissions');
                    console.error('   - Check your Brevo plan and API key settings');
                }
            } catch (e) {}
        }
    });
});

req.on('error', (err) => {
    console.error('❌ Request failed:', err.message);
});

req.write(testPayload);
req.end();

console.log('\n⏳ Waiting for Brevo API response...');
