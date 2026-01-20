/**
 * Enrollment Routes
 * Endpoints for enrollment keys and course enrollment
 */

import express from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

import supabaseAdmin from '../../supabase/supabaseAdmin.js';
import supabase from '../../supabase/supabase.js';

const router = express.Router();

/**
 * Generate a unique enrollment key
 */
const generateEnrollmentKey = (courseName) => {
    const prefix = courseName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .substring(0, 12);

    const random = crypto.randomBytes(3).toString('hex').toUpperCase();

    return `${prefix}-${random}`;
};

/**
 * POST /api/enrollment/create-key
 * Create a new enrollment key
 */
router.post('/create-key', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId, maxUses, maxStudents, validUntil, description } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify user is admin or tutor using Admin Client
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, tutor_approved, assigned_courses')
            .eq('id', userId)
            .single();

        if (!profile || (profile.role !== 'admin' && profile.role !== 'tutor')) {
            return res.status(403).json({ error: 'Only admins and tutors can create enrollment keys' });
        }

        // Tutors can only create keys for their own courses
        if (profile.role === 'tutor') {
            const assigned = (profile.assigned_courses || []).map(Number);
            if (!assigned.includes(Number(courseId))) {
                return res.status(403).json({ error: 'You are not assigned to this course.' });
            }
        }

        // Check if course exists
        const { data: course, error: courseError } = await supabaseAdmin
            .from('courses')
            .select('name')
            .eq('id', courseId)
            .single();

        if (courseError || !course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Generate unique key
        let keyCode;
        const { customCode } = req.body;

        if (customCode) {
            // Use provided custom code
            keyCode = customCode.toUpperCase().replace(/[^A-Z0-9-]/g, '');

            if (keyCode.length < 4 || keyCode.length > 12) {
                return res.status(400).json({ error: 'Enrollment Key must be between 4 and 12 characters.' });
            }

            // Check if it's already taken
            const { data: existing } = await supabaseAdmin
                .from('enrollment_keys')
                .select('id')
                .eq('key_code', keyCode)
                .single();

            if (existing) {
                return res.status(400).json({ error: `The code '${keyCode}' is already in use. Please choose another.` });
            }
        } else {
            // Generate random key
            let isUnique = false;
            let attempts = 0;

            while (!isUnique && attempts < 10) {
                keyCode = generateEnrollmentKey(course.name);

                const { data: existing } = await supabaseAdmin
                    .from('enrollment_keys')
                    .select('id')
                    .eq('key_code', keyCode)
                    .single();

                if (!existing) {
                    isUnique = true;
                }
                attempts++;
            }
            if (!isUnique) {
                return res.status(500).json({ error: 'Failed to generate unique key' });
            }
        }

        // Create enrollment key
        const { data: key, error } = await supabaseAdmin
            .from('enrollment_keys')
            .insert({
                key_code: keyCode,
                course_id: courseId,
                created_by: userId,
                creator_role: profile.role,
                max_uses: (maxUses === '' || maxUses === null) ? null : parseInt(maxUses),
                max_students: (maxStudents === '' || maxStudents === null) ? null : parseInt(maxStudents),
                valid_until: validUntil || null,
                description: description || null
            })
            .select()
            .single();

        if (error) {
            console.error('❌ [ENROLLMENT] Error creating enrollment key:', error);

            // Check for missing table (Postgres code 42P01 means undefined table)
            if (error.code === '42P01' || error.message?.includes('relation "enrollment_keys" does not exist')) {
                console.warn('⚠️ [ENROLLMENT] Table missing. Please run DATABASE_FIX.sql');
                return res.status(503).json({
                    error: 'Enrollment system not initialized.',
                    hint: 'Admin must run DATABASE_FIX.sql in Supabase SQL Editor.',
                    code: 'MISSING_TABLE'
                });
            }

            return res.status(500).json({
                error: 'Failed to create enrollment key',
                details: error.message
            });
        }

        res.json({ key });

    } catch (error) {
        console.error('Create enrollment key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/enrollment/validate-key
 * Validate an enrollment key
 */
router.post('/validate-key', async (req, res) => {
    try {
        let { keyCode } = req.body;

        if (!keyCode) {
            return res.status(400).json({ error: 'Key code is required' });
        }

        keyCode = keyCode.trim().toUpperCase();

        if (keyCode.length < 4 || keyCode.length > 12) {
            return res.status(400).json({ error: 'Invalid key format. Keys must be between 4 and 12 characters.' });
        }

        // Use the database function for validation
        const { data, error } = await supabase
            .rpc('validate_enrollment_key', { p_key_code: keyCode });

        if (error) {
            console.error('Error validating key:', error);
            return res.status(500).json({ error: 'Failed to validate key' });
        }

        const result = data[0];

        if (!result.valid) {
            return res.status(400).json({
                valid: false,
                error: result.error_message
            });
        }

        res.json({
            valid: true,
            courseId: result.course_id,
            courseName: result.course_name
        });

    } catch (error) {
        console.error('Validate key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/enrollment/use-key
 * Use an enrollment key to enroll in a course
 */
router.post('/use-key', async (req, res) => {
    try {
        const userId = req.user?.id;
        let { keyCode } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!keyCode) {
            return res.status(400).json({ error: 'Key code is required' });
        }

        keyCode = keyCode.trim().toUpperCase();

        if (keyCode.length < 4 || keyCode.length > 12) {
            return res.status(400).json({ error: 'Invalid key format. Keys must be between 4 and 12 characters.' });
        }

        // Use the database function to enroll via Admin Client to bypass RLS
        const { data, error } = await supabaseAdmin
            .rpc('use_enrollment_key', {
                p_key_code: keyCode,
                p_user_id: userId
            });

        if (error) {
            console.error('Error using enrollment key:', error);
            return res.status(500).json({ error: 'Failed to use enrollment key' });
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
        console.error('Use enrollment key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/enrollment/keys
 * Get enrollment keys (optionally filtered by course)
 */
router.get('/keys', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check user role and assigned courses
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, assigned_courses')
            .eq('id', userId)
            .single();

        let query = supabaseAdmin
            .from('enrollment_keys')
            .select(`
                *,
                course:courses(id, name, description)
            `)
            .order('created_at', { ascending: false });

        if (courseId && courseId !== 'undefined' && courseId !== 'null' && courseId !== 'all') {
            const numericId = parseInt(courseId);
            if (!isNaN(numericId)) {
                query = query.eq('course_id', numericId);
            } else {
                query = query.eq('course_id', courseId);
            }
        }

        // Tutors see keys they created OR keys for courses they are assigned to
        if (profile?.role === 'tutor') {
            const assigned = (profile.assigned_courses || []).map(Number);

            if (assigned.length > 0) {
                // Tutors assigned to courses see keys for those courses + any keys they created
                query = query.or(`created_by.eq.${userId},course_id.in.(${assigned.join(',')})`);
            } else {
                // Tutors with no courses only see keys they created
                query = query.eq('created_by', userId);
            }
        }
        // Admins see all keys (default)

        const { data: keys, error } = await query;

        if (error) {
            console.error('Error fetching enrollment keys:', error);
            return res.status(500).json({ error: 'Failed to fetch enrollment keys' });
        }

        res.json({ keys: keys || [] });

    } catch (error) {
        console.error('Get enrollment keys error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/enrollment/key-stats/:keyId
 * Get statistics for an enrollment key
 */
router.get('/key-stats/:keyId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { keyId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify ownership OR admin role
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const { data: key } = await supabaseAdmin
            .from('enrollment_keys')
            .select('created_by')
            .eq('id', keyId)
            .single();

        if (!key) {
            return res.status(404).json({ error: 'Key not found' });
        }

        if (profile?.role !== 'admin' && key.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Get stats using RPC function
        const { data, error } = await supabase
            .rpc('get_enrollment_key_stats', { p_key_id: parseInt(keyId) });

        if (error) {
            console.error('Error fetching key stats:', error);
            return res.status(500).json({ error: 'Failed to fetch statistics' });
        }

        res.json({ stats: data[0] || {} });

    } catch (error) {
        console.error('Get key stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/enrollment/key/:keyId
 * Update an enrollment key
 */
router.patch('/key/:keyId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { keyId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify ownership OR admin role
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const { data: key } = await supabaseAdmin
            .from('enrollment_keys')
            .select('created_by')
            .eq('id', keyId)
            .single();

        if (!key) {
            return res.status(404).json({ error: 'Key not found' });
        }

        if (profile?.role !== 'admin' && key.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update key
        const { isActive, maxUses, maxStudents, validUntil, description, keyCode } = req.body;
        const updates = {};
        if (isActive !== undefined) updates.is_active = isActive;

        // Handle numeric fields (treat empty or null as null in DB)
        if (maxUses !== undefined) {
            updates.max_uses = (maxUses === '' || maxUses === null) ? null : parseInt(maxUses);
        }
        if (maxStudents !== undefined) {
            updates.max_students = (maxStudents === '' || maxStudents === null) ? null : parseInt(maxStudents);
        }

        if (validUntil !== undefined) updates.valid_until = validUntil === '' ? null : validUntil;
        if (description !== undefined) updates.description = description === '' ? null : description;

        if (keyCode !== undefined) {
            const newCode = keyCode.trim().toUpperCase();
            if (newCode) {
                if (newCode.length < 4 || newCode.length > 12) {
                    return res.status(400).json({ error: 'Enrollment Key must be between 4 and 12 characters.' });
                }
                // Check if another key already has this code
                const { data: existing } = await supabaseAdmin
                    .from('enrollment_keys')
                    .select('id')
                    .eq('key_code', newCode)
                    .neq('id', keyId)
                    .maybeSingle();

                if (existing) {
                    return res.status(400).json({ error: `The code '${newCode}' is already in use by another key.` });
                }
                updates.key_code = newCode;
            }
        }
        updates.updated_at = new Date().toISOString();

        const { data: updatedKey, error } = await supabaseAdmin
            .from('enrollment_keys')
            .update(updates)
            .eq('id', keyId)
            .select()
            .single();

        if (error) {
            console.error('Error updating enrollment key:', error);
            return res.status(500).json({ error: 'Failed to update enrollment key' });
        }

        res.json({ key: updatedKey });

    } catch (error) {
        console.error('Update enrollment key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/enrollment/key/:keyId
 * Delete an enrollment key
 */
router.delete('/key/:keyId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { keyId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify ownership OR admin role
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        const { data: key } = await supabaseAdmin
            .from('enrollment_keys')
            .select('created_by')
            .eq('id', keyId)
            .single();

        if (!key) {
            return res.status(404).json({ error: 'Key not found' });
        }

        if (profile?.role !== 'admin' && key.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { error } = await supabaseAdmin
            .from('enrollment_keys')
            .delete()
            .eq('id', keyId);

        if (error) {
            console.error('Error deleting enrollment key:', error);
            return res.status(500).json({ error: 'Failed to delete enrollment key' });
        }

        res.json({ deleted: true });

    } catch (error) {
        console.error('Delete enrollment key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/enrollment/course-students/:courseId
 * Get all students enrolled in a course (Admin/Tutor only)
 */
router.get('/course-students/:courseId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        console.log(`🔍 [ENROLLMENT] Fetching students for course: ${courseId}, User: ${userId}`);

        if (!userId) {
            console.warn('⚠️ [ENROLLMENT] Unauthorized access attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check if user is admin or tutor
        const { data: profile, error: profErr } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profErr || !profile) {
            console.error('❌ [ENROLLMENT] Profile not found for user:', userId);
            return res.status(403).json({ error: 'Access denied' });
        }

        if (profile.role !== 'admin' && profile.role !== 'tutor') {
            console.warn(`⚠️ [ENROLLMENT] Access denied for role: ${profile.role}`);
            return res.status(403).json({ error: 'Access denied' });
        }

        // Ensure courseId is numeric for bigint columns if needed, 
        // though PostgREST usually handles strings fine if they look like numbers.
        const targetCourseId = parseInt(courseId);

        // Fetch students via Admin Client to bypass RLS
        const { data: students, error } = await supabaseAdmin
            .from('enrollments')
            .select(`
                enrolled_at,
                profiles!user_id (
                    id,
                    email,
                    name
                )
            `)
            .eq('course_id', isNaN(targetCourseId) ? courseId : targetCourseId)
            .order('enrolled_at', { ascending: false });

        if (error) {
            console.error('❌ [ENROLLMENT] Error fetching course students:', error);
            return res.status(500).json({ error: 'Failed to fetch students' });
        }

        console.log(`✅ [ENROLLMENT] Found ${students?.length || 0} students for course ${courseId}`);
        res.json({ students: students || [] });

    } catch (error) {
        console.error('💥 [ENROLLMENT] Get course students error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
