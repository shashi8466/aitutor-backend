import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiArrowLeft, FiClock, FiCheckCircle, FiBook, FiChevronRight, FiLayers } = FiIcons;

const DomainLevelView = ({ domain, student, onBack, onTopicSelect }) => {
    if (!domain) return null;

    const subtopics = domain.subtopics || [];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors">
                        <SafeIcon icon={FiArrowLeft} className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                            {domain.name} <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Domain Subtopics</span>
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">{student?.name} • {subtopics.length} Assigned Subtopic Courses</p>
                    </div>
                </div>
            </div>

            {/* Domain Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><SafeIcon icon={FiBook} className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold">Average Score</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{domain.averageScore || 0}%</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-full"><SafeIcon icon={FiCheckCircle} className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold">Accuracy</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{domain.accuracy || 0}%</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><SafeIcon icon={FiLayers} className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold">Questions Attempted</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{domain.totalQ || 0}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><SafeIcon icon={FiClock} className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold">Time Spent</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.floor((domain.totalTime || 0) / 60)}m</p>
                    </div>
                </div>
            </div>

            {/* Assigned Subtopics List Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assigned Subtopics for {domain.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Select a subtopic to view its Easy, Medium, Hard, and Combined Report attempts.</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                        {subtopics.length} Subtopics
                    </span>
                </div>

                {subtopics.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No subtopics assigned to this domain for this group.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase font-black tracking-wider border-b border-gray-200 dark:border-gray-700">
                                    <th className="p-4">Subtopic</th>
                                    <th className="p-4">Attempts</th>
                                    <th className="p-4">Accuracy</th>
                                    <th className="p-4">Questions</th>
                                    <th className="p-4">Last Attempt</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {subtopics.map(st => {
                                    const latestAttempt = st.attempts && st.attempts.length > 0 ? st.attempts[0] : null;
                                    const lastDate = latestAttempt?.date ? new Date(latestAttempt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No attempts';

                                    return (
                                        <tr 
                                            key={st.id || st.name}
                                            onClick={() => onTopicSelect({ ...st, courseId: st.id })}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors group"
                                        >
                                            <td className="p-4 font-bold text-gray-900 dark:text-white capitalize text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                                {st.name}
                                            </td>
                                            <td className="p-4 font-bold text-gray-700 dark:text-gray-300">
                                                {st.attemptsCount || 0}
                                            </td>
                                            <td className="p-4 font-black text-blue-600 dark:text-blue-400">
                                                {st.accuracy || 0}%
                                            </td>
                                            <td className="p-4 text-gray-600 dark:text-gray-400">
                                                {st.totalQ || 0}
                                            </td>
                                            <td className="p-4 text-gray-500 font-medium">
                                                {lastDate}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                                                    View Attempts <SafeIcon icon={FiChevronRight} className="w-4 h-4" />
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
        </div>
    );
};

export default DomainLevelView;
