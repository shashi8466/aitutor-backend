import React, { useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import PdfExportWrapper from './PdfExportWrapper';
import { tutorService, adminService, courseService } from '../../services/api';
import { buildGroupContentTree } from '../../utils/groupContentTree';

const { FiUsers, FiTarget, FiTrendingUp, FiActivity, FiChevronRight, FiClock, FiBookOpen } = FiIcons;

const GroupLevelView = ({ groupId, adminMode, onStudentSelect, onTestHistorySelect, onContentSectionSelect }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [contentTree, setContentTree] = useState(null);

    const service = adminMode ? adminService : tutorService;

    useEffect(() => {
        loadData();
    }, [groupId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await service.getGroupDashboard(groupId);
            setData(res.data);

            // Additive: builds the content drill-down tree from the group's own assigned
            // content - failure here shouldn't break the existing dashboard, so it's isolated.
            try {
                const coursesRes = await courseService.getAll();
                setContentTree(buildGroupContentTree(res.data?.assignedContent, coursesRes.data || []));
            } catch (treeErr) {
                console.warn('Error building group content tree', treeErr);
            }
        } catch (err) {
            console.error('Error loading group dashboard', err);
            setError('Failed to load group analytics');
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

    const { overview = {}, students = [] } = data || {};

    const math = overview.math || {
        averageScore: 500,
        highestScore: 500,
        lowestScore: 500,
        accuracy: 0,
        testsCompleted: 0,
        questionsAttempted: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        studyTime: 0
    };

    const readingWriting = overview.readingWriting || {
        averageScore: 500,
        highestScore: 500,
        lowestScore: 500,
        accuracy: 0,
        testsCompleted: 0,
        questionsAttempted: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        studyTime: 0
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Area */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                        {overview.groupName || 'Group'} <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Group Dashboard</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Select a student to view their detailed performance.</p>
                </div>
                <div className="flex items-center gap-3">
                    <PdfExportWrapper 
                        type="Group" 
                        data={data} 
                        groupName={overview.groupName || 'Group'}
                        filename={`${(overview.groupName || 'Group').replace(/\s+/g, '_')}_Analytics`}
                        buttonText="Download Group PDF"
                    />
                </div>
            </div>

            {/* Overview Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Students</p>
                    <p className="text-2xl font-black mt-1 text-white">{overview.totalStudents || 0}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-emerald-400">Active Students</p>
                    <p className="text-2xl font-black mt-1 text-emerald-400">{overview.activeStudents || 0}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-blue-400">Completed Tests</p>
                    <p className="text-2xl font-black mt-1 text-blue-400">{overview.totalTestsCompleted || 0}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Questions</p>
                    <p className="text-2xl font-black mt-1 text-white">{overview.totalQuestionsAttempted || 0}</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-indigo-400">Avg Accuracy</p>
                    <p className="text-2xl font-black mt-1 text-indigo-400">{overview.overallAccuracy || 0}%</p>
                </div>
                <div className="bg-[#111625] p-4 rounded-xl border border-slate-800 text-white">
                    <p className="text-[10px] font-black uppercase text-amber-400">Avg SAT Score</p>
                    <p className="text-2xl font-black mt-1 text-amber-400">{overview.averageSatScore || 1000} <span className="text-xs text-slate-400">/ 1600</span></p>
                </div>
            </div>

            {/* GROUP SAT TOP 10 LEADERBOARD CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. SAT MATH — TOP 10 */}
                <div className="p-6 bg-[#0a0e24] rounded-2xl border-2 border-blue-500/40 text-white shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="px-3 py-1 bg-blue-600/30 text-blue-300 font-black text-xs uppercase tracking-wider rounded-lg border border-blue-500/40">
                                SAT MATH — TOP 10
                            </span>
                            <span className="text-xs font-bold text-slate-400">Max 800</span>
                        </div>

                        {(!overview.topMathStudents || overview.topMathStudents.length === 0) ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No completed Math attempts yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="text-[10px] text-slate-400 uppercase font-black border-b border-slate-800 pb-2">
                                            <th className="py-2">Rank</th>
                                            <th className="py-2">Student</th>
                                            <th className="py-2 text-right">Best Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {overview.topMathStudents.map((st, idx) => (
                                            <tr key={st.id || idx} className="hover:bg-slate-900/50 cursor-pointer" onClick={() => onStudentSelect(st)}>
                                                <td className="py-2 font-black text-blue-400">#{idx + 1}</td>
                                                <td className="py-2 font-bold text-white truncate max-w-[120px]">{st.name}</td>
                                                <td className="py-2 font-black text-emerald-400 text-right">{st.math} <span className="text-[10px] text-slate-400">/ 800</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. SAT READING & WRITING — TOP 10 */}
                <div className="p-6 bg-[#0a0e24] rounded-2xl border-2 border-purple-500/40 text-white shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="px-3 py-1 bg-purple-600/30 text-purple-300 font-black text-xs uppercase tracking-wider rounded-lg border border-purple-500/40">
                                SAT READING & WRITING — TOP 10
                            </span>
                            <span className="text-xs font-bold text-slate-400">Max 800</span>
                        </div>

                        {(!overview.topRwStudents || overview.topRwStudents.length === 0) ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No completed R&W attempts yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="text-[10px] text-slate-400 uppercase font-black border-b border-slate-800 pb-2">
                                            <th className="py-2">Rank</th>
                                            <th className="py-2">Student</th>
                                            <th className="py-2 text-right">Best Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {overview.topRwStudents.map((st, idx) => (
                                            <tr key={st.id || idx} className="hover:bg-slate-900/50 cursor-pointer" onClick={() => onStudentSelect(st)}>
                                                <td className="py-2 font-black text-purple-400">#{idx + 1}</td>
                                                <td className="py-2 font-bold text-white truncate max-w-[120px]">{st.name}</td>
                                                <td className="py-2 font-black text-emerald-400 text-right">{st.readingWriting} <span className="text-[10px] text-slate-400">/ 800</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. OVERALL SAT — TOP 10 */}
                <div className="p-6 bg-[#0a0e24] rounded-2xl border-2 border-amber-500/40 text-white shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="px-3 py-1 bg-amber-600/30 text-amber-300 font-black text-xs uppercase tracking-wider rounded-lg border border-amber-500/40">
                                OVERALL SAT — TOP 10
                            </span>
                            <span className="text-xs font-bold text-slate-400">Max 1600</span>
                        </div>

                        {(!overview.topOverallStudents || overview.topOverallStudents.length === 0) ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No completed SAT attempts yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="text-[10px] text-slate-400 uppercase font-black border-b border-slate-800 pb-2">
                                            <th className="py-2">Rank</th>
                                            <th className="py-2">Student</th>
                                            <th className="py-2 text-right">SAT Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {overview.topOverallStudents.map((st, idx) => (
                                            <tr key={st.id || idx} className="hover:bg-slate-900/50 cursor-pointer" onClick={() => onStudentSelect(st)}>
                                                <td className="py-2 font-black text-amber-400">#{idx + 1}</td>
                                                <td className="py-2 font-bold text-white truncate max-w-[120px]">{st.name}</td>
                                                <td className="py-2 font-black text-yellow-400 text-right">{st.satScore} <span className="text-[10px] text-slate-400">/ 1600</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Analytics (Section -> Topic -> Subtopic drill-down) */}
            {contentTree && Object.keys(contentTree).length > 0 && (
                <div>
                    <h3 className="text-lg font-black mb-4 text-white">Content Analytics — Select Section</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.values(contentTree).map(section => (
                            <div
                                key={section.name}
                                onClick={() => onContentSectionSelect(section)}
                                className="bg-[#0a0e24] p-5 rounded-2xl border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                                        <SafeIcon icon={FiBookOpen} className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-white text-base group-hover:text-blue-400 transition-colors">{section.name}</h4>
                                        <p className="text-xs text-slate-400">{Object.keys(section.topics).length} topics assigned</p>
                                    </div>
                                </div>
                                <SafeIcon icon={FiChevronRight} className="text-slate-500 group-hover:text-blue-400 transition-colors w-5 h-5" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Student Performance Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Student Performance Table</h3>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full">
                        {students.length} Total Students
                    </span>
                </div>

                {students.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No students enrolled in this group.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase font-black tracking-wider border-b border-gray-200 dark:border-gray-700">
                                    <th className="p-4">Student</th>
                                    <th className="p-4 text-center">Accuracy</th>
                                    <th className="p-4 text-center">Tests</th>
                                    <th className="p-4 text-center">Progress</th>
                                    <th className="p-4 text-center">Study Time</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 text-xs font-bold">
                                {students.map((student) => (
                                    <tr 
                                        key={student.id} 
                                        onClick={() => onStudentSelect(student)}
                                        className="hover:bg-blue-600/10 cursor-pointer transition-all group"
                                    >
                                        <td className="p-4">
                                            <p className="font-black text-white group-hover:text-blue-400 text-sm">{student.name}</p>
                                            <p className="text-[11px] text-slate-400 font-normal">{student.email}</p>
                                        </td>
                                        <td className="p-4 text-center text-blue-400 font-black">{student.math}</td>
                                        <td className="p-4 text-center text-purple-400 font-black">{student.readingWriting}</td>
                                        <td className="p-4 text-center font-black text-amber-400 text-sm">{student.satScore}</td>
                                        <td className="p-4 text-center font-black text-emerald-400">{student.accuracy}</td>
                                        <td className="p-4 text-center text-white">{student.tests}</td>
                                        <td className="p-4 text-center">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                {student.progress}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-slate-300">{student.studyTime}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button className="text-blue-400 font-black text-xs inline-flex items-center gap-1 hover:underline cursor-pointer">
                                                    Analytics <SafeIcon icon={FiChevronRight} className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Same student Test History & Review component the student uses for
                                                        // their own history - kept in-memory (not a route navigate) so its
                                                        // Back button can return here instead of leaving Student Groups.
                                                        onTestHistorySelect(student);
                                                    }}
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
        </div>
    );
};

export default GroupLevelView;
