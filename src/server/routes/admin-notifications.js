import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';
import NotificationScheduler from '../services/NotificationScheduler.js';
import { processOutboxOnce } from '../utils/notificationOutbox.js';

const router = express.Router();
const scheduler = new NotificationScheduler();

// Middleware to verify admin role
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 [Admin Auth] Checking authorization...');
    console.log('  - Auth Header:', authHeader ? 'Present' : '❌ Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [Admin Auth] No Bearer token found');
      return res.status(401).json({ 
        error: 'Unauthorized',
        details: 'No authorization header or invalid format. Expected: Bearer <token>'
      });
    }

    const token = authHeader.substring(7);
    console.log('  - Token length:', token.length);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('❌ [Admin Auth] Invalid token:', userError?.message);
      return res.status(401).json({ 
        error: 'Invalid token',
        details: userError?.message || 'Token validation failed'
      });
    }

    console.log('  ✅ Token valid for user:', user.email);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ [Admin Auth] Profile lookup failed:', profileError.message);
      return res.status(500).json({ 
        error: 'Profile lookup failed',
        details: profileError.message
      });
    }

    if (!profile || profile?.role !== 'admin') {
      console.error('❌ [Admin Auth] User is not admin. Role:', profile?.role);
      return res.status(403).json({ 
        error: 'Forbidden - Admin access required',
        details: `Your role is '${profile?.role || 'unknown'}'. Admin role required.`
      });
    }

    console.log('✅ [Admin Auth] Authorized as admin');
    req.user = user;
    req.profile = profile;
    next();
  } catch (error) {
    console.error('❌ [Admin Auth] Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/admin/students-with-preferences
// Fetch all students with their notification preferences
router.get('/students-with-preferences', requireAdmin, async (req, res) => {
  try {
    console.log('📊 [Admin Notifications] Fetching students...');
    
    const { data: students, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        role,
        created_at,
        last_active_at,
        phone_number,
        whatsapp_number,
        notification_preferences
      `)
      .eq('role', 'student')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [Admin Notifications] Error fetching students:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        details: 'Database query failed'
      });
    }

    if (!students || students.length === 0) {
      console.warn('⚠️ [Admin Notifications] No students found in database');
      return res.json({ 
        success: true, 
        students: [],
        message: 'No students found. Make sure students exist in the database.'
      });
    }

    console.log(`✅ [Admin Notifications] Found ${students.length} students`);
    res.json({ success: true, students });
  } catch (error) {
    console.error('❌ [Admin Notifications] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// GET /api/admin/parents-with-preferences
// Fetch all parents with their notification preferences
router.get('/parents-with-preferences', requireAdmin, async (req, res) => {
  try {
    console.log('👨‍👩‍👧‍👦 [Admin Notifications] Fetching parents...');
    
    const { data: parents, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        role,
        created_at,
        last_active_at,
        phone_number,
        whatsapp_number,
        notification_preferences
      `)
      .eq('role', 'parent')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [Admin Notifications] Error fetching parents:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message,
        details: 'Database query failed'
      });
    }

    if (!parents || parents.length === 0) {
      console.warn('⚠️ [Admin Notifications] No parents found in database');
      return res.json({ 
        success: true, 
        parents: [],
        message: 'No parents found. Make sure parents exist in the database.'
      });
    }

    console.log(`✅ [Admin Notifications] Found ${parents.length} parents`);
    res.json({ success: true, parents });
  } catch (error) {
    console.error('❌ [Admin Notifications] Unexpected error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// POST /api/admin/send-latest-test-report
// Trigger a TEST_COMPLETED score report "now" for a student + linked parents
// Body: { studentId?: string, studentEmail?: string, studentName?: string }
router.post('/send-latest-test-report', requireAdmin, async (req, res) => {
  try {
    const { studentId, studentEmail, studentName } = req.body || {};

    let resolvedStudentId = studentId || null;

    if (!resolvedStudentId) {
      if (!studentEmail && !studentName) {
        return res.status(400).json({
          success: false,
          error: 'Provide studentId OR studentEmail OR studentName'
        });
      }

      // Find the student profile by email/name (best-effort)
      let q = supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('role', 'student')
        .limit(5);

      if (studentEmail) q = q.ilike('email', studentEmail);
      else q = q.ilike('name', `%${studentName}%`);

      const { data: matches, error: matchErr } = await q;
      if (matchErr) throw matchErr;

      if (!matches?.length) {
        return res.status(404).json({
          success: false,
          error: 'Student not found',
          hint: 'Check profiles.role is "student" and the name/email matches'
        });
      }

      // If multiple matches, pick the first (admin can use studentId for precision)
      resolvedStudentId = matches[0].id;
    }

    // Find latest submission for this student
    const { data: latest, error: latestErr } = await supabase
      .from('test_submissions')
      .select('id, user_id, course_id, level, raw_score_percentage, scaled_score, test_date')
      .eq('user_id', resolvedStudentId)
      .order('test_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) throw latestErr;
    if (!latest?.id) {
      return res.status(404).json({
        success: false,
        error: 'No test submissions found for this student'
      });
    }

    // Enqueue notifications for student + linked parents
    await scheduler.triggerTestCompletionNotification(latest.id, resolvedStudentId);

    // Attempt immediate delivery (email/sms/whatsapp) from outbox
    const processed = await processOutboxOnce({ limit: 25 });

    return res.json({
      success: true,
      studentId: resolvedStudentId,
      submissionId: latest.id,
      processed
    });
  } catch (error) {
    console.error('❌ [Admin Notifications] send-latest-test-report failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || String(error)
    });
  }
});

// PUT /api/admin/notification-preferences/:studentId
// Update notification preferences for a specific student
router.put('/notification-preferences/:studentId', requireAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { preferences } = req.body;

    // Validate preferences
    const allowedKeys = ['email', 'sms', 'whatsapp', 'testCompletion', 'weeklyProgress', 'testDueDate'];
    const isValid = Object.keys(preferences).every(key => allowedKeys.includes(key));
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid preference keys. Allowed: email, sms, whatsapp, testCompletion, weeklyProgress, testDueDate' 
      });
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', studentId)
      .single();

    if (studentError || student?.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Update preferences
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        notification_preferences: preferences 
      })
      .eq('id', studentId);

    if (updateError) {
      console.error('Error updating preferences:', updateError);
      return res.status(500).json({ success: false, error: updateError.message });
    }

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/bulk-notification-update
// Bulk update notification preferences for multiple students
router.post('/bulk-notification-update', requireAdmin, async (req, res) => {
  try {
    const { studentIds, enabled } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or empty studentIds array' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    // Get current preferences for all students
    const { data: students, error: fetchError } = await supabase
      .from('profiles')
      .select('id, notification_preferences')
      .in('id', studentIds);

    if (fetchError) {
      console.error('Error fetching students:', fetchError);
      return res.status(500).json({ success: false, error: fetchError.message });
    }

    // Update each student's preferences
    const updates = students.map(student => {
      const currentPrefs = student.notification_preferences || {};
      const updatedPrefs = {
        ...currentPrefs,
        email: enabled,
        sms: enabled,
        whatsapp: enabled
      };

      return supabase
        .from('profiles')
        .update({ notification_preferences: updatedPrefs })
        .eq('id', student.id);
    });

    // Execute all updates
    await Promise.all(updates);

    res.json({ 
      success: true, 
      message: `Successfully ${enabled ? 'enabled' : 'disabled'} notifications for ${studentIds.length} students` 
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/notification-stats
// Get overall notification statistics
router.get('/notification-stats', requireAdmin, async (req, res) => {
  try {
    // Get total students
    const { count: totalStudents } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    // Get students with email enabled
    const { data: emailEnabled } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('role', 'student')
      .not('notification_preferences', 'is', null);
    
    const emailCount = emailEnabled?.filter(s => s.notification_preferences?.email).length || 0;
    const smsCount = emailEnabled?.filter(s => s.notification_preferences?.sms).length || 0;
    const whatsappCount = emailEnabled?.filter(s => s.notification_preferences?.whatsapp).length || 0;

    // Get active vs inactive
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: allStudents } = await supabase
      .from('profiles')
      .select('last_active_at')
      .eq('role', 'student');

    const activeCount = allStudents?.filter(s => 
      s.last_active_at && new Date(s.last_active_at) > sevenDaysAgo
    ).length || 0;
    const inactiveCount = totalStudents - activeCount;

    res.json({
      success: true,
      stats: {
        total: totalStudents || 0,
        active: activeCount,
        inactive: inactiveCount,
        emailEnabled: emailCount,
        smsEnabled: smsCount,
        whatsappEnabled: whatsappCount
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/force-notify-inactive-students
// Force enable notifications for inactive students
router.post('/force-notify-inactive-students', requireAdmin, async (req, res) => {
  try {
    const { daysThreshold = 7 } = req.body; // Default 7 days
    
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Find inactive students
    const { data: inactiveStudents, error: fetchError } = await supabase
      .from('profiles')
      .select('id, notification_preferences')
      .eq('role', 'student')
      .or(`last_active_at.is.null,last_active_at.lt.${thresholdDate.toISOString()}`);

    if (fetchError) {
      console.error('Error fetching inactive students:', fetchError);
      return res.status(500).json({ success: false, error: fetchError.message });
    }

    if (!inactiveStudents || inactiveStudents.length === 0) {
      return res.json({ success: true, message: 'No inactive students found', updated: 0 });
    }

    // Enable all notifications for inactive students
    const updates = inactiveStudents.map(student => {
      const updatedPrefs = {
        ...(student.notification_preferences || {}),
        email: true,
        sms: true,
        whatsapp: true
      };

      return supabase
        .from('profiles')
        .update({ notification_preferences: updatedPrefs })
        .eq('id', student.id);
    });

    await Promise.all(updates);

    res.json({ 
      success: true, 
      message: `Force-enabled notifications for ${inactiveStudents.length} inactive students`,
      updated: inactiveStudents.length
    });
  } catch (error) {
    console.error('Error forcing notifications for inactive students:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
