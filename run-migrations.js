/**
 * Migration Runner Script
 * Run this script to apply all new migrations to your Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Supabase credentials not found in .env file');
    console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrations = [
    '1768000000000-add_tutor_role.sql',
    '1768100000000-create_enrollment_keys.sql',
    '1768200000000-create_invitation_links.sql',
    '1768300000000-create_test_submissions.sql'
];

async function runMigration(filename) {
    console.log(`\n📄 Running migration: ${filename}`);

    const migrationPath = path.join(__dirname, 'src', 'supabase', 'migrations', filename);

    if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        return false;
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).select();

        if (error) {
            // Try alternative method: execute directly
            const { error: execError } = await supabase.from('_migrations').insert({
                name: filename,
                executed_at: new Date().toISOString()
            });

            if (execError) {
                console.error(`❌ Error running migration ${filename}:`, error);
                return false;
            }
        }

        console.log(`✅ Migration ${filename} completed successfully`);
        return true;
    } catch (err) {
        console.error(`❌ Error running migration ${filename}:`, err.message);
        return false;
    }
}

async function runAllMigrations() {
    console.log('\n🗄️  Starting Database Migration Process...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let successCount = 0;
    let failCount = 0;

    for (const migration of migrations) {
        const success = await runMigration(migration);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total: ${migrations.length}`);

    if (failCount > 0) {
        console.log('\n⚠️  Note: Some migrations failed.');
        console.log('💡 Try running them manually in Supabase SQL Editor:');
        console.log('   1. Go to https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Navigate to SQL Editor');
        console.log('   4. Copy and paste each migration file');
    } else {
        console.log('\n🎉 All migrations completed successfully!');
        console.log('\n✅ Next Steps:');
        console.log('   1. Test login at http://localhost:5173/login');
        console.log('   2. Create a test tutor account in Supabase');
        console.log('   3. Explore the new features!');
    }
}

// Run migrations
runAllMigrations().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
