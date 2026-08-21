import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { gradingService } from '../../services/api';
import AdaptiveResultsDashboard from './AdaptiveResultsDashboard';
import * as FiIcons from 'react-icons/fi';

const FullTestReport = ({ adminMode = false }) => {
    const { submissionId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const autoDownload = searchParams.get('download') === 'true';

    useEffect(() => {
        loadSubmission();
    }, [submissionId]);

    const loadSubmission = async () => {
        try {
            setLoading(true);
            const response = await gradingService.getSubmission(submissionId);
            if (!response.data || (!response.data.submission && !response.data.id)) {
                setError('Test submission not found');
                return;
            }
            const subData = response.data.submission || response.data;
            setSubmission(subData);
        } catch (err) {
            console.error('Error loading submission:', err);
            setError('Failed to load test report.');
        } finally {
            setLoading(false);
        }
    };

    // If autoDownload is true, trigger print once data is ready
    useEffect(() => {
        if (submission && autoDownload) {
            // Slight delay to ensure the dashboard has finished rendering its charts/components
            const timer = setTimeout(() => {
                window.print();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [submission, autoDownload]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600 font-medium text-lg">Loading complete test report...</p>
                </div>
            </div>
        );
    }

    if (error || !submission) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 p-6">
                <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiIcons.FiAlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{error || 'Report not found'}</h3>
                    <p className="text-gray-500 mb-6">We couldn't retrieve the requested test report. Please check the URL or try again later.</p>
                    <button 
                        onClick={() => navigate(-1)}
                        className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-bold transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Full-Length Test Practice Quiz reports arrive here with practiceReturn state (see
    // QuizInterface.jsx) so Back restores the "Keep Practicing" completion popup instead of
    // a plain history pop, which would otherwise land on a fresh, restarted practice quiz.
    // Every other caller (official test reports, tutor/admin, demo) has no such state and
    // keeps the original navigate(-1) behavior unchanged.
    const handleExit = () => {
        const practiceReturn = location.state?.practiceReturn;
        if (practiceReturn?.url) {
            navigate(practiceReturn.url, { state: { restoreResult: practiceReturn.res } });
        } else {
            navigate(-1);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 relative">
            <AdaptiveResultsDashboard
                submission={submission}
                onExit={handleExit}
                adminMode={adminMode}
            />
        </div>
    );
};

export default FullTestReport;
