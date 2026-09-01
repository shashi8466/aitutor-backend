import React, { useState, useEffect, useMemo } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import Skeleton from '../common/Skeleton';
import { parentService } from '../../services/api';

const { FiBook } = FiIcons;

// Presentation layer over the SAME per-course numbers analyticsService.getStudentDashboard
// already computes (completedAttempts, one row per topic/course) - grouped by course here for
// display, no new score calculations.
const ParentCourseBreakdown = ({ studentId, student }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        parentService.getStudentDashboard(studentId)
            .then(res => { if (!cancelled) setData(res.data); })
            .catch(err => {
                console.error('Failed to load course breakdown', err);
                if (!cancelled) setError('Failed to load course breakdown.');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [studentId]);

    const courses = useMemo(() => {
        if (!data?.completedAttempts) return [];
        const map = {};
        data.completedAttempts.forEach(a => {
            const key = a.courseId ?? a.courseName;
            if (!map[key]) {
                map[key] = {
                    courseName: a.courseName || a.testName,
                    attempts: 0,
                    scores: [],
                    accuracies: [],
                    completed: 0,
                    latestDate: null
                };
            }
            const c = map[key];
            c.attempts += 1;
            if (a.isFullyCompleted) {
                c.scores.push(a.scaledScore || 0);
                c.accuracies.push(a.accuracy || 0);
                c.completed += 1;
            }
            if (!c.latestDate || new Date(a.date) > new Date(c.latestDate)) c.latestDate = a.date;
        });
        return Object.values(map)
            .map(c => ({
                ...c,
                bestScore: c.scores.length ? Math.max(...c.scores) : null,
                avgScore: c.scores.length ? Math.round(c.scores.reduce((s, v) => s + v, 0) / c.scores.length) : null,
                avgAccuracy: c.accuracies.length ? Math.round(c.accuracies.reduce((s, v) => s + v, 0) / c.accuracies.length) : null
            }))
            .sort((a, b) => new Date(b.latestDate || 0) - new Date(a.latestDate || 0));
    }, [data]);

    if (loading) {
        return (
            <div className="space-y-4">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
        );
    }

    if (error) return <div className="text-red-500 font-bold p-4">{error}</div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{student?.name || 'Student'}'s Course Breakdown</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Courses/tests attempted, with attempts, best score, average score, and accuracy.</p>
            </div>

            {courses.length === 0 ? (
                <div className="py-16 text-center bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400">No courses attempted yet.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Course / Test</th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">Attempts</th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">Best Score</th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">Average Score</th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">Accuracy</th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-center">Completion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-750">
                            {courses.map(c => (
                                <tr key={c.courseName} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center flex-shrink-0">
                                                <SafeIcon icon={FiBook} className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-sm text-gray-900 dark:text-white">{c.courseName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center font-bold text-gray-700 dark:text-gray-300">{c.attempts}</td>
                                    <td className="p-4 text-center font-black text-amber-600">{c.bestScore ?? '—'}</td>
                                    <td className="p-4 text-center font-bold text-gray-700 dark:text-gray-300">{c.avgScore ?? '—'}</td>
                                    <td className="p-4 text-center font-bold text-gray-700 dark:text-gray-300">{c.avgAccuracy !== null ? `${c.avgAccuracy}%` : '—'}</td>
                                    <td className="p-4 text-center">
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${c.completed === c.attempts ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {c.completed}/{c.attempts} Completed
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ParentCourseBreakdown;
