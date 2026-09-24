import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { customPrepService } from '../../../services/api';

const { FiTarget, FiClock, FiCalendar, FiArrowLeft, FiLoader, FiAlertCircle, FiTrendingUp, FiCheckCircle, FiChevronDown, FiChevronUp, FiInfo, FiShield } = FiIcons;

const LEVEL_BADGE_STYLE = {
    'Easy': 'bg-green-100 text-green-700 dark:bg-green-900/30',
    'Medium': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
    'Hard': 'bg-red-100 text-red-700 dark:bg-red-900/30',
    'Maintenance': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
};

// Priority = level: an accuracy-based classification, locked to these three non-overlapping
// bands. A topic above 80% isn't a priority weakness at all and never reaches this screen (see
// analyticsService.js's isPriorityWeakness filter) - it's simply not in analysis.weaknesses.
const PRIORITY_TIERS = [
    {
        level: 'Easy', label: 'First Priority', range: '0–30% accuracy', levelLabel: 'Easy Level',
        icon: '🔴', headerBg: 'bg-red-50 dark:bg-red-900/10', headerBorder: 'border-red-100 dark:border-red-900/20', headerText: 'text-red-600 dark:text-red-400', dot: 'bg-red-500'
    },
    {
        level: 'Medium', label: 'Second Priority', range: '31–54% accuracy', levelLabel: 'Medium Level',
        icon: '🟡', headerBg: 'bg-amber-50 dark:bg-amber-900/10', headerBorder: 'border-amber-100 dark:border-amber-900/20', headerText: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500'
    },
    {
        level: 'Hard', label: 'Third Priority', range: '55–80% accuracy', levelLabel: 'Hard Level',
        icon: '🟢', headerBg: 'bg-green-50 dark:bg-green-900/10', headerBorder: 'border-green-100 dark:border-green-900/20', headerText: 'text-green-600 dark:text-green-400', dot: 'bg-green-500'
    }
];

// Two-column split within a priority tier, matching the rest of Custom Prep's Reading & Writing
// vs Math grouping.
const groupBySection = (topics) => {
    const rw = topics.filter(t => (t.section || '').toLowerCase().includes('reading') || (t.section || '').toLowerCase().includes('writing'));
    const math = topics.filter(t => (t.section || '').toLowerCase().includes('math'));
    const other = topics.filter(t => !rw.includes(t) && !math.includes(t));
    return { rw, math: [...math, ...other] };
};

const CustomPrepSetup = () => {
    const { submissionId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [analysis, setAnalysis] = useState(null);

    const [targetScore, setTargetScore] = useState(null);
    const [customTarget, setCustomTarget] = useState('');
    const [hoursPerDay, setHoursPerDay] = useState(3);
    const [numDays, setNumDays] = useState(10);
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState('');
    const [collapsedTiers, setCollapsedTiers] = useState({});

    useEffect(() => {
        loadAnalysis();
    }, [submissionId]);

    const loadAnalysis = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await customPrepService.getAnalysis(submissionId);
            const a = res.data.analysis;
            setAnalysis(a);
            setTargetScore(a.recommendedTarget.max);
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to load your test analysis.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const totalHours = Math.round(hoursPerDay * numDays * 10) / 10;

    const handleGenerate = async () => {
        const finalTarget = customTarget ? parseInt(customTarget, 10) : targetScore;
        if (!finalTarget || finalTarget < 400 || finalTarget > 1600) {
            setGenError('Please choose a target score between 400 and 1600.');
            return;
        }
        setGenerating(true);
        setGenError('');
        try {
            const res = await customPrepService.generate({
                submissionId,
                targetScore: finalTarget,
                hoursPerDay,
                numDays
            });
            navigate(`/student/custom-prep/${res.data.plan.id}`);
        } catch (err) {
            setGenError(err.response?.data?.error || 'Failed to generate your Custom Prep plan. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <SafeIcon icon={FiLoader} className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 text-center">
                    <SafeIcon icon={FiAlertCircle} className="w-10 h-10 text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Can't Set Up Custom Prep</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
                    <Link to="/student" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-bold text-sm text-gray-700 dark:text-gray-300">
                        <SafeIcon icon={FiArrowLeft} /> Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const targetOptions = [analysis.recommendedTarget.min, analysis.recommendedTarget.max, Math.min(1600, analysis.recommendedTarget.max + 100)]
        .filter((v, i, arr) => arr.indexOf(v) === i);
    const isCustomActive = customTarget !== '';
    const effectiveTarget = isCustomActive ? parseInt(customTarget, 10) || 0 : targetScore;
    const isAmbitiousChoice = effectiveTarget > analysis.recommendedTarget.max;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
            <div className="max-w-2xl mx-auto">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:hover:text-white font-bold text-sm mb-6">
                    <SafeIcon icon={FiArrowLeft} /> Back to Report
                </button>

                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <SafeIcon icon={FiTarget} className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white">Custom Prep Setup</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{analysis.courseName}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Your Score</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white">{analysis.currentScore}</p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-5 text-center border border-purple-100 dark:border-purple-900/30">
                            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">Recommended Target</p>
                            <p className="text-2xl font-black text-purple-700 dark:text-purple-300">{analysis.recommendedTarget.min}–{analysis.recommendedTarget.max}</p>
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Top Priority Areas</p>
                            {analysis.weaknesses.length > 0 && (
                                <button
                                    onClick={() => {
                                        const allCollapsed = PRIORITY_TIERS.every((t) => collapsedTiers[t.level]);
                                        const next = {};
                                        PRIORITY_TIERS.forEach((t) => { next[t.level] = !allCollapsed; });
                                        setCollapsedTiers(next);
                                    }}
                                    className="text-[10px] font-bold text-purple-600 hover:text-purple-800 uppercase tracking-wide"
                                >
                                    {PRIORITY_TIERS.every((t) => collapsedTiers[t.level]) ? 'Expand All' : 'Collapse All'}
                                </button>
                            )}
                        </div>

                        {analysis.weaknesses.length === 0 ? (
                            <div className="flex items-start gap-3 p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
                                <SafeIcon icon={FiShield} className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-black text-gray-900 dark:text-white mb-1">No priority weaknesses identified</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        Your topic performance is currently above 80%. Your preparation plan can focus on maintaining performance and targeted advanced practice.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {PRIORITY_TIERS.map((tier) => {
                                    const tierTopics = analysis.weaknesses.filter((w) => w.recommendedLevel === tier.level);
                                    if (tierTopics.length === 0) return null;
                                    const isCollapsed = !!collapsedTiers[tier.level];
                                    const { rw, math } = groupBySection(tierTopics);
                                    return (
                                        <div key={tier.level} className={`rounded-2xl border ${tier.headerBorder} overflow-hidden`}>
                                            <button
                                                onClick={() => setCollapsedTiers((prev) => ({ ...prev, [tier.level]: !prev[tier.level] }))}
                                                className={`w-full flex items-center justify-between gap-3 px-4 py-3 ${tier.headerBg}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${tier.dot}`} />
                                                    <span className={`text-xs font-black uppercase tracking-wide ${tier.headerText}`}>{tier.label}</span>
                                                    <span className="text-[10px] font-bold text-gray-400">{tier.range} · {tier.levelLabel}</span>
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/20 text-gray-500 dark:text-gray-400">{tierTopics.length} topic{tierTopics.length === 1 ? '' : 's'}</span>
                                                </span>
                                                <SafeIcon icon={isCollapsed ? FiChevronDown : FiChevronUp} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            </button>
                                            {!isCollapsed && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white dark:bg-gray-900">
                                                    {[['Reading & Writing', rw], ['Math', math]].map(([sectionLabel, sectionTopics]) => (
                                                        sectionTopics.length > 0 && (
                                                            <div key={sectionLabel}>
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-2">{sectionLabel} ({sectionTopics.length})</p>
                                                                <div className="space-y-1.5">
                                                                    {sectionTopics.map((w) => (
                                                                        <div key={`${w.section}-${w.topic}`} className="flex items-start justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                                                            <div className="min-w-0">
                                                                                {/* Full report topic name, never truncated/shortened - wraps onto multiple lines instead. */}
                                                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block break-words">{w.topic}</span>
                                                                                <span className="text-[10px] text-gray-400">{w.accuracy}% accuracy</span>
                                                                            </div>
                                                                            <span className={`shrink-0 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${LEVEL_BADGE_STYLE[w.recommendedLevel] || 'bg-gray-100 text-gray-500'}`}>
                                                                                {w.recommendedLevel}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {analysis.weaknesses.length > 0 && (
                        <div className="mb-8 flex items-start gap-2 p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <SafeIcon icon={FiInfo} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                Priority is based on your accuracy on each topic in this Full-Length Test - not your overall score. 0–30% is First Priority (Easy), 31–54% is Second Priority (Medium), 55–80% is Third Priority (Hard). Topics above 80% are already strong and aren't included here.
                            </p>
                        </div>
                    )}

                    <div className="mb-8">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Set Your Target Score</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {targetOptions.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => { setTargetScore(opt); setCustomTarget(''); }}
                                    className={`px-5 py-2.5 rounded-xl font-black text-sm border-2 transition-all ${!isCustomActive && targetScore === opt
                                        ? 'bg-purple-600 border-purple-600 text-white'
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-purple-400'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                            <input
                                type="number"
                                placeholder="Custom"
                                value={customTarget}
                                onChange={(e) => setCustomTarget(e.target.value)}
                                className={`w-28 px-4 py-2.5 rounded-xl font-black text-sm border-2 outline-none ${isCustomActive ? 'border-purple-600' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                            />
                        </div>
                        {isAmbitiousChoice && effectiveTarget > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-3 flex items-start gap-2">
                                <SafeIcon icon={FiTrendingUp} className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>
                                    <strong>{effectiveTarget}</strong> is an ambitious target above your recommended range. Your current score is <strong>{analysis.currentScore}</strong>.
                                    This plan will prioritize the highest-impact weaknesses required to move toward {effectiveTarget} - it can't promise you'll reach it, only that your study time goes where it matters most.
                                </span>
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-2">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                <SafeIcon icon={FiClock} className="w-4 h-4" /> Hours per Day
                            </label>
                            <input
                                type="number"
                                min="0.5"
                                max="12"
                                step="0.5"
                                value={hoursPerDay}
                                onChange={(e) => setHoursPerDay(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                <SafeIcon icon={FiCalendar} className="w-4 h-4" /> Number of Days
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="90"
                                value={numDays}
                                onChange={(e) => setNumDays(parseInt(e.target.value, 10) || 0)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 mb-8 mt-2">
                        <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-purple-500" />
                        Total preparation time: <span className="text-gray-900 dark:text-white">{totalHours} hours</span>
                    </div>

                    {genError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2">
                            <SafeIcon icon={FiAlertCircle} /> {genError}
                        </div>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={generating || hoursPerDay <= 0 || numDays <= 0}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-lg shadow-purple-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {generating ? (<><SafeIcon icon={FiLoader} className="animate-spin" /> Generating Your Plan...</>) : 'Generate My Custom Prep Plan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomPrepSetup;
