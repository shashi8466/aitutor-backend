/**
 * Invitation Routes
 * Endpoints for student invitation links
 */

import express from 'express';
import crypto from 'crypto';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

// Helper to normalize assigned courses
const getAssignedCourses = (profile) => {
    let rawAssigned = profile?.assigned_courses || [];
    if (typeof rawAssigned === 'string') {
        try {
            rawAssigned = JSON.parse(rawAssigned);
        } catch (e) {
            rawAssigned = [];
        }
    }
    return Array.isArray(rawAssigned) ? rawAssigned.map(Number).filter(id => !isNaN(id)) : [];
};

/**
 * Generate a unique invitation code
 */
const generateInviteCode = () => {
    return crypto.randomBytes(4)
        .toString('base64')
        .replace(/[+/=]/g, '')
        .substring(0, 8)
        .toUpperCase()
        .replace(/(.{4})/, '$1-');
};

/**
 * POST /api/invitations/create
 * Create a new invitation link
 */
router.post('/create', async (req, res) => {
    try {
        const userId = req.user?.id;
        const {
            courseId,
            maxUses,
            validUntil,
            customMessage,
            allowedEmails,
            requiredEmailDomain
        } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify user is admin or tutor
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, tutor_approved, assigned_courses')
            .eq('id', userId)
            .single();

        if (!profile || (profile.role !== 'admin' && profile.role !== 'tutor')) {
            return res.status(403).json({ error: 'Only admins and tutors can create invitations' });
        }

        if (profile.role === 'tutor' && !profile.tutor_approved) {
            return res.status(403).json({ error: 'Tutor account pending approval' });
        }

        // If tutor, verify they have access to this course
        if (profile.role === 'tutor') {
            const assigned = getAssignedCourses(profile);
            if (!assigned.includes(Number(courseId))) {
                return res.status(403).json({ error: 'Not authorized for this course' });
            }
        }

        // Get course info
        const { data: course } = await supabase
            .from('courses')
            .select('*')
            .eq('id', courseId)
            .single();

        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Generate unique invite code
        let inviteCode;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            inviteCode = generateInviteCode();

            const { data: existing } = await supabase
                .from('invitation_links')
                .select('id')
                .eq('invite_code', inviteCode)
                .single();

            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            return res.status(500).json({ error: 'Failed to generate unique code' });
        }

        // Build invitation URL
        const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
        const inviteUrl = `${baseUrl}/signup?invite=${inviteCode}`;

        // Create invitation
        const { data: invitation, error } = await supabase
            .from('invitation_links')
            .insert({
                invite_code: inviteCode,
                invite_url: inviteUrl,
                created_by: userId,
                creator_role: profile.role,
                course_id: courseId,
                auto_enroll: true,
                max_uses: maxUses || null,
                valid_until: validUntil || null,
                custom_message: customMessage || null,
                allowed_emails: allowedEmails || null,
                required_email_domain: requiredEmailDomain || null
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating invitation:', error);
            return res.status(500).json({ error: 'Failed to create invitation' });
        }

        res.json({ invitation });

    } catch (error) {
        console.error('Create invitation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/invitations/validate/:inviteCode
 * Validate an invitation link (public endpoint)
 */
router.get('/validate/:inviteCode', async (req, res) => {
    try {
        const { inviteCode } = req.params;

        if (!inviteCode) {
            return res.status(400).json({ error: 'Invite code is required' });
        }

        // Use database function for validation
        const { data, error } = await supabase
            .rpc('validate_invitation_link', {
                p_invite_code: inviteCode,
                p_email: null
            });

        if (error) {
            console.error('Error validating invitation:', error);
            return res.status(500).json({ error: 'Failed to validate invitation' });
        }

        const result = data[0];

        if (!result.valid) {
            return res.status(400).json({
                valid: false,
                error: result.error_message
            });
        }

        // Get full course details
        const { data: course } = await supabase
            .from('courses')
            .select('*')
            .eq('id', result.course_id)
            .single();

        res.json({
            valid: true,
            course,
            customMessage: result.custom_message
        });

    } catch (error) {
        console.error('Validate invitation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/invitations/use
 * Track invitation use (called during signup)
 */
router.post('/use', async (req, res) => {
    try {
        const { inviteCode, email, userId, ipAddress, userAgent } = req.body;

        if (!inviteCode || !email) {
            return res.status(400).json({ error: 'Invite code and email are required' });
        }

        // Track the invitation use
        const { data, error } = await supabase
            .rpc('track_invitation_use', {
                p_invite_code: inviteCode,
                p_email: email,
                p_user_id: userId || null,
                p_ip_address: ipAddress || null,
                p_user_agent: userAgent || null
            });

        if (error) {
            console.error('Error tracking invitation use:', error);
            return res.status(500).json({ error: 'Failed to track invitation use' });
        }

        const result = data[0];

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error_message
            });
        }

        res.json({ success: true, useId: result.use_id });

    } catch (error) {
        console.error('Track invitation use error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/invitations/complete-enrollment
 * Complete enrollment after successful registration
 */
router.post('/complete-enrollment', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { inviteCode } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!inviteCode) {
            return res.status(400).json({ error: 'Invite code is required' });
        }

        // Use database function to complete enrollment
        const { data, error } = await supabase
            .rpc('complete_invitation_enrollment', {
                p_invite_code: inviteCode,
                p_user_id: userId
            });

        if (error) {
            console.error('Error completing enrollment:', error);
            return res.status(500).json({ error: 'Failed to complete enrollment' });
        }

        const result = data[0];

        if (!result.success) {
            return res.status(400).json({
                enrolled: false,
                error: result.error_message
            });
        }

        res.json({
            enrolled: true,
            enrollmentId: result.enrollment_id
        });

    } catch (error) {
        console.error('Complete enrollment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/invitations/my-invitations
 * Get invitations created by the current user
 */
router.get('/my-invitations', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: invitations, error } = await supabase
            .from('invitation_links')
            .select(`
        *,
        course:courses(id, name, description)
      `)
            .eq('created_by', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching invitations:', error);
            return res.status(500).json({ error: 'Failed to fetch invitations' });
        }

        res.json({ invitations: invitations || [] });

    } catch (error) {
        console.error('Get invitations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/invitations/stats/:invitationId
 * Get statistics for an invitation
 */
router.get('/stats/:invitationId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { invitationId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify ownership
        const { data: invitation } = await supabase
            .from('invitation_links')
            .select('created_by')
            .eq('id', invitationId)
            .single();

        if (!invitation || invitation.created_by !== userId) {
            // Check if user is admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (!profile || profile.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized' });
            }
        }

        // Get stats using RPC function
        const { data, error } = await supabase
            .rpc('get_invitation_stats', { p_invitation_id: parseInt(invitationId) });

        if (error) {
            console.error('Error fetching invitation stats:', error);
            return res.status(500).json({ error: 'Failed to fetch statistics' });
        }

        res.json({ stats: data[0] || {} });

    } catch (error) {
        console.error('Get invitation stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/invitations/:invitationId
 * Update an invitation
 */
router.patch('/:invitationId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { invitationId } = req.params;
        const { isActive, maxUses, validUntil, customMessage } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify ownership
        const { data: invitation } = await supabase
            .from('invitation_links')
            .select('created_by')
            .eq('id', invitationId)
            .single();

        if (!invitation || invitation.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update invitation
        const updates = {};
        if (isActive !== undefined) updates.is_active = isActive;
        if (maxUses !== undefined) updates.max_uses = maxUses;
        if (validUntil !== undefined) updates.valid_until = validUntil;
        if (customMessage !== undefined) updates.custom_message = customMessage;
        updates.updated_at = new Date().toISOString();

        const { data: updatedInvitation, error } = await supabase
            .from('invitation_links')
            .update(updates)
            .eq('id', invitationId)
            .select()
            .single();

        if (error) {
            console.error('Error updating invitation:', error);
            return res.status(500).json({ error: 'Failed to update invitation' });
        }

        res.json({ invitation: updatedInvitation });

    } catch (error) {
        console.error('Update invitation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/invitations/:invitationId
 * Delete an invitation
 */
router.delete('/:invitationId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { invitationId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify ownership
        const { data: invitation } = await supabase
            .from('invitation_links')
            .select('created_by')
            .eq('id', invitationId)
            .single();

        if (!invitation || invitation.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { error } = await supabase
            .from('invitation_links')
            .delete()
            .eq('id', invitationId);

        if (error) {
            console.error('Error deleting invitation:', error);
            return res.status(500).json({ error: 'Failed to delete invitation' });
        }

        res.json({ deleted: true });

    } catch (error) {
        console.error('Delete invitation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/invitations/course/:courseId
 * Get all invitations for a specific course
 */
router.get('/course/:courseId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: invitations, error } = await supabase
            .from('invitation_links')
            .select('*')
            .eq('course_id', courseId)
            .eq('created_by', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching course invitations:', error);
            return res.status(500).json({ error: 'Failed to fetch invitations' });
        }

        res.json({ invitations: invitations || [] });

    } catch (error) {
        console.error('Get course invitations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
