import React, { useState, useEffect, useMemo } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { recordingService } from '../../services/api';

const { FiSearch, FiVideo } = FiIcons;

const CATEGORY_LABEL = { sat: 'SAT', act: 'ACT', ap: 'AP', full_length_test: 'Full-Length Test' };

// A recording's course/category/platform-category label, for the picker row's secondary line -
// so an admin/tutor searching a long flat list can tell "Trigonometry — Tutorial Class" (SAT Math)
// apart from a same-named recording under a different subject.
const recordingSubLabel = (r) => {
  if (r.recording_type === 'platform') return `Platform — ${r.platform_category || 'Other'}`;
  if (r.category === 'full_length_test') return r.course?.name || CATEGORY_LABEL.full_length_test;
  return r.course?.name ? `${CATEGORY_LABEL[r.category] || r.category} — ${r.course.name}` : (CATEGORY_LABEL[r.category] || r.category);
};

/**
 * Searchable checkbox list of every Published recording, for assigning recordings to a Student
 * Group (PRD "Assign Recordings" section) - deliberately a flat list, not the taxonomy tree
 * HierarchicalContentSelector uses for courses, matching the PRD's own mockup.
 *
 * Controlled component: `selectedIds` is the group's current assigned_recording_ids, `onChange`
 * receives the full next array whenever a checkbox is toggled.
 */
const RecordingAssignmentPicker = ({ selectedIds = [], onChange }) => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await recordingService.getAssignable();
        if (!cancelled) setRecordings(data?.data || []);
      } catch (err) {
        console.error('Failed to load assignable recordings:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return recordings;
    return recordings.filter((r) =>
      (r.title || '').toLowerCase().includes(term) ||
      (r.platform_category || '').toLowerCase().includes(term) ||
      (r.course?.name || '').toLowerCase().includes(term)
    );
  }, [recordings, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id) => {
    const next = selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    onChange(next);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="relative">
          <SafeIcon icon={FiSearch} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recordings..."
            className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">Loading recordings...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">No published recordings found.</div>
        ) : (
          filtered.map((r) => (
            <label key={r.id} className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={selectedSet.has(r.id)} onChange={() => toggle(r.id)} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white truncate">
                  <SafeIcon icon={FiVideo} className="w-3 h-3 text-red-500 shrink-0" /> {r.title}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{recordingSubLabel(r)}</span>
              </span>
            </label>
          ))
        )}
      </div>
      {selectedIds.length > 0 && (
        <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          {selectedIds.length} recording{selectedIds.length === 1 ? '' : 's'} assigned
        </div>
      )}
    </div>
  );
};

export default RecordingAssignmentPicker;
