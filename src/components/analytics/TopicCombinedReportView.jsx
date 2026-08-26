import React, { useState, useEffect } from 'react';
import CombinedRegularCourseReport from '../common/CombinedRegularCourseReport';
import { tutorService, adminService } from '../../services/api';

/**
 * Thin fetch+render wrapper around the same combined-report data and component TopicLevelView
 * uses ("View Combined Report") - lets the Group Student Report's "Completed Tests" table open
 * a topic's combined report directly, without re-deriving or re-rendering it differently.
 */
const TopicCombinedReportView = ({ groupId, student, courseId, adminMode, onBack }) => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError(null);
        const service = adminMode ? adminService : tutorService;
        service.getTopicReport(groupId, student.id, courseId)
            .then(res => { if (!cancelled) setData(res.data); })
            .catch(err => {
                console.error('Failed to load combined report', err);
                if (!cancelled) setError('Failed to load combined report');
            });
        return () => { cancelled = true; };
    }, [groupId, student.id, courseId, adminMode]);

    if (error) return (
        <div className="p-6 bg-red-900/20 border border-red-800 rounded-2xl text-red-400 font-bold flex items-center justify-between">
            <span>{error}</span>
            <button
                onClick={onBack}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
                Go Back
            </button>
        </div>
    );

    if (!data) return (
        <div className="flex flex-col items-center justify-center h-64 bg-[#0d1322] rounded-2xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-slate-300 font-bold text-sm">Loading Combined Report...</p>
        </div>
    );

    return (
        <CombinedRegularCourseReport
            topicReportData={data}
            studentName={student.name}
            onExit={onBack}
        />
    );
};

export default TopicCombinedReportView;
