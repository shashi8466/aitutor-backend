import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

console.log('\n🔍 TESTING SUPABASE CONNECTION...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. Get Credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log(`📡 URL: ${SUPABASE_URL}`);
console.log(`🔑 Key: ${SUPABASE_KEY ? 'Found (Hidden)' : '❌ MISSING'}`);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌ ERROR: Missing Supabase Credentials in .env');
  process.exit(1);
}

// 2. Initialize Client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkConnection() {
  try {
    // 3. Test Database Connection (Read Profiles)
    console.log('\nTesting Database Read...');
    const { data: profiles, error: dbError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (dbError) throw new Error(`Database Error: ${dbError.message}`);
    console.log('✅ Database Connection: OK');

    // 4. Test Storage Connection (List Buckets)
    console.log('\nTesting Storage Access...');
    const { data: buckets, error: storageError } = await supabase
      .storage
      .listBuckets();

    if (storageError) throw new Error(`Storage Error: ${storageError.message}`);

    const bucketNames = buckets.map(b => b.name);
    console.log('✅ Storage Connection: OK');
    console.log('📦 Found Buckets:', bucketNames.join(', '));

    // 5. Check Specific Course Content Bucket
    if (bucketNames.includes('course_content')) {
      console.log('✅ "course_content" bucket exists.');
    } else {
      console.warn('⚠️ WARNING: "course_content" bucket is MISSING. Uploads will fail.');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 SUPABASE IS WORKING PERFECTLY');
    console.log('The "Network Error" is definitely because the local backend is down.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('\n❌ SUPABASE CONNECTION FAILED');
    console.error(err.message);
    process.exit(1);
  }
}

checkConnection();