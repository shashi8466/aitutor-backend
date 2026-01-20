import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';
const router = express.Router();

router.get('/debug-dashboard', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        const assignedCourses = (profile?.assigned_courses || []).map(Number);

        const { data: coursesRaw } = await supabase.from('courses').select('id, name').in('id', assignedCourses);
        const { count: enrollmentCount } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).in('course_id', assignedCourses);

        res.json({
            userId,
            profile_assigned: profile?.assigned_courses,
            mapped_assigned: assignedCourses,
            courses_found: coursesRaw,
            enrollment_count: enrollmentCount
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});
export default router;
