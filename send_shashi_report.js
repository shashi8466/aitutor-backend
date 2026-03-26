import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, buildWeeklyReportEmail } from './src/server/utils/notificationService.js';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function sendShashiWeekly() {
    console.log("Looking up student Shashi...");
    const { data: students } = await supabase
        .from('profiles')
        .select('id, name, email')
        .ilike('name', '%Shashi%')
        .eq('role', 'student');
    
    if (!students?.length) {
        console.error("❌ Student Shashi not found.");
        return;
    }

    const shashi = students[0];
    console.log(`✅ Found Shashi! Email: ${shashi.email}`);

    // Get submissions for past 7 days
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);

    const { data: submissions } = await supabase
        .from('test_submissions')
        .select('id, test_date, raw_score_percentage, scaled_score, level, courses(name)')
        .eq('user_id', shashi.id)
        .gte('test_date', weekStart.toISOString())
        .lte('test_date', weekEnd.toISOString())
        .order('test_date', { ascending: false });

    // Find linked parents
    const { data: allParents } = await supabase
        .from('profiles')
        .select('id, name, email, linked_students')
        .eq('role', 'parent');

    const parents = (allParents || []).filter(p => {
        const linked = p.linked_students || [];
        return Array.isArray(linked) && linked.some(id => String(id).trim() === String(shashi.id).trim());
    });

    const parentEmails = parents.map(p => p.email).filter(Boolean);
    const recipientEmails = [shashi.email, ...parentEmails].filter(Boolean);

    console.log(`🚀 Dispatching weekly report to:`, recipientEmails);

    const emailHtml = buildWeeklyReportEmail({
        recipientName: shashi.name,
        studentName: shashi.name,
        submissions: submissions || [],
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        appUrl: process.env.APP_URL || 'https://aitutor.gigatechservices.org',
        isParent: false
    });

    const res = await sendEmail({
        to: recipientEmails,
        subject: `Weekly Progress Report: ${shashi.name}`,
        html: emailHtml
    });

    console.log("📨 Send Result:", res);
}

sendShashiWeekly();
