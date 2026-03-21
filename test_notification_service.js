import dotenv from 'dotenv';
dotenv.config();
import { sendEmail, sendSMS, sendWhatsApp } from './src/server/utils/notificationService.js';

async function testNotifications() {
    const testEmail = process.env.EMAIL_USER; // Send to self
    const testPhone = '+918466858101'; // Assuming a test number, or from env

    console.log('--- Testing Notifications ---');
    console.log('Email User:', process.env.EMAIL_USER);
    console.log('Twilio SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ Present' : '❌ Missing');

    if (testEmail) {
        console.log('\nSending test email...');
        const emailOk = await sendEmail({
            to: testEmail,
            subject: 'Test Notification from AI Tutor',
            html: '<h1>Success!</h1><p>This is a test notification.</p>',
            text: 'Success! This is a test notification.'
        });
        console.log('Email Result:', emailOk ? '✅ Sent' : '❌ Failed');
    }

    if (testPhone && process.env.TWILIO_PHONE_NUMBER) {
        console.log('\nSending test SMS...');
        const smsOk = await sendSMS({
            to: testPhone,
            message: 'Test SMS from AI Tutor'
        });
        console.log('SMS Result:', smsOk ? '✅ Sent' : '❌ Failed');
    }

    if (testPhone && process.env.TWILIO_WHATSAPP_NUMBER) {
        console.log('\nSending test WhatsApp...');
        const waOk = await sendWhatsApp({
            to: testPhone,
            message: 'Test WhatsApp from AI Tutor'
        });
        console.log('WhatsApp Result:', waOk ? '✅ Sent' : '❌ Failed');
    }
}

testNotifications();
