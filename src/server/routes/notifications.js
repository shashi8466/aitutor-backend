import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';
import { processOutboxOnce, enqueueNotification } from '../utils/notificationOutbox.js';
import NotificationScheduler from '../services/NotificationScheduler.js';

const router = express.Router();

function requireCronSecret(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow if not configured (dev)
  const provided = req.headers['x-cron-secret'] || req.query.secret;
  if (provided !== secret) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// GET /api/notifications/debug/outbox
// Quick visibility: does backend see rows in notification_outbox?
router.get('/debug/outbox', async (req, res) => {
  try {
    const { count, error: countErr } = await supabase
      .from('notification_outbox')
      .select('*', { count: 'exact', head: true });

    if (countErr) {
      return res.status(500).json({ ok: false, error: countErr.message });
    }

    const { data: latest, error: latestErr } = await supabase
      .from('notification_outbox')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (latestErr) {
      return res.status(500).json({ ok: false, error: latestErr.message, count: count || 0 });
    }

    res.json({ ok: true, count: count || 0, latest: latest || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// POST /api/notifications/process-outbox
router.post('/process-outbox', async (req, res) => {
  try {
    if (!requireCronSecret(req, res)) return;
    const limit = Number(req.body?.limit) || 25;
    const result = await processOutboxOnce({ limit });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// POST /api/notifications/run-weekly
router.post('/run-weekly', async (req, res) => {
  try {
    if (!requireCronSecret(req, res)) return;

    // Default: last 7 days
    const now = new Date();
    const weekEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);

    // Fetch students and all parents to resolve linking
    const [{ data: students }, { data: allParents }] = await Promise.all([
      supabase.from('profiles').select('id, name, email').eq('role', 'student'),
      supabase.from('profiles').select('id, name, email, linked_students').eq('role', 'parent')
    ]);

    let enqueued = 0;

    for (const s of students || []) {
      const { data: submissions } = await supabase
        .from('test_submissions')
        .select('id, test_date, raw_score_percentage, scaled_score, level, courses(name)')
        .eq('user_id', s.id)
        .gte('test_date', weekStart.toISOString())
        .lte('test_date', weekEnd.toISOString())
        .order('test_date', { ascending: false });

      const totalTests = submissions?.length || 0;
      const avgScore = totalTests > 0 ? Math.round(submissions.reduce((sum, sub) => sum + (sub.raw_score_percentage || 0), 0) / totalTests) : 0;
      const bestScore = totalTests > 0 ? Math.round(Math.max(...submissions.map(sub => sub.raw_score_percentage || 0))) : 0;

      // Find parents linked to this student
      const linkedParents = (allParents || []).filter(p => {
        const linked = p.linked_students || [];
        return Array.isArray(linked) && linked.some(id => String(id).trim() === String(s.id).trim());
      });

      const parentEmails = linkedParents.map(p => p.email).filter(Boolean);
      const recipientEmails = [s.email, ...parentEmails].filter(Boolean);

      if (recipientEmails.length === 0) continue;

      const payload = {
        studentId: s.id,
        studentName: s.name || 'Student',
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        submissions: submissions || [],
        totalTests,
        avgScore,
        bestScore,
        recipientEmails // 🔥 Unified list for Brevo
      };

      await enqueueNotification({
        eventType: 'WEEKLY_REPORT',
        recipientProfileId: s.id,
        recipientType: 'student',
        payload,
        scheduledFor: new Date().toISOString()
      });
      enqueued++;
    }

    const processed = await processOutboxOnce({ limit: 50 });
    res.json({ ok: true, enqueued, ...processed });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// POST /api/notifications/run-due-reminders
router.post('/run-due-reminders', async (req, res) => {
  try {
    if (!requireCronSecret(req, res)) return;

    const now = new Date();
    const horizonHours = Number(req.body?.horizonHours) || 72; // next 3 days
    const horizon = new Date(now.getTime() + horizonHours * 3600000);

    // Find assigned tests due soon
    const { data: assignments, error } = await supabase
      .from('test_assignments')
      .select('id, user_id, course_id, level, due_at, courses(name)')
      .eq('status', 'assigned')
      .gte('due_at', now.toISOString())
      .lte('due_at', horizon.toISOString())
      .order('due_at', { ascending: true });

    if (error) throw error;

    // Group by student
    const byStudent = new Map();
    for (const a of assignments || []) {
      if (!byStudent.has(a.user_id)) byStudent.set(a.user_id, []);
      byStudent.get(a.user_id).push(a);
    }

    // Fetch students and all parents to resolve linking
    const [{ data: students }, { data: allParents }] = await Promise.all([
      supabase.from('profiles').select('id, name, email, father_mobile').eq('role', 'student'),
      supabase.from('profiles').select('id, name, email, linked_students').eq('role', 'parent')
    ]);

    let enqueued = 0;

    for (const [studentId, items] of byStudent.entries()) {
      const student = (students || []).find(s => s.id === studentId);
      
      const dueItems = (items || []).map(it => ({
        course_name: it.courses?.name || 'Course',
        level: it.level || null,
        due_date: it.due_at
      }));

      // Find parents linked to this student
      const linkedParents = (allParents || []).filter(p => {
        const linked = p.linked_students || [];
        return Array.isArray(linked) && linked.some(id => String(id).trim() === String(studentId).trim());
      });

      const parentEmails = linkedParents.map(p => p.email).filter(Boolean);
      const recipientEmails = [student?.email, ...parentEmails].filter(Boolean);

      if (recipientEmails.length === 0) continue;

      const payload = {
        studentId,
        studentName: student?.name || 'Student',
        dueItems,
        fallbackPhone: student?.father_mobile || null,
        recipientEmails // 🔥 Unified list for Brevo
      };

      await enqueueNotification({
        eventType: 'DUE_DATE_REMINDER',
        recipientProfileId: studentId,
        recipientType: 'student',
        payload
      });
      enqueued++;
    }

    const processed = await processOutboxOnce({ limit: 50 });
    res.json({ ok: true, enqueued, ...processed });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// GET /api/notifications/preferences/:userId
router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user preferences from Supabase
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('profile_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    // Return default preferences if none found
    const defaultPreferences = {
      email_enabled: true,
      sms_enabled: true,
      whatsapp_enabled: false,
      test_completed_enabled: true,
      weekly_report_enabled: true,
      due_date_enabled: true
    };
    
    res.json({
      success: true,
      preferences: preferences || defaultPreferences
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/notifications/preferences/:userId
router.put('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences } = req.body;
    
    // Upsert preferences
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({
        profile_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: data
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// GET /api/notifications/history
router.get('/history', async (req, res) => {
  try {
    const { 
      studentId, 
      parentId, 
      type, 
      limit = 20, 
      page = 1 
    } = req.query;
    
    // Build query
    let query = supabase
      .from('notification_outbox')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Add filters
    if (studentId) {
      query = query.eq('recipient_profile_id', studentId);
    }
    if (parentId) {
      query = query.eq('recipient_profile_id', parentId);
    }
    if (type) {
      query = query.eq('event_type', type);
    }
    
    // Get total count for pagination
    const { count } = await supabase
      .from('notification_outbox')
      .select('*', { count: true, head: true })
      .match(or(and(studentId, parentId), `recipient_profile_id.in.(${studentId},${parentId})`));
    if (type) {
      query = query.eq('event_type', type);
    }
    
    // Apply pagination
    const limitVal = parseInt(limit) || 20;
    const pageVal = parseInt(page) || 1;
    const offset = (pageVal - 1) * limitVal;
    
    const { data: notifications, error } = await query
      .range(offset, offset + limitVal - 1);
    
    if (error) throw error;
    
    res.json({
      success: true,
      notifications: notifications || [],
      pagination: {
        page: pageVal,
        limit: limitVal,
        total: count || 0,
        pages: Math.ceil((count || 0) / limitVal)
      }
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// ============================================
// Manual Trigger Endpoints (For Testing)
// ============================================

// POST /api/notifications/send-latest-test-report
// Send the latest TEST_COMPLETED report to student + linked parents immediately.
// Protected by CRON secret (or open in dev if CRON_SECRET is not set).
// Body: { studentId?: string, studentEmail?: string, studentName?: string }
router.post('/send-latest-test-report', async (req, res) => {
  try {
    if (!requireCronSecret(req, res)) return;

    const { studentId, studentEmail, studentName } = req.body || {};

    let resolvedStudentId = studentId || null;

    if (!resolvedStudentId) {
      if (!studentEmail && !studentName) {
        return res.status(400).json({ error: 'Provide studentId OR studentEmail OR studentName' });
      }

      let q = supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('role', 'student')
        .limit(5);

      if (studentEmail) q = q.ilike('email', studentEmail);
      else q = q.ilike('name', `%${studentName}%`);

      const { data: matches, error: matchErr } = await q;
      if (matchErr) throw matchErr;

      if (!matches?.length) return res.status(404).json({ error: 'Student not found' });
      if (matches.length > 1) {
        return res.status(409).json({
          error: 'Multiple students matched',
          matches
        });
      }

      resolvedStudentId = matches[0].id;
    }

    const { data: latest, error: latestErr } = await supabase
      .from('test_submissions')
      .select('id, user_id, test_date')
      .eq('user_id', resolvedStudentId)
      .order('test_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) throw latestErr;
    if (!latest?.id) return res.status(404).json({ error: 'No test submissions found for this student' });

    const scheduler = new NotificationScheduler();
    await scheduler.triggerTestCompletionNotification(latest.id, resolvedStudentId);
    const processed = await processOutboxOnce({ limit: 25 });

    res.json({ ok: true, studentId: resolvedStudentId, submissionId: latest.id, processed });
  } catch (err) {
    console.error('Error sending latest test report:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// POST /api/notifications/test-completion-manual
// Manually trigger test completion notification for testing
router.post('/test-completion-manual', async (req, res) => {
  try {
    if (!requireCronSecret(req, res)) return;
    
    const { submissionId, studentId } = req.body;
    
    if (!submissionId || !studentId) {
      return res.status(400).json({ error: 'submissionId and studentId are required' });
    }
    
    const scheduler = new NotificationScheduler();
    await scheduler.triggerTestCompletionNotification(submissionId, studentId);
    
    res.json({ 
      ok: true, 
      message: 'Test completion notification triggered successfully',
      submissionId,
      studentId
    });
  } catch (err) {
    console.error('Error in manual test completion:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// POST /api/notifications/weekly-manual
// Manually send weekly report for a specific student
router.post('/weekly-manual', async (req, res) => {
  try {
    if (!requireCronSecret(req, res)) return;
    
    const { studentId } = req.body;
    
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }
    
    // Fetch student data
    const { data: student } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', studentId)
      .single();
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Get last 7 days of submissions
    const now = new Date();
    const weekEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    
    const { data: submissions } = await supabase
      .from('test_submissions')
      .select('id, test_date, raw_score_percentage, scaled_score, level, courses(name)')
      .eq('user_id', studentId)
      .gte('test_date', weekStart.toISOString())
      .lte('test_date', weekEnd.toISOString())
      .order('test_date', { ascending: false });
    
    const totalTests = submissions?.length || 0;
    const avgScore = totalTests > 0 
      ? Math.round(submissions.reduce((sum, sub) => sum + (sub.raw_score_percentage || 0), 0) / totalTests) 
      : 0;
    const bestScore = totalTests > 0 
      ? Math.round(Math.max(...submissions.map(sub => sub.raw_score_percentage || 0))) 
      : 0;
    
    const payload = {
      studentId,
      studentName: student.name || 'Student',
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      submissions: submissions || [],
      totalTests,
      avgScore,
      bestScore
    };
    
    // Send to student
    await enqueueNotification({
      eventType: 'WEEKLY_REPORT',
      recipientProfileId: studentId,
      recipientType: 'student',
      payload,
      scheduledFor: new Date().toISOString()
    });
    
    // Send to linked parents
    const { data: parents } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'parent')
      .contains('linked_students', [studentId]);
    
    for (const parent of parents || []) {
      await enqueueNotification({
        eventType: 'WEEKLY_REPORT',
        recipientProfileId: parent.id,
        recipientType: 'parent',
        payload,
        scheduledFor: new Date().toISOString()
      });
    }
    
    // Process outbox immediately
    const processed = await processOutboxOnce({ limit: 10 });
    
    res.json({ 
      ok: true, 
      message: 'Weekly report sent successfully',
      studentId,
      totalTests,
      avgScore,
      bestScore,
      processed
    });
  } catch (err) {
    console.error('Error in manual weekly report:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// POST /api/notifications/due-reminder-manual
// Manually send due date reminder for a specific student
router.post('/due-reminder-manual', async (req, res) => {
  try {
    if (!requireCronSecret(req, res)) return;
    
    const { studentId } = req.body;
    
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }
    
    // Get upcoming assignments
    const now = new Date();
    const horizon = new Date(now.getTime() + 72 * 3600000); // Next 3 days
    
    const { data: assignments } = await supabase
      .from('test_assignments')
      .select('id, course_id, level, due_at, courses(name)')
      .eq('user_id', studentId)
      .eq('status', 'assigned')
      .gte('due_at', now.toISOString())
      .lte('due_at', horizon.toISOString())
      .order('due_at', { ascending: true });
    
    if (!assignments || assignments.length === 0) {
      return res.json({ 
        ok: true, 
        message: 'No upcoming assignments found',
        studentId
      });
    }
    
    const { data: student } = await supabase
      .from('profiles')
      .select('id, name, father_mobile')
      .eq('id', studentId)
      .single();
    
    const dueItems = assignments.map(it => ({
      course_name: it.courses?.name || 'Course',
      level: it.level || null,
      due_date: it.due_at
    }));
    
    const payload = {
      studentId,
      studentName: student?.name || 'Student',
      dueItems,
      fallbackPhone: student?.father_mobile || null
    };
    
    // Send to student
    await enqueueNotification({
      eventType: 'DUE_DATE_REMINDER',
      recipientProfileId: studentId,
      recipientType: 'student',
      payload,
      scheduledFor: new Date().toISOString()
    });
    
    // Send to linked parents
    const { data: parents } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'parent')
      .contains('linked_students', [studentId]);
    
    for (const parent of parents || []) {
      await enqueueNotification({
        eventType: 'DUE_DATE_REMINDER',
        recipientProfileId: parent.id,
        recipientType: 'parent',
        payload,
        scheduledFor: new Date().toISOString()
      });
    }
    
    // Process outbox immediately
    const processed = await processOutboxOnce({ limit: 10 });
    
    res.json({ 
      ok: true, 
      message: 'Due date reminder sent successfully',
      studentId,
      assignmentCount: assignments.length,
      processed
    });
  } catch (err) {
    console.error('Error in manual due reminder:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;

