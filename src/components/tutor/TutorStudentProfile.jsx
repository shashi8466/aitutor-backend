import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import {
    LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import SafeIcon from '../../common/SafeIcon';
import { tutorService } from '../../services/api';
import TestReview from '../student/agents/TestReview';

const { FiChevronLeft, FiBook, FiActivity, FiTarget, FiCalendar, FiClock, FiCheckCircle, FiXCircle } = FiIcons;

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'courses', label: 'Courses' },
    { id: 'test-history', label: 'Test History' },
    { id: 'performance', label: 'Performance' }
];

const formatDuration = (sec) => {
    if (!sec || sec <= 0) return '0m';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const isMathBucket = (bucketName) => (bucketName || '').toLowerCase().includes('math');

const TutorStudentProfile = () => {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [student, setStudent] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [progress, setProgress] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

    useEffect(() => {
        loadData();
    }, [studentId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await tutorService.getStudentProgress(studentId);
            setStudent(res.data.student || null);
            setSubmissions(res.data.submissions || []);
            setProgress(res.data.progress || []);
            setEnrollments(res.data.enrollments || []);
        } catch (error) {
            console.error('Failed to load student profile', error);
        } finally {
            setLoading(false);
        }
    };

    const changeTab = (tabId) => {
        setActiveTab(tabId);
        setSearchParams(tabId === 'overview' ? {} : { tab: tabId });
    };

    // --- Headline stats (same formula used by the roster row, so the numbers match) ---
    const headline = useMemo(() => {
        const testsAttempted = submissions.length;
        const overallProgress = testsAttempted > 0
            ? Math.round(submissions.reduce((sum, s) => sum + (s.raw_score_percentage || 0), 0) / testsAttempted)
            : 0;
        const lastActivity = submissions.reduce((latest, s) => {
            const d = s.created_at;
            return (!latest || new Date(d) > new Date(latest)) ? d : latest;
        }, null) || enrollments.reduce((latest, e) => {
            return (!latest || new Date(e.enrolled_at) > new Date(latest)) ? e.enrolled_at : latest;
        }, null);

        return {
            coursesCount: enrollments.length,
            testsAttempted,
            overallProgress,
            lastActivity
        };
    }, [submissions, enrollments]);

    // --- Performance Summary (Overview + Performance tabs) ---
    const performanceSummary = useMemo(() => {
        let questionsAttempted = 0, correct = 0, incorrect = 0, totalTime = 0;
        submissions.forEach(s => {
            const cCount = s.correct_questions?.length || 0;
            const iCount = s.incorrect_questions?.length || 0;
            questionsAttempted += (s.total_questions || (cCount + iCount) || 0);
            correct += cCount;
            incorrect += iCount;
            totalTime += (s.test_duration_seconds || 0);
        });
        return { questionsAttempted, correct, incorrect, totalTime };
    }, [submissions]);

    // --- Score trend (both tabs; Overview shows the tail, Performance shows all of it) ---
    const trendData = useMemo(() => {
        return [...submissions]
            .sort((a, b) => new Date(a.test_date || a.created_at) - new Date(b.test_date || b.created_at))
            .map((s, i) => ({
                name: `Test ${i + 1}`,
                score: Math.round(s.raw_score_percentage || 0)
            }));
    }, [submissions]);

    // --- Math vs Reading & Writing split (Performance tab) ---
    const subjectSplit = useMemo(() => {
        const buckets = {};
        submissions.forEach(s => {
            const key = s.course?.tutor_type || s.course?.category || s.course?.name || 'Other';
            const bucketKey = isMathBucket(key) ? 'Math' : 'Reading & Writing';
            if (!buckets[bucketKey]) buckets[bucketKey] = { sum: 0, count: 0 };
            buckets[bucketKey].sum += (s.raw_score_percentage || 0);
            buckets[bucketKey].count++;
        });
        return ['Math', 'Reading & Writing'].map(key => ({
            name: key,
            score: buckets[key] && buckets[key].count > 0 ? Math.round(buckets[key].sum / buckets[key].count) : 0
        }));
    }, [submissions]);

    // --- Courses tab: group enrollments by subject bucket, compute completion ---
    // Full-length tests are structurally different from topic courses: each is a single-attempt
    // course (never has Easy/Medium/Hard levels - `student_progress` rows for them are always
    // level='Adaptive', so a 3-levels-seen rule can never be true for them), so they're scored
    // separately rather than treated as a "topic" at all. Neither `is_adaptive` nor
    // `main_category` alone reliably flags every full-length course (confirmed live: SAT
    // full-length rows have is_adaptive=true, but ACT full-length rows have is_adaptive=false
    // and only main_category='FULL LENGTH TESTs' set) - checking both, same as
    // TestReview.jsx's own classifySubmission, is what actually covers every case. Bucket name
    // still comes from tutor_type (e.g. "Full-Length SAT" vs "Full-Length ACT" stay separate).
    // For topic courses, completion is derived from `test_submissions` (which level(s) actually
    // exist for that course_id), matching the same convention TestReview.jsx's Test History tab
    // already uses for its "X of 3 levels completed" badge - not from `student_progress`, which
    // is a secondary, non-atomic write for adaptive attempts and can under-report.
    const REQUIRED_LEVELS = ['easy', 'medium', 'hard'];
    const isFullLengthCourse = (course) =>
        (course?.main_category || '').toUpperCase() === 'FULL LENGTH TESTS' || course?.is_adaptive === true;

    const courseBuckets = useMemo(() => {
        const buckets = {};
        enrollments.forEach(e => {
            const bucketName = e.course?.tutor_type || e.course?.name || 'Other';
            if (!buckets[bucketName]) {
                buckets[bucketName] = { name: bucketName, isFullLength: isFullLengthCourse(e.course), courseIds: [] };
            }
            buckets[bucketName].courseIds.push(e.course_id);
        });

        const levelsSeenByCourse = {};
        const submissionsByCourse = {};
        const lastCompletedByBucket = {};
        submissions.forEach(s => {
            if (!levelsSeenByCourse[s.course_id]) levelsSeenByCourse[s.course_id] = new Set();
            const lvl = (s.level || '').toLowerCase().trim();
            if (lvl) levelsSeenByCourse[s.course_id].add(lvl);
            submissionsByCourse[s.course_id] = (submissionsByCourse[s.course_id] || 0) + 1;

            if (isFullLengthCourse(s.course)) {
                const bucketName = s.course?.tutor_type || s.course?.name || 'Other';
                const when = new Date(s.test_date || s.created_at);
                const prev = lastCompletedByBucket[bucketName];
                if (!prev || when > prev.when) {
                    lastCompletedByBucket[bucketName] = { when, name: s.course?.name, score: s.scaled_score };
                }
            }
        });

        return Object.values(buckets).map(bucket => {
            if (bucket.isFullLength) {
                // Every test_submissions row IS a completed full-length attempt (there's no
                // "in progress" row for these - a row only ever gets created on final submit).
                const totalAvailable = bucket.courseIds.length;
                const completedTests = bucket.courseIds.filter(cId => (submissionsByCourse[cId] || 0) > 0).length;
                const last = lastCompletedByBucket[bucket.name];
                return {
                    name: bucket.name,
                    isFullLength: true,
                    totalAvailable,
                    completedTests,
                    progressPct: totalAvailable > 0 ? Math.round((completedTests / totalAvailable) * 100) : 0,
                    lastTestName: last?.name || null,
                    lastScore: last?.score ?? null
                };
            }

            const totalTopics = bucket.courseIds.length;
            const completedTopics = bucket.courseIds.filter(cId => {
                const seen = levelsSeenByCourse[cId];
                return seen && REQUIRED_LEVELS.every(l => seen.has(l));
            }).length;
            const testsCount = bucket.courseIds.reduce((sum, cId) => sum + (submissionsByCourse[cId] || 0), 0);
            return {
                name: bucket.name,
                isFullLength: false,
                totalTopics,
                completedTopics,
                progressPct: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
                testsCount
            };
        }).sort((a, b) => (b.totalTopics || b.totalAvailable || 0) - (a.totalTopics || a.totalAvailable || 0));
    }, [enrollments, submissions]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Loading student profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/tutor/students')}
                    className="p-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl transition-colors text-gray-600 dark:text-gray-400"
                    title="Back to Students"
                >
                    <SafeIcon icon={FiChevronLeft} className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-black text-lg uppercase">
                        {student?.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{student?.name || 'Student'}</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{student?.email}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Courses', value: headline.coursesCount, icon: FiBook },
                    { label: 'Tests Attempted', value: headline.testsAttempted, icon: FiActivity },
                    { label: 'Overall Accuracy', value: `${headline.overallProgress}%`, icon: FiTarget },
                    { label: 'Last Active', value: headline.lastActivity ? new Date(headline.lastActivity).toLocaleDateString() : 'Never', icon: FiCalendar }
                ].map(tile => (
                    <div key={tile.label} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                            <SafeIcon icon={tile.icon} className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{tile.label}</span>
                        </div>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{tile.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => changeTab(tab.id)}
                        className={`px-4 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px ${
                            activeTab === tab.id
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">Performance Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Average Score</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">{headline.overallProgress}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Questions Attempted</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">{performanceSummary.questionsAttempted}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Correct Answers</p>
                                <p className="text-lg font-black text-emerald-500">{performanceSummary.correct}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Wrong Answers</p>
                                <p className="text-lg font-black text-rose-500">{performanceSummary.incorrect}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Study Time</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white">{formatDuration(performanceSummary.totalTime)}</p>
                            </div>
                        </div>
                    </div>

                    {trendData.length > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">Recent Score Trend</h3>
                            <div style={{ height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData.slice(-10)}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'courses' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {courseBuckets.length === 0 ? (
                        <div className="md:col-span-2 text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500">
                            No courses assigned to this student yet.
                        </div>
                    ) : courseBuckets.map(bucket => (
                        <div key={bucket.name} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="text-base font-black text-gray-900 dark:text-white mb-3">{bucket.name}</h3>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${bucket.progressPct}%` }} />
                                </div>
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{bucket.progressPct}%</span>
                            </div>
                            {bucket.isFullLength ? (
                                <div className="space-y-1">
                                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                                        <span>Tests Completed: {bucket.completedTests}/{bucket.totalAvailable}</span>
                                    </div>
                                    {bucket.lastTestName && (
                                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                                            <span>Last Test: {bucket.lastTestName}</span>
                                            {bucket.lastScore != null && <span>Last Score: {bucket.lastScore}</span>}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                                    <span>Topics Completed: {bucket.completedTopics}/{bucket.totalTopics}</span>
                                    <span>Tests Completed: {bucket.testsCount}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'test-history' && (
                <TestReview studentId={studentId} basePath="/tutor" />
            )}

            {activeTab === 'performance' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">Math vs Reading &amp; Writing</h3>
                        <div style={{ height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={subjectSplit}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="score" fill="#2563eb" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">Question Analysis</h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                <SafeIcon icon={FiCheckCircle} className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{performanceSummary.correct}</p>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Correct</p>
                            </div>
                            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                                <SafeIcon icon={FiXCircle} className="w-5 h-5 text-rose-500 mx-auto mb-2" />
                                <p className="text-lg font-black text-rose-600 dark:text-rose-400">{performanceSummary.incorrect}</p>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Incorrect</p>
                            </div>
                        </div>
                    </div>

                    {trendData.length > 1 && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">Full Score History</h3>
                            <div style={{ height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TutorStudentProfile;
