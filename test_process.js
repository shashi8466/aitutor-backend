
import { processOutboxOnce } from './src/server/utils/notificationOutbox.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log('🔄 Running outbox processor...');
    const result = await processOutboxOnce({ limit: 5 });
    console.log('✅ Result:', JSON.stringify(result, null, 2));
}
run();
