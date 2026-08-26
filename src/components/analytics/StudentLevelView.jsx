import React, { useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import PdfExportWrapper from './PdfExportWrapper';
import { tutorService, adminService } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const { FiArrowLeft, FiAward, FiBookOpen, FiClock, FiTarget, FiChevronRight, FiTrendingUp } = FiIcons;

const StudentLevelView = ({ groupId, student, adminMode, onBack, onCourseSelect, onTopicReportSelect }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const service = adminMode ? adminService : tutorService;

    useEffect(() => {
        loadData();
    }, [student.id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await service.getStudentDashboard(groupId, student.id);
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
        currentScore: 400,
        bestScore: 400,
        lowestScore: 400,
        averageScore: 400,
        scoreImprovement: '0',
        testsCompleted: 0,
        testsAssigned: 0,
        testsRemaining: 0,
        accuracy: 0,
        totalQuestions: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        totalStudyTime: 0
    };

    const readingWriting = data?.readingWriting || {
        currentScore: 400,
        bestScore: 400,
        lowestScore: 400,
        averageScore: 400,
        scoreImprovement: '0',
        testsCompleted: 0,
        testsAssigned: 0,
        testsRemaining: 0,
        accuracy: 0,
        totalQuestions: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        totalStudyTime: 0
    };

    const overall = data?.overall || {
        currentSatScore: 800,
        bestSatScore: 800,
        lowestSatScore: 800,
        averageSatScore: 800,
        scoreImprovement: '0',
        overallAccuracy: 0,
        totalTests: 0,
        completedTests: 0,
        totalQuestions: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        totalStudyTime: 0,
        trendStatus: 'Stable'
    };

    // Filter main categories out of assignedContent to list as courses
    const assignedCourses = Object.keys(assignedContent || {}).filter(c => c !== 'invite_token');

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                        <SafeIcon icon={FiArrowLeft} className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                            {student.name} <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Student Report</span>
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">{student.email}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Reading & Writing Card */}
                <div 
                    onClick={() => onCourseSelect('SAT Reading & Writing')}
                    className="p-6 bg-[#0a0e24] rounded-2xl border-2 border-purple-500/40 text-white shadow-xl hover:border-purple-400 cursor-pointer transition-all flex flex-col justify-between group"
                >
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <span className="px-3 py-1 bg-purple-600/30 text-purple-300 font-black text-xs uppercase tracking-wider rounded-lg border border-purple-500/40">READING & WRITING</span>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                {readingWriting.scoreImprovement} Impr.
                            </span>
                        </div>
                        <div className="text-4xl font-black text-purple-400 mb-1 group-hover:text-purple-300 transition-colors">
                            {readingWriting.bestScore} <span className="text-sm font-bold text-slate-400">/ 800</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 mb-4">Best R&W Score</p>

                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs mb-3">
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Average Score</span>
                                <span className="text-sm font-black text-white">{readingWriting.averageScore}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Lowest</span>
                                <span className="text-sm font-black text-rose-400">{readingWriting.lowestScore}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Accuracy</span>
                                <span className="text-sm font-black text-white">{readingWriting.accuracy}%</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Tests Done</span>
                                <span className="text-sm font-black text-white">{readingWriting.testsCompleted}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-slate-400 flex justify-between items-center">
                        <span>Questions: {readingWriting.totalQuestions} (✓ {readingWriting.correct} | ✕ {readingWriting.incorrect})</span>
                        <span className="text-purple-400 font-black group-hover:underline">Explore →</span>
                    </div>
                </div>

                {/* Math Card */}
                <div 
                    onClick={() => onCourseSelect('SAT Math')}
                    className="p-6 bg-[#0a0e24] rounded-2xl border-2 border-blue-500/40 text-white shadow-xl hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between group"
                >
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <span className="px-3 py-1 bg-blue-600/30 text-blue-300 font-black text-xs uppercase tracking-wider rounded-lg border border-blue-500/40">SAT MATH</span>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                {math.scoreImprovement} Impr.
                            </span>
                        </div>
                        <div className="text-4xl font-black text-blue-400 mb-1 group-hover:text-blue-300 transition-colors">
                            {math.bestScore} <span className="text-sm font-bold text-slate-400">/ 800</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 mb-4">Best Math Score</p>

                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs mb-3">
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Average Score</span>
                                <span className="text-sm font-black text-white">{math.averageScore}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Lowest</span>
                                <span className="text-sm font-black text-rose-400">{math.lowestScore}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Accuracy</span>
                                <span className="text-sm font-black text-white">{math.accuracy}%</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Tests Done</span>
                                <span className="text-sm font-black text-white">{math.testsCompleted}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-slate-400 flex justify-between items-center">
                        <span>Questions: {math.totalQuestions} (✓ {math.correct} | ✕ {math.incorrect})</span>
                        <span className="text-blue-400 font-black group-hover:underline">Explore →</span>
                    </div>
                </div>

                {/* Overall SAT Card */}
                <div className="p-6 bg-gradient-to-br from-[#0c1330] via-[#0f1738] to-[#070b1e] rounded-2xl border-2 border-amber-500/40 text-white shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <span className="px-3 py-1 bg-amber-600/30 text-amber-300 font-black text-xs uppercase tracking-wider rounded-lg border border-amber-500/40">OVERALL SAT SCORE</span>
                            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                {overall.scoreImprovement} Total Impr.
                            </span>
                        </div>
                        <div className="text-5xl font-black text-amber-400 mb-1">{overall.bestSatScore} <span className="text-sm font-bold text-slate-400">/ 1600</span></div>
                        <p className="text-xs font-bold text-slate-300 mb-4">Best Overall SAT Score</p>

                        <div className="space-y-2 p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs mb-3">
                            <div className="flex justify-between">
                                <span className="text-slate-400 font-bold">Average SAT Score:</span>
                                <span className="font-black text-emerald-400">{overall.averageSatScore}</span>
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

                    <div className="pt-3 border-t border-slate-800 text-[11px] font-bold text-slate-400 flex justify-between">
                        <span>Total Questions: {overall.totalQuestions}</span>
                        <span>Trend: <strong className="text-emerald-400">{overall.trendStatus}</strong></span>
                    </div>
                </div>
            </div>

            {/* SAT SCORE PROGRESSION CHART */}
            <div className="bg-[#0a0e24] p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-black flex items-center gap-2">
                            <SafeIcon icon={FiTrendingUp} className="text-blue-400" /> SAT Score Progression
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Historical scaled score changes over practice attempts</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${overall.trendStatus === 'Improving' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                        Status: {overall.trendStatus}
                    </span>
                </div>

                {trend.length < 1 ? (
                    <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800 text-xs">
                        No test submissions completed yet for this student.
                    </div>
                ) : (
                    <div className="h-64">
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
                <h3 className="text-lg font-black mb-4 text-white">Select Section to View Topics & Tests</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div 
                        onClick={() => onCourseSelect('SAT Math')}
                        className="bg-[#0a0e24] p-5 rounded-2xl border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                                <SafeIcon icon={FiBookOpen} className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-black text-white text-base group-hover:text-blue-400 transition-colors">SAT Math Topics</h4>
                                <p className="text-xs text-slate-400">Algebra, Advanced Math, Data Analysis, Geometry</p>
                            </div>
                        </div>
                        <SafeIcon icon={FiChevronRight} className="text-slate-500 group-hover:text-blue-400 transition-colors w-5 h-5" />
                    </div>

                    <div 
                        onClick={() => onCourseSelect('SAT Reading & Writing')}
                        className="bg-[#0a0e24] p-5 rounded-2xl border border-slate-800 hover:border-purple-500/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                                <SafeIcon icon={FiBookOpen} className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-black text-white text-base group-hover:text-purple-400 transition-colors">SAT Reading & Writing Topics</h4>
                                <p className="text-xs text-slate-400">Information, Craft, Expression, Conventions</p>
                            </div>
                        </div>
                        <SafeIcon icon={FiChevronRight} className="text-slate-500 group-hover:text-purple-400 transition-colors w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Complete Test History (Newest First) */}
            {data.completedAttempts && data.completedAttempts.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-800">
                    <h3 className="text-lg font-black mb-4 text-white flex items-center gap-2">
                        <SafeIcon icon={FiClock} /> Completed Tests ({data.completedAttempts.length})
                    </h3>
                    <div className="bg-[#0a0e24] rounded-2xl border border-slate-800 shadow-xl overflow-hidden overflow-x-auto text-white">
                        <table className="w-full text-left whitespace-nowrap border-collapse text-xs font-bold">
                            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-black uppercase tracking-wider">
                                <tr>
                                    <th className="p-4">Test / Topic</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-center">Accuracy</th>
                                    <th className="p-4 text-center">Score</th>
                                    <th className="p-4 text-center">Time</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {[...data.completedAttempts]
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map((topic) => (
                                    <tr key={topic.courseId} className="hover:bg-blue-600/10">
                                        <td className="p-4">
                                            <p className="font-black text-white text-sm">{topic.testName}</p>
                                            <p className="text-[11px] text-slate-400">{topic.courseName}</p>
                                        </td>
                                        <td className="p-4 text-slate-300 font-normal">
                                            {topic.date ? new Date(topic.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {topic.isFullyCompleted ? (
                                                <span className="px-2.5 py-1 rounded-full font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                                    Completed
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-full font-black text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                                    In Progress ({(topic.activeLevels || []).length}/3)
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {topic.isFullyCompleted ? (
                                                <span className="px-2.5 py-1 rounded-full font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                                    {topic.accuracy}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-500 font-normal">--</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center font-black text-amber-400">
                                            {topic.isFullyCompleted ? `${topic.scaledScore} / 800` : <span className="text-slate-500 font-normal">--</span>}
                                        </td>
                                        <td className="p-4 text-center text-slate-300 font-normal">
                                            {Math.floor(topic.timeTaken / 60)}m {topic.timeTaken % 60}s
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => onTopicReportSelect(topic.courseId)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded-lg text-xs font-black transition-colors cursor-pointer"
                                            >
                                                View Report <SafeIcon icon={FiChevronRight} />
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
