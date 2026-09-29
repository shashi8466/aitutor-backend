import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { recordingService, courseService } from '../../services/api';

const { FiVideo, FiPlus, FiEdit, FiTrash2, FiX, FiSearch, FiEye, FiEyeOff, FiRefreshCw, FiAlertTriangle } = FiIcons;

const CATEGORY_LABEL = { sat: 'SAT', act: 'ACT', ap: 'AP', full_length_test: 'Full-Length Test' };
const STATUS_STYLE = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  unpublished: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
};
// Shared classes for every text input/select/textarea in this form - explicit in BOTH light and
// dark mode so nothing silently inherits a low-contrast default from the page theme.
const FIELD_CLASS = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// Groups the real `courses` rows purely off existing main_category/tutor_type metadata - same
// rule used for the Admin > Questions course filter, kept local here since it's a small,
// self-contained mapping rather than shared plumbing.
const getFullLengthTestLabel = (course) => {
  const tutorType = (course.tutor_type || '').toUpperCase();
  if (tutorType === 'FULL-LENGTH SAT') return 'SAT Full-Length Test';
  if (tutorType === 'FULL-LENGTH ACT') return 'ACT Full-Length Test';
  if (tutorType === 'LINEAR SAT') return 'Linear Full-Length Test';
  return 'Full-Length Test';
};
const extractTrailingNumber = (name) => {
  const match = (name || '').match(/(\d+)(?!.*\d)/);
  return match ? parseInt(match[1], 10) : Infinity;
};

// "General" bucket for the (rare) course row with a blank category - e.g. a SAT Math topic that
// was never assigned a unit. Keeps the Unit dropdown from showing an unlabeled blank option.
const GENERAL_UNIT = 'General';
const unitOf = (course) => (course?.category && course.category.trim()) || GENERAL_UNIT;

const emptyForm = {
  title: '',
  description: '',
  videoUrl: '',
  category: 'sat',
  subject: '', // tutor_type value, e.g. "SAT Math" / "ACT English" / "AP Biology" - '' = "All <category>"
  unitName: '',
  topicCourseId: '', // the exact topic-level courses.id, when the subject has more than one course
  fullLengthCourseId: '',
  recordingDate: '',
  recordingTime: '',
  status: 'draft',
  visibleToStudents: true,
  visibleToTutors: true
};

const RecordingsManagement = () => {
  const [recordings, setRecordings] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', status: '', search: '' });
  const [activeTab, setActiveTab] = useState('All');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    loadRecordings();
  }, [filters.category, filters.status]);

  const loadCourses = async () => {
    try {
      const { data } = await courseService.getAll();
      setCourses(data || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      const { data } = await recordingService.getAllAdmin(params);
      setRecordings(data.data || []);
    } catch (err) {
      console.error('Failed to load recordings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecordings = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return recordings.filter((r) => {
      if (!term) return true;
      return (
        (r.title || '').toLowerCase().includes(term) ||
        (r.topic_name || '').toLowerCase().includes(term) ||
        (r.unit_name || '').toLowerCase().includes(term) ||
        (r.course?.name || '').toLowerCase().includes(term)
      );
    });
  }, [recordings, filters.search]);

  // Real courses in each taxonomy category, so the form can resolve a subject selection to an
  // actual courses.id - never a second, recording-only copy of the course structure.
  const subjectCourses = useMemo(() => {
    const cat = form.category;
    if (cat === 'full_length_test') return [];
    const mainCat = cat.toUpperCase();
    return courses.filter((c) => (c.main_category || '').toUpperCase() === mainCat);
  }, [courses, form.category]);

  const fullLengthCourses = useMemo(() => {
    return courses
      .filter((c) => (c.main_category || '').toUpperCase() === 'FULL LENGTH TESTS')
      .sort((a, b) => extractTrailingNumber(a.name) - extractTrailingNumber(b.name));
  }, [courses]);

  // Subject choices come from the ACTUAL courses in this category - never a static/aspirational
  // catalog - so a subject only ever appears here if real content exists for it.
  const subjectOptions = useMemo(() => {
    const set = new Set(subjectCourses.map((c) => c.tutor_type).filter(Boolean));
    return Array.from(set).sort();
  }, [subjectCourses]);

  // Every course row under the selected subject. SAT subjects are one-row-PER-TOPIC (e.g. 19
  // separate "SAT Math" courses, one named "Nonlinear functions", another "Circles", ...); ACT and
  // most AP subjects are a single course covering the whole subject internally. This list's length
  // is what decides whether the Unit/Topic drill-down below is even shown.
  const coursesForSubject = useMemo(() => {
    if (!form.subject) return [];
    return subjectCourses.filter((c) => c.tutor_type === form.subject);
  }, [subjectCourses, form.subject]);

  const needsTopicDrilldown = coursesForSubject.length > 1;

  const unitOptions = useMemo(() => {
    const set = new Set(coursesForSubject.map(unitOf));
    return Array.from(set).sort();
  }, [coursesForSubject]);

  const topicCourseOptions = useMemo(() => {
    if (!form.unitName) return [];
    return coursesForSubject.filter((c) => unitOf(c) === form.unitName);
  }, [coursesForSubject, form.unitName]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setDuplicateWarning('');
    setShowForm(true);
  };

  const openEditForm = (r) => {
    setEditingId(r.id);
    const isFullLength = r.category === 'full_length_test';
    // A saved recording only tells us its course_id - re-derive which unit that course sits
    // under (if any) so the Unit dropdown opens already pointed at the right bucket.
    const course = !isFullLength ? r.course : null;
    setForm({
      title: r.title || '',
      description: r.description || '',
      videoUrl: r.video_url || '',
      category: r.category || 'sat',
      subject: isFullLength ? '' : (course?.tutor_type || ''),
      unitName: course ? unitOf(course) : '',
      topicCourseId: course ? String(r.course_id || '') : '',
      fullLengthCourseId: isFullLength ? String(r.course_id || '') : '',
      recordingDate: r.recording_date || '',
      recordingTime: r.recording_time || '',
      status: r.status || 'draft',
      visibleToStudents: r.visible_to_students !== false,
      visibleToTutors: r.visible_to_tutors !== false
    });
    setFormError('');
    setDuplicateWarning('');
    setShowForm(true);
  };

  const handleCategoryChange = (category) => {
    setForm((prev) => ({ ...emptyForm, title: prev.title, description: prev.description, videoUrl: prev.videoUrl, status: prev.status, recordingDate: prev.recordingDate, recordingTime: prev.recordingTime, visibleToStudents: prev.visibleToStudents, visibleToTutors: prev.visibleToTutors, category }));
  };

  // The single real course this form currently resolves to, if any - a specific topic-level
  // course once drilled all the way down (SAT), or the subject's one-and-only course as soon as
  // the subject itself is picked (ACT/most AP).
  const resolvedSubjectCourse = needsTopicDrilldown
    ? coursesForSubject.find((c) => String(c.id) === form.topicCourseId)
    : coursesForSubject[0];

  // The Recording Title is optional - Category/Section/Unit/Topic already identify the recording,
  // so when the admin leaves it blank this builds a meaningful default from what they DID select,
  // rather than saving a blank/placeholder title.
  const buildAutoTitle = () => {
    if (form.category === 'full_length_test') {
      const course = fullLengthCourses.find((c) => String(c.id) === form.fullLengthCourseId);
      return course ? `${course.name} Recording` : 'Full-Length Test Recording';
    }
    if (resolvedSubjectCourse) {
      return resolvedSubjectCourse.name === resolvedSubjectCourse.tutor_type
        ? `${resolvedSubjectCourse.tutor_type} Recording`
        : `${resolvedSubjectCourse.tutor_type} — ${resolvedSubjectCourse.name} Recording`;
    }
    return `${form.subject || `All ${CATEGORY_LABEL[form.category]}`} Recording`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setDuplicateWarning('');

    if (!form.videoUrl.trim()) {
      setFormError('Recording Link is required.');
      return;
    }

    let courseId = null;
    let section = null;
    if (form.category === 'full_length_test') {
      courseId = form.fullLengthCourseId ? parseInt(form.fullLengthCourseId, 10) : null;
    } else {
      if (form.category === 'sat' && form.subject) {
        section = form.subject === 'SAT Math' ? 'math' : 'reading_writing';
      }
      // Reuse the EXACT courses.id My Courses/Custom Prep already use for this topic - never a
      // second, recording-only identifier. Single-course subjects (ACT, most AP) resolve as soon
      // as the subject is picked; multi-course subjects (SAT) need the Unit + Topic drill-down.
      courseId = resolvedSubjectCourse ? resolvedSubjectCourse.id : null;
    }

    const payload = {
      title: form.title.trim() || buildAutoTitle(),
      description: form.description.trim() || null,
      videoUrl: form.videoUrl.trim(),
      category: form.category,
      section,
      courseId,
      recordingDate: form.recordingDate || null,
      recordingTime: form.recordingTime || null,
      status: form.status,
      visibleToStudents: form.visibleToStudents,
      visibleToTutors: form.visibleToTutors
    };

    setSaving(true);
    try {
      if (editingId) {
        await recordingService.update(editingId, payload);
      } else {
        const res = await recordingService.create(payload);
        if (res.data?.duplicateWarning) setDuplicateWarning(res.data.duplicateWarning);
      }
      setShowForm(false);
      await loadRecordings();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save recording.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (r) => {
    const nextStatus = r.status === 'published' ? 'unpublished' : 'published';
    try {
      await recordingService.update(r.id, { status: nextStatus });
      await loadRecordings();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await recordingService.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadRecordings();
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  };

  const formatDate = (d) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const relatedLabel = (r) => {
    if (r.category === 'full_length_test') return r.course?.name || '—';
    return r.course?.tutor_type || `All ${CATEGORY_LABEL[r.category]}`;
  };

  // "Topic" only means something distinct from the subject itself when that subject has more
  // than one course (SAT's per-topic model) - for a single-course subject (ACT, most AP) the
  // course name IS the subject name, so showing it again in this column would just be noise.
  const topicLabel = (r) => {
    if (r.category === 'full_length_test' || !r.course) return '—';
    return r.course.name !== r.course.tutor_type ? r.course.name : '—';
  };

  const TABS = ['All', 'sat', 'act', 'ap', 'full_length_test'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SafeIcon icon={FiVideo} className="text-red-600" /> Recordings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage tutorial classes, course recordings, topic recordings, and full-length test recordings.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openCreateForm}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors font-bold"
        >
          <SafeIcon icon={FiPlus} /> Add Recording
        </motion.button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setFilters((prev) => ({ ...prev, category: tab === 'All' ? '' : tab })); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === tab ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              {tab === 'All' ? 'All' : CATEGORY_LABEL[tab]}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Search recordings..."
              className={`pl-9 ${FIELD_CLASS}`}
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className={FIELD_CLASS}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
          <button onClick={loadRecordings} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap">
            <SafeIcon icon={FiRefreshCw} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Recording</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Course/Test</th>
                <th className="text-left px-4 py-3">Topic</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400 dark:text-gray-500">Loading recordings...</td></tr>
              ) : filteredRecordings.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400 dark:text-gray-500">No recordings found.</td></tr>
              ) : (
                filteredRecordings.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white max-w-xs truncate">{r.title}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{CATEGORY_LABEL[r.category] || r.category}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{relatedLabel(r)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{topicLabel(r)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(r.recording_date) || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${STATUS_STYLE[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditForm(r)} title="Edit" className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                          <SafeIcon icon={FiEdit} className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleStatus(r)} title={r.status === 'published' ? 'Unpublish' : 'Publish'} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg">
                          <SafeIcon icon={r.status === 'published' ? FiEyeOff : FiEye} className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(r)} title="Delete" className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                          <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Recording' : 'Add Recording'}</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><SafeIcon icon={FiX} className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {formError && (
                  <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg flex items-center gap-2"><SafeIcon icon={FiAlertTriangle} /> {formError}</div>
                )}
                {duplicateWarning && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm px-3 py-2 rounded-lg flex items-center gap-2"><SafeIcon icon={FiAlertTriangle} /> {duplicateWarning}</div>
                )}

                <div>
                  <label className={LABEL_CLASS}>Recording Title <span className="text-gray-400 dark:text-gray-500 font-normal">(optional - auto-filled from your selections below if left blank)</span></label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Central Ideas — Tutorial Class" className={FIELD_CLASS} />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Recording Link *</label>
                  <input type="url" required value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." className={FIELD_CLASS} />
                </div>

                <div>
                  <label className={LABEL_CLASS}>Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={FIELD_CLASS} />
                </div>

                <div>
                  <label className={`${LABEL_CLASS} mb-2`}>Recording Category *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => handleCategoryChange(value)}
                        className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${form.category === value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.category === 'full_length_test' ? (
                  <div>
                    <label className={LABEL_CLASS}>Select Test *</label>
                    <select value={form.fullLengthCourseId} onChange={(e) => setForm({ ...form, fullLengthCourseId: e.target.value })} className={FIELD_CLASS}>
                      <option value="">Select a Full-Length Test</option>
                      {fullLengthCourses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({getFullLengthTestLabel(c)})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={LABEL_CLASS}>
                        {form.category === 'sat' ? 'SAT Section' : form.category === 'act' ? 'ACT Course' : 'AP Course'}
                      </label>
                      <select
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value, unitName: '', topicCourseId: '' })}
                        className={FIELD_CLASS}
                      >
                        <option value="">{`All ${CATEGORY_LABEL[form.category]} (general)`}</option>
                        {subjectOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* SAT subjects have one course PER TOPIC (19 separate "SAT Math" courses,
                        e.g. "Nonlinear functions") - drill down to the exact one. ACT and most AP
                        subjects are a single course covering the whole subject, so as soon as the
                        subject above is picked there's nothing further to choose. */}
                    {form.subject && needsTopicDrilldown && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_CLASS}>Unit / Category</label>
                          <select value={form.unitName} onChange={(e) => setForm({ ...form, unitName: e.target.value, topicCourseId: '' })} className={FIELD_CLASS}>
                            <option value="">Select a unit</option>
                            {unitOptions.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>Topic *</label>
                          <select value={form.topicCourseId} onChange={(e) => setForm({ ...form, topicCourseId: e.target.value })} disabled={!form.unitName} className={`${FIELD_CLASS} disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400`}>
                            <option value="">Select a topic</option>
                            {topicCourseOptions.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {form.subject && !needsTopicDrilldown && coursesForSubject.length === 1 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                        This recording will be linked to the existing <strong>{form.subject}</strong> course.
                      </p>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Recording Date <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
                    <input type="date" value={form.recordingDate} onChange={(e) => setForm({ ...form, recordingDate: e.target.value })} className={FIELD_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Recording Time <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span></label>
                    <input type="time" value={form.recordingTime} onChange={(e) => setForm({ ...form, recordingTime: e.target.value })} className={FIELD_CLASS} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={FIELD_CLASS}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="unpublished">Unpublished</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Visible To</label>
                    <div className="flex items-center gap-4 h-[38px]">
                      <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={form.visibleToStudents} onChange={(e) => setForm({ ...form, visibleToStudents: e.target.checked })} /> Students
                      </label>
                      <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={form.visibleToTutors} onChange={(e) => setForm({ ...form, visibleToTutors: e.target.checked })} /> Tutors
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Publish'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]" onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Recording?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Are you sure you want to delete "<strong>{deleteTarget.title}</strong>"? This cannot be undone. The associated course/topic/test will not be affected.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
                <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecordingsManagement;
