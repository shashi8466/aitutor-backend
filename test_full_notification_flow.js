import dotenv from 'dotenv';
dotenv.config();
import notificationMiddleware from './src/server/middleware/notificationMiddleware.js';
import { processOutboxOnce } from './src/server/utils/notificationOutbox.js';

async function testFullFlow() {
    const studentId = '1535a7f6-94a7-4fdd-9558-516f48154819';
    const submissionId = 60; // Latest from our check

    console.log('--- Triggering Notification for Submission 60 ---');
    await notificationMiddleware.scheduler.triggerTestCompletionNotification(submissionId, studentId);

    console.log('\n--- Processing Outbox ---');
    const result = await processOutboxOnce({ limit: 10 });
    console.log('Processing Result:', result);
}

testFullFlow();
