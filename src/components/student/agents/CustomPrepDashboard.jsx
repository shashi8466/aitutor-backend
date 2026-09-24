import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { customPrepService } from '../../../services/api';

const { FiTarget, FiLoader, FiClock, FiCalendar, FiCheckCircle, FiCircle, FiArrowLeft, FiBookOpen, FiActivity, FiRefreshCw, FiAward, FiTrendingUp, FiChevronRight, FiInfo, FiChevronUp, FiChevronDown } = FiIcons;

const TASK_ICON = {
    learn: FiBookOpen,
    practice: FiActivity,
    review: FiRefreshCw,
    timed_practice: FiClock,
    compare: FiTrendingUp
};

const SUBJECT_COLOR = {
    'Math': { dot: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
    'Reading & Writing': { dot: 'bg-purple-500', text: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10' }
};

const LEVEL_BADGE_STYLE = {
    'Easy': 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-900/30',
    'Medium': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30',
    'Hard': 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30',
    'Maintenance': 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/30'
};

// Study opens the level's study guide/dashboard; Targeted Practice jumps straight into that
// level's quiz - both reuse the SAME existing Regular Course Easy/Medium/Hard flow every other
// practice quiz in the app already uses, never a separate/generic destination. mode=practice
// routes the quiz to the practice-oriented QuizInterface (with an untimed feel and AI help)
// rather than the formal, timed ExamInterface QuizDispatcher otherwise defaults to - a Custom
// Prep task is practice, never a graded exam attempt.
const startLearningPath = (task) => {
    if (!task.courseId) return '/student/drills';
    const level = (task.level || 'Medium').toLowerCase();
    return task.type === 'practice'
        ? `/student/course/${task.courseId}/level/${level}/quiz?mode=practice`
        : `/student/course/${task.courseId}/level/${level}`;
};

// Carried through every course/level/quiz page Custom Prep sends the student to, and read back
// by each of them to decide where their own "Back" goes - see LevelDashboard.jsx/QuizInterface.jsx
// for the read side. Navigating with this state (pushed, not replaced) also means the browser's
// own Back button retraces Custom Prep -> course content, rather than skipping over it.
// `taskIndex` (paired with `dayIndex`) is the SAME exact address the existing task-completion
// endpoint already uses (see toggleTask/updateProgress below) - carrying it through lets the quiz
// page mark precisely the task that launched it as complete, never every task for that topic.
const customPrepNavState = (planId, dayIndex, taskIndex) => ({ source: 'custom_prep', planId, dayIndex, taskIndex });

const CustomPrepDashboard = () => {
    const { planId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [plan, setPlan] = useState(null);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [savingTask, setSavingTask] = useState(null);
    const [showLevelExplanation, setShowLevelExplanation] = useState(true);

    useEffect(() => {
        loadPlan();
    }, [planId]);

    const loadPlan = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await customPrepService.getPlan(planId);
            setPlan(res.data.plan);
            // Arriving back from a course/level/quiz page Custom Prep sent the student to (see
            // customPrepNavState) restores the day they were actually on, rather than resetting to
            // wherever plan.current_day_index happens to be.
            const restoredDay = location.state?.source === 'custom_prep' && Number.isInteger(location.state?.dayIndex)
                ? location.state.dayIndex
                : res.data.plan.current_day_index || 0;
            setSelectedDayIndex(restoredDay);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load this Custom Prep plan.');
        } finally {
            setLoading(false);
        }
    };

    const toggleTask = async (dayIndex, taskIndex, completed) => {
        const taskKey = `${dayIndex}-${taskIndex}`;
        setSavingTask(taskKey);
        // Optimistic local update.
        setPlan((prev) => {
            const next = JSON.parse(JSON.stringify(prev));
            next.plan.days[dayIndex].tasks[taskIndex].completed = completed;
            return next;
        });
        try {
            const res = await customPrepService.updateProgress(planId, { taskUpdate: { dayIndex, taskIndex, completed } });
            setPlan((prev) => ({ ...prev, status: res.data.plan.status }));
        } catch (err) {
            // Revert on failure.
            setPlan((prev) => {
                const next = JSON.parse(JSON.stringify(prev));
                next.plan.days[dayIndex].tasks[taskIndex].completed = !completed;
                return next;
            });
        } finally {
            setSavingTask(null);
        }
    };

    const goToNextDay = async () => {
        const nextIndex = Math.min(selectedDayIndex + 1, plan.num_days - 1);
        try {
            const res = await customPrepService.updateProgress(planId, { currentDayIndex: nextIndex });
            setPlan(res.data.plan);
            setSelectedDayIndex(nextIndex);
        } catch (err) {
            setSelectedDayIndex(nextIndex);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <SafeIcon icon={FiLoader} className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="max-w-md mx-auto text-center py-16">
                <p className="text-sm text-red-500 font-bold mb-4">{error || 'Plan not found.'}</p>
                <Link to="/student/custom-prep" className="text-purple-600 font-bold text-sm">← Back to Custom Prep</Link>
            </div>
        );
    }

    const days = plan.plan?.days || [];
    const selectedDay = days[selectedDayIndex];
    const isCurrentDay = selectedDayIndex === plan.current_day_index;
    const allTasksDoneToday = selectedDay?.tasks?.length > 0 && selectedDay.tasks.every((t) => t.completed);
    const weaknesses = plan.analysis?.weaknesses || [];

    // Custom Prep progress for one weak topic - computed purely from this plan's own task
    // records (across every day, not just the one currently selected), never from later,
    // unrelated test_submissions. This is a DIFFERENT measurement than the topic's original
    // Full-Length Test accuracy below and must never be confused with or overwrite it.
    const getCustomPrepStatus = (topicName) => {
        const relevantTasks = days.flatMap((d) => d.tasks || []).filter((t) => t.topic === topicName && (t.type === 'learn' || t.type === 'practice'));
        if (relevantTasks.length === 0 || !relevantTasks.some((t) => t.completed)) return 'Not Started';
        const hasCompletedStudy = relevantTasks.some((t) => t.type === 'learn' && t.completed);
        const hasCompletedPractice = relevantTasks.some((t) => t.type === 'practice' && t.completed);
        return hasCompletedStudy && hasCompletedPractice ? 'Completed' : 'In Progress';
    };
    const CUSTOM_PREP_STATUS_STYLE = {
        'Completed': 'text-green-600 dark:text-green-400',
        'In Progress': 'text-amber-600 dark:text-amber-400',
        'Not Started': 'text-gray-400'
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-16">
            <button onClick={() => navigate('/student/custom-prep')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:hover:text-white font-bold text-sm">
                <SafeIcon icon={FiArrowLeft} /> All Custom Prep Plans
            </button>

            {/* Header */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <SafeIcon icon={FiTarget} className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Custom Prep</p>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white">{plan.test_name}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase">Current</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{plan.current_score}</p>
                        </div>
                        <SafeIcon icon={FiChevronRight} className="text-purple-400" />
                        <div className="text-center">
                            <p className="text-[10px] font-black text-purple-500 uppercase">Target</p>
                            <p className="text-2xl font-black text-purple-700 dark:text-purple-300">{plan.target_score}</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400 mb-6">
                    <span className="flex items-center gap-1.5"><SafeIcon icon={FiCalendar} className="w-3.5 h-3.5" /> {plan.num_days} Days</span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5"><SafeIcon icon={FiClock} className="w-3.5 h-3.5" /> {plan.hours_per_day} Hours/Day</span>
                    <span>•</span>
                    <span>{plan.total_hours} Hours Total</span>
                    {plan.difficulty_label && (
                        <>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">{plan.difficulty_label}</span>
                        </>
                    )}
                </div>

                <div>
                    <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
                        <span>Progress</span>
                        <span>Day {plan.current_day_index + 1} of {plan.num_days}</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${((plan.current_day_index + 1) / plan.num_days) * 100}%` }} />
                    </div>
                </div>
            </div>

            {/* How levels were assigned - shown ONCE for the whole plan, never repeated per day */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <button
                    onClick={() => setShowLevelExplanation((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                >
                    <span className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
                        <SafeIcon icon={FiInfo} className="w-4 h-4 text-purple-500" /> How Your Preparation Levels Were Assigned
                    </span>
                    <SafeIcon icon={showLevelExplanation ? FiChevronUp : FiChevronDown} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
                {showLevelExplanation && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            Your preparation levels are based on your performance in the Full-Length Test used to create this plan. Each topic is assigned a learning level according to your topic accuracy - the level decides WHAT you study; the time you set decides only HOW the plan is scheduled.
                        </p>
                        <div className="space-y-1.5">
                            {[
                                { level: 'Easy', range: '0–30%', style: LEVEL_BADGE_STYLE.Easy, desc: "your performance in this topic was 0–30%, so you'll start with foundational content." },
                                { level: 'Medium', range: '31–54%', style: LEVEL_BADGE_STYLE.Medium, desc: "your performance was 31–54%, so you'll work on intermediate-level content." },
                                { level: 'Hard', range: '55–80%', style: LEVEL_BADGE_STYLE.Hard, desc: "your performance was 55–80%, so you'll practice more advanced content." },
                                { level: 'Above 80%', range: '81–100%', style: LEVEL_BADGE_STYLE.Maintenance, desc: "this topic isn't a priority weakness, so it isn't included in this plan at all." }
                            ].map((row) => (
                                <div key={row.level} className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-300">
                                    <span className={`shrink-0 w-24 text-center text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-wide ${row.style}`}>{row.level}</span>
                                    <span className="shrink-0 w-14 font-bold text-gray-400">{row.range}</span>
                                    <span className="leading-relaxed">{row.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Day selector */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {days.map((d, idx) => {
                    const dayDone = d.tasks?.length > 0 && d.tasks.every((t) => t.completed);
                    return (
                        <button
                            key={d.dayNumber}
                            onClick={() => setSelectedDayIndex(idx)}
                            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition-all flex items-center gap-1.5 ${idx === selectedDayIndex
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : idx === plan.current_day_index
                                    ? 'bg-purple-50 border-purple-300 text-purple-600 dark:bg-purple-900/20'
                                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-500'
                                }`}
                        >
                            {dayDone && <SafeIcon icon={FiCheckCircle} className="w-3.5 h-3.5" />}
                            Day {d.dayNumber} {d.isFinalTest ? '🏁' : ''}
                        </button>
                    );
                })}
            </div>

            {/* Selected day content */}
            {selectedDay && (
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white">
                            {selectedDay.isFinalTest ? `Day ${selectedDay.dayNumber} — Final Timed Practice` : `Day ${selectedDay.dayNumber} — Today's Focus`}
                        </h2>
                        <span className="text-xs font-bold text-gray-400">{selectedDay.totalMinutes} min planned</span>
                    </div>

                    {selectedDay.isFinalTest && (
                        <div className="mb-6 p-5 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 flex items-start gap-3">
                            <SafeIcon icon={FiAward} className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
                                Simulate real test conditions with a full timed practice test, then review every mistake and compare your result against your previous score of <strong>{plan.current_score}</strong>.
                            </p>
                        </div>
                    )}

                    {selectedDay.subjects?.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            {selectedDay.subjects.map((s) => {
                                const color = SUBJECT_COLOR[s.subject] || { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50' };
                                return (
                                    <div key={s.subject} className={`rounded-2xl p-4 ${color.bg}`}>
                                        <p className={`text-sm font-black mb-2 flex items-center gap-2 ${color.text}`}>
                                            <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} /> {s.subject} — {Math.round(s.minutes / 60 * 10) / 10} hrs
                                        </p>
                                        <ul className="space-y-1">
                                            {s.topics.map((t) => (
                                                <li key={t.topic} className="text-xs text-gray-600 dark:text-gray-300 flex items-start justify-between gap-2">
                                                    {/* Full report topic name, never truncated/shortened - wraps instead. */}
                                                    <span className="flex items-start gap-1.5 min-w-0">
                                                        <span className="break-words">{t.topic}</span>
                                                        {t.recommendedLevel && (
                                                            <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wide ${LEVEL_BADGE_STYLE[t.recommendedLevel] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                                {t.recommendedLevel}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="font-bold shrink-0">{t.minutes} min</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Today's Tasks</p>
                    <div className="space-y-2 mb-6">
                        {(selectedDay.tasks || []).map((task, taskIndex) => {
                            const icon = TASK_ICON[task.type] || FiCircle;
                            const isSaving = savingTask === `${selectedDayIndex}-${taskIndex}`;
                            return (
                                <div
                                    key={taskIndex}
                                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors ${task.completed
                                        ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
                                        : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'
                                        }`}
                                >
                                    <button
                                        onClick={() => toggleTask(selectedDayIndex, taskIndex, !task.completed)}
                                        disabled={isSaving}
                                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'
                                            }`}
                                    >
                                        {task.completed && <SafeIcon icon={FiCheckCircle} className="w-4 h-4" />}
                                    </button>
                                    <SafeIcon icon={icon} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold ${task.completed ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>{task.label}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {task.subject && <p className="text-[10px] text-gray-400">{task.subject}</p>}
                                            {task.recommendedLevel && (
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wide ${LEVEL_BADGE_STYLE[task.recommendedLevel] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                    {task.recommendedLevel}
                                                </span>
                                            )}
                                            {task.originalAccuracy != null && (
                                                <span className="text-[10px] text-gray-400">Original: {task.originalAccuracy}%</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-gray-400 flex-shrink-0">{task.minutes} min</span>
                                    {(task.type === 'learn' || task.type === 'practice') && (
                                        <button
                                            onClick={() => navigate(startLearningPath(task), { state: customPrepNavState(planId, selectedDayIndex, taskIndex) })}
                                            className="flex-shrink-0 text-xs font-black text-purple-600 hover:text-purple-800 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
                                        >
                                            Start Learning
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {isCurrentDay && plan.current_day_index < plan.num_days - 1 && (
                        <button
                            onClick={goToNextDay}
                            disabled={!allTasksDoneToday}
                            className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all"
                        >
                            {allTasksDoneToday ? `Continue to Day ${selectedDay.dayNumber + 1} →` : 'Complete all of today\'s tasks to continue'}
                        </button>
                    )}
                </div>
            )}

            {/* Progress vs original report - independent measurements, never conflated: the
                original Full-Length Test's accuracy for this topic (historical, never modified by
                Custom Prep activity), the level it was assigned because of that accuracy, this
                plan's own task-completion status, and - only once real evidence exists - a new
                practice result at that assigned level. */}
            {weaknesses.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">Progress vs. Original Report</h3>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-4">
                        <span className="flex-1">Topic</span>
                        <span className="w-24 text-right">Level</span>
                        <span className="w-28 text-right">Original Report</span>
                        <span className="w-36 text-right">Custom Prep</span>
                    </div>
                    <div className="space-y-2">
                        {weaknesses.map((w) => {
                            const customPrepStatus = getCustomPrepStatus(w.topic);
                            const recommendedLevel = w.recommendedLevel || 'Medium';
                            return (
                                <div key={`${w.section}-${w.topic}`} className="flex items-start gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                    <div className="flex-1 min-w-0">
                                        {/* Full report topic name, never truncated/shortened - wraps instead. */}
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 break-words">{w.topic}</p>
                                        <p className="text-[10px] text-gray-400">{w.section}</p>
                                    </div>
                                    <div className="w-24 text-right">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wide ${LEVEL_BADGE_STYLE[recommendedLevel] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                            {recommendedLevel}
                                        </span>
                                    </div>
                                    <div className="w-28 text-right">
                                        {w.total > 0 ? (
                                            <p className="text-sm font-black text-gray-900 dark:text-white">{w.accuracy}% accuracy</p>
                                        ) : (
                                            <p className="text-sm font-bold text-gray-400">Not Attempted</p>
                                        )}
                                    </div>
                                    <div className="w-36 text-right">
                                        <p className={`text-sm font-black ${CUSTOM_PREP_STATUS_STYLE[customPrepStatus]}`}>{customPrepStatus}</p>
                                        {w.customPrepPerformance != null && (
                                            <p className="text-[10px] text-gray-400">
                                                New practice: <span className="font-bold text-gray-600 dark:text-gray-300">{w.customPrepPerformance}%</span>
                                                {w.performanceStatus && ` (${w.performanceStatus})`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomPrepDashboard;
