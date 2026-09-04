import express from 'express';
import supabaseAdmin from '../../supabase/supabaseAdmin.js';
import { enqueueNotification } from '../utils/notificationOutbox.js';
import { getAppSettings } from '../utils/settingsHelper.js';

const router = express.Router();

const SELECT_WITH_JOINS = `
  *,
  courses:related_course_id (name),
  questions:related_question_id (question, options, correct_answer)
`;

// req.user (from the auth middleware in index.js) is the raw Supabase Auth
// user - it has no app-level `role`/`name`. Every route here that needs
// those must look them up fresh from `profiles`, matching the established
// convention elsewhere in this codebase (e.g. tutor.js).
const getProfile = async (userId) => {
  const { data } = await supabaseAdmin.from('profiles').select('name, email, role').eq('id', userId).single();
  return data || null;
};

// POST /api/support-issues/submit — no forced auth, since public Contact Us
// must keep working logged-out. Every report/support/contact flow in the
// app funnels through this one endpoint.
router.post('/submit', async (req, res) => {
  try {
    const {
      issue_type,
      category,
      subject,
      description,
      phone,
      related_course_id,
      related_question_id,
      related_submission_id,
      metadata,
      name: bodyName,
      email: bodyEmail
    } = req.body;

    if (!issue_type) {
      return res.status(400).json({ error: 'issue_type is required.' });
    }

    // Never trust client-supplied identity when a session exists - resolve
    // name/email/role fresh from profiles instead.
    const isAuthenticated = !!req.user;
    const profile = isAuthenticated ? await getProfile(req.user.id) : null;
    const name = profile?.name || bodyName || 'Unknown';
    const email = profile?.email || req.user?.email || bodyEmail;
    const userType = profile?.role || (isAuthenticated ? 'student' : 'guest');

    if (!email) {
      return res.status(400).json({ error: 'email is required.' });
    }

    const record = {
      issue_type,
      user_type: userType,
      submitted_by: isAuthenticated ? req.user.id : null,
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      category: category || null,
      description: description || null,
      related_course_id: related_course_id || null,
      related_question_id: related_question_id || null,
      related_submission_id: related_submission_id || null,
      metadata: metadata || null
    };

    const { data, error } = await supabaseAdmin
      .from('support_issues')
      .insert(record)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw error;

    res.json({ success: true, data });

    // Admin email alert - fire and forget, mirrors the prior contact.js pattern.
    _notifyAdmin(record).catch((err) => console.error('[SupportIssues] Failed to enqueue admin notification:', err.message));
  } catch (error) {
    console.error('Error submitting support issue:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to submit', details: error.message || 'Unknown server error' });
    }
  }
});

async function _notifyAdmin(record) {
  const settings = await getAppSettings().catch(() => ({}));
  const adminEmail = process.env.ADMIN_EMAIL || settings?.support_email || process.env.EMAIL_USER || 'support@aiprep365.com';

  await enqueueNotification({
    eventType: 'CONTACT_SUBMISSION',
    recipientProfileId: null,
    recipientType: 'admin',
    channels: ['email'],
    payload: {
      recipientEmails: [adminEmail],
      name: record.name,
      email: record.email,
      mobile: record.phone || 'N/A',
      subject: record.subject || `${record.issue_type} submission`,
      type: record.issue_type,
      message: record.description
    }
  });
}

// GET /api/support-issues/all — Admin only
router.get('/all', async (req, res) => {
  try {
    const profile = req.user ? await getProfile(req.user.id) : null;
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let query = supabaseAdmin
      .from('support_issues')
      .select(SELECT_WITH_JOINS)
      .order('created_at', { ascending: false });

    const { issue_type, status, category, search } = req.query;
    if (issue_type) query = query.eq('issue_type', issue_type);
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching support issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

const VALID_STATUSES = ['pending', 'in_progress', 'resolved', 'closed'];

// PATCH /api/support-issues/:id/status — Admin only
router.patch('/:id/status', async (req, res) => {
  try {
    const profile = req.user ? await getProfile(req.user.id) : null;
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const updates = { reviewed_by: req.user.id, reviewed_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;

    const { data, error } = await supabaseAdmin
      .from('support_issues')
      .update(updates)
      .eq('id', id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating support issue:', error);
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

// DELETE /api/support-issues/:id — Admin only
router.delete('/:id', async (req, res) => {
  try {
    const profile = req.user ? await getProfile(req.user.id) : null;
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { error } = await supabaseAdmin.from('support_issues').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting support issue:', error);
    res.status(500).json({ error: 'Failed to delete issue' });
  }
});

export default router;
