/**
 * Tutor Routes
 * Endpoints for tutor-specific functionality
 */

import express from 'express';
import crypto from 'crypto';
import supabase from '../../supabase/supabaseAdmin.js';
import { analyticsService } from '../services/analyticsService.js';

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
                // 2. Global enrollment data for unique student count
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
                
                // Process Overall Stats
                if (enrollmentDataRes.data) {
                    const uniqueIds = new Set(enrollmentDataRes.data.map(e => String(e.user_id)));
                    stats.totalStudents = uniqueIds.size;
                    stats.totalEnrollments = enrollmentDataRes.data.length;
                }

                stats.totalCourses = courses.length;

                // Process Recent Activity
                recentSubmissions = submissionsRes.data || [];
                stats.recentTests = recentSubmissions.length;

            } catch (innerError) {
                console.error('❌ [TUTOR DASHBOARD] Query error:', innerError);
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
 * Get students in tutor's courses - OPTIMIZED with RPC
 */
router.get('/students', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Use RPC for all heavy joins and counting
        const { data: students, error } = await supabase.rpc('get_tutor_students', {
            course_filter: courseId ? parseInt(courseId) : null,
            requested_user_id: userId
        });

        if (error) {
            console.error('❌ [STUDENTS] Error fetching tutor students:', error);
            return res.status(500).json({
                error: 'Failed to fetch students',
                details: error.message
            });
        }

        // The RPC already returns formatted students with progress_count
        res.json({ students: students || [] });

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

        if (!isAdmin) {
            // Check if student is in any of tutor's courses
            const { data: studentEnrollments } = await supabase
                .from('enrollments')
                .select('course_id')
                .eq('user_id', studentId)
                .in('course_id', assignedCourses);

            if (!studentEnrollments || studentEnrollments.length === 0) {
                return res.status(403).json({ error: 'Not authorized for this student' });
            }
        }

        // Get student info
        const { data: student } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', studentId)
            .single();

        // Get test submissions (only those with scores/attempts)
        let query = supabase
            .from('test_submissions')
            .select('id, user_id, course_id, level, raw_score, scaled_score, math_scaled_score, reading_scaled_score, total_questions, raw_score_percentage, test_duration_seconds, is_completed, test_date, created_at, course:courses(name)')
            .eq('user_id', studentId)
            .not('raw_score_percentage', 'is', null);

        if (!isAdmin) {
            query = query.in('course_id', assignedCourses);
        }

        const { data: submissions } = await query.order('created_at', { ascending: false });

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
                member_count: Number(count),
                invite_token: g.invite_token || g.assigned_content?.invite_token
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

        const { data: group, error } = await supabase
            .from('student_groups')
            .insert({
                name,
                assigned_content: assigned_content || {},
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
        const { name, assigned_content, assigned_course_ids, description, status, visibility, tutor_notes } = req.body;

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

        if (!isAdmin && group.created_by !== userId) {
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
        if (status !== undefined) updateData.status = status;
        if (visibility !== undefined) updateData.visibility = visibility;
        if (tutor_notes !== undefined) updateData.tutor_notes = tutor_notes;

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

        if (!isAdmin && !isCreator) {
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

        if (!group || (!isAdmin && !isOwner)) {
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

        if (!group || (!isAdmin && !isOwner)) {
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

        console.log(`🔐 [AUTH] Group Access - User: ${userId}, Role: ${profile?.role}, Group Owner: ${group.created_by}, isAdmin: ${isAdmin}, isOwner: ${isOwner}`);

        if (!isAdmin && !isOwner) {
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

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (profile?.role === 'admin') return next();

        const { data: group } = await supabase.from('student_groups').select('created_by').eq('id', req.params.groupId).single();
        if (!group || group.created_by !== userId) return res.status(403).json({ error: 'Forbidden' });
        
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

        // Verify all groups belong to the tutor
        const { data: groups } = await supabase
            .from('student_groups')
            .select('id, name, assigned_course_ids')
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

export default router;
