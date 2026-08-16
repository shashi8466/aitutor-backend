import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import CombinedRegularCourseReport from '../common/CombinedRegularCourseReport';
import { tutorService, adminService } from '../../services/api';

const { FiArrowLeft, FiClock, FiChevronRight, FiBarChart2, FiDownload, FiCheckCircle } = FiIcons;

const TopicLevelView = ({ groupId, topic, student, onBack, onAttemptSelect, adminMode = false }) => {
    const [combinedData, setCombinedData] = useState(null);
    const [loadingCombined, setLoadingCombined] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'combined'
    const [reportTab, setReportTab] = useState('full'); // 'full' or 'question-wise'

    const attempts = topic.attempts || [];

    // Calculate Latest & Best Performance
    const latestAttempt = attempts.length > 0 ? attempts[0] : null;
    const latestScaledScore = latestAttempt?.scaledScore || topic.averageScore || 200;
    const latestAccuracy = latestAttempt?.score || topic.accuracy || 0;

    const bestScaledScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.scaledScore || 200)) : latestScaledScore;
    const bestAccuracy = attempts.length > 0 ? Math.max(...attempts.map(a => a.score || 0)) : latestAccuracy;

    const totalTimeSec = attempts.reduce((acc, a) => acc + (a.timeSpent || 0), 0);
    const mins = Math.floor(totalTimeSec / 60);
    const secs = totalTimeSec % 60;
    const totalTimeFormatted = `${mins}m ${secs}s`;

    const handleViewCombined = async (tab = 'full') => {
        setReportTab(tab);
        if (combinedData) {
            setViewMode('combined');
            return;
        }

        setLoadingCombined(true);
        try {
            const service = adminMode ? adminService : tutorService;
            const res = await service.getTopicReport(groupId, student.id, topic.courseId);
            setCombinedData(res.data);
            setViewMode('combined');
        } catch (err) {
            console.error('Failed to load combined report:', err);
            const fallbackResponses = attempts.flatMap(att => (att.responses || []).map(r => ({
                ...r,
                section: att.level || 'Medium'
            })));

            const syntheticFallback = {
                id: `combined_${topic.courseId || topic.id}`,
                courseName: topic.name,
                studentName: student.name,
                responses: fallbackResponses,
                scaled_score: bestScaledScore,
                created_at: new Date().toISOString(),
                test_duration_seconds: totalTimeSec
            };

            setCombinedData(syntheticFallback);
            setViewMode('combined');
        } finally {
            setLoadingCombined(false);
        }
    };

    if (viewMode === 'combined' && combinedData) {
        return (
            <CombinedRegularCourseReport 
                topicReportData={combinedData} 
                studentName={student.name}
                initialTab={reportTab}
                onExit={() => setViewMode('list')}
            />
        );
    }

    // Group attempts into Combined Attempt Cycles (Newest First)
    // 3 attempts (Easy, Medium, Hard) = 1 cycle. If fewer, treat each batch as a cycle.
    const groupedCycles = [];
    const sortedAttempts = [...attempts].sort((a, b) => new Date(b.date || b.created_at || Date.now()) - new Date(a.date || a.created_at || Date.now()));

    for (let i = 0; i < sortedAttempts.length; i += 3) {
        const batch = sortedAttempts.slice(i, i + 3);
        const latestInBatch = batch[0];
        const cycleQuestions = batch.reduce((acc, a) => acc + (a.questions || a.totalQ || 0), 0);
        const cycleCorrect = batch.reduce((acc, a) => acc + (a.correct || 0), 0);
        const cycleTime = batch.reduce((acc, a) => acc + (a.timeSpent || 0), 0);
        const cycleAccuracy = cycleQuestions > 0 ? Math.round((cycleCorrect / cycleQuestions) * 100) : 0;
        const cycleScaled = Math.round(200 + (cycleAccuracy / 100) * 600);

        const cycleMins = Math.floor(cycleTime / 60);
        const cycleSecs = cycleTime % 60;

        groupedCycles.push({
            cycleIndex: Math.floor((sortedAttempts.length - 1 - i) / 3) + 1,
            attemptId: latestInBatch.id,
            date: latestInBatch.date || latestInBatch.created_at,
            scaledScore: cycleScaled,
            accuracy: cycleAccuracy,
            questions: cycleQuestions,
            timeFormatted: `${cycleMins}m ${cycleSecs}s`,
            batch
        });
    }

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
                            {topic.name} <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">SAT Regular Course</span>
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">{student.name} • Subtopic Performance & Attempt Cycles</p>
                    </div>
                </div>
            </div>

            {/* Subtopic Overview Box: Latest & Best Performance */}
            <div className="bg-[#0a0e24] p-6 rounded-2xl border-2 border-indigo-500/40 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-full shadow">
                            {topic.name}
                        </span>
                        <span className="text-xs font-semibold text-blue-200 bg-blue-900/60 px-3 py-1 rounded-full">
                            Attempts: {attempts.length}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-slate-400 font-black uppercase">Latest Scaled Score</p>
                            <p className="text-xl font-black text-yellow-400">{latestScaledScore} <span className="text-xs font-normal text-slate-400">/ 800</span></p>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-slate-400 font-black uppercase">Latest Accuracy</p>
                            <p className="text-xl font-black text-emerald-400">{latestAccuracy}%</p>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-slate-400 font-black uppercase">Best Scaled Score</p>
                            <p className="text-xl font-black text-amber-400">{bestScaledScore} <span className="text-xs font-normal text-slate-400">/ 800</span></p>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                            <p className="text-[10px] text-slate-400 font-black uppercase">Total Time</p>
                            <p className="text-xl font-black text-white">{totalTimeFormatted}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap md:flex-col items-stretch justify-center gap-2 shrink-0">
                    <button 
                        onClick={() => handleViewCombined('full')}
                        disabled={loadingCombined}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                        {loadingCombined ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <SafeIcon icon={FiBarChart2} className="w-4 h-4" />
                        )}
                        View Combined Report →
                    </button>
                    <button 
                        onClick={() => handleViewCombined('question-wise')}
                        disabled={loadingCombined}
                        className="px-4 py-2.5 bg-white/10 text-white hover:bg-white/20 border border-slate-700 rounded-xl font-bold transition-all text-xs text-center"
                    >
                        Question-wise Analysis
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-indigo-900/40 text-indigo-200 hover:bg-indigo-900/60 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5"
                    >
                        <SafeIcon icon={FiDownload} className="w-3.5 h-3.5" /> Download PDF
                    </button>
                </div>
            </div>

            {/* Combined Attempt History Table (Newest First) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Attempt History for {topic.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Combined Easy + Medium + Hard attempt cycles sorted newest first.</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                        {groupedCycles.length} Combined Cycles
                    </span>
                </div>

                {groupedCycles.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No test attempt cycles logged yet for this subtopic.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase font-black tracking-wider border-b border-gray-200 dark:border-gray-700">
                                    <th className="p-4">Attempt</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Level</th>
                                    <th className="p-4">Score</th>
                                    <th className="p-4">Accuracy</th>
                                    <th className="p-4">Questions</th>
                                    <th className="p-4">Time</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {groupedCycles.map((cycle, idx) => (
                                    <tr key={cycle.attemptId || idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                                        <td className="p-4 font-bold text-gray-900 dark:text-white">Attempt #{groupedCycles.length - idx}</td>
                                        <td className="p-4 text-gray-500 font-medium">
                                            {new Date(cycle.date || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-black text-[10px] rounded-full uppercase tracking-wider">
                                                Combined
                                            </span>
                                        </td>
                                        <td className="p-4 font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                            {cycle.scaledScore} <span className="text-[10px] text-gray-500 font-normal">/ 800</span>
                                        </td>
                                        <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                            {cycle.accuracy}%
                                        </td>
                                        <td className="p-4 text-gray-700 dark:text-gray-300 font-semibold">
                                            {cycle.questions}
                                        </td>
                                        <td className="p-4 text-gray-500 font-medium">
                                            {cycle.timeFormatted}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleViewCombined('full')}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 rounded-lg font-bold transition-colors text-xs"
                                                >
                                                    View Report
                                                </button>
                                                <button 
                                                    onClick={() => handleViewCombined('question-wise')}
                                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 rounded-lg font-bold transition-colors text-xs"
                                                >
                                                    Question-wise Analysis
                                                </button>
                                                <button 
                                                    onClick={() => window.print()}
                                                    className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                                    title="Download PDF"
                                                >
                                                    <SafeIcon icon={FiDownload} className="w-4 h-4" />
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

export default TopicLevelView;
