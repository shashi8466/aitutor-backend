import React, { useState, useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import CombinedRegularCourseReport from '../common/CombinedRegularCourseReport';
import AdaptiveResultsDashboard from '../common/AdaptiveResultsDashboard';
import { tutorService, adminService, gradingService } from '../../services/api';

const { FiAlertCircle, FiArrowLeft } = FiIcons;

/**
 * AttemptLevelView - Centralized Report Wrapper for Admin & Tutor
 * Full-Length/adaptive test attempts render the same AdaptiveResultsDashboard report the
 * student sees on their own dashboard (see FullTestReport.jsx for the student-facing wiring);
 * regular topic-quiz attempts render CombinedRegularCourseReport, as before.
 */
const AttemptLevelView = ({ groupId, submissionId, adminMode, onBack }) => {
    const [data, setData] = useState(null);
    const [fullLengthSubmission, setFullLengthSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const service = adminMode ? adminService : tutorService;

    useEffect(() => {
        loadData();
    }, [submissionId]);

    const loadData = async () => {
        setLoading(true);
        setFullLengthSubmission(null);
        try {
            const res = await service.getAttemptAnalytics(groupId, submissionId);
            setData(res.data);

            // Same isTest check StudentCourseList.jsx uses to route between the Full-Length
            // report and the regular topic report - a tutor/admin viewing this exact attempt
            // must land on the same report the student themselves would see.
            const course = res.data?.course || {};
            const isFullLengthTest = Boolean(
                course.isAdaptive ||
                (course.category || '').toLowerCase().includes('full-length') ||
                (course.tutorType || '').toLowerCase().includes('full-length') ||
                (course.tutorType || '').toLowerCase().includes('linear sat') ||
                (course.name || '').toLowerCase().includes('full length') ||
                (course.name || '').toLowerCase().includes('linear sat')
            );

            if (isFullLengthTest) {
                const subRes = await gradingService.getSubmission(submissionId);
                const subData = subRes.data?.submission || subRes.data;
                setFullLengthSubmission(subData);
            }
        } catch (err) {
            console.error('Error loading attempt analytics', err);
            setError('Failed to load attempt report');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 bg-[#0d1322] rounded-2xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-slate-300 font-bold text-sm">Loading SAT Performance Report...</p>
        </div>
    );

    if (error) return (
        <div className="p-6 bg-red-900/20 border border-red-800 rounded-2xl text-red-400 font-bold flex items-center justify-between">
            <div className="flex items-center gap-3">
                <SafeIcon icon={FiAlertCircle} className="w-6 h-6 text-red-500" />
                <span>{error}</span>
            </div>
            <button 
                onClick={onBack}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
            >
                <SafeIcon icon={FiArrowLeft} /> Go Back
            </button>
        </div>
    );

    if (!data || !data.attempt) return null;

    if (fullLengthSubmission) {
        return (
            <AdaptiveResultsDashboard
                submission={fullLengthSubmission}
                onExit={onBack}
                adminMode={adminMode}
            />
        );
    }

    const { attempt, studentName, questions = [] } = data;

    // Normalize submission data structure to pass into CombinedRegularCourseReport
    const rawQuestions = questions.length > 0 ? questions : (attempt.questions || []);

    const normalizedResponses = rawQuestions.map((q, idx) => ({
        id: q.id || q.questionId || idx + 1,
        question_text: q.question_text || q.text || q.questionText || `Question #${idx + 1}`,
        options: q.options || q.choices || [],
        selected_answer: q.studentAnswer || q.selected_answer || (q.isCorrect ? (q.correctAnswer || 'A') : 'Unattempted'),
        studentAnswer: q.studentAnswer || q.selected_answer || (q.isCorrect ? (q.correctAnswer || 'A') : 'Unattempted'),
        correct_answer: q.correctAnswer || q.correct_answer || 'A',
        correctAnswer: q.correctAnswer || q.correct_answer || 'A',
        explanation: q.explanation || q.solution || '',
        is_correct: q.isCorrect ?? q.is_correct ?? (q.studentAnswer === q.correctAnswer),
        isCorrect: q.isCorrect ?? q.is_correct ?? (q.studentAnswer === q.correctAnswer),
        section: q.section || q.level || attempt.level || 'Medium',
        topic: q.topic || attempt.courseName || 'SAT Topic',
        time_taken: q.timeSpent || q.timeTaken || 0,
        timeTaken: q.timeSpent || q.timeTaken || 0
    }));

    const normalizedSubmission = {
        id: attempt.id,
        studentName: studentName || 'Student',
        courseName: attempt.courseName || 'SAT Assessment',
        topicName: attempt.courseName || 'SAT Assessment',
        scaled_score: attempt.scaledScore || 200,
        scaledScore: attempt.scaledScore || 200,
        created_at: attempt.date || new Date().toISOString(),
        date: attempt.date || new Date().toISOString(),
        test_duration_seconds: attempt.timeSpent || 0,
        responses: normalizedResponses,
        combinedResponses: normalizedResponses,
        strengths: attempt.strengths || [],
        weaknesses: attempt.weaknesses || []
    };

    return (
        <CombinedRegularCourseReport 
            submission={normalizedSubmission}
            topicReportData={normalizedSubmission}
            studentName={studentName || 'Student'}
            onExit={onBack}
        />
    );
};

export default AttemptLevelView;
