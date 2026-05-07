import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { drillGenerator } from '../../services/drillGenerator';
import { useAuth } from '../../contexts/AuthContext';

const { FiTarget, FiClock, FiAward, FiTrendingUp, FiBook, FiAlertTriangle, FiPlay, FiCheckCircle, FiXCircle, FiLoader, FiRefreshCw } = FiIcons;

const WeaknessDrill = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [drills, setDrills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [globalStats, setGlobalStats] = useState(null);
    const [selectedDrill, setSelectedDrill] = useState(null);
    const [drillStarted, setDrillStarted] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [questionStartTime, setQuestionStartTime] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [drillResults, setDrillResults] = useState(null);

    useEffect(() => {
        if (user) loadDrills();
    }, [user]);

    useEffect(() => {
        let timer;
        if (drillStarted && timeRemaining > 0 && !showResults) {
            timer = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        completeDrill();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [drillStarted, timeRemaining, showResults]);

    const loadDrills = async () => {
        try {
            setLoading(true);
            const userDrills = await drillGenerator.getUserDrills(user.id);
            setDrills(userDrills);
            
            // Try to load any existing global analysis from drills metadata or a separate endpoint
            if (userDrills.length > 0 && userDrills[0].metadata?.basedOnAnalysis) {
                setGlobalStats(userDrills[0].metadata.basedOnAnalysis);
            }
        } catch (error) {
            console.error('Failed to load drills:', error);
        } finally {
            setLoading(false);
        }
    };

    const runGlobalAnalysis = async () => {
        try {
            setAnalyzing(true);
            const response = await fetch('/api/grading/weakness-analysis/global', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ courseId: 1 }) // Default course or from context
            });
            
            const data = await response.json();
            if (data.success) {
                setGlobalStats(data.analysis);
                loadDrills();
            }
        } catch (error) {
            console.error('Failed to run global analysis:', error);
        } finally {
            setAnalyzing(false);
        }
    };

    const startDrill = async (drill) => {
        try {
            const drillDetails = await drillGenerator.getDrillDetails(drill.id);
            if (drillDetails) {
                setSelectedDrill(drillDetails);
                setDrillStarted(true);
                setCurrentQuestion(0);
                setAnswers(new Array(drillDetails.questions.length).fill(null));
                setTimeRemaining(drillDetails.time_limit * 60);
                setQuestionStartTime(Date.now());
            }
        } catch (error) {
            console.error('Failed to start drill:', error);
        }
    };

    const selectAnswer = (answer) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestion] = answer;
        setAnswers(newAnswers);

        // Auto-advance to next question after a short delay
        setTimeout(() => {
            if (currentQuestion < selectedDrill.questions.length - 1) {
                nextQuestion();
            } else {
                completeDrill();
            }
        }, 500);
    };

    const nextQuestion = () => {
        if (currentQuestion < selectedDrill.questions.length - 1) {
            setCurrentQuestion(prev => prev + 1);
            setQuestionStartTime(Date.now());
        } else {
            completeDrill();
        }
    };

    const completeDrill = async () => {
        try {
            // Calculate results
            const correctCount = answers.filter((answer, index) => {
                const question = selectedDrill.questions[index];
                return answer === question.correct_answer;
            }).length;

            const accuracy = Math.round((correctCount / selectedDrill.questions.length) * 100);
            const timeSpent = selectedDrill.time_limit * 60 - timeRemaining;

            // Prepare responses for saving
            const responses = selectedDrill.questions.map((question, index) => ({
                questionId: question.id,
                selectedAnswer: answers[index],
                isCorrect: answers[index] === question.correct_answer,
                timeSpent: index === currentQuestion ? Date.now() - questionStartTime : 0
            }));

            // Save drill completion
            await drillGenerator.completeDrill(selectedDrill.id, correctCount, timeSpent, responses);

            setDrillResults({
                correctCount,
                totalQuestions: selectedDrill.questions.length,
                accuracy,
                timeSpent,
                responses
            });
            setShowResults(true);
        } catch (error) {
            console.error('Failed to complete drill:', error);
        }
    };

    const resetDrill = () => {
        setSelectedDrill(null);
        setDrillStarted(false);
        setCurrentQuestion(0);
        setAnswers([]);
        setTimeRemaining(0);
        setShowResults(false);
        setDrillResults(null);
        loadDrills(); // Reload drills to update completion status
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getDrillTypeIcon = (type) => {
        switch (type) {
            case 'topic_drill': return FiTarget;
            case 'difficulty_drill': return FiTrendingUp;
            case 'concept_review': return FiBook;
            case 'pace_drill': return FiClock;
            default: return FiAward;
        }
    };

    const getDifficultyColor = (difficulty) => {
        switch (difficulty) {
            case 'Easy': return 'text-green-600 bg-green-50';
            case 'Medium': return 'text-blue-600 bg-blue-50';
            case 'Hard': return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-medium">Loading weakness drills...</p>
                </div>
            </div>
        );
    }

    if (selectedDrill && drillStarted && !showResults) {
        const question = selectedDrill.questions[currentQuestion];
        const Icon = getDrillTypeIcon(selectedDrill.type);

        return (
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedDrill.title}</h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{selectedDrill.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-3 py-1 rounded-lg text-sm font-bold ${getDifficultyColor(selectedDrill.difficulty)}`}>
                            {selectedDrill.difficulty}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
                            <FiClock className="w-4 h-4" />
                            {formatTime(timeRemaining)}
                        </div>
                    </div>
                </div>

                {/* Progress */}
                <div className="mb-6">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Question {currentQuestion + 1} of {selectedDrill.questions.length}</span>
                        <span>{Math.round(((currentQuestion + 1) / selectedDrill.questions.length) * 100)}% Complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((currentQuestion + 1) / selectedDrill.questions.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Question */}
                <motion.div
                    key={currentQuestion}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8"
                >
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 flex-shrink-0">
                            {currentQuestion + 1}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded">
                                    {question.topic || 'General'}
                                </span>
                                {question.difficulty && (
                                    <span className={`px-2 py-1 text-xs font-bold rounded ${getDifficultyColor(question.difficulty)}`}>
                                        {question.difficulty}
                                    </span>
                                )}
                            </div>
                            <div className="text-lg font-medium text-gray-900 dark:text-white leading-relaxed">
                                {question.question}
                            </div>
                        </div>
                    </div>

                    {/* Answer Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {['A', 'B', 'C', 'D'].map((option, index) => {
                            const answerText = question[`option_${option.toLowerCase()}`] || question[`choice_${option.toLowerCase()}`] || `Option ${option}`;
                            const isSelected = answers[currentQuestion] === option;
                            
                            return (
                                <motion.button
                                    key={option}
                                    onClick={() => selectAnswer(option)}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                            isSelected
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                        }`}>
                                            {option}
                                        </div>
                                        <div className="flex-1 text-gray-900 dark:text-white">
                                            {answerText}
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Navigation */}
                <div className="flex justify-between mt-6">
                    <button
                        onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                        disabled={currentQuestion === 0}
                        className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-bold disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={nextQuestion}
                        disabled={!answers[currentQuestion]}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50"
                    >
                        {currentQuestion === selectedDrill.questions.length - 1 ? 'Complete' : 'Next'}
                    </button>
                </div>
            </div>
        );
    }

    if (showResults && drillResults) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8"
                >
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiAward className="w-8 h-8 text-green-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Drill Completed!</h1>
                        <p className="text-gray-600 dark:text-gray-400">Great job on your practice drill</p>
                    </div>

                    {/* Results */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <div className="text-2xl font-bold text-blue-600 mb-1">{drillResults.accuracy}%</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Accuracy</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <div className="text-2xl font-bold text-green-600 mb-1">{drillResults.correctCount}/{drillResults.totalQuestions}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Correct</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                            <div className="text-2xl font-bold text-purple-600 mb-1">{formatTime(drillResults.timeSpent)}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Time Spent</div>
                        </div>
                    </div>

                    {/* Question Review */}
                    <div className="space-y-4 mb-8">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Question Review</h3>
                        {selectedDrill.questions.map((question, index) => {
                            const response = drillResults.responses[index];
                            const isCorrect = response.isCorrect;
                            
                            return (
                                <div key={index} className={`p-4 rounded-xl border-2 ${
                                    isCorrect
                                        ? 'border-green-200 bg-green-50 dark:bg-green-900/20'
                                        : 'border-red-200 bg-red-50 dark:bg-red-900/20'
                                }`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                            isCorrect
                                                ? 'bg-green-500 text-white'
                                                : 'bg-red-500 text-white'
                                        }`}>
                                            {isCorrect ? <FiCheckCircle /> : <FiXCircle />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                                Question {index + 1}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    Your answer: <span className={`font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                                        {response.selectedAnswer || 'Not answered'}
                                                    </span>
                                                </span>
                                                {!isCorrect && (
                                                    <span className="text-gray-600 dark:text-gray-400">
                                                        Correct: <span className="font-bold text-green-600">{question.correct_answer}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={resetDrill}
                            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                        >
                            Back to Drills
                        </button>
                        <button
                            onClick={() => startDrill(selectedDrill)}
                            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold"
                        >
                            Try Again
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <FiTrendingUp className="w-5 h-5 text-purple-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Weakness Drills</h1>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">Personalized practice drills based on cross-test performance patterns</p>
                </div>
                <button
                    onClick={runGlobalAnalysis}
                    disabled={analyzing}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-purple-200"
                >
                    {analyzing ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
                    {analyzing ? 'Analyzing Patterns...' : 'Refresh AI Analysis'}
                </button>
            </div>

            {/* Global Insights Banner */}
            {globalStats && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-6 mb-8 text-white relative overflow-hidden"
                >
                    <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="text-center md:text-left">
                            <p className="text-purple-200 text-xs font-black uppercase tracking-widest mb-1">Tests Analyzed</p>
                            <p className="text-3xl font-black">{globalStats.totalSubmissions || 0}</p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-purple-200 text-xs font-black uppercase tracking-widest mb-1">Total Questions</p>
                            <p className="text-3xl font-black">{globalStats.totalQuestions || 0}</p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-purple-200 text-xs font-black uppercase tracking-widest mb-1">Global Accuracy</p>
                            <p className="text-3xl font-black">{globalStats.averageAccuracy || 0}%</p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-purple-200 text-xs font-black uppercase tracking-widest mb-1">Performance Trend</p>
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                <p className="text-3xl font-black capitalize">{globalStats.trend || 'Stable'}</p>
                                <FiTrendingUp className={`w-6 h-6 ${globalStats.trend === 'declining' ? 'rotate-180 text-red-400' : 'text-green-400'}`} />
                            </div>
                        </div>
                    </div>
                    {/* Background Decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                </motion.div>
            )}

            {drills.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiTarget className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Weakness Drills Available</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Take a test to generate personalized weakness drills
                    </p>
                    <button
                        onClick={() => navigate('/student/practice-tests')}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                    >
                        Take a Test
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {drills.map((drill, index) => {
                        const Icon = getDrillTypeIcon(drill.drill_type);
                        
                        return (
                            <motion.div
                                key={drill.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <Icon className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 dark:text-white">{drill.title}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{drill.subtitle}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{drill.question_count}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Time Limit:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{drill.time_limit} min</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Focus:</span>
                                        <span className={`px-2 py-1 text-xs font-bold rounded ${getDifficultyColor(drill.target_difficulty)}`}>
                                            {drill.target_difficulty}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4">
                                    <p className="text-sm text-blue-800 dark:text-blue-400 font-medium">{drill.purpose}</p>
                                </div>

                                <button
                                    onClick={() => startDrill(drill)}
                                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                                >
                                    <FiPlay className="w-4 h-4" />
                                    Start Drill
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WeaknessDrill;
