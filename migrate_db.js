import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function migrate() {
  console.log('🚀 Running migration to add admin_email column...');
  const { error } = await supabase.rpc('execute_sql', { 
    sql: 'ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS admin_email text;' 
  });
  
  if (error) {
    console.error('❌ Migration failed:', error);
    // If RPC is not available, we might be out of luck for direct DDL via client
  } else {
    console.log('✅ Column admin_email added successfully.');
  }
}

migrate();
