// Simple email testing script for debugging email sending issues
// Run this script to test if email configuration is working

import https from 'https';

// Test email sending function
async function testEmailSending() {
    console.log('🔧 Testing Email Sending Configuration...\n');

    // Check environment variables
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'ssky57771@gmail.com';
    const adminEmail = process.env.ADMIN_EMAIL || 'ssky57771@gmail.com';

    console.log('📋 Environment Variables Check:');
    console.log(`  BREVO_API_KEY: ${apiKey ? '✅ SET' : '❌ MISSING'}`);
    console.log(`  EMAIL_FROM: ${senderEmail}`);
    console.log(`  ADMIN_EMAIL: ${adminEmail}`);

    if (!apiKey) {
        console.error('\n❌ BREVO_API_KEY is not set. Please set this environment variable.');
        return false;
    }

    console.log('\n📧 Testing Brevo API Connection...');

    // Test email payload
    const testPayload = {
        sender: {
            email: senderEmail,
            name: 'AIPrep365 Test'
        },
        to: [{ email: adminEmail }],
        subject: '🧪 Email Configuration Test',
        htmlContent: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
                <h2 style="color: #333;">Email Configuration Test</h2>
                <p>This is a test email to verify that the Brevo API integration is working correctly.</p>
                <p>If you receive this email, the configuration is working!</p>
                <p>Timestamp: ${new Date().toISOString()}</p>
                <hr style="margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">Sent from AIPrep365 Email Testing Script</p>
            </div>
        `
    };

    const body = JSON.stringify(testPayload);

    try {
        const result = await new Promise((resolve, reject) => {
            const req = https.request(
                {
                    hostname: 'api.brevo.com',
                    path: '/v3/smtp/email',
                    method: 'POST',
                    headers: {
                        'api-key': apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Content-Length': Buffer.byteLength(body),
                    },
                    timeout: 15000
                },
                (res) => {
                    let data = '';
                    res.on('data', chunk => (data += chunk));
                    res.on('end', () => {
                        let parsed = {};
                        try { 
                            parsed = JSON.parse(data); 
                        } catch(e) {
                            console.log('Raw response:', data);
                        }

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            console.log('✅ Email sent successfully!');
                            console.log(`   Message ID: ${parsed.messageId}`);
                            console.log(`   To: ${adminEmail}`);
                            resolve({ ok: true, id: parsed.messageId });
                        } else {
                            console.error(`❌ Brevo API Error ${res.statusCode}:`);
                            console.error(`   Response: ${parsed.message || data}`);
                            resolve({ ok: false, error: `Brevo ${res.statusCode}: ${parsed.message || data}` });
                        }
                    });
                }
            );

            req.on('error', (err) => {
                console.error('❌ Network Error:', err.message);
                reject({ ok: false, error: err.message });
            });

            req.on('timeout', () => {
                req.destroy();
                console.error('❌ Request timed out');
                reject({ ok: false, error: 'Request timed out' });
            });

            req.write(body);
            req.end();
        });

        return result;

    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return { ok: false, error: error.message };
    }
}

// Run the test
if (require.main === module) {
    testEmailSending()
        .then(result => {
            if (result.ok) {
                console.log('\n🎉 Email configuration is working correctly!');
                console.log('   Check your inbox for the test email.');
            } else {
                console.log('\n❌ Email configuration has issues:');
                console.log(`   Error: ${result.error}`);
                console.log('\n🔧 Troubleshooting steps:');
                console.log('   1. Verify BREVO_API_KEY is correct and active');
                console.log('   2. Check EMAIL_FROM is verified in Brevo dashboard');
                console.log('   3. Ensure network connectivity to api.brevo.com');
                console.log('   4. Check Brevo account quota and limits');
            }
        })
        .catch(error => {
            console.error('❌ Unexpected error:', error);
        });
}

export { testEmailSending };
