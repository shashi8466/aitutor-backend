/**
 * Admin Routes for Group Management
 * Endpoints for admin to manage all groups and tutor assignments
 */

import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

/**
 * GET /api/admin/groups
 * Get all groups across all tutors
 */
router.get('/groups', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get all groups with tutor and course info
        const { data: groups, error } = await supabase
            .from('student_groups')
            .select(`
                *,
                course:courses(id, name),
                creator:profiles!created_by(id, name, email),
                member_count:group_members(count)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all groups:', error);
            return res.status(500).json({ error: 'Failed to fetch groups' });
        }

        // Format groups
        const formattedGroups = (groups || []).map(g => ({
            ...g,
            member_count: g.member_count?.[0]?.count || 0,
            tutor_name: g.creator?.name || 'Unknown',
            tutor_email: g.creator?.email
        }));

        res.json({ groups: formattedGroups });

    } catch (error) {
        console.error('Get all groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/tutors/:tutorId/groups
 * Get all groups for a specific tutor
 */
router.get('/tutors/:tutorId/groups', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { tutorId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { data: groups, error } = await supabase
            .from('student_groups')
            .select(`
                *,
                course:courses(id, name),
                member_count:group_members(count)
            `)
            .eq('created_by', tutorId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tutor groups:', error);
            return res.status(500).json({ error: 'Failed to fetch groups' });
        }

        const formattedGroups = (groups || []).map(g => ({
            ...g,
            member_count: g.member_count?.[0]?.count || 0
        }));

        res.json({ groups: formattedGroups });

    } catch (error) {
        console.error('Get tutor groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/groups/:groupId/assign-tutor
 * Reassign a group to a different tutor
 */
router.post('/groups/:groupId/assign-tutor', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { tutorId } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Verify new tutor exists and is a tutor
        const { data: tutor } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', tutorId)
            .single();

        if (!tutor || tutor.role !== 'tutor') {
            return res.status(400).json({ error: 'Invalid tutor ID' });
        }

        // Update group
        const { error } = await supabase
            .from('student_groups')
            .update({ created_by: tutorId, updated_at: new Date().toISOString() })
            .eq('id', groupId);

        if (error) {
            console.error('Error reassigning group:', error);
            return res.status(500).json({ error: 'Failed to reassign group' });
        }

        res.json({ success: true, message: 'Group reassigned successfully' });

    } catch (error) {
        console.error('Reassign group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/groups/:groupId/assign-students
 * Bulk assign students to a group
 */
router.post('/groups/:groupId/assign-students', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { studentIds } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ error: 'Student IDs array required' });
        }

        const membersToInsert = studentIds.map(sid => ({
            group_id: groupId,
            student_id: sid
        }));

        const { error } = await supabase
            .from('group_members')
            .upsert(membersToInsert, { onConflict: 'group_id, student_id' });

        if (error) {
            console.error('Error assigning students:', error);
            return res.status(500).json({ error: 'Failed to assign students' });
        }

        res.json({ success: true, message: `${studentIds.length} students assigned` });

    } catch (error) {
        console.error('Bulk assign students error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/unassigned-students
 * Get students not assigned to any group for a specific course
 */
router.get('/unassigned-students', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!courseId) {
            return res.status(400).json({ error: 'Course ID required' });
        }

        // Get all students enrolled in the course
        const { data: enrolledStudents } = await supabase
            .from('enrollments')
            .select('user_id, profiles!inner(id, name, email)')
            .eq('course_id', courseId);

        // Get all students already in groups for this course
        const { data: groups } = await supabase
            .from('student_groups')
            .select('id')
            .eq('course_id', courseId);

        const groupIds = groups?.map(g => g.id) || [];

        let assignedStudentIds = [];
        if (groupIds.length > 0) {
            const { data: members } = await supabase
                .from('group_members')
                .select('student_id')
                .in('group_id', groupIds);

            assignedStudentIds = members?.map(m => m.student_id) || [];
        }

        // Filter unassigned students
        const unassignedStudents = enrolledStudents
            ?.filter(e => !assignedStudentIds.includes(e.user_id))
            .map(e => ({
                id: e.user_id,
                name: e.profiles?.name,
                email: e.profiles?.email
            })) || [];

        res.json({ students: unassignedStudents });

    } catch (error) {
        console.error('Get unassigned students error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/admin/groups/:groupId
 * Admin delete any group
 */
router.delete('/groups/:groupId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
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
        console.error('Admin delete group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
