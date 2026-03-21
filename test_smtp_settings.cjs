
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testDBSettings() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: settings } = await supabase.from('internal_settings').select('*').eq('id', 1).single();
    
    const config = settings.email_config;
    console.log(`📡 testing SMTP: ${config.host}:${config.port} as ${config.user}`);
    
    const transporter = nodemailer.createTransport({
        host: config.host,
        port: parseInt(config.port),
        secure: config.port === '465',
        auth: {
            user: config.user,
            pass: config.pass
        }
    });

    try {
        console.log('🔄 Verifying transporter...');
        await transporter.verify();
        console.log('✅ SMTP Connection verified!');
        
        console.log('📧 Sending test email to user...');
        await transporter.sendMail({
            from: config.from_email || config.user,
            to: config.user,
            subject: 'SMTP Test from Admin',
            text: 'This confirms your SMTP settings in the AI platform are working correctly.'
        });
        console.log('✅ Test email sent!');
    } catch (err) {
        console.error('❌ SMTP Error:', err.message);
        if (err.message.includes('Invalid login')) {
            console.error('👉 Tip: Check if the password is correct. Are you sure "pass" should be the same as "user"?');
        }
    }
}

testDBSettings().catch(console.error);
