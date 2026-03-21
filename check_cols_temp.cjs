const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCols() {
  const tables = [
    'uploads',
    'test_submissions',
    'profiles',
    'questions',
    'knowledge_base',
    'notification_outbox',
    'notification_preferences',
    'groups_table'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Error checking table ${table}:`, error.message);
    } else {
      console.log(`${table} cols:`, Object.keys(data[0] || {}));
    }
  }
}
checkCols();
