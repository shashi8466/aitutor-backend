import React, { useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import PdfExportWrapper from './PdfExportWrapper';
import { tutorService, adminService, parentService } from '../../services/api';

const { FiArrowLeft, FiClock, FiCheckCircle, FiXCircle, FiBook, FiChevronRight } = FiIcons;

const CourseLevelView = ({ groupId, student, courseName, adminMode, parentMode, onBack, onDomainSelect, onTopicSelect }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const service = parentMode ? parentService : (adminMode ? adminService : tutorService);

    useEffect(() => {
        loadData();
    }, [courseName]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = parentMode
                ? await service.getCourseAnalytics(student.id, courseName)
                : await service.getCourseAnalytics(groupId, student.id, courseName);
            setData(res.data);
        } catch (err) {
            console.error('Error loading course analytics', err);
            setError('Failed to load course analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );
    if (error) return <div className="text-red-500 font-bold p-4">{error}</div>;
    if (!data || !data.overview) return null;

    const { overview, domains = [], topics = [] } = data;
    const domainList = domains.length > 0 ? domains : topics;

    const handleSelect = (item) => {
        if (onDomainSelect) onDomainSelect(item);
        else if (onTopicSelect) onTopicSelect(item);
    };

    // SAT Specific Layout Detection
    const isSAT = courseName.toUpperCase().includes('SAT');
    const isACT = courseName.toUpperCase().includes('ACT');

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
                            {courseName} <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Course Report</span>
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">{student.name} • {overview.testsCompleted} completed assessments</p>
                    </div>
                </div>
                <div>
                    <PdfExportWrapper 
                        type="Course" 
                        data={{ overview, topics: domainList, student }} 
                        groupName={courseName}
                        filename={`${student.name.replace(/\s+/g, '_')}_${courseName.replace(/\s+/g, '_')}_Report`}
                        buttonText={`Download ${isSAT ? 'SAT' : isACT ? 'ACT' : ''} PDF`}
                    />
                </div>
            </div>

            {/* Standard Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><SafeIcon icon={FiBook} className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold">Average Score</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{overview.averageScore || 0}%</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-full"><SafeIcon icon={FiCheckCircle} className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold">Correct</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{overview.correct || 0}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-full"><SafeIcon icon={FiXCircle} className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold">Incorrect</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overview.incorrect || 0}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><SafeIcon icon={FiClock} className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold">Time Spent</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{Math.floor((overview.totalTime || 0) / 60)}m</p>
                    </div>
                </div>
            </div>

            {/* Assigned Domains List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assigned Domains for {courseName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Select a domain to view assigned subtopics.</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                        {domainList.length} Domains Assigned
                    </span>
                </div>
                
                {domainList.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No domains assigned to this group yet.</div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {domainList.map(domain => (
                            <div 
                                key={domain.name} 
                                onClick={() => handleSelect(domain)}
                                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors group flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="flex-1">
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {domain.name}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                                        {domain.subtopicsCount !== undefined && (
                                            <span>Subtopics: <strong className="text-blue-600 dark:text-blue-400">{domain.subtopicsCount} Assigned</strong></span>
                                        )}
                                        <span>Attempts: <strong>{domain.attemptsCount || domain.attempts?.length || 0}</strong></span>
                                        <span>Questions: <strong>{domain.totalQ || 0}</strong></span>
                                        <span>Accuracy: <strong className={domain.accuracy >= 70 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{domain.accuracy || 0}%</strong></span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Average</p>
                                        <p className="text-xl font-extrabold text-gray-900 dark:text-white">{domain.averageScore || 0}%</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                                        View Subtopics <SafeIcon icon={FiChevronRight} className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseLevelView;
