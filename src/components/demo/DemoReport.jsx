import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiPrinter, FiArrowLeft, FiCheck, FiX, FiMinus } = FiIcons;

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
                <div className="bg-white shadow-2xl overflow-hidden mb-8 md:mb-12 print:mb-0 print:shadow-none print:break-after-page print:break-inside-avoid-page print:h-screen flex flex-col w-full relative">
                    <div className="flex-[3] bg-gradient-to-br from-[#1a237e] via-[#311b92] to-[#e65100] p-8 md:p-16 flex flex-col relative z-10" style={{ color: 'white' }}>
                        {/* Header Info */}
                        <div className="flex justify-between items-start">
                            <div className="space-y-1 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                <div>{formatDate(completedAt)} (Demo FULL LENGTH TEST)</div>
                                <div>Test Version: Digital SAT</div>
                                <div>Pace: Standard</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-[#E53935] font-black tracking-tighter text-2xl" style={{ WebkitTextFillColor: '#E53935' }}>AIPrep365</span>
                            </div>
                        </div>

                        {/* Title and Score Area - Flex Layout to prevent overlap */}
                        <div className="mt-auto flex flex-col md:flex-row print:flex-row justify-between items-start md:items-end print:items-end gap-8 pt-16 md:pt-24 pb-4 md:pb-8">
                            <div className="flex-1 max-w-[100%] md:max-w-[60%]">
                                <h1 className="text-4xl md:text-7xl print:text-7xl font-black leading-none tracking-tight uppercase break-words" style={{ color: 'white' }}>
                                    {studentName}
                                </h1>
                                <div className="mt-16 text-sm font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                    prepared by<br/>
                                    AIPrep365 Platform<br/>
                                    aiprep365.com
                                </div>
                            </div>

                            {/* Score Circle (No Overhang in print to prevent clipping) */}
                            <div className="shrink-0 mb-0 md:-mb-40 print:mb-8 mr-0 md:mr-12 print:mr-12 relative z-20 mx-auto md:mx-0">
                                <div className="w-56 h-56 md:w-80 md:h-80 print:w-80 print:h-80 rounded-full border-[12px] border-white/30 flex flex-col items-center justify-center backdrop-blur-md print:backdrop-blur-none bg-white/20 print:bg-transparent relative shadow-2xl print:shadow-none">
                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                        <circle cx="50%" cy="50%" r="46%" fill="transparent" stroke="white" strokeWidth="8" strokeDasharray={`${(totalScore/1600)*100} 100`} pathLength="100" />
                                    </svg>
                                    <span className="text-2xl font-bold" style={{ color: 'white' }}>Score</span>
                                    <span className="text-7xl md:text-8xl print:text-8xl font-black tracking-tighter" style={{ color: 'white' }}>{totalScore}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Bottom White Section */}
                    <div className="flex-[1] min-h-[300px] bg-white p-8 md:p-16 flex flex-col justify-end border-b-[16px] border-gray-50">
                         <div className="pl-4 border-l-4 border-black space-y-8 relative ml-8 mb-8">
                             <div className="relative">
                                 <div className="absolute -left-[27px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-4 border-black"></div>
                                 <h3 className="text-xl font-black text-gray-900" style={{ color: '#111' }}>Scores and history</h3>
                             </div>
                             <div className="relative">
                                 <div className="absolute -left-[27px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-4 border-black"></div>
                                 <h3 className="text-xl font-black text-gray-900" style={{ color: '#111' }}>Answer Summary</h3>
                             </div>
                             <div className="relative">
                                 <div className="absolute -left-[27px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-4 border-black"></div>
                                 <h3 className="text-xl font-black text-gray-900" style={{ color: '#111' }}>Data (for tutor use)</h3>
                             </div>
                         </div>
                         <div className="text-center w-full text-xs text-gray-400 font-bold uppercase tracking-widest mt-auto">
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {moduleHistory.map((mKey, colIdx) => {
                                const qs = moduleAnswers[mKey] || [];
                                return (
                                    <div key={colIdx} className="bg-gray-50 rounded-xl p-3">
                                        <div className="font-black text-center text-gray-800 text-xs mb-3 pb-2 border-b border-gray-200 leading-tight">
                                            {getModuleLabel(mKey)}
                                        </div>
                                        {/* Column headers */}
                                        <div className="grid grid-cols-4 text-[9px] font-bold text-gray-500 text-center mb-1">
                                            <span className="col-span-1">#</span>
                                            <span className="col-span-1 leading-tight">Your<br/>Ans</span>
                                            <span className="col-span-1 leading-tight">Cor<br/>rect</span>
                                            <span className="col-span-1">Tag</span>
                                        </div>
                                        {/* Rows */}
                                        {qs.map((q, idx) => (
                                            <div key={idx} className="grid grid-cols-4 text-[10px] text-center py-0.5 border-b border-gray-100 items-center">
                                                <span className="text-gray-500 font-medium">{idx + 1}</span>
                                                <span className={`mx-auto w-5 h-5 flex items-center justify-center rounded text-white font-bold text-[9px] ${q.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                                                    {q.userAnswer || '—'}
                                                </span>
                                                <span className="text-gray-700 font-semibold">{q.correctAnswer || '—'}</span>
                                                <span className="text-gray-400 text-[8px] truncate">{(q.topic || '').substring(0, 4)}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
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
