import supabase from './src/supabase/supabaseAdmin.js';

async function checkLink() {
    const parentId = '36b03ba6-fcf9-46e1-b4ba-1ce4c0d9ebba';
    const studentId = '1535a7f6-94a7-4fdd-9558-516f48154819';

    const { data: parent } = await supabase.from('profiles').select('linked_students').eq('id', parentId).single();
    console.log('Parent linked students:', parent?.linked_students);
    const linked = parent?.linked_students || [];
    const isLinked = linked.some(id => String(id) === studentId);
    console.log('Is linked:', isLinked);
}

checkLink();
