import dotenv from 'dotenv';
dotenv.config();
import { sendEmail } from './src/server/utils/notificationService.js';

async function run() {
    console.log("Testing email send...");
    const res = await sendEmail({
        to: 'ssky57771@gmail.com', // Replace with the actual recipient
        subject: 'Test Resend',
        html: '<p>Test email</p>',
        text: 'Test email'
    });
    console.log("Result:", res);
}

run();
