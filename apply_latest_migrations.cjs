const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSql(sql) {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) throw error;
    return data;
}

async function applyMigrations() {
    const migrationsDir = path.join(__dirname, 'src', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    console.log(`Found ${files.length} migrations.`);

    for (const file of files) {
        // We only care about the latest ones that might not have been applied
        if (file.startsWith('17684') || file.startsWith('17685')) {
            console.log(`Applying migration: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            try {
                await runSql(sql);
                console.log(`✅ Applied ${file}`);
            } catch (err) {
                console.error(`❌ Failed ${file}: ${err.message}`);
                // Continue anyway for now or stop?
            }
        }
    }
}

// First, let's fix the ambiguity fix file itself because it has the "progress" table bug
function fixMigrationBug() {
    const targetFile = path.join(__dirname, 'src', 'supabase', 'migrations', '1768400000005-rpc_ambiguity_fix.sql');
    let content = fs.readFileSync(targetFile, 'utf8');

    if (content.includes('public.progress prog')) {
        console.log('Fixing "public.progress" bug in migration file...');
        content = content.replace('FROM public.progress prog', 'FROM public.student_progress prog');
        content = content.replace('JOIN public.progress prog', 'JOIN public.student_progress prog');
        content = content.replace('LEFT JOIN public.progress prog', 'LEFT JOIN public.student_progress prog');
        fs.writeFileSync(targetFile, content);
    }
}

fixMigrationBug();
applyMigrations().then(() => console.log('All targeted migrations processed.'));
