
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkAdmin() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: admins, error } = await supabase.from('profiles').select('*').eq('role', 'admin');
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Admins found:', admins.length);
    admins.forEach(a => {
      console.log(`- ${a.name} (${a.email}) [ID: ${a.id}]`);
    });
  }
}

checkAdmin();
