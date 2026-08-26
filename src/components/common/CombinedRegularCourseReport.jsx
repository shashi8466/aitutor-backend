import React, { useState, useMemo } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';

const { FiArrowLeft, FiPrinter, FiCalendar, FiClock, FiCheckCircle, FiAlertCircle } = FiIcons;

const CombinedRegularCourseReport = ({ submission, topicReportData, studentName: propStudentName, initialTab: propInitialTab, onExit }) => {
    const searchParams = new URLSearchParams(window.location.search);
    const initialTab = propInitialTab || (searchParams.get('view') === 'question-wise' ? 'question-wise' : 'full');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [currentReviewQIndex, setCurrentReviewQIndex] = useState(0);

    // --- DATA AGGREGATION & NORMALIZATION LAYER ---
    const aggregated = useMemo(() => {
        const sourceData = topicReportData || submission || {};
        
        let rawMeta = {};
        try {
            rawMeta = typeof sourceData.metadata === 'string' ? JSON.parse(sourceData.metadata) : (sourceData.metadata || {});
        } catch (e) {
            console.error("Failed to parse metadata:", e);
        }

        const student = (
            propStudentName || 
            sourceData.studentName || 
            sourceData.profiles?.name || 
            sourceData.user?.name || 
            sourceData.student_name || 
            'SHASHI'
        ).toUpperCase();

        const topic = (
            sourceData.topicName || 
            sourceData.courseName || 
            sourceData.course?.name || 
            sourceData.courses?.name || 
            'NONLINEAR FUNCTIONS'
        ).toUpperCase();

        const rawDate = sourceData.date || sourceData.created_at || sourceData.test_date || Date.now();
        const formattedDate = new Date(rawDate).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        const formattedTime = new Date(rawDate).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Extract responses from all possible shapes
        let rawResponses = [];
        if (sourceData.combinedResponses && Array.isArray(sourceData.combinedResponses)) {
            rawResponses = sourceData.combinedResponses;
        } else if (sourceData.responses && Array.isArray(sourceData.responses)) {
            rawResponses = sourceData.responses;
        } else if (sourceData.levels) {
            ['Easy', 'Medium', 'Hard'].forEach(lvl => {
                const lvlObj = sourceData.levels[lvl];
                const qs = lvlObj?.questions || lvlObj?.latest?.responses || lvlObj?.responses || [];
                qs.forEach(q => {
                    rawResponses.push({ ...q, section: lvl });
                });
            });
        } else if (rawMeta.responses && Array.isArray(rawMeta.responses)) {
            rawResponses = rawMeta.responses;
        }

        // Normalize response fields
        const allResponses = rawResponses.map((r, idx) => {
            if (!r) return null;
            const q = r.question || {};
            const topicName = r.topic || q.topic || r.subject || q.subject || topic;
            const sectionName = r.section || r.level || q.difficulty || 'Medium';

            let normalizedSection = String(sectionName).trim();
            normalizedSection = normalizedSection.charAt(0).toUpperCase() + normalizedSection.slice(1).toLowerCase();

            const isCorrect = r.is_correct ?? r.isCorrect ?? (r.selected_answer && r.selected_answer === (r.correct_answer || q.correct_answer));
            const studentAns = r.selected_answer || r.studentAnswer || r.student_answer || (r.is_unattempted ? 'Unattempted' : 'Not recorded');
            const correctAns = r.correct_answer || r.correctAnswer || q.correct_answer || 'A';
            const timeSec = Number(r.time_taken || r.time_spent || r.timeTaken || q.time_taken || q.time_spent || 0);

            return {
                ...r,
                id: r.id || r.question_id || r.questionId || idx + 1,
                section: normalizedSection,
                topic: String(topicName),
                is_correct: !!isCorrect,
                isCorrect: !!isCorrect,
                selected_answer: studentAns,
                studentAnswer: studentAns,
                correct_answer: correctAns,
                correctAnswer: correctAns,
                time_taken: timeSec,
                timeTaken: timeSec
            };
        }).filter(Boolean);

        // Group responses by level
        const easyQs = allResponses.filter(r => r.section.toLowerCase() === 'easy');
        const mediumQs = allResponses.filter(r => r.section.toLowerCase() === 'medium');
        const hardQs = allResponses.filter(r => r.section.toLowerCase() === 'hard');

        const calculateLevel = (qs, levelName) => {
            const levelBackendObj = sourceData.levels?.[levelName] || {};
            const totalQ = qs.length || levelBackendObj.totalQ || 0;
            const correct = qs.filter(q => q.isCorrect).length || levelBackendObj.correct || 0;
            const incorrect = qs.filter(q => !q.isCorrect && q.studentAnswer !== 'Not recorded' && q.studentAnswer !== 'Unattempted').length || levelBackendObj.incorrect || 0;
            const unanswered = qs.filter(q => q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted').length || levelBackendObj.unanswered || 0;
            const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : (levelBackendObj.score || 0);
            const rawScoreText = `${correct} / ${totalQ}`;
            // A single-attempt report (e.g. one topic quiz, no true multi-level combine) has no
            // per-level backend data (`levelBackendObj` is {}), so this used to always fall back
            // to a crude percent->200-800 approximation - silently ignoring the actual saved
            // scaled_score for that attempt. When this level's questions ARE the entire report
            // (not one of several genuine level buckets), use the canonical saved score instead.
            const canonicalScaledScore = sourceData.scaled_score ?? sourceData.scaledScore;
            const isSingleAttemptReport = qs.length > 0 && qs.length === allResponses.length;
            const scaledScore = levelBackendObj.scaledScore
                || (isSingleAttemptReport && canonicalScaledScore != null
                    ? canonicalScaledScore
                    : (totalQ > 0 ? Math.round(200 + (accuracy / 100) * 600) : 200));
            const timeSpent = qs.reduce((sum, q) => sum + q.timeTaken, 0) || levelBackendObj.timeSpent || 0;
            const passStatus = accuracy >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT';

            return {
                levelName,
                questions: qs,
                totalQ,
                correct,
                incorrect,
                unanswered,
                accuracy,
                rawScoreText,
                scaledScore,
                timeSpent,
                passStatus
            };
        };

        const easyLevel = calculateLevel(easyQs, 'Easy');
        const mediumLevel = calculateLevel(mediumQs, 'Medium');
        const hardLevel = calculateLevel(hardQs, 'Hard');

        // Combined Overall Performance Calculations
        const totalQuestions = allResponses.length || (easyLevel.totalQ + mediumLevel.totalQ + hardLevel.totalQ);
        const totalCorrect = allResponses.filter(q => q.isCorrect).length || (easyLevel.correct + mediumLevel.correct + hardLevel.correct);
        const totalIncorrect = allResponses.filter(q => !q.isCorrect && q.studentAnswer !== 'Not recorded' && q.studentAnswer !== 'Unattempted').length || (easyLevel.incorrect + mediumLevel.incorrect + hardLevel.incorrect);
        const totalUnanswered = allResponses.filter(q => q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted').length || (easyLevel.unanswered + mediumLevel.unanswered + hardLevel.unanswered);
        
        // Dynamically computed total non-correct questions and incorrect percentage for combined cards
        const totalIncorrectCombined = Math.max(0, totalQuestions - totalCorrect);
        const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        const incorrectPercentage = totalQuestions > 0 ? Math.round((totalIncorrectCombined / totalQuestions) * 100) : 0;
        
        // SAT Scaled Score (200 - 800 Scale). Same canonical-first rule as calculateLevel above:
        // prefer the actual saved score for this attempt over a recomputed approximation. Only
        // relevant for a single-attempt view - a genuine multi-level topicReportData already
        // carries its own correctly-computed sourceData.overall.scaledScore (or null while
        // incomplete, which correctly falls through here too).
        const overallScaledScore = sourceData.overall?.scaledScore || (sourceData.scaled_score ?? sourceData.scaledScore) || (totalQuestions > 0 ? Math.round(200 + (totalCorrect / totalQuestions) * 600) : 200);
        const displayScoreText = `${overallScaledScore} / 800`;

        const totalTime = (easyLevel.timeSpent + mediumLevel.timeSpent + hardLevel.timeSpent) || sourceData.overall?.totalTime || 0;
        const avgTimePerQuestion = totalQuestions > 0 ? Math.round(totalTime / totalQuestions) : 0;

        // Topic / Skill Breakdown for Strengths & Weaknesses
        const subskillsMap = {};
        allResponses.forEach(r => {
            const t = r.topic || topic;
            if (!subskillsMap[t]) subskillsMap[t] = { topic: t, total: 0, correct: 0, questions: [] };
            subskillsMap[t].total++;
            if (r.isCorrect) subskillsMap[t].correct++;
            subskillsMap[t].questions.push(r);
        });

        const subskillPerformance = Object.values(subskillsMap).map(t => ({
            ...t,
            accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0
        })).sort((a, b) => b.accuracy - a.accuracy);

        let strengths = subskillPerformance.filter(s => s.accuracy >= 70).map(s => `${s.topic} (${s.accuracy}%)`);
        let weaknesses = subskillPerformance.filter(s => s.accuracy < 70).map(s => `${s.topic} (${s.accuracy}%)`);

        if (strengths.length === 0 && subskillPerformance.length > 0) {
            strengths = [subskillPerformance[0].topic + ` (${subskillPerformance[0].accuracy}%)`];
        }

        // A combined topic report (topicReportData) is only meaningful once every required
        // difficulty level has actually been attempted. A single-attempt `submission` view
        // (no topicReportData) isn't a combined report, so it's never gated by this.
        const isFullyCompleted = topicReportData ? topicReportData.isFullyCompleted !== false : true;
        const missingLevels = topicReportData?.missingLevels || [];

        return {
            student,
            topic,
            formattedDate,
            formattedTime,
            allResponses,
            easyLevel,
            mediumLevel,
            hardLevel,
            totalQuestions,
            totalCorrect,
            totalIncorrect,
            totalIncorrectCombined,
            totalUnanswered,
            overallAccuracy,
            incorrectPercentage,
            overallScaledScore,
            displayScoreText,
            totalTime,
            avgTimePerQuestion,
            subskillPerformance,
            strengths,
            weaknesses,
            isFullyCompleted,
            missingLevels
        };
    }, [topicReportData, submission, propStudentName]);

    const formatTime = (seconds) => {
        if (!seconds || seconds <= 0) return '0m 0s';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    // Don't fabricate a combined Easy+Medium+Hard report (score, question-wise view, or PDF)
    // until every required level has actually been completed.
    if (!aggregated.isFullyCompleted) {
        return (
            <div className="min-h-screen bg-[#0b1021] text-slate-100 font-sans flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-[#131b2e] border border-slate-800 rounded-2xl p-8 text-center">
                    <button
                        onClick={onExit}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-colors text-sm mb-6"
                    >
                        <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back
                    </button>
                    <SafeIcon icon={FiAlertCircle} className="w-10 h-10 text-amber-400 mx-auto mb-4" />
                    <h2 className="text-xl font-black text-white mb-2">{aggregated.topic}</h2>
                    <p className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-4">Test In Progress</p>
                    <p className="text-sm text-slate-400">
                        This topic isn't fully completed yet. Remaining level{aggregated.missingLevels.length > 1 ? 's' : ''}:{' '}
                        <span className="text-white font-bold">{aggregated.missingLevels.join(', ')}</span>.
                    </p>
                    <p className="text-xs text-slate-500 mt-3">
                        A combined score, question-wise analysis, and PDF report will be available once all levels are completed.
                        Your completed level results are still saved and visible in Test History.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0b1021] text-slate-100 font-sans pb-16" id="report-container">
            
            {/* PRINT CSS SPECIFIC TO DEDICATED PDF RENDER LAYOUT */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media screen {
                    #pdf-print-root {
                        display: none !important;
                    }
                }

                @media print {
                    @page { size: A4 portrait; margin: 10mm 8mm; }
                    
                    /* Hide entire interactive web screen, navigation, sidebars, buttons, widgets */
                    body * {
                        visibility: hidden !important;
                    }
                    header, nav, aside, footer, .no-print, [class*="sidebar"], [class*="navbar"], [class*="Header"], [class*="SalesBot"], button {
                        display: none !important;
                    }

                    /* Reveal ONLY the dedicated PDF layout */
                    #pdf-print-root, #pdf-print-root * {
                        visibility: visible !important;
                    }
                    
                    #pdf-print-root {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }

                    /* High contrast table settings */
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        table-layout: fixed !important;
                        background-color: #ffffff !important;
                    }
                    thead { display: table-header-group !important; }
                    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
                    td, th { word-wrap: break-word !important; overflow-wrap: break-word !important; }
                    .page-break { page-break-before: always !important; break-before: page !important; }
                }
            `}} />

            {/* ========================================================= */}
            {/* 1. INTERACTIVE SCREEN UI REPORT (VISIBLE ON WEB SCREEN)  */}
            {/* ========================================================= */}
            <div className="no-print">
                {/* TOP NAVIGATION BAR WITH TAB SWITCHER */}
                <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center border-b border-slate-800 gap-4">
                    <button
                        onClick={onExit}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-colors text-sm"
                    >
                        <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back
                    </button>

                    {/* View Mode Tab Switcher */}
                    <div className="flex bg-slate-900 border border-slate-700/80 rounded-xl p-1 shadow-inner">
                        <button
                            onClick={() => setActiveTab('full')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'full' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Full Report
                        </button>
                        <button
                            onClick={() => setActiveTab('question-wise')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                activeTab === 'question-wise' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Question-wise Analysis
                        </button>
                    </div>

                    <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-5 py-2 rounded-full shadow-lg shadow-blue-600/30 transition-all text-xs uppercase tracking-wider cursor-pointer"
                    >
                        <SafeIcon icon={FiPrinter} className="w-4 h-4" /> Download PDF
                    </button>
                </div>

                {/* MAIN REPORT SCREEN CARD */}
                <div className="max-w-4xl mx-auto mt-6 bg-[#0a0e24] rounded-3xl shadow-2xl border border-slate-800 overflow-hidden">
                    
                    {activeTab === 'question-wise' ? (
                        /* ========================================================= */
                        /* INTERACTIVE QUESTION-WISE ANALYSIS REVIEWER               */
                        /* ========================================================= */
                        <div className="p-6 sm:p-8 bg-[#0a0e24]">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                                <div>
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                                        Question-wise Analysis — {aggregated.topic}
                                    </span>
                                    <h2 className="text-2xl font-black text-white mt-1">
                                        Question {currentReviewQIndex + 1} of {aggregated.allResponses.length}
                                    </h2>
                                </div>
                                
                                {/* Level Badge */}
                                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                    (aggregated.allResponses[currentReviewQIndex]?.section || '').toLowerCase() === 'easy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                                    (aggregated.allResponses[currentReviewQIndex]?.section || '').toLowerCase() === 'medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                    'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                }`}>
                                    {(aggregated.allResponses[currentReviewQIndex]?.section || 'General').toUpperCase()} LEVEL
                                </span>
                            </div>

                            {/* Current Question Display */}
                            {(() => {
                                const currentQ = aggregated.allResponses[currentReviewQIndex];
                                if (!currentQ) return <p className="text-slate-400">No question data available.</p>;

                                return (
                                    <div className="space-y-6">
                                        {/* Question Content Box */}
                                        <div className="p-6 bg-slate-900 border border-slate-700/80 rounded-2xl">
                                            <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Question Text</div>
                                            <div className="text-base sm:text-lg font-bold text-white leading-relaxed mb-4">
                                                <MathRenderer text={currentQ.questionText || currentQ.question_text || currentQ.topic} />
                                            </div>

                                            {/* Diagram/Image if present */}
                                            {currentQ.image_url && (
                                                <div className="my-4 max-w-xl mx-auto">
                                                    <img src={currentQ.image_url} alt="Question Diagram" className="rounded-xl border border-slate-700 max-h-80 mx-auto object-contain" />
                                                </div>
                                            )}

                                            {/* Options if available */}
                                            {currentQ.options && Array.isArray(currentQ.options) && currentQ.options.length > 0 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                                    {currentQ.options.map((opt, oIdx) => {
                                                        const letter = String.fromCharCode(65 + oIdx);
                                                        return (
                                                            <div key={oIdx} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center font-black text-white text-[11px]">{letter}</span>
                                                                <MathRenderer text={typeof opt === 'string' ? opt : opt.text || ''} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Student Answer, Correct Answer, Result Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className={`p-4 rounded-xl border ${currentQ.isCorrect ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-rose-950/40 border-rose-500/50'}`}>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Student Answer</p>
                                                <p className={`text-xl font-black ${currentQ.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {currentQ.studentAnswer || 'Unattempted'}
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Correct Answer</p>
                                                <p className="text-xl font-black text-emerald-400">
                                                    {currentQ.correctAnswer || 'N/A'}
                                                </p>
                                            </div>

                                            <div className={`p-4 rounded-xl border flex flex-col justify-center items-center ${currentQ.isCorrect ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-rose-500/10 border-rose-500/40'}`}>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Result</p>
                                                <span className={`px-4 py-1 rounded-full text-xs font-black uppercase ${currentQ.isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>
                                                    {currentQ.isCorrect ? 'Correct ✓' : 'Incorrect ✕'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Explanation Box */}
                                        <div className="p-6 bg-slate-900 border border-slate-700/80 rounded-2xl">
                                            <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">Explanation</h4>
                                            <div className="text-sm font-medium text-slate-300 leading-relaxed">
                                                <MathRenderer text={currentQ.explanation || 'See topic materials for step-by-step resolution.'} />
                                            </div>
                                        </div>

                                        {/* Pagination Footer */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
                                            <button
                                                onClick={() => setCurrentReviewQIndex(prev => Math.max(0, prev - 1))}
                                                disabled={currentReviewQIndex === 0}
                                                className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                <SafeIcon icon={FiIcons.FiChevronLeft} className="w-4 h-4" /> Previous Question
                                            </button>

                                            <span className="text-xs font-black text-white uppercase tracking-wider">
                                                Question {currentReviewQIndex + 1} of {aggregated.allResponses.length}
                                            </span>

                                            <button
                                                onClick={() => setCurrentReviewQIndex(prev => Math.min(aggregated.allResponses.length - 1, prev + 1))}
                                                disabled={currentReviewQIndex === aggregated.allResponses.length - 1}
                                                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                Next Question <SafeIcon icon={FiIcons.FiChevronRight} className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Quick Jump Selector Grid */}
                                        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 text-center">Quick Jump</p>
                                            <div className="flex flex-wrap gap-2 justify-center">
                                                {aggregated.allResponses.map((q, qIdx) => (
                                                    <button
                                                        key={qIdx}
                                                        onClick={() => setCurrentReviewQIndex(qIdx)}
                                                        className={`w-7 h-7 rounded-lg font-black text-xs transition-all cursor-pointer ${
                                                            currentReviewQIndex === qIdx ? 'ring-2 ring-blue-400 scale-110' : ''
                                                        } ${
                                                            q.isCorrect ? 'bg-emerald-600 text-white' :
                                                            (q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted') ? 'bg-slate-700 text-slate-300' :
                                                            'bg-rose-600 text-white'
                                                        }`}
                                                    >
                                                        {qIdx + 1}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <>
                    
                    {/* HERO HEADER */}
                    <div className="bg-gradient-to-b from-[#0a0f2c] via-[#0d163a] to-[#070b1e] p-8 sm:p-12 text-center border-b border-slate-800">
                        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-1.5 rounded-full border border-white/15 mb-6">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                            <span className="text-white font-extrabold tracking-[0.2em] uppercase text-[11px]">AIPrep365</span>
                        </div>

                        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase mb-3 drop-shadow-md">
                            {aggregated.student}
                        </h1>

                        <p className="text-blue-300 font-extrabold tracking-wider uppercase text-sm sm:text-base mb-4 max-w-2xl mx-auto">
                            {aggregated.topic} REPORT
                        </p>

                        <div className="flex items-center justify-center gap-3 text-xs sm:text-sm font-semibold text-slate-400 mb-8">
                            <span className="flex items-center gap-1.5"><SafeIcon icon={FiCalendar} className="text-blue-400" /> {aggregated.formattedDate}</span>
                            <span>|</span>
                            <span className="flex items-center gap-1.5"><SafeIcon icon={FiClock} className="text-blue-400" /> {aggregated.formattedTime}</span>
                        </div>

                        {/* OVERALL SCALED SCORE */}
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="8" fill="transparent" />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="42"
                                    stroke="#3b82f6"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray="263.89"
                                    strokeDashoffset={263.89 - (263.89 * (aggregated.overallAccuracy || 10)) / 100}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-300 mb-1">
                                    OVERALL SCALED SCORE
                                </span>
                                <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter">
                                    {aggregated.displayScoreText}
                                </span>
                                <span className="text-[10px] text-blue-400 font-bold uppercase mt-1">
                                    {aggregated.overallAccuracy}% Overall Accuracy
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* OVERALL PERFORMANCE & LEVEL SUMMARY TABLE */}
                    <div className="bg-white text-slate-900 p-6 sm:p-10">
                        <div className="bg-[#0f1738] text-white p-4 rounded-xl flex justify-between items-center mb-6 shadow-md">
                            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider">Scores and History</h2>
                            <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">FULL PERFORMANCE SUMMARY</span>
                        </div>

                        {/* Level Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-slate-50 p-5 rounded-2xl border-2 border-green-200 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="px-3 py-1 bg-green-600 text-white font-black text-xs uppercase tracking-wider rounded-md">EASY LEVEL</span>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded ${aggregated.easyLevel.passStatus === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{aggregated.easyLevel.passStatus}</span>
                                    </div>
                                    <div className="text-4xl font-black text-green-700 mb-1">{aggregated.easyLevel.scaledScore} <span className="text-sm font-bold text-slate-500">/ 800</span></div>
                                    <p className="text-xs font-bold text-slate-700 mb-3">Accuracy: <strong className="text-slate-900">{aggregated.easyLevel.accuracy}%</strong> ({aggregated.easyLevel.correct}/{aggregated.easyLevel.totalQ} Correct)</p>
                                </div>
                                <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 flex justify-between font-bold">
                                    <span>Incorrect: {aggregated.easyLevel.incorrect}</span>
                                    <span>Time: {formatTime(aggregated.easyLevel.timeSpent)}</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-5 rounded-2xl border-2 border-amber-200 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="px-3 py-1 bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-md">MEDIUM LEVEL</span>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded ${aggregated.mediumLevel.passStatus === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{aggregated.mediumLevel.passStatus}</span>
                                    </div>
                                    <div className="text-4xl font-black text-amber-700 mb-1">{aggregated.mediumLevel.scaledScore} <span className="text-sm font-bold text-slate-500">/ 800</span></div>
                                    <p className="text-xs font-bold text-slate-700 mb-3">Accuracy: <strong className="text-slate-900">{aggregated.mediumLevel.accuracy}%</strong> ({aggregated.mediumLevel.correct}/{aggregated.mediumLevel.totalQ} Correct)</p>
                                </div>
                                <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 flex justify-between font-bold">
                                    <span>Incorrect: {aggregated.mediumLevel.incorrect}</span>
                                    <span>Time: {formatTime(aggregated.mediumLevel.timeSpent)}</span>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-5 rounded-2xl border-2 border-red-200 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="px-3 py-1 bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-md">HARD LEVEL</span>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded ${aggregated.hardLevel.passStatus === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{aggregated.hardLevel.passStatus}</span>
                                    </div>
                                    <div className="text-4xl font-black text-red-700 mb-1">{aggregated.hardLevel.scaledScore} <span className="text-sm font-bold text-slate-500">/ 800</span></div>
                                    <p className="text-xs font-bold text-slate-700 mb-3">Accuracy: <strong className="text-slate-900">{aggregated.hardLevel.accuracy}%</strong> ({aggregated.hardLevel.correct}/{aggregated.hardLevel.totalQ} Correct)</p>
                                </div>
                                <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 flex justify-between font-bold">
                                    <span>Incorrect: {aggregated.hardLevel.incorrect}</span>
                                    <span>Time: {formatTime(aggregated.hardLevel.timeSpent)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Level Summary Table on Screen */}
                        <div className="w-full overflow-hidden border-2 border-[#0f1738] rounded-xl shadow-md mb-10 bg-white">
                            <table className="w-full text-left border-collapse table-fixed bg-white">
                                <thead>
                                    <tr className="bg-[#0f1738] text-white text-xs font-black uppercase tracking-wider">
                                        <th className="p-3.5 w-[14%] border-r border-slate-700">LEVEL</th>
                                        <th className="p-3.5 w-[12%] text-center border-r border-slate-700">SCORE</th>
                                        <th className="p-3.5 w-[16%] text-center border-r border-slate-700">SCALED SCORE</th>
                                        <th className="p-3.5 w-[13%] text-center border-r border-slate-700">ACCURACY</th>
                                        <th className="p-3.5 w-[11%] text-center border-r border-slate-700">CORRECT</th>
                                        <th className="p-3.5 w-[12%] text-center border-r border-slate-700">INCORRECT</th>
                                        <th className="p-3.5 w-[11%] text-center border-r border-slate-700">QUESTIONS</th>
                                        <th className="p-3.5 w-[11%] text-center">TIME</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-extrabold divide-y divide-slate-300 bg-white">
                                    <tr className="hover:bg-slate-50 bg-white">
                                        <td className="p-3.5 font-black border-r border-slate-300" style={{ color: '#0f172a' }}>Easy</td>
                                        <td className="p-3.5 text-center font-extrabold border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.easyLevel.rawScoreText}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.easyLevel.scaledScore}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.easyLevel.accuracy}%</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.easyLevel.correct}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.easyLevel.incorrect}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.easyLevel.totalQ}</td>
                                        <td className="p-3.5 text-center font-bold" style={{ color: '#0f172a' }}>{formatTime(aggregated.easyLevel.timeSpent)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50 bg-white">
                                        <td className="p-3.5 font-black border-r border-slate-300" style={{ color: '#0f172a' }}>Medium</td>
                                        <td className="p-3.5 text-center font-extrabold border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.mediumLevel.rawScoreText}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.mediumLevel.scaledScore}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.mediumLevel.accuracy}%</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.mediumLevel.correct}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.mediumLevel.incorrect}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.mediumLevel.totalQ}</td>
                                        <td className="p-3.5 text-center font-bold" style={{ color: '#0f172a' }}>{formatTime(aggregated.mediumLevel.timeSpent)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50 bg-white">
                                        <td className="p-3.5 font-black border-r border-slate-300" style={{ color: '#0f172a' }}>Hard</td>
                                        <td className="p-3.5 text-center font-extrabold border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.hardLevel.rawScoreText}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.hardLevel.scaledScore}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.hardLevel.accuracy}%</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.hardLevel.correct}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.hardLevel.incorrect}</td>
                                        <td className="p-3.5 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{aggregated.hardLevel.totalQ}</td>
                                        <td className="p-3.5 text-center font-bold" style={{ color: '#0f172a' }}>{formatTime(aggregated.hardLevel.timeSpent)}</td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#1e3a8a] text-white text-xs font-black">
                                        <td className="p-3.5 border-r border-blue-900 text-white">Combined</td>
                                        <td className="p-3.5 text-center border-r border-blue-900 text-white font-black">{aggregated.totalCorrect} / {aggregated.totalQuestions}</td>
                                        <td className="p-3.5 text-center border-r border-blue-900 text-yellow-300 font-black">{aggregated.overallScaledScore}</td>
                                        <td className="p-3.5 text-center border-r border-blue-900 text-white font-black">{aggregated.overallAccuracy}%</td>
                                        <td className="p-3.5 text-center border-r border-blue-900 text-white font-black">{aggregated.totalCorrect}</td>
                                        <td className="p-3.5 text-center border-r border-blue-900 text-white font-black">{aggregated.totalIncorrect}</td>
                                        <td className="p-3.5 text-center border-r border-blue-900 text-white font-black">{aggregated.totalQuestions}</td>
                                        <td className="p-3.5 text-center text-white font-black">{formatTime(aggregated.totalTime)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* TIME-BASED ANALYSIS */}
                        <div className="mb-12">
                            <div className="bg-[#1d63b8] text-white p-4 rounded-xl flex justify-between items-center mb-6 shadow-md">
                                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider">Time-Based Analysis</h2>
                                <span className="text-xs font-bold text-blue-100 uppercase tracking-widest">PACING & PERFORMANCE INSIGHTS</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">TOTAL TIME</span>
                                    <span className="text-3xl font-black text-slate-900">{formatTime(aggregated.totalTime)}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">ENTIRE TEST</span>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">AVG / QUESTION</span>
                                    <span className="text-3xl font-black text-slate-900">{aggregated.avgTimePerQuestion}s</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">ACROSS ALL SECTIONS</span>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">MATH SECTION</span>
                                    <span className="text-3xl font-black text-slate-900">{formatTime(aggregated.totalTime)}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">81% PASS</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                                    <span className="text-xs font-black text-green-800 uppercase block mb-1">EASY LEVEL PACING</span>
                                    <span className="text-xl font-black text-green-700">{formatTime(aggregated.easyLevel.timeSpent)}</span>
                                    <span className="text-[10px] text-green-700 font-bold block mt-1">Avg: {aggregated.easyLevel.totalQ > 0 ? Math.round(aggregated.easyLevel.timeSpent / aggregated.easyLevel.totalQ) : 0}s / question</span>
                                </div>
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
                                    <span className="text-xs font-black text-amber-800 uppercase block mb-1">MEDIUM LEVEL PACING</span>
                                    <span className="text-xl font-black text-amber-700">{formatTime(aggregated.mediumLevel.timeSpent)}</span>
                                    <span className="text-[10px] text-amber-700 font-bold block mt-1">Avg: {aggregated.mediumLevel.totalQ > 0 ? Math.round(aggregated.mediumLevel.timeSpent / aggregated.mediumLevel.totalQ) : 0}s / question</span>
                                </div>
                                <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
                                    <span className="text-xs font-black text-red-800 uppercase block mb-1">HARD LEVEL PACING</span>
                                    <span className="text-xl font-black text-red-700">{formatTime(aggregated.hardLevel.timeSpent)}</span>
                                    <span className="text-[10px] text-red-700 font-bold block mt-1">Avg: {aggregated.hardLevel.totalQ > 0 ? Math.round(aggregated.hardLevel.timeSpent / aggregated.hardLevel.totalQ) : 0}s / question</span>
                                </div>
                            </div>
                        </div>

                        {/* QUESTION-WISE ANALYTICS SCREEN TABLE */}
                        <div className="mb-12">
                            <div className="bg-[#0f1738] text-white p-4 rounded-xl flex justify-between items-center mb-6 shadow-md">
                                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider">{aggregated.topic} — Question-Wise Analytics</h2>
                                <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">{aggregated.totalQuestions} TOTAL QUESTIONS</span>
                            </div>

                            {['Easy', 'Medium', 'Hard'].map((lvlName) => {
                                const lvlData = lvlName === 'Easy' ? aggregated.easyLevel : lvlName === 'Medium' ? aggregated.mediumLevel : aggregated.hardLevel;
                                if (lvlData.questions.length === 0) return null;

                                return (
                                    <div key={lvlName} className="mb-8">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-300">
                                            <h3 className={`text-sm sm:text-base font-black uppercase tracking-wider ${
                                                lvlName === 'Easy' ? 'text-green-700' : lvlName === 'Medium' ? 'text-amber-700' : 'text-red-700'
                                            }`}>
                                                {lvlName} Level Questions ({lvlData.questions.length})
                                            </h3>
                                            <span className="text-xs font-extrabold text-slate-700">
                                                {lvlData.correct} / {lvlData.totalQ} Correct ({lvlData.accuracy}%)
                                            </span>
                                        </div>

                                        <div className="w-full overflow-hidden border-2 border-[#0f1738] rounded-xl shadow-sm bg-white">
                                            <table className="w-full text-left border-collapse table-fixed text-xs bg-white">
                                                <thead>
                                                    <tr className="bg-[#0f1738] text-white font-black uppercase tracking-wider text-[11px]">
                                                        <th className="p-3 text-center w-[8%] border-r border-slate-700">#</th>
                                                        <th className="p-3 w-[48%] border-r border-slate-700">TOPIC / SKILL</th>
                                                        <th className="p-3 text-center w-[15%] border-r border-slate-700">YOUR ANS</th>
                                                        <th className="p-3 text-center w-[15%] border-r border-slate-700">CORRECT</th>
                                                        <th className="p-3 text-center w-[14%]">RESULT</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-300 font-extrabold bg-white">
                                                    {lvlData.questions.map((q, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors bg-white">
                                                            <td className="p-3 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{idx + 1}</td>
                                                            <td className="p-3 border-r border-slate-300 break-words font-black leading-tight" style={{ color: '#0f172a' }}>
                                                                {q.topic}
                                                            </td>
                                                            <td className="p-3 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{q.studentAnswer}</td>
                                                            <td className="p-3 text-center font-black border-r border-slate-300" style={{ color: '#0f172a' }}>{q.correctAnswer}</td>
                                                            <td className="p-3 text-center flex justify-center items-center">
                                                                {q.isCorrect ? (
                                                                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-xs shadow-sm">✓</span>
                                                                ) : q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted' ? (
                                                                    <span className="w-6 h-6 rounded-full bg-slate-400 text-white font-black flex items-center justify-center text-xs">-</span>
                                                                ) : (
                                                                    <span className="w-6 h-6 rounded-full bg-rose-600 text-white font-black flex items-center justify-center text-xs shadow-sm">✕</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ========================================================= */}
                    {/* STRENGTHS & WEAKNESSES / TOPIC PERFORMANCE SECTION       */}
                    {/* ========================================================= */}
                    <div className="mt-10 p-6 bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-xl">
                        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-700">
                            <h2 className="text-lg sm:text-xl font-black uppercase text-white tracking-wider">
                                Strengths & Weaknesses
                            </h2>
                        </div>

                        {/* Classification Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* ========================================================= */}
                            {/* CARD 1: STRENGTHS                                         */}
                            {/* ========================================================= */}
                            <div className="p-6 bg-slate-800/90 border-2 border-emerald-500/50 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden">
                                <div>
                                    {/* Header Badge */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-xs">
                                            ✓
                                        </span>
                                        <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                                            STRENGTHS
                                        </span>
                                    </div>

                                    {/* Topic Name */}
                                    <h3 className="text-lg font-black text-white mb-5">{aggregated.topic}</h3>

                                    {/* Metrics Side-by-Side */}
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/80 rounded-xl border border-slate-700/80 mb-4">
                                        <div>
                                            <p className="text-2xl sm:text-3xl font-black text-emerald-400">
                                                {aggregated.totalCorrect} <span className="text-sm text-slate-400 font-bold">/ {aggregated.totalQuestions}</span>
                                            </p>
                                            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">Correct Answers</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl sm:text-3xl font-black text-white">{aggregated.overallAccuracy}%</p>
                                            <p className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider mt-1">Accuracy</p>
                                        </div>
                                    </div>

                                    {/* Text Summary */}
                                    <p className="text-xs text-slate-300 font-medium leading-relaxed mb-4">
                                        You answered <strong className="text-emerald-400 font-bold">{aggregated.totalCorrect} questions</strong> correctly out of {aggregated.totalQuestions}.
                                    </p>
                                </div>

                                {/* Performance Badge */}
                                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-black">
                                    <span className="text-slate-400 uppercase text-[10px] tracking-widest">Performance</span>
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase ${
                                        aggregated.overallAccuracy >= 70 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                        aggregated.overallAccuracy >= 50 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                        'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}>
                                        {aggregated.overallAccuracy >= 70 ? 'Strong performance' : aggregated.overallAccuracy >= 50 ? 'Moderate' : 'Below target'}
                                    </span>
                                </div>
                            </div>

                            {/* ========================================================= */}
                            {/* CARD 2: AREAS FOR IMPROVEMENT                             */}
                            {/* ========================================================= */}
                            <div className="p-6 bg-slate-800/90 border-2 border-rose-500/50 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden">
                                <div>
                                    {/* Header Badge */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-black flex items-center justify-center text-xs">
                                            ✕
                                        </span>
                                        <span className="text-xs font-black uppercase tracking-widest text-rose-400">
                                            AREAS FOR IMPROVEMENT
                                        </span>
                                    </div>

                                    {/* Topic Name */}
                                    <h3 className="text-lg font-black text-white mb-5">{aggregated.topic}</h3>

                                    {/* Metrics Side-by-Side */}
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/80 rounded-xl border border-slate-700/80 mb-4">
                                        <div>
                                            <p className="text-2xl sm:text-3xl font-black text-rose-400">
                                                {aggregated.totalIncorrectCombined} <span className="text-sm text-slate-400 font-bold">/ {aggregated.totalQuestions}</span>
                                            </p>
                                            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">Incorrect Answers</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl sm:text-3xl font-black text-rose-400">
                                                {aggregated.incorrectPercentage}%
                                            </p>
                                            <p className="text-[11px] font-extrabold text-rose-400 uppercase tracking-wider mt-1">Incorrect</p>
                                        </div>
                                    </div>

                                    {/* Text Summary */}
                                    <p className="text-xs text-slate-300 font-medium leading-relaxed mb-4">
                                        You answered <strong className="text-rose-400 font-bold">{aggregated.totalIncorrectCombined} questions</strong> incorrectly out of {aggregated.totalQuestions}.
                                    </p>
                                </div>

                                {/* Priority/Status Badge */}
                                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-black">
                                    <span className="text-slate-400 uppercase text-[10px] tracking-widest">Status</span>
                                    <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                        Needs Significant Improvement
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* QUESTION PERFORMANCE DOTS SECTION FOR ALL QUESTIONS */}
                        <div className="p-5 bg-[#0a0e20] border border-slate-800 rounded-xl">
                            <h3 className="text-sm font-black uppercase tracking-wider text-blue-300 mb-4 flex items-center gap-2">
                                {aggregated.topic.toUpperCase()} — QUESTION PERFORMANCE
                            </h3>

                            {/* Visual Dots Grid */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {aggregated.allResponses.map((q, idx) => (
                                    <div
                                        key={idx}
                                        title={`Q${idx + 1}: ${q.isCorrect ? 'Correct' : 'Incorrect'} (${q.topic})`}
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white transition-all shadow-sm ${
                                            q.isCorrect ? 'bg-emerald-500' :
                                            (q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted') ? 'bg-slate-600' :
                                            'bg-rose-500'
                                        }`}
                                    >
                                        {q.isCorrect ? '✓' : (q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted') ? '-' : '✕'}
                                    </div>
                                ))}
                            </div>

                            {/* Totals Summary */}
                            <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-800 text-xs font-bold text-slate-300 gap-4">
                                <span className="text-white font-black">{aggregated.totalQuestions} Total Questions</span>
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1 text-emerald-400">
                                        <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> {aggregated.totalCorrect} Correct
                                    </span>
                                    <span className="flex items-center gap-1 text-rose-400">
                                        <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> {aggregated.totalIncorrect} Incorrect
                                    </span>
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <span className="w-3 h-3 rounded-full bg-slate-500 inline-block" /> {aggregated.totalUnanswered} Unanswered
                                    </span>
                                </div>
                                <span className="text-blue-400 font-black">Accuracy: {aggregated.overallAccuracy}%</span>
                            </div>
                        </div>
                    </div>
                    </>
                )}
                </div>
            </div>

            {/* ========================================================= */}
            {/* 2. DEDICATED PRINT/PDF RENDER LAYOUT (STANDALONE A4 PDF) */}
            {/* ========================================================= */}
            <div id="pdf-print-root" style={{ width: '100%', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif' }}>
                
                {/* PDF HEADER */}
                <div style={{ backgroundColor: '#0a0e24', color: '#ffffff', padding: '30px', textAlign: 'center', borderBottom: '4px solid #1e3a8a' }}>
                    <div style={{ display: 'inline-block', backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '4px 16px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
                        AIPrep365 Report
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '-1px', margin: '5px 0', color: '#ffffff', textTransform: 'uppercase' }}>
                        {aggregated.student}
                    </h1>
                    <p style={{ fontSize: '14px', fontWeight: '800', color: '#93c5fd', textTransform: 'uppercase', margin: '5px 0 15px 0' }}>
                        {aggregated.topic} REPORT
                    </p>

                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#cbd5e1', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                        <span>Date: {aggregated.formattedDate}</span>
                        <span>Time: {aggregated.formattedTime}</span>
                    </div>

                    {/* OVERALL SCALED SCORE BANNER */}
                    <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px', display: 'inline-block', minWidth: '240px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '900', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            OVERALL SCALED SCORE
                        </div>
                        <div style={{ fontSize: '36px', fontWeight: '900', color: '#ffffff', margin: '4px 0' }}>
                            {aggregated.displayScoreText}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#60a5fa' }}>
                            {aggregated.overallAccuracy}% Overall Accuracy
                        </div>
                    </div>
                </div>

                {/* PDF BODY CONTENT */}
                <div style={{ padding: '25px', backgroundColor: '#ffffff' }}>
                    
                    {/* LEVEL PERFORMANCE SECTION */}
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ backgroundColor: '#0f1738', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px' }}>
                            Level Performance
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', border: '2px solid #0f1738', backgroundColor: '#ffffff' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#0f1738', color: '#ffffff', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '10px', width: '14%', borderRight: '1px solid #334155', textAlign: 'left', color: '#ffffff' }}>LEVEL</th>
                                    <th style={{ padding: '10px', width: '12%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>SCORE</th>
                                    <th style={{ padding: '10px', width: '16%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>SCALED SCORE</th>
                                    <th style={{ padding: '10px', width: '13%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>ACCURACY</th>
                                    <th style={{ padding: '10px', width: '11%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>CORRECT</th>
                                    <th style={{ padding: '10px', width: '12%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>INCORRECT</th>
                                    <th style={{ padding: '10px', width: '11%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>QUESTIONS</th>
                                    <th style={{ padding: '10px', width: '11%', textAlign: 'center', color: '#ffffff' }}>TIME</th>
                                </tr>
                            </thead>
                            <tbody style={{ backgroundColor: '#ffffff' }}>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                                    <td style={{ padding: '10px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'left' }}>Easy</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.easyLevel.rawScoreText}</td>
                                    <td style={{ padding: '10px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.easyLevel.scaledScore}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.easyLevel.accuracy}%</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#15803d', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.easyLevel.correct}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#b91c1c', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.easyLevel.incorrect}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.easyLevel.totalQ}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>{formatTime(aggregated.easyLevel.timeSpent)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                                    <td style={{ padding: '10px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'left' }}>Medium</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.mediumLevel.rawScoreText}</td>
                                    <td style={{ padding: '10px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.mediumLevel.scaledScore}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.mediumLevel.accuracy}%</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#15803d', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.mediumLevel.correct}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#b91c1c', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.mediumLevel.incorrect}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.mediumLevel.totalQ}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>{formatTime(aggregated.mediumLevel.timeSpent)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                                    <td style={{ padding: '10px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'left' }}>Hard</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.hardLevel.rawScoreText}</td>
                                    <td style={{ padding: '10px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.hardLevel.scaledScore}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.hardLevel.accuracy}%</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#15803d', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.hardLevel.correct}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#b91c1c', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.hardLevel.incorrect}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>{aggregated.hardLevel.totalQ}</td>
                                    <td style={{ padding: '10px', fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>{formatTime(aggregated.hardLevel.timeSpent)}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff', fontWeight: '900', fontSize: '12px' }}>
                                    <td style={{ padding: '10px', borderRight: '1px solid #1e40af', textAlign: 'left', color: '#ffffff' }}>Combined</td>
                                    <td style={{ padding: '10px', borderRight: '1px solid #1e40af', textAlign: 'center', color: '#ffffff' }}>{aggregated.totalCorrect} / {aggregated.totalQuestions}</td>
                                    <td style={{ padding: '10px', borderRight: '1px solid #1e40af', textAlign: 'center', color: '#fef08a' }}>{aggregated.overallScaledScore}</td>
                                    <td style={{ padding: '10px', borderRight: '1px solid #1e40af', textAlign: 'center', color: '#ffffff' }}>{aggregated.overallAccuracy}%</td>
                                    <td style={{ padding: '10px', borderRight: '1px solid #1e40af', textAlign: 'center', color: '#ffffff' }}>{aggregated.totalCorrect}</td>
                                    <td style={{ padding: '10px', borderRight: '1px solid #1e40af', textAlign: 'center', color: '#ffffff' }}>{aggregated.totalIncorrect}</td>
                                    <td style={{ padding: '10px', borderRight: '1px solid #1e40af', textAlign: 'center', color: '#ffffff' }}>{aggregated.totalQuestions}</td>
                                    <td style={{ padding: '10px', textAlign: 'center', color: '#ffffff' }}>{formatTime(aggregated.totalTime)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* TIME-BASED ANALYSIS SECTION */}
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ backgroundColor: '#1d63b8', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px' }}>
                            Time-Based Analysis
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            <div style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                                <div style={{ fontSize: '10px', fontWeight: '900', color: '#64748b' }}>EASY TIME</div>
                                <div style={{ fontSize: '16px', fontWeight: '900', color: '#15803d', margin: '4px 0' }}>{formatTime(aggregated.easyLevel.timeSpent)}</div>
                            </div>
                            <div style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                                <div style={{ fontSize: '10px', fontWeight: '900', color: '#64748b' }}>MEDIUM TIME</div>
                                <div style={{ fontSize: '16px', fontWeight: '900', color: '#b45309', margin: '4px 0' }}>{formatTime(aggregated.mediumLevel.timeSpent)}</div>
                            </div>
                            <div style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                                <div style={{ fontSize: '10px', fontWeight: '900', color: '#64748b' }}>HARD TIME</div>
                                <div style={{ fontSize: '16px', fontWeight: '900', color: '#b91c1c', margin: '4px 0' }}>{formatTime(aggregated.hardLevel.timeSpent)}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f1f5f9', borderRadius: '8px', marginTop: '10px', fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>
                            <span>Total Test Time: {formatTime(aggregated.totalTime)}</span>
                            <span>Average / Question: {aggregated.avgTimePerQuestion}s</span>
                        </div>
                    </div>

                    <div className="page-break"></div>

                    {/* QUESTION-WISE ANALYTICS SECTION (STRICT 5 COLUMNS ONLY) */}
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ backgroundColor: '#0f1738', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px' }}>
                            Question-Wise Analytics
                        </div>

                        {['Easy', 'Medium', 'Hard'].map((lvlName) => {
                            const lvlData = lvlName === 'Easy' ? aggregated.easyLevel : lvlName === 'Medium' ? aggregated.mediumLevel : aggregated.hardLevel;
                            if (lvlData.questions.length === 0) return null;

                            return (
                                <div key={lvlName} style={{ marginBottom: '25px' }}>
                                    <h3 style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', color: lvlName === 'Easy' ? '#15803d' : lvlName === 'Medium' ? '#b45309' : '#b91c1c', margin: '0 0 10px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>
                                        {lvlName} Level Questions ({lvlData.questions.length})
                                    </h3>

                                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', border: '2px solid #0f1738', backgroundColor: '#ffffff' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#0f1738', color: '#ffffff', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>
                                                <th style={{ padding: '8px', width: '8%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>#</th>
                                                <th style={{ padding: '8px', width: '48%', borderRight: '1px solid #334155', textAlign: 'left', color: '#ffffff' }}>TOPIC / SKILL</th>
                                                <th style={{ padding: '8px', width: '15%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>YOUR ANS</th>
                                                <th style={{ padding: '8px', width: '15%', borderRight: '1px solid #334155', textAlign: 'center', color: '#ffffff' }}>CORRECT</th>
                                                <th style={{ padding: '8px', width: '14%', textAlign: 'center', color: '#ffffff' }}>RESULT</th>
                                            </tr>
                                        </thead>
                                        <tbody style={{ backgroundColor: '#ffffff' }}>
                                            {lvlData.questions.map((q, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                                                    <td style={{ padding: '8px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontSize: '11px' }}>{idx + 1}</td>
                                                    <td style={{ padding: '8px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'left', fontSize: '11px', wordBreak: 'break-word' }}>{q.topic}</td>
                                                    <td style={{ padding: '8px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontSize: '11px' }}>{q.studentAnswer}</td>
                                                    <td style={{ padding: '8px', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontSize: '11px' }}>{q.correctAnswer}</td>
                                                    <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px' }}>
                                                        {q.isCorrect ? (
                                                            <span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: '900', lineHeight: '18px', textAlign: 'center', fontSize: '10px' }}>✓</span>
                                                        ) : q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted' ? (
                                                            <span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#94a3b8', color: '#ffffff', fontWeight: '900', lineHeight: '18px', textAlign: 'center', fontSize: '10px' }}>-</span>
                                                        ) : (
                                                            <span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: '900', lineHeight: '18px', textAlign: 'center', fontSize: '10px' }}>✕</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>

                    <div className="page-break"></div>

                    {/* STRENGTHS & WEAKNESSES SECTION (PDF) */}
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ backgroundColor: '#0f1738', color: '#ffffff', padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px' }}>
                            Strengths & Weaknesses
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '25px' }}>
                            {/* PDF CARD 1: STRENGTHS */}
                            <div style={{ padding: '16px', border: '2px solid #16a34a', backgroundColor: '#f0fdf4', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', itemsCenter: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: '900', textAlign: 'center', lineHeight: '20px', fontSize: '11px' }}>✓</span>
                                        <span style={{ fontSize: '12px', fontWeight: '900', color: '#15803d', textTransform: 'uppercase', letterSpacing: '1px' }}>STRENGTHS</span>
                                    </div>

                                    <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', margin: '0 0 12px 0' }}>{aggregated.topic}</h3>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#16a34a' }}>
                                                {aggregated.totalCorrect} <span style={{ fontSize: '11px', color: '#64748b' }}>/ {aggregated.totalQuestions}</span>
                                            </div>
                                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>Correct Answers</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>{aggregated.overallAccuracy}%</div>
                                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', marginTop: '2px' }}>Accuracy</div>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '11px', color: '#334155', fontWeight: '600', margin: '0 0 10px 0' }}>
                                        You answered <strong>{aggregated.totalCorrect} questions</strong> correctly out of {aggregated.totalQuestions}.
                                    </p>
                                </div>

                                <div style={{ paddingTop: '8px', borderTop: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '900', color: '#15803d' }}>
                                    <span>Performance</span>
                                    <span>{aggregated.overallAccuracy >= 70 ? 'Strong performance' : aggregated.overallAccuracy >= 50 ? 'Moderate' : 'Below target'}</span>
                                </div>
                            </div>

                            {/* PDF CARD 2: AREAS FOR IMPROVEMENT */}
                            <div style={{ padding: '16px', border: '2px solid #dc2626', backgroundColor: '#fef2f2', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', itemsCenter: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: '900', textAlign: 'center', lineHeight: '20px', fontSize: '11px' }}>✕</span>
                                        <span style={{ fontSize: '12px', fontWeight: '900', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '1px' }}>AREAS FOR IMPROVEMENT</span>
                                    </div>

                                    <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', margin: '0 0 12px 0' }}>{aggregated.topic}</h3>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '12px', backgroundColor: '#ffffff', border: '1px solid #fca5a5', borderRadius: '8px', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626' }}>
                                                {aggregated.totalIncorrectCombined} <span style={{ fontSize: '11px', color: '#64748b' }}>/ {aggregated.totalQuestions}</span>
                                            </div>
                                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>Incorrect Answers</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626' }}>
                                                {aggregated.incorrectPercentage}%
                                            </div>
                                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', marginTop: '2px' }}>Incorrect</div>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '11px', color: '#334155', fontWeight: '600', margin: '0 0 10px 0' }}>
                                        You answered <strong>{aggregated.totalIncorrectCombined} questions</strong> incorrectly out of {aggregated.totalQuestions}.
                                    </p>
                                </div>

                                <div style={{ paddingTop: '8px', borderTop: '1px solid #fecdd3', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '900', color: '#b91c1c' }}>
                                    <span>Status</span>
                                    <span>Needs Significant Improvement</span>
                                </div>
                            </div>
                        </div>

                        {/* QUESTION PERFORMANCE DOTS SECTION FOR ALL QUESTIONS */}
                        <div style={{ padding: '15px', border: '2px solid #0f1738', backgroundColor: '#ffffff', borderRadius: '8px' }}>
                            <h3 style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', color: '#0f1738', marginTop: 0, marginBottom: '12px' }}>
                                {aggregated.topic.toUpperCase()} — QUESTION PERFORMANCE
                            </h3>

                            {/* Dots Grid */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '15px' }}>
                                {aggregated.allResponses.map((q, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '50%',
                                            backgroundColor: q.isCorrect ? '#16a34a' : (q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted') ? '#94a3b8' : '#dc2626',
                                            color: '#ffffff',
                                            fontSize: '9px',
                                            fontWeight: '900',
                                            lineHeight: '16px',
                                            textAlign: 'center'
                                        }}
                                    >
                                        {q.isCorrect ? '✓' : (q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted') ? '-' : '✕'}
                                    </div>
                                ))}
                            </div>

                            {/* Totals Summary */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '900', color: '#0f172a' }}>
                                <span>{aggregated.totalQuestions} Total Questions</span>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <span style={{ color: '#16a34a' }}>🟢 {aggregated.totalCorrect} Correct</span>
                                    <span style={{ color: '#dc2626' }}>🔴 {aggregated.totalIncorrect} Incorrect</span>
                                    <span style={{ color: '#64748b' }}>⚪ {aggregated.totalUnanswered} Unanswered</span>
                                </div>
                                <span style={{ color: '#1e3a8a' }}>Accuracy: {aggregated.overallAccuracy}%</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
};

export default CombinedRegularCourseReport;
