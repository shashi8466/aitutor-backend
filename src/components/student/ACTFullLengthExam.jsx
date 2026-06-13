import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import AITutorModal from './AITutorModal';
import MathRenderer from '../../common/MathRenderer';
import AdaptiveResultsDashboard from '../common/AdaptiveResultsDashboard';
import { courseService, gradingService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';

const {
  FiChevronLeft, FiChevronRight, FiClock, FiFlag, FiLogOut, FiAlertCircle,
  FiCheckCircle, FiRefreshCw, FiChevronDown, FiX, FiPlay, FiAward, FiZap,
  FiAlertTriangle, FiBarChart2, FiBook, FiTarget, FiActivity, FiStar,
  FiArrowLeft, FiGrid, FiMessageCircle, FiShield, FiCheck
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

// Composite: avg of English + Math + Reading (+ Science if attempted), halves round up
const calcComposite = (eng, math, read, sci = null) => {
  if (sci !== null) {
    const avg = (eng + math + read + sci) / 4;
    return Math.round(avg + Number.EPSILON);
  }
  const avg = (eng + math + read) / 3;
  return Math.round(avg + Number.EPSILON);
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
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
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
  const [showAITutor, setShowAITutor] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState({}); // track submitted per question

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
    if (currentQuestion && !submittedAnswers[currentQuestion.id]) {
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));
    }
  };

  const handleCheckAnswer = () => {
    if (currentQuestion && userAnswers[currentQuestion.id]) {
      setSubmittedAnswers(prev => ({ ...prev, [currentQuestion.id]: true }));
    }
  };

  const isCorrectAnswer = () => {
    if (!currentQuestion || !userAnswers[currentQuestion.id]) return null;
    const ans = userAnswers[currentQuestion.id].toString().trim().toLowerCase();
    const correct = currentQuestion.correctAnswer.toString().trim().toLowerCase();
    return ans === correct;
  };
  
  const getDisplayAnswer = (q) => {
    if (!q || !q.correctAnswer) return '';
    const correctOptIndex = q.correctAnswer.charCodeAt(0) - 65;
    if (q.options && q.options[correctOptIndex]) {
      return `${q.correctAnswer}) ${q.options[correctOptIndex]}`;
    }
    return q.correctAnswer;
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

      const composite = calcComposite(engScaled, mathScaled, readScaled, withScience ? sciScaled : null);

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
        }, 0) + (sectionsAttempted.length >= 2 ? BREAK_DURATION : 0),
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
  return (
    <div className={`fixed inset-0 z-[999999] flex flex-col font-sans select-none overflow-hidden px-0 ${isPracticeMode ? 'bg-[#0a0e2a] text-white dark' : 'bg-[#F1F5F9] text-black take-quiz-force-white'}`}>
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

      <main className={`flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 ${isPracticeMode ? 'bg-[#0a0e2a]' : 'bg-[#F1F5F9]'}`}>
        <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
          {/* Header matching LegacyQuizInterface exactly */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(`/student/course/${courseId}`)} className={`flex items-center gap-2 font-bold text-sm transition-colors ${isPracticeMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}`}>
                <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Exit
              </button>
              <button onClick={() => setScreen('review')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold shadow-sm ${isPracticeMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
                <SafeIcon icon={FiGrid} className="w-4 h-4" /> Questions
              </button>
            </div>
            <div className="flex items-center gap-6 font-bold text-sm">
              <span className="flex items-center gap-1"><SafeIcon icon={FiClock} className="text-[#E53935]" /> {formatTime(timeLeft)}</span>
              <span className="flex items-center gap-1"><SafeIcon icon={FiTarget} className="text-[#E53935]" /> {currentQuestionIndex + 1}/{currentQuestions.length}</span>
            </div>
          </div>

          <motion.div key={currentQuestionIndex + (currentQuestion.id || 'temp')} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className={`rounded-2xl shadow-xl border ${isPracticeMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} flex-1`}>
            {/* Red Progress Bar */}
            <div className={`w-full h-1.5 ${isPracticeMode ? 'bg-gray-800' : 'bg-gray-100'} rounded-t-2xl overflow-hidden`}>
              <div className="bg-[#E53935] h-1.5 transition-all" style={{ width: `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%` }} />
            </div>

            <div className="p-5 sm:p-8 md:p-10">
              <div className={currentQuestion?.passage ? "flex flex-col lg:flex-row gap-8 lg:gap-12 items-start" : ""}>
                
                {/* Linked Passage - Left Panel */}
                {currentQuestion?.passage && (
                  <div className="w-full lg:w-1/2 lg:sticky lg:top-6">
                    <div className={`p-6 lg:p-8 rounded-2xl prose max-w-none text-[15px] sm:text-[17px] whitespace-pre-wrap shadow-sm overflow-y-auto max-h-[75vh] custom-scrollbar ${isPracticeMode ? 'bg-slate-800/50 border border-slate-700 prose-invert text-slate-200' : 'bg-slate-50 border border-slate-200 prose-slate text-slate-800'}`}>
                       <MathRenderer text={currentQuestion.passage} courseId={courseId} />
                    </div>
                  </div>
                )}

                {/* Right Panel / Full Width Question */}
                <div className={`w-full ${currentQuestion?.passage ? "lg:w-1/2" : ""}`}>
                  {/* Topic Name */}
                  <div className="mb-10 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E53935]" />
                        <span className="text-[10px] font-black text-[#E53935] uppercase tracking-[0.2em]">{currentSection.label.toUpperCase()}_ACT</span>
                      </div>
                      <h1 className={`text-2xl md:text-3xl font-black ${isPracticeMode ? 'text-white' : 'text-gray-900'}`}>
                        Question {currentQuestionIndex + 1}
                      </h1>
                    </div>
                    <button
                      onClick={toggleFlag}
                      className={`flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                        flaggedQuestions[`${currentSection.key}-${currentQuestionIndex}`] 
                          ? 'text-red-500' 
                          : isPracticeMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <SafeIcon icon={FiStar} className={flaggedQuestions[`${currentSection.key}-${currentQuestionIndex}`] ? 'fill-current w-5 h-5' : 'w-5 h-5'} />
                      <span>{flaggedQuestions[`${currentSection.key}-${currentQuestionIndex}`] ? 'Flagged' : 'Flag'}</span>
                    </button>
                  </div>

                  {/* Question Text */}
                  <div className="mb-10 max-w-3xl">
                    <h2 className={`text-xl md:text-[22px] font-medium leading-[1.6] tracking-normal antialiased ${isPracticeMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      <MathRenderer text={currentQuestion?.question || currentQuestion?.question_html || currentQuestion?.text || ''} courseId={courseId} />
                    </h2>
                  </div>

                  {/* Answer options */}
                  {(!currentQuestion?.options || currentQuestion.options.filter(o => o?.toString().trim()).length === 0) ? (
                    <div className="w-full flex flex-col mt-4">
                      <p className={`text-[15px] font-bold mb-4 uppercase tracking-wider ${isPracticeMode ? 'text-slate-400' : 'text-slate-500'}`}>Student-Produced Response</p>
                      <input
                        type="text"
                        className={`w-full max-w-[180px] border-2 rounded-lg px-4 py-3 font-bold text-lg text-left focus:outline-none focus:ring-4 transition-all shadow-sm ${isPracticeMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500 focus:ring-blue-900 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600 focus:ring-blue-50 focus:bg-white placeholder-slate-400'}`}
                        value={selectedAnswer}
                        placeholder="Type response"
                        disabled={isPracticeMode && submittedAnswers[currentQuestion?.id]}
                        onChange={e => handleAnswerSelect(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-2xl">
                      {currentQuestion.options.map((optContent, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isSelected = selectedAnswer === letter;
                        const isSubmitted = isPracticeMode && submittedAnswers[currentQuestion?.id];
                        const isCorrectOpt = currentQuestion.correctAnswer && currentQuestion.correctAnswer.toString().trim().toUpperCase() === letter;
                        
                        let containerClass = isPracticeMode 
                          ? "border-gray-800 hover:border-blue-500 hover:bg-blue-900/10" 
                          : "border-gray-200 hover:border-blue-400 hover:bg-blue-50";
                        let circleClass = isPracticeMode
                          ? "bg-gray-800 border-gray-600 text-gray-400"
                          : "bg-white border-gray-300 text-gray-500";
                          
                        if (isSubmitted) {
                          if (isCorrectOpt) {
                            containerClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-slate-900 dark:text-white ring-1 ring-green-500";
                            circleClass = "bg-green-500 text-white border-green-500 shadow-md";
                          } else if (isSelected && !isCorrectOpt) {
                            containerClass = "border-[#E53935] bg-red-50 dark:bg-red-900/20 text-slate-900 dark:text-white ring-1 ring-[#E53935]";
                            circleClass = "bg-[#E53935] text-white border-[#E53935] shadow-md";
                          } else {
                            containerClass = isPracticeMode ? "border-gray-800 opacity-40" : "border-gray-100 opacity-40";
                          }
                        } else if (isSelected) {
                          containerClass = isPracticeMode
                            ? "border-blue-600 bg-blue-900/20 text-blue-300 ring-1 ring-blue-600 shadow-sm"
                            : "border-blue-600 bg-blue-50/50 text-blue-700 ring-1 ring-blue-600 shadow-sm";
                          circleClass = "bg-blue-600 text-white border-blue-600 shadow-md";
                        }

                        return (
                          <button 
                            key={letter} 
                            onClick={() => handleAnswerSelect(letter)}
                            disabled={isSubmitted}
                            className={`w-full p-4 text-left rounded-xl border transition-all flex flex-col sm:flex-row items-start gap-3 sm:gap-4 group ${containerClass}`}
                          >
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black transition-colors shadow-sm shrink-0 border ${circleClass}`}>
                                {letter}
                              </span>
                            </div>
                            <div className={`font-normal text-[16px] md:text-[17px] flex-1 leading-relaxed w-full ${isSelected || (isSubmitted && isCorrectOpt) ? 'font-semibold' : ''} ${isPracticeMode ? (isSelected && !isSubmitted ? 'text-blue-300' : 'text-slate-200') : (isSelected && !isSubmitted ? 'text-blue-700' : 'text-slate-800')}`}>
                              <MathRenderer text={optContent} courseId={courseId} />
                            </div>
                            {isSubmitted && isCorrectOpt && <SafeIcon icon={FiCheck} className="ml-auto w-5 h-5 text-green-500 shrink-0" />}
                            {isSubmitted && isSelected && !isCorrectOpt && <SafeIcon icon={FiX} className="ml-auto w-5 h-5 text-[#E53935] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Immediate Grading Panel (Practice Mode Only) */}
                  {isPracticeMode && submittedAnswers[currentQuestion?.id] && (
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
                      <div className={`p-6 md:p-8 rounded-2xl border-2 transition-all shadow-sm ${isCorrectAnswer() ? 'bg-green-900/20 border-green-500/30 text-green-100' : 'bg-red-900/20 border-red-500/30 text-red-100'}`}>
                        
                        <div className="flex items-center gap-3 mb-6 sm:mb-8">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-sm ${isCorrectAnswer() ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            <SafeIcon icon={isCorrectAnswer() ? FiCheck : FiX} className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Quiz Status</span>
                            <span className="font-black text-lg md:text-xl uppercase tracking-wider">{isCorrectAnswer() ? "Correct Answer" : "Incorrect Answer"}</span>
                          </div>
                        </div>

                        {!isCorrectAnswer() && (
                          <div className="mb-8 p-4 bg-gray-900/50 rounded-xl border border-red-500/20">
                            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Verified Correct Answer</span>
                            <div className="text-xl font-bold text-white">
                              <MathRenderer text={getDisplayAnswer(currentQuestion)} courseId={courseId} />
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="text-xs font-black text-[#E53935] uppercase tracking-widest">Detailed Solution & Explanation</span>
                          </div>
                          
                          <div className="text-gray-200 font-medium leading-relaxed max-w-full overflow-x-auto whitespace-pre-line break-words clear-both">
                            {currentQuestion.explanation && currentQuestion.explanation.trim() !== '' ? (
                              <MathRenderer text={currentQuestion.explanation} courseId={courseId} />
                            ) : (
                              <p className="text-sm italic text-gray-400 font-bold bg-gray-800 p-4 rounded-lg border border-dashed border-gray-700">
                                No solution provided for this problem. You can ask our AI tutor for a step-by-step breakdown.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-gray-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                            <SafeIcon icon={FiShield} className="w-3.5 h-3.5" />
                            <span>Analysis Verified by AI Scoring Engine</span>
                          </div>
                          {!isCorrectAnswer() && (
                            <button 
                              onClick={() => setShowAITutor(true)}
                              className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-2 border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#E53935] hover:text-[#E53935] transition-all shadow-sm"
                            >
                              <SafeIcon icon={FiMessageCircle} className="w-4 h-4" />
                              Chat with AI
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className={isPracticeMode ? "flex items-center justify-between w-full relative z-[10000] border-t border-slate-800 bg-[#0a0e2a] min-h-[60px] px-4 sm:px-10" : "flex items-center justify-between px-6 sm:px-12 py-4 bg-white border-t border-slate-200"}>
        <div className={`text-[10px] sm:text-sm font-bold flex-1 truncate max-w-[60px] sm:max-w-none px-1 ${isPracticeMode ? 'text-slate-400' : 'text-slate-900'}`}>
          {user?.name || 'Student'}
        </div>
        <div className="relative flex justify-center shrink-0 mx-1">
          <button onClick={() => setShowNavigation(!showNavigation)} className={`px-2 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-3 ${isPracticeMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-black text-white'}`}>
              <span className="hidden sm:inline">Question </span>{currentQuestionIndex + 1}<span className="sm:hidden"> / </span><span className="hidden sm:inline"> of </span>{currentQuestions.length}
              <SafeIcon icon={showNavigation ? FiX : FiChevronDown} className="w-2.5 h-2.5 sm:w-4 sm:h-4 text-gray-400" />
          </button>
          <AnimatePresence>
          {showNavigation && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`fixed bottom-[85px] sm:bottom-[130px] border rounded-xl p-4 sm:p-5 shadow-[0_0_40px_-10px_rgba(0,0,0,0.2)] z-[1000] w-[94vw] sm:w-[420px] left-1/2 -translate-x-1/2 flex flex-col items-center max-h-[75vh] overflow-y-auto ${isPracticeMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
               <div className={`hidden sm:block absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 border-b border-r rotate-45 ${isPracticeMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}></div>
               <div className={`flex items-center justify-between mb-4 pb-3 border-b w-full relative ${isPracticeMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  <span className={`font-black text-[10px] sm:text-sm w-full text-center uppercase tracking-widest px-8 ${isPracticeMode ? 'text-white' : 'text-slate-900'}`}>
                      Section {currentSection.sectionNumber}: {currentSection.label}
                  </span>
                  <SafeIcon icon={FiX} onClick={() => setShowNavigation(false)} className="cursor-pointer text-gray-400 absolute right-0 top-0 w-4 h-4" />
               </div>
               <div className="flex flex-wrap gap-2 mb-8 justify-center">
                   {currentQuestions.map((q, idx) => {
                       const isAnswered = !!userAnswers[q.id];
                       const isFlagged = flaggedQuestions[`${currentSection.key}-${idx}`];
                       
                       let btnClass = isPracticeMode 
                         ? 'border-slate-700 bg-slate-800 text-slate-400 border-dashed'
                         : 'text-blue-600 border-blue-600 border-dashed bg-white';
                         
                       if (isAnswered) {
                         btnClass = isPracticeMode
                           ? 'border-blue-600 bg-blue-900/30 text-blue-400 border-solid shadow-sm'
                           : 'text-blue-600 border-blue-600 bg-blue-50 border-solid';
                       }
                       if (isFlagged) {
                         btnClass += ' ring-2 ring-red-500 ring-offset-2 ring-offset-current';
                       }
                       
                       return (
                         <div key={idx} onClick={() => { setCurrentQuestionIndex(idx); setShowNavigation(false); }} className={`w-[32px] h-[32px] sm:w-[34px] sm:h-[34px] flex items-center justify-center font-black rounded-sm cursor-pointer transition-all text-xs sm:text-sm border ${btnClass}`}>
                             {idx + 1}
                         </div>
                       );
                   })}
               </div>
               <button onClick={() => { setShowNavigation(false); setScreen('review'); }} className={`w-full sm:w-auto px-5 py-2.5 rounded-full border-2 font-black text-xs sm:text-sm transition-all uppercase tracking-widest ${isPracticeMode ? 'border-blue-500 text-blue-400 hover:bg-blue-900/20' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}`}>Go to Review Page</button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-4 sm:gap-8 flex-1 justify-end px-1">
          {isPracticeMode && !submittedAnswers[currentQuestion?.id] && selectedAnswer && (
            <button onClick={handleCheckAnswer} className="bg-blue-600 text-white px-5 sm:px-8 py-2 sm:py-2.5 rounded-full font-black text-[10px] sm:text-sm hover:bg-blue-700 transition-colors shadow-lg uppercase tracking-widest hidden sm:block">
              Check Answer
            </button>
          )}
          {isPracticeMode && submittedAnswers[currentQuestion?.id] && !isCorrectAnswer() && (
            <button onClick={() => setShowAITutor(true)} className="bg-gray-800 text-white px-4 py-2 sm:py-2.5 rounded-full font-black text-[10px] sm:text-sm hover:bg-gray-700 transition-colors shadow-sm hidden sm:flex items-center gap-2">
              <SafeIcon icon={FiMessageCircle} className="w-4 h-4" /> Chat with AI
            </button>
          )}
          <button onClick={handleBack} disabled={currentQuestionIndex === 0} className={`font-bold text-[10px] sm:text-sm disabled:opacity-30 hover:underline uppercase tracking-widest ${isPracticeMode ? 'text-blue-400' : 'text-blue-600'}`}>Back</button>
          <button onClick={handleNext} className="px-4 sm:px-8 py-2 sm:py-2.5 bg-blue-600 text-white rounded-full font-black text-[10px] sm:text-sm hover:bg-blue-700 transition-colors shadow-lg uppercase tracking-widest">
            {currentQuestionIndex === currentQuestions.length - 1 ? 'Review' : 'Next'}
          </button>
        </div>
      </footer>
      {showAITutor && currentQuestion && (
        <AITutorModal 
          question={currentQuestion} 
          userAnswer={selectedAnswer} 
          correctAnswer={currentQuestion.correctAnswer} 
          onClose={() => setShowAITutor(false)} 
          isACT={true}
          fallbackQuestions={currentQuestions.filter(q => 
            q.id !== currentQuestion.id && 
            !userAnswers[q.id] && 
            (q.topic === currentQuestion.topic || q.concept === currentQuestion.concept)
          )}
        />
      )}
    </div>
  );
};

export default ACTFullLengthExam;
