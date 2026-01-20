import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';

import axios from 'axios';
import supabase from '../../supabase/supabase';
import { gradingService, tutorService, courseService } from '../../services/api';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const {
    FiBarChart2, FiUser, FiBook, FiCalendar, FiClock,
    FiCheckCircle, FiXCircle, FiChevronRight, FiChevronLeft,
    FiFilter, FiDownload, FiInfo, FiTrendingUp, FiAlertCircle, FiX
} = FiIcons;

const TutorGrades = ({ adminMode = false, courseId = null }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const studentIdParam = queryParams.get('studentId');
    const courseIdParam = queryParams.get('courseId') || courseId;

    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [submissionDetails, setSubmissionDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        loadCourses();
    }, [courseIdParam]);

    const loadCourses = async () => {
        try {
            if (adminMode && courseId) {
                const { data: course } = await courseService.getById(courseId);
                setCourses([course]);
                handleCourseSelect(course);
                return;
            }

            const res = await tutorService.getDashboard();
            setCourses(res.data.courses || []);

            const targetId = courseIdParam || courseId;
            if (targetId) {
                const target = res.data.courses?.find(c => c.id === parseInt(targetId));
                if (target) handleCourseSelect(target);
                else if (res.data.courses?.length > 0) handleCourseSelect(res.data.courses[0]);
            } else if (res.data.courses?.length > 0) {
                handleCourseSelect(res.data.courses[0]);
            }
        } catch (error) {
            console.error('Error loading courses:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCourseSelect = async (course) => {
        if (!course) return;
        setSelectedCourse(course);
        setLoading(true);
        try {
            const gradesRes = await axios.get(`/api/tutor/course-grades/${course.id}`);
            setSubmissions(gradesRes.data.submissions || []);
        } catch (error) {
            console.error('Error loading grades:', error);
            setSubmissions([]);
        } finally {
            setLoading(false);
        }
    };

    const viewSubmissionDetails = async (submission) => {
        setSelectedSubmission(submission);
        setLoadingDetails(true);
        try {
            const res = await gradingService.getSubmission(submission.id);
            setSubmissionDetails(res.data.submission);
        } catch (error) {
            console.error('Error loading submission details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const getScoreColor = (percentage) => {
        if (percentage >= 80) return 'text-green-600 dark:text-green-400';
        if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const displayedSubmissions = studentIdParam
        ? submissions.filter(s => s.user_id === studentIdParam)
        : submissions;

    if (loading && submissions.length === 0 && courses.length === 0) return <div className="p-8 text-center text-blue-600 font-bold animate-pulse">Loading grades and analysis...</div>;

    return (
        <div className={`space-y-6 ${adminMode ? 'p-0' : ''}`}>
            {!adminMode && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Grade Analysis</h2>
                        <p className="text-gray-500 dark:text-gray-400">Detailed performance tracking per course and student</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <SafeIcon icon={FiFilter} className="text-gray-400" />
                        <select
                            value={selectedCourse?.id || ''}
                            onChange={(e) => {
                                const course = courses.find(c => c.id === parseInt(e.target.value));
                                if (course) handleCourseSelect(course);
                            }}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 font-bold text-gray-700 dark:text-gray-300 shadow-sm"
                        >
                            {courses.map(course => (
                                <option key={course.id} value={course.id}>{course.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {studentIdParam && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-center justify-between border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                            <SafeIcon icon={FiUser} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-blue-900 dark:text-blue-300">Filtering for specific student</p>
                            <p className="text-xs text-blue-700 dark:text-blue-400">Viewing only submissions from {displayedSubmissions[0]?.user?.name || 'this student'}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            queryParams.delete('studentId');
                            navigate(`${location.pathname}?${queryParams.toString()}`);
                        }}
                        className="px-3 py-1 bg-white dark:bg-gray-800 text-xs font-bold rounded-lg border border-blue-200"
                    >
                        Clear Filter
                    </button>
                </div>
            )}

            {/* Performance Overview */}
            {displayedSubmissions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Avg. Scaled Score</p>
                        <p className="text-3xl font-black text-blue-600">
                            {Math.round(displayedSubmissions.reduce((acc, s) => acc + (s.scaled_score || 0), 0) / displayedSubmissions.length)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Avg. Math</p>
                        <p className="text-3xl font-black text-indigo-600">
                            {Math.round(displayedSubmissions.reduce((acc, s) => acc + (s.math_scaled_score || 0), 0) / displayedSubmissions.length)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Avg. Reading</p>
                        <p className="text-3xl font-black text-purple-600">
                            {Math.round(displayedSubmissions.reduce((acc, s) => acc + (s.reading_scaled_score || 0), 0) / displayedSubmissions.length)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Avg. Writing</p>
                        <p className="text-3xl font-black text-pink-600">
                            {Math.round(displayedSubmissions.reduce((acc, s) => acc + (s.writing_scaled_score || 0), 0) / displayedSubmissions.length)}
                        </p>
                    </div>
                </div>
            )}

            {/* Submissions Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Test Level</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Raw Score</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Scaled Score</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {displayedSubmissions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">No submissions found for this selection.</td>
                                </tr>
                            ) : (
                                displayedSubmissions.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                                                    {sub.user?.name?.charAt(0) || 'S'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{sub.user?.name || 'Unknown Student'}</p>
                                                    <p className="text-xs text-gray-500">{sub.user?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-bold uppercase tracking-wider">
                                                {sub.level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(sub.test_date || sub.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {sub.raw_score} / {sub.total_questions}
                                                </span>
                                                <span className={`text-[10px] font-black ${getScoreColor(sub.raw_score_percentage)}`}>
                                                    {Math.round(sub.raw_score_percentage)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                                                {sub.scaled_score || '--'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => viewSubmissionDetails(sub)}
                                                className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                            >
                                                <SafeIcon icon={FiChevronRight} className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detailed Analysis Modal */}
            <AnimatePresence>
                {selectedSubmission && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedSubmission(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">Detailed Analysis</h3>
                                    <p className="text-gray-500">Reviewing {selectedSubmission.user?.name}'s {selectedSubmission.level} test</p>
                                </div>
                                <button
                                    onClick={() => setSelectedSubmission(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <SafeIcon icon={FiX} className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-4 space-y-8 custom-scrollbar">
                                {loadingDetails ? (
                                    <div className="py-20 text-center animate-pulse text-blue-600 font-bold">Loading full analytics...</div>
                                ) : submissionDetails ? (
                                    <>
                                        {/* Performance Breakdown */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {[
                                                { label: 'Math Section', score: submissionDetails.math_scaled_score, color: 'from-blue-500 to-indigo-600' },
                                                { label: 'Reading Section', score: submissionDetails.reading_scaled_score, color: 'from-purple-500 to-pink-600' },
                                                { label: 'Writing Section', score: submissionDetails.writing_scaled_score, color: 'from-orange-500 to-red-600' }
                                            ].map((s) => (
                                                <div key={s.label} className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{s.label}</p>
                                                    <div className="flex items-end justify-between">
                                                        <span className="text-4xl font-black text-gray-900 dark:text-white">{s.score || '--'}</span>
                                                        <div className={`w-12 h-2 rounded-full bg-gradient-to-r ${s.color}`} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Accuracy Stats */}
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 text-center">
                                                <p className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase mb-1">Correct</p>
                                                <p className="text-2xl font-black text-green-700 dark:text-green-300">{submissionDetails.correct_questions?.length || 0}</p>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center">
                                                <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase mb-1">Incorrect</p>
                                                <p className="text-2xl font-black text-red-700 dark:text-red-300">{submissionDetails.incorrect_questions?.length || 0}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-900/10 p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                                                <p className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase mb-1">Skipped</p>
                                                <p className="text-2xl font-black text-gray-700 dark:text-gray-300">{submissionDetails.skipped_questions?.length || 0}</p>
                                            </div>
                                        </div>

                                        {/* Question List */}
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white border-b pb-2">Incorrect Responses ({submissionDetails.incorrect_questions?.length || 0})</h4>
                                            {submissionDetails.incorrect_questions?.length > 0 ? (
                                                <div className="space-y-3">
                                                    {submissionDetails.incorrect_responses?.map((resp, i) => (
                                                        <div key={i} className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                                                            <div className="flex gap-3">
                                                                <span className="w-6 h-6 bg-red-100 dark:bg-red-900/40 text-red-600 rounded flex items-center justify-center font-bold text-xs shrink-0">
                                                                    {i + 1}
                                                                </span>
                                                                <div className="space-y-3 flex-1 overflow-hidden">
                                                                    <div className="text-sm text-gray-800 dark:text-gray-200">
                                                                        <MathRenderer text={resp.question_text} />
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                                                                            <p className="text-gray-400 mb-1">Student's Answer:</p>
                                                                            <p className="font-bold text-red-600">{resp.selected_answer}</p>
                                                                        </div>
                                                                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                                                                            <p className="text-gray-400 mb-1">Correct Answer:</p>
                                                                            <p className="font-bold text-green-600">{resp.correct_answer}</p>
                                                                        </div>
                                                                    </div>
                                                                    {resp.explanation && (
                                                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs italic">
                                                                            <span className="font-bold not-italic">Explanation: </span>
                                                                            <MathRenderer text={resp.explanation} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="py-4 text-center text-gray-500 italic text-sm">No incorrect questions! Perfect score.</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-20 text-center text-red-500 font-bold">Failed to load details.</div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                                        <span className="text-xs text-gray-500">Critical Gaps</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full" />
                                        <span className="text-xs text-gray-500">Mastery Areas</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedSubmission(null)}
                                    className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
                                >
                                    Close Analysis
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TutorGrades;
