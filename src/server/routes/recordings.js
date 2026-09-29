import express from 'express';
import supabaseAdmin from '../../supabase/supabaseAdmin.js';

const router = express.Router();

const SELECT_WITH_COURSE = `
  *,
  course:course_id (id, name, category, tutor_type, main_category, is_adaptive)
`;

// Every recordings route needs the caller's app-level role - req.user (from the auth middleware
// in index.js) is the raw Supabase Auth user only, matching the convention used throughout
// supportIssues.js/tutor.js.
const getProfile = async (userId) => {
  const { data } = await supabaseAdmin.from('profiles').select('id, name, email, role, plan_type').eq('id', userId).single();
  return data || null;
};

// The Admin > Plan Management > Feature Toggles "Recordings" switch, enforced HERE - not just by
// the frontend hiding the sidebar item/route. A student whose plan has this off must be blocked
// at the API too, or a direct URL/deep link/raw API call would still work. Only gates students
// (Free/Premium are a student subscription concept in this app - tutors/admin are never plan-
// gated here, matching how FeatureGate.jsx itself is only ever used on student routes).
const isRecordingsEnabledForPlan = async (planType) => {
  const { data } = await supabaseAdmin
    .from('plan_settings')
    .select('feature_recordings')
    .eq('plan_type', (planType || 'free').toLowerCase())
    .maybeSingle();
  // Once the migration has run, every real plan_settings row explicitly has this column (DEFAULT
  // true), so `data` being null here only means the plan_type row itself doesn't exist at all - a
  // genuine data-integrity gap, not an admin choice. Fail OPEN in that specific case rather than
  // silently locking every student out over a missing row; an explicit `false` is always honored.
  if (!data) return true;
  return data.feature_recordings !== false;
};

const requireAdmin = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const profile = await getProfile(req.user.id);
  if (!profile || profile.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return profile;
};

// Last number in the course/recording's own title - Full-Length Tests are a numbered series
// (Test 1, Test 2, ... Test 11) and must sort 1,2,3...11, never the string-sort 1,10,11,2,3 a
// plain alphabetical/name sort would produce.
const extractTrailingNumber = (name) => {
  const match = (name || '').match(/(\d+)(?!.*\d)/);
  return match ? parseInt(match[1], 10) : Infinity;
};

const CATEGORY_LABEL = { sat: 'SAT', act: 'ACT', ap: 'AP', full_length_test: 'Full-Length Test' };

// Recording Title is optional for the admin - the Category/Section/Unit/Topic selection already
// identifies the recording. The frontend already fills a sensible default before submitting, but
// this is a server-side backstop (any other/future caller of this endpoint) so a blank title
// never actually lands in the database.
const buildFallbackTitle = async ({ category, courseId, unitName, topicName }) => {
  if (category === 'full_length_test') {
    if (courseId) {
      const { data: course } = await supabaseAdmin.from('courses').select('name').eq('id', courseId).single();
      if (course?.name) return `${course.name} Recording`;
    }
    return 'Full-Length Test Recording';
  }
  let subjectLabel = `All ${CATEGORY_LABEL[category] || category}`;
  if (courseId) {
    const { data: course } = await supabaseAdmin.from('courses').select('tutor_type').eq('id', courseId).single();
    if (course?.tutor_type) subjectLabel = course.tutor_type;
  }
  const parts = [subjectLabel];
  if (topicName) parts.push(topicName);
  else if (unitName) parts.push(unitName);
  return `${parts.join(' — ')} Recording`;
};

/**
 * POST /api/recordings — Admin only. Creates one recording, defaulting to Draft.
 * body: { title?, description?, videoUrl, category, section?, courseId?, unitName?, topicName?,
 *         recordingDate?, recordingTime?, status?, visibleToStudents?, visibleToTutors? }
 * Title is optional - Category/Section/Unit/Topic already identify the recording, so a blank
 * title gets a sensible auto-generated one instead of being rejected.
 */
router.post('/', async (req, res) => {
  try {
    const profile = await requireAdmin(req, res);
    if (!profile) return;

    const {
      title,
      description,
      videoUrl,
      category,
      section,
      courseId,
      unitName,
      topicName,
      recordingDate,
      recordingTime,
      status,
      visibleToStudents,
      visibleToTutors
    } = req.body;

    if (!videoUrl || !category) {
      return res.status(400).json({ error: 'videoUrl and category are required.' });
    }
    if (!['sat', 'act', 'ap', 'full_length_test'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category.' });
    }

    const finalStatus = status || 'draft';
    const finalTitle = (title && title.trim()) || await buildFallbackTitle({ category, courseId, unitName, topicName });
    const record = {
      title: finalTitle,
      description: description || null,
      video_url: videoUrl,
      category,
      section: section || null,
      course_id: courseId || null,
      unit_name: unitName || null,
      topic_name: topicName || null,
      recording_date: recordingDate || null,
      recording_time: recordingTime || null,
      status: finalStatus,
      visible_to_students: visibleToStudents !== false,
      visible_to_tutors: visibleToTutors !== false,
      created_by: profile.id,
      published_at: finalStatus === 'published' ? new Date().toISOString() : null
    };

    // Duplicate-prevention warning (not a hard block) - same video URL already linked to the same
    // course/test is almost always an accidental re-submit.
    let duplicateWarning = null;
    if (record.course_id) {
      const { data: existing } = await supabaseAdmin
        .from('recordings')
        .select('id, title')
        .eq('video_url', record.video_url)
        .eq('course_id', record.course_id)
        .limit(1);
      if (existing?.length) {
        duplicateWarning = `This video URL is already linked to "${existing[0].title}" for this course/test.`;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('recordings')
      .insert(record)
      .select(SELECT_WITH_COURSE)
      .single();

    if (error) throw error;
    res.json({ success: true, data, duplicateWarning });
  } catch (error) {
    console.error('Error creating recording:', error);
    res.status(500).json({ error: 'Failed to create recording' });
  }
});

/**
 * GET /api/recordings/admin — Admin only. Every recording, any status, with optional filters.
 */
router.get('/admin', async (req, res) => {
  try {
    const profile = await requireAdmin(req, res);
    if (!profile) return;

    const { category, courseId, status, search } = req.query;
    let query = supabaseAdmin.from('recordings').select(SELECT_WITH_COURSE).order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (courseId) query = query.eq('course_id', courseId);
    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(`title.ilike.%${search}%,topic_name.ilike.%${search}%,unit_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error fetching recordings (admin):', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

/**
 * PATCH /api/recordings/:id — Admin only. Edits in place - never creates a duplicate row.
 */
router.patch('/:id', async (req, res) => {
  try {
    const profile = await requireAdmin(req, res);
    if (!profile) return;

    const { id } = req.params;
    const {
      title,
      description,
      videoUrl,
      category,
      section,
      courseId,
      unitName,
      topicName,
      recordingDate,
      recordingTime,
      status,
      visibleToStudents,
      visibleToTutors
    } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description || null;
    if (videoUrl !== undefined) updates.video_url = videoUrl;
    if (category !== undefined) updates.category = category;
    if (section !== undefined) updates.section = section || null;
    if (courseId !== undefined) updates.course_id = courseId || null;
    if (unitName !== undefined) updates.unit_name = unitName || null;
    if (topicName !== undefined) updates.topic_name = topicName || null;
    if (recordingDate !== undefined) updates.recording_date = recordingDate || null;
    if (recordingTime !== undefined) updates.recording_time = recordingTime || null;
    if (visibleToStudents !== undefined) updates.visible_to_students = visibleToStudents !== false;
    if (visibleToTutors !== undefined) updates.visible_to_tutors = visibleToTutors !== false;

    if (status !== undefined) {
      updates.status = status;
      if (status === 'published') {
        // Only stamp published_at the FIRST time a recording goes live - flipping it to
        // Unpublished and back to Published keeps its original publish date, same idempotency
        // rule used for custom_prep task completion.
        const { data: current } = await supabaseAdmin.from('recordings').select('published_at').eq('id', id).single();
        if (!current?.published_at) updates.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabaseAdmin
      .from('recordings')
      .update(updates)
      .eq('id', id)
      .select(SELECT_WITH_COURSE)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating recording:', error);
    res.status(500).json({ error: 'Failed to update recording' });
  }
});

/**
 * DELETE /api/recordings/:id — Admin only. Removes only the recording row - never the underlying
 * course/topic/test it referenced.
 */
router.delete('/:id', async (req, res) => {
  try {
    const profile = await requireAdmin(req, res);
    if (!profile) return;

    const { id } = req.params;
    const { error } = await supabaseAdmin.from('recordings').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

/**
 * GET /api/recordings — Student/Tutor. Only Published rows, and only the ones the caller's role
 * is allowed to see (visible_to_students / visible_to_tutors) - enforced here server-side, not
 * left to the frontend to hide. Optional filters/search for the browse UI.
 */
router.get('/', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await getProfile(req.user.id);
    if (!profile) return res.status(401).json({ error: 'Unauthorized' });

    const role = profile.role;
    if (!['student', 'tutor', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Recordings are not available for this account type.' });
    }

    if (role === 'student' && !(await isRecordingsEnabledForPlan(profile.plan_type))) {
      return res.status(403).json({ error: 'Recordings is not available on your current plan.' });
    }

    let query = supabaseAdmin
      .from('recordings')
      .select(SELECT_WITH_COURSE)
      .eq('status', 'published')
      .order('recording_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    // Admin previewing the student/tutor experience (SWITCH VIEW) sees everything published;
    // a real student/tutor is filtered to only the audience they were granted.
    if (role === 'student') query = query.eq('visible_to_students', true);
    if (role === 'tutor') query = query.eq('visible_to_tutors', true);

    const { category, section, courseId, search } = req.query;
    if (category) query = query.eq('category', category);
    if (section) query = query.eq('section', section);
    if (courseId) query = query.eq('course_id', courseId);
    if (search) {
      query = query.or(`title.ilike.%${search}%,topic_name.ilike.%${search}%,unit_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const results = (data || []).sort((a, b) => {
      // Full-Length Test recordings sort numerically by their test's own number, everything else
      // keeps the newest-first ordering the query already applied.
      if (a.category === 'full_length_test' && b.category === 'full_length_test') {
        return extractTrailingNumber(a.course?.name) - extractTrailingNumber(b.course?.name);
      }
      return 0;
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

export default router;
