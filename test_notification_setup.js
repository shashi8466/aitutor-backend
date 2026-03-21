import supabase from './src/supabase/supabaseAdmin.js';

async function checkTable() {
    try {
        console.log('Checking for notification_outbox table...');
        const { count, error } = await supabase
            .from('notification_outbox')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Error accessing notification_outbox:', error.message);
            if (error.code === '42P01') {
                console.error('   Wait! Code 42P01 means "relation does not exist". THE TABLE IS MISSING!');
            }
        } else {
            console.log('✅ notification_outbox table exists with', count, 'rows.');
        }

        console.log('\nChecking for notification_preferences column in profiles...');
        const { data: cols, error: colError } = await supabase.rpc('get_column_details', { tname: 'profiles' });
        // RPC might not exist, let's try a simple query
        const { data: profile, error: pError } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
        if (pError) throw pError;
        
        if (profile) {
            console.log('Sample profile columns:', Object.keys(profile));
            if ('notification_preferences' in profile) {
                console.log('✅ notification_preferences exists in profiles.');
            } else {
                console.error('❌ notification_preferences MISSING from profiles.');
            }
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
    }
}

checkTable();
