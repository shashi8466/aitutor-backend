
require('dotenv').config();
const { sendEmail } = require('./src/server/utils/notificationService.js');

async function testLink() {
    console.log('📬 Sending test notification to check production link...');
    const result = await sendEmail({
        to: 'ssky57771@gmail.com',
        subject: '🔔 Production Link Verification',
        text: 'The production link has been updated to https://aitutor-4431c.web.app',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Link Updated!</h2>
                <p>Hello,</p>
                <p>I have updated your production link to <b>https://aitutor-4431c.web.app</b>.</p>
                <p>The button below should now point to your live site:</p>
                <a href="https://aitutor-4431c.web.app/dashboard" 
                   style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                   View Full Report →
                </a>
            </div>
        `
    });
    console.log(result ? '✅ Test email sent!' : '❌ Failed to send test email.');
}
testLink();
