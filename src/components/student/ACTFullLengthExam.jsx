import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import AdaptiveResultsDashboard from '../common/AdaptiveResultsDashboard';
import { courseService, gradingService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';

const {
  FiChevronLeft, FiChevronRight, FiClock, FiFlag, FiLogOut, FiAlertCircle,
  FiCheckCircle, FiRefreshCw, FiChevronDown, FiX, FiPlay, FiAward, FiZap,
  FiAlertTriangle, FiBarChart2, FiBook, FiTarget, FiActivity, FiStar
} = FiIcons;

// ─────────────────────────────────────────────────────────────────────────────
// ACT SCORING LOOKUP TABLES
// Source: Approximate official ACT conversion (typical curve)
// ─────────────────────────────────────────────────────────────────────────────
const ENGLISH_TABLE = {
  50:36,49:35,48:34,47:33,46:32,45:31,44:30,43:29,42:29,41:28,40:28,
  39:27,38:27,37:26,36:26,35:25,34:25,33:24,32:23,31:23,30:22,29:21,
  28:21,27:20,26:20,25:19,24:19,23:18,22:18,21:17,20:16,19:16,18:15,
  17:15,16:14,15:13,14:13,13:12,12:11,11:11,10:10,9:9,8:8,7:7,6:6,
  5:5,4:4,3:3,2:2,1:1,0:1
};

const MATH_TABLE = {
  45:36,44:34,43:33,42:33,41:32,40:32,39:31,38:31,37:30,36:30,35:29,
  34:28,33:28,32:27,31:26,30:26,29:25,28:24,27:24,26:23,25:22,24:21,
  23:20,22:19,21:19,20:18,19:18,18:17,17:17,16:16,15:16,14:15,13:15,
  12:14,11:13,10:13,9:12,8:11,7:10,6:9,5:8,4:7,3:5,2:4,1:2,0:1
};

const READING_TABLE = {
  36:36,35:34,34:32,33:31,32:30,31:29,30:28,29:27,28:26,27:25,26:24,
  25:24,24:23,23:22,22:22,21:21,20:20,19:20,18:19,17:18,16:18,15:17,
  14:16,13:15,12:14,11:13,10:12,9:11,8:10,7:9,6:8,5:7,4:6,3:5,2:3,1:2,0:1
};

const SCIENCE_TABLE = {
  40:36,39:35,38:34,37:33,36:32,35:31,34:30,33:29,32:28,31:27,30:26,
  29:26,28:25,27:24,26:24,25:23,24:22,23:22,22:21,21:20,20:19,19:19,
  18:18,17:17,16:16,15:15,14:14,13:13,12:12,11:11,10:10,9:9,8:8,7:7,
  6:6,5:5,4:4,3:3,2:2,1:1,0:1
};

const rawToScale = (table, raw) => {
  const clamped = Math.max(0, Math.min(raw, Object.keys(table).length - 1));
  return table[clamped] ?? 1;
};

// Composite: avg of English + Math + Reading, halves round up
const calcComposite = (eng, math, read) => {
  const avg = (eng + math + read) / 3;
  return Math.round(avg + Number.EPSILON); // halves round up via EPSILON
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    key: 'mathematics',
    label: 'Mathematics',
    questionCount: 45,
    durationSeconds: 50 * 60,
    sectionNumber: 1,
    color: '#3B82F6',
    bg: 'from-blue-900 to-blue-800'
  },
  {
    key: 'english',
    label: 'English',
    questionCount: 50,
    durationSeconds: 35 * 60,
    sectionNumber: 2,
    color: '#8B5CF6',
    bg: 'from-purple-900 to-purple-800'
  },
  {
    key: 'reading',
    label: 'Reading',
    questionCount: 36,
    durationSeconds: 40 * 60,
    sectionNumber: 3,
    color: '#10B981',
    bg: 'from-emerald-900 to-emerald-800'
  },
  {
    key: 'science',
    label: 'Science',
    questionCount: 40,
    durationSeconds: 40 * 60,
    sectionNumber: 4,
    color: '#F59E0B',
    bg: 'from-amber-900 to-amber-800',
    optional: true
  }
];

const BREAK_DURATION = 15 * 60; // 900 seconds

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const ACTFullLengthExam = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(window.location.search);
  const isPracticeMode = searchParams.get('mode') === 'practice';

  // ── Flow State ──────────────────────────────────────────────────────────────
  // Possible screens:
  //   'loading' | 'section' | 'review' | 'break' | 'science_confirm' | 'results'
  const [screen, setScreen] = useState('loading');
  const [sectionIndex, setSectionIndex] = useState(0); // 0=Math,1=Eng,2=Read,3=Sci
  const [includedScience, setIncludedScience] = useState(false);

  // ── Data State ───────────────────────────────────────────────────────────────
  const [courseInfo, setCourseInfo] = useState(null);
  const [allSectionQuestions, setAllSectionQuestions] = useState({
    mathematics: [], english: [], reading: [], science: []
  });
  const [loadError, setLoadError] = useState(null);

  // ── Exam State ───────────────────────────────────────────────────────────────
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { qId: answer }
  const [flaggedQuestions, setFlaggedQuestions] = useState({});

  // ── Timer State ──────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(0);
  const [breakTimeLeft, setBreakTimeLeft] = useState(BREAK_DURATION);

  // ── Results State ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const submittedRef = useRef(false);

  // ── Security State ───────────────────────────────────────────────────────────
  const [showSecurityAlert, setShowSecurityAlert] = useState(false);
  const [violationCount, setViolationCount] = useState(0);

  // ── UI State ─────────────────────────────────────────────────────────────────
  const [showNavigation, setShowNavigation] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const wasDarkMode = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. INITIAL LOAD
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Store previous theme state
    wasDarkMode.current =
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark');
      
    if (screen === 'results' && wasDarkMode.current) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else if (screen !== 'results') {
      // Enforce light mode during the exam itself
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }

    return () => {
      // Restore user's preferred theme on exit
      if (wasDarkMode.current) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
    };
  }, [screen]);

  useEffect(() => {
    if (courseId) loadExamData();
  }, [courseId]);

  const loadExamData = async () => {
    setScreen('loading');
    try {
      // 1. Load course info
      const courseRes = await courseService.getById(courseId);
      if (!courseRes.data) throw new Error('Course not found');
      setCourseInfo(courseRes.data);

      console.log('🎯 [ACT-EXAM] Loading ACT Full-Length questions for course:', courseId);

      // 2. Fetch all uploads for this course
      const { data: uploads, error: uploadsErr } = await supabase
        .from('uploads')
        .select('id, section, level, file_name, category, status')
        .eq('course_id', courseId)
        .eq('category', 'quiz_document')
        .in('status', ['completed', 'warning'])
        .order('id', { ascending: false });

      if (uploadsErr) throw uploadsErr;
      if (!uploads || uploads.length === 0) {
        throw new Error('No quiz documents found for this ACT Full-Length Test.');
      }

      console.log('📂 [ACT-EXAM] Found uploads:', uploads.map(u => `${u.id}:${u.section || u.file_name}`));

      // 3. Identify best upload per section
      // Match by section field first, then fall back to file_name keyword matching
      const sectionUploadIds = {}; // { 'mathematics': id, 'english': id, ... }

      const sectionKeywords = {
        mathematics: ['math'],
        english: ['english'],
        reading: ['reading'],
        science: ['science']
      };

      uploads.forEach(upload => {
        const rawSection = (upload.section || '').toLowerCase().trim();
        const rawFile = (upload.file_name || '').toLowerCase();
        const rawLevel = (upload.level || '').toLowerCase();

        let matchedSection = null;

        // Exact section field match
        for (const [sec, keywords] of Object.entries(sectionKeywords)) {
          if (keywords.some(kw => rawSection.includes(kw))) {
            matchedSection = sec;
            break;
          }
        }

        // Fallback: file name / level match
        if (!matchedSection) {
          for (const [sec, keywords] of Object.entries(sectionKeywords)) {
            if (keywords.some(kw => rawFile.includes(kw) || rawLevel.includes(kw))) {
              matchedSection = sec;
              break;
            }
          }
        }

        if (matchedSection && !sectionUploadIds[matchedSection]) {
          sectionUploadIds[matchedSection] = upload.id;
        }
      });

      console.log('🗂️ [ACT-EXAM] Section → Upload mapping:', sectionUploadIds);

      // 4. If no per-section uploads found, try a single combined upload (all questions in one upload)
      const foundSections = Object.keys(sectionUploadIds);
      const coreSections = ['mathematics', 'english', 'reading'];
      const hasCore = coreSections.every(s => foundSections.includes(s));

      let sectionQuestionsMap = { mathematics: [], english: [], reading: [], science: [] };

      if (!hasCore && uploads.length > 0) {
        // Single combined upload — load all questions and slice by count
        console.log('⚠️ [ACT-EXAM] No per-section uploads found. Trying combined approach...');
        const latestUploadId = uploads[0].id;
        const { data: allQs } = await supabase
          .from('questions')
          .select('*')
          .eq('upload_id', latestUploadId)
          .order('id', { ascending: true });

        if (allQs && allQs.length > 0) {
          const mapped = allQs.map(q => normalizeQuestion(q));
          // Try to split by section keyword in topic/category/subject
          const bySection = { mathematics: [], english: [], reading: [], science: [] };
          const unclassified = [];

          mapped.forEach(q => {
            const hint = `${q.topic || ''} ${q.category || ''} ${q.subject || ''}`.toLowerCase();
            if (hint.includes('math')) bySection.mathematics.push(q);
            else if (hint.includes('english')) bySection.english.push(q);
            else if (hint.includes('read')) bySection.reading.push(q);
            else if (hint.includes('science')) bySection.science.push(q);
            else unclassified.push(q);
          });

          // If categorization failed, slice sequentially: Math(45), English(50), Reading(36), Science(40)
          if (bySection.mathematics.length === 0 && bySection.english.length === 0) {
            const slices = [45, 50, 36, 40];
            const sectionKeys = ['mathematics', 'english', 'reading', 'science'];
            let offset = 0;
            sectionKeys.forEach((key, i) => {
              bySection[key] = mapped.slice(offset, offset + slices[i]);
              offset += slices[i];
            });
          }
          sectionQuestionsMap = bySection;
        }
      } else {
        // Per-section loading
        for (const [section, uploadId] of Object.entries(sectionUploadIds)) {
          const { data: qData } = await supabase
            .from('questions')
            .select('*')
            .eq('upload_id', uploadId)
            .order('id', { ascending: true });

          if (qData && qData.length > 0) {
            sectionQuestionsMap[section] = qData.map(q => normalizeQuestion(q));
            console.log(`✅ [ACT-EXAM] Loaded ${qData.length} questions for section: ${section}`);
          }
        }
      }

      // Validate core sections have questions
      const mathQs = sectionQuestionsMap.mathematics;
      const engQs = sectionQuestionsMap.english;
      const readQs = sectionQuestionsMap.reading;

      if (mathQs.length === 0 && engQs.length === 0 && readQs.length === 0) {
        throw new Error(
          'No questions found for this ACT Full-Length Test. Please ensure questions are uploaded with sections labeled as "mathematics", "english", "reading", and optionally "science".'
        );
      }

      setAllSectionQuestions(sectionQuestionsMap);
      // Start exam: first section = Mathematics (index 0)
      setSectionIndex(0);
      setCurrentQuestionIndex(0);
      setTimeLeft(SECTIONS[0].durationSeconds);
      setScreen('section');

    } catch (err) {
      console.error('❌ [ACT-EXAM] Load error:', err);
      setLoadError(err.message || 'Failed to load exam content.');
      setScreen('loading');
    }
  };

  const normalizeQuestion = (q) => ({
    ...q,
    text: q.question || q.question_text || q.text || '',
    options: q.options || [],
    correctAnswer: q.correct_answer || q.correctAnswer || ''
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CURRENT SECTION DATA
  // ─────────────────────────────────────────────────────────────────────────────
  const currentSection = SECTIONS[sectionIndex];
  const currentQuestions = allSectionQuestions[currentSection?.key] || [];
  const currentQuestion = currentQuestions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestion?.id] || '';

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. TIMERS
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'section') {
      if (timeLeft <= 0) {
        // Time's up — force to review screen
        setScreen('review');
        return;
      }
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [screen, timeLeft]);

  useEffect(() => {
    if (screen === 'break') {
      if (breakTimeLeft <= 0) {
        handleEndBreak();
        return;
      }
      const timer = setInterval(() => setBreakTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [screen, breakTimeLeft]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SECURITY / PROCTORING
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'section') return;
    const handle = (type) => {
      setViolationCount(v => v + 1);
      setShowSecurityAlert(true);
      setTimeout(() => setShowSecurityAlert(false), 3000);
      console.warn(`🛡️ [SECURITY] ${type} at Q${currentQuestionIndex + 1}`);
    };
    const onVis = () => { if (document.visibilityState === 'hidden') handle('tab_switch'); };
    const onBlur = () => handle('window_blur');
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
    };
  }, [screen, currentQuestionIndex]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. NAVIGATION & ANSWER HANDLING
  // ─────────────────────────────────────────────────────────────────────────────
  const handleAnswerSelect = (answer) => {
    if (currentQuestion) {
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
    }
  };

  const toggleFlag = () => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [`${currentSection.key}-${currentQuestionIndex}`]: !prev[`${currentSection.key}-${currentQuestionIndex}`]
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setScreen('review');
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. SECTION TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleAdvanceFromReview = () => {
    // Mathematics (0) → English (1)
    if (sectionIndex === 0) {
      advanceToSection(1);
      return;
    }
    // English (1) → Break
    if (sectionIndex === 1) {
      setBreakTimeLeft(BREAK_DURATION);
      setScreen('break');
      return;
    }
    // Reading (2) → Science confirmation popup
    if (sectionIndex === 2) {
      setScreen('science_confirm');
      return;
    }
    // Science (3) → Submit with science
    if (sectionIndex === 3) {
      submitExam(true);
    }
  };

  const advanceToSection = (newIndex) => {
    const newSection = SECTIONS[newIndex];
    setSectionIndex(newIndex);
    setCurrentQuestionIndex(0);
    setFlaggedQuestions({});
    setTimeLeft(newSection.durationSeconds);
    setScreen('section');
    window.scrollTo(0, 0);
  };

  const handleEndBreak = () => {
    // Break → Reading (2)
    advanceToSection(2);
  };

  const handleScienceYes = () => {
    setIncludedScience(true);
    advanceToSection(3);
  };

  const handleScienceNo = () => {
    setIncludedScience(false);
    submitExam(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. SCORING & SUBMISSION
  // ─────────────────────────────────────────────────────────────────────────────
  const calcSectionRaw = (sectionKey) => {
    const qs = allSectionQuestions[sectionKey] || [];
    return qs.filter(q => {
      const ans = (userAnswers[q.id] || '').toString().trim().toLowerCase();
      const correct = (q.correctAnswer || '').toString().trim().toLowerCase();
      return ans && correct && ans === correct;
    }).length;
  };

  const submitExam = async (withScience) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    try {
      const mathRaw = calcSectionRaw('mathematics');
      const engRaw = calcSectionRaw('english');
      const readRaw = calcSectionRaw('reading');
      const sciRaw = withScience ? calcSectionRaw('science') : null;

      const mathScaled = rawToScale(MATH_TABLE, mathRaw);
      const engScaled = rawToScale(ENGLISH_TABLE, engRaw);
      const readScaled = rawToScale(READING_TABLE, readRaw);
      const sciScaled = withScience ? rawToScale(SCIENCE_TABLE, sciRaw) : null;

      const composite = calcComposite(engScaled, mathScaled, readScaled);

      const actScores = {
        mathematics: { raw: mathRaw, max: 45, scaled: mathScaled },
        english: { raw: engRaw, max: 50, scaled: engScaled },
        reading: { raw: readRaw, max: 36, scaled: readScaled },
        science: withScience ? { raw: sciRaw, max: 40, scaled: sciScaled } : null,
        composite
      };

      // Build full responses array for all attempted sections
      const sectionsAttempted = ['mathematics', 'english', 'reading'];
      if (withScience) sectionsAttempted.push('science');

      const allQuestions = [];
      sectionsAttempted.forEach(sec => {
        (allSectionQuestions[sec] || []).forEach(q => {
          allQuestions.push({
            ...q,
            section: sec.charAt(0).toUpperCase() + sec.slice(1),
            question_text: q.text,
            selected_answer: userAnswers[q.id] || '',
            is_correct: userAnswers[q.id] &&
              (userAnswers[q.id].toString().trim().toLowerCase() ===
               q.correctAnswer.toString().trim().toLowerCase()),
            is_unattempted: !userAnswers[q.id]
          });
        });
      });

      const questionIds = allQuestions.map(q => q.id);
      const answers = allQuestions.map(q => userAnswers[q.id] || '');
      const totalCorrect = allQuestions.filter(q => q.is_correct).length;
      const totalQs = allQuestions.length;
      const accuracy = Math.round((totalCorrect / totalQs) * 100);

      const response = await gradingService.submitAdaptiveTest({
        courseId: parseInt(courseId),
        questionIds,
        answers,
        duration: sectionsAttempted.reduce((acc, sec) => {
          const s = SECTIONS.find(s => s.key === sec);
          return acc + (s ? s.durationSeconds : 0);
        }, 0),
        scores: {
          totalCorrect,
          accuracy,
          actScores,
          totalScore: composite,
          isACTFullLength: true,
          isPractice: isPracticeMode,
          withScience,
          securityViolations: violationCount
        }
      });

      const finishedAt = new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });

      setResults({
        ...response.data,
        actScores: {
          ...actScores,
          math: actScores.mathematics
        },
        composite,
        withScience,
        totalCorrect,
        totalQs,
        accuracy,
        responses: allQuestions,
        student_name: user?.full_name || user?.name || 'Student',
        finishedAt,
        courseInfo,
        course: courseInfo,
        isACT: true,
        scaled_score: composite,
        metadata: { totalScore: composite }
      });
      setScreen('results');

    } catch (err) {
      console.error('❌ [ACT-EXAM] Submission error:', err);
      submittedRef.current = false;
      setSubmitting(false);
      alert('Failed to submit exam. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. RENDER: LOADING
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'loading' || (!courseInfo && !loadError)) {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#0f172a] flex flex-col items-center justify-center font-sans">
        {loadError ? (
          <div className="text-center p-8 max-w-lg">
            <div className="w-20 h-20 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-6">
              <SafeIcon icon={FiAlertCircle} className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">Unable to Load Exam</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">{loadError}</p>
            <button
              onClick={() => navigate(`/student/course/${courseId}`)}
              className="px-8 py-3 bg-white text-black rounded-full font-black hover:bg-gray-100 transition-all"
            >
              Return to Course
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-black text-white mb-2">{isPracticeMode ? 'Initializing ACT Practice Test' : 'Initializing ACT Full-Length Test'}</h2>
            <p className="text-slate-400">Loading exam content, please wait...</p>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. RENDER: BREAK SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'break') {
    const breakPct = Math.round(((BREAK_DURATION - breakTimeLeft) / BREAK_DURATION) * 100);
    return (
      <div className="fixed inset-0 z-[999999] bg-[#0f172a] flex flex-col font-sans text-white overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-12 sm:gap-20">
          {/* Left: Timer */}
          <div className="flex flex-col items-center space-y-6">
            {/* Circular Progress */}
            <div className="relative w-56 h-56">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                <circle
                  cx="100" cy="100" r="88" fill="none"
                  stroke="#FBBF24"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 88}`}
                  strokeDashoffset={`${2 * Math.PI * 88 * (1 - breakPct / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1">BREAK</p>
                <div className="text-5xl font-black tracking-tighter text-white">{formatTime(breakTimeLeft)}</div>
                <p className="text-xs text-slate-400 mt-1">remaining</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full min-w-[260px]">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleEndBreak}
                className="w-full px-8 py-4 bg-amber-400 text-black rounded-2xl font-black text-base hover:bg-amber-300 transition-all shadow-2xl shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <SafeIcon icon={FiPlay} className="w-5 h-5" />
                Resume Test
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  // Count down continues automatically. Clicking this button simply acknowledges and keeps the break active.
                }}
                className="w-full px-8 py-4 bg-white/10 text-white rounded-2xl font-black text-base hover:bg-white/20 transition-all border border-white/20 flex items-center justify-center gap-2"
              >
                <SafeIcon icon={FiClock} className="w-5 h-5" />
                Continue Break
              </motion.button>
            </div>
          </div>

          {/* Right: Instructions */}
          <div className="max-w-md space-y-6">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
                15-Minute Break
              </h2>
              <p className="text-slate-400 text-base leading-relaxed">
                You have completed the first two sections. You may take a 15-minute break before continuing.
              </p>
            </div>

            <div className="h-px bg-white/10" />

            <div>
              <h3 className="text-lg font-black text-amber-400 mb-3">During the Break</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                {[
                  'Do not disturb students who are still testing.',
                  'Do not exit the app or close your browser.',
                  'Do not access phones, notes, or the internet.',
                  'Do not discuss the exam with anyone.',
                  'Stretch, hydrate, and rest your eyes.'
                ].map((rule, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="text-amber-500 font-black text-xs mt-0.5">{i + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-2">Up Next</p>
              <p className="text-xl font-black text-white">Section 3 — Reading</p>
              <p className="text-slate-400 text-sm">36 Questions · 40 Minutes</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 text-center">
          <p className="text-slate-500 font-bold">{user?.name || 'Student'} · {isPracticeMode ? 'ACT Practice Test' : 'ACT Full-Length Test'}</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. RENDER: SCIENCE CONFIRMATION POPUP
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'science_confirm') {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#0f172a]/90 backdrop-blur-md flex items-center justify-center font-sans p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-[#1e293b] rounded-3xl p-8 sm:p-12 max-w-lg w-full border border-white/10 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
              <SafeIcon icon={FiTarget} className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Optional Science Section
            </h2>
            <p className="text-slate-400 leading-relaxed">
              Would you like to attempt the optional ACT Science section?
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-5 mb-8 border border-white/10 space-y-3 text-sm">
            <div className="flex justify-between text-slate-300">
              <span className="font-bold text-slate-400">Questions</span>
              <span className="font-black text-white">40</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="font-bold text-slate-400">Time</span>
              <span className="font-black text-white">40 Minutes</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="font-bold text-slate-400">Score Impact</span>
              <span className="font-black text-amber-400">Separate score — does NOT affect Composite</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleScienceYes}
              className="w-full py-4 bg-amber-400 text-black rounded-2xl font-black text-lg hover:bg-amber-300 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3"
            >
              <SafeIcon icon={FiActivity} className="w-6 h-6" />
              Attempt Science
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleScienceNo}
              disabled={submitting}
              className="w-full py-4 bg-white/10 text-white rounded-2xl font-black text-base hover:bg-white/20 transition-all border border-white/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {submitting ? (
                <SafeIcon icon={FiRefreshCw} className="w-5 h-5 animate-spin" />
              ) : (
                <SafeIcon icon={FiCheckCircle} className="w-5 h-5" />
              )}
              Submit Test
            </motion.button>
          </div>

          <p className="text-center text-xs text-slate-500 mt-6 leading-relaxed">
            Your Composite score (English + Math + Reading) is already calculated.<br />
            Science adds a separate 1–36 score reported independently.
          </p>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. RENDER: SECTION REVIEW SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'review') {
    const answeredCount = currentQuestions.filter(q => userAnswers[q.id]).length;
    const flaggedCount = currentQuestions.filter((_, idx) =>
      flaggedQuestions[`${currentSection.key}-${idx}`]
    ).length;

    // Button label per transition
    const getAdvanceLabel = () => {
      if (sectionIndex === 0) return 'Start English Section';
      if (sectionIndex === 1) return 'Begin 15-Minute Break';
      if (sectionIndex === 2) return 'Finish Test';
      return submitting ? 'Submitting...' : 'Submit Science';
    };

    return (
      <div className="fixed inset-0 z-[999999] bg-[#F1F5F9] flex flex-col font-sans select-none text-black overflow-hidden">
        {/* Header */}
        <header className="bg-[#0f172a] px-6 sm:px-10 h-[60px] flex items-center justify-between shadow-sm flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">
              Section {currentSection.sectionNumber} – {currentSection.label}
            </h2>
            <span className="text-[11px] text-gray-400 font-semibold">Section Review</span>
          </div>
          <div className="text-white font-black text-lg">{formatTime(timeLeft)}</div>
          <div className="w-24" />
        </header>

        <main className="flex-1 overflow-y-auto p-6 sm:p-12">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-6">
              <div className="p-8 sm:p-10 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-3xl font-black text-slate-900 mb-2">Section Review</h2>
                <p className="text-slate-500 font-medium">
                  Review your answers before finishing this section. Click any number to return to that question.
                </p>

                {/* Stats bar */}
                <div className="flex gap-6 mt-6">
                  <div className="text-center">
                    <div className="text-2xl font-black text-blue-600">{answeredCount}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Answered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-red-500">{currentQuestions.length - answeredCount}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Unanswered</div>
                  </div>
                  {flaggedCount > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-black text-amber-500">{flaggedCount}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Flagged</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 sm:p-10">
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
                  {currentQuestions.map((q, idx) => {
                    const isAnswered = !!userAnswers[q.id];
                    const isFlagged = flaggedQuestions[`${currentSection.key}-${idx}`];
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                          setScreen('section');
                        }}
                        className={`aspect-square w-full rounded-xl relative flex items-center justify-center font-bold text-lg transition-all border-2 ${
                          isAnswered
                            ? 'bg-[#2E4DC6] border-[#2E4DC6] text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                        }`}
                      >
                        {idx + 1}
                        {isFlagged && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                            <SafeIcon icon={FiFlag} className="w-2 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 sm:p-10 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <div className="w-3.5 h-3.5 rounded bg-[#2E4DC6]" /> Answered
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <div className="w-3.5 h-3.5 rounded border-2 border-slate-200" /> Unanswered
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setScreen('section')}
                    className="px-8 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-full font-black text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <SafeIcon icon={FiChevronLeft} /> Back to Questions
                  </button>
                  <button
                    onClick={handleAdvanceFromReview}
                    disabled={submitting}
                    className="px-10 py-3 bg-blue-600 text-white rounded-full font-black text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
                  >
                    {submitting ? (
                      <SafeIcon icon={FiRefreshCw} className="animate-spin" />
                    ) : (
                      getAdvanceLabel()
                    )}
                    {!submitting && <SafeIcon icon={FiChevronRight} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. RENDER: RESULTS SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'results' && results) {
    return (
      <AdaptiveResultsDashboard 
        submission={results} 
        onExit={() => navigate(`/student/course/${courseId}`)} 
        adminMode={false} 
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. RENDER: ACTIVE EXAM SECTION
  // ─────────────────────────────────────────────────────────────────────────────
  const isLowTime = timeLeft <= 300; // 5 min warning
  const isCriticalTime = timeLeft <= 60;

  return (
    <div className="fixed inset-0 z-[999999] bg-white flex flex-col font-sans select-none text-black overflow-hidden take-quiz-force-white px-0">
      {/* Security Alert */}
      <AnimatePresence>
        {showSecurityAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000000] bg-red-600 text-white px-6 py-3 rounded-full font-black text-sm shadow-2xl flex items-center gap-3 border-2 border-white/20"
          >
            <SafeIcon icon={FiAlertCircle} /> SECURITY: Focus lost — this event has been logged.
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS Overrides */}
      <style>{`
        .take-quiz-force-white header { background: #0f172a !important; color: white !important; min-height: 60px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 12px !important; position: relative !important; z-index: 10000 !important; }
        @media (min-width: 640px) { .take-quiz-force-white header { padding: 0 40px !important; } }
        .take-quiz-force-white footer { background: #ffffff !important; border-top: 1px solid #e2e8f0 !important; min-height: 75px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 12px !important; position: relative !important; z-index: 10000 !important; }
        @media (min-width: 640px) { .take-quiz-force-white footer { padding: 0 40px !important; min-height: 60px !important; } }
        .timer-text { color: #ffffff !important; font-weight: 800 !important; font-size: 15px !important; }
        @media (min-width: 640px) { .timer-text { font-size: 18px !important; } }
        .practice-banner { background: #1e1b4b !important; color: white !important; text-align: center !important; padding: 6px 0 !important; font-size: 9px !important; font-weight: 800 !important; letter-spacing: 0.1em !important; position: relative !important; z-index: 9000 !important; }
      `}</style>

      {/* Header */}
      <header>
        <div className="flex flex-col">
          <h2 className="text-[15px] font-bold text-white">
            Section {currentSection.sectionNumber} – {currentSection.label}
          </h2>
          <span className="text-[11px] text-gray-400 font-medium">Directions <SafeIcon icon={FiChevronDown} className="w-3 h-3" /></span>
        </div>
        <div className="flex flex-col items-center mt-1">
            <div className="timer-text">{formatTime(timeLeft)}</div>
            <span className="text-[9px] font-bold text-gray-400 tracking-widest cursor-pointer hover:text-white">HIDE</span>
        </div>
        <div className="flex items-center gap-6 relative">
           <button 
             onClick={() => setShowMoreMenu(!showMoreMenu)} 
             className="flex flex-col items-center cursor-pointer text-gray-300 hover:text-white bg-transparent border-none p-0 outline-none relative z-[10001]"
           >
               <span className="text-xl font-black leading-none">⋮</span>
               <span className="text-[8px] font-bold uppercase tracking-widest">More</span>
           </button>

           <AnimatePresence>
             {showMoreMenu && (
               <>
                 <div className="fixed inset-0 z-[10000]" onClick={() => setShowMoreMenu(false)}></div>
                 <motion.div 
                   initial={{ opacity: 0, y: 10 }} 
                   animate={{ opacity: 1, y: 0 }} 
                   exit={{ opacity: 0, y: 10 }}
                   className="absolute top-[100%] right-0 bg-[#1e293b] border border-slate-700/50 rounded-xl py-2 w-[200px] shadow-2xl z-[10002] mt-2 overflow-hidden"
                 >
                    <div 
                       onClick={() => { setShowMoreMenu(false); navigate(`/student/course/${courseId}`); }} 
                       className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 cursor-pointer text-slate-200 hover:text-white text-sm font-medium transition-colors"
                    >
                       <SafeIcon icon={FiLogOut} className="w-4 h-4 opacity-70" />
                       Save and Exit
                    </div>
                 </motion.div>
               </>
             )}
           </AnimatePresence>
        </div>
      </header>

      {/* Section Banner */}
      <div className="practice-banner">
        ACT FULL-LENGTH TEST · SECTION {currentSection.sectionNumber}: {currentSection.label.toUpperCase()} · {currentSection.questionCount} QUESTIONS · {currentSection.durationSeconds / 60} MINUTES
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden pt-2 sm:pt-4 bg-white relative z-10">
        {/* Passage / Question Left Panel */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white border-b-[6px] md:border-b-0 md:border-r-[10px] border-[#0f172a]">
          <div className="prose prose-slate max-w-none leading-[1.6] text-[16px] sm:text-[18px] text-slate-900 font-medium tracking-tight antialiased">
            {currentQuestion?.passage ? (
              <MathRenderer text={currentQuestion.passage} courseId={courseId} />
            ) : (
              <MathRenderer text={currentQuestion?.question || currentQuestion?.question_html || currentQuestion?.text || ''} courseId={courseId} />
            )}
          </div>
        </div>

        {/* Answer Panel */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white relative z-20">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-black text-white w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center font-bold rounded-lg text-sm sm:text-base">
                {currentQuestionIndex + 1}
              </div>
              <button
                onClick={toggleFlag}
                className={`flex items-center gap-2 text-xs sm:text-sm font-bold border-b-2 border-dashed ${
                  flaggedQuestions[`${currentSection.key}-${currentQuestionIndex}`] ? 'text-black border-black' : 'text-gray-800 border-gray-400'
                }`}
              >
                <SafeIcon icon={FiStar} className={flaggedQuestions[`${currentSection.key}-${currentQuestionIndex}`] ? 'fill-current' : ''} />
                <span className="whitespace-nowrap">Mark for Review</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 relative z-30">
            {/* Question text (if split mode with passage) */}
            {(currentQuestion?.passage || currentQuestion?.question_text) && (
              <div className="text-[17px] font-bold text-black mb-8 leading-relaxed">
                <MathRenderer text={
                  currentQuestion?.passage
                    ? (currentQuestion?.question || currentQuestion?.text || '')
                    : (currentQuestion?.question_text || '')
                } courseId={courseId} />
              </div>
            )}

            {/* Answer options or SPR */}
            {(!currentQuestion?.options || currentQuestion.options.filter(o => o?.toString().trim()).length === 0 ||
              currentQuestion?.type === 'short_answer' || currentQuestion?.type === 'spr') ? (
              <div className="w-full flex flex-col mt-4">
                <p className="text-[15px] font-bold text-slate-500 mb-4 uppercase tracking-wider">Student-Produced Response</p>
                <div className="relative w-full max-w-[180px] transition-all mb-12">
                  <input
                    type="text"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-4 py-3 font-bold text-lg text-left focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-50 text-slate-900 placeholder:text-slate-400 transition-all shadow-sm"
                    value={selectedAnswer}
                    placeholder="Type response"
                    onChange={e => handleAnswerSelect(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              currentQuestion.options.map((optContent, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const isSelected = selectedAnswer === letter;
                return (
                  <div key={letter} className="flex flex-col sm:flex-row gap-2 sm:gap-4 group relative z-40">
                    <button
                      type="button"
                      onClick={() => handleAnswerSelect(letter)}
                      className={`w-[44px] h-[44px] rounded-full flex items-center justify-center font-bold shrink-0 transition-colors cursor-pointer pointer-events-auto relative z-50 ${
                        isSelected
                          ? 'border-2 border-blue-600 text-blue-600 bg-white ring-4 ring-blue-50 shadow-sm'
                          : 'border border-slate-200 text-slate-400 bg-white group-hover:border-slate-300'
                      }`}
                    >
                      {letter}
                    </button>
                    <div
                      role="button"
                      onClick={() => handleAnswerSelect(letter)}
                      className={`flex-1 rounded-2xl p-4 sm:p-5 min-h-[50px] sm:min-h-[60px] cursor-pointer pointer-events-auto transition-all flex flex-col justify-center relative z-50 ${
                        isSelected
                          ? 'border-2 border-blue-600 bg-blue-50/5 shadow-sm'
                          : 'border border-slate-200 bg-white group-hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="pointer-events-none w-full">
                        <MathRenderer text={optContent} courseId={courseId} className="text-[15px] sm:text-[17px] text-slate-800 font-normal leading-normal antialiased" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer>
        <div className="text-[10px] sm:text-sm font-bold flex-1 text-slate-900 truncate max-w-[60px] sm:max-w-none px-1">
          {user?.name || 'Student'}
        </div>
        <div className="relative flex justify-center shrink-0 mx-1">
          <button onClick={() => setShowNavigation(!showNavigation)} className="bg-black text-white px-2 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-3">
              <span className="hidden sm:inline">Question </span>{currentQuestionIndex + 1}<span className="sm:hidden"> / </span><span className="hidden sm:inline"> of </span>{currentQuestions.length}
              <SafeIcon icon={showNavigation ? FiX : FiChevronDown} className="w-2.5 h-2.5 sm:w-4 sm:h-4 text-gray-400" />
          </button>
          <AnimatePresence>
          {showNavigation && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed bottom-[85px] sm:bottom-[130px] bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-[0_0_40px_-10px_rgba(0,0,0,0.2)] z-[1000] w-[94vw] sm:w-[420px] left-1/2 -translate-x-1/2 flex flex-col items-center max-h-[75vh] overflow-y-auto">
               <div className="hidden sm:block absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-slate-200 rotate-45"></div>
               <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 w-full relative">
                  <span className="font-black text-[10px] sm:text-sm text-slate-900 w-full text-center uppercase tracking-widest px-8">
                      Section {currentSection.sectionNumber}: {currentSection.label}
                  </span>
                  <SafeIcon icon={FiX} onClick={() => setShowNavigation(false)} className="cursor-pointer text-gray-400 absolute right-0 top-0 w-4 h-4" />
               </div>
               <div className="flex flex-wrap gap-2 mb-8 justify-center">
                   {currentQuestions.map((q, idx) => (
                       <div key={idx} onClick={() => { setCurrentQuestionIndex(idx); setShowNavigation(false); }} className={`w-[32px] h-[32px] sm:w-[34px] sm:h-[34px] flex items-center justify-center font-black rounded-sm cursor-pointer transition-all text-xs sm:text-sm border ${userAnswers[q.id] ? 'text-blue-600 border-blue-600 bg-blue-50' : 'text-blue-600 border-blue-600 border-dashed bg-white'}`}>
                           {idx + 1}
                       </div>
                   ))}
               </div>
               <button onClick={() => { setShowNavigation(false); setScreen('review'); }} className="w-full sm:w-auto px-5 py-2.5 rounded-full border-2 border-blue-600 text-blue-600 font-black text-xs sm:text-sm hover:bg-blue-50 transition-all uppercase tracking-widest">Go to Review Page</button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-4 sm:gap-8 flex-1 justify-end px-1">
          <button onClick={handleBack} disabled={currentQuestionIndex === 0} className="font-bold text-[10px] sm:text-sm text-blue-600 disabled:opacity-30 hover:underline uppercase tracking-widest">Back</button>
          <button onClick={handleNext} className="px-4 sm:px-8 py-2 sm:py-2.5 bg-blue-600 text-white rounded-full font-black text-[10px] sm:text-sm hover:bg-blue-700 transition-colors shadow-lg uppercase tracking-widest">
            {currentQuestionIndex === currentQuestions.length - 1 ? 'Review' : 'Next'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ACTFullLengthExam;
