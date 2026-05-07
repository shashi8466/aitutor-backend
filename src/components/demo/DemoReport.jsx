import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiPrinter, FiArrowLeft, FiCheck, FiX, FiMinus, FiCalendar, FiClock, FiMonitor, FiBarChart2 } = FiIcons;

const DemoReport = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [reportData, setReportData] = useState(null);

    useEffect(() => {
        try {
            const savedProgress = localStorage.getItem(`demo_progress_${courseId}`);
            if (savedProgress) {
                setReportData(JSON.parse(savedProgress));
            } else {
                // Redirect back if no progress
                navigate(`/demo/${courseId}`);
            }
        } catch (e) {
            console.error("Failed to load report data", e);
            navigate(`/demo/${courseId}`);
        }
    }, [courseId, navigate]);

    if (!reportData) return <div className="min-h-screen bg-white flex items-center justify-center">Loading Report...</div>;

    const { studentName, finalScores } = reportData;
    const { totalScore, rwScore, mathScore, moduleDetails, completedAt } = finalScores;
    const moduleHistory = reportData.moduleHistory || [];
    const moduleAnswers = reportData.moduleAnswers || {};
    const questionTimes = reportData.questionTimes || {};
    const moduleDurations = reportData.moduleDurations || {};

    // Process Topic Data
    const rwTopics = {};
    const mathTopics = {};
    let rwTotalQ = 0;
    let rwCorrectQ = 0;
    let mathTotalQ = 0;
    let mathCorrectQ = 0;

    if (moduleDetails) {
        Object.keys(moduleDetails).forEach(mKey => {
            const isRW = mKey.startsWith('rw');
            const mod = moduleDetails[mKey];
            const targetTopics = isRW ? rwTopics : mathTopics;

            if (isRW) {
                rwTotalQ += mod.total || 0;
                rwCorrectQ += mod.correct || 0;
            } else {
                mathTotalQ += mod.total || 0;
                mathCorrectQ += mod.correct || 0;
            }

            if (mod.topics) {
                Object.keys(mod.topics).forEach(topic => {
                    if (!targetTopics[topic]) {
                        targetTopics[topic] = { total: 0, correct: 0 };
                    }
                    targetTopics[topic].total += mod.topics[topic].total;
                    targetTopics[topic].correct += mod.topics[topic].correct;
                });
            }
        });
    }

    // Module label helper
    const getModuleLabel = (mKey) => {
        const map = {
            rw_moderate: '1 . Reading & Writing',
            rw_hard: '2 . Reading & Writing',
            rw_easy: '2 . Reading & Writing',
            math_moderate: '1 . Math',
            math_hard: '2 . Math',
            math_easy: '2 . Math',
        };
        return map[mKey] || mKey;
    };

    // Helper to group and classify topics
    const classifyTopics = (topicsMap) => {
        const mastered = [];
        const review = [];
        const instruction = [];
        
        Object.keys(topicsMap).forEach(topic => {
            const stat = topicsMap[topic];
            const pct = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
            
            const item = { name: topic, ...stat, percentage: Math.round(pct) };
            
            if (pct >= 80) mastered.push(item);
            else if (pct >= 50) review.push(item);
            else instruction.push(item);
        });
        
        return { mastered, review, instruction, all: Object.keys(topicsMap).map(k => ({name: k, ...topicsMap[k], percentage: Math.round(topicsMap[k].total > 0 ? (topicsMap[k].correct / topicsMap[k].total) * 100 : 0)})) };
    };

    const rwClassified = classifyTopics(rwTopics);
    const mathClassified = classifyTopics(mathTopics);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    const formatTimeDisplay = (seconds) => {
        if (!seconds && seconds !== 0) return '—';
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
    };

    // Time Analysis Computations
    const computeTimeAnalysis = () => {
        const sections = { rw: { label: 'Reading & Writing', questions: [], totalTime: 0, moduleTime: 0 }, math: { label: 'Math', questions: [], totalTime: 0, moduleTime: 0 } };
        moduleHistory.forEach(mKey => {
            const isRW = mKey.startsWith('rw');
            const sec = isRW ? 'rw' : 'math';
            const qs = moduleAnswers[mKey] || [];
            sections[sec].moduleTime += (moduleDurations[mKey] || 0);
            qs.forEach((q, idx) => {
                const t = q.timeSpent || questionTimes[q.id] || 0;
                sections[sec].questions.push({
                    ...q,
                    moduleLabel: mKey,
                    qNum: sections[sec].questions.length + 1,
                    timeSpent: t
                });
                sections[sec].totalTime += t;
            });
        });
        // Compute averages
        ['rw', 'math'].forEach(sec => {
            const qs = sections[sec].questions;
            sections[sec].avgTime = qs.length > 0 ? Math.round(sections[sec].totalTime / qs.length) : 0;
        });
        const totalTime = sections.rw.totalTime + sections.math.totalTime;
        const totalQs = sections.rw.questions.length + sections.math.questions.length;
        const totalAvg = totalQs > 0 ? Math.round(totalTime / totalQs) : 0;
        return { sections, totalTime, totalQs, totalAvg };
    };

    const timeAnalysis = computeTimeAnalysis();
    const hasTimeData = timeAnalysis.totalTime > 0;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans print:bg-white print:m-0 pb-12" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            
            {/* NO-PRINT HEADER */}
            <div className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50 print:hidden shadow-sm">
                <button 
                    onClick={() => navigate(`/demo/${courseId}`)}
                    className="flex items-center gap-2 text-gray-600 hover:text-black font-bold"
                >
                    <SafeIcon icon={FiArrowLeft} /> Back to Dashboard
                </button>
                <div className="font-black text-xl tracking-tighter">AIPrep365 <span className="text-[#E53935]">REPORTS</span></div>
                <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold shadow-lg transition-all"
                >
                    <SafeIcon icon={FiPrinter} /> Download PDF
                </button>
            </div>

            <div id="report-content" className="max-w-4xl mx-auto mt-8 space-y-8 md:space-y-12 print:mt-0 print:space-y-0 print:gap-y-0">
                
                {/* PAGE 1: Cover Sheet */}
                <div className="bg-white shadow-2xl overflow-hidden mb-8 md:mb-12 print:mb-0 print:shadow-none print:break-after-page print:break-inside-avoid-page print:h-screen flex flex-col w-full relative p-4 md:p-8">
                    
                    {/* Top Browser-like Header */}
                    <div className="flex justify-between items-center text-[10px] text-gray-400 mb-2 px-2">
                        <div className="flex items-center gap-1">
                             <SafeIcon icon={FiCalendar} className="text-[10px]" />
                             <span>{new Date().toLocaleDateString()}, {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="font-bold tracking-tight">AIPrep365</div>
                    </div>

                    <div className="flex-[3] bg-gradient-to-br from-[#1a237e] via-[#311b92] to-[#e65100] p-8 md:p-16 flex flex-col relative z-10 rounded-xl" style={{ color: 'white' }}>
                        {/* Header Info */}
                        <div className="flex justify-between items-start">
                            <div className="space-y-3 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                <div className="flex items-center gap-3">
                                    <SafeIcon icon={FiCalendar} className="text-lg opacity-80" />
                                    <span>{formatDate(completedAt)} (Demo FULL LENGTH TEST)</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <SafeIcon icon={FiMonitor} className="text-lg opacity-80" />
                                    <span>Test Version: Digital SAT</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <SafeIcon icon={FiClock} className="text-lg opacity-80" />
                                    <span>Pace: Standard</span>
                                </div>
                            </div>
                            <div className="bg-white px-5 py-3 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-[#E53935] font-black tracking-tighter text-2xl" style={{ WebkitTextFillColor: '#E53935' }}>AIPrep365</span>
                            </div>
                        </div>

                        {/* Title and Score Area - Flex Layout to prevent overlap */}
                        <div className="mt-auto flex flex-col md:flex-row print:flex-row justify-between items-center md:items-end print:items-end gap-8 pt-16 md:pt-24 pb-4 md:pb-8">
                            <div className="flex-1 max-w-[100%] md:max-w-[60%] flex flex-col items-start">
                                <h1 className="text-4xl md:text-6xl print:text-6xl font-black leading-none tracking-tight uppercase break-words" style={{ color: 'white' }}>
                                    {studentName}
                                </h1>
                                <div className="w-16 h-1.5 bg-white mt-6 rounded-full opacity-60"></div>

                                <div className="mt-20 flex items-center gap-4">
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <SafeIcon icon={FiBarChart2} className="text-2xl" />
                                    </div>
                                    <div className="text-sm font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                        <div className="opacity-70">Prepared by</div>
                                        <div className="font-bold text-base">AIPrep365 Platform</div>
                                        <div className="opacity-70">aiprep365.com</div>
                                    </div>
                                </div>
                            </div>

                            {/* Score Circle (No Overhang in print to prevent clipping) */}
                            <div className="shrink-0 mb-0 md:mb-4 print:mb-8 mr-0 md:mr-12 print:mr-12 relative z-20 mx-auto md:mx-0">
                                <div className="w-56 h-56 md:w-80 md:h-80 print:w-80 print:h-80 rounded-full border-[16px] border-white/20 flex flex-col items-center justify-center backdrop-blur-md print:backdrop-blur-none bg-white/10 print:bg-transparent relative shadow-2xl print:shadow-none">
                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                        <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="white" strokeWidth="12" strokeDasharray={`${(totalScore/1600)*100} 100`} pathLength="100" strokeLinecap="round" className="opacity-100" />
                                    </svg>
                                    <span className="text-2xl font-bold mb-2" style={{ color: 'white' }}>Score</span>
                                    <span className="text-8xl md:text-9xl print:text-9xl font-black tracking-tighter" style={{ color: 'white' }}>{totalScore}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Bottom White Section */}
                    <div className="flex-[1] bg-white p-8 md:p-16 flex flex-col justify-center">
                         <div className="max-w-md mx-auto w-full">
                            <div className="pl-8 border-l-[3px] border-gray-900 space-y-12 relative">
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-gray-900 shadow-sm"></div>
                                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">Scores and history</h3>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-gray-900 shadow-sm"></div>
                                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">Answer Summary</h3>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-gray-900 shadow-sm"></div>
                                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">Data (for tutor use)</h3>
                                </div>
                            </div>
                         </div>
                         <div className="text-center w-full text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-16">
                             © AIPrep365 Demo Report
                         </div>
                    </div>
                </div>

                {/* PAGE 2: Scores and History */}
                <div className="bg-white shadow-2xl overflow-hidden mb-8 md:mb-12 print:mb-0 print:shadow-none print:break-after-page print:min-h-screen flex flex-col">
                    <div className="bg-gradient-to-r from-[#1a237e] to-[#311b92] text-white px-8 py-6 flex justify-between items-center" style={{ color: 'white' }}>
                        <h2 className="text-xl font-bold tracking-wide" style={{ color: 'white' }}>Scores and History</h2>
                        <span className="opacity-80 font-medium" style={{ color: 'white' }}>Full Performance Summary</span>
                    </div>
                    
                    <div className="p-10 md:p-16 flex-1">
                        {/* Total Score Circle */}
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-12 justify-center md:justify-start">
                            <div className="flex flex-col items-center">
                                <div className="w-48 h-48 rounded-full border-8 border-[#1a237e] flex flex-col items-center justify-center relative bg-white shadow-xl">
                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                        <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="#f1f1f1" strokeWidth="8" />
                                        <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="#1a237e" strokeWidth="8" strokeDasharray={`${(totalScore/1600)*100} 100`} pathLength="100" />
                                    </svg>
                                    <span className="text-sm font-bold text-gray-500 uppercase tracking-tighter">Total Score</span>
                                    <span className="text-6xl font-black text-[#1a237e] leading-none my-1">{totalScore}</span>
                                    <span className="text-xs text-gray-400 font-bold">400 to 1600</span>
                                </div>
                            </div>
                            
                            <div className="flex gap-8 md:gap-12 mt-4 md:mt-10">
                                <div className="flex flex-col items-center">
                                    <div className="w-32 h-32 rounded-full border-4 border-[#1a237e]/20 flex flex-col items-center justify-center relative bg-gray-50 shadow-inner">
                                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                                            <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="#e0e0e0" strokeWidth="4" />
                                            <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="#1a237e" strokeWidth="4" strokeDasharray={`${(mathScore/800)*100} 100`} pathLength="100" />
                                        </svg>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Math</span>
                                        <span className="text-3xl font-black text-[#1a237e]">{mathScore}</span>
                                        <span className="text-[8px] text-gray-400">200 to 800</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="w-32 h-32 rounded-full border-4 border-[#1a237e]/20 flex flex-col items-center justify-center relative bg-gray-50 shadow-inner">
                                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                                            <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="#e0e0e0" strokeWidth="4" />
                                            <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="#1a237e" strokeWidth="4" strokeDasharray={`${(rwScore/800)*100} 100`} pathLength="100" />
                                        </svg>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase text-center leading-none">Reading &<br/>Writing</span>
                                        <span className="text-3xl font-black text-[#1a237e] mt-1">{rwScore}</span>
                                        <span className="text-[8px] text-gray-400">200 to 800</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Score breakdown table */}
                        <div className="mt-12 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                            <table className="w-full text-sm border-collapse bg-white">
                                <thead>
                                    <tr className="bg-[#1a237e] text-white">
                                        <th className="text-left py-4 px-6 font-black uppercase tracking-wider text-xs">Section</th>
                                        <th className="text-center py-4 px-4 font-black uppercase tracking-wider text-xs">Correct</th>
                                        <th className="text-center py-4 px-4 font-black uppercase tracking-wider text-xs">Total</th>
                                        <th className="text-center py-4 px-4 font-black uppercase tracking-wider text-xs">Accuracy</th>
                                        <th className="text-center py-4 px-4 font-black uppercase tracking-wider text-xs">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-gray-200 bg-white">
                                        <td className="py-5 px-6 font-black text-base" style={{ color: '#000000' }}>Reading & Writing</td>
                                        <td className="py-5 px-4 text-center font-bold text-base" style={{ color: '#000000' }}>{rwCorrectQ}</td>
                                        <td className="py-5 px-4 text-center text-base" style={{ color: '#000000' }}>{rwTotalQ}</td>
                                        <td className="py-5 px-4 text-center text-base" style={{ color: '#000000' }}>{rwTotalQ > 0 ? Math.round(rwCorrectQ/rwTotalQ*100) : 0}%</td>
                                        <td className="py-5 px-4 text-center font-black text-xl" style={{ color: '#1a237e' }}>{rwScore}</td>
                                    </tr>
                                    <tr className="border-b border-gray-200 bg-gray-50">
                                        <td className="py-5 px-6 font-black text-base" style={{ color: '#000000' }}>Math</td>
                                        <td className="py-5 px-4 text-center font-bold text-base" style={{ color: '#000000' }}>{mathCorrectQ}</td>
                                        <td className="py-5 px-4 text-center text-base" style={{ color: '#000000' }}>{mathTotalQ}</td>
                                        <td className="py-5 px-4 text-center text-base" style={{ color: '#000000' }}>{mathTotalQ > 0 ? Math.round(mathCorrectQ/mathTotalQ*100) : 0}%</td>
                                        <td className="py-5 px-4 text-center font-black text-xl" style={{ color: '#1a237e' }}>{mathScore}</td>
                                    </tr>
                                    <tr className="bg-[#1a237e]" style={{ color: '#ffffff' }}>
                                        <td className="py-6 px-6 font-black text-lg" style={{ color: '#ffffff' }}>Total SAT Score</td>
                                        <td className="py-6 px-4 text-center font-bold text-lg" style={{ color: '#ffffff' }}>{rwCorrectQ + mathCorrectQ}</td>
                                        <td className="py-6 px-4 text-center text-lg" style={{ color: '#ffffff' }}>{rwTotalQ + mathTotalQ}</td>
                                        <td className="py-6 px-4 text-center text-lg" style={{ color: '#ffffff' }}>{(rwTotalQ+mathTotalQ) > 0 ? Math.round((rwCorrectQ+mathCorrectQ)/(rwTotalQ+mathTotalQ)*100) : 0}%</td>
                                        <td className="py-6 px-4 text-center font-black text-2xl" style={{ color: '#fde047' }}>{totalScore}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="py-4 mt-auto text-center text-xs text-gray-400 border-t border-gray-100">aiprep365.com</div>
                </div>

                {/* PAGE 3: Answer Summary */}
                <div className="bg-white shadow-2xl overflow-hidden mb-8 md:mb-12 print:mb-0 print:shadow-none print:break-after-page print:min-h-screen flex flex-col">
                    <div className="p-10 md:p-16 flex-1">
                        <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight border-b-2 border-gray-100 pb-4">Answer Summary</h2>
                        {/* Legend */}
                        <div className="flex items-center gap-6 mb-8 text-sm font-semibold">
                            <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-green-500"></div> Correct answer</div>
                            <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-red-500"></div> Incorrect answer</div>
                        </div>
                        {/* Module columns */}
                        <div className="flex flex-wrap gap-4 print:flex-nowrap print:flex-row print:gap-1.5 print:w-full">
                            {moduleHistory.map((mKey, colIdx) => {
                                const qs = moduleAnswers[mKey] || [];
                                return (
                                    <div key={colIdx} className="w-full md:flex-1 print:w-[24.5%] bg-gray-50 rounded-xl p-3 print:p-2 print:bg-gray-50 print:break-inside-avoid shadow-sm border border-gray-100 print:border-gray-200 flex flex-col">
                                        <div className="font-black text-center text-gray-800 text-[10px] mb-3 pb-2 border-b border-gray-200 leading-tight uppercase tracking-wider print:mb-2 print:pb-1">
                                            {getModuleLabel(mKey)}
                                        </div>
                                        {/* Column headers */}
                                        <div className="flex text-[8px] font-black text-gray-400 text-center mb-2 uppercase tracking-tighter w-full">
                                            <span className="w-[15%]">#</span>
                                            <span className="w-[30%] leading-none">Your<br/>Ans</span>
                                            <span className="w-[30%] leading-none">Cor<br/>rect</span>
                                            <span className="w-[25%]">Tag</span>
                                        </div>
                                        {/* Rows */}
                                        <div className="flex-1 space-y-0.5">
                                            {qs.map((q, idx) => (
                                                <div key={idx} className="flex text-[9px] text-center py-1 border-b border-gray-100/50 items-center w-full print:py-0.5">
                                                    <span className="w-[15%] text-gray-400 font-bold">{idx + 1}</span>
                                                    <div className="w-[30%] flex justify-center">
                                                        <span className={`w-4 h-4 flex items-center justify-center rounded-sm text-white font-black text-[8px] ${q.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                                                            {q.userAnswer || '—'}
                                                        </span>
                                                    </div>
                                                    <span className="w-[30%] text-gray-700 font-bold">{q.correctAnswer || '—'}</span>
                                                    <span className="w-[25%] text-gray-400 text-[7px] font-medium truncate px-0.5">{(q.topic || '').substring(0, 4)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="py-4 mt-auto text-center text-xs text-gray-400 border-t border-gray-100">aiprep365.com</div>
                </div>

                {/* PAGE 4: Time-Based Analysis */}
                <div className="bg-white shadow-2xl overflow-hidden mb-8 md:mb-12 print:mb-0 print:shadow-none print:break-after-page print:min-h-screen flex flex-col">
                    <div className="bg-gradient-to-r from-[#0d47a1] to-[#1565c0] text-white px-8 py-6 flex justify-between items-center" style={{ color: 'white' }}>
                        <h2 className="text-xl font-bold tracking-wide" style={{ color: 'white' }}>Time-Based Analysis</h2>
                        <span className="opacity-80 font-medium" style={{ color: 'white' }}>Pacing & Performance Insights</span>
                    </div>

                    <div className="p-8 md:p-12 flex-1">
                        {!hasTimeData ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-gray-400 font-bold">Time data not available for this attempt.</p>
                                <p className="text-gray-300 text-sm mt-1">Retake the test to see per-question pacing insights.</p>
                            </div>
                        ) : (
                            <>
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                                    {[
                                        { label: 'Total Time', value: formatTimeDisplay(timeAnalysis.totalTime), sub: 'entire test', color: '#1a237e' },
                                        { label: 'Avg / Question', value: `${timeAnalysis.totalAvg}s`, sub: 'across all sections', color: '#1a237e' },
                                        { label: 'R&W Section', value: formatTimeDisplay(timeAnalysis.sections.rw.totalTime), sub: `avg ${timeAnalysis.sections.rw.avgTime}s/q`, color: '#4a148c' },
                                        { label: 'Math Section', value: formatTimeDisplay(timeAnalysis.sections.math.totalTime), sub: `avg ${timeAnalysis.sections.math.avgTime}s/q`, color: '#e65100' },
                                    ].map((card, i) => (
                                        <div key={i} className="rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center bg-white">
                                            <div className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">{card.label}</div>
                                            <div className="text-3xl font-black" style={{ color: card.color }}>{card.value}</div>
                                            <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Section-by-Section Tables */}
                                {['rw', 'math'].map(secKey => {
                                    const sec = timeAnalysis.sections[secKey];
                                    const slowThresh = sec.avgTime * 2;
                                    const fastThresh = sec.avgTime * 0.5;
                                    return (
                                        <div key={secKey} className="mb-10">
                                            {/* Section Header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-900">{sec.label}</h3>
                                                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                                                        {sec.questions.length} questions · Total: {formatTimeDisplay(sec.totalTime)} · Avg: {sec.avgTime}s/question
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] font-bold">
                                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-100 border-2 border-red-400 inline-block"></span> Slow (&gt;{Math.round(slowThresh)}s)</span>
                                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-100 border-2 border-green-400 inline-block"></span> Fast (&lt;{Math.round(fastThresh)}s)</span>
                                                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-100 border-2 border-gray-300 inline-block"></span> Normal</span>
                                                </div>
                                            </div>

                                            {/* Bar Chart */}
                                            <div className="overflow-x-auto mb-4">
                                                <div className="flex items-end gap-1 h-24 min-w-full" style={{ minWidth: `${sec.questions.length * 22}px` }}>
                                                    {sec.questions.map((q, idx) => {
                                                        const t = q.timeSpent;
                                                        const maxTime = Math.max(...sec.questions.map(qq => qq.timeSpent), 1);
                                                        const heightPct = maxTime > 0 ? (t / maxTime) * 100 : 0;
                                                        const isSlow = t > slowThresh && sec.avgTime > 0;
                                                        const isFast = t < fastThresh && t > 0 && sec.avgTime > 0;
                                                        const barColor = isSlow ? '#ef4444' : isFast ? '#22c55e' : '#6366f1';
                                                        return (
                                                            <div key={idx} className="flex flex-col items-center" style={{ minWidth: '18px', flex: '1' }}>
                                                                <div
                                                                    className="w-full rounded-t-sm transition-all"
                                                                    style={{ height: `${Math.max(heightPct, 4)}%`, backgroundColor: barColor, opacity: 0.85 }}
                                                                    title={`Q${q.qNum}: ${t}s`}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex gap-1 mt-1" style={{ minWidth: `${sec.questions.length * 22}px` }}>
                                                    {sec.questions.map((q, idx) => (
                                                        <div key={idx} className="text-center text-[8px] text-gray-400" style={{ minWidth: '18px', flex: '1' }}>{q.qNum}</div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Detail Table */}
                                            <div className="overflow-hidden rounded-xl border border-gray-200">
                                                <table className="w-full text-xs border-collapse">
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#1a237e', color: '#ffffff' }}>
                                                            <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>#</th>
                                                            <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>Topic</th>
                                                            <th className="text-center py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>Your Ans</th>
                                                            <th className="text-center py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>Correct</th>
                                                            <th className="text-center py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>Result</th>
                                                            <th className="text-center py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>Time</th>
                                                            <th className="text-center py-3 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: '#ffffff' }}>Pace</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {sec.questions.map((q, idx) => {
                                                            const t = q.timeSpent;
                                                            const isSlow = t > slowThresh && sec.avgTime > 0;
                                                            const isFast = t < fastThresh && t > 0 && sec.avgTime > 0;
                                                            return (
                                                                <tr key={idx} className={isSlow ? 'border-l-4 border-l-red-500' : isFast ? 'border-l-4 border-l-green-500' : ''} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f5f7ff', borderBottom: '1px solid #e5e7eb' }}>
                                                                    <td className="py-2.5 px-4 font-black" style={{ color: '#111827', fontSize: '12px' }}>{q.qNum}</td>
                                                                    <td className="py-2.5 px-4 font-semibold" style={{ color: '#1f2937', fontSize: '11px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.topic || 'General'}>{(q.topic || 'General').substring(0, 22)}</td>
                                                                    <td className="py-2.5 px-4 text-center font-black" style={{ color: q.userAnswer ? '#374151' : '#9ca3af', fontSize: '12px' }}>{q.userAnswer || '—'}</td>
                                                                    <td className="py-2.5 px-4 text-center font-black" style={{ color: '#1a237e', fontSize: '12px' }}>{q.correctAnswer || '—'}</td>
                                                                    <td className="py-2.5 px-4 text-center">
                                                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-black ${q.isCorrect ? 'bg-green-500' : q.userAnswer ? 'bg-red-500' : 'bg-gray-300'}`}>
                                                                            {q.isCorrect ? '✓' : q.userAnswer ? '✗' : '○'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-center font-black" style={{ color: isSlow ? '#dc2626' : isFast ? '#16a34a' : '#374151', fontSize: '12px' }}>
                                                                        {t > 0 ? `${t}s` : <span style={{ color: '#9ca3af' }}>—</span>}
                                                                    </td>
                                                                    <td className="py-2.5 px-4 text-center">
                                                                        {t === 0 ? <span style={{ color: '#d1d5db', fontSize: '10px' }}>—</span>
                                                                        : isSlow ? <span style={{ padding: '2px 8px', borderRadius: '999px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '900', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slow</span>
                                                                        : isFast ? <span style={{ padding: '2px 8px', borderRadius: '999px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: '900', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fast</span>
                                                                        : <span style={{ padding: '2px 8px', borderRadius: '999px', backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: '900', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Normal</span>}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Legend / Insight Footer */}
                                <div className="mt-6 p-5 rounded-2xl bg-blue-50 border border-blue-100">
                                    <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-2">How to read this</p>
                                    <ul className="text-xs text-blue-800 space-y-1 font-medium">
                                        <li>🔴 <strong>Slow</strong>: Time &gt; 2× section average — may indicate difficulty or confusion</li>
                                        <li>🟢 <strong>Fast</strong>: Time &lt; 0.5× section average — great pacing or possible guessing</li>
                                        <li>🔵 <strong>Normal</strong>: Time within expected range for SAT</li>
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="py-4 mt-auto text-center text-xs text-gray-400 border-t border-gray-100">aiprep365.com</div>
                </div>

                {/* PAGE 4: Reading & Writing */}
                <div className="bg-white shadow-2xl overflow-hidden mb-8 md:mb-12 print:mb-0 print:shadow-none print:break-after-page print:min-h-screen flex flex-col">
                    <div className="bg-[#1a237e] text-white flex justify-between items-center px-6 md:px-8 py-4 border-b border-white/20" style={{ color: 'white' }}>
                        <h2 className="text-xl font-bold tracking-wide" style={{ color: 'white' }}>Reading & Writing</h2>
                        <span className="font-bold" style={{ color: 'white' }}>Section 1/2</span>
                    </div>
                    <div className="bg-gradient-to-r from-[#1a237e] via-[#4a148c] to-[#e65100] p-8 md:p-12 text-white flex flex-col md:flex-row items-center gap-8 md:gap-12">
                        <div className="w-48 h-48 rounded-full border-4 border-white/20 flex flex-col items-center justify-center relative shrink-0">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="white" strokeWidth="4" strokeDasharray={`${(rwScore/800)*100} 100`} pathLength="100" />
                            </svg>
                            <span className="text-xl font-medium">Score</span>
                            <span className="text-5xl font-black tracking-tighter my-1">{rwScore}</span>
                            <span className="text-sm text-white/80 font-medium">{rwCorrectQ} out of {rwTotalQ}</span>
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="text-sm font-medium mb-6 uppercase tracking-wider text-white/80">Knowledge of the topics</h3>
                            <div className="flex gap-8">
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-green-500 flex flex-col items-center justify-center bg-white/5">
                                        <span className="text-3xl font-black">{rwClassified.mastered.length}</span>
                                    </div>
                                    <span className="text-xs text-center mt-3 font-bold opacity-80 max-w-[80px]">Topics<br/>Mastered</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-yellow-500 flex flex-col items-center justify-center bg-white/5">
                                        <span className="text-3xl font-black">{rwClassified.review.length}</span>
                                    </div>
                                    <span className="text-xs text-center mt-3 font-bold opacity-80 max-w-[80px]">Topics for<br/>Review</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-red-500 flex flex-col items-center justify-center bg-white/5">
                                        <span className="text-3xl font-black">{rwClassified.instruction.length}</span>
                                    </div>
                                    <span className="text-xs text-center mt-3 font-bold opacity-80 max-w-[80px]">Topics for<br/>Instruction</span>
                                </div>
                            </div>
                            <div className="text-xs font-medium text-white/60 mt-6">Total topics: {rwClassified.all.length}</div>
                        </div>
                    </div>
                    
                    <div className="p-12">
                        <h3 className="text-2xl font-black text-gray-900 mb-8 tracking-tight">Strengths & Weaknesses</h3>
                        <div className="space-y-6">
                            {rwClassified.all.sort((a,b) => b.percentage - a.percentage).map((topic, i) => (
                                <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-4">
                                    <div className="flex items-center gap-4">
                                        <span className={`w-12 py-1 text-center text-xs font-bold rounded-md text-white ${
                                            topic.percentage >= 80 ? 'bg-green-500' :
                                            topic.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}>
                                            {topic.percentage}%
                                        </span>
                                        <span className="text-gray-600 font-semibold">{topic.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex gap-1">
                                            {Array.from({length: topic.total}).map((_, idx) => (
                                                <div key={idx} className={`w-3 h-3 rounded-full ${idx < topic.correct ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            ))}
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 w-12 text-right">{topic.correct} of {topic.total}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="py-6 mt-auto text-center text-xs text-gray-400 border-t border-gray-100">
                        aiprep365.com
                    </div>
                </div>

                {/* PAGE 3: Math */}
                <div className="bg-white shadow-2xl overflow-hidden mb-8 md:mb-12 print:mb-0 print:shadow-none print:break-after-page print:min-h-screen flex flex-col">
                    <div className="bg-[#1a237e] text-white flex justify-between items-center px-6 md:px-8 py-4 border-b border-white/20" style={{ color: 'white' }}>
                        <h2 className="text-xl font-bold tracking-wide" style={{ color: 'white' }}>Math</h2>
                        <span className="font-bold" style={{ color: 'white' }}>Section 2/2</span>
                    </div>
                    <div className="bg-gradient-to-r from-[#1a237e] via-[#4a148c] to-[#e65100] p-8 md:p-12 text-white flex flex-col md:flex-row items-center gap-8 md:gap-12">
                        <div className="w-48 h-48 rounded-full border-4 border-white/20 flex flex-col items-center justify-center relative shrink-0">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="white" strokeWidth="4" strokeDasharray={`${(mathScore/800)*100} 100`} pathLength="100" />
                            </svg>
                            <span className="text-xl font-medium">Score</span>
                            <span className="text-5xl font-black tracking-tighter my-1">{mathScore}</span>
                            <span className="text-sm text-white/80 font-medium">{mathCorrectQ} out of {mathTotalQ}</span>
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="text-sm font-medium mb-6 uppercase tracking-wider text-white/80">Knowledge of the topics</h3>
                            <div className="flex gap-8">
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-green-500 flex flex-col items-center justify-center bg-white/5">
                                        <span className="text-3xl font-black">{mathClassified.mastered.length}</span>
                                    </div>
                                    <span className="text-xs text-center mt-3 font-bold opacity-80 max-w-[80px]">Topics<br/>Mastered</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-yellow-500 flex flex-col items-center justify-center bg-white/5">
                                        <span className="text-3xl font-black">{mathClassified.review.length}</span>
                                    </div>
                                    <span className="text-xs text-center mt-3 font-bold opacity-80 max-w-[80px]">Topics for<br/>Review</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-red-500 flex flex-col items-center justify-center bg-white/5">
                                        <span className="text-3xl font-black">{mathClassified.instruction.length}</span>
                                    </div>
                                    <span className="text-xs text-center mt-3 font-bold opacity-80 max-w-[80px]">Topics for<br/>Instruction</span>
                                </div>
                            </div>
                            <div className="text-xs font-medium text-white/60 mt-6">Total topics: {mathClassified.all.length}</div>
                        </div>
                    </div>
                    
                    <div className="p-12">
                        <h3 className="text-2xl font-black text-gray-900 mb-8 tracking-tight">Strengths & Weaknesses</h3>
                        <div className="space-y-6">
                            {mathClassified.all.sort((a,b) => b.percentage - a.percentage).map((topic, i) => (
                                <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-4">
                                    <div className="flex items-center gap-4">
                                        <span className={`w-12 py-1 text-center text-xs font-bold rounded-md text-white ${
                                            topic.percentage >= 80 ? 'bg-green-500' :
                                            topic.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}>
                                            {topic.percentage}%
                                        </span>
                                        <span className="text-gray-600 font-semibold">{topic.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex gap-1">
                                            {Array.from({length: topic.total}).map((_, idx) => (
                                                <div key={idx} className={`w-3 h-3 rounded-full ${idx < topic.correct ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            ))}
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 w-12 text-right">{topic.correct} of {topic.total}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="py-6 mt-auto text-center text-xs text-gray-400 border-t border-gray-100">
                        aiprep365.com
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DemoReport;
