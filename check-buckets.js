
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkBuckets() {
    console.log('🔍 Checking Supabase Buckets...');
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error('❌ Failed to list buckets:', error.message);
        return;
    }

    console.log('✅ Found buckets:', buckets.map(b => `${b.name} (${b.public ? 'public' : 'private'})`).join(', '));

    const target = process.env.BUCKET_NAME || 'documents';
    const hasTarget = buckets.some(b => b.name === target);

    if (hasTarget) {
        console.log(`✅ Target bucket "${target}" exists.`);
    } else {
        console.error(`❌ Target bucket "${target}" is MISSING!`);
        console.log(`💡 Creating bucket "${target}"...`);

        const { data, error: createError } = await supabase.storage.createBucket(target, {
            public: true,
            fileSizeLimit: 5 * 1024 * 1024 * 1024 // 5GB
        });

        if (createError) {
            console.error('❌ Failed to create bucket:', createError.message);
        } else {
            console.log(`✅ Successfully created bucket "${target}"!`);
        }
    }
}

checkBuckets();
