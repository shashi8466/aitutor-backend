import supabase from './src/supabase/supabaseAdmin.js';

async function checkCols() {
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    if (error) {
        console.error(error);
    } else {
        console.log('Columns:', Object.keys(data[0]));
        console.log('Sample Row:', data[0]);
    }
}

checkCols();
