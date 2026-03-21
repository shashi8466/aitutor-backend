import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
    const { data: columns } = await supabase.from('information_schema.columns').select('column_name, data_type').eq('table_name', 'profiles');
    console.log("Profiles columns:", columns);
}
checkColumns().then(() => console.log('Done'));
