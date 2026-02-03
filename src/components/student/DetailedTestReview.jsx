import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { gradingService } from '../../services/api';

const {
    FiArrowLeft, FiCalendar, FiClock, FiBook, FiCheckCircle,
    FiXCircle, FiAlertCircle, FiTrendingUp, FiAward, FiInfo
} = FiIcons;

const DetailedTestReview = () => {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('all'); // all, correct, incorrect
    const [error, setError] = useState('');

    useEffect(() => {
        loadSubmissionDetails();
    }, [submissionId]);

    const loadSubmissionDetails = async () => {
        try {
            setLoading(true);
            const response = await gradingService.getSubmission(submissionId);
            setSubmission(response.data.submission);
        } catch (err) {
            console.error('Error loading submission:', err);
            setError('Failed to load test details');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading test review...</p>
                </div>
            </div>
        );
    }

    if (error || !submission) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                    <div className="flex items-center gap-3">
                        <SafeIcon icon={FiAlertCircle} className="w-6 h-6 text-red-600" />
                        <p className="text-red-600 dark:text-red-400 font-bold">{error || 'Test not found'}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Combine all responses
    const allResponses = [
        ...(submission.incorrect_responses || []).map(r => ({ ...r, is_correct: false })),
        ...(submission.correct_responses || []).map(r => ({ ...r, is_correct: true }))
    ];

    // Filter responses
    const filteredResponses = allResponses.filter(r => {
        if (selectedFilter === 'correct') return r.is_correct;
        if (selectedFilter === 'incorrect') return !r.is_correct;
        return true;
    });

    // Calculate statistics
    const correctCount = submission.correct_responses?.length || submission.correct_questions?.length || 0;
    const incorrectCount = submission.incorrect_responses?.length || submission.incorrect_questions?.length || 0;
    const totalQuestions = allResponses.length || (correctCount + incorrectCount);
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;


    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    <SafeIcon icon={FiArrowLeft} className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Test Review</h1>
                    <p className="text-gray-500 dark:text-gray-400">Detailed question-wise analysis</p>
                </div>
            </div>

            {/* Test Info Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <SafeIcon icon={FiBook} className="w-5 h-5 opacity-80" />
                            <p className="text-blue-100 text-sm font-bold">Subject</p>
                        </div>
                        <p className="text-xl font-bold">{submission.course?.name || 'SAT Test'}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <SafeIcon icon={FiCalendar} className="w-5 h-5 opacity-80" />
                            <p className="text-blue-100 text-sm font-bold">Date & Time</p>
                        </div>
                        <p className="text-xl font-bold">
                            {new Date(submission.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-blue-100">
                            {new Date(submission.created_at).toLocaleTimeString()}
                        </p>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <SafeIcon icon={FiClock} className="w-5 h-5 opacity-80" />
                            <p className="text-blue-100 text-sm font-bold">Duration</p>
                        </div>
                        <p className="text-xl font-bold">
                            {Math.floor((submission.test_duration_seconds || submission.duration || 0) / 60)} min
                        </p>

                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <SafeIcon icon={FiAward} className="w-5 h-5 opacity-80" />
                            <p className="text-blue-100 text-sm font-bold">Score</p>
                        </div>
                        <p className="text-3xl font-bold">{submission.scaled_score || 0}</p>
                        <p className="text-sm text-blue-100">{submission.raw_score_percentage || 0}% Raw</p>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiInfo} className="w-5 h-5 text-gray-400" />
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{totalQuestions}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Total Questions</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiCheckCircle} className="w-5 h-5 text-green-600" />
                        <span className="text-2xl font-bold text-green-600">{correctCount}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Correct Answers</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiXCircle} className="w-5 h-5 text-red-600" />
                        <span className="text-2xl font-bold text-red-600">{incorrectCount}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Incorrect Answers</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiTrendingUp} className="w-5 h-5 text-blue-600" />
                        <span className="text-2xl font-bold text-blue-600">{accuracy}%</span>
                    </div>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Accuracy</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2 flex gap-2">
                <button
                    onClick={() => setSelectedFilter('all')}
                    className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${selectedFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                >
                    All Questions ({totalQuestions})
                </button>
                <button
                    onClick={() => setSelectedFilter('correct')}
                    className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${selectedFilter === 'correct'
                        ? 'bg-green-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                >
                    Correct ({correctCount})
                </button>
                <button
                    onClick={() => setSelectedFilter('incorrect')}
                    className={`flex-1 px-4 py-2 rounded-lg font-bold transition-colors ${selectedFilter === 'incorrect'
                        ? 'bg-red-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                >
                    Incorrect ({incorrectCount})
                </button>
            </div>

            {/* Question-wise Breakdown */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Question-wise Breakdown</h2>

                {filteredResponses.length > 0 ? (
                    filteredResponses.map((response, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-6 ${response.is_correct
                                ? 'border-green-200 dark:border-green-800'
                                : 'border-red-200 dark:border-red-800'
                                }`}
                        >
                            {/* Question Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${response.is_correct
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                            {response.question?.subject || 'General'}
                                        </p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full flex items-center gap-2 ${response.is_correct
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                    }`}>
                                    <SafeIcon icon={response.is_correct ? FiCheckCircle : FiXCircle} className="w-4 h-4" />
                                    <span className="text-sm font-bold">
                                        {response.is_correct ? 'Correct' : 'Incorrect'}
                                    </span>
                                </div>
                            </div>

                            {/* Question Text */}
                            <div className="mb-4">
                                <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">Question:</p>
                                <p className="text-gray-900 dark:text-white font-medium">
                                    {response.question_text || response.question?.question_text || 'Text not available'}
                                </p>

                            </div>

                            {/* Answers */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">Your Answer:</p>
                                    <div className={`p-3 rounded-lg ${response.is_correct
                                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                        }`}>
                                        <p className={`font-bold ${response.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                                            }`}>
                                            {response.selected_answer || 'No answer selected'}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">Correct Answer:</p>
                                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                        <p className="font-bold text-green-700 dark:text-green-400">
                                            {response.question?.correct_answer || response.correct_answer || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Explanation */}
                            {(response.question?.explanation || response.explanation) && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <div className="flex items-start gap-2">
                                        <SafeIcon icon={FiInfo} className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">Explanation:</p>
                                            <p className="text-sm text-blue-800 dark:text-blue-400">
                                                {response.question?.explanation || response.explanation}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <SafeIcon icon={FiInfo} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No questions to display with the selected filter</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DetailedTestReview;
