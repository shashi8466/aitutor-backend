import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { supportIssueService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import Toast from '../common/Toast';

const { FiFlag, FiSearch, FiEye, FiX, FiCalendar, FiBook, FiSave, FiTrash2, FiPhone, FiMail } = FiIcons;

const TABS = [
  { key: '', label: 'All' },
  { key: 'question_report', label: 'Question Reports & Bugs' },
  { key: 'student_support', label: 'Student Support' },
  { key: 'tutor_support', label: 'Tutor Support' },
  { key: 'parent_support', label: 'Parent Support' },
  { key: 'chatbot_issue', label: 'Chatbot Issues' },
  { key: 'contact_us', label: 'Contact Us & General Inquiries' }
];

const ISSUE_TYPE_LABELS = TABS.reduce((acc, t) => (t.key ? { ...acc, [t.key]: t.label } : acc), {});

const STATUS_OPTIONS = ['pending', 'in_progress', 'resolved', 'closed'];

const STATUS_STYLES = {
  pending: 'text-red-600 bg-red-50 border-red-100',
  in_progress: 'text-amber-600 bg-amber-50 border-amber-100',
  resolved: 'text-green-600 bg-green-50 border-green-100',
  closed: 'text-slate-500 bg-slate-100 border-slate-200'
};

const formatStatus = (s) => s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const IssuesAndSupport = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusDraft, setStatusDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [rowUpdatingId, setRowUpdatingId] = useState(null);

  useEffect(() => {
    loadIssues();
  }, [activeTab, statusFilter]);

  const loadIssues = async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeTab) params.issue_type = activeTab;
      if (statusFilter) params.status = statusFilter;
      const res = await supportIssueService.getAll(params);
      setIssues(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load issues:', err);
      setToast({ message: 'Could not load Issues & Support data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (item) => {
    setSelectedItem(item);
    setStatusDraft(item.status);
    setNotesDraft(item.admin_notes || '');
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    try {
      setSaving(true);
      const res = await supportIssueService.updateStatus(selectedItem.id, {
        status: statusDraft,
        admin_notes: notesDraft
      });
      const updated = res.data?.data;
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setToast({ message: 'Issue status updated successfully.', type: 'success' });
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to update issue:', err);
      setToast({ message: 'Could not save changes.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Inline status change directly from the table row - updates the DB,
  // reflects immediately in the table, and survives a refresh since it's
  // persisted server-side (not just local state).
  const handleInlineStatusChange = async (item, newStatus) => {
    if (newStatus === item.status) return;
    const previousStatus = item.status;
    // Optimistic update so the dropdown feels instant.
    setIssues((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)));
    setRowUpdatingId(item.id);
    try {
      const res = await supportIssueService.updateStatus(item.id, { status: newStatus });
      const updated = res.data?.data;
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setToast({ message: 'Issue status updated successfully.', type: 'success' });
    } catch (err) {
      console.error('Failed to update issue status:', err);
      // Revert the optimistic change on failure.
      setIssues((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: previousStatus } : i)));
      setToast({ message: 'Could not update status. Please try again.', type: 'error' });
    } finally {
      setRowUpdatingId(null);
    }
  };

  const handleDelete = async (item) => {
    try {
      setSaving(true);
      await supportIssueService.remove(item.id);
      setIssues((prev) => prev.filter((i) => i.id !== item.id));
      setToast({ message: 'Deleted.', type: 'success' });
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to delete issue:', err);
      setToast({ message: 'Could not delete this item.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = issues.filter((i) =>
    (i.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.subject || '').toLowerCase().includes(search.toLowerCase())
  );

  const relatedLabel = (item) => {
    if (item.related_question_id) return `Question #${item.related_question_id}${item.courses?.name ? ` · ${item.courses.name}` : ''}`;
    if (item.courses?.name) return item.courses.name;
    if (item.related_submission_id) return `Submission #${item.related_submission_id}`;
    return '—';
  };

  return (
    <div className="space-y-6">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <SafeIcon icon={FiFlag} className="text-[#E53935]" />
              Issues & Support
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Every report, help request, and inquiry from across the application, in one place.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] outline-none"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
            <div className="relative w-full md:w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, email, or subject..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key || 'all'}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                activeTab === tab.key
                  ? 'bg-[#E53935] text-white border-transparent'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-red-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner fullPage={false} />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                  <th className="px-6 py-4">Issue Type</th>
                  <th className="px-6 py-4">Submitted By</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Related</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-sky-600 bg-sky-50 border-sky-100">
                        {ISSUE_TYPE_LABELS[item.issue_type] || item.issue_type}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1 capitalize">{item.user_type}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-600 dark:text-slate-300">{item.email}</p>
                      {item.phone && <p className="text-[10px] text-slate-400">{item.phone}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-800 dark:text-slate-200 max-w-[220px] truncate">{item.subject || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{relatedLabel(item)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={item.status}
                        disabled={rowUpdatingId === item.id}
                        onChange={(e) => handleInlineStatusChange(item, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full border outline-none cursor-pointer disabled:opacity-50 disabled:cursor-wait ${STATUS_STYLES[item.status] || STATUS_STYLES.pending}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s} className="bg-white text-slate-800">{formatStatus(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openDetail(item)}
                        className="p-2 text-slate-400 hover:text-[#E53935] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-20 text-center">
                      <SafeIcon icon={FiFlag} className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">Nothing here yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 text-[#E53935] rounded-xl">
                    <FiFlag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                      {ISSUE_TYPE_LABELS[selectedItem.issue_type] || selectedItem.issue_type}
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{selectedItem.category}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 text-xl font-bold uppercase shadow-inner">
                    {selectedItem.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{selectedItem.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><FiMail className="w-3.5 h-3.5" /> {selectedItem.email}</span>
                      {selectedItem.phone && <span className="flex items-center gap-1"><FiPhone className="w-3.5 h-3.5" /> {selectedItem.phone}</span>}
                    </div>
                  </div>
                </div>

                {selectedItem.subject && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subject</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedItem.subject}</p>
                  </div>
                )}

                {selectedItem.related_question_id && (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <FiBook className="w-3 h-3" /> Question Snapshot
                    </p>
                    <div className="text-sm text-slate-800 dark:text-slate-200">
                      <MathRenderer text={selectedItem.questions?.question || 'Question content unavailable.'} courseId={selectedItem.related_course_id} />
                    </div>
                  </div>
                )}

                <div className="p-6 bg-red-50/50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20">
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">Description</p>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedItem.description || 'No additional details provided.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-tighter">
                  <FiCalendar className="w-3 h-3" />
                  Submitted on {new Date(selectedItem.created_at).toLocaleString()}
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#E53935]"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{formatStatus(s)}</option>
                    ))}
                  </select>

                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Notes</label>
                  <textarea
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Internal notes on how this was resolved..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#E53935] resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#E53935] text-white rounded-2xl font-bold hover:bg-black transition-colors disabled:opacity-50"
                  >
                    <FiSave className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedItem)}
                    disabled={saving}
                    className="px-5 flex items-center justify-center gap-2 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IssuesAndSupport;
