import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import AITutorModal from '../AITutorModal';
import { aiService, planService, gradingService } from '../../../services/api';
import supabase from '../../../supabase/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import MathRenderer from '../../../common/MathRenderer';

const { 
  FiTarget, FiCrosshair, FiZap, FiCheckCircle, FiRefreshCw, FiAlertTriangle, 
  FiMessageCircle, FiLoader, FiChevronRight, FiArrowLeft, FiActivity, 
  FiShield, FiFileText, FiGrid, FiX, FiFilter, FiChevronDown, FiSliders, FiCpu 
} = FiIcons;

// Card gradient background presets matching screenshot 2
const ICON_GRADIENTS = [
  'from-purple-600 to-indigo-600 shadow-purple-900/30',
  'from-blue-600 to-cyan-500 shadow-blue-900/30',
  'from-teal-500 to-emerald-600 shadow-teal-900/30',
  'from-amber-500 to-orange-600 shadow-amber-900/30',
  'from-pink-600 to-rose-600 shadow-pink-900/30',
  'from-violet-600 to-purple-800 shadow-violet-900/30',
  'from-emerald-600 to-teal-600 shadow-emerald-900/30'
];

const WeaknessDrills = () => {
  const { user } = useAuth();
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [generated, setGenerated] = useState(false);

  // Raw detected weaknesses
  const [weaknessList, setWeaknessList] = useState([]);
  const [activeSubject, setActiveSubject] = useState('All');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Priority'); // Priority | Missed | Name

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
      try {
        const res = await gradingService.getWeakTopics();
        detected = res.data?.weakTopics || [];
      } catch (e) {
        console.warn("Automated weakness detection failed", e);
      }

      setWeaknessList(detected);
    } catch (err) {
      console.error("Failed to load weakness context", err);
    } finally {
      setLoadingContext(false);
    }
  };

  // Extract count of missed questions from reason string for sorting & priority
  const getMissedCount = (reasonStr) => {
    if (!reasonStr) return 0;
    const match = reasonStr.match(/Missed\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 5;
  };

  // Filtered and Sorted Weakness List
  const filteredWeaknesses = useMemo(() => {
    let list = [...weaknessList];

    if (activeSubject !== 'All') {
      const targetFilter = activeSubject.toLowerCase();
      list = list.filter(item => {
        const itemSub = (item.subject || '').toLowerCase();
        const itemTop = (item.topic || '').toLowerCase();
        const itemReason = (item.reason || '').toLowerCase();
        const itemCourse = (item.course_name || '').toLowerCase();

        if (targetFilter === 'math') {
          return itemSub === 'math' || itemTop.includes('math') || itemTop.includes('algebra') || itemTop.includes('geometry') || itemTop.includes('trigonometry') || itemTop.includes('logarithm') || itemTop.includes('equation');
        }
        if (targetFilter === 'english') {
          return itemSub === 'english' || itemSub === 'reading' || itemSub === 'writing' || itemTop.includes('reading') || itemTop.includes('writing') || itemTop.includes('english') || itemTop.includes('grammar') || itemTop.includes('inference') || itemTop.includes('words in context') || itemTop.includes('structure') || itemTop.includes('central ideas');
        }
        if (targetFilter === 'ap') {
          return itemSub === 'ap' || itemTop.includes('ap') || itemCourse.includes('ap') || itemReason.includes('ap') || itemTop.includes('atomic') || itemTop.includes('science') || itemTop.includes('chemistry') || itemTop.includes('physics') || itemTop.includes('biology');
        }
        if (targetFilter === 'act') {
          return itemSub === 'act' || itemTop.includes('act') || itemCourse.includes('act') || itemReason.includes('act') || itemTop.includes('conflicting viewpoints');
        }
        if (targetFilter === 'full-length test' || targetFilter === 'full-length' || targetFilter === 'full length test') {
          return item.is_full_length || itemSub.includes('full') || itemTop.includes('full') || itemReason.includes('full') || itemCourse.includes('full') || itemReason.includes('recent tests') || itemReason.includes('exam');
        }

        return itemSub === targetFilter || itemTop.includes(targetFilter);
      });
    }

    if (selectedLevelFilter !== 'All') {
      list = list.filter(item => {
        const lvl = (item.level || 'Medium').toLowerCase();
        return lvl.includes(selectedLevelFilter.toLowerCase());
      });
    }

    list.sort((a, b) => {
      if (sortBy === 'Priority') {
        const priorityOrder = { Critical: 3, High: 2, Medium: 1 };
        const pA = priorityOrder[a.priority] || 1;
        const pB = priorityOrder[b.priority] || 1;
        if (pA !== pB) return pB - pA;
        return getMissedCount(b.reason) - getMissedCount(a.reason);
      } else if (sortBy === 'Missed') {
        return getMissedCount(b.reason) - getMissedCount(a.reason);
      } else {
        return (a.topic || '').localeCompare(b.topic || '');
      }
    });

    return list;
  }, [weaknessList, activeSubject, selectedLevelFilter, sortBy]);

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
      const hasAccess = await planService.checkAccess(user.id, 'topic', topic, user.plan_type);
      if (!hasAccess) {
        setDrillError(`🔒 Topic Restricted: "${topic}" is only available for Premium students. Please upgrade to unlock!`);
        setLoading(false);
        return;
      }

      // 2. Limit Check
      const usage = await planService.getUsageStats(user.id);
      const { data: settings } = await planService.getSettings();
      const userPlan = (user?.plan_type || 'free').toLowerCase();
      const planSettings = (settings || []).find(s => s.plan_type === userPlan);
      const totalLimit = (planSettings?.max_questions_math || 250) + (planSettings?.max_questions_rw || 250);
      
      if (userPlan !== 'premium' && usage.totalQuestions >= totalLimit) {
        setDrillError(`⚠️ Limit Reached: You've completed your ${userPlan.toUpperCase()} plan limit of ${totalLimit} questions. Upgrade for more!`);
        setLoading(false);
        return;
      }

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
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* 3D Premium Dark Header matching Screenshot 2 */}
      <div className="bg-[#090C16] rounded-[2rem] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          
          {/* Left Content */}
          <div className="max-w-xl">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-white uppercase tracking-wider mb-5 backdrop-blur-md">
              <span className="text-purple-400 font-bold text-sm">✦</span>
              AI DIAGNOSTIC INTELLIGENCE
            </div>

            {/* Main Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 tracking-tight leading-[1.15]">
              <span className="text-white font-extrabold">Automated </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300">
                Weakness Analysis
              </span>
            </h1>

            {/* Description */}
            <p className="text-slate-300/80 text-sm md:text-base leading-relaxed mb-6">
              We've analyzed your recent test performance and difficulty level trends. Select a subject to master the specific topics where you need the most improvement.
            </p>

            {/* Inner Info Card Box */}
            <div className="bg-[#12162A]/90 border border-purple-500/20 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-sm max-w-lg">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400">
                <SafeIcon icon={FiCpu} className="w-5 h-5" />
              </div>
              <p className="text-xs text-purple-100/90 font-medium leading-normal">
                Each drill includes 10 precision-engineered questions strictly following Digital SAT standards.
              </p>
            </div>
          </div>

          {/* Right 3D Illustration Graphics matching Screenshot 2 */}
          <div className="relative w-full lg:w-[340px] h-[220px] flex items-center justify-center flex-shrink-0">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 via-indigo-600/20 to-cyan-500/20 blur-[60px] rounded-full"></div>
            
            {/* SVG 3D Isometric Dark Tablet + Magnifying Glass Artwork */}
            <svg className="w-full h-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="tabletGrad" x1="0" y1="0" x2="300" y2="200" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#1E1B4B" />
                  <stop offset="0.5" stopColor="#0F172A" />
                  <stop offset="1" stopColor="#020617" />
                </linearGradient>
                <linearGradient id="glassGlow" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#A855F7" stopOpacity="0.8" />
                  <stop offset="1" stopColor="#3B82F6" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="magnifierGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#C084FC" />
                  <stop offset="1" stopColor="#6366F1" />
                </linearGradient>
                <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Sparkles in background */}
              <circle cx="40" cy="30" r="1.5" fill="#C084FC" opacity="0.8" />
              <circle cx="280" cy="40" r="2" fill="#38BDF8" opacity="0.9" />
              <circle cx="290" cy="180" r="1.5" fill="#A855F7" opacity="0.7" />
              <circle cx="20" cy="190" r="2" fill="#818CF8" opacity="0.8" />

              {/* 3D Isometric Tablet Screen Frame */}
              <rect x="60" y="30" width="200" height="150" rx="20" fill="url(#tabletGrad)" stroke="#334155" strokeWidth="2" />
              <rect x="70" y="40" width="180" height="130" rx="14" fill="#0B0F19" stroke="#1E293B" strokeWidth="1" />

              {/* Chart lines on tablet screen */}
              {/* Top Header line */}
              <rect x="85" y="52" width="60" height="8" rx="4" fill="#3B82F6" opacity="0.6" />
              <rect x="155" y="52" width="30" height="8" rx="4" fill="#818CF8" opacity="0.4" />

              {/* Bar Chart Graphics */}
              <rect x="85" y="115" width="14" height="40" rx="4" fill="#6366F1" opacity="0.7" />
              <rect x="105" y="95" width="14" height="60" rx="4" fill="#A855F7" />
              <rect x="125" y="125" width="14" height="30" rx="4" fill="#38BDF8" opacity="0.6" />
              <rect x="145" y="85" width="14" height="70" rx="4" fill="url(#glassGlow)" filter="url(#glowEffect)" />
              <rect x="165" y="105" width="14" height="50" rx="4" fill="#818CF8" opacity="0.8" />
              <rect x="185" y="130" width="14" height="25" rx="4" fill="#334155" />

              {/* Curved Trend Line */}
              <path d="M 85 110 Q 115 70, 145 75 T 205 60" fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" opacity="0.9" />

              {/* Floating 3D Glowing Glass Magnifying Glass Overlay */}
              <g transform="translate(140, 60)">
                {/* Outer Glass Glow */}
                <circle cx="55" cy="55" r="42" fill="none" stroke="url(#magnifierGrad)" strokeWidth="6" filter="url(#glowEffect)" opacity="0.9" />
                <circle cx="55" cy="55" r="36" fill="#0F172A" fillOpacity="0.4" stroke="#E2E8F0" strokeWidth="1.5" strokeOpacity="0.5" />
                
                {/* Magnifier Lens Sparkle / Highlight */}
                <path d="M 32 40 A 30 30 0 0 1 70 28" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
                
                {/* 3D Handle */}
                <path d="M 84 84 L 115 115" stroke="url(#magnifierGrad)" strokeWidth="12" strokeLinecap="round" filter="url(#glowEffect)" />
                <path d="M 84 84 L 115 115" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
              </g>
            </svg>
          </div>

        </div>
      </div>

      {drillError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/40 text-red-300 px-5 py-4 text-sm font-semibold flex items-center justify-between">
          <span>{drillError}</span>
          <button onClick={() => setDrillError('')} className="text-red-400 hover:text-white">
            <SafeIcon icon={FiX} />
          </button>
        </div>
      )}

      {loadingContext ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[#0B0E1B] rounded-[2rem] border border-slate-800 shadow-sm">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="mb-4">
            <SafeIcon icon={FiLoader} className="w-10 h-10 text-purple-500" />
          </motion.div>
          <p className="font-bold text-slate-400 text-xs uppercase tracking-widest">Scanning performance & weakness data...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {!generated ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Filter & Toolbar Row matching Prompt Specification */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 px-1">
                {/* Left side info pills */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-purple-400 font-extrabold text-sm tracking-tight whitespace-nowrap">
                    {filteredWeaknesses.length} Areas Detected
                  </span>

                  {/* Level Pill */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#141A2E] border border-slate-800 text-xs font-bold text-slate-300">
                    <span className="text-slate-400 font-medium">Level:</span>
                    <select
                      value={selectedLevelFilter}
                      onChange={(e) => setSelectedLevelFilter(e.target.value)}
                      className="bg-transparent text-amber-400 font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="All" className="bg-[#141A2E] text-white">All Levels</option>
                      <option value="Medium" className="bg-[#141A2E] text-amber-400">Medium</option>
                      <option value="Hard" className="bg-[#141A2E] text-red-400">Hard</option>
                      <option value="Easy" className="bg-[#141A2E] text-emerald-400">Easy</option>
                    </select>
                  </div>

                  {/* Subject & Test Type Filter Tabs */}
                  <div className="flex items-center bg-[#141A2E] border border-slate-800 p-0.5 rounded-lg text-xs font-bold overflow-x-auto no-scrollbar">
                    {['All', 'Math', 'English', 'AP', 'ACT', 'Full-Length Test'].map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setActiveSubject(sub)}
                        className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
                          activeSubject === sub 
                            ? 'bg-purple-600 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right side Sort By dropdown */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-slate-400 font-medium">Sort by:</span>
                  <div className="relative inline-block">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="appearance-none bg-[#141A2E] border border-slate-800 text-slate-200 text-xs font-bold rounded-lg px-3 py-1.5 pr-8 focus:outline-none cursor-pointer"
                    >
                      <option value="Priority" className="bg-[#141A2E]">Priority</option>
                      <option value="Missed" className="bg-[#141A2E]">Missed Questions</option>
                      <option value="Name" className="bg-[#141A2E]">Topic Name</option>
                    </select>
                    <SafeIcon icon={FiChevronDown} className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Weakness Cards Grid matching Screenshot 2 */}
              {filteredWeaknesses.length > 0 ? (
                <div className="grid grid-cols-1 gap-3.5">
                  {filteredWeaknesses.map((w, index) => {
                    const missedCount = getMissedCount(w.reason);
                    const gradientClass = ICON_GRADIENTS[index % ICON_GRADIENTS.length];
                    const isGeneratingThis = loading && activeTopic === `${w.topic}::${normalizeDifficulty(w.level)}`;

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="bg-[#0E1324] rounded-2xl p-4 sm:p-5 border border-slate-800/80 hover:border-purple-500/40 shadow-lg hover:shadow-purple-500/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                      >
                        {/* Left Side: Gradient Icon & Topic Meta */}
                        <div className="flex items-center gap-4 flex-1">
                          {/* Colorful Rounded Square Icon Box */}
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center flex-shrink-0 shadow-md text-white`}>
                            <SafeIcon icon={FiActivity} className="w-6 h-6 stroke-[2.5]" />
                          </div>

                          {/* Details Column */}
                          <div>
                            {/* Meta Top Line: Critical Tag, Level, Priority Dots */}
                            <div className="flex items-center gap-3 mb-1">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-white ${
                                w.priority === 'Critical' ? 'bg-red-600' : 'bg-orange-500'
                              }`}>
                                CRITICAL TOPIC
                              </span>

                              <span className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
                                LEVEL: {w.level || 'MEDIUM'}
                              </span>

                              {/* Priority Dots Indicator */}
                              <div className="flex items-center gap-1 ml-1" title={`Priority Level: ${w.priority}`}>
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                                <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                              </div>
                            </div>

                            {/* Main Topic Name */}
                            <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-purple-300 transition-colors leading-tight">
                              {w.topic}
                            </h4>

                            {/* Found via Missed X questions */}
                            <p className="text-slate-400 text-xs font-medium mt-0.5">
                              Found via:{' '}
                              <span className="text-purple-400 font-semibold">
                                {w.reason}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Right Side: Sleek White Button matching Screenshot 2 */}
                        <button
                          onClick={() => handleGenerateDrill(w)}
                          disabled={loading}
                          className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {isGeneratingThis ? (
                            <FiLoader className="animate-spin text-purple-600 w-4 h-4" />
                          ) : (
                            <SafeIcon icon={FiZap} className="w-4 h-4 text-purple-600 fill-purple-600" />
                          )}
                          <span>Generate Practice Drill</span>
                          <SafeIcon icon={FiChevronRight} className="w-4 h-4 text-slate-500" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-[#0E1324] rounded-3xl border border-dashed border-slate-800">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <SafeIcon icon={FiTarget} className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Weak Areas Found</h3>
                  <p className="text-slate-400 font-medium text-xs max-w-sm text-center">
                    We haven't detected any weak topics matching the selected filters.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            /* Practice Drill Interactive Screen */
            <motion.div
              key="drill"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.03 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-[#0E1324] rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-800">
                {/* Header Bar */}
                <div className="bg-[#090C16] p-6 text-white border-b border-slate-800">
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        setGenerated(false);
                        setActiveTopic(null);
                        setCurrentDrillIndex(0);
                        setSelectedOption(null);
                        setIsSubmitted(false);
                      }}
                      className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider group"
                    >
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <SafeIcon icon={FiArrowLeft} className="w-3.5 h-3.5" />
                      </div>
                      Back to Weakness Analysis
                    </button>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-purple-900/40">
                        {currentDrillIndex + 1}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-white leading-tight">{activeTopic} Drill</h3>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-0.5">Digital SAT Level · Question {currentDrillIndex + 1} of {drills.length}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {drills.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentDrillIndex ? 'w-8 bg-purple-400' : i < currentDrillIndex ? 'w-3 bg-purple-700' : 'w-3 bg-slate-800'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-8 sm:p-12">
                  <div className="mb-10 text-center">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-[0.3em] mb-4 block">Question {currentDrillIndex + 1} of {drills.length}</span>
                    <h4 className="text-2xl font-bold text-white leading-relaxed">
                      <MathRenderer text={drills[currentDrillIndex].question} />
                    </h4>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-4 mb-10">
                    {drills[currentDrillIndex].options.map((option, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = selectedOption === letter;
                      const isCorrect = letter === drills[currentDrillIndex].answer;

                      let btnClass = "w-full p-5 text-left rounded-2xl border-2 transition-all flex items-center gap-5 group relative overflow-hidden ";
                      if (isSubmitted) {
                        if (isCorrect) btnClass += "bg-emerald-950/40 border-emerald-500 text-emerald-200";
                        else if (isSelected) btnClass += "bg-red-950/40 border-red-500 text-red-200";
                        else btnClass += "opacity-40 border-slate-800 grayscale text-slate-400";
                      } else {
                        btnClass += isSelected
                          ? "border-purple-500 bg-purple-950/30 text-white"
                          : "border-slate-800 hover:border-purple-500/50 text-slate-200 hover:bg-slate-800/40";
                      }

                      return (
                        <motion.button
                          whileHover={!isSubmitted ? { scale: 1.005 } : {}}
                          whileTap={!isSubmitted ? { scale: 0.995 } : {}}
                          key={idx}
                          disabled={isSubmitted}
                          onClick={() => setSelectedOption(letter)}
                          className={btnClass}
                        >
                          <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm transition-all ${isSelected ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-800 text-slate-400'}`}>
                            {letter}
                          </span>
                          <span className="text-base font-medium flex-1"><MathRenderer text={option} /></span>
                          {isSubmitted && isCorrect && <SafeIcon icon={FiCheckCircle} className="text-emerald-400 w-6 h-6 flex-shrink-0" />}
                          {isSubmitted && !isCorrect && isSelected && <SafeIcon icon={FiAlertTriangle} className="text-red-400 w-6 h-6 flex-shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Immediate Feedback Box */}
                  {isSubmitted && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mb-10 p-6 sm:p-8 rounded-2xl border ${selectedOption === drills[currentDrillIndex].answer
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/30 border-red-500/40 text-red-200'
                        }`}
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedOption === drills[currentDrillIndex].answer ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
                          <SafeIcon icon={selectedOption === drills[currentDrillIndex].answer ? FiCheckCircle : FiX} className="w-6 h-6" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">
                          {selectedOption === drills[currentDrillIndex].answer ? "Correct Answer!" : "Incorrect Answer"}
                        </span>
                      </div>

                      <div className="bg-[#090C16] p-5 rounded-xl text-sm leading-relaxed border border-slate-800">
                        <p className="mb-3 pb-3 border-b border-slate-800/80">
                          <strong>Correct Key:</strong> <span className="text-purple-400 font-bold ml-1">{drills[currentDrillIndex].answer}</span>
                        </p>
                        <div className="flex gap-3">
                          <div className="w-6 h-6 bg-purple-900/40 rounded flex items-center justify-center flex-shrink-0 text-purple-400 mt-0.5">
                            <SafeIcon icon={FiMessageCircle} className="w-4 h-4" />
                          </div>
                          <p className="text-slate-300 font-medium"><strong>Explanation:</strong> <MathRenderer text={drills[currentDrillIndex].explanation} /></p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    {!isSubmitted ? (
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={!selectedOption}
                        className="flex-1 py-4 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg cursor-pointer"
                      >
                        Submit Choice
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleExplain(drills[currentDrillIndex])}
                          className="flex-1 py-4 bg-purple-950/40 text-purple-300 hover:bg-purple-900/50 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-purple-500/30 cursor-pointer"
                        >
                          <SafeIcon icon={FiMessageCircle} className="w-5 h-5" /> Explain with AI
                        </button>
                        <button
                          onClick={handleNext}
                          className="flex-1 py-4 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                        >
                          <span>{currentDrillIndex === drills.length - 1 ? "Complete Drill Set" : "Next Question"}</span>
                          <SafeIcon icon={FiChevronRight} className="w-5 h-5" />
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

      {/* AI Tutor Modal */}
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