import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Use service role key for full access
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspect() {
    console.log("🔍 Inspecting database structure...");

    // Check if uploads table exists and its structure
    try {
        const { data: uploads } = await supabase.from('information_schema.columns').select('column_name, data_type, is_nullable').eq('table_name', 'uploads');
        console.log(`📋 Uploads table columns:`, uploads);
        
        if (uploads) {
            const hasStatusColumn = uploads.some(col => col.column_name === 'status');
            console.log(`✅ Status column exists: ${hasStatusColumn}`);
            
            if (hasStatusColumn) {
                console.log(`📋 Status column details:`, uploads.find(col => col.column_name === 'status'));
            } else {
                console.log(`❌ Status column is missing!`);
            }
        }
    } catch (error) {
        console.error(`❌ Error inspecting uploads table:`, error.message);
    }

    // Check actual uploads data
    try {
        const { data: actualUploads, error } = await supabase.from('uploads').select('*').limit(5);
        if (error) {
            console.log(`❌ Error fetching uploads data:`, error.message);
        } else {
            console.log(`📊 Found ${actualUploads?.length || 0} uploads.`);
            if (actualUploads && actualUploads.length > 0) {
                console.log(`📝 Sample upload:`, actualUploads[0]);
            }
        }
    } catch (error) {
        console.error(`❌ Error fetching uploads:`, error.message);
    }

    // Check if questions table exists and its structure
    try {
        const { data: questions } = await supabase.from('information_schema.columns').select('column_name, data_type, is_nullable').eq('table_name', 'questions');
        console.log(`📋 Questions table columns (first 5):`, questions?.slice(0, 5));
    } catch (error) {
        console.error(`❌ Error inspecting questions table:`, error.message);
    }
}

inspect()
    .then(() => console.log('✅ Database inspection complete'))
    .catch(err => console.error('❌ Inspection failed:', err));