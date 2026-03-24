/**
 * Quick test: Send an email using Gmail SMTP directly.
 * This bypasses custom SMTP to confirm Gmail route works.
 */
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testGmail() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASS;

    if (!user || !pass) {
        console.error('❌ GMAIL_USER or GMAIL_APP_PASS not set in .env');
        process.exit(1);
    }

    console.log(`📡 Testing Gmail SMTP as: ${user}`);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 15000,
        tls: { rejectUnauthorized: false }
    });

    try {
        await transporter.verify();
        console.log('✅ Gmail SMTP connection verified!');

        const info = await transporter.sendMail({
            from: `"AI Tutor Platform" <${user}>`,
            to: user,  // send to self as test
            subject: 'AI Tutor Platform — Gmail SMTP Test',
            html: `<h2>✅ Gmail SMTP is working!</h2>
                   <p>This test confirms your Gmail SMTP is correctly configured and can send emails.</p>
                   <p>Emails will now route through Gmail when your custom SMTP is unavailable.</p>`
        });

        console.log(`✅ Test email sent! MessageId: ${info.messageId}`);
        console.log(`📬 Check your inbox at: ${user}`);
    } catch (err) {
        console.error('❌ Gmail SMTP Error:', err.message);
        if (err.message.includes('Invalid login')) {
            console.error('👉 Tip: Make sure GMAIL_APP_PASS is a Google App Password (not your regular Gmail password).');
            console.error('   Generate one at: https://myaccount.google.com/apppasswords');
        }
    }
}

testGmail().catch(console.error);
