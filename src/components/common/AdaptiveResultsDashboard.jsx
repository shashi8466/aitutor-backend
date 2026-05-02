import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';

const { 
  FiAward, FiActivity, FiTarget, FiCheckCircle, FiX, FiSlash, 
  FiPieChart, FiClock, FiInfo, FiChevronLeft, FiChevronRight,
  FiFilter, FiLayers, FiBook, FiList, FiBarChart2
} = FiIcons;

const AdaptiveResultsDashboard = ({ submission, onExit, adminMode = false }) => {
  const [resultsView, setResultsView] = useState('summary');
  const [reviewFilter, setReviewFilter] = useState('all');

  if (!submission) return null;

  // 1. Core Data Aggregation
  const allResponses = useMemo(() => [
    ...(submission.incorrect_responses || []).map(r => ({ ...r, is_correct: false })),
    ...(submission.correct_responses || []).map(r => ({ ...r, is_correct: true }))
  ], [submission]);

  const scoresData = typeof submission.scores === 'string' ? JSON.parse(submission.scores) : (submission.scores || submission.metadata || {});
  const rwScore = scoresData.rwScore || submission.rw_score || '--';
  const mathScore = scoresData.mathScore || submission.math_score || '--';
  const totalScaledScore = submission.scaled_score || submission.score || scoresData.totalScore || '--';

  const totalQs = submission.total_questions || allResponses.length;
  const correct = submission.correct_responses?.length || 0;
  const wrong = submission.incorrect_responses?.length || 0;
  const attempted = correct + wrong;
  const unattempted = submission.unattempted_count || Math.max(0, totalQs - attempted);
  const overallAccuracy = Math.round((correct / Math.max(1, attempted)) * 100);

  // Time Analysis
  const totalTimeSpent = allResponses.reduce((acc, r) => acc + (r.time_spent || 0), 0);
  const rwTime = allResponses.filter(r => (r.subject || r.question?.subject || '').toLowerCase().includes('read')).reduce((a, r) => a + (r.time_spent || 0), 0);
  const mathTime = allResponses.filter(r => (r.subject || r.question?.subject || '').toLowerCase().includes('math')).reduce((a, r) => a + (r.time_spent || 0), 0);
  
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  // 2. Section & Topic Aggregation
  const sectionData = useMemo(() => {
    const data = {
      rw: { correct: 0, total: 0, topics: {}, time: 0 },
      math: { correct: 0, total: 0, topics: {}, time: 0 }
    };

    allResponses.forEach(resp => {
      const subject = (resp.subject || resp.question?.subject || '').toLowerCase();
      const isMath = subject.includes('math') || subject.includes('algebra');
      const sectionKey = isMath ? 'math' : 'rw';
      const topic = resp.topic || resp.question?.topic || 'General';

      data[sectionKey].total++;
      if (resp.is_correct) data[sectionKey].correct++;
      data[sectionKey].time += (resp.time_spent || 0);

      if (!data[sectionKey].topics[topic]) {
        data[sectionKey].topics[topic] = { total: 0, correct: 0, incorrect: 0, unanswered: 0, time: 0 };
      }
      
      data[sectionKey].topics[topic].total++;
      data[sectionKey].topics[topic].time += (resp.time_spent || 0);
      
      if (resp.is_correct) data[sectionKey].topics[topic].correct++;
      else if (resp.selected_answer) data[sectionKey].topics[topic].incorrect++;
      else data[sectionKey].topics[topic].unanswered++;
    });

    return data;
  }, [allResponses]);

  const moduleDetails = scoresData.moduleDetails || {};

  const pieData = [
    { name: 'Correct', value: correct, color: '#10B981' },
    { name: 'Incorrect', value: wrong, color: '#EF4444' },
    { name: 'Unattempted', value: unattempted, color: '#64748B' }
  ].filter(d => d.value > 0);

  const filteredQuestions = allResponses.filter(q => {
    if (reviewFilter === 'correct') return q.is_correct;
    if (reviewFilter === 'incorrect') return !q.is_correct && q.selected_answer;
    if (reviewFilter === 'unanswered') return !q.selected_answer;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0B1120] text-slate-300 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-[#111827] border-b border-slate-800 px-8 py-5 flex items-center justify-between shadow-md relative z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
            <SafeIcon icon={FiAward} className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Exam Analysis</h1>
            <p className="text-[11px] text-slate-500 font-semibold tracking-wider flex items-center gap-2">
              Full-Length FULL LENGTH TEST Report
              <span className="w-1 h-1 bg-slate-700 rounded-full" />
              <span className="text-blue-400/80">
                {new Date(submission.test_date || submission.created_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </p>
          </div>
        </div>

        <button 
          onClick={onExit} 
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-bold text-white transition-all"
        >
          {adminMode ? 'Close Report' : 'Exit Dashboard'}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar relative z-10">
        <div className="max-w-6xl mx-auto space-y-10 pb-20">
          
          {/* 1. Top Section: Score & Overall Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Score Card */}
            <div className="lg:col-span-1 bg-gradient-to-b from-[#1E293B] to-[#0F172A] p-8 rounded-3xl border border-slate-700 shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <SafeIcon icon={FiAward} className="w-40 h-40" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-4 z-10">Scaled Score</p>
              <h2 className="text-7xl font-black text-white tracking-tighter mb-6 z-10">
                {totalScaledScore}
              </h2>
              <div className="w-full space-y-3 z-10">
                <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <span className="text-xs font-semibold text-slate-300">Reading & Writing</span>
                  <span className="text-lg font-bold text-white">{rwScore}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <span className="text-xs font-semibold text-slate-300">Math</span>
                  <span className="text-lg font-bold text-white">{mathScore}</span>
                </div>
              </div>
            </div>

            {/* Overall Performance */}
            <div className="lg:col-span-2 bg-[#111827] p-8 rounded-3xl border border-slate-800 shadow-lg">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                <SafeIcon icon={FiActivity} className="text-blue-400" /> Overall Performance
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Total Questions', val: totalQs, color: 'text-white' },
                  { label: 'Attempted', val: attempted, color: 'text-blue-400' },
                  { label: 'Unattempted', val: unattempted, color: 'text-slate-500' },
                  { label: 'Correct', val: correct, color: 'text-emerald-400' },
                  { label: 'Incorrect', val: wrong, color: 'text-red-400' },
                  { label: 'Accuracy', val: `${overallAccuracy}%`, color: 'text-purple-400' }
                ].map((s, i) => (
                  <div key={i} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                    <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                <SafeIcon icon={FiClock} className="w-8 h-8 text-slate-400" />
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">Total Time Spent</p>
                  <p className="text-xl font-bold text-white">{formatTime(totalTimeSpent)}</p>
                </div>
                <div className="h-8 w-px bg-slate-700 mx-2"></div>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">Avg per Question</p>
                  <p className="text-xl font-bold text-white">{Math.round(totalTimeSpent / Math.max(1, attempted))}s</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Visual Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Response Breakdown Chart */}
            <div className="bg-[#111827] p-8 rounded-3xl border border-slate-800 shadow-lg">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Response Distribution</h3>
              <div className="flex items-center gap-8">
                <div className="w-[180px] h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {pieData.map(d => (
                    <div key={d.name} className="flex justify-between items-center p-3 bg-slate-800/40 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-xs font-bold text-slate-300">{d.name}</span>
                      </div>
                      <span className="text-sm font-bold text-white">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subject Accuracy Comparison */}
            <div className="bg-[#111827] p-8 rounded-3xl border border-slate-800 shadow-lg">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Subject Accuracy</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Reading & Writing', Accuracy: Math.round((sectionData.rw.correct / Math.max(1, sectionData.rw.total)) * 100), fill: '#3B82F6' },
                    { name: 'Math', Accuracy: Math.round((sectionData.math.correct / Math.max(1, sectionData.math.total)) * 100), fill: '#10B981' }
                  ]} layout="vertical" margin={{ left: 30, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={11} width={120} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: '#334155', opacity: 0.2}} contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '8px' }} />
                    <Bar dataKey="Accuracy" radius={[0, 4, 4, 0]} barSize={32}>
                      {
                        [0,1].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#3B82F6' : '#10B981'} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 3. Module-Level Performance */}
          {Object.keys(moduleDetails).length > 0 && (
            <div className="space-y-6 pt-6 border-t border-slate-800/50">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <SafeIcon icon={FiLayers} className="text-purple-400" /> Section & Module Breakdown
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(moduleDetails).map(mKey => {
                  const data = moduleDetails[mKey];
                  if (!data || data.total === 0) return null;

                  const isRW = mKey.toLowerCase().includes('rw') || mKey.toLowerCase().includes('reading');
                  return (
                    <div key={mKey} className="bg-[#111827] p-6 rounded-3xl border border-slate-800 shadow-lg">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white ${isRW ? 'bg-blue-600/80' : 'bg-emerald-600/80'}`}>
                            {isRW ? 'RW' : 'MT'}
                          </div>
                          <div>
                            <h5 className="text-base text-white font-bold">{isRW ? 'Reading & Writing' : 'Math'}</h5>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{data.difficulty || 'Standard'} MODULE</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-white block">{Math.round((data.correct / Math.max(1, data.total)) * 100)}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 bg-slate-800/40 p-3 rounded-2xl">
                        <div className="text-center">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Total</span>
                          <span className="text-base font-bold text-white">{data.total}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Correct</span>
                          <span className="text-base font-bold text-emerald-400">{data.correct}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Wrong</span>
                          <span className="text-base font-bold text-red-400">{data.incorrect}</span>
                        </div>
                        <div className="text-center border-l border-slate-700">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Score</span>
                          <span className="text-base font-bold text-blue-400">{data.score || data.correct}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Topic-Wise Analysis (Detailed Tables) */}
          <div className="space-y-6 pt-6 border-t border-slate-800/50">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <SafeIcon icon={FiTarget} className="text-indigo-400" /> Topic-Wise Analysis
            </h2>

            {['rw', 'math'].map(sectionKey => {
              const isRW = sectionKey === 'rw';
              const sName = isRW ? 'Reading & Writing' : 'Math';
              const topics = sectionData[sectionKey].topics;
              if (Object.keys(topics).length === 0) return null;

              return (
                <div key={sectionKey} className="bg-[#111827] rounded-3xl border border-slate-800 overflow-hidden shadow-lg">
                  <div className={`px-6 py-4 border-b border-slate-800 flex items-center gap-3 ${isRW ? 'bg-blue-900/10' : 'bg-emerald-900/10'}`}>
                    <SafeIcon icon={isRW ? FiBook : FiActivity} className={isRW ? 'text-blue-400' : 'text-emerald-400'} />
                    <h3 className="font-bold text-white">{sName} Topics</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Topic Name</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Total Questions</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center text-emerald-400">Correct</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center text-red-400">Incorrect</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center text-slate-500">Unanswered</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center text-blue-400">Score</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Accuracy (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {Object.keys(topics).map((topic, i) => {
                          const t = topics[topic];
                          const acc = Math.round((t.correct / t.total) * 100);
                          return (
                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4 text-sm font-semibold text-slate-200">{topic}</td>
                              <td className="px-6 py-4 text-sm font-bold text-slate-300 text-center">{t.total}</td>
                              <td className="px-6 py-4 text-sm font-bold text-emerald-400 text-center">{t.correct}</td>
                              <td className="px-6 py-4 text-sm font-bold text-red-400 text-center">{t.incorrect}</td>
                              <td className="px-6 py-4 text-sm font-bold text-slate-500 text-center">{t.unanswered}</td>
                              <td className="px-6 py-4 text-sm font-bold text-blue-400 text-center">{t.correct}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${acc >= 80 ? 'bg-emerald-500' : acc >= 50 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${acc}%` }} />
                                  </div>
                                  <span className="text-sm font-bold w-10">{acc}%</span>
                                </div>
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
          </div>

          {/* 5. Detailed Review & Question Breakdown */}
          <div className="space-y-6 pt-10 border-t border-slate-800/50">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
              <SafeIcon icon={FiList} className="text-emerald-400" /> Question Review & Explanations
            </h2>

            {/* Review Filters */}
            <div className="bg-[#111827] p-3 rounded-2xl border border-slate-800 shadow-md flex items-center gap-2 sticky top-0 z-20">
              <SafeIcon icon={FiFilter} className="text-slate-400 ml-2 mr-2 w-4 h-4 hidden sm:block" />
              {['all', 'correct', 'incorrect', 'unanswered'].map(f => (
                <button 
                  key={f} 
                  onClick={() => setReviewFilter(f)} 
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${reviewFilter === f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {filteredQuestions.length > 0 ? filteredQuestions.map((q, idx) => {
                const ans = q.selected_answer;
                const isCorrect = q.is_correct;
                const isUnanswered = !ans;
                const timeSpent = q.time_spent || q.metadata?.time_spent || 0;

                return (
                  <div key={q.id || idx} className="bg-[#111827] border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-lg relative">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b border-slate-800/50 pb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {isCorrect ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">Correct</span>
                            ) : isUnanswered ? (
                              <span className="px-2.5 py-0.5 bg-slate-500/10 text-slate-400 rounded-md text-[10px] font-bold uppercase tracking-widest border border-slate-500/20">Unanswered</span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-red-500/10 text-red-400 rounded-md text-[10px] font-bold uppercase tracking-widest border border-red-500/20">Incorrect</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-semibold">{q.topic || q.question?.topic || 'General Topic'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
                        <SafeIcon icon={FiClock} className="w-3.5 h-3.5" />
                        {timeSpent} sec
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="prose prose-invert max-w-none mb-10 text-slate-200 text-base leading-relaxed">
                      <MathRenderer text={q.question_text || q.question?.text || q.text} />
                    </div>

                    {/* Answers Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Your Answer</p>
                        <p className={`text-lg font-bold ${isCorrect ? 'text-emerald-400' : isUnanswered ? 'text-slate-500' : 'text-red-400'}`}>
                          {ans || 'No response'}
                        </p>
                      </div>
                      <div className="p-5 rounded-2xl bg-emerald-900/10 border border-emerald-500/20">
                        <p className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest mb-2">Correct Answer</p>
                        <p className="text-lg font-bold text-emerald-400">{q.correct_answer || q.question?.correct_answer || q.correctAnswer}</p>
                      </div>
                    </div>

                    {/* Explanation */}
                    {(q.explanation || q.question?.explanation) && (
                      <div className="p-6 rounded-2xl bg-blue-900/10 border border-blue-500/20 mt-6">
                        <p className="text-[11px] text-blue-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                          <SafeIcon icon={FiInfo} className="w-4 h-4" /> Solution Explanation
                        </p>
                        <div className="text-slate-300 text-sm leading-relaxed prose prose-invert max-w-none">
                          <MathRenderer text={q.explanation || q.question?.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="p-20 text-center bg-[#111827] rounded-3xl border border-slate-800">
                  <p className="text-slate-400 font-bold">No questions match your filter.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdaptiveResultsDashboard;
