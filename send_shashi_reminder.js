import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, buildDueDateReminderEmail } from './src/server/utils/notificationService.js';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function sendShashiReminder() {
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

    // Create dummy due items
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);

    const dueItems = [
        { course_name: 'SAT Math Mastery', level: 'Level 5', due_date: tomorrow.toISOString() },
        { course_name: 'Critical Reading Skills', level: 'Level 2', due_date: nextWeek.toISOString() }
    ];

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

    console.log(`🚀 Dispatching due date reminder to:`, recipientEmails);

    const emailHtml = buildDueDateReminderEmail({
        recipientName: shashi.name,
        studentName: shashi.name,
        dueItems,
        appUrl: 'https://aitutor.gigatechservices.org',
        isParent: false
    });

    const res = await sendEmail({
        to: recipientEmails,
        subject: `⏰ Reminder: Upcoming Test Deadlines for ${shashi.name}`,
        html: emailHtml
    });

    console.log("📨 Send Result:", res);
}

sendShashiReminder();
