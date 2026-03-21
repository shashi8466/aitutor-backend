import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProfile() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', '1535a7f6-94a7-4fdd-9558-516f48154819').single();
    console.log('Shashi Profile:', profile);
    
    const { data: parents } = await supabase.from('profiles').select('*').eq('role', 'parent').contains('linked_students', ['1535a7f6-94a7-4fdd-9558-516f48154819']);
    console.log('\nLinked Parents:', parents);
}

checkProfile();
