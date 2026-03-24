
const nodemailer = require('nodemailer');

async function testGmail() {
    console.log("Testing Gmail App Password...");
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'ssky57771@gmail.com',
            pass: 'hxlhrbzchvlugvud'
        },
        connectionTimeout: 10000
    });

    try {
        await transporter.verify();
        console.log("✅ Gmail SMTP Connection Verified!");
        
        const info = await transporter.sendMail({
            from: '"AI Tutor Test" <ssky57771@gmail.com>',
            to: 'ssky57771@gmail.com',
            subject: '✅ Test Email - AI Tutor Notification System',
            html: '<h2>🎉 It Works!</h2><p>Email notifications are now configured correctly via Gmail SMTP.</p>'
        });
        console.log("✅ Test Email Sent! MessageId:", info.messageId);
    } catch (err) {
        console.error("❌ Gmail SMTP Failed:", err.message);
        if (err.message.includes('Invalid login')) {
            console.log("→ The App Password may be incorrect. Check https://myaccount.google.com/apppasswords");
        }
    }
}

testGmail();
