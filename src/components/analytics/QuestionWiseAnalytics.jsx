import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SafeIcon from '../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiCheckCircle, FiXCircle, FiClock, FiChevronDown, FiChevronUp } = FiIcons;

const QuestionWiseAnalytics = ({ attempt }) => {
    const [expandedQId, setExpandedQId] = useState(null);

    if (!attempt || !attempt.questions || attempt.questions.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                No question data available for this attempt.
            </div>
        );
    }

    return (
        <div className="space-y-4 mt-6">
            <h3 className="text-xl font-bold dark:text-white">Question-Wise Analytics</h3>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Question</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Result</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Student Answer</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Time Taken</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {attempt.questions.map((q, idx) => {
                            const isExpanded = expandedQId === q.questionId;
                            return (
                                <React.Fragment key={q.questionId || idx}>
                                    <tr 
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                        onClick={() => setExpandedQId(isExpanded ? null : q.questionId)}
                                    >
                                        <td className="p-4 font-medium dark:text-gray-200">
                                            Q{idx + 1}
                                            <span className="text-xs ml-2 text-gray-400">ID: {q.questionId}</span>
                                        </td>
                                        <td className="p-4">
                                            {q.isCorrect ? (
                                                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                                                    <SafeIcon icon={FiCheckCircle} /> Correct
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-medium bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
                                                    <SafeIcon icon={FiXCircle} /> Incorrect
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 dark:text-gray-300 font-mono font-bold">
                                            {q.studentAnswer || '--'}
                                        </td>
                                        <td className="p-4 text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
                                            <SafeIcon icon={FiClock} className="w-4 h-4" />
                                            {q.timeTaken}
                                        </td>
                                        <td className="p-4 text-gray-400">
                                            <SafeIcon icon={isExpanded ? FiChevronUp : FiChevronDown} />
                                        </td>
                                    </tr>
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-gray-50 dark:bg-gray-800/80"
                                            >
                                                <td colSpan="5" className="p-4">
                                                    <div className="bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700">
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                            <strong>Note:</strong> Currently, full question text is not fetched automatically to save bandwidth. The student selected <strong>{q.studentAnswer}</strong> which was <strong>{q.isCorrect ? 'Correct' : 'Incorrect'}</strong>.
                                                        </p>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default QuestionWiseAnalytics;
