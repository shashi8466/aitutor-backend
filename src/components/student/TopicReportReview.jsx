import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { gradingService } from '../../services/api';
import CombinedRegularCourseReport from '../common/CombinedRegularCourseReport';
import { useAuth } from '../../contexts/AuthContext';

const { FiArrowLeft, FiAlertCircle } = FiIcons;

const TopicReportReview = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [topicReportData, setTopicReportData] = useState(null);

    useEffect(() => {
        loadTopicData();
    }, [courseId]);

    const loadTopicData = async () => {
        try {
            setLoading(true);
            const response = await gradingService.getTopicReport(courseId);
            const data = response.data;

            if (!data || !data.overall) {
                setError('No combined report data found for this topic.');
                return;
            }

            setTopicReportData(data);
            
        } catch (err) {
            console.error('Error fetching topic report:', err);
            setError('Failed to load topic report.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#0d1322]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-slate-300 font-bold">Generating SAT Regular Course Combined Report...</p>
                </div>
            </div>
        );
    }

    if (error || !topicReportData) {
        return (
            <div className="max-w-4xl mx-auto p-6 mt-10">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <SafeIcon icon={FiAlertCircle} className="w-6 h-6 text-red-600" />
                        <div>
                            <p className="text-red-600 dark:text-red-400 font-bold text-lg">{error || 'Report not found'}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/student/courses')}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold shadow-sm"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <CombinedRegularCourseReport
            topicReportData={topicReportData}
            studentName={user?.name || user?.user_metadata?.name || topicReportData?.studentName}
            onExit={() => navigate('/student/courses')}
        />
    );
};

export default TopicReportReview;
