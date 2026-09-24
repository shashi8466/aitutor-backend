import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { customPrepService, gradingService } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const { FiTarget, FiLoader, FiClock, FiCalendar, FiChevronRight, FiTrendingUp, FiCheckCircle, FiEye, FiDownload, FiZap, FiTrash2, FiAlertTriangle } = FiIcons;

const DIFFICULTY_STYLES = {
    'Achievable': 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-900/30',
    'Ambitious': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30',
    'Highly Ambitious': 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30',
    'Target Already Reached': 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30'
};

// Mirrors analyticsService._isFullLengthCourse / AdaptiveResultsDashboard's client-side check -
// the one reliable signal across every Full-Length Test sub-type (SAT Adaptive, Linear SAT, ACT
// Full-Length), so this list only ever offers Custom Prep for a genuine Full-Length Test, never
// a regular topic-quiz submission.
const isFullLengthTestCourse = (course) =>
    course?.is_adaptive === true || (course?.main_category || '').toUpperCase() === 'FULL LENGTH TESTS';

const CustomPrepList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState([]);
    const [completedTests, setCompletedTests] = useState([]);
    const [error, setError] = useState('');
    const [planPendingDelete, setPlanPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (user?.id) loadData();
    }, [user?.id]);

    const loadData = async () => {
        setLoading(true);
        setError('');
        // Independent fetches, on purpose: the completed-tests list (an existing, unrelated
        // endpoint) must still render even if the newer custom-prep plans endpoint fails - a
        // Promise.all here would let one failure hide data the other call already has.
        const [plansResult, scoresResult] = await Promise.allSettled([
            customPrepService.getPlans(),
            gradingService.getAllMyScores(user.id)
        ]);

        if (plansResult.status === 'fulfilled') {
            setPlans(plansResult.value.data.plans || []);
        } else {
            console.error('Failed to load Custom Prep plans:', plansResult.reason);
            setError('Failed to load your saved Custom Prep plans.');
        }

        if (scoresResult.status === 'fulfilled') {
            const allSubmissions = scoresResult.value.data?.submissions || [];
            const fullLengthTests = allSubmissions
                .filter((s) => isFullLengthTestCourse(s.courses))
                .sort((a, b) => new Date(b.test_date || b.created_at) - new Date(a.test_date || a.created_at));
            setCompletedTests(fullLengthTests);
        } else {
            console.error('Failed to load completed tests:', scoresResult.reason);
        }

        setLoading(false);
    };

    // Deletes only this one Custom Prep plan row - never the source Full-Length Test/report/score
    // (see the server route's comment: custom_prep_plans is a leaf table nothing else references).
    // Re-runs loadData() afterward instead of just splicing local state, so the list reflects the
    // server's actual current state and the deleted card can never reappear from stale data.
    const handleDeletePlan = async () => {
        if (!planPendingDelete) return;
        setDeleting(true);
        try {
            await customPrepService.deletePlan(planPendingDelete.id);
            setPlanPendingDelete(null);
            await loadData();
        } catch (err) {
            console.error('Failed to delete Custom Prep plan:', err);
            setError('Failed to delete the plan. Please try again.');
            setPlanPendingDelete(null);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <SafeIcon icon={FiLoader} className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    const planBySubmission = new Map(plans.map((p) => [p.source_submission_id, p]));

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <SafeIcon icon={FiTarget} className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Custom Prep</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Personalized prep plans built from your Full-Length Test results</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold">{error}</div>
            )}

            {plans.length === 0 && completedTests.length === 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 p-12 text-center">
                    <SafeIcon icon={FiTarget} className="w-14 h-14 text-gray-200 dark:text-gray-700 mx-auto mb-5" />
                    <h2 className="text-lg font-black text-gray-900 dark:text-white mb-2">No Custom Prep Plan Yet</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                        Complete a Full-Length Test and generate a personalized preparation plan from your results.
                    </p>
                    <Link
                        to="/student/courses"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors"
                    >
                        Take a Full-Length Test
                    </Link>
                </div>
            )}

            {plans.length > 0 && (
                <div>
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Your Prep Plans</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {plans.map((plan) => {
                            const dayLabel = `Day ${Math.min(plan.current_day_index + 1, plan.num_days)} of ${plan.num_days}`;
                            return (
                                <div
                                    key={plan.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => navigate(`/student/custom-prep/${plan.id}`)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/student/custom-prep/${plan.id}`); }}
                                    className="text-left w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg hover:border-purple-300 transition-all group cursor-pointer relative"
                                >
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setPlanPendingDelete(plan); }}
                                        aria-label="Delete this preparation plan"
                                        title="Delete Plan"
                                        className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 dark:text-gray-600 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors z-10"
                                    >
                                        <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-start justify-between mb-4 pr-8">
                                        <div>
                                            <h3 className="font-black text-gray-900 dark:text-white text-lg group-hover:text-purple-600 transition-colors">{plan.test_name}</h3>
                                            <p className="text-xs text-gray-400">Updated {new Date(plan.updated_at).toLocaleDateString()}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide ${DIFFICULTY_STYLES[plan.difficulty_label] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                            {plan.difficulty_label || plan.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Score</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white">{plan.current_score}</p>
                                        </div>
                                        <SafeIcon icon={FiTrendingUp} className="text-purple-400 flex-shrink-0" />
                                        <div className="flex-1 bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3 text-center">
                                            <p className="text-[10px] font-black text-purple-500 uppercase">Target</p>
                                            <p className="text-xl font-black text-purple-700 dark:text-purple-300">{plan.target_score}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold mb-4">
                                        <span className="flex items-center gap-1.5"><SafeIcon icon={FiCalendar} className="w-3.5 h-3.5" /> {plan.num_days} Days</span>
                                        <span className="flex items-center gap-1.5"><SafeIcon icon={FiClock} className="w-3.5 h-3.5" /> {plan.hours_per_day}h/day</span>
                                        <span className="flex items-center gap-1.5"><SafeIcon icon={FiCheckCircle} className="w-3.5 h-3.5" /> {plan.total_hours}h Total</span>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {plan.status === 'completed' ? 'Plan Completed 🎉' : dayLabel}
                                        </span>
                                        <span className="flex items-center gap-1 text-sm font-black text-purple-600">
                                            Continue <SafeIcon icon={FiChevronRight} />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {completedTests.length > 0 && (
                <div>
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Your Completed Full-Length Tests</h2>
                    <div className="space-y-3">
                        {completedTests.map((sub) => {
                            const existingPlan = planBySubmission.get(sub.id);
                            const score = sub.scaled_score || ((sub.math_scaled_score && sub.reading_scaled_score) ? sub.math_scaled_score + sub.reading_scaled_score : null) || sub.raw_score || 0;
                            return (
                                <div key={sub.id} className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-6 py-4">
                                    <div>
                                        <p className="font-black text-gray-900 dark:text-white">{sub.courses?.name || 'Full-Length Test'}</p>
                                        <p className="text-xs text-gray-400">
                                            Score: <span className="font-bold text-gray-600 dark:text-gray-300">{score}</span> • {new Date(sub.test_date || sub.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={() => navigate(`/student/report/${sub.id}`)}
                                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <SafeIcon icon={FiEye} className="w-3.5 h-3.5" /> View Report
                                        </button>
                                        <button
                                            onClick={() => navigate(`/student/report/${sub.id}?download=true`)}
                                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <SafeIcon icon={FiDownload} className="w-3.5 h-3.5" /> Download
                                        </button>
                                        {existingPlan ? (
                                            <button
                                                onClick={() => navigate(`/student/custom-prep/${existingPlan.id}`)}
                                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                                            >
                                                <SafeIcon icon={FiTarget} className="w-3.5 h-3.5" /> View Plan
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate(`/student/custom-prep/setup/${sub.id}`)}
                                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                                            >
                                                <SafeIcon icon={FiZap} className="w-3.5 h-3.5" /> Prepare Plan
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {planPendingDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    onClick={() => !deleting && setPlanPendingDelete(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 sm:p-8"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                            <SafeIcon icon={FiAlertTriangle} className="w-6 h-6 text-red-600" />
                        </div>
                        <h2 className="text-lg font-black text-gray-900 dark:text-white mb-2">Delete Preparation Plan?</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                            Are you sure you want to delete this preparation plan?
                        </p>
                        <p className="text-sm font-black text-gray-900 dark:text-white mb-4">{planPendingDelete.test_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                            Your progress and this plan will be permanently removed. This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setPlanPendingDelete(null)}
                                className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={handleDeletePlan}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {deleting ? (
                                    <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />
                                ) : (
                                    <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                                )}
                                Delete Plan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomPrepList;
