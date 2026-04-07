import supabase from './src/supabase/supabaseAdmin.js';

async function listTables() {
    console.log('Listing all tables in the public schema...');
    
    // We can use a trick to list tables via an RPC or a known query if authorized, 
    // but here we'll just try common SAT table names.
    const tablesToTry = ['questions', 'kb_questions', 'uploads', 'courses', 'knowledge_base'];
    
    for (const table of tablesToTry) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log(`❌ Table '${table}': ${error.message}`);
        } else {
            console.log(`✅ Table '${table}': ${count} rows`);
        }
    }
}

listTables();
