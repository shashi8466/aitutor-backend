import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import AITutorModal from '../AITutorModal';
import { aiService, planService, progressService, gradingService } from '../../../services/api';
import supabase from '../../../supabase/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import MathRenderer from '../../../common/MathRenderer';

const { FiTarget, FiCrosshair, FiZap, FiCheckCircle, FiRefreshCw, FiAlertTriangle, FiEye, FiEyeOff, FiMessageCircle, FiLoader, FiChevronRight, FiArrowLeft, FiActivity, FiTrendingDown, FiShield, FiFileText, FiGrid, FiX } = FiIcons;

const WeaknessDrills = () => {
  const { user } = useAuth();
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [generated, setGenerated] = useState(false);

  // States for Subject Navigation
  const [subjectGroups, setSubjectGroups] = useState({});
  const [activeSubject, setActiveSubject] = useState(null);

  // Drill Interactive States
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [activeTopic, setActiveTopic] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [selectedDrill, setSelectedDrill] = useState(null);
  const [drillError, setDrillError] = useState('');

  useEffect(() => {
    if (user?.id) loadWeaknesses();
  }, [user]);

  const loadWeaknesses = async () => {
    setLoadingContext(true);
    try {
      let detected = [];
      // 1. Fetch Automated Weak Topics Strictly from Test Performance
      try {
        const res = await gradingService.getWeakTopics();
        detected = res.data?.weakTopics || [];
      } catch (e) {
        console.warn("Automated weakness detection failed", e);
      }

      // No fallbacks allowed - User wants real test data only
      if (detected.length === 0) {
        setSubjectGroups({});
        return;
      }

      // Grouping Logic
      const groups = detected.reduce((acc, item) => {
        const subject = item.subject || "Other Subjects";
        if (!acc[subject]) acc[subject] = [];
        acc[subject].push(item);
        return acc;
      }, {});

      setSubjectGroups(groups);
    } catch (err) {
      console.error("Failed to load weakness context", err);
    } finally {
      setLoadingContext(false);
    }
  };

  const normalizeDifficulty = (level) => {
    const raw = String(level || 'Medium').toLowerCase();
    if (raw.includes('easy')) return 'Easy';
    if (raw.includes('hard')) return 'Hard';
    return 'Medium';
  };

  const resolveCorrectLetter = (options = [], rawAnswer = '') => {
    const letters = ['A', 'B', 'C', 'D'];
    const answer = String(rawAnswer || '').trim();
    if (letters.includes(answer.toUpperCase())) return answer.toUpperCase();
    const idx = options.findIndex((opt) => String(opt).trim().toLowerCase() === answer.toLowerCase());
    return idx >= 0 ? letters[idx] : 'A';
  };

  const handleGenerateDrill = async (weakness) => {
    const topic = weakness?.topic || '';
    const difficulty = normalizeDifficulty(weakness?.level);
    const topicKey = `${topic}::${difficulty}`;
    setLoading(true);
    setDrillError('');
    setGenerated(false);
    setCurrentDrillIndex(0);
    setActiveTopic(topicKey);
    setSelectedOption(null);
    setIsSubmitted(false);

    try {
      if (!topic) throw new Error('Missing weakness topic');

      // 1. Access Check
      const hasAccess = await planService.checkAccess(user.id, 'topic', topic);
      if (!hasAccess) {
        setDrillError(`🔒 Topic Restricted: "${topic}" is only available for Premium students. Please upgrade to unlock!`);
        setLoading(false);
        return;
      }

      // 2. Limit Check
      const usage = await planService.getUsageStats(user.id);
      const { data: profile } = await supabase.from('profiles').select('plan_type').eq('id', user.id).single();
      const { data: settings } = await planService.getSettings();
      const userPlan = profile?.plan_type || 'free';
      const planSettings = (settings || []).find(s => s.plan_type === userPlan);
      const totalLimit = (planSettings?.max_questions_math || 250) + (planSettings?.max_questions_rw || 250);
      
      if (usage.totalQuestions >= totalLimit && userPlan !== 'premium') {
        setDrillError(`⚠️ Limit Reached: You've completed your ${userPlan} plan limit of ${totalLimit} questions. Upgrade for more!`);
        setLoading(false);
        return;
      }

      // KB defines SAT format/style only. We do NOT copy KB questions.
      // Some deployments may not expose /api/kb-quiz; fallback to prep365-chat KB endpoint.
      let kbRef = null;
      try {
        const kbRes = await aiService.kbQuiz(topic, difficulty, 1, []);
        kbRef = (kbRes?.data?.questions || [])[0] || null;
      } catch (kbErr) {
        if (kbErr?.response?.status !== 404) throw kbErr;
        const fallbackRes = await aiService.prep365Chat(topic, difficulty, 1, []);
        kbRef = (fallbackRes?.data?.questions || [])[0] || null;
      }
      const kbFormatReference = kbRef
        ? `KB SAT FORMAT REFERENCE (DO NOT COPY):
- Topic reference: ${kbRef.topic || topic}
- Difficulty reference: ${kbRef.difficulty || difficulty}
- Stem style sample: ${(kbRef.text || '').slice(0, 260)}
- Option style sample: ${(kbRef.options || []).slice(0, 4).join(' | ')}
- Explanation style sample: ${(kbRef.explanation || '').slice(0, 220)}`
        : `KB SAT FORMAT REFERENCE (DO NOT COPY):
- Topic reference: ${topic}
- Difficulty reference: ${difficulty}
- Structure: question + 4 options (A-D) + correct answer + explanation`;

      const context = `Generate a new SAT practice drill.

TOPIC LOCK (MANDATORY): ${topic}
DIFFICULTY LOCK (MANDATORY): ${difficulty}

${kbFormatReference}

STRICT REQUIREMENTS:
1) Create EXACTLY 10 NEW questions (never copy KB text).
2) Keep ALL 10 questions on the SAME topic: "${topic}".
3) Keep ALL 10 questions at ${difficulty} difficulty only.
4) Return SAT-style MCQ with exactly 4 options (A, B, C, D).
5) Return clear explanation for each answer.
6) Topic drift is forbidden.`;

      const res = await aiService.generateExam(context, difficulty, 10);
      const rawQuiz = Array.isArray(res?.data?.questions) ? res.data.questions : [];

      const drillSet = rawQuiz
        .map((q, i) => {
          const options = Array.isArray(q.options) ? q.options.map((opt) => String(opt)).slice(0, 4) : [];
          if (!q?.question || options.length !== 4) return null;
          const letter = resolveCorrectLetter(options, q.correctAnswer);
          return {
        id: q.id || i + 1,
            question: q.question,
            options,
            answer: letter,
            explanation: q.explanation || "No explanation provided.",
            topic,
            level: difficulty,
            concept: q.concept || topic
          };
        })
        .filter(Boolean);

      if (drillSet.length === 0) throw new Error("AI returned empty drills");
      setDrills(drillSet);
      setActiveTopic(topic);
      setGenerated(true);
    } catch (err) {
      console.error("Drill gen failed", err);
      setDrillError("Unable to generate a valid practice drill right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedOption) return;
    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (currentDrillIndex < drills.length - 1) {
      setCurrentDrillIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
    } else {
      setGenerated(false);
      setActiveTopic(null);
    }
  };

  const handleExplain = (drill) => {
    setSelectedDrill({
      question: drill.question,
      correct_answer: drill.answer,
      explanation: drill.explanation,
      type: 'mcq',
      level: drill.level || 'Medium',
      topic: drill.topic || activeTopic,
      concept: drill.concept || drill.topic || activeTopic
    });
    setShowAI(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Premium Header */}
      <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-black rounded-[2.5rem] p-12 text-white shadow-2xl relative overflow-hidden border border-white/10">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-black uppercase tracking-[0.25em] mb-6">
            <SafeIcon icon={FiShield} className="text-purple-400" />
            AI Diagnostic Intelligence
          </div>
          <h1 className="text-5xl font-black mb-6 tracking-tight leading-[1.1]">
            Automated <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-300">Weakness Analysis</span>
          </h1>
          <p className="text-purple-100/70 text-lg max-w-2xl leading-relaxed">
            We've analyzed your recent test performance and difficulty level trends.
            Select a subject to master the specific topics where you need the most improvement.
            Each drill includes 10 precision-engineered questions strictly following Digital SAT standards.
          </p>
        </div>
        <div className="absolute right-[-10%] top-[-20%] w-[500px] h-[500px] bg-purple-600/20 blur-[130px] rounded-full"></div>
      </div>

      {drillError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
          {drillError}
        </div>
      )}

      {loadingContext ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="mb-4">
            <SafeIcon icon={FiLoader} className="w-12 h-12 text-purple-600" />
          </motion.div>
          <p className="font-bold text-gray-400 text-sm uppercase tracking-widest">Scanning performance data...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {!generated ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {activeSubject ? (
                // Detailed Subject View
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setActiveSubject(null)}
                      className="flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white font-bold transition-all text-sm uppercase tracking-widest"
                    >
                      <SafeIcon icon={FiArrowLeft} /> Back to Subjects
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-1 bg-purple-600 rounded-full"></div>
                      <h2 className="text-2xl font-black dark:text-white capitalize">{activeSubject} Weakness Report</h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {subjectGroups[activeSubject]?.map((w, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={i}
                        className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row justify-between items-center hover:shadow-md transition-all gap-6 border-l-8 border-l-red-500"
                      >
                        <div className="flex items-center gap-6 flex-1">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${w.priority === 'Critical' ? 'bg-red-50 text-red-600 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-orange-50 text-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.1)]'}`}>
                            <SafeIcon icon={FiActivity} className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${w.priority === 'Critical' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                                {w.priority} Topic
                              </span>
                              <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Level: {w.level}</span>
                            </div>
                            <h4 className="text-2xl font-black text-gray-900 dark:text-white">{w.topic}</h4>
                            <p className="text-gray-400 text-sm font-bold mt-1">Found via: <span className="text-purple-600">{w.reason}</span></p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleGenerateDrill(w)}
                          disabled={loading}
                          className="w-full md:w-auto px-10 py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                        >
                          {loading && activeTopic === `${w.topic}::${normalizeDifficulty(w.level)}` ? (
                            <FiLoader className="animate-spin" />
                          ) : (
                            <SafeIcon icon={FiZap} className="group-hover:text-yellow-400" />
                          )}
                          Generate Practice Drill
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                // Subject Entry Cards
                Object.keys(subjectGroups).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {Object.keys(subjectGroups).map((subject) => (
                      <motion.button
                        whileHover={{ scale: 1.02, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        key={subject}
                        onClick={() => setActiveSubject(subject)}
                        className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-10 text-left border border-gray-100 dark:border-gray-700 shadow-xl shadow-black/5 hover:shadow-purple-500/10 transition-all flex flex-col group h-full"
                      >
                        <div className="w-16 h-16 rounded-[1.25rem] bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center mb-8 border border-purple-100 dark:border-purple-800 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                          <SafeIcon icon={subject === 'Math' ? FiTarget : subject === 'English' ? FiFileText : FiGrid} className="w-8 h-8" />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{subject}</h3>
                        <p className="text-gray-400 text-sm font-bold mb-8 flex-1">
                          Detected gap in your {subject} score pipeline. We've identified {subjectGroups[subject].length} weak areas.
                        </p>
                        <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50 dark:border-gray-700/50">
                          <span className="text-xs font-black text-purple-600 uppercase tracking-widest">
                            {subjectGroups[subject].length} Areas
                          </span>
                          <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 transition-all group-hover:bg-black group-hover:text-white">
                            <SafeIcon icon={FiChevronRight} className="w-6 h-6" />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-gray-800 rounded-[3rem] border-4 border-dashed border-gray-100 dark:border-gray-700">
                    <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-8">
                      <SafeIcon icon={FiTarget} className="w-12 h-12 text-gray-300" />
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4">No Weak Areas Found</h3>
                    <p className="text-gray-500 font-bold max-w-md text-center leading-relaxed">
                      We haven't detected any significant weak topics from your recent tests yet.
                      Keep attempting practice tests to unlock personalized drills.
                    </p>
                  </div>
                )
              )}
            </motion.div>
          ) : (
            // The Drill UI
            <motion.div
              key="drill"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white dark:bg-gray-800 rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100 dark:border-gray-700">
                {/* Header Overlay */}
                <div className="bg-black p-8 text-white">
                  {/* Back Button Row */}
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        setGenerated(false);
                        setActiveTopic(null);
                        setCurrentDrillIndex(0);
                        setSelectedOption(null);
                        setIsSubmitted(false);
                      }}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest group"
                    >
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
                      </div>
                      Back to Topics
                    </button>
                  </div>
                  {/* Title & Progress Row */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-purple-600 rounded-3xl flex items-center justify-center font-black text-2xl shadow-lg shadow-purple-500/30">
                        {currentDrillIndex + 1}
                      </div>
                      <div>
                        <h3 className="font-black text-xl leading-tight">{activeTopic} Drill</h3>
                        <p className="text-gray-500 text-xs font-black uppercase tracking-widest mt-1">Digital SAT Level · Session Active</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {drills.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-700 ${i === currentDrillIndex ? 'w-10 bg-white' : i < currentDrillIndex ? 'w-4 bg-purple-500' : 'w-4 bg-gray-800'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-16">
                  <div className="mb-14 text-center">
                    <span className="text-xs font-black text-purple-600 uppercase tracking-[0.4em] mb-6 block">Challenge {currentDrillIndex + 1} of {drills.length}</span>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white leading-snug">
                      <MathRenderer text={drills[currentDrillIndex].question} />
                    </h4>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-5 mb-14">
                    {drills[currentDrillIndex].options.map((option, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = selectedOption === letter;
                      const isCorrect = letter === drills[currentDrillIndex].answer;

                      let btnClass = "w-full p-8 text-left rounded-[2rem] border-4 transition-all flex items-center gap-8 group relative overflow-hidden ";
                      if (isSubmitted) {
                        if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-900 dark:bg-green-900/20 dark:text-green-300";
                        else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-900 dark:bg-red-900/20 dark:text-red-300";
                        else btnClass += "opacity-40 border-gray-100 grayscale";
                      } else {
                        btnClass += isSelected
                          ? "border-purple-600 bg-purple-50 dark:bg-purple-900/10"
                          : "border-gray-50 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50/50";
                      }

                      return (
                        <motion.button
                          whileHover={!isSubmitted ? { scale: 1.01 } : {}}
                          whileTap={!isSubmitted ? { scale: 0.99 } : {}}
                          key={idx}
                          disabled={isSubmitted}
                          onClick={() => setSelectedOption(letter)}
                          className={btnClass}
                        >
                          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all ${isSelected ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                            }`}>
                            {letter}
                          </span>
                          <span className="text-xl font-bold flex-1"><MathRenderer text={option} /></span>
                          {isSubmitted && isCorrect && <SafeIcon icon={FiCheckCircle} className="text-green-500 w-8 h-8" />}
                          {isSubmitted && !isCorrect && isSelected && <SafeIcon icon={FiAlertTriangle} className="text-red-500 w-8 h-8" />}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Immediate Feedback */}
                  {isSubmitted && (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mb-14 p-12 rounded-[3rem] border-4 shadow-xl overflow-hidden relative ${selectedOption === drills[currentDrillIndex].answer
                        ? 'bg-green-50/70 border-green-200 text-green-900 shadow-green-200/20'
                        : 'bg-red-50/70 border-red-200 text-red-900 shadow-red-200/20'
                        }`}
                    >
                      <div className="flex items-center gap-6 mb-8">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${selectedOption === drills[currentDrillIndex].answer ? 'bg-green-600 shadow-green-500/40' : 'bg-red-600 shadow-red-500/40'} text-white`}>
                          <SafeIcon icon={selectedOption === drills[currentDrillIndex].answer ? FiCheckCircle : FiX} className="w-8 h-8" />
                        </div>
                        <span className="text-4xl font-black italic tracking-tight">
                          {selectedOption === drills[currentDrillIndex].answer ? "Correct Answer" : "Incorrect Answer"}
                        </span>
                      </div>

                      <div className="bg-white/90 dark:bg-gray-900/90 p-8 rounded-[2rem] shadow-sm text-lg leading-relaxed border border-black/5">
                        <p className="mb-6 pb-6 border-b border-black/5"><strong>Target Key:</strong> <span className="text-purple-600 font-black">{drills[currentDrillIndex].answer}</span></p>
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center flex-shrink-0 text-purple-600">
                            <SafeIcon icon={FiMessageCircle} />
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium"><strong>Logic:</strong> <MathRenderer text={drills[currentDrillIndex].explanation} /></p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Control Bar */}
                  <div className="flex flex-col md:flex-row gap-6">
                    {!isSubmitted ? (
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={!selectedOption}
                        className="flex-1 py-7 bg-black dark:bg-white text-white dark:text-black rounded-[2rem] font-black text-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale shadow-2xl shadow-black/20"
                      >
                        Finalize My Choice
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleExplain(drills[currentDrillIndex])}
                          className="flex-1 py-6 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 rounded-[2rem] font-black text-xl hover:bg-purple-100 transition-all flex items-center justify-center gap-4 border-2 border-purple-100 dark:border-purple-800"
                        >
                          <SafeIcon icon={FiMessageCircle} className="w-7 h-7" /> Explain with AI
                        </button>
                        <button
                          onClick={handleNext}
                          className="flex-1 py-6 bg-black dark:bg-white text-white dark:text-black rounded-[2rem] font-black text-xl hover:opacity-90 transition-all flex items-center justify-center gap-4 group shadow-xl shadow-black/10"
                        >
                          {currentDrillIndex === drills.length - 1 ? "Complete Set" : "Next Challenge"}
                          <SafeIcon icon={FiChevronRight} className="w-7 h-7 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* AI Tutor System */}
      {showAI && selectedDrill && (
        <AITutorModal
          question={selectedDrill}
          userAnswer={selectedOption}
          correctAnswer={selectedDrill.correct_answer}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
};

export default WeaknessDrills;