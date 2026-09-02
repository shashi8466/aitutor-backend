/**
 * Tutor Routes
 * Endpoints for tutor-specific functionality
 */

import express from 'express';
import crypto from 'crypto';
import supabase from '../../supabase/supabaseAdmin.js';
import { analyticsService } from '../services/analyticsService.js';
import { isCoTutorOf, getCoTutorGroupIds, getTutorGroupStudentIds } from '../utils/groupTutors.js';

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

/**
 * Supabase/PostgREST caps unpaginated selects at 1000 rows. A tutor with many students across
 * many assigned courses can easily have more enrollment/submission rows than that (confirmed:
 * one production tutor has 2600+ enrollment rows), which would silently truncate aggregation
 * results in an order-dependent (effectively random) way. Page through all rows instead -
 * mirrors the same pattern already used in src/server/utils/prep365KB.js.
 * `queryFactory` must return a fresh Supabase query builder each call (so `.range()` can be
 * applied per page).
 */
const fetchAllRows = async (queryFactory) => {
    const pageSize = 1000;
    let from = 0;
    const allRows = [];
    while (true) {
        const { data, error } = await queryFactory().range(from, from + pageSize - 1);
        if (error) return { data: null, error };
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return { data: allRows, error: null };
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
 * Get tutor dashboard data - OPTIMIZED
 */
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 1. Get profile (cached/fast)
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

        // Tutors need approval
        if (profile.role === 'tutor' && !profile.tutor_approved) {
            return res.status(403).json({
                error: 'Tutor account pending approval',
                pending: true
            });
        }

        const isAdmin = profile.role === 'admin';
        const assignedCourses = getAssignedCourses(profile);
        console.log(`📊 [TUTOR DASHBOARD] User: ${userId}, Role: ${profile.role}, Optimized Assigned Courses:`, assignedCourses);

        // DEFAULT DATA
        let stats = {
            totalCourses: 0,
            totalStudents: 0,
            totalEnrollments: 0,
            recentTests: 0
        };
        let courses = [];
        let recentSubmissions = [];

        if (assignedCourses.length > 0) {
            try {
                // PARALLELIZE OPTIMIZED FLOW
                // 1. Courses with counts via RPC (Single call, fast)
                // 2. Global enrollment data (admin's "total students" and totalEnrollments)
                // 3. Recent activity
                const [coursesRes, enrollmentDataRes, submissionsRes] = await Promise.all([
                    supabase.rpc('get_tutor_courses', { requested_user_id: userId }),

                    supabase
                        .from('enrollments')
                        .select('user_id')
                        .in('course_id', assignedCourses),

                    supabase
                        .from('test_submissions')
                        .select('*, user:profiles!user_id(name, email)')
                        .in('course_id', assignedCourses)
                        .order('created_at', { ascending: false })
                        .limit(10)
                ]);

                // Process Courses
                courses = coursesRes.data || [];

                // Process Overall Stats. For a tutor, "total students" is overridden below by
                // group membership - this assigned_courses-based count is only used for admins.
                if (enrollmentDataRes.data) {
                    stats.totalEnrollments = enrollmentDataRes.data.length;
                    if (isAdmin) {
                        const uniqueIds = new Set(enrollmentDataRes.data.map(e => String(e.user_id)));
                        stats.totalStudents = uniqueIds.size;
                    }
                }

                stats.totalCourses = courses.length;

                // Process Recent Activity
                recentSubmissions = submissionsRes.data || [];
                stats.recentTests = recentSubmissions.length;

            } catch (innerError) {
                console.error('❌ [TUTOR DASHBOARD] Query error:', innerError);
            }
        }

        // "Total/Active Students" (sidebar stat + Dashboard Overview card) reflects the tutor's
        // own Student Groups, same "my students" definition as the Student Roster - not the
        // broader assigned_courses enrollment count. Independent of the assignedCourses gate
        // above, since a tutor can have groups/students without any directly assigned course.
        if (!isAdmin) {
            try {
                const groupStudentIds = await getTutorGroupStudentIds(supabase, userId);
                stats.totalStudents = groupStudentIds.length;
            } catch (groupErr) {
                console.error('❌ [TUTOR DASHBOARD] Group student count error:', groupErr);
            }
        }

        console.log(`✅ [TUTOR DASHBOARD] Stats: ${stats.totalCourses} courses, ${stats.totalEnrollments} enrollments, ${stats.totalStudents} students`);

        res.json({
            profile,
            courses: courses,
            total_students: stats.totalStudents,
            total_enrollments: stats.totalEnrollments,
            recentActivity: recentSubmissions,
            stats
        });

    } catch (error) {
        console.error('💥 [TUTOR DASHBOARD] Fatal error:', error);
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
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Use RPC directly for efficiency
        const { data: courses, error } = await supabase.rpc('get_tutor_courses', { 
            requested_user_id: userId 
        });

        if (error) {
            console.error('❌ [COURSES] Error fetching tutor courses:', error);
            return res.status(500).json({ error: 'Failed to fetch courses' });
        }

        res.json({ courses: courses || [] });

    } catch (error) {
        console.error('Tutor courses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/students
 * Get students in the tutor's own Student Groups (owned or co-tutored) - one row per student,
 * courses/tests/progress aggregated across all of their enrollments (not one row per enrollment).
 * Deliberately scoped to group membership, not profiles.assigned_courses - a tutor may be
 * assigned to teach a course with far more enrolled students than they've actually organized
 * into their own groups. Admins remain unscoped.
 */
router.get('/students', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, assigned_courses')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const isAdmin = profile.role === 'admin';
        const parsedCourseId = courseId ? parseInt(courseId) : null;

        // Tutor Student Roster is scoped to students who are members of a Student Group this
        // tutor owns or co-tutors - NOT every student enrolled in a course the tutor happens to
        // be assigned to teach (profiles.assigned_courses is a broader course-staffing concept
        // that can include students the tutor has never actually grouped/organized). Admins stay
        // unscoped, matching every other admin bypass in this file.
        let rosterStudentIds = null; // null = unscoped (admin)
        if (!isAdmin) {
            rosterStudentIds = await getTutorGroupStudentIds(supabase, userId);
            if (rosterStudentIds.length === 0) {
                return res.json({ students: [] });
            }
        }

        const { data: enrollments, error: enrollError } = await fetchAllRows(() => {
            let q = supabase.from('enrollments').select('user_id, course_id, enrolled_at');
            if (rosterStudentIds) q = q.in('user_id', rosterStudentIds);
            if (parsedCourseId) q = q.eq('course_id', parsedCourseId);
            return q;
        });

        if (enrollError) {
            console.error('❌ [STUDENTS] Error fetching enrollments:', enrollError);
            return res.status(500).json({ error: 'Failed to fetch students', details: enrollError.message });
        }

        // The roster set to render: the group's full membership when no course filter is
        // active (so a group member with zero enrollments yet still shows up, with 0
        // courses/tests - the per-student fallback below already handles that), narrowed to
        // just the enrolled-in-that-course subset when a courseId filter is active. Admins have
        // no group scope, so they're exactly the set of enrolled students, as before.
        const studentIds = rosterStudentIds
            ? (parsedCourseId ? [...new Set((enrollments || []).map(e => e.user_id))] : rosterStudentIds)
            : [...new Set((enrollments || []).map(e => e.user_id))];

        if (studentIds.length === 0) {
            return res.json({ students: [] });
        }

        const distinctEnrolledCourseIds = [...new Set((enrollments || []).map(e => e.course_id))];
        // An empty .in() array is unreliable across supabase-js/PostgREST versions (some treat it
        // as "no filter" rather than "match nothing") - the [-1] sentinel guarantees "show
        // nothing" instead of risking every test_submissions row in the system, same convention
        // used elsewhere in this codebase (analyticsService.js) for the identical scenario.
        const courseIdsForSubmissions = distinctEnrolledCourseIds.length > 0 ? distinctEnrolledCourseIds : [-1];

        const [{ data: profiles, error: profilesError }, { data: submissions, error: submissionsError }] = await Promise.all([
            fetchAllRows(() => supabase.from('profiles').select('id, name, email').in('id', studentIds).eq('role', 'student')),
            fetchAllRows(() => supabase.from('test_submissions')
                .select('user_id, course_id, raw_score_percentage, created_at')
                .in('user_id', studentIds)
                .in('course_id', courseIdsForSubmissions))
        ]);

        if (profilesError) {
            console.error('❌ [STUDENTS] Error fetching profiles:', profilesError);
            return res.status(500).json({ error: 'Failed to fetch students', details: profilesError.message });
        }
        if (submissionsError) {
            console.error('❌ [STUDENTS] Error fetching submissions:', submissionsError);
            return res.status(500).json({ error: 'Failed to fetch students', details: submissionsError.message });
        }

        const byStudent = {};
        (enrollments || []).forEach(e => {
            if (!byStudent[e.user_id]) {
                byStudent[e.user_id] = { courseIds: new Set(), lastEnrolled: e.enrolled_at, tests: 0, scoreSum: 0, lastActivity: null };
            }
            const b = byStudent[e.user_id];
            b.courseIds.add(e.course_id);
            if (!b.lastEnrolled || new Date(e.enrolled_at) > new Date(b.lastEnrolled)) {
                b.lastEnrolled = e.enrolled_at;
            }
        });

        (submissions || []).forEach(s => {
            const b = byStudent[s.user_id];
            if (!b) return;
            b.tests++;
            b.scoreSum += (s.raw_score_percentage || 0);
            if (!b.lastActivity || new Date(s.created_at) > new Date(b.lastActivity)) {
                b.lastActivity = s.created_at;
            }
        });

        const students = (profiles || []).map(p => {
            const b = byStudent[p.id] || { courseIds: new Set(), tests: 0, scoreSum: 0, lastActivity: null, lastEnrolled: null };
            return {
                id: p.id,
                name: p.name,
                email: p.email,
                courses_count: b.courseIds.size,
                tests_attempted: b.tests,
                overall_progress: b.tests > 0 ? Math.round(b.scoreSum / b.tests) : 0,
                // Deliberately NOT falling back to enrollment date: a student who enrolled
                // recently but never actually did anything (no test activity) must show as
                // having no meaningful activity, not as "recently active" - the frontend status
                // classification (Active/Inactive/Needs Attention) depends on this being null
                // when nothing real has happened yet.
                last_activity: b.lastActivity
            };
        }).sort((a, b) => new Date(b.last_activity || 0) - new Date(a.last_activity || 0));

        res.json({ students });

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

        // Verify user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('assigned_courses, role')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const isAdmin = profile.role === 'admin';
        const assignedCourses = getAssignedCourses(profile);

        // Get the student's enrollments (scoped to the tutor's assigned courses; unscoped for
        // admin), joined to course subject info - doubles as the tutor authorization check below
        // and feeds the profile page's Courses tab.
        const { data: enrollments } = await fetchAllRows(() => {
            let q = supabase
                .from('enrollments')
                .select('course_id, enrolled_at, course:courses(id, name, tutor_type, main_category, category, is_adaptive)')
                .eq('user_id', studentId);
            if (!isAdmin) q = q.in('course_id', assignedCourses);
            return q;
        });

        if (!isAdmin && (!enrollments || enrollments.length === 0)) {
            return res.status(403).json({ error: 'Not authorized for this student' });
        }

        // Get student info
        const { data: student } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', studentId)
            .single();

        // Get test submissions (only those with scores/attempts)
        const { data: submissions } = await fetchAllRows(() => {
            let q = supabase
                .from('test_submissions')
                .select('id, user_id, course_id, level, raw_score, scaled_score, math_scaled_score, reading_scaled_score, total_questions, raw_score_percentage, correct_questions, incorrect_questions, test_duration_seconds, is_completed, test_date, created_at, course:courses(name, tutor_type, main_category, category, is_adaptive)')
                .eq('user_id', studentId)
                .not('raw_score_percentage', 'is', null)
                .order('created_at', { ascending: false });
            if (!isAdmin) q = q.in('course_id', assignedCourses);
            return q;
        });

        // Get progress records
        const { data: progress } = await fetchAllRows(() =>
            supabase.from('student_progress').select('*').eq('user_id', studentId)
        );

        res.json({
            student,
            submissions: submissions || [],
            progress: progress || [],
            enrollments: enrollments || []
        });

    } catch (error) {
        console.error('Student progress error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/students/:studentId/recent-tests
 * A student's 10 most recently completed tests, for the Student Roster's expandable row - same
 * "scoped to the tutor's assigned_courses, admin bypass" authorization as /student-progress above
 * (a separate, additive check - that existing route is not modified), one row per completed
 * submission (not combined Easy+Medium+Hard like completedAttempts/getStudentDashboard).
 */
router.get('/students/:studentId/recent-tests', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { studentId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('assigned_courses, role')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const isAdmin = profile.role === 'admin';
        const assignedCourses = getAssignedCourses(profile);

        if (!isAdmin) {
            const { data: enrollments } = await fetchAllRows(() =>
                supabase.from('enrollments').select('course_id').eq('user_id', studentId).in('course_id', assignedCourses)
            );
            const hasEnrollmentAccess = Boolean(enrollments && enrollments.length > 0);
            // Fallback path: the Student Roster now lists students by group membership, not
            // assigned_courses enrollment, so a group member without a matching enrollment must
            // still be allowed to open here - purely additive, never removes the check above.
            const hasGroupAccess = hasEnrollmentAccess
                ? true
                : (await getTutorGroupStudentIds(supabase, userId)).includes(studentId);
            if (!hasEnrollmentAccess && !hasGroupAccess) {
                return res.status(403).json({ error: 'Not authorized for this student' });
            }
        }

        const tests = await analyticsService.getRecentCompletedTests(studentId, isAdmin ? null : assignedCourses, 10);
        res.json({ tests });
    } catch (error) {
        console.error('Recent completed tests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/student-topic-report/:studentId/:courseId
 * Combined Easy+Medium+Hard report for one of the tutor's students, reached from Test History -
 * same authorization as GET /student-progress/:studentId (assigned_courses, or admin bypass) and
 * the same analyticsService.getTopicCombinedReport data the group-scoped topic-report route and
 * the student's own /student/topic-report/:courseId use - no separate calculation.
 */
router.get('/student-topic-report/:studentId/:courseId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { studentId, courseId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('assigned_courses, role')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const isAdmin = profile.role === 'admin';
        const assignedCourses = getAssignedCourses(profile);

        if (!isAdmin && !assignedCourses.includes(parseInt(courseId))) {
            return res.status(403).json({ error: 'Not authorized to view this course' });
        }

        // groupId is unused inside getTopicCombinedReport - only course_id/user_id matter -
        // this route's own authorization above stands in for the group-scoped one.
        const data = await analyticsService.getTopicCombinedReport(null, studentId, courseId);
        res.json(data);
    } catch (error) {
        console.error('Student topic report error:', error);
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

        const coTutorGroupIds = await getCoTutorGroupIds(supabase, userId);

        let query = supabase
            .from('student_groups')
            .select(`
                *,
                course:courses(id, name),
                member_count:group_members(count)
            `);

        query = coTutorGroupIds.length > 0
            ? query.or(`created_by.eq.${userId},id.in.(${coTutorGroupIds.join(',')})`)
            : query.eq('created_by', userId);

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
                member_count: Number(count),
                invite_token: g.invite_token || g.assigned_content?.invite_token,
                isOwner: g.created_by === userId
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
        const { name, assigned_content, assigned_course_ids, description } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const inviteToken = crypto.randomUUID();

        const { data: group, error } = await supabase
            .from('student_groups')
            .insert({
                name,
                assigned_content: { ...(assigned_content || {}), invite_token: inviteToken },
                assigned_course_ids: assigned_course_ids || [],
                course_id: assigned_course_ids?.[0] || 1, // Bypass NOT NULL constraint until schema is updated
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
 * PUT /api/tutor/groups/:groupId
 * Update a student group
 */
router.put('/groups/:groupId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { name, assigned_content, assigned_course_ids, description } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        // Verify group belongs to tutor or tutor is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.role === 'admin';

        const { data: group } = await supabase
            .from('student_groups')
            .select('created_by, assigned_content')
            .eq('id', groupId)
            .single();

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (!isAdmin && group.created_by !== userId && !(await isCoTutorOf(supabase, groupId, userId))) {
            return res.status(403).json({ error: 'Not authorized to edit this group' });
        }

        const updateData = {
            name,
            description
        };

        if (assigned_content !== undefined) {
            updateData.assigned_content = assigned_content;
            if (group.assigned_content?.invite_token) {
                updateData.assigned_content.invite_token = group.assigned_content.invite_token;
            }
        }
        if (assigned_course_ids !== undefined) updateData.assigned_course_ids = assigned_course_ids;

        const { data: updatedGroup, error } = await supabase
            .from('student_groups')
            .update(updateData)
            .eq('id', groupId)
            .select()
            .single();

        if (error) {
            console.error('❌ [GROUPS] Error updating group:', error);
            // If the error is about a column not existing (PostgREST PGRST204 or Postgres 42703)
            if (error.code === '42703' || error.code === 'PGRST204') {
                const basicUpdateData = { name, description };
                const { data: basicUpdated, error: basicError } = await supabase
                    .from('student_groups')
                    .update(basicUpdateData)
                    .eq('id', groupId)
                    .select()
                    .single();
                    
                if (basicError) {
                    return res.status(500).json({ error: 'Failed to update group' });
                }
                return res.json({ group: basicUpdated });
            }
            return res.status(500).json({ error: 'Failed to update group' });
        }

        res.json({ group: updatedGroup });

    } catch (error) {
        console.error('Update group error:', error);
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
            .select('created_by')
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
        const isCreator = group.created_by === userId;

        if (!isAdmin && !isCreator && !(await isCoTutorOf(supabase, groupId, userId))) {
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
 * GET /api/tutor/groups/:groupId/available-students
 * Get all students not in this specific group
 */
router.get('/groups/:groupId/available-students', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const { data: group } = await supabase.from('student_groups').select('created_by').eq('id', groupId).single();

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const isAdmin = profile?.role === 'admin';
        const isOwner = group.created_by === userId;
        if (!isAdmin && !isOwner && !(await isCoTutorOf(supabase, groupId, userId))) {
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        // 1. Get IDs of students already in this group
        const { data: members } = await supabase
            .from('group_members')
            .select('student_id')
            .eq('group_id', groupId);

        const assignedStudentIds = members?.map(m => m.student_id) || [];

        // 2. Get all student profiles
        const { data: students, error: sError } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('role', 'student');

        if (sError) throw sError;

        const availableStudents = (students || [])
            .filter(s => !assignedStudentIds.includes(s.id));

        res.json({ students: availableStudents });

    } catch (error) {
        console.error('Get available students error:', error);
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

        // Verify group belongs to tutor or user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const { data: group } = await supabase
            .from('student_groups')
            .select('created_by')
            .eq('id', groupId)
            .single();

        const isAdmin = profile?.role === 'admin';
        const isOwner = group?.created_by === userId;
        const isCoTutor = !isAdmin && !isOwner && !!group && await isCoTutorOf(supabase, groupId, userId);

        if (!group || (!isAdmin && !isOwner && !isCoTutor)) {
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
 * DELETE /api/tutor/groups/:groupId/members
 * Bulk-remove multiple students from a group in one query (body: { studentIds: [...] }) - same
 * authorization as the single-student DELETE above, just applied once instead of per-request so
 * removing e.g. 50 students out of 100 doesn't need 50 round-trips.
 */
router.delete('/groups/:groupId/members', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { studentIds } = req.body; // Array of UUIDs

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ error: 'studentIds must be a non-empty array' });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const { data: group } = await supabase
            .from('student_groups')
            .select('created_by')
            .eq('id', groupId)
            .single();

        const isAdmin = profile?.role === 'admin';
        const isOwner = group?.created_by === userId;
        const isCoTutor = !isAdmin && !isOwner && !!group && await isCoTutorOf(supabase, groupId, userId);

        if (!group || (!isAdmin && !isOwner && !isCoTutor)) {
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .in('student_id', studentIds);

        if (error) {
            console.error('Error bulk-removing members:', error);
            return res.status(500).json({ error: 'Failed to remove members' });
        }

        res.json({ success: true, removed: studentIds.length });

    } catch (error) {
        console.error('Bulk remove members error:', error);
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

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const { data: group } = await supabase.from('student_groups').select('created_by').eq('id', groupId).single();

        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const isAdmin = profile?.role === 'admin';
        if (!isAdmin && group.created_by !== userId) {
            return res.status(403).json({ error: 'Only the group owner or an admin can delete this group' });
        }

        const { error } = await supabase
            .from('student_groups')
            .delete()
            .eq('id', groupId);

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
 * POST /api/tutor/groups/:groupId/invite-token
 * Generate or regenerate an invitation token for a group
 */
router.post('/groups/:groupId/invite-token', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify group belongs to tutor or user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const { data: group } = await supabase
            .from('student_groups')
            .select('created_by, assigned_content')
            .eq('id', groupId)
            .single();

        const isAdmin = profile?.role === 'admin';
        const isOwner = group?.created_by === userId;
        const isCoTutor = !isAdmin && !isOwner && !!group && await isCoTutorOf(supabase, groupId, userId);

        if (!group || (!isAdmin && !isOwner && !isCoTutor)) {
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        const newToken = crypto.randomUUID();
        
        // Use assigned_content to store the invite token to avoid schema errors
        const newAssignedContent = { ...(group.assigned_content || {}), invite_token: newToken };

        const { data: updatedGroup, error } = await supabase
            .from('student_groups')
            .update({ assigned_content: newAssignedContent })
            .eq('id', groupId)
            .select('assigned_content')
            .single();

        if (error) {
            console.error('Error generating invite token:', error);
            return res.status(500).json({ error: 'Failed to generate token' });
        }

        res.json({ token: newToken });

    } catch (error) {
        console.error('Generate token error:', error);
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

        // Verify group ownership or admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error(`❌ [AUTH] Profile error for user ${userId}:`, profileError);
            return res.status(403).json({ error: 'User profile not found or role missing' });
        }

        const { data: group, error: groupError } = await supabase
            .from('student_groups')
            .select('created_by, assigned_course_ids')
            .eq('id', groupId)
            .single();

        if (groupError || !group) {
            console.error(`❌ [AUTH] Group error for ID ${groupId}:`, groupError);
            return res.status(404).json({ error: 'Group not found' });
        }

        const isAdmin = profile?.role === 'admin';
        const isOwner = group.created_by === userId;
        const isCoTutor = !isAdmin && !isOwner && await isCoTutorOf(supabase, groupId, userId);

        console.log(`🔐 [AUTH] Group Access - User: ${userId}, Role: ${profile?.role}, Group Owner: ${group.created_by}, isAdmin: ${isAdmin}, isOwner: ${isOwner}, isCoTutor: ${isCoTutor}`);

        if (!isAdmin && !isOwner && !isCoTutor) {
            console.warn(`🚫 [AUTH] Access Denied - User ${userId} (${profile?.role}) tried to access group ${groupId} owned by ${group.created_by}`);
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        // Get group members with their profiles
        const { data: members, error: membersError } = await supabase
            .from('group_members')
            .select(`
                student_id,
                created_at,
                student:profiles!student_id(
                    id, 
                    name, 
                    email,
                    student_progress(count)
                )
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
            .in('course_id', group.assigned_course_ids || [])
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
                last_test_date: latestSubmission?.created_at || null,
                progress_count: member.student?.student_progress?.[0]?.count || 0
            };
        });

        res.json({ members: membersWithPerformance });

    } catch (error) {
        console.error('Get group members error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
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
            assigned_course_ids: group.assigned_course_ids,
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
 * --- HIERARCHICAL ANALYTICS ROUTES ---
 */

const verifyTutorAccess = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Independent of each other - run concurrently instead of two sequential round-trips.
        // This middleware guards every hierarchical analytics route, so the time saved here
        // stacks across every drill-down level a tutor clicks through (measured ~260ms/request).
        const [{ data: profile }, { data: group }] = await Promise.all([
            supabase.from('profiles').select('role').eq('id', userId).single(),
            supabase.from('student_groups').select('created_by').eq('id', req.params.groupId).single()
        ]);

        if (profile?.role === 'admin') return next();
        if (!group) return res.status(403).json({ error: 'Forbidden' });
        if (group.created_by !== userId && !(await isCoTutorOf(supabase, req.params.groupId, userId))) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    } catch (err) {
        res.status(500).json({ error: 'Internal error validating access' });
    }
};

// 1. Group Level
router.get('/groups/:groupId/analytics/dashboard', verifyTutorAccess, async (req, res) => {
    try {
        const data = await analyticsService.getGroupDashboard(req.params.groupId);
        res.json(data);
    } catch (error) {
        console.error('Group Dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Student Level
router.get('/groups/:groupId/analytics/students/:studentId', verifyTutorAccess, async (req, res) => {
    try {
        const data = await analyticsService.getStudentDashboard(req.params.groupId, req.params.studentId);
        res.json(data);
    } catch (error) {
        console.error('Student Dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/tutor/groups/:groupId/analytics/students/:studentId/recent-tests
 * A student's completed tests for the Student Performance table's expandable row, scoped
 * STRICTLY to this group's assigned_course_ids via the same _getGroupScope every other
 * group-analytics route in this file uses - never the student's tests from any other group.
 */
router.get('/groups/:groupId/analytics/students/:studentId/recent-tests', verifyTutorAccess, async (req, res) => {
    try {
        const { assignedCourseIds } = await analyticsService._getGroupScope(req.params.groupId);
        const tests = await analyticsService.getRecentCompletedTests(req.params.studentId, assignedCourseIds, null);
        res.json({ tests });
    } catch (error) {
        console.error('Group recent completed tests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Course Level
router.get('/groups/:groupId/analytics/students/:studentId/courses/:courseName', verifyTutorAccess, async (req, res) => {
    try {
        const data = await analyticsService.getCourseAnalytics(req.params.groupId, req.params.studentId, req.params.courseName);
        res.json(data);
    } catch (error) {
        console.error('Course Analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3.5 Topic Combined Level
router.get('/groups/:groupId/analytics/students/:studentId/topic-report/:courseId', verifyTutorAccess, async (req, res) => {
    try {
        const data = await analyticsService.getTopicCombinedReport(req.params.groupId, req.params.studentId, req.params.courseId);
        res.json(data);
    } catch (error) {
        console.error('Topic Combined Report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Group content drill-down (Section / Topic / Subtopic) - courseIds is a comma-separated list;
// a single id serves the Subtopic level, several serve Topic/Section.
router.get('/groups/:groupId/analytics/content', verifyTutorAccess, async (req, res) => {
    try {
        const courseIds = (req.query.courseIds || '')
            .split(',')
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id));
        const data = await analyticsService.getGroupContentAnalytics(req.params.groupId, courseIds);
        res.json(data);
    } catch (error) {
        console.error('Group content analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. Attempt Level
router.get('/groups/:groupId/analytics/attempts/:submissionId', verifyTutorAccess, async (req, res) => {
    try {
        const data = await analyticsService.getAttemptAnalytics(req.params.submissionId);
        res.json(data);
    } catch (error) {
        console.error('Attempt Analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 5. Question-Wise Level
router.get('/groups/:groupId/analytics/attempts/:submissionId/questions', verifyTutorAccess, async (req, res) => {
    try {
        const data = await analyticsService.getAttemptQuestions(req.params.submissionId);
        res.json(data);
    } catch (error) {
        console.error('Question Analytics error:', error);
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
        const coTutorGroupIds = await getCoTutorGroupIds(supabase, userId);

        // Verify each group is owned by, or co-tutored by, the requesting tutor
        let groupsQuery = supabase
            .from('student_groups')
            .select('id, name, assigned_course_ids')
            .in('id', groupIdArray);

        groupsQuery = coTutorGroupIds.length > 0
            ? groupsQuery.or(`created_by.eq.${userId},id.in.(${coTutorGroupIds.join(',')})`)
            : groupsQuery.eq('created_by', userId);

        const { data: groups } = await groupsQuery;

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
                .in('course_id', group.assigned_course_ids || [])
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

/**
 * GET /api/tutor/groups/:groupId/tutors
 * List the owner and co-tutors of a group (owner, co-tutor, or admin only)
 */
router.get('/groups/:groupId/tutors', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const { data: group } = await supabase
            .from('student_groups')
            .select('id, created_by, owner:profiles!created_by(id, name, email)')
            .eq('id', groupId)
            .single();

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const isAdmin = profile?.role === 'admin';
        const isOwner = group.created_by === userId;
        const isCoTutor = !isAdmin && !isOwner && await isCoTutorOf(supabase, groupId, userId);

        if (!isAdmin && !isOwner && !isCoTutor) {
            return res.status(403).json({ error: 'Not authorized for this group' });
        }

        const { data: coTutorRows, error } = await supabase
            .from('group_tutors')
            .select('id, tutor_id, created_at, tutor:profiles!tutor_id(id, name, email)')
            .eq('group_id', groupId);

        if (error) {
            console.error('Error fetching co-tutors:', error);
            return res.status(500).json({ error: 'Failed to fetch co-tutors' });
        }

        res.json({
            owner: group.owner,
            coTutors: (coTutorRows || []).map(r => ({
                id: r.tutor_id,
                name: r.tutor?.name,
                email: r.tutor?.email,
                added_at: r.created_at
            }))
        });
    } catch (error) {
        console.error('Get group tutors error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/tutor/groups/:groupId/tutors
 * Add a co-tutor to a group by email (owner or admin only, NOT co-tutor)
 */
router.post('/groups/:groupId/tutors', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { email } = req.body;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!email) return res.status(400).json({ error: 'Tutor email is required' });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const { data: group } = await supabase.from('student_groups').select('id, created_by').eq('id', groupId).single();
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const isAdmin = profile?.role === 'admin';
        const isOwner = group.created_by === userId;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: 'Only the group owner or an admin can add co-tutors' });
        }

        const { data: targetTutor } = await supabase
            .from('profiles')
            .select('id, name, email, role')
            .ilike('email', email.trim())
            .maybeSingle();

        if (!targetTutor) {
            return res.status(404).json({ error: 'No user found with that email' });
        }
        if (targetTutor.role !== 'tutor') {
            return res.status(400).json({ error: 'Only tutor accounts can be added as co-tutors' });
        }
        if (targetTutor.id === group.created_by) {
            return res.status(400).json({ error: 'This tutor already owns the group' });
        }

        const { error } = await supabase
            .from('group_tutors')
            .insert({ group_id: groupId, tutor_id: targetTutor.id, added_by: userId });

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'This tutor is already a co-tutor of this group' });
            }
            console.error('Error adding co-tutor:', error);
            return res.status(500).json({ error: 'Failed to add co-tutor' });
        }

        res.json({ success: true, coTutor: { id: targetTutor.id, name: targetTutor.name, email: targetTutor.email } });
    } catch (error) {
        console.error('Add co-tutor error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/tutor/groups/:groupId/tutors/:tutorId
 * Remove a co-tutor from a group (owner or admin only, NOT co-tutor)
 */
router.delete('/groups/:groupId/tutors/:tutorId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId, tutorId } = req.params;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const { data: group } = await supabase.from('student_groups').select('id, created_by').eq('id', groupId).single();
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const isAdmin = profile?.role === 'admin';
        const isOwner = group.created_by === userId;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: 'Only the group owner or an admin can remove co-tutors' });
        }

        const { error } = await supabase
            .from('group_tutors')
            .delete()
            .eq('group_id', groupId)
            .eq('tutor_id', tutorId);

        if (error) {
            console.error('Error removing co-tutor:', error);
            return res.status(500).json({ error: 'Failed to remove co-tutor' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Remove co-tutor error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
