import NotificationScheduler from './src/server/services/NotificationScheduler.js';
import { processOutboxOnce } from './src/server/utils/notificationOutbox.js';

const shashiId = '1535a7f6-94a7-4fdd-9558-516f48154819';
const scheduler = new NotificationScheduler();

async function run() {
  try {
    console.log('Sending weekly report...');
    await scheduler.sendManualWeeklyReport(shashiId);
    
    console.log('Sending due date reminder...');
    await scheduler.sendManualDueDateReminder(shashiId, 'SAT Advanced Practice', new Date(Date.now() + 86400000 * 3).toISOString());
    
    console.log('Processing outbox...');
    const result = await processOutboxOnce({ limit: 10 });
    console.log(`Processed ${result.processed} notifications.`);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
