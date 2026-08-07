import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';
import { subDays, format, isAfter } from 'date-fns';

const router = express.Router();

router.get('/stats', async (req, res) => {
    try {
        // 1. Fetch total students (Original Leads)
        const { count: totalStudents, error: studentsError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'student');

        if (studentsError) throw studentsError;

        // 2. Fetch demo leads count
        const { count: demoLeadsCount, error: demoError } = await supabase
            .from('demo_leads')
            .select('*', { count: 'exact', head: true });

        if (demoError) throw demoError;

        // 3. Fetch courses for pie chart and totals
        const { data: courses, error: coursesError } = await supabase
            .from('courses')
            .select('id, name, questions_count, created_at');

        if (coursesError) throw coursesError;

        const totalCourses = courses.length;
        const totalQuestions = courses.reduce((sum, c) => sum + (c.questions_count || 0), 0);

        // Course Pie Chart Data
        const subjectCounts = { SAT: 0, ACT: 0, AP: 0, Other: 0 };
        courses.forEach(c => {
            const name = (c.name || '').toUpperCase();
            if (name.includes('SAT')) subjectCounts.SAT++;
            else if (name.includes('ACT')) subjectCounts.ACT++;
            else if (name.includes('AP')) subjectCounts.AP++;
            else subjectCounts.Other++;
        });

        const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
        const pieData = Object.keys(subjectCounts)
            .filter(key => subjectCounts[key] > 0)
            .map((key, idx) => ({
                name: `${key} Courses`,
                value: subjectCounts[key],
                percent: `${((subjectCounts[key] / totalCourses) * 100).toFixed(1)}%`,
                color: colors[idx % colors.length]
            }));

        // 4. Fetch recent submissions for active tests (last 7 days)
        const sevenDaysAgo = subDays(new Date(), 7).toISOString();
        const { count: activeTests, error: testsError } = await supabase
            .from('test_submissions')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', sevenDaysAgo);

        // Ignore submissions error if table doesn't exist, just default to 0
        const activeTestsCount = testsError ? 0 : activeTests;

        // 5. Build Historical Line Data (Last 7 Days)
        // Fetch demo leads and students from last 7 days
        const { data: recentDemoLeads } = await supabase
            .from('demo_leads')
            .select('created_at')
            .gte('created_at', sevenDaysAgo);

        const { data: recentStudents } = await supabase
            .from('profiles')
            .select('created_at')
            .eq('role', 'student')
            .gte('created_at', sevenDaysAgo);

        const lineDataMap = {};
        for (let i = 6; i >= 0; i--) {
            const dateStr = format(subDays(new Date(), i), 'MMM d');
            lineDataMap[dateStr] = { name: dateStr, demoLeads: 0, originalLeads: 0 };
        }

        (recentDemoLeads || []).forEach(lead => {
            const dateStr = format(new Date(lead.created_at), 'MMM d');
            if (lineDataMap[dateStr]) lineDataMap[dateStr].demoLeads++;
        });

        (recentStudents || []).forEach(student => {
            const dateStr = format(new Date(student.created_at), 'MMM d');
            if (lineDataMap[dateStr]) lineDataMap[dateStr].originalLeads++;
        });

        const lineData = Object.values(lineDataMap);

        // 6. Build Recent Activities
        const activities = [];

        // Get recent demo leads
        const { data: latestDemoLeads } = await supabase
            .from('demo_leads')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        (latestDemoLeads || []).forEach(lead => {
            activities.push({
                type: 'demo',
                iconName: 'FiCheckCircle',
                color: 'teal',
                title: 'Demo test submitted',
                details: `${lead.name || 'A user'} submitted a demo test`,
                by: 'Student',
                created_at: new Date(lead.created_at)
            });
        });

        // Get recent students
        const { data: latestStudents } = await supabase
            .from('profiles')
            .select('id, full_name, email, created_at')
            .eq('role', 'student')
            .order('created_at', { ascending: false })
            .limit(5);

        (latestStudents || []).forEach(student => {
            activities.push({
                type: 'student',
                iconName: 'FiUserPlus',
                color: 'blue',
                title: 'New student registered',
                details: `${student.full_name || student.email || 'A user'} joined as a student`,
                by: 'System',
                created_at: new Date(student.created_at)
            });
        });

        // Get recent courses
        const { data: latestCourses } = await supabase
            .from('courses')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
        
        (latestCourses || []).forEach(course => {
            activities.push({
                type: 'course',
                iconName: 'FiBook',
                color: 'green',
                title: 'New course created',
                details: `${course.name} course has been created`,
                by: 'Admin',
                created_at: new Date(course.created_at)
            });
        });

        // Sort activities by date desc and take top 5
        activities.sort((a, b) => b.created_at - a.created_at);
        const topActivities = activities.slice(0, 5).map(act => {
            // format time ago
            const diffMs = new Date() - act.created_at;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHrs = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHrs / 24);
            
            let timeStr = 'just now';
            if (diffDays > 0) timeStr = `${diffDays}d ago`;
            else if (diffHrs > 0) timeStr = `${diffHrs}h ago`;
            else if (diffMins > 0) timeStr = `${diffMins}m ago`;

            return {
                iconName: act.iconName,
                color: act.color,
                title: act.title,
                details: act.details,
                by: act.by,
                time: timeStr
            };
        });

        // Send payload
        res.json({
            totals: {
                totalStudents: totalStudents || 0,
                demoLeads: demoLeadsCount || 0,
                originalLeads: totalStudents || 0,
                activeStudents: totalStudents || 0, // Simplified to total students for now
                totalCourses: totalCourses || 0,
                totalQuestions: totalQuestions || 0,
                activeTests: activeTestsCount || 0
            },
            pieData: pieData,
            lineData: lineData,
            recentActivities: topActivities
        });

    } catch (error) {
        console.error('Error fetching admin dashboard stats:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
