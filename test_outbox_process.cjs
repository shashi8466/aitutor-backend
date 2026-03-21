
const { processOutboxOnce } = require('./src/server/utils/notificationOutbox.js');
require('dotenv').config();

async function testProcess() {
    console.log('🔄 Manually triggering notification outbox processing...');
    try {
        const result = await processOutboxOnce({ limit: 5 });
        console.log(`✅ Processed ${result.processed} notifications`);
        console.log(`   Detailed results:`, JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('❌ Process error:', err);
    }
}
testProcess();
