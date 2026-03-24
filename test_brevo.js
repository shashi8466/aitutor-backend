import dotenv from 'dotenv';
import { sendEmail } from './src/server/utils/notificationService.js';
dotenv.config();

async function test() {
    console.log("Testing email via Brevo...");
    const res = await sendEmail({
        to: 'ssky57771@gmail.com',  // Self-test
        subject: 'Brevo Test Report',
        html: `
            <h2>Test Report</h2>
            <p><strong>Name:</strong> Shashi</p>
            <p><strong>Score:</strong> 95%</p>
            <p><strong>Status:</strong> Pass</p>
        `
    });
    console.log("Result:", res);
}

test();
