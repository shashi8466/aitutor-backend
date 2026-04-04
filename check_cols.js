import supabaseAdmin from './src/supabase/supabaseAdmin.js';

async function checkCols() {
    const { data, error } = await supabaseAdmin.rpc('get_table_columns', { table_name: 'contact_messages' });
    if (error) {
        // fallback to select * from information_schema.columns
        const { data: cols, error: err2 } = await supabaseAdmin.from('information_schema.columns').select('column_name').eq('table_name', 'contact_messages');
        console.log('Cols:', cols?.map(c => c.column_name) || err2?.message);
    } else {
       console.log('Cols:', data);
    }
}
checkCols();
