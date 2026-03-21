import dotenv from 'dotenv';
dotenv.config();
import { processOutboxOnce } from './src/server/utils/notificationOutbox.js';

async function runProcess() {
    console.log('--- Manually Running Outbox Processor ---');
    try {
        const result = await processOutboxOnce({ limit: 10 });
        console.log('Result:', result);
    } catch (error) {
        console.error('Processing failed:', error);
    }
}

runProcess();
