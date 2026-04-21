import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import MathRenderer from '../../../common/MathRenderer';
import { aiService, planService } from '../../../services/api';
import supabase from '../../../supabase/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const {
  FiCpu, FiSend, FiUser, FiZap, FiLoader,
  FiBookOpen, FiTarget, FiAward, FiRefreshCw
} = FiIcons;

import BrandName from '../../../common/BrandName';

const PAGE_TYPE = "KB_ONLY";

// Quick-action suggestion chips shown in the welcome state
const QUICK_ACTIONS = [
  { label: '🎯 Two-variable data: models and scatterplots', msg: 'Give me 10 quiz questions on Two-variable data: models and scatterplots' },
  { label: '🎯 Words in Context', msg: 'Give me 10 quiz questions on Words in Context' },
  { label: '🎯 Math', msg: 'Give me 10 quiz questions on Math' },
  { label: '🎯 Reading & Writing', msg: 'Give me 10 quiz questions on Reading & Writing' },
];

/**
 * ROBUST KB TOPIC EXTRACTOR
 * Extracts clean, searchable topic names for KB matching.
 * Preserves important topic keywords while removing request-specific words.
 */
const extractKBTopic = (text) => {
  if (!text) return "";
  const t = text.toLowerCase().trim();

  // High-priority patterns that look for core SAT topics
  const patterns = [
    // Matches "10 questions quiz on Algebra", "Give me quiz on Algebra", etc.
    // Handles multi-word keywords like "questions quiz on" or "drills about"
    /(?:quiz|questions?|practice|drill|test|problems?|items?|exercises?|drills?)+(?:\s+(?:quiz|questions?|practice|drill|test|problems?|items?|exercises?|me|some|any))*(?:\s+(?:on|about|for|regarding|to|of))+\s+(.*)/i,

    // Simple fallback: anything after "on/about/for/to"
    /\b(?:on|about|for|regarding|to|of)\s+(.*)/i,

    // Matches "Algebra quiz", "Algebra practice"
    /(.*)\s+(?:quiz|practice|drill|test|exercise|questions?|drills?)/i,
  ];

  for (const p of patterns) {
    const match = t.match(p);
    if (match && match[1]) {
      let cleaned = match[1]
        .replace(/^(?:a|an|the|is|are|of|in|some|any|give me|want|need|send me|show me)\s+/gi, '') // Remove starting filler
        .replace(/\b(?:quiz|questions?|about|regarding|me|on|give|want|practice|drill|drills|test|exercise|problems?|items?|exercises?|me|some|any)\b/gi, '')
        .replace(/\b\d+\b/g, '') // Remove lone numbers (counts)
        .replace(/[?|!|"]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')
        .trim();

      // Only return if we have meaningful content (more than 2 characters)
      if (cleaned.length > 2) {
        console.log(`📝 [Topic Extract] Extracted: "${cleaned}" from "${text}"`);
        return cleaned;
      }
    }
  }

  // Fallback: Remove all common request words across the entire string
  const noisyWordsRegex = /\b(give me|i want|send me|please|show me|quiz|questions?|practice|drill|test|on|about|for|regarding|a|an|the|is|are|some|any|on)\b/gi;
  let cleanedFallback = t.replace(noisyWordsRegex, '')
    .replace(/\b\d+\b/g, '') // Remove lone numbers
    .replace(/[?|!|"]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedFallback.length > 2) {
    console.log(`📝 [Topic Extract] Fallback cleaned: "${cleanedFallback}" from "${text}"`);
    return cleanedFallback;
  }

  console.log(`📝 [Topic Extract] Final fallback full text: "${t}"`);
  return t;
};

/**
 * Extracts the requested question count from user message.
 * Returns the exact number requested by the user, or 10 as a balanced default.
 */
const extractQuizCount = (text) => {
  if (!text) return 10;

  // Robust patterns to capture question count
  const patterns = [
    /\b(\d+)\s*(?:questions?|qs|problems?|items?|exercises?|mcqs?)\b/i,  // "10 questions", "10 mcqs"
    /\bgive me\s+(\d+)\b/i,  // "give me 10"
    /\b(\d+)\s*(?:question|quiz|drill|practice)\b/i,  // "10 question quiz"
    /(?:set|generate|make|create)\s+(?:a |an )?(\d+)/i,  // "generate 15"
    /\b(\d+)\s*[-–—]\s*question/i,  // "15-question"
    /\b(\d+)\s*$/i, // Numbers at the very end of a request
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = parseInt(match[1]);
      if (!isNaN(val) && val > 0) {
        console.log(`🔢 [Quiz Count] User explicitly requested ${val} questions.`);
        return Math.min(val, 50); // High safety cap of 50
      }
    }
  }

  return 10; // Default to 10 for a solid practice session
};

/**
 * INTERACTIVE KB QUIZ COMPONENT
 * Handles MCQ/Short Answer interactivity, image rendering, and reveals explanations only after submission.
 */
const KBQuizWidget = ({ questions }) => {
  const [studentAnswers, setStudentAnswers] = useState({});
  const [submitted, setSubmitted] = useState({});

  if (!questions || questions.length === 0) return <div>No questions found.</div>;

  const handleSubmit = (qId) => {
    setSubmitted(prev => ({ ...prev, [qId]: true }));
  };

  const handleAnswerChange = (qId, value) => {
    if (submitted[qId]) return;
    setStudentAnswers(prev => ({ ...prev, [qId]: value }));
  };

  return (
    <div className="kb-quiz-container space-y-10 py-2">
      {questions.map((q, idx) => {
        const isMcq = q.type === 'mcq' || (q.options && q.options.length > 0);
        const isSubmitted = submitted[q.id];
        const studentAnswer = studentAnswers[q.id];
        const isCorrect = isMcq
          ? studentAnswer === q.correctAnswer
          : studentAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();

        return (
          <div key={q.id} className="kb-question-block bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-all">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest">Question {idx + 1}</span>
                <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">{q.topic} • {q.difficulty}</span>
              </div>
              {isSubmitted && (
                <span className={`text-xs font-bold flex items-center gap-1.5 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                  <SafeIcon icon={isCorrect ? FiIcons.FiCheckCircle : FiIcons.FiXCircle} className="w-4 h-4" />
                  {isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              )}
            </div>

            <div className="p-6 space-y-6">
              {/* Question Text + Images/Tables from HTML */}
              <div className="kb-rich-content text-slate-800 dark:text-slate-200 text-sm md:text-base leading-relaxed font-medium">
                <MathRenderer text={q.questionHtml || q.text || ''} />
              </div>

              {/* Redundant image fallback: Only show if neither field has an image tag/placeholder */}
              {(!((q.questionHtml || '').includes('<img') || (q.questionHtml || '').includes('[IMAGE:') || (q.text || '').includes('<img') || (q.text || '').includes('[IMAGE:'))) && (q.imageUrl || q.image) && (
                <div className="flex justify-center my-6 bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <img
                    src={q.imageUrl || q.image}
                    className="max-h-[400px] w-auto h-auto object-contain rounded-xl shadow-sm"
                    alt="Question visual"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}

              {/* Interaction Area */}
              <div className="quiz-interaction pt-4">
                {isMcq ? (
                  /* MCQ OPTIONS: Exactly 4 options max */
                  <div className="grid grid-cols-1 gap-3">
                    {(q.options || []).slice(0, 4).map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isSelected = studentAnswer === letter;
                      const isOptionCorrect = isSubmitted && letter === q.correctAnswer;
                      const isOptionWrong = isSubmitted && isSelected && !isCorrect;

                      return (
                        <button
                          key={i}
                          disabled={isSubmitted}
                          onClick={() => handleAnswerChange(q.id, letter)}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${isSelected
                              ? 'border-red-500 bg-red-50 dark:bg-red-500/10'
                              : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-white/5'
                            } ${isOptionCorrect ? 'border-green-500 bg-green-50 dark:bg-green-500/10' : ''} 
                            ${isOptionWrong ? 'border-red-500 bg-red-50 dark:bg-red-500/10' : ''}
                            hover:shadow-md active:scale-[0.98] disabled:active:scale-100 disabled:cursor-default`}
                        >
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${isSelected ? 'bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            } ${isOptionCorrect ? 'bg-green-600 text-white' : ''} ${isOptionWrong ? 'bg-red-600 text-white' : ''}`}>
                            {letter}
                          </span>
                          <span className="flex-1 font-medium"><MathRenderer text={opt} /></span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* SHORT ANSWER: Input box */
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Your Answer</label>
                    <input
                      type="text"
                      disabled={isSubmitted}
                      value={studentAnswer || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-red-500 outline-none font-medium transition-all disabled:opacity-70"
                    />
                  </div>
                )}
              </div>

              {/* Submission Button */}
              {!isSubmitted && (
                <div className="pt-4">
                  <button
                    disabled={!studentAnswer}
                    onClick={() => handleSubmit(q.id)}
                    className="w-full py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-white transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:active:scale-100"
                  >
                    Check Answer
                  </button>
                </div>
              )}

              {/* Reveal explanation only after submission */}
              <AnimatePresence>
                {isSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4"
                  >
                    <div className="p-5 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/20 rounded-3xl">
                      <div className="flex items-center gap-2 mb-3 text-green-700 dark:text-green-400 text-xs font-black uppercase tracking-widest">
                        <SafeIcon icon={FiIcons.FiAward} className="w-4 h-4" />
                        Correct Answer: {q.correctAnswer}
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                        <MathRenderer text={q.explanation || 'No explanation provided for this question.'} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DIFFICULTY_CONFIG = {
  Easy: { emoji: '🟢', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/40', active: 'bg-green-500 text-white' },
  Medium: { emoji: '🟡', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/40', active: 'bg-yellow-500 text-white' },
  Hard: { emoji: '🔴', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/40', active: 'bg-red-500 text-white' },
};

// ── Premium Welcome Card (rendered instead of plain markdown for msg id=1) ──
const WelcomeCard = () => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden w-full max-w-[420px] shadow-xl transition-all duration-300">
    {/* Card header */}
    <div className="bg-gradient-to-r from-red-600 to-red-800 p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">🤖</div>
      <div>
        <div className="text-white font-bold text-sm leading-tight">Personal AI SAT Tutor</div>
        <div className="text-white/70 text-[10px] mt-0.5">Digital SAT Specialist • Online</div>
      </div>
    </div>

    {/* Card body */}
    <div className="p-5">
      <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">I can help you with</p>

      {[
        { icon: '🎯', label: 'Practice Quizzes', example: 'Quiz me on Algebra' },
      ].map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-3 mb-2 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl transition-colors">
          <span className="text-xl flex-shrink-0">{item.icon}</span>
          <div>
            <div className="text-slate-900 dark:text-white font-bold text-xs">{item.label}</div>
            <div className="text-slate-400 dark:text-slate-500 text-[10px] mt-0.5 italic">"{item.example}"</div>
          </div>
        </div>
      ))}

      <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-center">
        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
          Difficulty is set to <span className="text-red-600 dark:text-red-400">Medium</span> — change it anytime above
        </p>
      </div>
    </div>
  </div>
);

const AITutorAgent = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', isWelcome: true }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState('Medium');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Track shown question IDs to prevent duplicates across session
  const [shownQuestionIds, setShownQuestionIds] = useState(new Set());
  // Track stable keys (ID preferred, text fallback) for client-side de-duplication safety
  const [shownQuestionKeys, setShownQuestionKeys] = useState(new Set());
  const SEEN_IDS_STORAGE_KEY = 'kb_seen_ids_by_topic_level_v1';

  const normalizeQuestionId = (id) => (id == null ? '' : String(id));
  const toApiExcludeIds = (ids) =>
    Array.from(ids).map((id) => {
      const s = String(id).trim();
      return /^\d+$/.test(s) ? Number(s) : s;
    });
  const topicLevelKey = (topic, level) => `${String(level || '').toLowerCase()}::${String(topic || '').toLowerCase().trim()}`;
  const readPersistedSeenIds = (topic, level) => {
    try {
      const raw = localStorage.getItem(SEEN_IDS_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      const list = parsed?.[topicLevelKey(topic, level)] || [];
      return new Set(Array.isArray(list) ? list.map(normalizeQuestionId).filter(Boolean) : []);
    } catch {
      return new Set();
    }
  };
  const writePersistedSeenIds = (topic, level, ids) => {
    try {
      const key = topicLevelKey(topic, level);
      const raw = localStorage.getItem(SEEN_IDS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[key] = Array.from(new Set(ids.map(normalizeQuestionId).filter(Boolean)));
      localStorage.setItem(SEEN_IDS_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // best effort only
    }
  };
  const buildQuestionKey = (q, topic, level) => {
    const normalizedId = normalizeQuestionId(q?.id);
    if (normalizedId) return `id:${normalizedId}`;
    const textBasis = String(q?.questionHtml || q?.text || q?.question || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    return `fallback:${String(topic || '').toLowerCase()}|${String(level || '').toLowerCase()}|${textBasis}`;
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    fetchAvailableTopics();
  }, []);

  const [availableTopics, setAvailableTopics] = useState([]);

  const fetchAvailableTopics = async () => {
    // Hardcoding specific user requested topics to ensure they always appear as chips
    const hardcodedTopics = [
      { label: '🎯 Two-variable data: models and scatterplots', msg: 'Give me 10 quiz questions on Two-variable data: models and scatterplots' },
      { label: '🎯 Words in Context', msg: 'Give me 10 quiz questions on Words in Context' },
      { label: '🎯 Math', msg: 'Give me 10 quiz questions on Math' },
      { label: '🎯 Reading & Writing', msg: 'Give me 10 quiz questions on Reading & Writing' },
    ];
    setAvailableTopics(hardcodedTopics);
  };

  const fetchQuizBatch = async (topic, level, count, excludeIds) => {
    const normalizeLevel = (lvl) =>
      String(lvl || 'Medium').charAt(0).toUpperCase() + String(lvl || 'Medium').slice(1).toLowerCase();
    const mapDbQuestion = (q) => ({
      id: q.id,
      topic: q.topic,
      difficulty: q.level,
      type: q.type || 'mcq',
      text: q.question || q.text,
      questionHtml: q.question_html,
      options: q.options || [],
      correctAnswer: q.correct_answer,
      explanation: q.explanation || '',
      createdAt: q.created_at,
      imageUrl: q.image_url || q.image,
      images: q.images || [],
      tables: q.tables || [],
      formulas: q.formulas || [],
      formatting: q.formatting || {}
    });

    const fetchDirectFromSupabase = async (requestedCount = count, extraExcludeIds = []) => {
      const diff = normalizeLevel(level);
      const idExclusions = Array.from(new Set([
        ...(Array.isArray(excludeIds) ? excludeIds : []),
        ...(Array.isArray(extraExcludeIds) ? extraExcludeIds : [])
      ])).filter((id) => id != null);
      let query = supabase
        .from('questions')
        .select('*')
        .ilike('level', diff);

      // 🎯 MODIFIED: Handle broad subject-level requests (Math/RW)
      const t = topic.toLowerCase().trim();
      const isMath = t === 'math' || t === 'mathematics' || t === 'maths';
      const isRW = t === 'reading & writing' || t === 'english' || t === 'verbal' || t === 'reading' || t === 'writing';

      if (isMath) {
        // Broad Math search across common math-related topics
        query = query.or('topic.ilike.%algebra%,topic.ilike.%linear%,topic.ilike.%geometry%,topic.ilike.%trig%,topic.ilike.%math%,topic.ilike.%equation%,topic.ilike.%problem%,topic.ilike.%data%,topic.ilike.%stat%');
      } else if (isRW) {
        // Broad Reading & Writing search across common verbal-related topics
        query = query.or('topic.ilike.%reading%,topic.ilike.%writing%,topic.ilike.%evidence%,topic.ilike.%words%,topic.ilike.%grammar%,topic.ilike.%inference%,topic.ilike.%rhetorical%,topic.ilike.%context%,topic.ilike.%boundaries%,topic.ilike.%transitions%');
      } else {
        // Specific topic search
        query = query.ilike('topic', topic);
      }

      if (idExclusions.length > 0) {
        query = query.not('id', 'in', `(${idExclusions.join(',')})`);
      }

      const { data, error } = await query.limit(Math.max(count * 5, 150));
      if (error) throw error;

      const unique = [];
      const seen = new Set();
      for (const q of data || []) {
        const idKey = String(q.id);
        if (seen.has(idKey)) continue;
        seen.add(idKey);
        unique.push(q);
      }
      for (let i = unique.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [unique[i], unique[j]] = [unique[j], unique[i]];
      }
      const mapped = unique.slice(0, requestedCount).map(mapDbQuestion);
      return {
        data: {
          questions: mapped,
          requestedCount: requestedCount,
          actualCount: mapped.length,
          exhausted: mapped.length === 0
        }
      };
    };

    const topUpWithSupabase = async (existingQuestions = []) => {
      if ((existingQuestions || []).length >= count) return existingQuestions.slice(0, count);
      const existingIds = existingQuestions.map((q) => q?.id).filter((id) => id != null);
      const needed = count - existingQuestions.length;
      const supaRes = await fetchDirectFromSupabase(needed, existingIds);
      const supaQuestions = supaRes?.data?.questions || [];
      const seen = new Set(existingIds.map((id) => String(id)));
      const merged = [...existingQuestions];
      for (const q of supaQuestions) {
        const idKey = String(q?.id);
        if (!idKey || seen.has(idKey)) continue;
        seen.add(idKey);
        merged.push(q);
        if (merged.length >= count) break;
      }
      return merged.slice(0, count);
    };

    // Primary route: dedicated KB quiz endpoint
    try {
      const res = await aiService.kbQuiz(topic, level, count, excludeIds);
      console.log(
        `📦 [KB_ONLY] API returned ${res?.data?.actualCount ?? (res?.data?.questions?.length || 0)}/${count} ` +
        `| unusedAvailable=${res?.data?.unusedAvailable ?? 'n/a'} | exhausted=${res?.data?.exhausted ?? false}`
      );
      const baseQuestions = res?.data?.questions || [];
      const finalQuestions = await topUpWithSupabase(baseQuestions);
      return {
        data: {
          ...(res?.data || {}),
          questions: finalQuestions,
          requestedCount: count,
          actualCount: finalQuestions.length,
          exhausted: (res?.data?.exhausted === true) && finalQuestions.length === 0
        }
      };
    } catch (err) {
      // Compatibility fallback for deployments that only expose /api/ai/prep365-chat
      const status = err?.response?.status;
      if (status === 404 || status === 405) {
        try {
          const fallbackRes = await aiService.prep365Chat(topic, level, count, excludeIds);
          const baseQuestions = fallbackRes?.data?.questions || [];
          const finalQuestions = await topUpWithSupabase(baseQuestions);
          if (finalQuestions.length > 0) {
            return {
              data: {
                questions: finalQuestions,
                requestedCount: count,
                actualCount: finalQuestions.length,
                exhausted: false
              }
            };
          }
        } catch (_) {
          // Continue to direct supabase fallback
        }
        return await fetchDirectFromSupabase();
      }
      throw err;
    }
  };

  const handleSend = async (text) => {
    const msgText = (text || input).trim();
    if (!msgText) return;

    const userMsg = { id: Date.now(), sender: 'user', text: msgText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      if (PAGE_TYPE === "KB_ONLY") {
        const topic = extractKBTopic(msgText);
        const requestedCount = extractQuizCount(msgText);

        // 1. Topic Gating Check
        const hasAccess = await planService.checkAccess(user.id, 'topic', topic);
        if (!hasAccess) {
          setMessages(prev => [...prev, {
            id: Date.now() + 1,
            sender: 'ai',
            text: `🔒 **Topic Restricted:** The topic **"${topic}"** is only available in our **Premium Plan**. \n\nPlease upgrade to unlock this and over 10,000+ targeted practice questions!`
          }]);
          setLoading(false);
          return;
        }

        // 2. Question Limit Check
        const usage = await planService.getUsageStats(user.id);
        const { data: profile } = await supabase.from('profiles').select('plan_type').eq('id', user.id).single();
        const { data: settings } = await planService.getSettings();
        const userPlan = (profile?.plan_type || user?.plan_type || 'free').toLowerCase();
        const planSettings = (settings || []).find(s => s.plan_type === userPlan);

        // For Math/RW specific limits, we'd need more complex logic, but for simplicity:
        const totalLimit = (planSettings?.max_questions_math || 250) + (planSettings?.max_questions_rw || 250);

        if (usage.totalQuestions >= totalLimit) {
          setMessages(prev => [...prev, {
            id: Date.now() + 1,
            sender: 'ai',
            text: `⚠️ **Question Limit Reached:** You've completed your **${userPlan.toUpperCase()}** plan limit of ${totalLimit} questions. \n\nUpgrade to **Premium** for unlimited practice!`
          }]);
          setLoading(false);
          return;
        }

        const normalizedShownIdSet = new Set(Array.from(shownQuestionIds).map(normalizeQuestionId));
        const shownKeySet = new Set(shownQuestionKeys);
        const persistedSeen = readPersistedSeenIds(topic, difficulty);
        let effectiveExclude = new Set([
          ...Array.from(normalizedShownIdSet),
          ...Array.from(persistedSeen)
        ]);
        console.log(`🔍 [KB_ONLY] Extraction -> Topic: "${topic}", Count: ${requestedCount} | Excl: ${effectiveExclude.size}`);

        // Fill exactly requested count whenever unused questions exist.
        let collected = [];
        let backendExhausted = false;
        let unusedAvailable = null;
        const maxAttempts = 4;
        let attempts = 0;
        while (collected.length < requestedCount && attempts < maxAttempts && !backendExhausted) {
          attempts += 1;
          const needed = requestedCount - collected.length;
          const res = await fetchQuizBatch(topic, difficulty, needed, toApiExcludeIds(effectiveExclude));
          const fetchedQuestions = res?.data?.questions || [];
          const hasUnusedAvailable = Object.prototype.hasOwnProperty.call(res?.data || {}, 'unusedAvailable');
          if (hasUnusedAvailable) unusedAvailable = Number(res?.data?.unusedAvailable);
          backendExhausted = res?.data?.exhausted === true;

          if (fetchedQuestions.length === 0) break;

          const batchFresh = fetchedQuestions.filter((q) => {
            const qid = normalizeQuestionId(q?.id);
            if (!qid) return false;
            if (effectiveExclude.has(qid)) return false;
            return true;
          });
          if (batchFresh.length === 0) {
            // Backend may return overlap when filters are broad; exclude and continue probing.
            fetchedQuestions.forEach((q) => {
              const qid = normalizeQuestionId(q?.id);
              if (qid) effectiveExclude.add(qid);
            });
            continue;
          }

          collected = [...collected, ...batchFresh];
          batchFresh.forEach((q) => {
            const qid = normalizeQuestionId(q?.id);
            if (qid) effectiveExclude.add(qid);
          });
        }

        const questionsToShow = collected.slice(0, requestedCount);

        if (questionsToShow.length > 0) {
          console.log(`✅ [KB_ONLY] Showing ${questionsToShow.length} unique questions (requested ${requestedCount}).`);

          // Update session history
          const updatedShownIds = new Set(normalizedShownIdSet);
          const updatedShownKeys = new Set(shownKeySet);
          questionsToShow.forEach((q) => {
            const qid = normalizeQuestionId(q?.id);
            if (qid) updatedShownIds.add(qid);
            updatedShownKeys.add(buildQuestionKey(q, topic, difficulty));
          });
          setShownQuestionIds(updatedShownIds);
          setShownQuestionKeys(updatedShownKeys);
          writePersistedSeenIds(topic, difficulty, Array.from(updatedShownIds));

          // Add the quiz message
          setMessages(prev => [...prev, {
            id: Date.now() + 1,
            sender: 'ai',
            questions: questionsToShow,
            isKB: true
          }]);
        } else {
          // Only show completion message when backend EXPLICITLY confirms exhaustion.
          const trulyExhausted = backendExhausted || unusedAvailable === 0;
          if (trulyExhausted) {
            setMessages(prev => [...prev, {
              id: Date.now() + 1,
              sender: 'ai',
              text: `💡 It looks like you've already completed all available questions on **"${topic}"** at **${difficulty}** level.\n\nI've shown you everything currently available with your selected filters. Try another topic or difficulty level.`
            }]);
          } else {
            // Recovery path: if exclude state drifted, probe once without excludes and keep only unseen questions.
            const rescue = await fetchQuizBatch(topic, difficulty, requestedCount, []);
            const rescueQuestions = (rescue?.data?.questions || []).filter((q) => {
              const qKey = buildQuestionKey(q, topic, difficulty);
              return !shownKeySet.has(qKey);
            }).slice(0, requestedCount);

            if (rescueQuestions.length > 0) {
              const updatedShownIds = new Set(normalizedShownIdSet);
              const updatedShownKeys = new Set(shownKeySet);
              rescueQuestions.forEach((q) => {
                const qid = normalizeQuestionId(q?.id);
                if (qid) updatedShownIds.add(qid);
                updatedShownKeys.add(buildQuestionKey(q, topic, difficulty));
              });
              setShownQuestionIds(updatedShownIds);
              setShownQuestionKeys(updatedShownKeys);
              writePersistedSeenIds(topic, difficulty, Array.from(updatedShownIds));

              setMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'ai',
                questions: rescueQuestions,
                isKB: true
              }]);
            } else {
              // Prefer an actionable message over reset-loop instructions when nothing new exists.
              const explicitShortage = requestedCount > 1
                ? `I couldn't find ${requestedCount} fresh unique questions right now for **"${topic}"** at **${difficulty}**.`
                : `I couldn't find a fresh unique question right now for **"${topic}"** at **${difficulty}**.`;
              setMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'ai',
                text: `⚠️ ${explicitShortage}\n\nTry changing difficulty or topic to continue practicing.`
              }]);
            }
          }
        }
      } else {
        const res = await aiService.tutorChat(msgText, difficulty);
        const reply = res.data?.reply || "I'm analyzing that...";
        setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply }]);
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || "Connection error";

      if (PAGE_TYPE === "KB_ONLY" && err.response?.status === 404) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: `❌ **No questions found:** I don't have enough entries in my Knowledge Base for that specific request yet.\n\nPlease try another SAT topic like "Boundaries" or "One-variable Data Distributions".`
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ **Error:** ${errMsg}\n\nPlease try again or check your internet connection.`
        }]);
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleReset = () => {
    setMessages([{ id: Date.now(), sender: 'ai', isWelcome: true }]);
    setShownQuestionIds(new Set()); // Reset session history
    setShownQuestionKeys(new Set()); // Reset client dedupe keys
    try { localStorage.removeItem(SEEN_IDS_STORAGE_KEY); } catch { /* noop */ }
    if (PAGE_TYPE !== "KB_ONLY") {
      aiService.tutorChat("reset", difficulty).catch(() => { });
    }
  };

  const DifficultyButton = ({ level }) => {
    const cfg = DIFFICULTY_CONFIG[level];
    const isActive = difficulty === level;
    return (
      <button
        onClick={() => setDifficulty(level)}
        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all duration-200 ${isActive
          ? cfg.active + ' shadow-md scale-105'
          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/15'
          }`}
        title={`Set difficulty to ${level}`}
      >
        {cfg.emoji} {level.toUpperCase()}
      </button>
    );
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-black p-4 flex justify-between items-center text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#E53935] to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/50 flex-shrink-0">
            <SafeIcon icon={FiCpu} className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight"><BrandName className="text-lg" /></h1>
            <p className="text-gray-400 text-xs flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
              Online • Digital SAT Specialist
            </p>
          </div>
        </div>

        {/* Difficulty Selector + Reset */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
            {['Easy', 'Medium', 'Hard'].map(level => (
              <DifficultyButton key={level} level={level} />
            ))}
          </div>
          <button
            onClick={handleReset}
            title="Reset session"
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors ml-1"
          >
            <SafeIcon icon={FiRefreshCw} className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>

      {/* Mobile Difficulty Bar */}
      <div className="md:hidden flex items-center gap-1 bg-gray-900 px-4 py-2 justify-center border-b border-gray-700">
        {['Easy', 'Medium', 'Hard'].map(level => (
          <DifficultyButton key={level} level={level} />
        ))}
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar bg-white dark:bg-slate-900/50">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm text-sm ${msg.sender === 'user'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-white text-[#E53935] border border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                }`}>
                {msg.sender === 'user' ? '👤' : '🤖'}
              </div>

              {/* Bubble */}
              {msg.isWelcome ? (
                <WelcomeCard />
              ) : msg.isKB ? (
                <div className="w-full max-w-[95%] md:max-w-2xl bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
                  <KBQuizWidget questions={msg.questions} />
                </div>
              ) : (
                <div className={`p-3.5 rounded-2xl max-w-[82%] md:max-w-[78%] shadow-sm text-sm leading-relaxed ${msg.sender === 'user'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-none'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                  }`}>
                  <MathRenderer text={msg.text} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm flex-shrink-0">
              🤖
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center shadow-sm">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick action chips */}
        {messages.length <= 2 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-2 pt-2"
          >
            {(availableTopics.length > 0 ? availableTopics : QUICK_ACTIONS).map((action, i) => (
              <button
                key={i}
                onClick={() => handleSend(action.msg)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-700 dark:text-slate-300 hover:border-[#E53935] hover:text-[#E53935] transition-all duration-150 shadow-sm hover:shadow-md"
              >
                {action.label}
              </button>
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative max-w-4xl mx-auto">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask a doubt, paste a question, or say 'Quiz me on Algebra'…"
            disabled={loading}
            className="w-full pl-5 pr-14 py-3.5 bg-gray-100 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-gray-300 dark:focus:border-gray-600 rounded-full outline-none transition-all text-gray-900 dark:text-white text-sm font-medium disabled:opacity-60"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#E53935] text-white rounded-full flex items-center justify-center hover:bg-red-700 disabled:opacity-40 transition-all shadow-md hover:shadow-red-500/30 hover:scale-105 active:scale-95"
          >
            {loading ? (
              <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />
            ) : (
              <SafeIcon icon={FiSend} className="w-4 h-4 ml-0.5" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          AI can make mistakes. Review important concepts. &nbsp;•&nbsp; Difficulty: <strong>{DIFFICULTY_CONFIG[difficulty]?.emoji} {difficulty}</strong>
        </p>
      </div>
    </div>
  );
};

export default AITutorAgent;
