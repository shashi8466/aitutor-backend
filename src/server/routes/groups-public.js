import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

/**
 * GET /api/groups/invite/:token
 * Public endpoint to validate an invitation token and return basic group details
 */
router.get('/invite/:token', async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const { data: group, error } = await supabase
            .from('student_groups')
            .select(`
                id,
                name,
                description,
                created_by,
                tutor:profiles!student_groups_created_by_fkey(name)
            `)
            .contains('assigned_content', { invite_token: token })
            .single();

        if (error || !group) {
            return res.status(404).json({ error: 'Invalid or expired invitation link' });
        }

        res.json({ group });
    } catch (error) {
        console.error('Validate group invite error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/groups/invite/:token/join
 * Join a group using an invitation token (requires authenticated user)
 */
router.post('/invite/:token/join', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { token } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'You must be logged in to join a group' });
        }

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        // Validate token and get group ID
        const { data: group, error } = await supabase
            .from('student_groups')
            .select('id, name, assigned_course_ids')
            .contains('assigned_content', { invite_token: token })
            .single();

        if (error || !group) {
            return res.status(404).json({ error: 'Invalid or expired invitation link' });
        }

        // Verify the user is a student
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'student') {
            return res.status(403).json({ error: 'Only students can join groups' });
        }

        // Check if already in the group
        const { data: existing } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', group.id)
            .eq('student_id', userId)
            .maybeSingle();

        if (existing) {
            // Idempotent: opening the link again should not error, just confirm membership
            return res.json({ success: true, groupId: group.id, groupName: group.name, alreadyMember: true });
        }

        // Must go through supabaseAdmin: there is no RLS policy allowing a student
        // to insert their own group_members row directly.
        const { error: insertError } = await supabase
            .from('group_members')
            .insert({
                group_id: group.id,
                student_id: userId
            });

        if (insertError) {
            console.error('Error joining group:', insertError);
            return res.status(500).json({ error: 'Failed to join the group' });
        }

        // Grant access to the group's assigned courses, same as manual enrollment,
        // so the student's course list actually reflects the new membership.
        const assignedCourseIds = Array.isArray(group.assigned_course_ids) ? group.assigned_course_ids : [];
        if (assignedCourseIds.length > 0) {
            const { error: enrollError } = await supabase
                .from('enrollments')
                .upsert(
                    assignedCourseIds.map(course_id => ({
                        user_id: userId,
                        course_id,
                        enrollment_method: 'group_invite'
                    })),
                    { onConflict: 'user_id,course_id', ignoreDuplicates: true }
                );

            if (enrollError) {
                console.error('Error enrolling student in group courses:', enrollError);
                // Don't fail the whole join over this - membership already succeeded.
            }
        }

        res.json({ success: true, groupId: group.id, groupName: group.name, alreadyMember: false });
    } catch (error) {
        console.error('Join group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
