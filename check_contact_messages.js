import supabaseAdmin from './src/supabase/supabaseAdmin.js';

async function checkTable() {
    const { data, error } = await supabaseAdmin
        .from('contact_messages')
        .select('*')
        .limit(1);
    
    if (error) {
        console.log('Error or table missing:', error.message);
    } else {
        console.log('Table exists! Sample data:', data);
    }
}

checkTable();
