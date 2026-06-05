import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { gradingService } from '../../services/api';
import AdaptiveResultsDashboard from '../common/AdaptiveResultsDashboard';

const {
    FiArrowLeft, FiCalendar, FiClock, FiBook, FiCheckCircle,
    FiXCircle, FiAlertCircle, FiTrendingUp, FiAward, FiInfo
} = FiIcons;

const formatSectionName = (sec, isACT) => {
    if (!sec) return 'General';
    const s = String(sec).trim().toLowerCase();
    if (isACT) {
        if (s.includes('english')) return 'English';
        if (s.includes('math')) return 'Math';
        if (s.includes('reading')) return 'Reading';
        if (s.includes('science')) return 'Science';
    }
    if (s === 'rw') return 'Reading & Writing';
    return sec.charAt(0).toUpperCase() + sec.slice(1);
};

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
            
            // Check if response has the expected data structure
            if (!response.data || !response.data.submission) {
                if (response.status === 404) {
                    setError('Test submission not found');
                } else {
                    setError('No analysis data available for this test');
                }
                return;
            }
            
            setSubmission(response.data.submission);
        } catch (err) {
            console.error('Error loading submission:', err);
            
            // Handle different error types
            if (err.response?.status === 404) {
                setError('Test submission not found');
            } else if (err.response?.status === 403) {
                setError('You are not authorized to view this test review');
            } else if (err.response?.status === 500) {
                setError('Server error occurred while loading test details');
            } else {
                setError('Failed to load test details. Please try again.');
            }
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
                    <div className="flex items-center gap-3 mb-4">
                        <SafeIcon icon={FiAlertCircle} className="w-6 h-6 text-red-600" />
                        <div>
                            <p className="text-red-600 dark:text-red-400 font-bold text-lg">
                                {error || 'Test not found'}
                            </p>
                            <p className="text-red-500 dark:text-red-400 text-sm mt-1">
                                We couldn't retrieve the detailed question breakdown for this test.
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
                            Refresh Page
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Check if this is an adaptive test
    const isAdaptiveType = submission.course?.tutor_type === 'Full-Length SAT Test' || 
                          submission.is_adaptive || 
                          (submission.level && submission.level.toUpperCase() === 'ADAPTIVE');

    const courseNameVal = submission.course?.name || '';
    const isACTTest = submission.isACT || 
                      String(courseNameVal).toUpperCase().includes('ACT') || 
                      (submission.course?.tutor_type && String(submission.course.tutor_type).toUpperCase().includes('ACT'));

    const courseNameLower = String(courseNameVal).toLowerCase();
    const isACTScience = isACTTest && courseNameLower.includes('science');
    const isACTEnglish = isACTTest && courseNameLower.includes('english');
    const isACTReading = isACTTest && courseNameLower.includes('reading');
    const isACTMath = isACTTest && courseNameLower.includes('math');
    const isACTSingleSubject = isACTScience || isACTEnglish || isACTReading || isACTMath;

    // Compute dynamic report title and scorecard labels
    let reviewTitle = 'Test Review';
    let scoreLabel = 'Total Score';
    if (isACTTest) {
        if (isACTScience) {
            reviewTitle = 'ACT Science Report';
            scoreLabel = 'Science Score';
        } else if (isACTEnglish) {
            reviewTitle = 'ACT English Report';
            scoreLabel = 'English Score';
        } else if (isACTReading) {
            reviewTitle = 'ACT Reading Report';
            scoreLabel = 'Reading Score';
        } else if (isACTMath) {
            reviewTitle = 'ACT Math Report';
            scoreLabel = 'Math Score';
        } else {
            reviewTitle = 'ACT Performance Report';
            scoreLabel = 'ACT Composite Score';
        }
    } else if (submission.scaled_score || (typeof submission.metadata === 'string' ? JSON.parse(submission.metadata) : submission.metadata)?.totalScore) {
        scoreLabel = 'SAT Score';
    }

    const performanceLabel = isACTSingleSubject ? (
        isACTScience ? 'Science Performance' :
        isACTEnglish ? 'English Performance' :
        isACTReading ? 'Reading Performance' :
        'Math Performance'
    ) : 'Performance Level';

    const questionAnalysisLabel = isACTSingleSubject ? (
        isACTScience ? 'Science Question Analysis' :
        isACTEnglish ? 'English Question Analysis' :
        isACTReading ? 'Reading Question Analysis' :
        'Math Question Analysis'
    ) : 'Question-wise Breakdown';

    const forceACTSection = isACTSingleSubject ? (
        isACTScience ? 'science' :
        isACTEnglish ? 'english' :
        isACTReading ? 'reading' :
        'math'
    ) : null;

    // Combine all responses
    const allResponses = [
        ...(submission.responses || []),
        ...(submission.incorrect_responses || []).map(r => ({ ...r, is_correct: false })),
        ...(submission.correct_responses || []).map(r => ({ ...r, is_correct: true }))
    ];

    // Filter duplicates (some backends might provide both)
    // Use question.id as the definitive key to ensure one card per question
    const uniqueResponses = Array.from(new Map(allResponses.map(item => {
        const qId = item.question?.id || item.question_id || item.id;
        return [String(qId), item];
    })).values());

    // Filter responses
    const filteredResponses = uniqueResponses.filter(r => {
        if (selectedFilter === 'correct') return r.is_correct;
        if (selectedFilter === 'incorrect') return !r.is_correct;
        return true;
    });

    // Calculate statistics
    const meta = typeof submission.metadata === 'string' ? JSON.parse(submission.metadata) : (submission.metadata || {});
    const correctCount = submission.correct_responses?.length || submission.raw_score || meta?.totalCorrect || 0;
    const totalQuestions = submission.total_questions || uniqueResponses.length || 0;
    const incorrectCount = totalQuestions - correctCount;
    const accuracy = submission.raw_score_percentage || (totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0);
    const scaledScore = submission.scaled_score || meta?.totalScore || null;


    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 sm:px-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-100 dark:border-gray-700"
                    >
                        <SafeIcon icon={FiArrowLeft} className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">{reviewTitle}</h1>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Detailed question-wise analysis</p>
                    </div>
                </div>
            </div>

            {/* Test Info Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 sm:p-8 text-white shadow-lg mx-4 sm:mx-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
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
                    <div className="sm:border-l sm:border-white/20 sm:pl-6 md:border-none md:pl-0">
                        <div className="flex items-center gap-2 mb-2">
                            <SafeIcon icon={FiClock} className="w-5 h-5 opacity-80" />
                            <p className="text-blue-100 text-sm font-bold">Duration</p>
                        </div>
                        <p className="text-xl font-bold">
                            {Math.floor((submission.test_duration_seconds || submission.duration || 0) / 60)} min
                        </p>
                    </div>
                    <div className="sm:border-l sm:border-white/20 sm:pl-6 col-span-1 sm:col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2 mb-2">
                            <SafeIcon icon={FiAward} className="w-5 h-5 opacity-80" />
                            <p className="text-blue-100 text-sm font-bold">
                                {scoreLabel}
                            </p>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black">
                            {scaledScore || `${correctCount}/${totalQuestions}`}
                            {scaledScore ? (
                                <span className="text-lg sm:text-xl ml-2 opacity-80">
                                    ({correctCount}/{totalQuestions})
                                </span>
                            ) : (
                                <span className="text-lg sm:text-xl ml-2 opacity-80">
                                    ({accuracy}%)
                                </span>
                            )}
                        </p>
                        <p className="text-[10px] text-blue-100 font-bold uppercase tracking-wider mt-1">
                            Performance Level: {submission.level || 'Standard'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mx-4 sm:mx-0">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2 mx-4 sm:mx-0">
                <button
                    onClick={() => setSelectedFilter('all')}
                    className={`px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${selectedFilter === 'all'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none translate-y-[-1px]'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                >
                    All ({totalQuestions})
                </button>
                <button
                    onClick={() => setSelectedFilter('correct')}
                    className={`px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${selectedFilter === 'correct'
                        ? 'bg-green-600 text-white shadow-md shadow-green-200 dark:shadow-none translate-y-[-1px]'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                >
                    Correct ({correctCount})
                </button>
                <button
                    onClick={() => setSelectedFilter('incorrect')}
                    className={`px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${selectedFilter === 'incorrect'
                        ? 'bg-red-600 text-white shadow-md shadow-red-200 dark:shadow-none translate-y-[-1px]'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                >
                    Incorrect ({incorrectCount})
                </button>
            </div>

            {/* Question-wise Breakdown */}
            <div className="space-y-4 mx-4 sm:mx-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white px-1">{questionAnalysisLabel}</h2>

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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-base sm:text-lg ${response.is_correct
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-red-100 text-red-600'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                                            <p className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-gray-400 truncate max-w-[120px] sm:max-w-none">
                                                {formatSectionName(forceACTSection || response.section || response.question?.section || 'General', isACTTest)}
                                            </p>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></span>
                                            <p className="text-[9px] sm:text-xs font-bold text-blue-600 truncate flex-1">
                                                {response.topic || response.question?.topic || 'General Topic'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-black uppercase tracking-wider ${
                                                String(response.difficulty || response.question?.difficulty).toLowerCase().includes('hard') ? 'bg-red-50 text-red-600' :
                                                String(response.difficulty || response.question?.difficulty).toLowerCase().includes('easy') ? 'bg-green-50 text-green-600' :
                                                'bg-blue-50 text-blue-600'
                                            }`}>
                                                {response.difficulty || response.question?.difficulty || 'Medium'}
                                            </span>
                                            {response.time_spent > 0 && (
                                                <span className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 font-bold whitespace-nowrap">
                                                    <SafeIcon icon={FiClock} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                    {response.time_spent}s
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2 self-start sm:self-center flex-shrink-0 ${response.is_correct
                                    ? 'bg-green-600 text-white shadow-md sm:shadow-lg shadow-green-200'
                                    : 'bg-red-600 text-white shadow-md sm:shadow-lg shadow-red-200'
                                    }`}>
                                    <SafeIcon icon={response.is_correct ? FiCheckCircle : FiXCircle} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="text-[10px] sm:text-sm font-black uppercase tracking-widest whitespace-nowrap">
                                        {response.is_correct ? 'Correct' : 'Incorrect'}
                                    </span>
                                </div>
                            </div>

                            <div className={response.question?.passage ? "flex flex-col lg:flex-row gap-8 items-start" : ""}>
                                {/* Left Panel: Passage */}
                                {response.question?.passage && (
                                    <div className="w-full lg:w-1/2 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm overflow-y-auto max-h-[70vh] custom-scrollbar lg:sticky lg:top-4">
                                        <MathRenderer text={response.question.passage} />
                                    </div>
                                )}

                                {/* Right Panel: Rest of the question block */}
                                <div className={`w-full flex-col ${response.question?.passage ? "lg:w-1/2" : ""}`}>
                                    {/* Question Text */}
                                    <div className="mb-6 space-y-4">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Question:</p>
                                            <div className="text-gray-900 font-medium text-lg leading-relaxed">
                                                <MathRenderer text={response.question_text || response.question?.question || response.question?.question_text || 'Text not available'} />
                                            </div>
                                        </div>
                                    </div>

                            {/* Answers */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">Your Answer:</p>
                                    <div className={`p-3 rounded-lg ${response.is_correct
                                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                        }`}>
                                        <div className={`font-bold ${response.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                                            }`}>
                                            <MathRenderer text={response.selected_answer || 'No answer selected'} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2">Correct Answer:</p>
                                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                        <div className="font-bold text-green-700 dark:text-green-400">
                                            <MathRenderer text={response.question?.correct_answer || response.correct_answer || 'N/A'} />
                                        </div>
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
                                            <div className="text-sm text-blue-800 dark:text-blue-400">
                                                <MathRenderer text={response.question?.explanation || response.explanation} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    // Enhanced fallback for Full Length Tests without detailed responses
                    totalQuestions === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <SafeIcon icon={FiAward} className="w-8 h-8 text-blue-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Score-Based Review
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                                    This Full Length Test has a score but no detailed question breakdown. Here's your performance analysis.
                                </p>
                            </div>
                            
                            {/* Score Display */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white text-center mb-6">
                                <div className="text-4xl font-black mb-2">
                                    {submission.scaled_score || submission.totalScore || submission.score || 'N/A'}
                                </div>
                                <div className="text-sm opacity-80">
                                    {isACTTest ? scoreLabel : submission.course?.tutor_type === 'Full-Length SAT Test' ? 'SAT Score' : 'Test Score'}
                                </div>
                            </div>
                            
                            {/* Performance Insights */}
                            <div className="grid md:grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2">{performanceLabel}</h4>
                                    <p className="text-blue-800 dark:text-blue-400 text-sm">
                                        {(() => {
                                            const score = parseInt(submission.scaled_score || submission.totalScore || submission.score || 0);
                                            if (submission.course?.tutor_type === 'Full-Length SAT Test') {
                                                if (score >= 1400) return 'Excellent - Top 5%';
                                                if (score >= 1200) return 'Good - Top 25%';
                                                if (score >= 1000) return 'Average - Middle 50%';
                                                if (score >= 800) return 'Below Average - Bottom 25%';
                                                return 'Needs Improvement';
                                            } else {
                                                if (score >= 90) return 'Excellent';
                                                if (score >= 80) return 'Good';
                                                if (score >= 70) return 'Average';
                                                if (score >= 60) return 'Below Average';
                                                return 'Needs Improvement';
                                            }
                                        })()}
                                    </p>
                                </div>
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                                    <h4 className="font-bold text-green-900 dark:text-green-300 mb-2">Next Steps</h4>
                                    <p className="text-green-800 dark:text-green-400 text-sm">
                                        {(() => {
                                            const score = parseInt(submission.scaled_score || submission.totalScore || submission.score || 0);
                                            if (submission.course?.tutor_type === 'Full-Length SAT Test') {
                                                if (score < 1200) return 'Focus on fundamentals and consistent practice';
                                                if (score < 1400) return 'Work on advanced topics and time management';
                                                return 'Challenge yourself with harder problems';
                                            } else {
                                                if (score < 70) return 'Review core concepts and practice regularly';
                                                if (score < 85) return 'Focus on weak areas and advanced topics';
                                                return 'Maintain excellence and explore advanced material';
                                            }
                                        })()}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Test Details */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                                <h4 className="font-bold text-gray-900 dark:text-white mb-3">Test Details</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Test Type:</span>
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            {submission.course?.name || 'Full Length Test'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Date:</span>
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            {new Date(submission.test_date || submission.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            {submission.test_duration_seconds ? Math.floor(submission.test_duration_seconds / 60) + ' min' : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Analysis:</span>
                                        <p className="font-bold text-gray-900 dark:text-white">Score-Based Only</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            <SafeIcon icon={FiInfo} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">No questions to display with the selected filter</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default DetailedTestReview;
