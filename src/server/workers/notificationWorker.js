import dotenv from 'dotenv';
dotenv.config();

import { processOutboxOnce } from '../utils/notificationOutbox.js';

const intervalMs = Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS) || 15000;

console.log('🔔 Notification worker started');
console.log(`- interval: ${intervalMs}ms`);

async function tick() {
  try {
    const { processed } = await processOutboxOnce({ limit: 25 });
    if (processed > 0) {
      console.log(`✅ processed ${processed} notification(s)`);
    }
  } catch (err) {
    console.error('❌ worker tick error:', err?.message || err);
  }
}

setInterval(tick, intervalMs);
tick();

