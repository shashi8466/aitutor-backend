import React, { useState, useEffect, useMemo } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import SuccessToast from '../../common/SuccessToast';
import { recordingService, tutorService } from '../../services/api';

const { FiCheck, FiMinus, FiChevronDown, FiChevronRight, FiVideo, FiSearch, FiLoader } = FiIcons;

const CATEGORY_LABEL = { sat: 'SAT', act: 'ACT', ap: 'AP', full_length_test: 'Full-Length Tests' };
const CATEGORY_ORDER = ['full_length_test', 'sat', 'act', 'ap'];

// Full-Length Tests sort numerically by their own trailing number (Test 1, 2, ... 11) - the
// `/assignable` query orders by title alphabetically, which would otherwise read 1, 10, 11, 2, 3.
const extractTrailingNumber = (name) => {
  const match = (name || '').match(/(\d+)(?!.*\d)/);
  return match ? parseInt(match[1], 10) : Infinity;
};

/**
 * Builds a Category -> Subject -> Topic -> recordings[] tree, mirroring the SAME top two levels
 * Assign Content's own tree uses (SAT -> SAT Math / SAT Reading & Writing, ACT -> ACT English /
 * ACT Math / ...) - built ONLY from recordings that actually exist (never the full course/topic
 * taxonomy), per the "don't show empty branches" requirement.
 *
 * - SAT/ACT/AP: Subject = course.tutor_type (e.g. "SAT Math"), Topic = course.name (e.g.
 *   "Circles"). A recording with no course (a general/category-wide recording) falls under a
 *   synthetic "All <Category>" subject, whose single topic is itself - this is what lets the
 *   render step collapse the topic level away for subjects that only ever have one topic
 *   (ACT/most AP, where course.name already equals course.tutor_type).
 * - Full-Length Tests: Subject = course.name directly (each test, e.g. "SAT FULL LENGTH TEST 1",
 *   IS the node - there's no further topic split), so Subject and Topic are the same label,
 *   which the render step collapses to a single level - exactly the 2-level Category -> Test
 *   shape requested, never a hardcoded Test 1/2/3/11 list.
 */
const buildTree = (recordings) => {
  const courseTree = {}; // category -> subjectLabel -> topicLabel -> recordings[]
  const platformTree = {}; // platform_category -> recordings[]

  recordings.forEach((r) => {
    if (r.recording_type === 'platform') {
      const cat = r.platform_category || 'Other';
      if (!platformTree[cat]) platformTree[cat] = [];
      platformTree[cat].push(r);
      return;
    }

    const category = r.category || 'sat';
    if (!courseTree[category]) courseTree[category] = {};

    const subjectLabel = category === 'full_length_test'
      ? (r.course?.name || `All ${CATEGORY_LABEL[category] || category}`)
      : (r.course?.tutor_type || `All ${CATEGORY_LABEL[category] || category}`);
    const topicLabel = category === 'full_length_test' ? subjectLabel : (r.course?.name || subjectLabel);

    if (!courseTree[category][subjectLabel]) courseTree[category][subjectLabel] = {};
    if (!courseTree[category][subjectLabel][topicLabel]) courseTree[category][subjectLabel][topicLabel] = [];
    courseTree[category][subjectLabel][topicLabel].push(r);
  });

  return { courseTree, platformTree };
};

const matchesSearch = (recording, term) => {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    (recording.title || '').toLowerCase().includes(t) ||
    (recording.course?.name || '').toLowerCase().includes(t) ||
    (recording.platform_category || '').toLowerCase().includes(t)
  );
};

/**
 * Tri-state checkbox: 'checked' | 'indeterminate' | 'unchecked'. Includes a real (visually
 * hidden) <input type="checkbox"> - same as HierarchicalContentSelector's own checkboxes -
 * so the browser's native "click anywhere in the enclosing <label>" behavior works here too.
 * Without a real input, only this small styled box itself was clickable; clicking the
 * recording's title/icon right next to it (the much bigger, more obvious target) did nothing.
 */
const TriCheckbox = ({ state, onChange, size = 'w-4 h-4' }) => (
  <div
    className={`${size} rounded-sm flex items-center justify-center border transition-colors shrink-0 ${
      state === 'checked' ? 'bg-blue-600 border-blue-600' : state === 'indeterminate' ? 'bg-blue-600/50 border-blue-600' : 'border-gray-500 bg-gray-800'
    }`}
  >
    <input type="checkbox" className="hidden" checked={state === 'checked'} onChange={(e) => onChange(e.target.checked || state === 'indeterminate')} />
    {state === 'checked' && <SafeIcon icon={FiCheck} className="text-white text-[10px]" />}
    {state === 'indeterminate' && <SafeIcon icon={FiMinus} className="text-white text-[10px]" />}
  </div>
);

const stateOf = (ids, selectedIds) => {
  if (ids.length === 0) return 'unchecked';
  const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
  if (selectedCount === 0) return 'unchecked';
  if (selectedCount === ids.length) return 'checked';
  return 'indeterminate';
};

/**
 * "Manage Recordings" tab content for a Student Group - a tree picker (mirrors
 * HierarchicalContentSelector's look: chevrons, tri-state checkboxes, "X of Y selected" badges)
 * over every Published recording, grouped the same way RecordingsBrowser groups them for
 * students. Self-contained: fetches the group's current assignment + the assignable recordings
 * list on mount, and saves via its own "Save Recordings" button - NOT threaded through the parent
 * Group Settings form, matching Manage Students/Manage Tutors being independent panels too.
 */
const RecordingAssignmentTree = ({ groupId }) => {
  const [recordings, setRecordings] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [initialIds, setInitialIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { title, message } | null
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({ 'course:full_length_test': true, 'course:sat': true });

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      // Fetched independently (not Promise.all) - the two calls hit different tables, and a
      // failure in one (e.g. group_recording_assignments not migrated onto this DB yet) must
      // never blank out the other. Promise.all rejects the WHOLE batch the instant either call
      // throws, which previously made a perfectly good list of published recordings disappear
      // and show the misleading "no recordings exist" empty state, just because this group's
      // current assignment couldn't be read yet.
      const assignableResult = await recordingService.getAssignable().catch((err) => {
        console.error('Failed to load assignable recordings:', err);
        return null;
      });
      if (cancelled) return;

      if (!assignableResult) {
        setLoadError(true);
        setRecordings([]);
        setLoading(false);
        return;
      }
      setRecordings(assignableResult.data?.data || []);

      const groupRecordingsResult = await tutorService.getGroupRecordings(groupId).catch((err) => {
        console.error('Failed to load this group\'s current recording assignments - defaulting to none selected:', err);
        return null;
      });
      if (cancelled) return;
      const ids = new Set((groupRecordingsResult?.data?.recordingIds || []).map(Number));
      setSelectedIds(ids);
      setInitialIds(ids);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  const { courseTree, platformTree } = useMemo(() => buildTree(recordings), [recordings]);

  const toggleIds = (ids, shouldSelect) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (shouldSelect) next.add(id); else next.delete(id); });
      return next;
    });
  };

  const toggleExpand = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const count = selectedIds.size;
      await tutorService.updateGroupRecordings(groupId, Array.from(selectedIds));
      setInitialIds(new Set(selectedIds));
      setToast({
        title: 'Recordings saved successfully',
        message: count > 0 ? `${count} recording${count === 1 ? '' : 's'} assigned to this group.` : 'No recordings are assigned to this group.'
      });
    } catch (err) {
      console.error('Failed to save group recordings:', err);
      alert('Failed to save recording assignments.');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedIds.size !== initialIds.size || [...selectedIds].some((id) => !initialIds.has(id));
  const totalSelected = selectedIds.size;

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-400"><SafeIcon icon={FiLoader} className="animate-spin w-5 h-5 mr-2" /> Loading recordings...</div>;
  }

  if (loadError) {
    return <div className="flex items-center justify-center h-40 text-red-400 text-sm text-center px-6">Unable to load recordings. Please refresh and try again.</div>;
  }

  const renderLeaf = (r) => {
    if (!matchesSearch(r, search)) return null;
    const isChecked = selectedIds.has(r.id);
    return (
      <label key={r.id} className="flex items-center gap-2.5 cursor-pointer text-gray-400 hover:text-gray-200 py-0.5">
        <TriCheckbox state={isChecked ? 'checked' : 'unchecked'} onChange={(next) => toggleIds([r.id], next)} size="w-3.5 h-3.5" />
        <SafeIcon icon={FiVideo} className="w-3 h-3 text-red-500 shrink-0" />
        <span className="text-xs font-medium select-none">{r.title}</span>
      </label>
    );
  };

  // A group (course/unit/category) node: chevron + tri-state checkbox + "X of Y selected" badge,
  // expanding to its children. `idsOf` returns every leaf recording id under this node (for the
  // tri-state checkbox and the count badge) - NOT filtered by search, so the badge always reflects
  // real totals regardless of what's currently typed into the search box.
  const renderGroupNode = (key, label, leafRecordings, children) => {
    const ids = leafRecordings.map((r) => r.id);
    const state = stateOf(ids, selectedIds);
    const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
    const isExpanded = expanded[key] !== false; // default-expanded unless explicitly collapsed
    const matchesAnyChild = !search || leafRecordings.some((r) => matchesSearch(r, search));
    if (!matchesAnyChild) return null;

    return (
      <div key={key} className="mb-1">
        <div className="flex items-center justify-between group py-1">
          <label className="flex items-center gap-2.5 cursor-pointer text-gray-300 hover:text-white">
            <TriCheckbox state={state} onChange={(next) => toggleIds(ids, next)} />
            <span
              className="text-xs font-bold text-gray-200 select-none flex items-center gap-1 cursor-pointer hover:text-blue-300"
              onClick={(e) => { e.preventDefault(); toggleExpand(key); }}
            >
              <SafeIcon icon={isExpanded ? FiChevronDown : FiChevronRight} className="w-3.5 h-3.5 text-gray-400" />
              {label}
            </span>
          </label>
          <span className="text-[11px] font-semibold text-gray-400">
            {selectedCount > 0 ? (
              <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded">{selectedCount} of {ids.length} selected</span>
            ) : (
              <span className="text-gray-500">{ids.length} recording{ids.length === 1 ? '' : 's'}</span>
            )}
          </span>
        </div>
        {isExpanded && <div className="ml-6 mt-1 border-l border-gray-700/60 pl-4 space-y-2">{children}</div>}
      </div>
    );
  };

  const allCourseRecordings = Object.values(courseTree).flatMap((subjects) =>
    Object.values(subjects).flatMap((topics) => Object.values(topics).flat())
  );
  const allPlatformRecordings = Object.values(platformTree).flat();

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col h-full">
      <div className="p-3 border-b border-gray-700 bg-gray-900/50 flex items-center gap-2">
        <SafeIcon icon={FiSearch} className="text-gray-400 w-4 h-4 shrink-0" />
        <input
          type="text"
          placeholder="Search recordings..."
          className="w-full bg-gray-700 border-none text-white rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-y-auto p-4 flex-1 space-y-4">
        {recordings.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No published recordings available.</p>
        ) : (
          <>
            {allCourseRecordings.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Course Recordings</h4>
                <div className="space-y-2">
                  {CATEGORY_ORDER.filter((cat) => courseTree[cat]).map((category) => {
                    const subjects = courseTree[category];
                    const categoryLeaves = Object.values(subjects).flatMap((topics) => Object.values(topics).flat());
                    const subjectEntries = Object.entries(subjects);
                    if (category === 'full_length_test') subjectEntries.sort((a, b) => extractTrailingNumber(a[0]) - extractTrailingNumber(b[0]));
                    return renderGroupNode(`course:${category}`, CATEGORY_LABEL[category] || category, categoryLeaves, (
                      subjectEntries.map(([subjectLabel, topics]) => {
                        const topicEntries = Object.entries(topics);
                        const subjectLeaves = topicEntries.flatMap(([, recs]) => recs);
                        // A subject with exactly one topic sharing its own label (ACT/most AP's
                        // single-course-per-subject case, or a general/no-course recording) has
                        // nothing meaningful to split out - skip straight to its recordings
                        // rather than showing a redundant "SAT Math -> SAT Math" level.
                        const collapseTopic = topicEntries.length === 1 && topicEntries[0][0] === subjectLabel;
                        return renderGroupNode(`course:${category}:${subjectLabel}`, subjectLabel, subjectLeaves, (
                          collapseTopic
                            ? subjectLeaves.map(renderLeaf)
                            : topicEntries.map(([topicLabel, recs]) =>
                                renderGroupNode(`course:${category}:${subjectLabel}:${topicLabel}`, topicLabel, recs, recs.map(renderLeaf))
                              )
                        ));
                      })
                    ));
                  })}
                </div>
              </div>
            )}

            {allPlatformRecordings.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Platform Recordings</h4>
                <div className="space-y-2">
                  {Object.entries(platformTree).map(([platformCategory, recs]) =>
                    renderGroupNode(`platform:${platformCategory}`, platformCategory, recs, recs.map(renderLeaf))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-3 border-t border-gray-700 bg-gray-900/50 flex items-center justify-between text-sm">
        <span className="text-gray-400">
          Assigned Recordings: <span className="text-white font-bold">{totalSelected}</span>
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Recordings'}
        </button>
      </div>
      <SuccessToast show={!!toast} title={toast?.title} message={toast?.message} onClose={() => setToast(null)} />
    </div>
  );
};

export default RecordingAssignmentTree;
