import React, { useMemo, useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';

const AdaptiveResultsDashboard = ({ submission, onExit }) => {
    // --- DATA AGGREGATION ---
    const allResponses = useMemo(() => {
        if (!submission) return [];
        let res = [];

        // 1. Try to find responses in various possible locations
        let rawMetadata = {};
        try {
            rawMetadata = typeof submission.metadata === 'string' ? JSON.parse(submission.metadata) : (submission.metadata || {});
        } catch (e) {
            console.error("Failed to parse submission metadata:", e);
        }

        // Enhanced debugging - log what we're checking
        console.log('🔍 [AdaptiveDashboard] Checking for responses in submission:', submission.id);
        console.log('🔍 [AdaptiveDashboard] Direct responses:', submission.responses?.length || 0);
        console.log('🔍 [AdaptiveDashboard] Metadata responses:', rawMetadata.responses?.length || 0);
        console.log('🔍 [AdaptiveDashboard] Incorrect responses:', submission.incorrect_responses?.length || 0);
        console.log('🔍 [AdaptiveDashboard] Correct responses:', submission.correct_responses?.length || 0);
        console.log('🔍 [AdaptiveDashboard] Metadata incorrect:', rawMetadata.incorrect_responses?.length || 0);
        console.log('🔍 [AdaptiveDashboard] Metadata correct:', rawMetadata.correct_responses?.length || 0);
        console.log('🔍 [AdaptiveDashboard] Incorrect questions:', submission.incorrect_questions?.length || 0);
        console.log('🔍 [AdaptiveDashboard] Correct questions:', submission.correct_questions?.length || 0);
        console.log('🔍 [AdaptiveDashboard] Raw metadata keys:', Object.keys(rawMetadata));
        
        if (submission.responses && Array.isArray(submission.responses) && submission.responses.length > 0) {
            console.log('✅ [AdaptiveDashboard] Using direct responses');
            res = submission.responses;
        } else if (rawMetadata && rawMetadata.responses && Array.isArray(rawMetadata.responses) && rawMetadata.responses.length > 0) {
            console.log('✅ [AdaptiveDashboard] Using metadata responses');
            res = rawMetadata.responses;
        } else if ((submission.incorrect_responses && submission.incorrect_responses.length > 0) || 
                   (submission.correct_responses && submission.correct_responses.length > 0)) {
            console.log('✅ [AdaptiveDashboard] Using split responses');
            res = [
                ...(submission.incorrect_responses || []).map(r => ({ ...r, is_correct: r.is_correct ?? false })),
                ...(submission.correct_responses || []).map(r => ({ ...r, is_correct: r.is_correct ?? true }))
            ];
        } else if (rawMetadata && (rawMetadata.incorrect_responses || rawMetadata.correct_responses)) {
            console.log('✅ [AdaptiveDashboard] Using metadata split responses');
            res = [
                ...(rawMetadata.incorrect_responses || []).map(r => ({ ...r, is_correct: false })),
                ...(rawMetadata.correct_responses || []).map(r => ({ ...r, is_correct: true }))
            ];
        } else if ((submission.incorrect_questions && submission.incorrect_questions.length > 0) || 
                   (submission.correct_questions && submission.correct_questions.length > 0)) {
            console.log('✅ [AdaptiveDashboard] Using question IDs only');
            // Last resort: we have IDs but no detailed response objects yet
            res = [
                ...(submission.incorrect_questions || []).map(id => ({ id, is_correct: false, is_id_only: true })),
                ...(submission.correct_questions || []).map(id => ({ id, is_correct: true, is_id_only: true }))
            ];
        } else {
            console.log('❌ [AdaptiveDashboard] No response data found in any location');
        }
        
        // 2. Normalize response format
        if (!Array.isArray(res)) {
            console.warn("res is not an array:", res);
            res = [];
        }

        return res.map(r => {
            if (!r) return null;
            const q = r.question || {};
            const topic = r.topic || q.topic || r.subject || q.subject || 'General';
            const section = r.section || q.section || '';
            
            return {
                ...r,
                section: String(section || (String(topic).toLowerCase().includes('math') ? 'Math' : 'Reading & Writing')).toLowerCase(),
                topic: String(topic),
                is_correct: r.is_correct ?? (r.selected_answer === (r.correct_answer || q.correct_answer)),
                correct_answer: r.correct_answer || q.correct_answer,
                selected_answer: r.selected_answer || (r.is_unattempted ? 'Unattempted' : 'Not recorded')
            };
        }).filter(Boolean);
    }, [submission]);

    const [dataTimeout, setDataTimeout] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            // Always timeout after 5 seconds to prevent infinite loading
            setDataTimeout(true);
        }, 5000); // Reduced to 5 seconds for better UX
        return () => clearTimeout(timer);
    }, [submission, allResponses]);

    // Show loading only for the first 5 seconds
    if (!dataTimeout && (!submission || allResponses.length === 0)) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl shadow-sm mx-4 my-10">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Analyzing Test Data...</h2>
                <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">
                    We're crunching the numbers to give you a detailed performance breakdown. This usually takes just a few seconds.
                </p>
                <div className="flex gap-4">
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all"
                    >
                        Refresh Page
                    </button>
                    <button 
                        onClick={onExit}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // After timeout, check if we have score data but no responses
    if (dataTimeout && (!submission || allResponses.length === 0)) {
        // Check if we have score data to show a summary view
        const hasScoreData = submission?.scaled_score || submission?.totalScore || submission?.score;
        
        if (hasScoreData) {
            // Show comprehensive detailed test review when we have a score but no detailed responses
            const score = parseInt(submission?.scaled_score || submission?.totalScore || submission?.score || 0);
            const testDate = new Date(submission?.test_date || submission?.created_at);
            const courseName = submission?.course?.name || 'Test';
            const isSAT = courseName.toLowerCase().includes('sat') || courseName.toLowerCase().includes('full length');
            
            // Calculate performance level and insights
            const getPerformanceLevel = (score) => {
                if (isSAT) {
                    if (score >= 1400) return { level: 'Excellent', color: 'green', percentile: '95th+' };
                    if (score >= 1200) return { level: 'Good', color: 'blue', percentile: '75th-90th' };
                    if (score >= 1000) return { level: 'Average', color: 'yellow', percentile: '50th-75th' };
                    if (score >= 800) return { level: 'Below Average', color: 'orange', percentile: '25th-50th' };
                    return { level: 'Needs Improvement', color: 'red', percentile: 'Below 25th' };
                } else {
                    if (score >= 90) return { level: 'Excellent', color: 'green', percentile: '90th+' };
                    if (score >= 80) return { level: 'Good', color: 'blue', percentile: '75th-90th' };
                    if (score >= 70) return { level: 'Average', color: 'yellow', percentile: '50th-75th' };
                    if (score >= 60) return { level: 'Below Average', color: 'orange', percentile: '25th-50th' };
                    return { level: 'Needs Improvement', color: 'red', percentile: 'Below 25th' };
                }
            };
            
            const performance = getPerformanceLevel(score);
            const targetScore = isSAT ? 1200 : 80;
            const scoreGap = targetScore - score;
            const needsImprovement = score < targetScore;
            
            return (
                <div className="min-h-screen bg-gray-50 py-8 px-4">
                    <div className="max-w-4xl mx-auto">
                        {/* Header */}
                        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                            <div className="flex justify-between items-center mb-6">
                                <button onClick={onExit} className="flex items-center gap-2 text-gray-600 hover:text-black font-bold">
                                    <FiIcons.FiArrowLeft /> Back to History
                                </button>
                                <div className="font-black text-xl tracking-tighter uppercase tracking-widest">AIPrep365</div>
                                <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold shadow-lg transition-all">
                                    <FiIcons.FiPrinter /> Download PDF
                                </button>
                            </div>
                            
                            {/* Score Overview */}
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-black text-gray-900 mb-2">Detailed Test Review</h1>
                                <p className="text-gray-600">{courseName} • {testDate.toLocaleDateString()}</p>
                            </div>
                            
                            {/* Score Display */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white text-center mb-8">
                                <div className="mb-4">
                                    <span className="text-sm font-bold uppercase tracking-wider opacity-80">Your Score</span>
                                </div>
                                <div className="text-6xl font-black mb-4">{score}</div>
                                <div className="flex justify-center items-center gap-2 mb-6">
                                    <div className={`px-4 py-2 rounded-full text-sm font-bold bg-white/20`}>
                                        Performance: {performance.level}
                                    </div>
                                    <div className={`px-4 py-2 rounded-full text-sm font-bold bg-white/20`}>
                                        {performance.percentile} Percentile
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <div className="opacity-80">Test Date</div>
                                        <div className="font-bold">{testDate.toLocaleDateString()}</div>
                                    </div>
                                    <div>
                                        <div className="opacity-80">Course</div>
                                        <div className="font-bold">{courseName}</div>
                                    </div>
                                    <div>
                                        <div className="opacity-80">Duration</div>
                                        <div className="font-bold">{submission?.test_duration_seconds ? Math.floor(submission.test_duration_seconds / 60) + ' min' : 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div className="opacity-80">Submission ID</div>
                                        <div className="font-bold">#{submission?.id}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Performance Analysis */}
                        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                            <h2 className="text-2xl font-black text-gray-900 mb-6">Performance Analysis</h2>
                            
                            <div className="grid md:grid-cols-2 gap-6 mb-8">
                                {/* Performance Level */}
                                <div className={`p-6 rounded-xl border-2 ${
                                    performance.color === 'green' ? 'border-green-200 bg-green-50' :
                                    performance.color === 'blue' ? 'border-blue-200 bg-blue-50' :
                                    performance.color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                                    performance.color === 'orange' ? 'border-orange-200 bg-orange-50' :
                                    'border-red-200 bg-red-50'
                                }`}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                            performance.color === 'green' ? 'bg-green-600 text-white' :
                                            performance.color === 'blue' ? 'bg-blue-600 text-white' :
                                            performance.color === 'yellow' ? 'bg-yellow-600 text-white' :
                                            performance.color === 'orange' ? 'bg-orange-600 text-white' :
                                            'bg-red-600 text-white'
                                        }`}>
                                            <FiIcons.FiTrendingUp className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg">Performance Level</h3>
                                            <p className={`text-sm ${
                                                performance.color === 'green' ? 'text-green-700' :
                                                performance.color === 'blue' ? 'text-blue-700' :
                                                performance.color === 'yellow' ? 'text-yellow-700' :
                                                performance.color === 'orange' ? 'text-orange-700' :
                                                'text-red-700'
                                            }`}>{performance.level}</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-600">
                                        Your score places you in the {performance.percentile} percentile among test takers. 
                                        {needsImprovement ? ` You're ${scoreGap} points away from the target score of ${targetScore}.` : ' Congratulations on achieving an excellent score!'}
                                    </p>
                                </div>
                                
                                {/* Score Breakdown */}
                                <div className="p-6 rounded-xl border-2 border-gray-200 bg-gray-50">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-gray-600 text-white flex items-center justify-center">
                                            <FiIcons.FiBarChart2 className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg">Score Analysis</h3>
                                            <p className="text-sm text-gray-600">Where you stand</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Your Score</span>
                                            <span className="font-black text-lg">{score}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Target Score</span>
                                            <span className="font-black text-lg">{targetScore}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Difference</span>
                                            <span className={`font-black text-lg ${needsImprovement ? 'text-red-600' : 'text-green-600'}`}>
                                                {needsImprovement ? '-' : '+'}{Math.abs(scoreGap)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Recommendations */}
                            <div className="p-6 rounded-xl border-2 border-blue-200 bg-blue-50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                        <FiIcons.FiZap className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg">Recommendations</h3>
                                        <p className="text-sm text-blue-700">Based on your performance</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {needsImprovement ? (
                                        <>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                                                <div>
                                                    <p className="font-bold text-blue-900">Focus on Fundamentals</p>
                                                    <p className="text-blue-800 text-sm">Your score suggests you need to strengthen core concepts. Start with foundational topics before moving to advanced problems.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                                                <div>
                                                    <p className="font-bold text-blue-900">Consistent Practice</p>
                                                    <p className="text-blue-800 text-sm">Create a study schedule with daily practice sessions. Focus on {scoreGap > 200 ? 'both Math and Reading/Writing sections' : score > (isSAT ? 600 : 40) ? 'Reading/Writing section' : 'Math section'}.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                                                <div>
                                                    <p className="font-bold text-blue-900">Use Study Tools</p>
                                                    <p className="text-blue-800 text-sm">Take advantage of our Study Plan Agent and Weakness Drills to identify and improve your weak areas.</p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                                                <div>
                                                    <p className="font-bold text-green-900">Maintain Excellence</p>
                                                    <p className="text-green-800 text-sm">Continue your current study strategy. You're performing at an advanced level.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                                                <div>
                                                    <p className="font-bold text-green-900">Challenge Yourself</p>
                                                    <p className="text-green-800 text-sm">Try harder difficulty levels and advanced topics to push your score even higher.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                                                <div>
                                                    <p className="font-bold text-green-900">Help Others</p>
                                                    <p className="text-green-800 text-sm">Consider joining study groups or mentoring other students to reinforce your knowledge.</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Next Steps */}
                        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                            <h2 className="text-2xl font-black text-gray-900 mb-6">Next Steps</h2>
                            <div className="grid md:grid-cols-3 gap-4">
                                <button className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                                        <FiIcons.FiCalendar className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1">Schedule Next Test</h3>
                                    <p className="text-sm text-gray-600">Plan your next practice test in 2-3 weeks</p>
                                </button>
                                <button className="p-4 border-2 border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all text-left">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                                        <FiIcons.FiTarget className="w-5 h-5 text-green-600" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1">Study Plan</h3>
                                    <p className="text-sm text-gray-600">Get a personalized study plan based on your score</p>
                                </button>
                                <button className="p-4 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all text-left">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                                        <FiIcons.FiBookOpen className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-1">Review Topics</h3>
                                    <p className="text-sm text-gray-600">Focus on weak areas with targeted practice</p>
                                </button>
                            </div>
                        </div>
                        
                        {/* Technical Details */}
                        <div className="bg-white rounded-2xl shadow-sm p-6">
                            <h2 className="text-xl font-black text-gray-900 mb-4">Technical Details</h2>
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Submission ID:</span>
                                        <span className="font-mono">{submission?.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Test Date:</span>
                                        <span>{testDate.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Course:</span>
                                        <span>{courseName}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Score Type:</span>
                                        <span>Scaled Score</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Responses Available:</span>
                                        <span className="text-amber-600 font-bold">Limited</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Analysis Type:</span>
                                        <span>Score-Based Only</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <p className="text-xs text-amber-800">
                                    <strong>Note:</strong> Detailed question-by-question responses are not available for this test. Analysis is based on overall score performance.
                                </p>
                            </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-4 mt-8">
                            <button 
                                onClick={onExit}
                                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200"
                            >
                                Go Back to History
                            </button>
                            <button 
                                onClick={() => window.location.reload()}
                                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all"
                            >
                                Refresh Analysis
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        // Show error when we have no data at all
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl shadow-sm mx-4 my-10">
                <div className="p-4 bg-red-50 rounded-full mb-6">
                    <FiIcons.FiAlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">No Analysis Data Found</h2>
                <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">
                    We couldn't retrieve the detailed question breakdown for this test. The summary may still be available in your history.
                </p>
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs text-left max-w-md mx-auto mb-6">
                    <p className="font-bold mb-1">Debug Info:</p>
                    <p>Submission ID: {submission?.id || 'N/A'}</p>
                    <p>Responses Found: {allResponses.length}</p>
                    <p>Has metadata: {submission?.metadata ? 'Yes' : 'No'}</p>
                    <p>Direct responses: {submission?.responses?.length || 0}</p>
                    <p>Correct responses: {submission?.correct_responses?.length || 0}</p>
                    <p>Incorrect responses: {submission?.incorrect_responses?.length || 0}</p>
                    <p>Correct questions: {submission?.correct_questions?.length || 0}</p>
                    <p>Incorrect questions: {submission?.incorrect_questions?.length || 0}</p>
                    <p>Scaled Score: {submission?.scaled_score || 'N/A'}</p>
                    <p>Total Score: {submission?.totalScore || 'N/A'}</p>
                    <p>Test Type: {submission?.course?.tutor_type || 'N/A'}</p>
                    <p>Is Adaptive: {submission?.is_adaptive ? 'Yes' : 'No'}</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={onExit}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200"
                    >
                        Go Back to History
                    </button>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Robust score parsing
    const rawMeta = typeof submission.metadata === 'string' ? JSON.parse(submission.metadata) : (submission.metadata || {});
    const scoresData = typeof submission.scores === 'string' ? JSON.parse(submission.scores) : (submission.scores || rawMeta || {});
    
    const rwScore = parseInt(submission.rwScore || submission.rw_score || submission.reading_scaled_score || scoresData.rwScore || scoresData.reading_score || scoresData.rw_score || 200);
    const mathScore = parseInt(submission.mathScore || submission.math_score || submission.math_scaled_score || scoresData.mathScore || scoresData.math_score || scoresData.math_scaled_score || 200);
    const totalScore = parseInt(submission.totalScore || submission.scaled_score || submission.score || scoresData.totalScore || (rwScore + mathScore) || 400);
    
    const studentName = submission.profiles?.name || submission.user?.name || submission.student_name || submission.user_name || 'Student';
    const completedAt = submission.test_date || submission.created_at || new Date();

    const courseNameVal = submission?.course?.name || 
                          submission?.courseName || 
                          submission?.course?.tutor_type || 
                          '';

    const isApCourse = (
        submission?.course?.main_category?.toUpperCase() === 'AP' ||
        String(submission?.course?.tutor_type || '').toUpperCase().startsWith('AP') ||
        String(courseNameVal).toUpperCase().startsWith('AP') ||
        String(courseNameVal).toUpperCase().includes('AP ')
    );

    const isACTTest = submission?.isACT || String(courseNameVal).toUpperCase().includes('ACT');
    const actScores = submission?.actScores || scoresData?.actScores;

    let rwResponses = allResponses.filter(r => r.section.includes('rw') || r.section.includes('read') || r.section.includes('verbal') || r.section.includes('english'));
    let mathResponses = allResponses.filter(r => r.section.includes('math') || r.section.includes('alg') || r.section.includes('geom'));

    if (isApCourse) {
        rwResponses = [...allResponses];
        mathResponses = [];
    }

    const hasRW = rwResponses.length > 0;
    const hasMath = mathResponses.length > 0;
    const isFullLength = hasRW && hasMath;

    const apCourseTitle = courseNameVal ? 
        (courseNameVal.toUpperCase().endsWith('REPORT') ? courseNameVal : `${courseNameVal} Report`) : 
        'AP Course Report';

    let apSectionName = 'AP Section';
    if (isApCourse && allResponses.length > 0) {
        const topicCounts = {};
        allResponses.forEach(r => {
            const t = r.topic || 'General';
            topicCounts[t] = (topicCounts[t] || 0) + 1;
        });
        let maxTopic = 'General';
        let maxCount = 0;
        Object.entries(topicCounts).forEach(([t, count]) => {
            if (count > maxCount) {
                maxCount = count;
                maxTopic = t;
            }
        });
        apSectionName = maxTopic;
    }

    const getTopicMastery = (responses) => {
        const topics = {};
        responses.forEach(r => {
            const tName = r.topic || 'General';
            if (!topics[tName]) topics[tName] = { correct: 0, total: 0 };
            topics[tName].total++;
            if (r.is_correct) topics[tName].correct++;
        });
        return Object.entries(topics).map(([name, data]) => ({
            name,
            ...data,
            accuracy: Math.round((data.correct / data.total) * 100)
        })).sort((a, b) => b.accuracy - a.accuracy);
    };

    const rwTopics = getTopicMastery(rwResponses);
    const mathTopics = getTopicMastery(mathResponses);

    const getTimeStats = (responses) => {
        const total = responses.reduce((acc, r) => acc + (r.time_spent || 0), 0);
        const avg = responses.length > 0 ? Math.round(total / responses.length) : 0;
        return { total, avg };
    };

    const totalTime = getTimeStats(allResponses);
    const rwTime = getTimeStats(rwResponses);
    const mathTime = getTimeStats(mathResponses);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    // --- RENDER HELPERS ---
    const renderCircularProgress = (score, max, size, strokeWidth, color, bgColor = 'rgba(0,0,0,0.1)') => {
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const percentage = Math.min(Math.max(score / max, 0), 1);
        const offset = circumference - percentage * circumference;
        
        return (
            <div className="relative flex items-center justify-center" style={{ width: '100%', maxWidth: size, aspectRatio: '1/1' }}>
                <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 w-full h-full">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={bgColor}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
            </div>
        );
    };

    const renderDotSequence = (correct, total) => {
        const dots = [];
        for (let i = 0; i < total; i++) {
            dots.push(
                <div key={i} className={`w-2 h-2 rounded-full flex-shrink-0 ${i < correct ? 'bg-green-500' : 'bg-red-500'}`}></div>
            );
        }
        return <div className="flex flex-wrap gap-1.5 justify-start items-center w-full">{dots}</div>;
    };

    const renderMasterySection = (title, score, totalQuestions, topics, sectionNum) => {
        const masteredCount = topics.filter(t => t.accuracy >= 80).length;
        const reviewCount = topics.filter(t => t.accuracy >= 50 && t.accuracy < 80).length;
        const instructionCount = topics.filter(t => t.accuracy < 50).length;
        const correctCount = topics.reduce((acc, t) => acc + t.correct, 0);
        
        const totalAccuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

        return (
            <div className="section-break bg-white print:p-0">
                <div className="bg-[#1a237e] text-white p-4 flex justify-between items-center font-black">
                    <h2 className="text-xl">{title}</h2>
                    <span className="text-xs uppercase tracking-widest opacity-80 font-medium">{isFullLength ? `Section ${sectionNum}/2` : 'Section Analysis'}</span>
                </div>
                <div className="bg-gradient-to-br from-[#1a237e] via-[#4527a0] to-[#b71c1c] text-white p-6 sm:p-12 text-center relative overflow-hidden">
                    <div className="mb-10 flex justify-center">
                        <div className="relative">
                            {isApCourse ? (
                                <>
                                    {renderCircularProgress(totalAccuracy, 100, 192, 12, 'white', 'rgba(255,255,255,0.2)')}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Accuracy</span>
                                        <span className="text-4xl sm:text-6xl font-black">{totalAccuracy}%</span>
                                        <span className="text-[10px] font-bold opacity-80">Quiz Completion Progress</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {renderCircularProgress(score, 800, 192, 12, 'white', 'rgba(255,255,255,0.2)')}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Section Score</span>
                                        <span className="text-4xl sm:text-6xl font-black">{score}</span>
                                        <span className="text-[10px] font-bold opacity-80">{correctCount} out of {totalQuestions}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="mt-8">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-8 opacity-80">Knowledge of the Topics</h3>
                        <div className="flex flex-wrap justify-center gap-6 sm:gap-12">
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[4px] border-green-500 flex items-center justify-center text-2xl sm:text-3xl font-black mb-3">{masteredCount}</div>
                                <span className="text-[8px] font-black uppercase leading-tight">Topics<br/>Mastered</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[4px] border-yellow-500 flex items-center justify-center text-2xl sm:text-3xl font-black mb-3">{reviewCount}</div>
                                <span className="text-[8px] font-black uppercase leading-tight">Topics for<br/>Review</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[4px] border-red-500 flex items-center justify-center text-2xl sm:text-3xl font-black mb-3">{instructionCount}</div>
                                <span className="text-[8px] font-black uppercase leading-tight">{isApCourse ? <>Weak<br/>Topics</> : <>Topics for<br/>Instruction</>}</span>
                            </div>
                        </div>
                        <p className="mt-10 text-[10px] font-black opacity-60">Total topics: {topics.length}</p>
                    </div>
                </div>
                <div className="p-4 sm:p-8">
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-6 sm:mb-8">Strengths & Weaknesses</h2>
                    <div className="space-y-4">
                        {topics.map((topic, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b-2 border-gray-100 print:break-inside-avoid gap-4 w-full">
                                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 max-w-full sm:max-w-[40%] min-w-[12rem]">
                                    <div className={`px-2.5 py-1 w-14 flex-shrink-0 rounded flex items-center justify-center text-[10px] font-black text-white shadow-sm ${topic.accuracy >= 80 ? 'bg-green-600' : topic.accuracy >= 50 ? 'bg-yellow-600' : 'bg-red-600'}`}>
                                        {topic.accuracy}%
                                    </div>
                                    <span className="font-black text-[#0a0e2a] whitespace-normal leading-tight break-words">{topic.name}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 flex-1 min-w-0 w-full pl-0 sm:pl-4">
                                    <div className="flex-1 w-full min-w-0 overflow-visible">{renderDotSequence(topic.correct, topic.total)}</div>
                                    <span className="font-black text-[10px] sm:text-xs text-gray-600 whitespace-nowrap min-w-[3.5rem] text-right flex-shrink-0">
                                        {topic.correct} of {topic.total}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderTimeTable = (responses, sectionTitle, totalSec, avgSec) => {
        return (
            <div className="mt-16 print:mt-12 overflow-x-hidden px-4 sm:px-0">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-4">
                    <div>
                        <h3 className="text-2xl sm:text-4xl font-black text-[#0a0e2a] mb-1">{sectionTitle}</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                            {responses.length} questions - Total: {formatTime(totalSec)} - Avg: {avgSec}s/question
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[9px] font-black uppercase text-gray-600 pb-1">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-red-500"></div> SLOW</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-green-500"></div> FAST</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border-2 border-gray-400"></div> NORMAL</div>
                    </div>
                </div>
                
                <div className="rounded-2xl overflow-x-auto border-2 border-[#1a237e] shadow-2xl print:shadow-none custom-scrollbar">
                    <table className="w-full text-left font-bold text-xs border-collapse min-w-[600px]">
                        <thead className="bg-[#1a237e] text-white !text-white uppercase tracking-widest text-[10px]">
                            <tr>
                                <th className="py-5 px-6 text-center w-16 border-r border-white/20">#</th>
                                <th className="py-5 px-6 border-r border-white/20">Topic</th>
                                <th className="py-5 px-6 text-center border-r border-white/20">Your Ans</th>
                                <th className="py-5 px-6 text-center border-r border-white/20">Correct</th>
                                <th className="py-5 px-6 text-center border-r border-white/20">Result</th>
                                <th className="py-5 px-6 text-center border-r border-white/20">Time</th>
                                <th className="py-5 px-6 text-center">Pace</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {responses.map((q, i) => (
                                <tr key={i} className="border-b-2 border-gray-100 print:break-inside-avoid">
                                    <td className="py-4 px-6 text-center text-gray-500 border-r-2 border-gray-50">{i + 1}</td>
                                    <td className="py-4 px-6 font-black text-[#0a0e2a] border-r-2 border-gray-50 whitespace-normal min-w-[200px] leading-tight">{q.topic}</td>
                                    <td className="py-4 px-6 text-center font-black text-[#0a0e2a] border-r-2 border-gray-50">{q.selected_answer || '-'}</td>
                                    <td className="py-4 px-6 text-center font-black text-[#1a237e] border-r-2 border-gray-50">{q.correct_answer}</td>
                                    <td className="py-4 px-3 sm:px-6 text-center border-r-2 border-gray-50">
                                        <div className={`w-6 h-6 mx-auto rounded-full flex items-center justify-center text-white text-[10px] font-black ${q.is_correct ? 'bg-green-600' : 'bg-red-600'}`}>
                                            {q.is_correct ? '✓' : '✗'}
                                        </div>
                                    </td>
                                    <td className="py-4 px-3 sm:px-6 text-center border-r-2 border-gray-50 text-[#0a0e2a] font-bold">{q.time_spent || 0}s</td>
                                    <td className="py-4 px-3 sm:px-6 text-center">
                                        <div className="bg-[#e8eaf6] text-[#1a237e] px-3 py-1 rounded-full text-[8px] font-black uppercase inline-block shadow-sm">NORMAL</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900/90 py-10 px-4 print:p-0 print:bg-white print:overflow-visible print:h-auto transition-colors duration-300" id="report-container">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    html, body, #root, #report-container { 
                        height: auto !important; 
                        overflow: visible !important; 
                        display: block !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        background: white !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* 
                       AGGRESSIVE PRINT CLEANUP 
                       Hides all application UI (headers, sidebars, navs) 
                    */
                    header, 
                    nav, 
                    aside, 
                    footer,
                    [class*="Sidebar"], 
                    [class*="Navbar"],
                    [class*="Header"],
                    [class*="nav"],
                    [class*="menu"],
                    .lg\:hidden,
                    .sticky,
                    div[class*="sticky"] { 
                        display: none !important; 
                        height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                    }
                    
                    /* Reset layout margins from StudentLayout.jsx */
                    .lg\:ml-72, 
                    div.lg\:ml-72,
                    [class*="ml-72"] { 
                        margin-left: 0 !important; 
                    }
                    
                    /* Reset main content area */
                    main, 
                    .flex-1,
                    #root,
                    body,
                    #report-container {
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        display: block !important;
                        overflow: visible !important;
                        background: white !important;
                    }
                    
                    .cover-block { 
                        height: 270mm !important; 
                        max-height: 270mm !important;
                        width: 100% !important;
                        overflow: hidden !important; 
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: center !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-before: avoid !important;
                        break-before: avoid !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        position: relative !important;
                    }
                    .print-hidden { display: none !important; }
                    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
                    table { page-break-inside: auto !important; width: 100% !important; border-collapse: collapse !important; }
                    thead { display: table-header-group !important; }
                    * { box-shadow: none !important; filter: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }

                /* FORCE READABILITY ON SCREEN WHEN IN DARK MODE */
                #report-container [class*="bg-white"],
                #report-container .bg-white,
                #report-container .section-break:not(.bg-\[\#1a237e\]) {
                    color: #0a0e2a !important;
                }
                
                #report-container [class*="bg-white"] td,
                #report-container [class*="bg-white"] p,
                #report-container [class*="bg-white"] span:not(.text-white):not(.bg-blue-600),
                #report-container [class*="bg-white"] div:not(.bg-blue-600):not(.bg-green-600):not(.bg-red-600):not(.bg-\[\#1a237e\]) {
                    color: #0a0e2a !important;
                    opacity: 1 !important;
                }

                /* Ensure table content is strictly high contrast */
                #report-container table tbody td {
                    color: #0a0e2a !important;
                    font-weight: 700 !important;
                }
                
                /* Protect specific colors */
                #report-container .text-white,
                #report-container .bg-\[\#1a237e\] *,
                #report-container thead *,
                #report-container .bg-blue-600 *,
                #report-container .text-yellow-400 {
                    /* Do not override these */
                }

                #report-container .text-gray-400,
                #report-container .text-gray-500,
                #report-container .text-gray-600 {
                    color: #475569 !important; /* Slate 600 - much more readable */
                }

                #report-container table {
                    border-color: #cbd5e1 !important;
                }
            `}} />

            {/* Header Actions */}
            <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print-hidden">
                <button onClick={onExit} className="flex items-center gap-2 text-gray-600 hover:text-black font-bold">
                    <FiIcons.FiArrowLeft /> Back
                </button>
                <div className="font-black text-xl tracking-tighter uppercase tracking-widest">AIPrep365</div>
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold shadow-lg transition-all">
                    <FiIcons.FiPrinter /> Download PDF
                </button>
            </div>

            <div className="max-w-4xl mx-auto print:max-w-none print:w-full print:block">
                
                {/* 1. COVER PAGE */}
                <div className="cover-block relative overflow-hidden bg-[#0a0e2a] text-white">
                    {/* Decorative Background Elements */}
                    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                        {/* Top-left glow */}
                        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                        {/* Bottom-right glow */}
                        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                        
                        {/* Curved overlays (simulating the shapes in the reference) */}
                        <div className="absolute top-0 left-0 w-[60%] h-[60%] border-l-[1px] border-t-[1px] border-white/5 rounded-br-[100%]"></div>
                        <div className="absolute bottom-0 right-0 w-[60%] h-[60%] border-r-[1px] border-b-[1px] border-white/5 rounded-tl-[100%]"></div>
                        
                        {/* Dot grid */}
                        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                    </div>

                    <div className="relative z-10 flex flex-col justify-center items-center text-center p-12 w-full h-full space-y-12 sm:space-y-16">
                        {/* Badge */}
                        <div className="flex justify-center">
                            <div className="bg-white text-[#0a0e2a] py-2 px-8 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] shadow-xl">
                                AIPrep365
                            </div>
                        </div>

                        {/* Header Section */}
                        <div className="space-y-4">
                            <h1 className="text-5xl sm:text-8xl font-black uppercase tracking-tight mb-2 drop-shadow-2xl text-white">
                                {studentName}
                            </h1>
                            <h2 className="text-lg sm:text-2xl font-bold uppercase tracking-[0.4em] text-blue-400 opacity-90">
                                {isACTTest && actScores ? "ACT Final Test Report" : isApCourse ? apCourseTitle : (isFullLength ? "Full Length Test Report" : (hasMath ? "SAT Math Report" : "SAT Reading & Writing Report"))}
                            </h2>
                            
                            {/* Date and Time with Icons */}
                            <div className="flex items-center justify-center gap-4 sm:gap-6 mt-8">
                                <div className="flex items-center gap-2 text-[10px] sm:text-sm font-bold text-white/90">
                                    <FiIcons.FiCalendar className="text-blue-400 w-4 h-4" />
                                    <span>{new Date(completedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                                <div className="w-[1px] h-4 bg-white/20"></div>
                                <div className="flex items-center gap-2 text-[10px] sm:text-sm font-bold text-white/90">
                                    <FiIcons.FiClock className="text-blue-400 w-4 h-4" />
                                    <span>{new Date(completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Score Section */}
                        <div className="relative flex items-center justify-center pt-8">
                            {/* Glow behind the circle */}
                            <div className="absolute w-64 h-64 bg-blue-500/20 blur-[60px] rounded-full"></div>
                            
                            <div className="relative group">
                                {isACTTest && actScores ? (
                                    <>
                                        {renderCircularProgress(actScores.composite, 36, 280, 16, 'white', 'rgba(255,255,255,0.1)')}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-blue-300 mb-2">Composite Score</span>
                                            <span className="text-6xl sm:text-8xl font-black tracking-tighter drop-shadow-lg">{actScores.composite}</span>
                                        </div>
                                    </>
                                ) : isApCourse ? (
                                    (() => {
                                        const totalQuestions = allResponses.length;
                                        const correctCount = allResponses.filter(r => r.is_correct).length;
                                        const totalAccuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
                                        return (
                                            <>
                                                {renderCircularProgress(totalAccuracy, 100, 280, 16, 'white', 'rgba(255,255,255,0.1)')}
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-blue-300 mb-2">Correct Answers</span>
                                                    <span className="text-5xl sm:text-7xl font-black tracking-tighter drop-shadow-lg">{correctCount}/{totalQuestions}</span>
                                                </div>
                                            </>
                                        );
                                    })()
                                ) : (
                                    <>
                                        {renderCircularProgress(isFullLength ? totalScore : (hasMath ? mathScore : rwScore), isFullLength ? 1600 : 800, 280, 16, 'white', 'rgba(255,255,255,0.1)')}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-blue-300 mb-2">{isFullLength ? "Total Score" : (hasMath ? "Math Score" : "Reading & Writing Score")}</span>
                                            <span className="text-6xl sm:text-8xl font-black tracking-tighter drop-shadow-lg">{isFullLength ? totalScore : (hasMath ? mathScore : rwScore)}</span>
                                        </div>
                                    </>
                                )}
                                {/* Subtle light flare on the circle */}
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-blue-400/30 blur-[20px] rounded-[100%]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. SCORES & HISTORY */}
                <div className="bg-white p-8 print:p-10 print:block">
                    <div className="bg-[#1a237e] text-white p-5 px-8 flex justify-between items-center mb-12 font-black shadow-lg">
                        <h2 className="text-xl">Scores and History</h2>
                        <span className="text-xs uppercase tracking-widest font-medium opacity-80">Full Performance Summary</span>
                    </div>

                    <div className="flex flex-col items-center mb-16">
                        {isACTTest && actScores ? (
                            <div className="w-full flex flex-col items-center">
                                <div className="relative flex items-center justify-center mb-12">
                                    {renderCircularProgress(actScores.composite, 36, 256, 15, '#1a237e', '#f1f5f9')}
                                    <div className="absolute flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Composite Score</span>
                                        <span className="text-6xl sm:text-8xl font-black text-[#1a237e]">{actScores.composite}</span>
                                        <span className="text-[10px] font-black text-gray-500">1 to 36</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 w-full max-w-4xl px-4">
                                    <div className="relative flex items-center justify-center">
                                        {renderCircularProgress(actScores.english.scaled, 36, 160, 10, '#1a237e', '#f1f5f9')}
                                        <div className="absolute flex flex-col items-center justify-center">
                                            <span className="text-[8px] font-black text-gray-600 uppercase">English</span>
                                            <span className="text-4xl font-black text-[#1a237e]">{actScores.english.scaled}</span>
                                            <span className="text-[8px] font-black text-gray-500">1 to 36</span>
                                        </div>
                                    </div>
                                    <div className="relative flex items-center justify-center">
                                        {renderCircularProgress(actScores.math.scaled, 36, 160, 10, '#1a237e', '#f1f5f9')}
                                        <div className="absolute flex flex-col items-center justify-center text-center">
                                            <span className="text-[8px] font-black text-gray-600 uppercase leading-tight">Math</span>
                                            <span className="text-4xl font-black text-[#1a237e]">{actScores.math.scaled}</span>
                                            <span className="text-[8px] font-black text-gray-500">1 to 36</span>
                                        </div>
                                    </div>
                                    <div className="relative flex items-center justify-center">
                                        {renderCircularProgress(actScores.reading.scaled, 36, 160, 10, '#1a237e', '#f1f5f9')}
                                        <div className="absolute flex flex-col items-center justify-center text-center">
                                            <span className="text-[8px] font-black text-gray-600 uppercase leading-tight">Reading</span>
                                            <span className="text-4xl font-black text-[#1a237e]">{actScores.reading.scaled}</span>
                                            <span className="text-[8px] font-black text-gray-500">1 to 36</span>
                                        </div>
                                    </div>
                                    <div className="relative flex items-center justify-center">
                                        {renderCircularProgress(actScores.science.scaled, 36, 160, 10, '#1a237e', '#f1f5f9')}
                                        <div className="absolute flex flex-col items-center justify-center text-center">
                                            <span className="text-[8px] font-black text-gray-600 uppercase leading-tight">Science</span>
                                            <span className="text-4xl font-black text-[#1a237e]">{actScores.science.scaled}</span>
                                            <span className="text-[8px] font-black text-gray-500">1 to 36</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : isApCourse ? (
                            (() => {
                                const totalQuestions = allResponses.length;
                                const correctCount = allResponses.filter(r => r.is_correct).length;
                                const wrongCount = totalQuestions - correctCount;
                                const totalAccuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
                                
                                return (
                                    <div className="relative flex items-center justify-center mb-10 mt-6">
                                        {renderCircularProgress(totalAccuracy, 100, 256, 15, '#1a237e', '#f1f5f9')}
                                        <div className="absolute flex flex-col items-center justify-center">
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Accuracy</span>
                                            <span className="text-6xl sm:text-8xl font-black text-[#1a237e]">{totalAccuracy}%</span>
                                            <span className="text-[10px] font-black text-gray-500 mt-2">Correct Answers: {correctCount}/{totalQuestions}</span>
                                            <span className="text-[10px] font-black text-gray-500">Wrong Answers: {wrongCount}/{totalQuestions}</span>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            isFullLength ? (
                                <>
                                    <div className="relative flex items-center justify-center mb-10">
                                        {renderCircularProgress(totalScore, 1600, 256, 15, '#1a237e', '#f1f5f9')}
                                        <div className="absolute flex flex-col items-center justify-center">
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Total Score</span>
                                            <span className="text-6xl sm:text-8xl font-black text-[#1a237e]">{totalScore}</span>
                                            <span className="text-[10px] font-black text-gray-500">400 to 1600</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-12 sm:gap-16">
                                        <div className="relative flex items-center justify-center">
                                            {renderCircularProgress(mathScore, 800, 176, 10, '#1a237e', '#f1f5f9')}
                                            <div className="absolute flex flex-col items-center justify-center">
                                                <span className="text-[8px] font-black text-gray-600 uppercase">Math</span>
                                                <span className="text-4xl font-black text-[#1a237e]">{mathScore}</span>
                                                <span className="text-[8px] font-black text-gray-500">200 to 800</span>
                                            </div>
                                        </div>
                                        <div className="relative flex items-center justify-center">
                                            {renderCircularProgress(rwScore, 800, 176, 10, '#1a237e', '#f1f5f9')}
                                            <div className="absolute flex flex-col items-center justify-center text-center">
                                                <span className="text-[8px] font-black text-gray-600 uppercase leading-tight">Reading &<br/>Writing</span>
                                                <span className="text-4xl font-black text-[#1a237e]">{rwScore}</span>
                                                <span className="text-[8px] font-black text-gray-500">200 to 800</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="relative flex items-center justify-center mb-10">
                                    {renderCircularProgress(hasMath ? mathScore : rwScore, 800, 256, 15, '#1a237e', '#f1f5f9')}
                                    <div className="absolute flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{hasMath ? "Math Score" : "Reading & Writing Score"}</span>
                                        <span className="text-6xl sm:text-8xl font-black text-[#1a237e]">{hasMath ? mathScore : rwScore}</span>
                                        <span className="text-[10px] font-black text-gray-500">200 to 800</span>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    <div className="rounded-3xl overflow-x-auto border-2 border-[#1a237e] shadow-2xl print:shadow-none mx-0 sm:mx-4 custom-scrollbar px-4 sm:px-0">
                        <table className="w-full text-left font-bold border-collapse min-w-[600px] sm:min-w-0">
                            <thead className="bg-[#1a237e] text-white !text-white text-[10px] sm:text-[11px] uppercase tracking-widest">
                                <tr>
                                    <th className="py-4 sm:py-6 px-4 sm:px-10 border-r-2 border-white/10">{isApCourse ? 'Unit Name' : 'Section'}</th>
                                    <th className="py-4 sm:py-6 px-2 sm:px-10 border-r-2 border-white/10 text-center">{isApCourse ? 'Correct Answers' : 'Correct'}</th>
                                    <th className="py-4 sm:py-6 px-2 sm:px-10 border-r-2 border-white/10 text-center">{isApCourse ? 'Total Questions' : 'Total'}</th>
                                    <th className="py-4 sm:py-6 px-2 sm:px-10 border-r-2 border-white/10 text-center">Accuracy {isApCourse ? '%' : ''}</th>
                                    <th className="py-4 sm:py-6 px-4 sm:px-10 text-right">{isApCourse ? 'Status' : 'Score'}</th>
                                </tr>
                            </thead>
                            <tbody className="text-[#0a0e2a] bg-white">
                                {isApCourse ? (
                                    (() => {
                                        const topicsData = {};
                                        allResponses.forEach(r => {
                                            const t = r.topic || 'General';
                                            if(!topicsData[t]) topicsData[t] = { correct: 0, total: 0 };
                                            topicsData[t].total++;
                                            if(r.is_correct) topicsData[t].correct++;
                                        });
                                        return Object.entries(topicsData).map(([topicName, data]) => {
                                            const accuracy = Math.round((data.correct / data.total) * 100) || 0;
                                            const status = accuracy >= 50 ? 'Passed' : 'Review Needed';
                                            return (
                                                <tr key={topicName} className="border-b-2 border-gray-100">
                                                    <td className="py-4 sm:py-7 px-4 sm:px-10 font-black text-[#0a0e2a] text-xs sm:text-lg">{topicName}</td>
                                                    <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{data.correct}</td>
                                                    <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{data.total}</td>
                                                    <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{accuracy}%</td>
                                                    <td className={`py-4 sm:py-7 px-4 sm:px-10 text-right text-xs sm:text-lg font-black ${status === 'Passed' ? 'text-green-600' : 'text-red-600'}`}>{status}</td>
                                                </tr>
                                            );
                                        });
                                    })()
                                ) : (
                                    <>
                                        {hasRW && (
                                            <tr className="border-b-2 border-gray-100">
                                                <td className="py-4 sm:py-7 px-4 sm:px-10 font-black text-[#0a0e2a] text-xs sm:text-lg">Reading & Writing</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{rwResponses.filter(r=>r.is_correct).length}</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{rwResponses.length}</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{rwResponses.length > 0 ? Math.round((rwResponses.filter(r=>r.is_correct).length/rwResponses.length)*100) : 0}%</td>
                                                <td className="py-4 sm:py-7 px-4 sm:px-10 text-right text-xl sm:text-4xl font-black text-[#1a237e]">{rwScore}</td>
                                            </tr>
                                        )}
                                        {hasMath && (
                                            <tr className="border-b-2 border-gray-100">
                                                <td className="py-4 sm:py-7 px-4 sm:px-10 font-black text-[#0a0e2a] text-xs sm:text-lg">Math</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{mathResponses.filter(r=>r.is_correct).length}</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{mathResponses.length}</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-[#0a0e2a] text-xs sm:text-lg">{mathResponses.length > 0 ? Math.round((mathResponses.filter(r=>r.is_correct).length/mathResponses.length)*100) : 0}%</td>
                                                <td className="py-4 sm:py-7 px-4 sm:px-10 text-right text-xl sm:text-4xl font-black text-[#1a237e]">{mathScore}</td>
                                            </tr>
                                        )}
                                        {isFullLength && (
                                            <tr className="bg-[#1a237e] text-white">
                                                <td className="py-4 sm:py-7 px-4 sm:px-10 text-sm sm:text-xl font-black uppercase tracking-tight text-white">Total SAT</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-sm sm:text-xl">{rwResponses.filter(r=>r.is_correct).length + mathResponses.filter(r=>r.is_correct).length}</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-sm sm:text-xl">{rwResponses.length + mathResponses.length}</td>
                                                <td className="py-4 sm:py-7 px-2 sm:px-10 text-center text-sm sm:text-xl">{allResponses.length > 0 ? Math.round((allResponses.filter(r=>r.is_correct).length/allResponses.length)*100) : 0}%</td>
                                                <td className="py-4 sm:py-7 px-4 sm:px-10 text-right text-2xl sm:text-5xl font-black text-yellow-400">{totalScore}</td>
                                            </tr>
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. TIME-BASED ANALYSIS */}
                <div className="section-break bg-white p-8 print:p-10">
                    <div className="bg-[#1862a8] text-white p-5 px-8 flex justify-between items-center mb-10 font-black shadow-lg">
                        <h2 className="text-xl uppercase tracking-tight">Time-Based Analysis</h2>
                        <span className="text-xs uppercase tracking-widest font-medium opacity-80">Pacing & Performance Insights</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-16">
                        <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border-2 border-gray-100 shadow-xl flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Total Time</span>
                            <span className="text-3xl sm:text-5xl font-black text-[#1a237e]">{formatTime(totalTime.total)}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">entire test</span>
                        </div>
                        <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border-2 border-gray-100 shadow-xl flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Avg / Question</span>
                            <span className="text-3xl sm:text-5xl font-black text-[#1a237e]">{totalTime.avg}s</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">across all sections</span>
                        </div>
                        {hasRW && (
                            <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border-2 border-gray-100 shadow-xl flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">{isApCourse ? apSectionName : 'R&W Section'}</span>
                                <span className="text-3xl sm:text-5xl font-black text-purple-700">{formatTime(rwTime.total)}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">avg {rwTime.avg}s/q</span>
                            </div>
                        )}
                        {hasMath && (
                            <div className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border-2 border-gray-100 shadow-xl flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Math Section</span>
                                <span className="text-3xl sm:text-5xl font-black text-orange-600">{formatTime(mathTime.total)}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">avg {mathTime.avg}s/q</span>
                            </div>
                        )}
                    </div>

                    {hasRW && renderTimeTable(rwResponses, isApCourse ? apSectionName : 'Reading & Writing', rwTime.total, rwTime.avg)}
                    {hasRW && hasMath && <div className="my-20"></div>}
                    {hasMath && renderTimeTable(mathResponses, 'Math', mathTime.total, mathTime.avg)}
                </div>

                {/* 4. MASTERY RW */}
                {hasRW && renderMasterySection(isApCourse ? apSectionName : 'Reading & Writing', rwScore, rwResponses.length, rwTopics, 1)}

                {/* 5. MASTERY MATH */}
                {hasMath && renderMasterySection('Math', mathScore, mathResponses.length, mathTopics, hasRW ? 2 : 1)}

            </div>
        </div>
    );
};

export default AdaptiveResultsDashboard;
