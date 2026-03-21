import supabase from './src/supabase/supabaseAdmin.js';

async function checkProfile() {
    const parentId = '36b03ba6-fcf9-46e1-b4ba-1ce4c0d9ebba';
    const { data: parent } = await supabase.from('profiles').select('*').eq('id', parentId).single();
    console.log('Parent Profile:', parent);
}

checkProfile();
