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
  const { data, error } = await supabaseAdmin
    .from('plan_settings')
    .select('feature_recordings')
    .eq('plan_type', (planType || 'free').toLowerCase())
    .maybeSingle();
  if (error) {
    // Most likely cause: the plan_settings.feature_recordings migration hasn't been run against
    // this database yet (PostgREST errors on an unknown column) - surface that loudly in logs
    // instead of silently failing open/closed, since that's exactly the kind of gap that's easy
    // to miss otherwise.
    console.error('[Recordings] Failed to read feature_recordings from plan_settings - has the plan_settings_recordings_feature migration been run?', error.message);
    return true;
  }
  // Once the migration has run, every real plan_settings row explicitly has this column (DEFAULT
  // true), so `data` being null here only means the plan_type row itself doesn't exist at all - a
  // genuine data-integrity gap, not an admin choice. Fail OPEN in that specific case rather than
  // silently locking every student out over a missing row; an explicit `false` is always honored.
  if (!data) return true;
  return data.feature_recordings !== false;
};

// Admin > Plan Management > Course & Recording Visibility - a SEPARATE global layer from the
// per-plan feature_recordings toggle above. That controls whether Recordings is available to a
// plan at all; this controls which categories ('sat'|'act'|'ap'|'full_length_test'|'platform')
// are visible within it, platform-wide, regardless of plan/group assignment. Both must pass.
const getRecordingCategoryVisibility = async () => {
  const { data, error } = await supabaseAdmin
    .from('category_visibility_settings')
    .select('category, enabled')
    .eq('context', 'recordings');
  if (error) {
    // Same "migration not applied yet" class of gap as everywhere else in this file - fail OPEN
    // (every category visible) rather than hiding every recording site-wide over a missing table.
    console.error('[Recordings] Failed to read category_visibility_settings - has that migration been run?', error.message);
    return {};
  }
  const map = {};
  (data || []).forEach((row) => { map[row.category] = row.enabled; });
  return map;
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

// Platform Recordings (tutorial/help videos, not tied to any course) pick from this curated list
// instead of the SAT/ACT/AP/Full-Length category used by Course Recordings - not validated against
// a DB table since the PRD describes it as an admin-curated, occasionally-edited constant list.
const PLATFORM_CATEGORIES = [
  'Getting Started', 'Account & Profile', 'How to Use the Platform', 'Taking Tests',
  'Practice Quizzes', 'Test Review', 'Score Predictor', 'Study Plan Agent', 'Weakness Drills',
  'Custom Prep', 'Leaderboard', 'Calendar', 'Other'
];

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
      recordingType,
      category,
      section,
      courseId,
      unitName,
      topicName,
      platformCategory,
      availability,
      recordingDate,
      recordingTime,
      status,
      visibleToStudents,
      visibleToTutors
    } = req.body;

    const finalRecordingType = recordingType === 'platform' ? 'platform' : 'course';

    if (!videoUrl) {
      return res.status(400).json({ error: 'videoUrl is required.' });
    }
    if (finalRecordingType === 'course') {
      if (!category) return res.status(400).json({ error: 'category is required for a Course Recording.' });
      if (!['sat', 'act', 'ap', 'full_length_test'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category.' });
      }
    } else {
      if (!platformCategory || !PLATFORM_CATEGORIES.includes(platformCategory)) {
        return res.status(400).json({ error: 'A valid platformCategory is required for a Platform Recording.' });
      }
    }

    // Course Recordings are always group-gated (per PRD, "assign to groups" is the only mode a
    // course recording has ever had) - "All Eligible Students" is a Platform-Recording-only concept.
    const finalAvailability = finalRecordingType === 'platform' && availability === 'all_students' ? 'all_students' : 'groups';

    const finalStatus = status || 'draft';
    const finalTitle = (title && title.trim()) || (finalRecordingType === 'platform'
      ? `${platformCategory} — Platform Recording`
      : await buildFallbackTitle({ category, courseId, unitName, topicName }));
    const record = {
      title: finalTitle,
      description: description || null,
      video_url: videoUrl,
      recording_type: finalRecordingType,
      category: finalRecordingType === 'course' ? category : null,
      section: finalRecordingType === 'course' ? (section || null) : null,
      course_id: finalRecordingType === 'course' ? (courseId || null) : null,
      unit_name: finalRecordingType === 'course' ? (unitName || null) : null,
      topic_name: finalRecordingType === 'course' ? (topicName || null) : null,
      platform_category: finalRecordingType === 'platform' ? platformCategory : null,
      availability: finalAvailability,
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

    let { data, error } = await supabaseAdmin
      .from('recordings')
      .insert(record)
      .select(SELECT_WITH_COURSE)
      .single();

    // The 1790920000000-recordings_type_and_group_assignment.sql migration (adds recording_type/
    // platform_category/availability) hasn't been run against this database yet - the same class
    // of gap that's hit plan_settings.feature_recordings and the recordings table itself earlier
    // this session. A Platform Recording genuinely CANNOT be created without it (there's nowhere
    // to store platformCategory), so surface that clearly rather than silently mis-saving it as an
    // untyped row. A Course Recording never needed these columns to function, so retry without them.
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      console.error('[Recordings] recording_type/platform_category/availability columns missing - run migration 1790920000000-recordings_type_and_group_assignment.sql.', error.message);
      if (finalRecordingType === 'platform') {
        return res.status(500).json({ error: 'Platform Recordings require a database migration that has not been run yet (1790920000000-recordings_type_and_group_assignment.sql). Please run it, then try again.' });
      }
      const { recording_type: _rt, platform_category: _pc, availability: _av, ...fallbackRecord } = record;
      ({ data, error } = await supabaseAdmin
        .from('recordings')
        .insert(fallbackRecord)
        .select(SELECT_WITH_COURSE)
        .single());
    }

    // recordings.category was NOT NULL on the original schema (every recording used to be a
    // Course Recording) - a Platform Recording legitimately has no category and can't be created
    // until 1790920000000-recordings_type_and_group_assignment.sql's `DROP NOT NULL` has run.
    if (error && error.code === '23502' && error.message?.includes('"category"')) {
      console.error('[Recordings] recordings.category is still NOT NULL - run migration 1790920000000-recordings_type_and_group_assignment.sql (includes ALTER COLUMN category DROP NOT NULL).', error.message);
      return res.status(500).json({ error: 'Platform Recordings require a database migration that has not been run yet (1790920000000-recordings_type_and_group_assignment.sql). Please run it, then try again.' });
    }

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

    const { category, courseId, status, search, recordingType } = req.query;
    let query = supabaseAdmin.from('recordings').select(SELECT_WITH_COURSE).order('created_at', { ascending: false });

    if (recordingType) query = query.eq('recording_type', recordingType);
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
      recordingType,
      category,
      section,
      courseId,
      unitName,
      topicName,
      platformCategory,
      availability,
      recordingDate,
      recordingTime,
      status,
      visibleToStudents,
      visibleToTutors
    } = req.body;

    if (recordingType !== undefined && !['course', 'platform'].includes(recordingType)) {
      return res.status(400).json({ error: 'Invalid recordingType.' });
    }
    if (platformCategory !== undefined && platformCategory !== null && !PLATFORM_CATEGORIES.includes(platformCategory)) {
      return res.status(400).json({ error: 'Invalid platformCategory.' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description || null;
    if (videoUrl !== undefined) updates.video_url = videoUrl;
    if (recordingType !== undefined) updates.recording_type = recordingType;
    if (category !== undefined) updates.category = category || null;
    if (section !== undefined) updates.section = section || null;
    if (courseId !== undefined) updates.course_id = courseId || null;
    if (unitName !== undefined) updates.unit_name = unitName || null;
    if (topicName !== undefined) updates.topic_name = topicName || null;
    if (platformCategory !== undefined) updates.platform_category = platformCategory || null;
    if (availability !== undefined) {
      // Course Recordings never get "All Eligible Students" - if this PATCH doesn't also set
      // recordingType, resolve against the row's CURRENT type so a course recording can't slip
      // into all_students via a partial update that omits recordingType.
      let typeForAvailability = recordingType;
      if (typeForAvailability === undefined) {
        const { data: current } = await supabaseAdmin.from('recordings').select('recording_type').eq('id', id).single();
        typeForAvailability = current?.recording_type;
      }
      updates.availability = (typeForAvailability === 'platform' && availability === 'all_students') ? 'all_students' : 'groups';
    }
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

    let { data, error } = await supabaseAdmin
      .from('recordings')
      .update(updates)
      .eq('id', id)
      .select(SELECT_WITH_COURSE)
      .single();

    // Same migration-not-applied-yet gap as POST /api/recordings - see comment there.
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      const touchedNewColumns = ['recording_type', 'platform_category', 'availability'].some((k) => k in updates);
      if (touchedNewColumns) {
        console.error('[Recordings] recording_type/platform_category/availability columns missing - run migration 1790920000000-recordings_type_and_group_assignment.sql.', error.message);
        if (updates.recording_type === 'platform' || updates.platform_category) {
          return res.status(500).json({ error: 'Platform Recordings require a database migration that has not been run yet (1790920000000-recordings_type_and_group_assignment.sql). Please run it, then try again.' });
        }
        const { recording_type: _rt, platform_category: _pc, availability: _av, ...fallbackUpdates } = updates;
        ({ data, error } = await supabaseAdmin
          .from('recordings')
          .update(fallbackUpdates)
          .eq('id', id)
          .select(SELECT_WITH_COURSE)
          .single());
      }
    }

    if (error && error.code === '23502' && error.message?.includes('"category"')) {
      console.error('[Recordings] recordings.category is still NOT NULL - run migration 1790920000000-recordings_type_and_group_assignment.sql (includes ALTER COLUMN category DROP NOT NULL).', error.message);
      return res.status(500).json({ error: 'Platform Recordings require a database migration that has not been run yet (1790920000000-recordings_type_and_group_assignment.sql). Please run it, then try again.' });
    }

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating recording:', error);
    res.status(500).json({ error: 'Failed to update recording' });
  }
});

/**
 * GET /api/recordings/assignable — Admin or Tutor. A flat, lightweight list of every Published
 * recording, for the group-management "Assign Recordings" checkbox picker (PRD section 7) - NOT
 * gated by group membership itself, since choosing what to assign is the authorized action here,
 * not a visibility check. Draft recordings are excluded - nothing not yet published is assignable.
 */
router.get('/assignable', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await getProfile(req.user.id);
    if (!profile || !['admin', 'tutor'].includes(profile.role)) {
      return res.status(403).json({ error: 'Admin or tutor access required' });
    }

    const { search } = req.query;
    let query = supabaseAdmin
      .from('recordings')
      .select('id, title, recording_type, category, platform_category, availability, course:course_id (id, name, category, tutor_type, main_category)')
      .eq('status', 'published')
      .order('title', { ascending: true });
    if (search) {
      query = query.or(`title.ilike.%${search}%,platform_category.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error fetching assignable recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
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

// A recording is visible to a STUDENT only if it's a Platform Recording explicitly opened up to
// everyone, OR it was actually assigned (via group_recording_assignments) to one of the student's
// own groups (recordings are never globally visible just by being Published - the whole point of
// the group-gating requirement). Returns { allowedIds: Set<recording_id>, deadlineByRecordingId:
// Map } - the deadline is each ASSIGNMENT's own `deadline` (not a group-wide date - the same
// recording can be assigned to different groups with different deadlines), taking the EARLIEST
// one across every assignment that granted the student that recording.
const getStudentRecordingAccess = async (studentId) => {
  const { data: memberships, error: memberErr } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .eq('student_id', studentId);
  if (memberErr) {
    console.error('[Recordings] Failed to read group_members for student access check:', memberErr.message);
    return { allowedIds: new Set(), deadlineByRecordingId: new Map() };
  }
  const groupIds = (memberships || []).map(m => m.group_id);
  if (groupIds.length === 0) return { allowedIds: new Set(), deadlineByRecordingId: new Map() };

  const { data: assignments, error: assignmentErr } = await supabaseAdmin
    .from('group_recording_assignments')
    .select('recording_id, deadline')
    .in('group_id', groupIds)
    .eq('status', 'active');
  if (assignmentErr) {
    // Same class of "migration not applied yet" gap seen with plan_settings.feature_recordings -
    // fail toward "nothing group-assigned" rather than crashing the whole recordings list.
    console.error('[Recordings] Failed to read group_recording_assignments - has the group_recording_assignments migration been run?', assignmentErr.message);
    return { allowedIds: new Set(), deadlineByRecordingId: new Map() };
  }

  const allowedIds = new Set();
  const deadlineByRecordingId = new Map();
  for (const assignment of assignments || []) {
    allowedIds.add(assignment.recording_id);
    if (assignment.deadline) {
      const existing = deadlineByRecordingId.get(assignment.recording_id);
      if (!existing || new Date(assignment.deadline) < new Date(existing)) {
        deadlineByRecordingId.set(assignment.recording_id, assignment.deadline);
      }
    }
  }
  return { allowedIds, deadlineByRecordingId };
};

/**
 * GET /api/recordings — Student/Tutor. Only Published rows, and only the ones the caller's role
 * is allowed to see (visible_to_students / visible_to_tutors) - enforced here server-side, not
 * left to the frontend to hide. Optional filters/search for the browse UI.
 *
 * For students specifically: a recording must ALSO be either a Platform Recording marked "All
 * Eligible Students", or actually assigned to one of the student's Student Groups - see
 * getStudentRecordingAccess. This is resolved and filtered here, backend-side, never by fetching
 * everything and hiding rows on the frontend.
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

    let rows = data || [];

    // Course & Recording Visibility applies to real students AND tutors - admin's SWITCH VIEW
    // preview still sees everything Published, same exemption the group-gating below already has.
    if (role === 'student' || role === 'tutor') {
      const categoryVisibility = await getRecordingCategoryVisibility();
      rows = rows.filter(r => {
        const key = r.recording_type === 'platform' ? 'platform' : r.category;
        return categoryVisibility[key] !== false;
      });
    }

    // Group-gating applies to real students only - admin's SWITCH VIEW preview and tutors both
    // continue to see everything Published for their role, unaffected by group assignment.
    if (role === 'student') {
      const { allowedIds, deadlineByRecordingId } = await getStudentRecordingAccess(profile.id);
      rows = rows
        .filter(r => (r.recording_type === 'platform' && r.availability === 'all_students') || allowedIds.has(r.id))
        .map(r => ({ ...r, deadline: deadlineByRecordingId.get(r.id) || null }));
    }

    const results = rows.sort((a, b) => {
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
