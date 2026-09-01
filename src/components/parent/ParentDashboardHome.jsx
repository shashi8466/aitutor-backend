import React, { useState, useEffect, useMemo } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import Skeleton from '../common/Skeleton';
import { parentService } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const {
    FiTarget, FiCheckCircle, FiClock, FiTrendingUp, FiAward, FiBook, FiThumbsUp, FiAlertTriangle
} = FiIcons;

const StatCard = ({ label, value, icon, color, bg }) => (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${color}`}>
                <SafeIcon icon={icon} className="w-4 h-4" />
            </div>
        </div>
        <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
    </div>
);

// Dashboard overview for the currently-selected linked student - one call to the same
// analyticsService.getStudentDashboard tutor/admin already use (unscoped, via parentService),
// plus Top Scores and Strong/Weak topics, each backed by their own already-existing shared
// analyticsService function. No score math happens in this file.
const ParentDashboardHome = ({ studentId, student }) => {
    const [data, setData] = useState(null);
    const [topScores, setTopScores] = useState(null);
    const [topicPerformance, setTopicPerformance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.all([
            parentService.getStudentDashboard(studentId),
            parentService.getTopScores(studentId),
            parentService.getTopicPerformance(studentId)
        ])
            .then(([dashRes, topRes, topicRes]) => {
                if (cancelled) return;
                setData(dashRes.data);
                setTopScores(topRes.data?.topScores || []);
                setTopicPerformance(topicRes.data || { strongTopics: [], weakTopics: [] });
            })
            .catch(err => {
                console.error('Failed to load parent dashboard', err);
                if (!cancelled) setError('Failed to load this student\'s dashboard.');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [studentId]);

    // Course Performance - grouped client-side from completedAttempts, which analyticsService
    // has already computed correctly per topic (accuracy/scaledScore) - no new score math here.
    const courseBreakdown = useMemo(() => {
        if (!data?.completedAttempts) return [];
        const map = {};
        data.completedAttempts.forEach(a => {
            const key = a.courseName || a.testName;
            if (!map[key]) map[key] = { courseName: key, attempts: 0, scores: [], accuracies: [] };
            map[key].attempts += 1;
            if (a.isFullyCompleted) {
                map[key].scores.push(a.scaledScore || 0);
                map[key].accuracies.push(a.accuracy || 0);
            }
        });
        return Object.values(map).map(c => ({
            courseName: c.courseName,
            attempts: c.attempts,
            bestScore: c.scores.length ? Math.max(...c.scores) : null,
            avgAccuracy: c.accuracies.length ? Math.round(c.accuracies.reduce((s, v) => s + v, 0) / c.accuracies.length) : null
        }));
    }, [data]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                </div>
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
        );
    }

    if (error) return <div className="text-red-500 font-bold p-4">{error}</div>;
    if (!data) return null;

    const { overall = {}, trend = [], completedAttempts = [], fullLengthTest } = data;
    const recentAttempts = [...completedAttempts].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);
    const inProgressCount = completedAttempts.filter(a => !a.isFullyCompleted).length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
                <h2 className="text-xl font-bold mb-1">{student?.name || 'Student'}'s Overview</h2>
                <p className="text-amber-100 text-sm">Complete academic overview - read-only view of {student?.name || 'this student'}'s data.</p>
            </div>

            {/* Performance Summary */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Performance Summary</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Overall SAT Score" value={overall.hasData ? overall.bestSatScore : '—'} icon={FiAward} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/30" />
                    <StatCard label="Average Score" value={overall.hasData ? overall.averageSatScore : '—'} icon={FiTrendingUp} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/30" />
                    <StatCard label="Overall Accuracy" value={`${overall.overallAccuracy || 0}%`} icon={FiTarget} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/30" />
                    <StatCard label="Tests Completed" value={overall.completedTests || 0} icon={FiCheckCircle} color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/30" />
                    <StatCard label="Total Questions" value={overall.totalQuestions || 0} icon={FiBook} color="text-sky-600" bg="bg-sky-50 dark:bg-sky-900/30" />
                    <StatCard label="Tests In Progress" value={inProgressCount} icon={FiClock} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-900/30" />
                    <StatCard label="Full-Length Score" value={fullLengthTest ? fullLengthTest.overallScore : '—'} icon={FiAward} color="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-900/30" />
                    <StatCard label="Trend" value={overall.trendStatus || 'Stable'} icon={FiTrendingUp} color="text-teal-600" bg="bg-teal-50 dark:bg-teal-900/30" />
                </div>
            </div>

            {/* Progress Over Time */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Progress Over Time</h3>
                {trend.length < 1 ? (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No test submissions completed yet.</div>
                ) : (
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trend} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} />
                                <YAxis fontSize={12} tickLine={false} domain={[400, 1600]} />
                                <Tooltip />
                                <Line type="monotone" dataKey="satScore" name="SAT Total" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="mathScore" name="Math" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="rwScore" name="R&W" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Recent Activity</h3>
                    {recentAttempts.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center">No tests completed yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {recentAttempts.map((a, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{a.testName}</p>
                                        <p className="text-xs text-gray-400">{a.date ? new Date(a.date).toLocaleDateString() : '--'}</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full flex-shrink-0 ${a.isFullyCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {a.isFullyCompleted ? `${a.accuracy}%` : 'In Progress'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Scores */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Top Scores</h3>
                    {!topScores || topScores.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center">Complete a topic or Full-Length Test to see top scores.</p>
                    ) : (
                        <div className="space-y-3">
                            {topScores.map((result, idx) => (
                                <div key={result.type} className="flex items-center gap-4 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                                    <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center font-black text-xs flex-shrink-0">
                                        {String(idx + 1).padStart(2, '0')}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm truncate">{result.label}</h4>
                                        <p className="text-[10px] text-gray-400">{result.description}</p>
                                    </div>
                                    <span className="text-base font-black text-amber-600 flex-shrink-0">
                                        {result.score} <span className="text-xs font-bold text-gray-400">/ {result.maxScore}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Course Performance */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Course Performance</h3>
                    {courseBreakdown.length === 0 ? (
                        <p className="text-sm text-gray-400 py-6 text-center">No courses attempted yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {courseBreakdown.slice(0, 6).map(c => (
                                <div key={c.courseName} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{c.courseName}</p>
                                        <p className="text-xs text-gray-400">{c.attempts} attempt{c.attempts === 1 ? '' : 's'}</p>
                                    </div>
                                    <span className="text-sm font-black text-blue-600 flex-shrink-0">
                                        {c.bestScore !== null ? `${c.bestScore}` : '—'} {c.avgAccuracy !== null && <span className="text-xs font-bold text-gray-400">({c.avgAccuracy}%)</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Strengths & Weaknesses */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Strengths & Weaknesses</h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <SafeIcon icon={FiThumbsUp} className="w-3.5 h-3.5" /> Strong Topics
                            </p>
                            {!topicPerformance?.strongTopics?.length ? (
                                <p className="text-xs text-gray-400">Not enough data yet.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {topicPerformance.strongTopics.slice(0, 6).map((t, i) => (
                                        <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">{t.topic}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <SafeIcon icon={FiAlertTriangle} className="w-3.5 h-3.5" /> Areas Needing Improvement
                            </p>
                            {!topicPerformance?.weakTopics?.length ? (
                                <p className="text-xs text-gray-400">Not enough data yet.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {topicPerformance.weakTopics.slice(0, 6).map((t, i) => (
                                        <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300">{t.topic}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParentDashboardHome;
