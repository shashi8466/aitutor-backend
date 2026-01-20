
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkTutor() {
    console.log("🔍 Checking tutor profile for Shashi...");
    const { data: profiles, error } = await supabase.from('profiles').select('*').ilike('name', '%Shashi%');

    if (error) {
        console.error("❌ Error fetching profile:", error);
        return;
    }

    console.log("👤 Profiles found:", profiles);

    for (const profile of profiles) {
        console.log(`\n--- Profile: ${profile.name} (${profile.id}) ---`);
        console.log(`Role: ${profile.role}`);
        console.log(`Approved: ${profile.tutor_approved}`);
        console.log(`Assigned Courses:`, profile.assigned_courses);

        let assigned = profile.assigned_courses || [];
        if (typeof assigned === 'string') {
            try { assigned = JSON.parse(assigned); } catch (e) { assigned = []; }
        }

        if (assigned.length > 0) {
            const { data: courses } = await supabase.from('courses').select('id, name').in('id', assigned);
            console.log(`📚 Courses Details:`, courses);

            const { count } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).in('course_id', assigned);
            console.log(`👥 Total Students Enrolled in these courses:`, count);
        } else {
            console.log("⚠️ No courses assigned to this tutor.");
        }
    }
}

checkTutor();
