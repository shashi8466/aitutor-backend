/**
 * Enrollment Routes
 * Endpoints for enrollment keys and course enrollment
 */

import express from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

import supabaseAdmin from '../../supabase/supabaseAdmin.js';
import supabase from '../../supabase/supabase.js';
import fs from 'fs';

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
 * Helper to check if a key code is orphaned (course deleted or null) and purge it
 */
const checkAndPurgeOrphanedKey = async (keyCode, ignoreKeyId = null) => {
    let query = supabaseAdmin
        .from('enrollment_keys')
        .select('id, course_id, key_type')
        .eq('key_code', keyCode);

    if (ignoreKeyId) {
        query = query.neq('id', ignoreKeyId);
    }

    const { data: existingKeys } = await query;
    if (!existingKeys || existingKeys.length === 0) {
        return null; // No existing key found
    }

    for (const key of existingKeys) {
        // If it's a global key, it's valid to have course_id = null. Protect it from purging.
        if (key.key_type === 'global') {
            return key;
        }

        if (!key.course_id) {
            console.log(`🧹 [ENROLLMENT] Purging orphaned key ${key.id} (${keyCode}) with null course_id`);
            await supabaseAdmin.from('enrollment_keys').delete().eq('id', key.id);
            continue;
        }

        // Check if referenced course_id actually exists in courses table
        const { data: course } = await supabaseAdmin
            .from('courses')
            .select('id')
            .eq('id', key.course_id)
            .maybeSingle();

        if (!course) {
            console.log(`🧹 [ENROLLMENT] Purging orphaned key ${key.id} (${keyCode}) for deleted course ${key.course_id}`);
            await supabaseAdmin.from('enrollment_keys').delete().eq('id', key.id);
            continue;
        }

        // Active key exists for a valid course
        return key;
    }

    return null; // All found keys were orphaned and purged
};


/**
 * POST /api/enrollment/create-key
 * Create a new enrollment key
 */
router.post('/create-key', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId, maxUses, maxStudents, validUntil, description, keyType, autoEnrollNewCourses } = req.body;

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

        // Restrict global enrollment keys strictly to Admins
        if (keyType === 'global' && profile.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can create global enrollment keys' });
        }

        let course = null;
        if (keyType !== 'global') {
            // Tutors can only create keys for their own courses
            if (profile.role === 'tutor') {
                const assigned = (profile.assigned_courses || []).map(Number);
                if (!assigned.includes(Number(courseId))) {
                    return res.status(403).json({ error: 'You are not assigned to this course.' });
                }
            }

            // Check if course exists
            const { data: courseData, error: courseError } = await supabaseAdmin
                .from('courses')
                .select('name')
                .eq('id', courseId)
                .single();

            if (courseError || !courseData) {
                return res.status(404).json({ error: 'Course not found' });
            }
            course = courseData;
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

            // Check if it's already taken (and auto-purge if orphaned)
            const existing = await checkAndPurgeOrphanedKey(keyCode);

            if (existing) {
                return res.status(400).json({ error: `The code '${keyCode}' is already in use. Please choose another.` });
            }
        } else {
            // Generate random key
            let isUnique = false;
            let attempts = 0;
            const nameForPrefix = keyType === 'global' ? 'GLOBAL' : course.name;

            while (!isUnique && attempts < 10) {
                keyCode = generateEnrollmentKey(nameForPrefix);

                const existing = await checkAndPurgeOrphanedKey(keyCode);

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
                course_id: keyType === 'global' ? null : courseId,
                key_type: keyType || 'single',
                auto_enroll_new_courses: keyType === 'global' ? (autoEnrollNewCourses || false) : false,
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

            // Check if key_type / auto_enroll_new_courses is missing, or course_id null violates NOT NULL constraint
            if (
                error.code === '42703' || 
                error.code === '23502' || 
                error.code === 'PGRST204' || 
                error.message?.includes('key_type') || 
                error.message?.includes('auto_enroll_new_courses') || 
                error.message?.includes('course_id')
            ) {
                console.warn('⚠️ [ENROLLMENT] Database migration pending for Global Enrollment Keys.');
                return res.status(400).json({
                    error: 'Database Migration Sync Required',
                    message: 'The Global Enrollment Keys feature requires a database schema sync.',
                    hint: 'Please copy and run the SQL migration script located at "src/supabase/migrations/1776800000000-global_enrollment_keys.sql" in your Supabase SQL Editor to enable Global Enrollment Keys.',
                    code: 'MIGRATION_PENDING'
                });
            }

            return res.status(500).json({
                error: 'Failed to create enrollment key',
                details: error.message
            });
        }

        res.json({ key });

    } catch (error) {
        console.error('💥 [ENROLLMENT] Fatal error creating key:', error);
        res.status(500).json({ 
            error: 'Internal server error during key generation',
            message: error.message,
            stack: error.stack
        });
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
        let { keyCode, courseId } = req.body;

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

        // 1. First, validate the key and its course binding
        const { data: keyData, error: keyError } = await supabaseAdmin
            .from('enrollment_keys')
            .select('id, course_id, key_type, is_active')
            .eq('key_code', keyCode)
            .maybeSingle();

        if (keyError || !keyData) {
            return res.status(400).json({ error: 'Invalid enrollment key. Please check the code and try again.' });
        }

        if (!keyData.is_active) {
            return res.status(400).json({ error: 'This enrollment key has been deactivated.' });
        }

        // 🎯 THE FIX: Verify the key belongs to the PROVIDED course
        // If courseId is provided (standard for CourseView enrollment), enforce strict match
        // Only perform this check if it is NOT a global key
        if (keyData.key_type !== 'global' && keyData.course_id !== null && courseId && Number(keyData.course_id) !== Number(courseId)) {
            return res.status(400).json({ 
                error: 'This key is for a different course. Please use the correct key for this course.' 
            });
        }

        // Use the database function to enroll via Admin Client to bypass RLS
        const { data, error } = await supabaseAdmin
            .rpc('use_enrollment_key', {
                p_key_code: keyCode,
                p_user_id: userId,
                p_intended_course_id: courseId ? parseInt(courseId) : null
            });

        if (error) {
            console.error('Error using enrollment key:', error);
            fs.appendFileSync('enrollment_error.log', `[${new Date().toISOString()}] ${JSON.stringify(error)}\n`);

            return res.status(500).json({
                error: 'Failed to use enrollment key',
                details: error.message || error
            });
        }

        if (!data || data.length === 0) {
            console.error('No data returned from use_enrollment_key RPC');
            return res.status(500).json({ error: 'No response from enrollment service' });
        }

        const result = data[0];

        if (!result || !result.success) {
            return res.status(400).json({
                enrolled: false,
                error: result?.error_message || 'Failed to use enrollment key'
            });
        }

        // Determine the courseId from key data (for redirect purposes)
        const enrolledCourseId = keyData.course_id || courseId || null;

        res.json({
            enrolled: true,
            enrollmentId: result.enrollment_id,
            courseId: enrolledCourseId
        });

    } catch (error) {
        console.error('Use enrollment key error:', error);
        fs.appendFileSync('enrollment_error.log', `[${new Date().toISOString()}] CATCH ERROR: ${error.message}\n${error.stack}\n`);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
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
                query = query.or(`course_id.eq.${numericId},key_type.eq.global,course_id.is.null`);
            } else {
                query = query.or(`course_id.eq.${courseId},key_type.eq.global,course_id.is.null`);
            }
        }

        // Tutors see keys they created OR keys for courses they are assigned to
        if (profile?.role === 'tutor') {
            const assigned = getAssignedCourses(profile);

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
            .select('created_by, key_type')
            .eq('id', keyId)
            .single();

        if (!key) {
            return res.status(404).json({ error: 'Key not found' });
        }

        if (profile?.role !== 'admin' && key.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update key
        const { isActive, maxUses, maxStudents, validUntil, description, keyCode, autoEnrollNewCourses, keyType, courseId } = req.body;
        const updates = {};
        if (isActive !== undefined) updates.is_active = isActive;
        if (autoEnrollNewCourses !== undefined) updates.auto_enroll_new_courses = autoEnrollNewCourses;
        if (keyType !== undefined) updates.key_type = keyType;
        
        if (courseId !== undefined || keyType !== undefined) {
            const finalKeyType = keyType !== undefined ? keyType : key.key_type;
            if (finalKeyType === 'global') {
                updates.course_id = null;
            } else if (courseId !== undefined) {
                updates.course_id = (courseId === '' || courseId === null || courseId === 'all') ? null : parseInt(courseId);
            }
        }

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
                // Check if another key already has this code (and auto-purge if orphaned)
                const existing = await checkAndPurgeOrphanedKey(newCode, keyId);

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
            .select('created_by, key_type, key_code')
            .eq('id', keyId)
            .single();

        if (!key) {
            return res.status(404).json({ error: 'Key not found' });
        }

        if (profile?.role !== 'admin' && key.created_by !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // 1. Count how many enrollments were created using this key
        const { count: enrollmentCount } = await supabaseAdmin
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('enrollment_key_id', keyId);

        // 2. Delete all enrollments linked to this key BEFORE deleting the key
        //    This is critical because there is no FK cascade constraint in the DB.
        //    Without this, enrollment records remain orphaned and students keep access.
        const { error: enrollError } = await supabaseAdmin
            .from('enrollments')
            .delete()
            .eq('enrollment_key_id', keyId);

        if (enrollError) {
            console.error('Error deleting key enrollments:', enrollError);
            return res.status(500).json({ error: 'Failed to revoke key enrollments' });
        }

        console.log(`[Enrollment] Deleted key "${key.key_code}" (${key.key_type}). Revoked ${enrollmentCount || 0} student enrollments.`);

        // 3. Delete the enrollment key itself
        const { error } = await supabaseAdmin
            .from('enrollment_keys')
            .delete()
            .eq('id', keyId);

        if (error) {
            console.error('Error deleting enrollment key:', error);
            return res.status(500).json({ error: 'Failed to delete enrollment key' });
        }

        res.json({ deleted: true, revokedEnrollments: enrollmentCount || 0 });

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
