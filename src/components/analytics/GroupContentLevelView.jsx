import React, { useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import PdfExportWrapper from './PdfExportWrapper';
import { tutorService, adminService } from '../../services/api';

const { FiArrowLeft, FiChevronRight, FiUsers, FiTarget, FiAward, FiActivity, FiCheckCircle, FiClock } = FiIcons;

/**
 * One reusable view for the Group's content drill-down (Section -> Topic -> Subtopic).
 * Same "Analytics Resolver" call (getGroupContentAnalytics) at every level - only the
 * courseIds scope changes - so Overview/Top 10/Student Performance can never disagree with
 * each other or with the per-student combined report they're built from.
 *
 * `childItems` present (non-empty array) -> renders a clickable list of the next level down
 * (Section shows Topics, Topic shows Subtopics). `childItems` null -> this IS the leaf
 * (Subtopic) level, so it renders the Student Performance Table with Analytics/Test History
 * actions instead.
 */
const GroupContentLevelView = ({
    groupId,
    groupName,
    adminMode,
    title,
    subtitle,
    badge,
    courseIds,
    childItems,
    onChildSelect,
    onBack,
    onStudentAnalytics,
    onStudentTestHistory
}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const service = adminMode ? adminService : tutorService;

    useEffect(() => {
        loadData();
    }, [groupId, JSON.stringify(courseIds)]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await service.getGroupContentAnalytics(groupId, courseIds);
            setData(res.data);
        } catch (err) {
            console.error('Error loading group content analytics', err);
            setError('Failed to load content analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );
    if (error) return <div className="text-red-500 font-bold p-4">{error}</div>;
    if (!data) return null;

    const { overview, top10, students } = data;
    const isLeaf = !childItems;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                        <SafeIcon icon={FiArrowLeft} className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                            {title} {badge && <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{badge}</span>}
                        </h2>
                        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <PdfExportWrapper
                        type="GroupContent"
                        data={{ title, subtitle, overview, top10, students }}
                        groupName={groupName}
                        filename={`${(title || 'Content').replace(/\s+/g, '_')}_Analytics`}
                        buttonText="Download PDF"
                    />
                </div>
            </div>

            {/* Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-slate-400">Students Assigned</p>
                    <p className="text-2xl font-black mt-1 text-white">{overview.studentsAssigned}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-blue-400">Attempted</p>
                    <p className="text-2xl font-black mt-1 text-blue-400">{overview.studentsAttempted}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-emerald-400">Completed</p>
                    <p className="text-2xl font-black mt-1 text-emerald-400">{overview.studentsCompleted}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-amber-400">Not Attempted</p>
                    <p className="text-2xl font-black mt-1 text-amber-400">{overview.studentsNotAttempted}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-indigo-400">Completion Rate</p>
                    <p className="text-2xl font-black mt-1 text-indigo-400">{overview.completionRate}%</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-slate-400">Average Score</p>
                    <p className="text-2xl font-black mt-1 text-white">{overview.averageScore != null ? `${overview.averageScore} / 800` : '--'}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-yellow-400">Highest Score</p>
                    <p className="text-2xl font-black mt-1 text-yellow-400">{overview.highestScore != null ? `${overview.highestScore} / 800` : '--'}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-purple-400">Average Accuracy</p>
                    <p className="text-2xl font-black mt-1 text-purple-400">{overview.averageAccuracy != null ? `${overview.averageAccuracy}%` : '--'}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Attempts</p>
                    <p className="text-2xl font-black mt-1 text-white">{overview.totalAttempts}</p>
                </div>
            </div>

            {/* Top 10 */}
            <div className="p-6 bg-[#0a0e24] rounded-2xl border-2 border-blue-500/40 text-white shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <span className="px-3 py-1 bg-blue-600/30 text-blue-300 font-black text-xs uppercase tracking-wider rounded-lg border border-blue-500/40">
                        {title} — Top 10
                    </span>
                    <span className="text-xs font-bold text-slate-400">Max 800</span>
                </div>
                {top10.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No completed attempts yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="text-[10px] text-slate-400 uppercase font-black border-b border-slate-800">
                                    <th className="py-2">Rank</th>
                                    <th className="py-2">Student</th>
                                    <th className="py-2 text-right">Best Score</th>
                                    <th className="py-2 text-right">Accuracy</th>
                                    <th className="py-2 text-right">Attempts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {top10.map((s, idx) => (
                                    <tr key={s.id} className="hover:bg-slate-900/50">
                                        <td className="py-2 font-black text-blue-400">#{idx + 1}</td>
                                        <td className="py-2 font-bold text-white">{s.name}</td>
                                        <td className="py-2 font-black text-emerald-400 text-right">{s.bestScore} <span className="text-[10px] text-slate-400">/ 800</span></td>
                                        <td className="py-2 text-right text-slate-300">{s.avgAccuracy != null ? `${s.avgAccuracy}%` : '--'}</td>
                                        <td className="py-2 text-right text-slate-300">{s.attempts}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isLeaf ? (
                /* Student Performance Table (leaf / Subtopic level) */
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Student Performance</h3>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full">
                            {students.length} Students
                        </span>
                    </div>
                    {students.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No students in this group.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase font-black tracking-wider border-b border-gray-200 dark:border-gray-700">
                                        <th className="p-4">Student</th>
                                        <th className="p-4 text-center">Best Score</th>
                                        <th className="p-4 text-center">Accuracy</th>
                                        <th className="p-4 text-center">Attempts</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 text-xs font-bold">
                                    {students.map(s => (
                                        <tr key={s.id} className="hover:bg-blue-600/10 transition-all">
                                            <td className="p-4">
                                                <p className="font-black text-white text-sm">{s.name}</p>
                                                <p className="text-[11px] text-slate-400 font-normal">{s.email}</p>
                                            </td>
                                            <td className="p-4 text-center font-black text-amber-400">
                                                {s.bestScore != null ? `${s.bestScore} / 800` : '--'}
                                            </td>
                                            <td className="p-4 text-center text-emerald-400">
                                                {s.avgAccuracy != null ? `${s.avgAccuracy}%` : '--'}
                                            </td>
                                            <td className="p-4 text-center text-white">{s.attempts}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                                                    s.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                                    s.status === 'In Progress' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                                    'bg-slate-700/40 text-slate-300 border-slate-600/40'
                                                }`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button
                                                        onClick={() => onStudentAnalytics(s)}
                                                        className="text-blue-400 font-black text-xs inline-flex items-center gap-1 hover:underline cursor-pointer"
                                                    >
                                                        Analytics <SafeIcon icon={FiChevronRight} className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => onStudentTestHistory(s)}
                                                        className="text-purple-400 font-black text-xs inline-flex items-center gap-1 hover:underline cursor-pointer"
                                                    >
                                                        Test History <SafeIcon icon={FiClock} className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* Children list (Section shows Topics, Topic shows Subtopics) */
                <div>
                    <h3 className="text-lg font-black mb-4 text-white">Select {childItems.levelLabel || 'Content'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {childItems.items.map(child => (
                            <div
                                key={child.key}
                                onClick={() => onChildSelect(child)}
                                className="bg-[#0a0e24] p-5 rounded-2xl border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                                        <SafeIcon icon={FiTarget} className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-white text-sm group-hover:text-blue-400 transition-colors">{child.label}</h4>
                                        <p className="text-[11px] text-slate-400">{child.courseIds.length} test{child.courseIds.length === 1 ? '' : 's'}</p>
                                    </div>
                                </div>
                                <SafeIcon icon={FiChevronRight} className="text-slate-500 group-hover:text-blue-400 transition-colors w-5 h-5 shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupContentLevelView;
