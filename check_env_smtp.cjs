
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkEnv() {
    console.log('🌍 Environment SMTP check:');
    console.log(`- EMAIL_USER: ${process.env.EMAIL_USER}`);
    console.log(`- EMAIL_HOST: ${process.env.EMAIL_HOST}`);
    console.log(`- EMAIL_PORT: ${process.env.EMAIL_PORT}`);
    console.log(`- EMAIL_PASS exists: ${!!process.env.EMAIL_PASS}`);
    console.log(`- RESEND_API_KEY exists: ${!!process.env.RESEND_API_KEY}`);
}
checkEnv();
