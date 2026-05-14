import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const ScorePredictor = () => {
    // State for RW
    const [rwMod1, setRwMod1] = useState(0);
    const [rwMod2, setRwMod2] = useState(0);
    const [rwRoute, setRwRoute] = useState('Auto'); // Auto, Easy, Hard
    
    // State for Math
    const [mathMod1, setMathMod1] = useState(0);
    const [mathMod2, setMathMod2] = useState(0);
    const [mathRoute, setMathRoute] = useState('Auto');

    // Derived states
    const rwRaw = rwMod1 + rwMod2;
    const mathRaw = mathMod1 + mathMod2;

    // Auto routing logic
    const getRwRoute = () => {
        if (rwRoute !== 'Auto') return rwRoute;
        return rwMod1 <= 17 ? 'Easy' : 'Hard';
    };

    const getMathRoute = () => {
        if (mathRoute !== 'Auto') return mathRoute;
        return mathMod1 <= 14 ? 'Easy' : 'Hard';
    };

    const activeRwRoute = getRwRoute();
    const activeMathRoute = getMathRoute();

    // Score calculation logic
    const calculateRwScore = (raw, route) => {
        if (raw === 0) return 200;
        let score = 200;
        if (route === 'Hard') {
            score = 200 + raw * 11.1;
        } else {
            score = 200 + raw * 8.4;
            if (score > 620) score = 620; // Easy route cap
            else if (score > 590 && score < 620) score = 610; // Simple approximation for cap range
        }
        return Math.min(800, Math.max(200, Math.round(score / 10) * 10));
    };

    const calculateMathScore = (raw, route) => {
        if (raw === 0) return 200;
        let score = 200;
        if (route === 'Hard') {
            score = 200 + raw * 13.6;
        } else {
            score = 200 + raw * 10.2;
            if (score > 630) score = 630; // Easy route cap
            else if (score > 600 && score < 630) score = 620; // Simple approximation for cap range
        }
        return Math.min(800, Math.max(200, Math.round(score / 10) * 10));
    };

    const predictedRw = calculateRwScore(rwRaw, activeRwRoute);
    const predictedMath = calculateMathScore(mathRaw, activeMathRoute);
    const totalScore = predictedRw + predictedMath;

    // Estimate Percentile and Performance Level
    const getPercentile = (score) => {
        if (score >= 1500) return '98-99th';
        if (score >= 1400) return '93-97th';
        if (score >= 1300) return '84-92th';
        if (score >= 1200) return '74-83th';
        if (score >= 1100) return '59-73th';
        if (score >= 1000) return '40-58th';
        return '<40th';
    };

    const getPerformanceLevel = (score) => {
        if (score >= 1400) return 'Excellent';
        if (score >= 1200) return 'Strong';
        if (score >= 1000) return 'Average';
        return 'Needs Improvement';
    };

    // Calculate stroke dash array for circle gauge (circumference of circle r=50 is ~314)
    const circleRadius = 50;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const strokeDashoffset = circleCircumference - ((totalScore - 400) / 1200) * circleCircumference;

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
            <div className="text-center max-w-3xl mx-auto px-4 space-y-4">
                <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                    Test Prep Pundits Digital SAT Score Predictor
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg font-medium">
                    Estimate your Digital SAT score using adaptive College Board–style prediction logic.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl text-sm font-medium border border-blue-100 dark:border-blue-800/30 flex items-start gap-3 mt-6">
                    <SafeIcon icon={FiIcons.FiInfo} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                        <p className="font-bold mb-1">SAT Information:</p>
                        <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                            <li>Digital SAT Total Score: 400–1600</li>
                            <li>Reading &amp; Writing: 200–800 (54 Questions / 64 Minutes)</li>
                            <li>Math: 200–800 (44 Questions / 70 Minutes)</li>
                        </ul>
                        <p className="mt-3 text-xs italic opacity-80">
                            This is an estimated SAT predictor and not an official College Board scoring system.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side: Inputs */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Reading & Writing Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl flex items-center justify-center">
                                <SafeIcon icon={FiIcons.FiBook} className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white">Reading &amp; Writing</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Max Raw Score: 54</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Module 1 Correct (0-27)</label>
                                    <input 
                                        type="range" min="0" max="27" value={rwMod1} 
                                        onChange={(e) => setRwMod1(Number(e.target.value))}
                                        className="w-full accent-purple-600"
                                    />
                                    <div className="text-right text-sm font-bold text-purple-600">{rwMod1} / 27</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Module 2 Correct (0-27)</label>
                                    <input 
                                        type="range" min="0" max="27" value={rwMod2} 
                                        onChange={(e) => setRwMod2(Number(e.target.value))}
                                        className="w-full accent-purple-600"
                                    />
                                    <div className="text-right text-sm font-bold text-purple-600">{rwMod2} / 27</div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Route Selector</label>
                                    <div className="flex gap-2">
                                        {['Auto', 'Easy', 'Hard'].map(opt => (
                                            <button 
                                                key={opt}
                                                onClick={() => setRwRoute(opt)}
                                                className={`px-3 py-1 text-sm font-bold rounded-lg transition-colors ${rwRoute === opt ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-left sm:text-right flex-shrink-0">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Raw Score</div>
                                    <div className="text-xl font-black text-gray-900 dark:text-white">{rwRaw} <span className="text-sm font-medium text-gray-500">/ 54</span></div>
                                </div>
                                <div className="text-left sm:text-right flex-shrink-0">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Active Route</div>
                                    <span className={`inline-block px-2 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${activeRwRoute === 'Hard' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                                        {activeRwRoute}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Math Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center">
                                <SafeIcon icon={FiIcons.FiTarget} className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white">Mathematics</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Max Raw Score: 44</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Module 1 Correct (0-22)</label>
                                    <input 
                                        type="range" min="0" max="22" value={mathMod1} 
                                        onChange={(e) => setMathMod1(Number(e.target.value))}
                                        className="w-full accent-blue-600"
                                    />
                                    <div className="text-right text-sm font-bold text-blue-600">{mathMod1} / 22</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Module 2 Correct (0-22)</label>
                                    <input 
                                        type="range" min="0" max="22" value={mathMod2} 
                                        onChange={(e) => setMathMod2(Number(e.target.value))}
                                        className="w-full accent-blue-600"
                                    />
                                    <div className="text-right text-sm font-bold text-blue-600">{mathMod2} / 22</div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Route Selector</label>
                                    <div className="flex gap-2">
                                        {['Auto', 'Easy', 'Hard'].map(opt => (
                                            <button 
                                                key={opt}
                                                onClick={() => setMathRoute(opt)}
                                                className={`px-3 py-1 text-sm font-bold rounded-lg transition-colors ${mathRoute === opt ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-left sm:text-right flex-shrink-0">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Raw Score</div>
                                    <div className="text-xl font-black text-gray-900 dark:text-white">{mathRaw} <span className="text-sm font-medium text-gray-500">/ 44</span></div>
                                </div>
                                <div className="text-left sm:text-right flex-shrink-0">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Active Route</div>
                                    <span className={`inline-block px-2 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${activeMathRoute === 'Hard' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                                        {activeMathRoute}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Prediction Dashboard */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8 flex flex-col items-center">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-8">Total Predicted Score</h3>
                    
                    <div className="relative w-48 h-48 mb-10">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                            {/* Background circle */}
                            <circle 
                                cx="60" cy="60" r="50" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="8" 
                                className="text-gray-100 dark:text-gray-700"
                            />
                            {/* Animated progress circle */}
                            <motion.circle 
                                cx="60" cy="60" r="50" 
                                fill="none" 
                                stroke="#2563EB" 
                                strokeWidth="8" 
                                strokeLinecap="round"
                                strokeDasharray={circleCircumference}
                                initial={{ strokeDashoffset: circleCircumference }}
                                animate={{ strokeDashoffset }}
                                transition={{ duration: 1, ease: "easeOut" }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-black text-gray-900 dark:text-white">{totalScore}</span>
                            <span className="text-sm font-bold text-gray-400">out of 1600</span>
                        </div>
                    </div>

                    <div className="w-full grid grid-cols-2 gap-4 divide-x divide-gray-200 dark:divide-gray-700 border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Reading &amp; Writing</p>
                            <p className="text-3xl font-black text-purple-600">{predictedRw}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Math</p>
                            <p className="text-3xl font-black text-blue-600">{predictedMath}</p>
                        </div>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="text-sm font-bold text-gray-600 dark:text-gray-400">Estimated Percentile</span>
                            <span className="text-sm font-black text-gray-900 dark:text-white">{getPercentile(totalScore)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="text-sm font-bold text-gray-600 dark:text-gray-400">Performance</span>
                            <span className={`text-sm font-black ${
                                getPerformanceLevel(totalScore) === 'Excellent' ? 'text-green-600 dark:text-green-400' :
                                getPerformanceLevel(totalScore) === 'Strong' ? 'text-blue-600 dark:text-blue-400' :
                                getPerformanceLevel(totalScore) === 'Average' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                                {getPerformanceLevel(totalScore)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScorePredictor;
