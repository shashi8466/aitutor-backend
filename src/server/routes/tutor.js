/**
 * Tutor Routes
 * Endpoints for tutor-specific functionality
 */

import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

/**
 * Helper to normalize assigned courses to an array of numbers
 */
const getAssignedCourses = (profile) => {
    let rawAssigned = profile?.assigned_courses || [];
    if (typeof rawAssigned === 'string') {
        try {
            rawAssigned = JSON.parse(rawAssigned);
        } catch (e) {
            console.error('❌ [TUTOR API] Failed to parse assigned_courses string:', rawAssigned);
            rawAssigned = [];
        }
    }
    return Array.isArray(rawAssigned) ? rawAssigned.map(Number).filter(id => !isNaN(id)) : [];
};

router.get('/diagnostics', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        const { data: courses } = await supabase.rpc('get_tutor_courses', { requested_user_id: userId });

        res.json({
            userId,
            profile,
            coursesLength: courses?.length || 0,
            courses
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/tutor/dashboard
 * Get tutor dashboard data
 */
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get profile (no role filter yet to allow admins)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(401).json({ error: 'User profile not found' });
        }

        // Only allow tutors or admins
        if (profile.role !== 'tutor' && profile.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized for tutor dashboard' });
        }

        // Tutors need approval, admins don't
        if (profile.role === 'tutor' && !profile.tutor_approved) {
            return res.status(403).json({
                error: 'Tutor account pending approval',
                pending: true
            });
        }
        const assignedCourses = getAssignedCourses(profile);
        console.log(`📊 [TUTOR DASHBOARD] User: ${userId}, Role: ${profile.role}, Normalized Assigned Courses:`, assignedCourses);

        // 1. Get total enrollments count
        let totalEnrollments = 0;
        let uniqueStudentsCount = 0;

        if (assignedCourses.length > 0) {
            // Get total enrollments
            const { count, error: enrollmentsError } = await supabase
                .from('enrollments')
                .select('*', { count: 'exact', head: true })
                .in('course_id', assignedCourses);

            if (enrollmentsError) console.error('❌ [TUTOR DASHBOARD] Enrollment count error:', enrollmentsError);
            totalEnrollments = count || 0;

            // Get unique students count
            const { data: enrollmentData, error: uniqueError } = await supabase
                .from('enrollments')
                .select('user_id')
                .in('course_id', assignedCourses);

            if (!uniqueError && enrollmentData) {
                const uniqueIds = new Set(enrollmentData.map(e => String(e.user_id)));
                uniqueStudentsCount = uniqueIds.size;
            }
        }
        console.log(`📊 [TUTOR DASHBOARD] Total Enrollments: ${totalEnrollments}, Unique Students: ${uniqueStudentsCount}`);

        // 2. Get assigned courses
        let courses = [];
        if (assignedCourses.length > 0) {
            const { data, error: coursesError } = await supabase
                .from('courses')
                .select(`
                    id, name, description, tutor_type, created_at
                `)
                .in('id', assignedCourses);

            if (coursesError) {
                console.error('❌ [TUTOR DASHBOARD] Courses fetch error:', coursesError);
            } else {
                courses = data || [];

                // Fetch enrollment counts for each course separately to be safe
                for (let course of courses) {
                    const { count } = await supabase
                        .from('enrollments')
                        .select('*', { count: 'exact', head: true })
                        .eq('course_id', course.id);
                    course.enrolled_count = count || 0;
                }
            }
        }
        console.log(`📊 [TUTOR DASHBOARD] Found ${courses.length} courses`);

        // 3. Get recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: recentSubmissions, error: submissionsError } = await supabase
            .from('test_submissions')
            .select('*, user:profiles!user_id(name, email)')
            .in('course_id', assignedCourses)
            .gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(10);

        if (submissionsError) console.error('Error fetching recent activity:', submissionsError);

        // Map courses to flatten the enrolled_count from the select query
        const formattedCourses = (courses || []).map(c => ({
            ...c,
            enrolled_count: Number(c.enrolled_count || 0)
        }));

        res.json({
            profile,
            courses: formattedCourses,
            total_students: uniqueStudentsCount,
            total_enrollments: totalEnrollments,
            recentActivity: recentSubmissions || [],
            stats: {
                totalCourses: formattedCourses.length,
                totalStudents: uniqueStudentsCount,
                totalEnrollments: totalEnrollments,
                recentTests: recentSubmissions?.length || 0
            }
        });

    } catch (error) {
        console.error('Tutor dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/courses
 * Get courses assigned to tutor
 */
router.get('/courses', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch tutor profile to get assigned courses
        const { data: profile } = await supabase
            .from('profiles')
            .select('assigned_courses')
            .eq('id', userId)
            .single();

        let rawAssigned = profile?.assigned_courses || [];
        if (typeof rawAssigned === 'string') {
            try { rawAssigned = JSON.parse(rawAssigned); } catch (e) { rawAssigned = []; }
        }
        const assignedCourses = Array.isArray(rawAssigned) ? rawAssigned.map(Number) : [];

        const { data: courses, error } = await supabase
            .from('courses')
            .select(`
                id, name, description, tutor_type, created_at,
                enrolled_count:enrollments(count)
            `)
            .in('id', assignedCourses);

        if (error) {
            console.error('❌ [COURSES] Error fetching tutor courses:', error);
            return res.status(500).json({
                error: 'Failed to fetch courses',
                details: error.message
            });
        }

        const formattedCourses = (courses || []).map(c => ({
            ...c,
            enrolled_count: c.enrolled_count?.[0]?.count || 0
        }));

        res.json({ courses: formattedCourses });

    } catch (error) {
        console.error('Tutor courses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/students
 * Get students in tutor's courses
 */
router.get('/students', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch tutor profile to get assigned courses
        const { data: profile } = await supabase
            .from('profiles')
            .select('assigned_courses')
            .eq('id', userId)
            .single();

        let rawAssigned = profile?.assigned_courses || [];
        if (typeof rawAssigned === 'string') {
            try { rawAssigned = JSON.parse(rawAssigned); } catch (e) { rawAssigned = []; }
        }
        const assignedCourses = Array.isArray(rawAssigned) ? rawAssigned.map(Number) : [];

        // Direct query to get students for assigned courses
        const { data: students, error } = await supabase
            .from('profiles')
            .select(`
                id, name, email,
                enrollments!inner(course_id, enrolled_at),
                student_progress(count)
            `)
            .eq('role', 'student')
            .in('enrollments.course_id', assignedCourses);

        if (error) {
            console.error('❌ [STUDENTS] Error fetching tutor students:', error);
            return res.status(500).json({
                error: 'Failed to fetch students',
                details: error.message
            });
        }

        // Format and filter students if needed
        let filteredStudents = students.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email,
            enrolled_course_id: s.enrollments[0]?.course_id,
            enrolled_at: s.enrollments[0]?.enrolled_at,
            progress_count: Number(s.student_progress?.[0]?.count || 0)
        }));

        if (courseId) {
            filteredStudents = filteredStudents.filter(s => s.enrolled_course_id === parseInt(courseId));
        }

        res.json({ students: filteredStudents });

    } catch (error) {
        console.error('Tutor students error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/course-grades/:courseId
 * Get all student grades for a specific course
 */
router.get('/course-grades/:courseId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        console.log(`🔍 [GRADES] Fetching grades for course: ${courseId}, User: ${userId}`);

        if (!userId) {
            console.warn('⚠️ [GRADES] Unauthorized access attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify tutor has access to this course
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('assigned_courses, tutor_approved, role')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error('❌ [GRADES] User profile not found:', userId);
            return res.status(401).json({ error: 'User profile not found' });
        }

        const isAdmin = profile.role === 'admin';
        const targetId = parseInt(courseId);
        const assignedCourses = getAssignedCourses(profile);
        const isAssigned = assignedCourses.includes(targetId);

        if (profile.role === 'tutor' && !profile.tutor_approved) {
            console.warn(`⚠️ [GRADES] Tutor not approved: ${userId}`);
            return res.status(403).json({ error: 'Tutor account pending approval' });
        }

        if (!isAdmin && !isAssigned) {
            console.warn(`⚠️ [GRADES] Access denied for course ${courseId} to user ${userId} (Role: ${profile.role})`);
            return res.status(403).json({ error: 'Not authorized for this course' });
        }

        // Get all submissions for this course
        const { data: submissions, error } = await supabase
            .from('test_submissions')
            .select(`
                *,
                user:profiles!user_id (
                    id,
                    name,
                    email
                )
            `)
            .eq('course_id', isNaN(targetId) ? courseId : targetId)
            .order('test_date', { ascending: false });

        if (error) {
            console.error('❌ [GRADES] Error fetching course grades:', error);
            return res.status(500).json({ error: 'Failed to fetch grades' });
        }

        console.log(`✅ [GRADES] Found ${submissions?.length || 0} submissions for course ${courseId}`);
        res.json({ submissions: submissions || [] });

    } catch (error) {
        console.error('💥 [GRADES] Course grades error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/student-progress/:studentId
 * Get detailed progress for a specific student
 */
router.get('/student-progress/:studentId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { studentId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify tutor has access to this student
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('assigned_courses, role')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'Tutor profile not found' });
        }

        const assignedCourses = getAssignedCourses(profile);

        // Check if student is in any of tutor's courses
        const { data: studentEnrollments } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('user_id', studentId)
            .in('course_id', assignedCourses);

        if (!studentEnrollments || studentEnrollments.length === 0) {
            return res.status(403).json({ error: 'Not authorized for this student' });
        }

        // Get student info
        const { data: student } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', studentId)
            .single();

        // Get test submissions
        const { data: submissions } = await supabase
            .from('test_submissions')
            .select('*')
            .eq('user_id', studentId)
            .in('course_id', assignedCourses)
            .order('test_date', { ascending: false });

        // Get progress records
        const { data: progress } = await supabase
            .from('student_progress')
            .select('*')
            .eq('user_id', studentId);

        res.json({
            student,
            submissions: submissions || [],
            progress: progress || []
        });

    } catch (error) {
        console.error('Student progress error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/groups
 * Get all groups managed by the tutor
 */
router.get('/groups', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let query = supabase
            .from('student_groups')
            .select(`
                *,
                course:courses(id, name),
                member_count:group_members(count)
            `)
            .eq('created_by', userId);

        if (courseId) {
            query = query.eq('course_id', courseId);
        }

        const { data: groups, error } = await query;

        if (error) {
            console.error('Error fetching groups:', error);
            return res.status(500).json({ error: 'Failed to fetch groups' });
        }

        // Format to flatten member_count with robust handling
        const formattedGroups = (groups || []).map(g => {
            let count = 0;
            if (Array.isArray(g.member_count)) {
                count = g.member_count[0]?.count || 0;
            } else if (typeof g.member_count === 'object' && g.member_count !== null) {
                count = g.member_count.count || 0;
            } else if (typeof g.member_count === 'number') {
                count = g.member_count;
            }

            return {
                ...g,
                member_count: Number(count)
            };
        });

        res.json({ groups: formattedGroups });

    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/tutor/groups
 * Create a new student group
 */
router.post('/groups', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { name, courseId, description } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!name || !courseId) {
            return res.status(400).json({ error: 'Name and Course ID are required' });
        }

        // Verify tutor has access to this course (Robust type matching)
        const { data: profile } = await supabase
            .from('profiles')
            .select('assigned_courses, role')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.role === 'admin';
        const assignedCourses = (profile?.assigned_courses || []).map(Number);
        const targetCourseId = Number(courseId);

        const isAssigned = assignedCourses.includes(targetCourseId);

        if (!isAdmin && !isAssigned) {
            return res.status(403).json({ error: 'Not authorized for this course' });
        }

        const numericCourseId = parseInt(courseId);

        const { data: group, error } = await supabase
            .from('student_groups')
            .insert({
                name,
                course_id: numericCourseId,
                description,
                created_by: userId
            })
            .select()
            .single();

        if (error) {
            console.error('❌ [GROUPS] Error creating group:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            return res.status(500).json({
                error: 'Failed to create group',
                details: error.message,
                db_code: error.code
            });
        }

        res.json({ group });

    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/tutor/groups/:groupId/members
 * Add students to a group
 */
router.post('/groups/:groupId/members', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { studentIds } = req.body; // Array of UUIDs

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify group belongs to tutor course OR tutor created it
        const { data: group } = await supabase
            .from('student_groups')
            .select('created_by, course_id')
            .eq('id', groupId)
            .single();

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('assigned_courses, role')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.role === 'admin';
        const assignedCourses = (profile?.assigned_courses || []).map(Number);
        const groupCourseId = Number(group.course_id);
        const isCreator = group.created_by === userId;
        const isAssigned = assignedCourses.includes(groupCourseId);

        if (!isAdmin && !isCreator && !isAssigned) {
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        const membersToInsert = studentIds.map(sid => ({
            group_id: groupId,
            student_id: sid
        }));

        const { error } = await supabase
            .from('group_members')
            .upsert(membersToInsert, { onConflict: 'group_id, student_id' });

        if (error) {
            console.error('Error adding members:', error);
            return res.status(500).json({ error: 'Failed to add members' });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Add members error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/tutor/groups/:groupId/members/:studentId
 * Remove a student from a group
 */
router.delete('/groups/:groupId/members/:studentId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId, studentId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify group belongs to tutor
        const { data: group } = await supabase
            .from('student_groups')
            .select('created_by')
            .eq('id', groupId)
            .single();

        if (!group || group.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('student_id', studentId);

        if (error) {
            console.error('Error removing member:', error);
            return res.status(500).json({ error: 'Failed to remove member' });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/tutor/groups/:groupId
 * Delete a group
 */
router.delete('/groups/:groupId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { error } = await supabase
            .from('student_groups')
            .delete()
            .eq('id', groupId)
            .eq('created_by', userId);

        if (error) {
            console.error('Error deleting group:', error);
            return res.status(500).json({ error: 'Failed to delete group' });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/groups/:groupId/members
 * Get all members of a group with their performance data
 */
router.get('/groups/:groupId/members', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify group ownership
        const { data: group } = await supabase
            .from('student_groups')
            .select('created_by, course_id')
            .eq('id', groupId)
            .single();

        if (!group || group.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        // Get group members with their profiles
        const { data: members, error: membersError } = await supabase
            .from('group_members')
            .select(`
                student_id,
                created_at,
                student:profiles!student_id(id, name, email)
            `)
            .eq('group_id', groupId);

        if (membersError) {
            console.error('Error fetching members:', membersError);
            return res.status(500).json({ error: 'Failed to fetch members' });
        }

        // Get performance data for each member
        const memberIds = members.map(m => m.student_id);

        if (memberIds.length === 0) {
            return res.json({ members: [] });
        }

        const { data: submissions } = await supabase
            .from('test_submissions')
            .select('user_id, raw_score, raw_score_percentage, scaled_score, created_at')
            .eq('course_id', group.course_id)
            .in('user_id', memberIds)
            .order('created_at', { ascending: false });

        // Aggregate performance data
        const membersWithPerformance = members.map(member => {
            const studentSubmissions = submissions?.filter(s => s.user_id === member.student_id) || [];

            const avgScore = studentSubmissions.length > 0
                ? studentSubmissions.reduce((sum, s) => sum + (s.raw_score_percentage || 0), 0) / studentSubmissions.length
                : 0;

            const latestSubmission = studentSubmissions[0];

            return {
                id: member.student_id,
                name: member.student?.name,
                email: member.student?.email,
                joined_at: member.created_at,
                total_tests: studentSubmissions.length,
                average_score: Math.round(avgScore * 10) / 10,
                latest_score: latestSubmission?.raw_score_percentage || 0,
                latest_scaled_score: latestSubmission?.scaled_score || 0,
                last_test_date: latestSubmission?.created_at || null
            };
        });

        res.json({ members: membersWithPerformance });

    } catch (error) {
        console.error('Get group members error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/groups/:groupId/analytics
 * Get detailed analytics for a specific group
 */
router.get('/groups/:groupId/analytics', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { startDate, endDate } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify group ownership
        const { data: group } = await supabase
            .from('student_groups')
            .select('created_by, course_id, name')
            .eq('id', groupId)
            .single();

        if (!group || group.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        // Get all group members
        const { data: members } = await supabase
            .from('group_members')
            .select('student_id')
            .eq('group_id', groupId);

        const memberIds = members?.map(m => m.student_id) || [];

        if (memberIds.length === 0) {
            return res.json({
                group_name: group.name,
                total_students: 0,
                average_score: 0,
                top_performers: [],
                low_performers: [],
                subject_performance: {},
                progress_trend: []
            });
        }

        // Build query with optional date filtering
        let submissionsQuery = supabase
            .from('test_submissions')
            .select('*')
            .eq('course_id', group.course_id)
            .in('user_id', memberIds);

        if (startDate) {
            submissionsQuery = submissionsQuery.gte('created_at', startDate);
        }
        if (endDate) {
            submissionsQuery = submissionsQuery.lte('created_at', endDate);
        }

        const { data: submissions } = await submissionsQuery.order('created_at', { ascending: false });

        // Calculate overall statistics
        const totalTests = submissions?.length || 0;
        const avgScore = totalTests > 0
            ? submissions.reduce((sum, s) => sum + (s.raw_score_percentage || 0), 0) / totalTests
            : 0;

        // Calculate per-student averages for ranking
        const studentScores = {};
        memberIds.forEach(id => {
            const studentSubs = submissions?.filter(s => s.user_id === id) || [];
            if (studentSubs.length > 0) {
                studentScores[id] = {
                    avg: studentSubs.reduce((sum, s) => sum + (s.raw_score_percentage || 0), 0) / studentSubs.length,
                    count: studentSubs.length
                };
            }
        });

        // Get student names
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', memberIds);

        const profileMap = {};
        profiles?.forEach(p => {
            profileMap[p.id] = p;
        });

        // Top and low performers
        const rankedStudents = Object.entries(studentScores)
            .map(([id, data]) => ({
                id,
                name: profileMap[id]?.name || 'Unknown',
                email: profileMap[id]?.email,
                average_score: Math.round(data.avg * 10) / 10,
                total_tests: data.count
            }))
            .sort((a, b) => b.average_score - a.average_score);

        const topPerformers = rankedStudents.slice(0, 3);
        const lowPerformers = rankedStudents.slice(-3).reverse();

        // Subject-wise performance
        const subjectPerformance = {
            math: { total: 0, correct: 0, count: 0 },
            reading: { total: 0, correct: 0, count: 0 },
            writing: { total: 0, correct: 0, count: 0 }
        };

        submissions?.forEach(sub => {
            if (sub.math_total_questions > 0) {
                subjectPerformance.math.total += sub.math_total_questions;
                subjectPerformance.math.correct += sub.math_raw_score || 0;
                subjectPerformance.math.count++;
            }
            if (sub.reading_total_questions > 0) {
                subjectPerformance.reading.total += sub.reading_total_questions;
                subjectPerformance.reading.correct += sub.reading_raw_score || 0;
                subjectPerformance.reading.count++;
            }
            if (sub.writing_total_questions > 0) {
                subjectPerformance.writing.total += sub.writing_total_questions;
                subjectPerformance.writing.correct += sub.writing_raw_score || 0;
                subjectPerformance.writing.count++;
            }
        });

        const subjectStats = {};
        Object.keys(subjectPerformance).forEach(subject => {
            const data = subjectPerformance[subject];
            subjectStats[subject] = {
                average_percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100 * 10) / 10 : 0,
                total_questions: data.total,
                total_tests: data.count
            };
        });

        // Progress trend (weekly)
        const progressTrend = [];
        if (submissions && submissions.length > 0) {
            const weeklyData = {};
            submissions.forEach(sub => {
                const weekStart = new Date(sub.created_at);
                weekStart.setHours(0, 0, 0, 0);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const weekKey = weekStart.toISOString().split('T')[0];

                if (!weeklyData[weekKey]) {
                    weeklyData[weekKey] = { scores: [], date: weekKey };
                }
                weeklyData[weekKey].scores.push(sub.raw_score_percentage || 0);
            });

            Object.values(weeklyData).forEach(week => {
                progressTrend.push({
                    week: week.date,
                    average_score: Math.round((week.scores.reduce((a, b) => a + b, 0) / week.scores.length) * 10) / 10,
                    test_count: week.scores.length
                });
            });

            progressTrend.sort((a, b) => new Date(a.week) - new Date(b.week));
        }

        res.json({
            group_name: group.name,
            total_students: memberIds.length,
            total_tests: totalTests,
            average_score: Math.round(avgScore * 10) / 10,
            top_performers: topPerformers,
            low_performers: lowPerformers,
            subject_performance: subjectStats,
            progress_trend: progressTrend
        });

    } catch (error) {
        console.error('Get group analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/groups/compare
 * Compare performance between multiple groups
 */
router.get('/groups/compare', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupIds } = req.query; // Comma-separated group IDs

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!groupIds) {
            return res.status(400).json({ error: 'Group IDs required' });
        }

        const groupIdArray = groupIds.split(',').map(id => parseInt(id));

        // Verify all groups belong to the tutor
        const { data: groups } = await supabase
            .from('student_groups')
            .select('id, name, course_id')
            .in('id', groupIdArray)
            .eq('created_by', userId);

        if (!groups || groups.length === 0) {
            return res.status(404).json({ error: 'No groups found' });
        }

        const comparison = [];

        for (const group of groups) {
            // Get members
            const { data: members } = await supabase
                .from('group_members')
                .select('student_id')
                .eq('group_id', group.id);

            const memberIds = members?.map(m => m.student_id) || [];

            // Get submissions
            const { data: submissions } = await supabase
                .from('test_submissions')
                .select('raw_score_percentage, scaled_score')
                .eq('course_id', group.course_id)
                .in('user_id', memberIds);

            const avgScore = submissions && submissions.length > 0
                ? submissions.reduce((sum, s) => sum + (s.raw_score_percentage || 0), 0) / submissions.length
                : 0;

            const avgScaledScore = submissions && submissions.length > 0
                ? submissions.reduce((sum, s) => sum + (s.scaled_score || 0), 0) / submissions.length
                : 0;

            comparison.push({
                group_id: group.id,
                group_name: group.name,
                student_count: memberIds.length,
                total_tests: submissions?.length || 0,
                average_score: Math.round(avgScore * 10) / 10,
                average_scaled_score: Math.round(avgScaledScore)
            });
        }

        res.json({ comparison });

    } catch (error) {
        console.error('Compare groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
