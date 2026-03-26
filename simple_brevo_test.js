import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './src/server/utils/notificationService.js';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function testSimpleBrevo() {
    const to = 'ssky57771@gmail.com';
    console.log(`🚀 Sending a simple test email to: ${to}...`);
    
    // We'll use a very simple HTML to ensure no spam triggers
    const res = await sendEmail({
        to,
        subject: 'Platform Test Dispatch: 001',
        html: `<h2>Platform Test</h2><p>This is a manual test email sent to ${to}. If you see this, Brevo is delivering correctly.</p>`
    });
    
    console.log("📨 Result:", res);
}

testSimpleBrevo();
