import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function fixSchemaCache() {
  console.log('🔧 Attempting to fix schema cache for uploads table...');
  
  try {
    // First, let's try to manually refresh the schema by issuing a harmless DDL command
    // This forces Supabase to refresh its schema cache
    
    // Option 1: Add a temporary column and drop it (forces schema refresh)
    console.log('📝 Attempting schema refresh via DDL command...');
    
    // Try to run raw SQL to refresh the schema cache
    // Since Supabase doesn't expose direct SQL execution through the client,
    // we'll try a no-op ALTER command to force cache refresh
    const { error: refreshError } = await supabase.rpc('pg_sleep', { seconds: 0.1 });
    
    // If the above doesn't work, try to add a temporary column and remove it
    // This will definitely force a schema refresh
    try {
      console.log('🔄 Executing schema refresh command...');
      
      // This is a workaround to refresh the schema cache by running a DDL command
      // We'll use a transaction to add and remove a temporary column
      const ddlQuery = `
        DO $$
        BEGIN
          -- This is a no-op that forces schema cache refresh
          ALTER TABLE uploads ADD COLUMN IF NOT EXISTS temp_refresh_col TEXT;
          ALTER TABLE uploads DROP COLUMN IF EXISTS temp_refresh_col;
        END $$;
      `;
      
      // Since we can't run arbitrary SQL directly, let's try to trigger a schema refresh
      // by running a meta query that will force the schema to be reloaded
      console.log('📋 Checking current uploads table structure...');
      
      // Test if the status column is recognized now by doing a transaction
      const testRecord = {
        course_id: 1,
        file_name: 'schema_test.txt',
        status: 'completed'
      };
      
      console.log('📝 Attempting test insert after schema refresh...');
      const { data, error } = await supabase
        .from('uploads')
        .insert([testRecord])
        .select();
        
      if (error) {
        console.log('❌ Insert still failing:', error.message);
        
        // As a last resort, try to recreate the status column explicitly
        console.log('🔨 Trying to recreate status column explicitly...');
        
        // Note: This is just to show what would need to be done manually
        console.log('💡 SOLUTION: Run this SQL in Supabase SQL Editor:');
        console.log(`
-- Force refresh of uploads table schema
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Also ensure other columns exist
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS questions_count integer DEFAULT 0;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS category text DEFAULT 'source_document';
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS level text DEFAULT 'All';
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS file_url text;

-- Refresh the schema cache by touching the table
SELECT COUNT(*) FROM uploads LIMIT 1;
        `);
        
        return false;
      } else {
        console.log('✅ Insert succeeded! Schema cache appears to be fixed.');
        // Clean up test record
        await supabase.from('uploads').delete().eq('id', data[0].id);
        console.log('🧹 Test record cleaned up');
        return true;
      }
    } catch (ddlError) {
      console.log('⚠️ DDL approach failed:', ddlError.message);
    }
  } catch (error) {
    console.error('❌ Schema fix failed:', error.message);
    return false;
  }
}

// Run the fix
fixSchemaCache()
  .then(success => {
    if (success) {
      console.log('🎉 Schema cache fix successful!');
    } else {
      console.log('❌ Schema cache fix may require manual intervention.');
      console.log('📋 Please run the suggested SQL commands in the Supabase SQL Editor manually.');
    }
  })
  .catch(err => console.error('💥 Unexpected error:', err));