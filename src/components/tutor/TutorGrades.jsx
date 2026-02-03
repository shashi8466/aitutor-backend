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
    const [activeTab, setActiveTab] = useState('incorrect'); // 'incorrect' or 'correct'

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

    const handleCloseModal = () => {
        setSelectedSubmission(null);
        setSubmissionDetails(null);
        setActiveTab('incorrect');
    };

    useEffect(() => {
        if (selectedSubmission) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [selectedSubmission]);

    const getScoreColor = (percentage) => {
        if (percentage >= 80) return 'text-green-600 dark:text-green-400';
        if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
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

    const displayedSubmissions = studentIdParam
        ? submissions.filter(s => s.user_id === studentIdParam)
        : submissions;

    if (loading && submissions.length === 0 && courses.length === 0) return <div className="p-8 text-center text-blue-600 font-bold animate-pulse">Loading grades and analysis...</div>;

    const calculateRealScores = (details) => {
        if (!details) return { math: 0, reading: 0, writing: 0 };

        const normalizeSubject = (s) => {
            if (!s) return 'Unknown';
            const str = s.toLowerCase();
            if (str.includes('math') || str.includes('algebra') || str.includes('geometry')) return 'Math';
            if (str.includes('reading') || str.includes('literature')) return 'Reading';
            if (str.includes('writing') || str.includes('grammar') || str.includes('english')) return 'Writing';
            return 'Other';
        };

        const getSectionStats = (targetSection) => {
            const correct = (details.correct_responses || [])
                .filter(r => normalizeSubject(r.subject) === targetSection).length;
            const incorrect = (details.incorrect_responses || [])
                .filter(r => normalizeSubject(r.subject) === targetSection).length;
            const total = correct + incorrect;

            // Avoid NaN if no questions found for this section
            if (total === 0) return 0;

            // Linear scoring: 200 base + scaled performance
            return Math.round(200 + (correct / total) * 600);
        };

        return {
            math: getSectionStats('Math'),
            reading: getSectionStats('Reading'),
            writing: getSectionStats('Writing')
        };
    };

    const realScores = submissionDetails ? calculateRealScores(submissionDetails) : { math: 0, reading: 0, writing: 0 };

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
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Average Score</p>
                        <p className="text-3xl font-black text-blue-600">
                            {Math.round(displayedSubmissions.reduce((acc, s) => acc + (s.raw_score_percentage || 0), 0) / (displayedSubmissions.length || 1))}%
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
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
                    >
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm shadow-2xl"
                            onClick={handleCloseModal}
                        />

                        {/* Modal Body */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">Detailed Analysis</h3>
                                    <p className="text-gray-500">Reviewing {selectedSubmission.user?.name || 'Student'}'s {selectedSubmission.level} test</p>
                                </div>
                                <button
                                    onClick={handleCloseModal}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <FiX className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-4 space-y-8 custom-scrollbar">
                                {loadingDetails ? (
                                    <div className="py-20 text-center animate-pulse text-blue-600 font-bold">Loading full analytics...</div>
                                ) : submissionDetails ? (
                                    <>
                                        {/* Performance Section */}
                                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8 rounded-2xl shadow-lg text-white flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-bold uppercase tracking-widest text-blue-100 mb-1">Total Score</p>
                                                <h4 className="text-5xl font-black">
                                                    {selectedSubmission.raw_score}/{selectedSubmission.total_questions}
                                                    <span className="text-2xl ml-2 opacity-80">
                                                        ({Math.round(selectedSubmission.raw_score_percentage || 0)}%)
                                                    </span>
                                                </h4>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-blue-100 uppercase tracking-widest mb-1">Test Level</p>
                                                <span className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-xl font-bold capitalize">
                                                    {selectedSubmission.level || 'Standard'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Accuracy Cards */}
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

                                        {/* Review Tabs */}
                                        <div className="space-y-4">
                                            <div className="flex gap-4 border-b dark:border-gray-700">
                                                <button
                                                    onClick={() => setActiveTab('incorrect')}
                                                    className={`px-4 py-2 text-sm font-bold transition-all relative ${activeTab === 'incorrect' ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}
                                                >
                                                    Incorrect ({submissionDetails.incorrect_responses?.length || 0})
                                                    {activeTab === 'incorrect' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab('correct')}
                                                    className={`px-4 py-2 text-sm font-bold transition-all relative ${activeTab === 'correct' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}
                                                >
                                                    Correct ({submissionDetails.correct_responses?.length || 0})
                                                    {activeTab === 'correct' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />}
                                                </button>
                                            </div>

                                            <div className="space-y-3">
                                                {(activeTab === 'incorrect' ? submissionDetails.incorrect_responses : submissionDetails.correct_responses)?.length > 0 ? (
                                                    (activeTab === 'incorrect' ? submissionDetails.incorrect_responses : submissionDetails.correct_responses).map((resp, i) => (
                                                        <div key={i} className={`p-4 rounded-xl border ${activeTab === 'incorrect' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'}`}>
                                                            <div className="flex gap-3">
                                                                <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 ${activeTab === 'incorrect' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                                    {i + 1}
                                                                </span>
                                                                <div className="space-y-3 flex-1 overflow-hidden">
                                                                    <div className="text-sm text-gray-800 dark:text-gray-200">
                                                                        <MathRenderer text={resp.question_text} />
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                                                                            <p className="text-gray-400 mb-1">Student:</p>
                                                                            <p className={`font-bold ${activeTab === 'incorrect' ? 'text-red-600' : 'text-green-600'}`}>{resp.selected_answer}</p>
                                                                        </div>
                                                                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                                                                            <p className="text-gray-400 mb-1">Correct:</p>
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
                                                    ))
                                                ) : (
                                                    <p className="py-8 text-center text-gray-500 italic text-sm bg-gray-50 dark:bg-gray-900/30 rounded-xl">
                                                        {activeTab === 'incorrect' ? 'Perfect score! No incorrect answers.' : 'No correct answers found.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-20 text-center text-red-500 font-bold">Failed to load details.</div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                <button
                                    onClick={handleCloseModal}
                                    className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all"
                                >
                                    Close Analysis
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TutorGrades;
