import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import AdaptiveResultsDashboard from '../common/AdaptiveResultsDashboard';

// The Demo Test Report must look exactly like the real Full-Length Test Report - not a separate,
// demo-specific design. Rather than maintaining a second, parallel implementation of that report
// UI (which would inevitably drift out of sync), this component only fetches/reshapes the demo
// data and renders the exact same AdaptiveResultsDashboard used by the authenticated report
// (see src/components/common/FullTestReport.jsx for the equivalent non-demo wiring).
const DemoReport = () => {
    // New public route is /report/:reportId. The legacy /demo/:courseId/report?id= route (kept
    // mounted for already-shared links) has no reportId param, only courseId + a ?id= query.
    const { courseId: legacyCourseId, reportId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [reportData, setReportData] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [searchParams] = useSearchParams();

    const leadId = reportId || searchParams.get('id');
    const shouldPrint = searchParams.get('print') === 'true';

    // Where "Back"/error-fallback navigation should go. An admin viewing a lead's report from
    // AdminDemoLeads.jsx (src/components/admin/AdminDemoLeads.jsx:65,70) sets isAdminView via
    // navigation state and expects "Back" to return there, not to the public test page.
    // Otherwise: courseId is only known once the report data has loaded (the new route doesn't
    // carry it in the URL at all) - fall back to home rather than a broken /test/undefined if
    // it's never known (e.g. the report fetch 404s).
    const backTarget = location.state?.isAdminView
        ? '/admin/demo-leads'
        : (reportData?.courseId
            ? `/test/${reportData.courseId}`
            : (legacyCourseId ? `/test/${legacyCourseId}` : '/'));

    useEffect(() => {
        const fetchReportData = async () => {
            try {
                if (leadId) {
                    const res = await fetch(`/api/demo/report/${leadId}`);
                    const data = await res.json();
                    if (data.success && data.reportData) {
                        setReportData(data.reportData);
                        if (shouldPrint || location.state?.autoPrint) setTimeout(() => window.print(), 1500);
                        return;
                    }
                    setNotFound(true);
                    return;
                }

                if (location.state?.reportData) {
                    setReportData(location.state.reportData);
                    if (location.state.autoPrint || shouldPrint) {
                        setTimeout(() => window.print(), 1500);
                    }
                    return;
                }

                if (legacyCourseId) {
                    const savedProgress = localStorage.getItem(`demo_progress_${legacyCourseId}`);
                    if (savedProgress) {
                        setReportData(JSON.parse(savedProgress));
                        if (shouldPrint) setTimeout(() => window.print(), 1500);
                        return;
                    }
                }

                setNotFound(true);
            } catch (e) {
                console.error("Failed to load report data", e);
                setNotFound(true);
            }
        };

        fetchReportData();
    }, [leadId, legacyCourseId, location.state, shouldPrint]);

    // Reshape the demo report's own data shape into the same "submission" shape
    // AdaptiveResultsDashboard already knows how to render (see FullTestReport.jsx /
    // GET /api/grading/submission/:id for the real-flow equivalent). No presentation logic
    // lives here - only field renaming/flattening of the same dynamic content.
    const submission = useMemo(() => {
        if (!reportData) return null;
        const { studentName, courseName, finalScores, moduleAnswers, moduleHistory } = reportData;

        // Iterate moduleHistory (a plain array, e.g. ['rw_moderate','rw_easy','math_moderate',
        // 'math_easy']) rather than Object.keys(moduleAnswers) - moduleAnswers is stored in a
        // jsonb column, and Postgres's jsonb type does NOT preserve object key insertion order
        // (it re-serializes keys by length then lexicographically), so relying on its key order
        // silently scrambled the module sequence in the report. moduleHistory is a JSON array,
        // which jsonb does preserve in original order, so it's the reliable source of sequence.
        const moduleOrder = (moduleHistory && moduleHistory.length > 0)
            ? moduleHistory
            : Object.keys(moduleAnswers || {});

        const responses = moduleOrder.flatMap(moduleKey =>
            (moduleAnswers?.[moduleKey] || []).map(q => ({
                topic: q.topic || 'General',
                section: moduleKey.startsWith('rw') ? 'Reading & Writing' : 'Math',
                selected_answer: q.userAnswer,
                correct_answer: q.correctAnswer,
                is_correct: q.isCorrect,
                time_spent: q.timeSpent || 0
            }))
        );

        return {
            student_name: studentName,
            test_date: finalScores?.completedAt,
            totalScore: finalScores?.totalScore,
            rwScore: finalScores?.rwScore,
            mathScore: finalScores?.mathScore,
            course: courseName ? { name: courseName } : undefined,
            metadata: { responses }
        };
    }, [reportData]);

    if (notFound) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 p-6">
                <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Report Not Found</h3>
                    <p className="text-gray-500 mb-6">This report link is invalid or the test hasn't been completed yet.</p>
                    <button
                        onClick={() => navigate(backTarget)}
                        className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-bold transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (!submission) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600 font-medium text-lg">Loading complete test report...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 relative">
            <AdaptiveResultsDashboard submission={submission} onExit={() => navigate(backTarget)} />
        </div>
    );
};

export default DemoReport;
