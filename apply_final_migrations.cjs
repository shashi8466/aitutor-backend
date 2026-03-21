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
    if (error) {
        // If it's a "already exists" error, we can ignore it for some things
        if (error.message.includes('already exists') || error.message.includes('already a member')) {
            console.log(`   (Partial: ${error.message})`);
            return data;
        }
        throw error;
    }
    return data;
}

async function applyMigrations() {
    const migrationsDir = path.join(__dirname, 'src', 'supabase', 'migrations');
    const rootMigrationsDir = path.join(__dirname, 'migrations');
    
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    const rootFiles = fs.existsSync(rootMigrationsDir) 
        ? fs.readdirSync(rootMigrationsDir).filter(f => f.endsWith('.sql')).map(f => path.join('migrations', f))
        : [];

    const allToRun = [
        ...files.filter(f => f.startsWith('17686') || f.startsWith('17689') || !f.match(/^\d/)).map(f => path.join('src', 'supabase', 'migrations', f)),
        ...rootFiles.map(f => f)
    ];

    console.log(`Found ${allToRun.length} migrations to apply.`);

    for (const file of allToRun) {
        console.log(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
        try {
            await runSql(sql);
            console.log(`✅ Applied ${file}`);
        } catch (err) {
            console.error(`❌ Failed ${file}: ${err.message}`);
        }
    }
}

applyMigrations().then(() => console.log('Final migrations processed.'));
