import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import Skeleton from '../common/Skeleton';
import supabase from '../../supabase/supabase';
import { parentService, gradingService, planService } from '../../services/api';
import { calculateStudentScore, calculateSessionScore, getCategory } from '../../utils/scoreCalculator';
import CircularProgress from '../common/CircularProgress';

const { FiUsers, FiLogOut, FiHome, FiChevronRight, FiFileText, FiBarChart2, FiPieChart, FiActivity, FiArrowLeft, FiCheckCircle, FiXCircle, FiMinusCircle, FiBook, FiCheckSquare, FiPlay } = FiIcons;

// DUMMY DATA FOR DEMONSTRATION 
const DUMMY_CHILDREN = [
    { id: '1', name: 'Rahul Kumar', grade: '10th Grade' },
    { id: '2', name: 'Ananya Kumar', grade: '8th Grade' },
    { id: '3', name: 'Arjun Kumar', grade: '12th Grade' }
];

const DIFFICULTY_LEVELS = [
    { id: 'easy', name: 'Easy Tests', icon: '🟢', color: 'text-green-500', bg: 'bg-green-100' },
    { id: 'medium', name: 'Medium Tests', icon: '🟡', color: 'text-yellow-500', bg: 'bg-yellow-100' },
    { id: 'hard', name: 'Hard Tests', icon: '🔴', color: 'text-red-500', bg: 'bg-red-100' }
];

const DUMMY_TESTS = {
    '1_math_easy': [
        { id: 't1', testName: 'SAT Math Practice 1', courseName: 'Math', subject: 'Math', score: 680, maxScore: 800, date: '2026-03-10T10:00:00Z' }
    ],
    '1_math_medium': [
        { id: 't2', testName: 'SAT Reading Drill', courseName: 'Math', subject: 'Math', score: 720, maxScore: 800, date: '2026-03-09T14:30:00Z' }
    ]
};

const DUMMY_TEST_DETAILS = {
    't1': { name: 'Math', actualTestName: 'SAT Math Practice 1', subject: 'Math', attemptDate: '2026-03-10T10:00:00Z', attempts: 1, totalQuestions: 50, attempted: 48, correct: 40, incorrect: 8, unanswered: 2, scaleScore: 680 }
};

// Helper Components
const SummaryBadge = ({ label, value, color, darkColor = "" }) => (
    <div className={`px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col justify-center min-w-[120px] ${color} ${darkColor}`}>
        <span className="text-[10px] uppercase font-bold opacity-60 mb-0.5 tracking-wider">{label}</span>
        <span className="text-base font-bold">{value}</span>
    </div>
);

const LevelScore = ({ label, score, color }) => (
    <div>
        <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{score || 0}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score || 0}%` }}
                className={`h-full rounded-full ${color}`}
            />
        </div>
    </div>
);

const ProgressRow = ({ icon, color, bg, label, count, max }) => {
    const percent = Math.min(100, (count / max) * 100);
    return (
        <div>
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                    <SafeIcon icon={icon} className={`w-3.5 h-3.5 ${color}`} />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{label}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400">{count}/{max}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className={`h-full rounded-full ${bg}`}
                />
            </div>
        </div>
    );
};

// 1. Parent Overview (Children List)
const ChildrenOverview = () => {
    const { user } = useAuth();
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchChildren = async () => {
            try {
                let userProfile = user;
                if (!user.linked_students) {
                    const { data } = await supabase.from('profiles').select('linked_students').eq('id', user.id).single();
                    userProfile = { ...user, linked_students: data?.linked_students || [] };
                }

                if (userProfile && userProfile.linked_students?.length > 0) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('id, name')
                        .in('id', userProfile.linked_students);

                    if (data && data.length > 0) {
                        setChildren(data.map(child => ({
                            id: child.id,
                            name: child.name || 'Anonymous Student',
                            grade: 'Student Core'
                        })));
                    } else {
                        setChildren([]);
                    }
                } else {
                    setChildren([]);
                }
            } catch (err) {
                console.error(err);
                setChildren([]);
            }
            setLoading(false);
        };
        if (user) fetchChildren();
    }, [user]);

    return (
        <div className="p-6 max-w-5xl mx-auto min-h-screen bg-[#FAFAFA] dark:bg-gray-900">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6">Parent Dashboard</h2>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <SafeIcon icon={FiUsers} className="text-amber-500" />
                    My Children
                </h3>

                <div className="space-y-4">
                    {loading ? (
                        [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
                    ) : children.length === 0 ? (
                        <div className="py-8 text-center text-gray-500 dark:text-gray-400 border border-dashed rounded-lg border-gray-200 dark:border-gray-700">
                            No children accounts are linked to this parent profile.
                        </div>
                    ) : (
                        children.map((child, index) => (
                            <motion.div
                                key={child.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xl">
                                        {child.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">{child.name}</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{child.grade}</p>
                                    </div>
                                </div>
                                <Link
                                    to={`/parent/child/${child.id}`}
                                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-gray-700 transition"
                                >
                                    View Report <SafeIcon icon={FiChevronRight} />
                                </Link>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// 2. Child Courses Report
const ChildCoursesReport = () => {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [childName, setChildName] = useState("");
    const [loading, setLoading] = useState(true);
    const [overallStats, setOverallStats] = useState({
        scores: { total: 0, math: 0, rw: 0, target: 1500 },
        counts: { lessons: 0, tests: 0, worksheets: 14, sessions: 0 }
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch ALL data in one optimized request
                const response = await parentService.getDashboardData(studentId);
                const { studentName, submissions, plan } = response.data;
                
                setChildName(studentName);
                const diagnosticData = plan?.diagnostic_data || null;

                const mappedSubmissions = submissions.map(s => ({
                    ...s,
                    score: s.total_questions > 0
                        ? Math.round((s.raw_score / s.total_questions) * 100)
                        : Math.round(s.raw_score_percentage || 0),
                    courses: s.courses || { name: 'Practice', tutor_type: 'RW' }
                }));

                const overall = calculateStudentScore(mappedSubmissions, diagnosticData);
                const passedCount = submissions.filter(s => s.is_passed).length;

                const lessonsCount = Math.min(50, (passedCount * 3 + 5));
                setOverallStats({
                    scores: {
                        total: overall.current,
                        math: overall.math,
                        rw: overall.rw,
                        target: overall.target
                    },
                    counts: {
                        lessons: lessonsCount,
                        tests: submissions.length,
                        worksheets: 14,
                        sessions: Math.floor(lessonsCount / 2)
                    }
                });

                if (submissions && submissions.length > 0) {
                    const courseMap = {};
                    submissions.forEach(sub => {
                        const cId = sub.course_id;
                        if (!courseMap[cId]) {
                            const courseName = sub.courses?.name || `Course ${cId}`;
                            const category = getCategory(sub);

                            courseMap[cId] = {
                                id: cId,
                                name: courseName,
                                category: category,
                                levelScores: { Easy: 0, Medium: 0, Hard: 0 },
                                levelScaled: { Easy: 0, Medium: 0, Hard: 0 }
                            };
                        }

                        if (sub.level && sub.raw_score !== undefined && sub.total_questions > 0) {
                            const lvl = sub.level.charAt(0).toUpperCase() + sub.level.slice(1).toLowerCase();
                            const pct = Math.round((sub.raw_score / sub.total_questions) * 100);

                            if (pct > courseMap[cId].levelScores[lvl]) {
                                courseMap[cId].levelScores[lvl] = pct;
                                courseMap[cId].levelScaled[lvl] = calculateSessionScore(courseMap[cId].category, lvl, pct);
                            }
                        }
                    });

                    const formattedCourses = Object.values(courseMap).map(c => {
                        const weightedCourseAcc = (c.levelScores.Easy * 0.2 + c.levelScores.Medium * 0.35 + c.levelScores.Hard * 0.45);
                        const courseScaledScore = Math.max(200, Math.round(200 + (weightedCourseAcc * 6)));
                        return { ...c, courseScaledScore };
                    });
                    setCourses(formattedCourses);
                } else {
                    setCourses([]);
                }
            } catch (err) {
                console.error(err);
                setCourses([]);
            }
            setLoading(false);
        };
        fetchData();
    }, [studentId]);

    const { scores, counts } = overallStats;

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 pb-12">
            <div className="p-6 max-w-7xl mx-auto space-y-8">
                <Link to="/parent" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-amber-600 transition-colors font-medium">
                    <SafeIcon icon={FiArrowLeft} /> Back to Dashboard
                </Link>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1 capitalize">
                            Report: <span className="text-amber-500">{childName}</span>
                        </h2>
                        <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Real-time Performance Metrics & Diagnostic View</p>
                    </div>
                    {!loading && (
                        <div className="flex gap-4">
                            <SummaryBadge label="Current" value={`${scores.total}/1600`} color="bg-blue-50 text-blue-700" darkColor="dark:bg-blue-900/30 dark:text-blue-300" />
                            <SummaryBadge label="Goal" value={`${scores.target}/1600`} color="bg-purple-50 text-purple-700" darkColor="dark:bg-purple-900/30 dark:text-purple-300" />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white">Score Performance</h3>
                            <button
                                onClick={() => navigate(`/parent/child/${studentId}/test-history`)}
                                className="text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Review Tests
                            </button>
                        </div>

                        {loading ? <Skeleton className="h-40 w-full" /> : (
                            <div className="flex flex-col sm:flex-row items-center gap-10">
                                <div className="relative group">
                                    <CircularProgress value={scores.total} max={1600} size={150} strokeWidth={12} color="#3B82F6" />
                                    <div className="mt-4 text-center">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total Score</p>
                                        <p className="text-3xl font-extrabold text-gray-900 dark:text-white leading-none">{scores.total}</p>
                                    </div>
                                </div>
                                <div className="flex-1 w-full space-y-8">
                                    <div>
                                        <div className="flex justify-between text-[11px] font-bold mb-2 uppercase tracking-wider">
                                            <span className="text-gray-500">SAT Math</span>
                                            <span className="text-blue-600">{scores.math} / 800</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${(scores.math / 800) * 100}%` }} className="h-full bg-blue-500 rounded-full" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[11px] font-bold mb-2 uppercase tracking-wider">
                                            <span className="text-gray-500">Reading & Writing</span>
                                            <span className="text-green-600">{scores.rw} / 800</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${(scores.rw / 800) * 100}%` }} className="h-full bg-green-500 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-8">Engagement Activity</h3>
                        <div className="space-y-7">
                            {loading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />) : (
                                <>
                                    <ProgressRow icon={FiBook} color="text-blue-500" bg="bg-blue-600" label="Curriculum Lessons" count={counts.lessons} max={50} />
                                    <ProgressRow icon={FiCheckSquare} color="text-purple-500" bg="bg-purple-600" label="Assessment Quizzes" count={counts.tests} max={20} />
                                    <ProgressRow icon={FiFileText} color="text-yellow-500" bg="bg-yellow-600" label="Supportive Worksheets" count={counts.worksheets} max={30} />
                                    <ProgressRow icon={FiActivity} color="text-orange-500" bg="bg-orange-600" label="Tutoring Sessions" count={counts.sessions} max={24} />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-12">
                    <h3 className="font-bold text-xl text-gray-800 dark:text-white mb-6 uppercase tracking-wider">
                        Course Breakdown
                    </h3>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-2xl shadow-sm" />)}
                        </div>
                    ) : courses.length === 0 ? (
                        <div className="py-16 text-center bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                            No courses have been attempted yet.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {courses.map((course, index) => {
                                const isMath = course.category === 'MATH';
                                const themeColor = isMath ? 'text-blue-600' : 'text-green-600';
                                const themeBg = isMath ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20';
                                const themeIconBg = isMath ? 'bg-blue-600' : 'bg-green-600';

                                return (
                                    <motion.div
                                        key={course.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        onClick={() => navigate(`/parent/child/${studentId}/course/${course.id}`)}
                                        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group flex flex-col h-full cursor-pointer relative"
                                    >
                                        <div className="flex items-start justify-between mb-5 relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${themeIconBg} text-white`}>
                                                    <SafeIcon icon={FiBook} className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-800 dark:text-white leading-tight">{course.name}</h4>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isMath ? 'Quant' : 'Verbal'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5 tracking-wider">Score</span>
                                                <span className={`text-xl font-bold ${themeColor}`}>{course.courseScaledScore}</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-4 mb-4 pt-2 relative z-10">
                                            <LevelScore label="Easy" score={course.levelScores?.Easy} color={isMath ? 'bg-blue-400' : 'bg-green-400'} />
                                            <LevelScore label="Medium" score={course.levelScores?.Medium} color={isMath ? 'bg-blue-500' : 'bg-green-500'} />
                                            <LevelScore label="Hard" score={course.levelScores?.Hard} color={isMath ? 'bg-blue-600' : 'bg-green-600'} />
                                        </div>
                                        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between relative z-10">
                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Analytics</span>
                                            <SafeIcon icon={FiChevronRight} className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-all" />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 3. Child Difficulty Report
const ChildDifficultyReport = () => {
    const { studentId, courseId } = useParams();
    const [courseName, setCourseName] = useState("");

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const { data } = await supabase.from('courses').select('name').eq('id', courseId).single();
                setCourseName(data?.name || 'Course');
            } catch (err) { setCourseName(courseId); }
        };
        if (courseId) fetchDetails();
    }, [courseId]);

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 pb-12 font-sans text-gray-900 dark:text-gray-100">
            <div className="p-6 max-w-5xl mx-auto">
                <Link to={`/parent/child/${studentId}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-amber-600 mb-6 transition-colors font-bold uppercase tracking-wider">
                    <SafeIcon icon={FiArrowLeft} /> Back to Report
                </Link>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">{courseName} Analytics</h2>
                <p className="text-sm text-gray-500 font-medium mb-8">Select a difficulty level to view detailed performance.</p>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-100">Difficulty Levels</h3>
                    <div className="space-y-3">
                        {DIFFICULTY_LEVELS.map((level, index) => (
                            <Link key={level.id} to={`/parent/child/${studentId}/course/${courseId}/difficulty/${level.id}`}>
                                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50/50 dark:bg-gray-750 border border-gray-100 hover:border-amber-400 hover:bg-white hover:shadow-md transition-all">
                                    <div className="flex items-center gap-5">
                                        <div className="text-3xl">{level.icon}</div>
                                        <h4 className="font-bold text-gray-900 dark:text-white text-lg">{level.name}</h4>
                                    </div>
                                    <SafeIcon icon={FiChevronRight} className="text-gray-400" />
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// 4. Child Performance Report (Test List)
const ChildPerformanceReport = () => {
    const { studentId, courseId, difficultyId } = useParams();
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await parentService.getStudentReports(studentId);
                const submissions = (response.data?.submissions || []).filter(sub => String(sub.course_id) === String(courseId) && sub.level?.toLowerCase() === difficultyId.toLowerCase());
                setTests(submissions.map(sub => ({
                    id: sub.id,
                    courseName: sub.courses?.name || `Course ${courseId}`,
                    subject: 'Practice',
                    score: sub.raw_score || 0,
                    maxScore: sub.total_questions || 0,
                    date: sub.test_date || new Date().toISOString()
                })));
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        fetchDetails();
    }, [studentId, courseId, difficultyId]);

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 pb-12 font-sans text-gray-900 dark:text-gray-100">
            <div className="p-6 max-w-5xl mx-auto">
                <Link to={`/parent/child/${studentId}/course/${courseId}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-amber-600 mb-6 transition-colors">
                    <SafeIcon icon={FiArrowLeft} /> Back to Difficulty
                </Link>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-6">Performance Report</h2>
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="py-4 px-8 font-bold text-gray-400 uppercase text-[10px] tracking-wider">Assessment</th>
                                <th className="py-4 px-8 font-bold text-gray-400 uppercase text-[10px] tracking-wider text-center">Score</th>
                                <th className="py-4 px-8 font-bold text-gray-400 uppercase text-[10px] tracking-wider text-center">Date</th>
                                <th className="py-4 px-8 font-bold text-gray-400 uppercase text-[10px] tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-750">
                            {loading ? (
                                <tr><td colSpan="4" className="p-10 text-center text-gray-500">Loading assessments...</td></tr>
                            ) : tests.length === 0 ? (
                                <tr><td colSpan="4" className="p-10 text-center text-gray-500">No assessments found.</td></tr>
                            ) : tests.map(test => (
                                <tr key={test.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all group border-b border-gray-50 dark:border-gray-750">
                                    <td className="py-5 px-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                                                <SafeIcon icon={FiFileText} />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-gray-800 dark:text-white group-hover:text-blue-600 transition-all">{test.courseName}</h5>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Assessment Record</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-5 px-8 text-center">
                                        <span className="font-bold text-gray-900 dark:text-white">{test.score} / {test.maxScore}</span>
                                    </td>
                                    <td className="py-5 px-8 text-center">
                                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                            {new Date(test.date).toLocaleDateString()}
                                        </span>
                                    </td>
                                    <td className="py-5 px-8 text-right">
                                        <button
                                            onClick={() => navigate(`/parent/child/${studentId}/course/${courseId}/difficulty/${difficultyId}/test/${test.id}`)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                        >
                                            View Report
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// 5. Detailed Test Report
const DetailedTestReport = () => {
    const { studentId, courseId, difficultyId, testId } = useParams();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await gradingService.getSubmission(testId);
                const sub = response.data?.submission;
                if (sub) {
                    const subLevel = sub.level?.charAt(0).toUpperCase() + sub.level?.slice(1).toLowerCase();
                    const subPct = Math.round((sub.raw_score / sub.total_questions) * 100);
                    const courseName = sub.course?.name || sub.courses?.name || 'Test Report';
                    const cat = getCategory(sub);
                    const calcScale = sub.scaled_score || calculateSessionScore(cat, subLevel, subPct);
                    setDetails({
                        id: sub.id,
                        name: courseName,
                        subject: courseName,
                        attemptDate: sub.test_date,
                        totalQuestions: sub.total_questions || 0,
                        correct: sub.raw_score || 0,
                        incorrect: (sub.total_questions || 0) - (sub.raw_score || 0),
                        unanswered: sub.skipped_questions?.length || 0,
                        scaleScore: calcScale
                    });
                }
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        fetchDetails();
    }, [testId]);

    if (loading) return <div className="p-6 text-center">Loading detailed report...</div>;
    if (!details) return <div className="p-6 text-center text-red-500">Report details not found.</div>;

    const subPct = Math.round((details.correct / details.totalQuestions) * 100);

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 pb-12">
            <div className="p-6 max-w-7xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <Link to={`/parent/child/${studentId}/course/${courseId}/difficulty/${difficultyId}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-amber-600 transition-colors font-bold uppercase tracking-wider">
                        <SafeIcon icon={FiArrowLeft} /> Back to List
                    </Link>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Live Analytics Record
                    </div>
                </div>

                {/* Premium Result Header */}
                <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-8 md:p-10 text-white overflow-hidden shadow-lg border border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10 divide-x divide-white/10">
                        <div className="flex items-center gap-6 px-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                <SafeIcon icon={FiBook} className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider opacity-80">Subject</p>
                                <h2 className="text-xl font-extrabold tracking-tight uppercase">{details.name}</h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 px-8">
                            <div>
                                <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider opacity-80">Date</p>
                                <h2 className="text-lg font-bold">
                                    {new Date(details.attemptDate).toLocaleDateString()}
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 px-8">
                            <div>
                                <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider opacity-80">Duration</p>
                                <h2 className="text-xl font-bold tracking-tight">15 min</h2>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center px-8">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider opacity-80">Total Score</p>
                                <h2 className="text-4xl font-extrabold tracking-tight text-white">
                                    {details.correct}<span className="text-lg opacity-60">/{details.totalQuestions}</span>
                                </h2>
                                <p className="text-[10px] font-bold text-green-300 uppercase tracking-widest mt-1 opacity-90">{subPct}% Accuracy</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Cards Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard label="Questions" value={details.totalQuestions} icon={FiFileText} color="text-gray-500" bg="bg-gray-50" />
                    <StatCard label="Correct" value={details.correct} icon={FiCheckCircle} color="text-green-600" bg="bg-green-50" borderColor="border-green-100" />
                    <StatCard label="Incorrect" value={details.incorrect} icon={FiXCircle} color="text-red-600" bg="bg-red-50" borderColor="border-red-100" />
                    <StatCard label="Accuracy" value={`${subPct}%`} icon={FiActivity} color="text-blue-600" bg="bg-blue-50" borderColor="border-blue-100" />
                </div>

                <div className="flex justify-center mt-4">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center max-w-sm w-full">
                        <CircularProgress value={details.scaleScore} max={800} size={150} strokeWidth={12} color="#3B82F6" />
                        <h4 className="mt-6 text-lg font-bold text-gray-800 dark:text-white uppercase tracking-wider">Estimated SAT Score</h4>
                        <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Section Performance Index</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, icon, color, bg, borderColor = "border-gray-100" }) => (
    <div className={`p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 ${borderColor} dark:border-gray-700 shadow-sm relative overflow-hidden`}>
        <div className="relative z-10">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <div className="flex items-center justify-between">
                <h3 className={`text-2xl font-bold ${color} tracking-tight`}>{value}</h3>
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center ${color}`}>
                    <SafeIcon icon={icon} className="w-5 h-5" />
                </div>
            </div>
        </div>
    </div>
);

const MetricItem = ({ label, value, color }) => (
    <div>
        <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">{label}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{value}</span>
        </div>
        <div className="h-1.5 bg-gray-50 dark:bg-gray-900 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: "70%" }} className={`h-full ${color} rounded-full`} />
        </div>
    </div>
);

// 6. Consolidated Test History
const ChildTestHistory = () => {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await parentService.getStudentReports(studentId);
                const submissions = response.data?.submissions || [];
                setTests(submissions.map(sub => ({
                    id: sub.id,
                    courseId: sub.course_id,
                    difficultyId: sub.level?.toLowerCase() || 'medium',
                    courseName: sub.courses?.name || 'Practice Test',
                    score: sub.raw_score || 0,
                    maxScore: sub.total_questions || 0,
                    date: sub.test_date || new Date().toISOString(),
                    level: sub.level?.toUpperCase() || 'MEDIUM',
                    accuracy: Math.round(((sub.raw_score || 0) / (sub.total_questions || 1)) * 100)
                })));
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        fetchHistory();
    }, [studentId]);

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 pb-12">
            <div className="p-8 max-w-6xl mx-auto space-y-10">
                <Link to={`/parent/child/${studentId}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-amber-600 transition-colors font-bold uppercase tracking-wider">
                    <SafeIcon icon={FiArrowLeft} /> Return to Report
                </Link>

                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-1">Test History</h2>
                    <p className="text-gray-500 font-medium">Analyze past performance and learn from mistakes.</p>
                </div>

                <div className="space-y-4">
                    {loading ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />) :
                        tests.length === 0 ? <p className="text-center py-20 text-gray-400 font-bold uppercase text-xs border-2 border-dashed rounded-3xl">No tests found in records.</p> :
                            tests.map(test => (
                                <div
                                    key={test.id}
                                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                            <SafeIcon icon={FiFileText} className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h4 className="text-lg font-bold text-gray-800 dark:text-white uppercase">{test.courseName}</h4>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${test.level === 'HARD' ? 'bg-red-50 text-red-600' : test.level === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                                                    {test.level}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                <span>Accuracy: {test.accuracy}%</span>
                                                <span>{new Date(test.date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-10 mt-4 md:mt-0">
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Score</p>
                                            <p className="text-2xl font-bold text-blue-600 leading-none">{calculateSessionScore(getCategory(test), test.level, test.accuracy)}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/parent/child/${studentId}/course/${test.courseId}/difficulty/${test.difficultyId}/test/${test.id}`)}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-blue-700 transition-all flex items-center gap-2"
                                        >
                                            Review <SafeIcon icon={FiChevronRight} />
                                        </button>
                                    </div>
                                </div>
                            ))
                    }
                </div>
            </div>
        </div>
    );
};

// Main Component
const ParentDashboard = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);

    const handleLogout = async () => { await logout(); navigate('/login'); };

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 flex flex-col font-sans text-gray-900 dark:text-gray-100">
            <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 sticky top-0 z-30 shadow-sm">
                <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-3 font-semibold">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-100">
                            <SafeIcon icon={FiUsers} className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold leading-tight">Parent <span className="text-amber-500">Portal</span></h1>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Account: {user?.name || 'Parent'}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase transition-all hover:bg-red-100">
                        <SafeIcon icon={FiLogOut} className="w-4 h-4" /> Logout
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-auto bg-[#FAFAFA] dark:bg-gray-900">
                <AnimatePresence mode="wait">
                    <Routes>
                        <Route path="/" element={<ChildrenOverview />} />
                        <Route path="/child/:studentId" element={<ChildCoursesReport />} />
                        <Route path="/child/:studentId/test-history" element={<ChildTestHistory />} />
                        <Route path="/child/:studentId/course/:courseId" element={<ChildDifficultyReport />} />
                        <Route path="/child/:studentId/course/:courseId/difficulty/:difficultyId" element={<ChildPerformanceReport />} />
                        <Route path="/child/:studentId/course/:courseId/difficulty/:difficultyId/test/:testId" element={<DetailedTestReport />} />
                    </Routes>
                </AnimatePresence>
            </main>
        </div>
    );
};

export default ParentDashboard;
