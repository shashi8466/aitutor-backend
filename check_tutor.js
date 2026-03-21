import supabase from './src/supabase/supabaseAdmin.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const email = 'shashikumaredula@gmail.com';
    console.log(`Checking user: ${email}`);

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return;
    }

    console.log('Profile found:');
    console.log(JSON.stringify(data, null, 2));
}

check();
