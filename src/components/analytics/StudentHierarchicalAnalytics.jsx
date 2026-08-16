import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import QuestionWiseAnalytics from './QuestionWiseAnalytics';

const { FiArrowLeft, FiBook, FiCheckCircle, FiXCircle, FiClock, FiChevronRight, FiBarChart2, FiPrinter } = FiIcons;

const StudentHierarchicalAnalytics = ({ student, report, onBack }) => {
    const [selectedCourseIdx, setSelectedCourseIdx] = useState(0);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [selectedAttempt, setSelectedAttempt] = useState(null);

    // Ensure we reset lower levels when higher levels change
    useEffect(() => {
        setSelectedTopic(null);
        setSelectedAttempt(null);
    }, [selectedCourseIdx]);

    useEffect(() => {
        setSelectedAttempt(null);
    }, [selectedTopic]);

    if (!report || !report.courses) {
        return <div className="p-8 text-center text-gray-500">No report data available.</div>;
    }

    const currentCourse = report.courses[selectedCourseIdx];

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-fade-in print:text-black">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                    >
                        <SafeIcon icon={FiArrowLeft} className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                            {student.name} <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Student Report</span>
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400">{student.email}</p>
                    </div>
                </div>
                <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition-colors font-medium"
                >
                    <SafeIcon icon={FiPrinter} /> Download PDF
                </button>
            </div>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 print:hidden overflow-x-auto pb-2">
                <span className="cursor-pointer hover:text-blue-600 font-medium" onClick={() => { setSelectedTopic(null); setSelectedAttempt(null); }}>
                    {currentCourse?.name || 'Course'}
                </span>
                {selectedTopic && (
                    <>
                        <SafeIcon icon={FiChevronRight} className="w-4 h-4 flex-shrink-0" />
                        <span className="cursor-pointer hover:text-blue-600 font-medium whitespace-nowrap" onClick={() => setSelectedAttempt(null)}>
                            {selectedTopic.name}
                        </span>
                    </>
                )}
                {selectedAttempt && (
                    <>
                        <SafeIcon icon={FiChevronRight} className="w-4 h-4 flex-shrink-0" />
                        <span className="text-gray-800 dark:text-gray-200 font-bold whitespace-nowrap">
                            {selectedAttempt.name}
                        </span>
                    </>
                )}
            </div>

            {/* Course Tabs */}
            {!selectedTopic && report.courses.length > 1 && (
                <div className="flex flex-wrap gap-2 print:hidden">
                    {report.courses.map((course, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedCourseIdx(idx)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                selectedCourseIdx === idx 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                            }`}
                        >
                            {course.name}
                        </button>
                    ))}
                </div>
            )}

            {!currentCourse && (
                <div className="p-8 text-center text-gray-500">No content assigned to this group.</div>
            )}

            {/* LEVEL 3: ATTEMPT & QUESTION-WISE */}
            {currentCourse && selectedTopic && selectedAttempt && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Attempt Score</p>
                            <p className="text-2xl font-bold dark:text-white mt-1">{selectedAttempt.score}%</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Correct</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{selectedAttempt.correct} <span className="text-sm text-gray-400 font-normal">/ {selectedAttempt.totalQuestions}</span></p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Incorrect</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{selectedAttempt.incorrect}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Time Spent</p>
                            <p className="text-2xl font-bold dark:text-white mt-1">{Math.floor((selectedAttempt.timeSpent || 0) / 60)}m {(selectedAttempt.timeSpent || 0) % 60}s</p>
                        </div>
                    </div>
                    
                    <QuestionWiseAnalytics attempt={selectedAttempt} />
                </div>
            )}

            {/* LEVEL 2: TOPIC OVERVIEW */}
            {currentCourse && selectedTopic && !selectedAttempt && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold dark:text-white">{selectedTopic.name} - Overall Topic Report</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Overall Accuracy</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{selectedTopic.overall.accuracy}%</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Total Questions</p>
                            <p className="text-2xl font-bold dark:text-white mt-1">{selectedTopic.overall.totalQuestions}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Correct / Incorrect</p>
                            <p className="text-xl font-bold mt-1">
                                <span className="text-green-600">{selectedTopic.overall.correct}</span>
                                <span className="text-gray-300 mx-2">|</span>
                                <span className="text-red-600">{selectedTopic.overall.incorrect}</span>
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Total Time</p>
                            <p className="text-2xl font-bold dark:text-white mt-1">{Math.floor((selectedTopic.overall.timeSpent || 0) / 60)}m {(selectedTopic.overall.timeSpent || 0) % 60}s</p>
                        </div>
                    </div>

                    <h4 className="text-lg font-bold dark:text-white mt-8 mb-4">Attempt History</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedTopic.attempts.map((attempt, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedAttempt(attempt)}
                                className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition-all group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h5 className="font-bold dark:text-white group-hover:text-blue-600 transition-colors">{attempt.name}</h5>
                                        <p className="text-sm text-gray-500">{new Date(attempt.date).toLocaleDateString()}</p>
                                    </div>
                                    <div className={`px-2 py-1 rounded-full text-xs font-bold ${attempt.score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : attempt.score >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                        {attempt.score}%
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                    <span className="flex items-center gap-1"><SafeIcon icon={FiCheckCircle} className="text-green-500" /> {attempt.correct}</span>
                                    <span className="flex items-center gap-1"><SafeIcon icon={FiXCircle} className="text-red-500" /> {attempt.incorrect}</span>
                                    <span className="flex items-center gap-1"><SafeIcon icon={FiClock} /> {Math.floor((attempt.timeSpent||0)/60)}m</span>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                                    View Question Analysis <SafeIcon icon={FiChevronRight} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* LEVEL 1: COURSE OVERVIEW */}
            {currentCourse && !selectedTopic && !selectedAttempt && (
                <div className="space-y-8">
                    {/* Course Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-2xl shadow-lg">
                            <p className="text-blue-100 text-sm font-medium">Overall Accuracy</p>
                            <p className="text-3xl font-bold mt-2">{currentCourse.overall.accuracy}%</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Total Questions</p>
                            <p className="text-3xl font-bold dark:text-white mt-2">{currentCourse.overall.totalQuestions}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Correct</p>
                            <p className="text-3xl font-bold text-green-500 mt-2">{currentCourse.overall.correct}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Incorrect</p>
                            <p className="text-3xl font-bold text-red-500 mt-2">{currentCourse.overall.incorrect}</p>
                        </div>
                    </div>

                    {/* Topic Performance List */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                                <SafeIcon icon={FiBarChart2} className="text-blue-500" /> Topic Performance
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {currentCourse.topics.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No topic data available for this course.</div>
                            ) : (
                                currentCourse.topics.map((topic, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setSelectedTopic(topic)}
                                        className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
                                    >
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">{topic.subCategory}</p>
                                            <h4 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{topic.name}</h4>
                                            <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                                                <span>Attempts: <strong>{topic.attempts.length}</strong></span>
                                                <span>Questions: <strong>{topic.overall.totalQuestions}</strong></span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-sm text-gray-500 dark:text-gray-400">Accuracy</p>
                                                <p className={`text-xl font-bold ${topic.overall.accuracy >= 80 ? 'text-green-500' : topic.overall.accuracy >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                    {topic.overall.accuracy}%
                                                </p>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <SafeIcon icon={FiChevronRight} />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Global Print Styles injected securely */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body * { visibility: hidden; }
                    .print\\:text-black * { color: black !important; }
                    .animate-fade-in { animation: none !important; }
                    .shadow-sm, .shadow-lg { box-shadow: none !important; }
                    .bg-white { background-color: transparent !important; }
                    .border { border: 1px solid #ddd !important; }
                    .animate-fade-in, .animate-fade-in * { visibility: visible; }
                    .animate-fade-in { position: absolute; left: 0; top: 0; width: 100%; }
                    .print\\:hidden { display: none !important; }
                }
            `}} />
        </div>
    );
};

export default StudentHierarchicalAnalytics;
