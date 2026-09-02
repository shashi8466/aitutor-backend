import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiFileText, FiDownload, FiClock, FiCheck, FiMinus } = FiIcons;

const LEVELS = ['Easy', 'Medium', 'Hard'];

/**
 * Shared expandable-row detail panel: fetches and lists a student's completed tests, newest
 * first, with View Report / Download actions. Reused by both the Tutor Student Roster
 * (fetchTests scoped to the tutor's assigned_courses, capped at 10) and the Student Groups
 * Analytics "Student Performance" table (fetchTests scoped to one group's assigned content,
 * uncapped) - only the data source passed in via `fetchTests` differs; this component has no
 * scoping logic of its own.
 *
 * A row is either a Full-Length Test attempt (one row per submission, `submissionId` present) or
 * a regular topic course (one row per course_id, its Easy/Medium/Hard already combined by
 * analyticsService.getRecentCompletedTests - `activeLevels`/`isFullyCompleted` present instead).
 * Full-Length rows link to the existing report/:submissionId route (FullTestReport); topic rows
 * link to the existing topic-report/:studentId/:courseId route (TopicReportReview /
 * CombinedRegularCourseReport), which already renders a "Test In Progress" placeholder when not
 * every level is done - no new report UI needed either way.
 */
const RecentCompletedTestsPanel = ({ fetchTests, basePath, studentId, title, emptyMessage }) => {
    const navigate = useNavigate();
    const [tests, setTests] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setTests(null);
        setError(null);
        fetchTests()
            .then(res => { if (!cancelled) setTests(res.data?.tests || []); })
            .catch(err => {
                console.error('Failed to load recent completed tests', err);
                if (!cancelled) setError('Failed to load recent completed tests.');
            });
        return () => { cancelled = true; };
    }, []);

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '--';
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">{title}</h4>

            {error ? (
                <p className="text-sm text-red-500 py-4 text-center">{error}</p>
            ) : tests === null ? (
                <div className="space-y-2">
                    {[0, 1, 2].map(i => <div key={i} className="h-12 w-full rounded-lg bg-gray-200/70 dark:bg-gray-800 animate-pulse" />)}
                </div>
            ) : tests.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{emptyMessage}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider border-b border-gray-200 dark:border-gray-700">
                                <th className="py-2 pr-4">Test Name</th>
                                <th className="py-2 pr-4">Date &amp; Time</th>
                                <th className="py-2 pr-4">Score</th>
                                <th className="py-2 pr-4">Levels</th>
                                <th className="py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {tests.map((t, idx) => {
                                const viewUrl = t.isFullLengthTest
                                    ? `${basePath}/report/${t.submissionId}`
                                    : `${basePath}/topic-report/${studentId}/${t.courseId}`;
                                const viewLabel = t.isFullLengthTest
                                    ? 'View Report'
                                    : (t.isFullyCompleted ? 'View Combined Report' : 'View Progress');

                                return (
                                <tr key={t.submissionId || `topic-${t.courseId}-${idx}`} className="text-gray-700 dark:text-gray-300">
                                    <td className="py-3 pr-4 font-bold text-gray-900 dark:text-white">{t.testName}</td>
                                    <td className="py-3 pr-4 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1.5">
                                            <SafeIcon icon={FiClock} className="w-3 h-3 text-gray-400" />
                                            {formatDateTime(t.date)}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 font-bold whitespace-nowrap">
                                        {t.score !== null && t.score !== undefined
                                            ? `${t.score} / ${t.maxScore}`
                                            : <span className="text-gray-500 dark:text-gray-400 font-medium">Progress: {t.activeLevels?.length || 0} / 3</span>}
                                    </td>
                                    <td className="py-3 pr-4 whitespace-nowrap">
                                        {t.isFullLengthTest ? (
                                            <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                                        ) : (
                                            <div className="inline-flex items-center gap-2">
                                                {LEVELS.map(lvl => {
                                                    const done = t.activeLevels?.includes(lvl);
                                                    return (
                                                        <span key={lvl} className={`inline-flex items-center gap-0.5 ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-600'}`}>
                                                            <SafeIcon icon={done ? FiCheck : FiMinus} className="w-3 h-3" />
                                                            {lvl}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-3 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(viewUrl)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                            >
                                                <SafeIcon icon={FiFileText} className="w-3 h-3" /> {viewLabel}
                                            </button>
                                            <button
                                                onClick={() => navigate(`${viewUrl}?download=true`)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                            >
                                                <SafeIcon icon={FiDownload} className="w-3 h-3" /> Download
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default RecentCompletedTestsPanel;
