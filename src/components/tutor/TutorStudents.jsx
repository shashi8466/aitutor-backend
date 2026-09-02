import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { tutorService } from '../../services/api';
import { useLocation, Link } from 'react-router-dom';
import RecentCompletedTestsPanel from '../analytics/RecentCompletedTestsPanel';

const { FiUsers, FiSearch, FiFilter, FiMail, FiBarChart2, FiCalendar, FiBook, FiArrowDown, FiArrowUp, FiChevronDown, FiCheck } = FiIcons;

// Status thresholds, based on the student's most recent MEANINGFUL activity
// (test start/submit/completion - never just a login). A student with no such
// activity ever recorded (last_activity === null) is treated as Needs Attention,
// not Active - enrolling isn't the same as engaging.
const ACTIVE_MAX_DAYS = 15;      // 0-15 days since last activity
const INACTIVE_MAX_DAYS = 30;    // 16-30 days since last activity
// 31+ days, or never active at all -> Needs Attention

const daysSince = (dateStr) => {
    if (!dateStr) return Infinity;
    return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
};

const getStudentStatus = (student) => {
    const age = daysSince(student.last_activity);
    if (age <= ACTIVE_MAX_DAYS) return 'active';
    if (age <= INACTIVE_MAX_DAYS) return 'inactive';
    return 'attention';
};

const STATUS_META = {
    active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    inactive: { label: 'Inactive', dot: 'bg-gray-400', text: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700/40' },
    attention: { label: 'Needs Attention', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' }
};

const STATUS_TABS = [
    { id: 'all', label: 'All Students' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'attention', label: 'Needs Attention' }
];

const SORT_OPTIONS = [
    { id: 'last_activity', label: 'Last Activity' },
    { id: 'progress', label: 'Progress' },
    { id: 'tests', label: 'Tests Attempted' },
    { id: 'name', label: 'Name' }
];

// Small self-contained dark-theme dropdown - a native <select>'s open panel can't be reliably
// restyled cross-browser (it always falls back to the OS/browser's native white list, which is
// why the previous version looked inconsistent with the rest of the dark Tutor Panel).
const Dropdown = ({ icon, value, options, onChange, renderLabel }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const selected = options.find(o => o.id === value);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm text-sm font-bold text-gray-700 dark:text-gray-300 min-w-[160px] justify-between"
            >
                <span className="flex items-center gap-2 truncate">
                    <SafeIcon icon={icon} className="text-gray-400 w-4 h-4 shrink-0" />
                    <span className="truncate">{renderLabel ? renderLabel(selected) : selected?.label}</span>
                </span>
                <SafeIcon icon={FiChevronDown} className={`text-gray-400 w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-20 mt-2 w-full min-w-[200px] max-h-72 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => { onChange(opt.id); setOpen(false); }}
                            className={`w-full flex items-center justify-between gap-2 text-left px-4 py-2.5 text-sm font-medium truncate transition-colors ${
                                opt.id === value
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <span className="truncate">{opt.label}</span>
                            {opt.id === value && <SafeIcon icon={FiCheck} className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const TutorStudents = ({ dashboardData, isParentLoading }) => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialCourseFilter = queryParams.get('courseId') || '';

    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState(dashboardData?.courses || []);
    const [loading, setLoading] = useState(true);
    const [courseFilter, setCourseFilter] = useState(initialCourseFilter);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('last_activity');
    const [sortDir, setSortDir] = useState('desc');
    // Only one student's Recent Completed Tests panel expanded at a time; clicking the same
    // student again collapses it.
    const [expandedStudentId, setExpandedStudentId] = useState(null);

    useEffect(() => {
        if (dashboardData?.courses) {
            setCourses(dashboardData.courses);
        }
    }, [dashboardData]);

    useEffect(() => {
        // Fetch this page's own data immediately - never wait on the unrelated top-level
        // dashboard-stats call. loadData() already falls back to fetching courses itself when
        // dashboardData.courses isn't available yet, so nothing here depends on parent timing.
        loadData();
    }, [courseFilter]);

    const loadData = async () => {
        setLoading(true);
        const timeoutId = setTimeout(() => {
            if (loading) setLoading(false);
        }, 10000);

        try {
            // We only need students now, as courses come from parent or dashboardRes fallback
            const fetchers = [tutorService.getStudents(courseFilter || null)];

            // If we don't have courses yet, fetch them as fallback
            if (!dashboardData?.courses) {
                fetchers.push(tutorService.getDashboard());
            }

            const results = await Promise.all(fetchers);
            const studentsRes = results[0];
            setStudents(studentsRes.data.students || []);

            if (results[1]) {
                setCourses(results[1].data.courses || []);
            }
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    const courseOptions = useMemo(() => [
        { id: '', label: 'All Courses' },
        ...courses.map(c => ({ id: String(c.id), label: c.name }))
    ], [courses]);

    const sortOptions = useMemo(() => SORT_OPTIONS.map(o => ({ ...o, label: `Sort: ${o.label}` })), []);

    const filteredStudents = useMemo(() => {
        let list = students.filter(s =>
            s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (statusFilter !== 'all') {
            list = list.filter(s => getStudentStatus(s) === statusFilter);
        }

        const sorted = [...list];
        const dirMul = sortDir === 'asc' ? -1 : 1;
        if (sortBy === 'progress') {
            sorted.sort((a, b) => dirMul * ((b.overall_progress || 0) - (a.overall_progress || 0)));
        } else if (sortBy === 'tests') {
            sorted.sort((a, b) => dirMul * ((b.tests_attempted || 0) - (a.tests_attempted || 0)));
        } else if (sortBy === 'name') {
            sorted.sort((a, b) => -dirMul * (a.name || '').localeCompare(b.name || ''));
        } else {
            sorted.sort((a, b) => dirMul * (new Date(b.last_activity || 0) - new Date(a.last_activity || 0)));
        }
        return sorted;
    }, [students, searchQuery, statusFilter, sortBy, sortDir]);

    if (loading && students.length === 0) return <div className="p-8 text-center text-blue-600 font-bold animate-pulse">Loading students...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Student Roster</h2>
                    <p className="text-gray-500 dark:text-gray-400">View and track student performance across your courses</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Find student..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-sm text-gray-700 dark:text-gray-300"
                        />
                    </div>

                    <Dropdown
                        icon={FiFilter}
                        value={courseFilter}
                        options={courseOptions}
                        onChange={setCourseFilter}
                    />

                    <div className="flex items-center gap-1.5">
                        <Dropdown
                            icon={sortDir === 'asc' ? FiArrowUp : FiArrowDown}
                            value={sortBy}
                            options={sortOptions}
                            onChange={setSortBy}
                        />
                        <button
                            type="button"
                            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                            className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                            <SafeIcon icon={sortDir === 'asc' ? FiArrowUp : FiArrowDown} className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                            statusFilter === tab.id
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Student</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Courses</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Tests</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Progress</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Last Active</th>
                                <th className="sticky right-0 z-10 px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center bg-gray-50 dark:bg-gray-900/50 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                        {searchQuery || courseFilter || statusFilter !== 'all' ? 'No students match your filters.' : 'No students found.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map(student => {
                                    const status = getStudentStatus(student);
                                    const meta = STATUS_META[status];
                                    const isExpanded = expandedStudentId === student.id;
                                    return (
                                    <React.Fragment key={student.id}>
                                    <tr
                                        onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors group cursor-pointer ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <SafeIcon icon={isExpanded ? FiIcons.FiChevronUp : FiChevronDown} className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-black text-sm uppercase">
                                                    {student.name?.charAt(0) || 'S'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{student.name}</p>
                                                    <p className="text-xs text-gray-500">{student.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                <SafeIcon icon={FiBook} className="text-gray-400" />
                                                {student.courses_count}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {student.tests_attempted}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden min-w-[60px]">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full"
                                                        style={{ width: `${Math.min(student.overall_progress || 0, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                    {student.overall_progress || 0}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${meta.bg} ${meta.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                                {meta.label}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <SafeIcon icon={FiCalendar} className="text-gray-400" />
                                                {student.last_activity ? new Date(student.last_activity).toLocaleDateString() : 'Never'}
                                            </div>
                                        </td>
                                        <td
                                            className={`sticky right-0 z-10 px-6 py-4 text-center shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)] group-hover:bg-gray-50 dark:group-hover:bg-gray-900/30 ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800'}`}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => window.location.href = `mailto:${student.email}`}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                    title="Send Email"
                                                >
                                                    <SafeIcon icon={FiMail} />
                                                </button>
                                                <Link
                                                    to={`/tutor/students/${student.id}`}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                                    title="View Student Profile"
                                                >
                                                    <SafeIcon icon={FiBarChart2} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                            >
                                                <td colSpan="7" className="px-6 pb-5 pt-0 bg-gray-50/50 dark:bg-gray-900/20">
                                                    <RecentCompletedTestsPanel
                                                        fetchTests={() => tutorService.getStudentRecentTests(student.id)}
                                                        basePath="/tutor"
                                                        title="Recent Completed Tests"
                                                        emptyMessage="No completed tests yet."
                                                    />
                                                </td>
                                            </motion.tr>
                                        )}
                                    </AnimatePresence>
                                    </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TutorStudents;
