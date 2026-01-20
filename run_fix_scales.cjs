const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fixScales() {
    console.log('--- Fixing Scales & Submissions ---');

    const courses = [1, 4];
    const sections = ['math', 'reading', 'writing', 'overall'];

    for (const cid of courses) {
        for (const sec of sections) {
            const min = sec === 'overall' ? 400 : 200;
            const max = sec === 'overall' ? 1600 : 800;

            const { error } = await supabase
                .from('grade_scales')
                .upsert({
                    course_id: cid,
                    section: sec,
                    min_scaled_score: min,
                    max_scaled_score: max,
                    scale_type: 'linear',
                    is_active: true
                }, { onConflict: 'course_id, section' });

            if (error) console.error(`Error for course ${cid} sec ${sec}:`, error.message);
            else console.log(`✅ Scale set for course ${cid} section ${sec}`);
        }
    }

    // Now update existing submissions
    console.log('Updating existing submissions...');
    const { data: subs, error: fetchError } = await supabase
        .from('test_submissions')
        .select('*');

    if (fetchError) {
        console.error('Error fetching subs:', fetchError);
        return;
    }

    for (const sub of subs) {
        // Simple linear calculation for now
        const math_perc = sub.math_total_questions > 0 ? (sub.math_raw_score / sub.math_total_questions) : (sub.raw_score / 100);
        const math_scaled = Math.round(200 + (math_perc * 600));

        const rd_perc = sub.reading_total_questions > 0 ? (sub.reading_raw_score / sub.reading_total_questions) : (sub.raw_score / 100);
        const rd_scaled = Math.round(200 + (rd_perc * 600));

        const wr_perc = sub.writing_total_questions > 0 ? (sub.writing_raw_score / sub.writing_total_questions) : (sub.raw_score / 100);
        const wr_scaled = Math.round(200 + (wr_perc * 600));

        const total_perc = sub.raw_score_percentage / 100 || (sub.raw_score / 100);
        const total_scaled = Math.round(400 + (total_perc * 1200));

        await supabase
            .from('test_submissions')
            .update({
                math_scaled_score: math_scaled,
                reading_scaled_score: rd_scaled,
                writing_scaled_score: wr_scaled,
                scaled_score: total_scaled
            })
            .eq('id', sub.id);
    }
    console.log(`✅ Updated ${subs.length} submissions.`);
}

fixScales();
