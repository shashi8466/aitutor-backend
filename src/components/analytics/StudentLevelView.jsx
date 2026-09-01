import React, { useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import PdfExportWrapper from './PdfExportWrapper';
import { tutorService, adminService, parentService } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const { FiArrowLeft, FiAward, FiBookOpen, FiClock, FiTarget, FiChevronRight, FiTrendingUp } = FiIcons;

// groupId is null/omitted in parentMode - the linked student has no Student Group to scope to;
// analyticsService.getStudentDashboard(null, studentId) is unscoped by design (see
// _getGroupScope), so this renders the student's full history instead of one group's slice.
const StudentLevelView = ({ groupId, student, adminMode, parentMode, onBack, onCourseSelect, onTopicReportSelect, onAttemptSelect }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const service = parentMode ? parentService : (adminMode ? adminService : tutorService);

    useEffect(() => {
        loadData();
    }, [student.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = parentMode
                ? await service.getStudentDashboard(student.id)
                : await service.getStudentDashboard(groupId, student.id);
            setData(res.data);
        } catch (err) {
            console.error('Error loading student dashboard', err);
            setError('Failed to load student analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
    );
    if (error) return <div className="text-red-500 font-bold p-4">{error}</div>;
    const { overview = {}, trend = [], assignedContent = {} } = data || {};

    const math = data?.math || {
        currentScore: null,
        bestScore: null,
        lowestScore: null,
        averageScore: null,
        scoreImprovement: '0',
        testsCompleted: 0,
        testsAssigned: 0,
        testsRemaining: 0,
        accuracy: 0,
        totalQuestions: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        totalStudyTime: 0,
        hasData: false
    };

    const readingWriting = data?.readingWriting || {
        currentScore: null,
        bestScore: null,
        lowestScore: null,
        averageScore: null,
        scoreImprovement: '0',
        testsCompleted: 0,
        testsAssigned: 0,
        testsRemaining: 0,
        accuracy: 0,
        totalQuestions: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        totalStudyTime: 0,
        hasData: false
    };

    const overall = data?.overall || {
        currentSatScore: null,
        bestSatScore: null,
        lowestSatScore: null,
        averageSatScore: null,
        scoreImprovement: '0',
        overallAccuracy: 0,
        totalTests: 0,
        completedTests: 0,
        totalQuestions: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        totalStudyTime: 0,
        trendStatus: 'Stable',
        hasData: false
    };

    // null when the student has no completed Full-Length Test yet within this group's assigned
    // content - kept entirely separate from the regular-course math/readingWriting/overall above.
    const fullLengthTest = data?.fullLengthTest || null;

    // Filter main categories out of assignedContent to list as courses
    const assignedCourses = Object.keys(assignedContent || {}).filter(c => c !== 'invite_token');

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                        <SafeIcon icon={FiArrowLeft} className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
                            {student.name} <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Student Report</span>
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">{student.email}</p>
                    </div>
                </div>
                <div>
                    <PdfExportWrapper
                        type="Student"
                        data={data}
                        studentName={student.name}
                        filename={`${student.name.replace(/\s+/g, '_')}_Report`}
                        buttonText="Download Student PDF"
                    />
                </div>
            </div>

            {/* STUDENT SAT PERFORMANCE SECTION CARDS */}
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Regular SAT Course Scores</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Reading & Writing Card */}
                <div
                    onClick={() => onCourseSelect('SAT Reading & Writing')}
                    className="p-4 bg-[#0a0e24] rounded-2xl border-2 border-purple-500/40 text-white shadow-xl hover:border-purple-400 cursor-pointer transition-all flex flex-col justify-between group"
                >
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="px-2.5 py-0.5 bg-purple-600/30 text-purple-300 font-black text-[10px] uppercase tracking-wider rounded-lg border border-purple-500/40">READING & WRITING</span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                {readingWriting.scoreImprovement} Impr.
                            </span>
                        </div>
                        <div className="text-2xl font-black text-purple-400 mb-1 group-hover:text-purple-300 transition-colors">
                            {readingWriting.hasData ? readingWriting.bestScore : '—'} <span className="text-xs font-bold text-slate-400">/ 800</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 mb-2">{readingWriting.hasData ? 'Best R&W Score' : 'No regular course completed'}</p>

                        <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-900/80 rounded-xl border border-slate-800 text-xs mb-2">
                            <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Average Score</span>
                                <span className="text-xs font-black text-white">{readingWriting.hasData ? readingWriting.averageScore : '—'}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Lowest</span>
                                <span className="text-xs font-black text-rose-400">{readingWriting.hasData ? readingWriting.lowestScore : '—'}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Accuracy</span>
                                <span className="text-xs font-black text-white">{readingWriting.accuracy}%</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Tests Done</span>
                                <span className="text-xs font-black text-white">{readingWriting.testsCompleted}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[10px] font-bold text-slate-400 flex justify-between items-center">
                        <span>Questions: {readingWriting.totalQuestions} (✓ {readingWriting.correct} | ✕ {readingWriting.incorrect})</span>
                        <span className="text-purple-400 font-black group-hover:underline">Explore →</span>
                    </div>
                </div>

                {/* Math Card */}
                <div
                    onClick={() => onCourseSelect('SAT Math')}
                    className="p-4 bg-[#0a0e24] rounded-2xl border-2 border-blue-500/40 text-white shadow-xl hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between group"
                >
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="px-2.5 py-0.5 bg-blue-600/30 text-blue-300 font-black text-[10px] uppercase tracking-wider rounded-lg border border-blue-500/40">SAT MATH</span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                {math.scoreImprovement} Impr.
                            </span>
                        </div>
                        <div className="text-2xl font-black text-blue-400 mb-1 group-hover:text-blue-300 transition-colors">
                            {math.hasData ? math.bestScore : '—'} <span className="text-xs font-bold text-slate-400">/ 800</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 mb-2">{math.hasData ? 'Best Math Score' : 'No regular course completed'}</p>

                        <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-900/80 rounded-xl border border-slate-800 text-xs mb-2">
                            <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Average Score</span>
                                <span className="text-xs font-black text-white">{math.hasData ? math.averageScore : '—'}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Lowest</span>
                                <span className="text-xs font-black text-rose-400">{math.hasData ? math.lowestScore : '—'}</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Accuracy</span>
                                <span className="text-xs font-black text-white">{math.accuracy}%</span>
                            </div>
                            <div>
                                <span className="text-[9px] text-slate-400 uppercase font-black block">Tests Done</span>
                                <span className="text-xs font-black text-white">{math.testsCompleted}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[10px] font-bold text-slate-400 flex justify-between items-center">
                        <span>Questions: {math.totalQuestions} (✓ {math.correct} | ✕ {math.incorrect})</span>
                        <span className="text-blue-400 font-black group-hover:underline">Explore →</span>
                    </div>
                </div>

                {/* Overall SAT Card */}
                <div className="p-4 bg-gradient-to-br from-[#0c1330] via-[#0f1738] to-[#070b1e] rounded-2xl border-2 border-amber-500/40 text-white shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="px-2.5 py-0.5 bg-amber-600/30 text-amber-300 font-black text-[10px] uppercase tracking-wider rounded-lg border border-amber-500/40">OVERALL SAT SCORE</span>
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                {overall.scoreImprovement} Total Impr.
                            </span>
                        </div>
                        <div className="text-3xl font-black text-amber-400 mb-1">{overall.hasData ? overall.bestSatScore : '—'} <span className="text-xs font-bold text-slate-400">/ 1600</span></div>
                        <p className="text-[11px] font-bold text-slate-300 mb-2">{overall.hasData ? 'Best Overall SAT Score' : 'No regular course completed'}</p>

                        <div className="space-y-1.5 p-2 bg-slate-900/90 rounded-xl border border-slate-800 text-xs mb-2">
                            <div className="flex justify-between">
                                <span className="text-slate-400 font-bold">Average SAT Score:</span>
                                <span className="font-black text-emerald-400">{overall.hasData ? overall.averageSatScore : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400 font-bold">Overall Accuracy:</span>
                                <span className="font-black text-blue-400">{overall.overallAccuracy}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400 font-bold">Tests Completed:</span>
                                <span className="font-black text-white">{overall.completedTests}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[10px] font-bold text-slate-400 flex justify-between">
                        <span>Total Questions: {overall.totalQuestions}</span>
                        <span>Trend: <strong className="text-emerald-400">{overall.trendStatus}</strong></span>
                    </div>
                </div>
            </div>

            {/* FULL-LENGTH TEST SCORES - kept entirely separate from the regular-course cards
                above; sourced only from the student's completed Full-Length Test attempts, never
                mixed with regular course/topic scores. */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Full-Length Test Scores</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Reading & Writing (Full-Length) */}
                    <div className="p-4 bg-[#0a0e24] rounded-2xl border-2 border-purple-500/40 text-white shadow-xl flex flex-col justify-between">
                        <div>
                            <span className="px-2.5 py-0.5 bg-purple-600/30 text-purple-300 font-black text-[10px] uppercase tracking-wider rounded-lg border border-purple-500/40">READING & WRITING</span>
                            <div className="text-2xl font-black text-purple-400 mt-2 mb-1">
                                {fullLengthTest ? fullLengthTest.rwScore : '--'} <span className="text-xs font-bold text-slate-400">/ 800</span>
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-800 mt-2">
                            {fullLengthTest ? `From ${fullLengthTest.testName}` : 'No completed Full-Length Test yet'}
                        </p>
                    </div>

                    {/* Math (Full-Length) */}
                    <div className="p-4 bg-[#0a0e24] rounded-2xl border-2 border-blue-500/40 text-white shadow-xl flex flex-col justify-between">
                        <div>
                            <span className="px-2.5 py-0.5 bg-blue-600/30 text-blue-300 font-black text-[10px] uppercase tracking-wider rounded-lg border border-blue-500/40">MATH</span>
                            <div className="text-2xl font-black text-blue-400 mt-2 mb-1">
                                {fullLengthTest ? fullLengthTest.mathScore : '--'} <span className="text-xs font-bold text-slate-400">/ 800</span>
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-800 mt-2">
                            {fullLengthTest ? `From ${fullLengthTest.testName}` : 'No completed Full-Length Test yet'}
                        </p>
                    </div>

                    {/* Overall SAT Score (Full-Length) */}
                    <div className="p-4 bg-gradient-to-br from-[#0c1330] via-[#0f1738] to-[#070b1e] rounded-2xl border-2 border-amber-500/40 text-white shadow-xl flex flex-col justify-between">
                        <div>
                            <span className="px-2.5 py-0.5 bg-amber-600/30 text-amber-300 font-black text-[10px] uppercase tracking-wider rounded-lg border border-amber-500/40">OVERALL SAT SCORE</span>
                            <div className="text-3xl font-black text-amber-400 mt-2 mb-1">
                                {fullLengthTest ? fullLengthTest.overallScore : '--'} <span className="text-xs font-bold text-slate-400">/ 1600</span>
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-slate-300 pt-2 border-t border-slate-800 mt-2">
                            {fullLengthTest
                                ? `Best of completed Full-Length Tests - ${new Date(fullLengthTest.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                : 'No completed Full-Length Test yet'}
                        </p>
                    </div>
                </div>
            </div>

            {/* SAT SCORE PROGRESSION CHART */}
            <div className="bg-[#0a0e24] p-4 rounded-2xl border border-slate-800 shadow-xl text-white">
                <div className="flex justify-between items-center mb-3">
                    <div>
                        <h3 className="text-sm font-black flex items-center gap-2">
                            <SafeIcon icon={FiTrendingUp} className="text-blue-400" /> SAT Score Progression
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Historical scaled score changes over practice attempts</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${overall.trendStatus === 'Improving' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                        Status: {overall.trendStatus}
                    </span>
                </div>

                {trend.length < 1 ? (
                    <div className="h-48 flex items-center justify-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800 text-xs">
                        No test submissions completed yet for this student.
                    </div>
                ) : (
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trend} margin={{ top: 10, right: 30, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} domain={[400, 1600]} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#fff' }}
                                    labelStyle={{ fontWeight: 'bold', color: '#94a3b8' }}
                                />
                                <Line type="monotone" dataKey="satScore" name="SAT Total (/ 1600)" stroke="#f59e0b" strokeWidth={4} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                                <Line type="monotone" dataKey="mathScore" name="Math (/ 800)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="rwScore" name="R&W (/ 800)" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* SAT SECTIONS DRILL-DOWN */}
            <div>
                <h3 className="text-sm font-black mb-3 text-white">Select Section to View Topics & Tests</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                        onClick={() => onCourseSelect('SAT Math')}
                        className="bg-[#0a0e24] p-3.5 rounded-2xl border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                                <SafeIcon icon={FiBookOpen} className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-black text-white text-sm group-hover:text-blue-400 transition-colors">SAT Math Topics</h4>
                                <p className="text-[11px] text-slate-400">Algebra, Advanced Math, Data Analysis, Geometry</p>
                            </div>
                        </div>
                        <SafeIcon icon={FiChevronRight} className="text-slate-500 group-hover:text-blue-400 transition-colors w-4 h-4" />
                    </div>

                    <div
                        onClick={() => onCourseSelect('SAT Reading & Writing')}
                        className="bg-[#0a0e24] p-3.5 rounded-2xl border border-slate-800 hover:border-purple-500/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                                <SafeIcon icon={FiBookOpen} className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-black text-white text-sm group-hover:text-purple-400 transition-colors">SAT Reading & Writing Topics</h4>
                                <p className="text-[11px] text-slate-400">Information, Craft, Expression, Conventions</p>
                            </div>
                        </div>
                        <SafeIcon icon={FiChevronRight} className="text-slate-500 group-hover:text-purple-400 transition-colors w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Complete Test History (Newest First) */}
            {data.completedAttempts && data.completedAttempts.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-800">
                    <h3 className="text-sm font-black mb-3 text-white flex items-center gap-2">
                        <SafeIcon icon={FiClock} /> Completed Tests ({data.completedAttempts.length})
                    </h3>
                    <div className="bg-[#0a0e24] rounded-2xl border border-slate-800 shadow-xl overflow-hidden overflow-x-auto text-white">
                        <table className="w-full text-left border-collapse text-[11px] font-bold">
                            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-black uppercase tracking-wider whitespace-nowrap">
                                <tr>
                                    <th className="p-2.5">Test / Topic</th>
                                    <th className="p-2.5">Date</th>
                                    <th className="p-2.5 text-center">Status</th>
                                    <th className="p-2.5 text-center">Accuracy</th>
                                    <th className="p-2.5 text-center">Score</th>
                                    <th className="p-2.5 text-center">Time</th>
                                    <th className="p-2.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {[...data.completedAttempts]
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map((topic) => (
                                    <tr key={topic.courseId} className="hover:bg-blue-600/10">
                                        <td className="p-2.5 max-w-[220px]">
                                            <p className="font-black text-white text-xs break-words">{topic.testName}</p>
                                            <p className="text-[10px] text-slate-400 break-words">{topic.courseName}</p>
                                        </td>
                                        <td className="p-2.5 text-slate-300 font-normal whitespace-nowrap">
                                            {topic.date ? new Date(topic.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                                        </td>
                                        <td className="p-2.5 text-center whitespace-nowrap">
                                            {topic.isFullyCompleted ? (
                                                <span className="px-2 py-0.5 rounded-full font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                                    Completed
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full font-black text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                                    In Progress ({(topic.activeLevels || []).length}/3)
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-center whitespace-nowrap">
                                            {topic.isFullyCompleted ? (
                                                <span className="px-2 py-0.5 rounded-full font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                                    {topic.accuracy}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-500 font-normal">--</span>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-center font-black text-amber-400 whitespace-nowrap">
                                            {topic.isFullyCompleted ? `${topic.scaledScore} / ${topic.maxScore || 800}` : <span className="text-slate-500 font-normal">--</span>}
                                        </td>
                                        <td className="p-2.5 text-center text-slate-300 font-normal whitespace-nowrap">
                                            {Math.floor(topic.timeTaken / 60)}m {topic.timeTaken % 60}s
                                        </td>
                                        <td className="p-2.5 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => topic.isFullLengthTest
                                                    ? onAttemptSelect(topic.submissionId)
                                                    : onTopicReportSelect(topic.courseId)}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                                            >
                                                View Report <SafeIcon icon={FiChevronRight} className="w-3 h-3" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentLevelView;
