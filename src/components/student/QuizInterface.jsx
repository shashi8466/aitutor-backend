import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import AITutorModal from './AITutorModal';
import { questionService, progressService, enrollmentService, gradingService, planService, courseService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';

const {
  FiArrowLeft, FiCheck, FiX, FiMessageCircle, FiClock, FiTarget,
  FiSkipForward, FiInfo, FiImage, FiAward, FiRefreshCw, FiShield,
  FiTrendingUp, FiChevronLeft, FiChevronRight, FiGrid, FiZap
} = FiIcons;

// Helper to get clean question text (removes duplicate images already in the image column)
const getCleanQuestionText = (text, imageUrl) => {
  if (!text) return '';
  if (!imageUrl) return text;
  
  let cleaned = text;
  try {
    // Escape URL for regex
    const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 1. Remove <img> tags that reference this image
    const imgTagRegex = new RegExp(`<img[^>]+src=["']${escapedUrl}["'][^>]*>`, 'gi');
    cleaned = cleaned.replace(imgTagRegex, '');
    
    // 2. Remove raw markdown-style images if present e.g. ![](url)
    const mdImgRegex = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)`, 'gi');
    cleaned = cleaned.replace(mdImgRegex, '');

    // 3. Remove raw URL references if they are just floating in the text on their own line
    // This often happens in SAT OCR exports
    const rawUrlRegex = new RegExp(`(^|\\n)${escapedUrl}(\\n|$)`, 'gi');
    cleaned = cleaned.replace(rawUrlRegex, '$1$2');
  } catch (e) {
    console.warn("Error cleaning question text:", e);
  }
  
  return cleaned.trim();
};

const QuizInterface = () => {
  const { courseId, level } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showAITutor, setShowAITutor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [quizStartTime] = useState(Date.now());
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [savingResult, setSavingResult] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [planSettings, setPlanSettings] = useState(null);

  // Adaptive State
  const [isAdaptive, setIsAdaptive] = useState(false);
  const [modules, setModules] = useState({});
  const [currentModuleKey, setCurrentModuleKey] = useState('rw_moderate');
  const [moduleHistory, setModuleHistory] = useState(['rw_moderate']);
  const [courseInfo, setCourseInfo] = useState(null);
  const [allUserAnswers, setAllUserAnswers] = useState({}); // Stores answers for ALL modules

  useEffect(() => {
    if (user?.plan_type) loadPlanSettings();
  }, [user?.plan_type]);

  const loadPlanSettings = async () => {
    try {
      const { data } = await planService.getSettings();
      const current = (data || []).find(s => s.plan_type === user.plan_type);
      setPlanSettings(current);
    } catch (e) {
      console.error("Failed to load plan settings in quiz:", e);
    }
  };

  useEffect(() => {
    if (user?.id && courseId) {
      checkAccessAndLoad();
    }
    const timer = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - quizStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [courseId, level, user]);

  const checkAccessAndLoad = async () => {
    try {
      const isEnrolled = await enrollmentService.isEnrolled(user.id, parseInt(courseId));
      if (!isEnrolled) {
        setAccessDenied(true);
        setLoading(false);
        setTimeout(() => navigate('/student'), 3000);
        return;
      }
      await loadQuestions();
    } catch (err) {
      setError("Failed to verify enrollment.");
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    setQuestions([]);
    setError(null);

    try {
      const cId = parseInt(courseId);
      if (isNaN(cId)) throw new Error("Invalid Course ID");

      // 1. Check if this should be an FULL LENGTH TEST Practice Quiz
      const courseRes = await courseService.getById(cId);
      const cData = courseRes.data;
      setCourseInfo(cData);

      const isSat = cData?.name?.toLowerCase().includes('sat') || cData?.category?.toLowerCase().includes('sat');
      const searchParams = new URLSearchParams(window.location.search);
      const isPracticeMode = searchParams.get('mode') === 'practice';

      if (isSat && isPracticeMode) {
        console.log("🎯 [QUIZ] Initializing FULL LENGTH TEST Practice Flow...");
        setIsAdaptive(true);

        // Load modules logic similar to AdaptiveExamInterface
        const { data: uploadData, error: uploadErr } = await supabase
          .from('uploads')
          .select('id, level, section, file_name')
          .eq('course_id', cId)
          .eq('category', 'quiz_document')
          .in('status', ['completed', 'warning'])
          .order('id', { ascending: false });

        if (uploadErr) throw uploadErr;

        const slotLatestUploadId = {};
        uploadData?.forEach(upload => {
          const rawSec = (upload.section || '').toLowerCase();
          const rawLvl = (upload.level || '').toLowerCase();
          let secKey = '';
          if (rawSec.includes('read') || rawSec.includes('writ') || rawSec.includes('rw')) secKey = 'rw';
          else if (rawSec.includes('math')) secKey = 'math';
          else if (upload.file_name?.toLowerCase().includes('reading') || upload.file_name?.toLowerCase().includes('writing')) secKey = 'rw';
          else if (upload.file_name?.toLowerCase().includes('math')) secKey = 'math';

          let lvlKey = '';
          if (rawLvl.includes('mod') || rawLvl.includes('med')) lvlKey = 'moderate';
          else if (rawLvl.includes('easy')) lvlKey = 'easy';
          else if (rawLvl.includes('hard')) lvlKey = 'hard';
          else if (upload.file_name?.toLowerCase().includes('moderate') || upload.file_name?.toLowerCase().includes('medium')) lvlKey = 'moderate';
          else if (upload.file_name?.toLowerCase().includes('easy')) lvlKey = 'easy';
          else if (upload.file_name?.toLowerCase().includes('hard')) lvlKey = 'hard';

          if (secKey && lvlKey) {
            const slotKey = `${secKey}_${lvlKey}`;
            if (!slotLatestUploadId[slotKey]) slotLatestUploadId[slotKey] = upload.id;
          }
        });

        const latestUploadIds = Object.values(slotLatestUploadId).filter(id => !!id);
        if (latestUploadIds.length > 0) {
          const { data: qData, error: qError } = await supabase
            .from('questions')
            .select('*')
            .in('upload_id', latestUploadIds);

          if (qError) throw qError;

          const grouped = {
            rw_moderate: [], rw_easy: [], rw_hard: [],
            math_moderate: [], math_easy: [], math_hard: []
          };
          const uploadIdToSlot = {};
          Object.entries(slotLatestUploadId).forEach(([slot, id]) => { uploadIdToSlot[id] = slot; });

          qData.forEach(q => {
            const slotKey = uploadIdToSlot[q.upload_id];
            if (slotKey) grouped[slotKey].push({ ...q, correctAnswer: q.correct_answer || '' });
          });

          setModules(grouped);
          if (grouped['rw_moderate'].length > 0) {
            setQuestions(grouped['rw_moderate']);
            setCurrentModuleKey('rw_moderate');
            return; // Exit, questions loaded
          }
        }
        console.warn("⚠️ [QUIZ] Adaptive modules not found, falling back to standard quiz.");
        setIsAdaptive(false);
      }

      // 2. Standard Quiz Loading
      // STRICT ISOLATION: Only load questions from a specific upload. NEVER fall back to orphaned questions.
      let targetQuestions = [];
      // Guard: level may be undefined when accessed via SAT practice mode fallback (no :level param in URL)
      const dbLevel = level ? level.charAt(0).toUpperCase() + level.slice(1).toLowerCase() : 'Moderate';

      // Step A: Try to find a single upload covering ALL levels (Global Test document)
      const { data: globalUploadData } = await supabase
        .from('uploads')
        .select('id, file_name')
        .eq('course_id', cId)
        .eq('category', 'quiz_document')
        .eq('level', 'All')
        .in('status', ['completed', 'warning'])
        .order('id', { ascending: false })
        .limit(1);

      if (globalUploadData?.[0]) {
        console.log(`🎯 [QUIZ] Found global upload ${globalUploadData[0].id}: ${globalUploadData[0].file_name}`);
        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .eq('upload_id', globalUploadData[0].id)
          .order('id', { ascending: true });
        
        if (qData && qData.length > 0) {
          targetQuestions = qData.map(q => ({ ...q, computedLevel: q.level || dbLevel }));
          console.log(`✅ [QUIZ] Loaded ${targetQuestions.length} questions from global upload.`);
        }
      }

      // Step B: No global upload — find the latest upload for this specific level
      if (targetQuestions.length === 0) {
        const { data: latestUploadData } = await supabase
          .from('uploads')
          .select('id, file_name')
          .eq('course_id', cId)
          .eq('category', 'quiz_document')
          .ilike('level', dbLevel)
          .in('status', ['completed', 'warning'])
          .order('id', { ascending: false })
          .limit(1);

        if (latestUploadData?.[0]) {
          console.log(`✅ [QUIZ] Level "${dbLevel}": using upload ${latestUploadData[0].id} (${latestUploadData[0].file_name})`);
          const { data: qData } = await supabase
            .from('questions')
            .select('*')
            .eq('upload_id', latestUploadData[0].id)
            .order('id', { ascending: true });
          targetQuestions = qData || [];
          console.log(`✅ [QUIZ] Loaded ${targetQuestions.length} questions.`);
        } else {
          // STRICT: No upload found → show empty. Do NOT fall back to orphaned questions.
          console.warn(`⚠️ [QUIZ] No upload found for course ${cId}, level "${dbLevel}". No questions will load.`);
        }
      }

      setQuestions(targetQuestions);
    } catch (err) {
      console.error("❌ [QUIZ] Load Failure:", err);
      setError("Could not load questions.");
    } finally {
      setLoading(false);
    }
  };

  const checkAnswerRobustly = (studentAns, correctAnswer) => {
    const sAns = (studentAns || '').toString().trim().toLowerCase();
    if (!sAns || !correctAnswer) return false;
    
    const rawCorrect = correctAnswer.toString().trim();
    let acceptedAnswers = [];
    
    if (rawCorrect.startsWith('[') && rawCorrect.endsWith(']')) {
      try {
        const parsed = JSON.parse(rawCorrect);
        acceptedAnswers = Array.isArray(parsed) ? parsed.map(a => a.toString().trim().toLowerCase()) : [parsed.toString().trim().toLowerCase()];
      } catch (e) {
        acceptedAnswers = rawCorrect.split(/[,|]/).map(a => a.trim().toLowerCase());
      }
    } else {
      acceptedAnswers = rawCorrect.split(/[,|]/).map(a => a.trim().toLowerCase());
    }
    
    return acceptedAnswers.includes(sAns);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isMCQ = currentQuestion?.type === 'mcq' && 
                 !(currentQuestion?.correct_answer?.toString().includes(',') || 
                   currentQuestion?.correct_answer?.toString().includes('|') || 
                   currentQuestion?.correct_answer?.toString().startsWith('['));
  const isShortAnswer = !isMCQ || currentQuestion?.type === 'short_answer' || currentQuestion?.type === 'spr';

  const getDisplayAnswer = (q) => {
    if (!q) return '';
    const rawCorrect = (q.correct_answer || q.correctAnswer || '').toString().trim();
    
    // If it's a multi-answer format, return a clean readable version
    if (rawCorrect.startsWith('[') && rawCorrect.endsWith(']')) {
      try {
        const parsed = JSON.parse(rawCorrect);
        return Array.isArray(parsed) ? parsed.join(' or ') : parsed.toString();
      } catch (e) { return rawCorrect; }
    }
    
    if (q.type === 'short_answer' && /^[A-E]$/i.test(q.correct_answer)) {
      const match = q.explanation?.match(/(?:Therefore|Thus|Hence|So|Consequently|is|=)\s*([-]?\d+(?:\.\d+)?)/i);
      if (match && match[1]) return match[1];
      return "See Explanation";
    }
    return rawCorrect.replace(/[|]/g, ' or ');
  };

  const handleAnswerSelect = (answer) => {
    if (submitted) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer) return;
    setSubmitted(true);
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: selectedAnswer }));
    
    // Also save to allUserAnswers if adaptive
    if (isAdaptive) {
        const qId = questions[currentQuestionIndex].id;
        setAllUserAnswers(prev => ({ ...prev, [qId]: selectedAnswer }));
    }
  };

  const jumpToQuestion = (index) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentQuestionIndex(index);
    const answer = userAnswers[index] || '';
    setSelectedAnswer(answer);
    setSubmitted(!!answer);
    setShowAITutor(false);
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      if (isAdaptive && moduleHistory.length < 4) {
        handleNextModule();
      } else {
        handleFinishQuiz();
      }
    } else {
      jumpToQuestion(currentQuestionIndex + 1);
    }
  };

  const handleNextModule = () => {
    const threshold = courseInfo?.threshold_percentage || 60;
    
    // Calculate current module score
    const correctCount = questions.filter((q, idx) => {
      // Use the helper method for consistent multi-answer validation
      return isCorrectAnswer(idx);
    }).length;
    const percentage = (correctCount / questions.length) * 100;

    let nextKey = '';
    if (currentModuleKey === 'rw_moderate') {
      nextKey = percentage >= threshold ? 'rw_hard' : 'rw_easy';
    } else if (currentModuleKey === 'rw_easy' || currentModuleKey === 'rw_hard') {
      nextKey = 'math_moderate';
    } else if (currentModuleKey === 'math_moderate') {
      nextKey = percentage >= threshold ? 'math_hard' : 'math_easy';
    }

    if (nextKey && modules[nextKey]) {
      setCurrentModuleKey(nextKey);
      setModuleHistory(prev => [...prev, nextKey]);
      setQuestions(modules[nextKey]);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setSelectedAnswer('');
      setSubmitted(false);
      window.scrollTo(0, 0);
    } else {
      handleFinishQuiz();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      jumpToQuestion(currentQuestionIndex - 1);
    }
  };

  const isCorrectAnswer = (idx = currentQuestionIndex) => {
    const q = questions[idx];
    if (!q) return false;
    const studentAns = userAnswers[idx];
    const isCorrect = checkAnswerRobustly(studentAns, q.correct_answer);
    if (isCorrect) return true;
    
    // Fallback for OCR-imported answers found in explanation
    const displayAns = getDisplayAnswer(q);
    if (displayAns !== "See Explanation" && displayAns !== q.correct_answer) {
      return (studentAns || '').toString().trim().toLowerCase() === displayAns.toLowerCase();
    }
    return false;
  };

  const handleFinishQuiz = async () => {
    setSavingResult(true);

    try {
      if (isAdaptive) {
        // Collect all questions from the history (adaptive path)
        const pathQuestions = [];
        moduleHistory.forEach(key => {
            pathQuestions.push(...modules[key]);
        });

        const questionIds = pathQuestions.map(q => q.id);
        const answers = pathQuestions.map(q => allUserAnswers[q.id] || '');
        
        // Calculate scores with weights and ceilings
        let rwRaw = 0, rwMax = 0, mathRaw = 0, mathMax = 0;
        let rwPath = 'moderate', mathPath = 'moderate';
        const moduleDetails = {};

        moduleHistory.forEach(mKey => {
            const mQs = modules[mKey];
            const isRW = mKey.startsWith('rw');
            const diff = mKey.split('_')[1];
            const weight = diff === 'hard' ? 3 : (diff === 'moderate' ? 2 : 1);
            
            if (isRW) { if (diff === 'easy') rwPath = 'easy'; if (diff === 'hard') rwPath = 'hard'; }
            else { if (diff === 'easy') mathPath = 'easy'; if (diff === 'hard') mathPath = 'hard'; }
            
            let moduleCorrect = 0;
            mQs.forEach(q => {
                const ans = allUserAnswers[q.id];
                const isCorrect = checkAnswerRobustly(ans, q.correct_answer);
                if (isCorrect) {
                  moduleCorrect++;
                  if (isRW) rwRaw += weight; else mathRaw += weight;
                }
                if (isRW) rwMax += weight; else mathMax += weight;
            });

            moduleDetails[mKey] = {
                correct: moduleCorrect,
                total: mQs.length,
                percentage: Math.round((moduleCorrect / mQs.length) * 100),
                difficulty: diff.toUpperCase()
            };
        });

        const rwSectionScale = rwPath === 'hard' ? 600 : 500; // Hard: 200-800, Easy: 200-700
        const mathSectionScale = mathPath === 'hard' ? 600 : 500;
        
        const rwScore = rwMax > 0 ? Math.round(200 + (rwRaw / rwMax) * rwSectionScale) : 200;
        const mathScore = mathMax > 0 ? Math.round(200 + (mathRaw / mathMax) * mathSectionScale) : 200;
        const totalScore = rwScore + mathScore;

        const totalCorrect = pathQuestions.filter(q => {
            const ans = allUserAnswers[q.id];
            return checkAnswerRobustly(ans, q.correct_answer);
        }).length;
        const accuracyVal = Math.round((totalCorrect / pathQuestions.length) * 100);

        const response = await gradingService.submitAdaptiveTest({
            courseId: parseInt(courseId),
            questionIds,
            answers,
            duration: Math.floor((Date.now() - quizStartTime) / 1000),
            scores: {
                totalScore,
                rwScore,
                mathScore,
                accuracy: accuracyVal,
                totalCorrect,
                moduleDetails
            }
        });

        setSubmissionResult({
            ...response.data,
            rwScore,
            mathScore,
            totalScore,
            moduleDetails,
            percentage: accuracyVal
        });
        setShowResults(true);
        return;
      }

      // Standard Quiz Submission (Original Logic)
      const questionIds = questions.map(q => q.id);
      const answers = questions.map((_, idx) => userAnswers[idx] || '');
      const duration = Math.floor((Date.now() - quizStartTime) / 1000);

      const response = await gradingService.submitTest({
        courseId: parseInt(courseId),
        level: level.charAt(0).toUpperCase() + level.slice(1).toLowerCase(),
        questionIds,
        answers,
        duration,
        mode: 'practice'
      });

      const { submissionId, rawScore, rawPercentage, scaledScore, sectionScores } = response.data;
      setSubmissionResult({ submissionId, rawScore, percentage: rawPercentage, scaledScore, sectionScores, totalQuestions: questions.length });
      setShowResults(true);

    } catch (err) {
      console.error("Quiz submission failed:", err);
      setError("Failed to submit results.");
    } finally {
      setSavingResult(false);
    }
  };

  const getOptionLetter = (idx) => String.fromCharCode(65 + idx);
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (accessDenied) return <div className="p-8 text-center">Access Denied</div>;

  if (showResults) {
    const res = submissionResult;
    const percentage = res ? Math.round(res.percentage) : 0;
    // Use scaled score from API response (should always be provided by backend now)
    // Fallback only if API returns null/undefined/0 (shouldn't happen with fixed backend)
    const scaledScore = res?.scaledScore && res.scaledScore > 0 
      ? res.scaledScore 
      : Math.round(200 + (percentage / 100) * 600);
    const isPassed = percentage >= 15;

    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl max-w-2xl w-full text-center border border-gray-100 dark:border-gray-800">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg ${isPassed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            <SafeIcon icon={isPassed ? FiAward : FiX} className={`w-10 h-10 ${isPassed ? 'text-green-600' : 'text-[#E53935]'}`} />
          </div>

          <h2 className="text-3xl font-extrabold text-black dark:text-white mb-2">{isPassed ? "Great Job!" : "Keep Practicing"}</h2>
          <p className="text-gray-500 mb-6 font-medium">Test session completed successfully</p>

          {/* Section Scores Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 transition-all hover:shadow-md">
              <p className="text-[10px] text-blue-800 dark:text-blue-400 font-black uppercase tracking-widest mb-1">Overall</p>
              <p className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-200">{res?.totalScore || res?.scaledScore || scaledScore}</p>
              <p className="text-[10px] font-bold text-blue-700/60 uppercase tracking-tighter">{percentage}% Accuracy</p>
            </div>
            
            {isAdaptive ? (
                <>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 transition-all hover:shadow-md">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mb-1">R&W Section</p>
                        <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{res?.rwScore || 0}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 transition-all hover:shadow-md">
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mb-1">Math Section</p>
                        <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{res?.mathScore || 0}</p>
                    </div>
                </>
            ) : (
              res?.sectionScores && Object.entries(res.sectionScores).map(([section, data]) => (
                data.total > 0 && (
                  <div key={section} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 transition-all hover:shadow-md">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mb-1">{section}</p>
                    <p className="text-3xl font-black text-gray-900 dark:text-white">{data.scaled_score || 0}</p>
                    <p className="text-xs font-bold text-gray-400">{data.correct}/{data.total} Correct</p>
                  </div>
                )
              ))
            )}
          </div>

          {/* Scoring Info Card */}
          <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-left">
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-2">
              <SafeIcon icon={FiInfo} className="w-4 h-4 text-blue-500" /> Scoring Insights
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {isAdaptive ? (
                `Your score of ${res?.totalScore} reflects the FULL LENGTH TEST model. Students on the Easy path are capped at 1400 total, while the Hard path allows scores up to 1600.`
              ) : (
                `Your score is calculated based on the ${level} difficulty. In the SAT, higher level modules unlock higher score ceilings.`
              )}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link to={`/student/score-predictor?courseId=${courseId}`} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
              <SafeIcon icon={FiZap} className="w-5 h-5" /> View Score Prediction
            </Link>
            <Link to={`/student/course/${courseId}`} className="w-full py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-[#d32f2f] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100">
              <SafeIcon icon={FiArrowLeft} className="w-5 h-5" /> Return to Course
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex items-center justify-center font-bold text-[#E53935] transition-colors"><SafeIcon icon={FiRefreshCw} className="animate-spin mr-2" /> Loading Quiz...</div>;
  if (error) return <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex items-center justify-center p-8 text-[#E53935] font-bold transition-colors">{error}</div>;
  if (!questions.length) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex items-center justify-center p-8 transition-colors">
        <div className="text-center max-w-md">
          <SafeIcon icon={FiInfo} className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Quiz Questions Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            There are no quiz questions available for this course and level.
          </p>

          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl text-left text-xs font-mono text-gray-500 dark:text-gray-400 mb-6 space-y-1">
            <p><strong>Debug Info:</strong></p>
            <p>• Course ID in URL: {courseId}</p>
            <p>• Level in URL: {level}</p>
            <p>• Normalized Search Level: {level.charAt(0).toUpperCase() + level.slice(1).toLowerCase()}</p>
          </div>

          <Link
            to={`/student/course/${courseId}`}
            className="inline-flex items-center gap-2 text-[#E53935] hover:text-[#d32f2f] font-bold transition-colors"
          >
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back to Course
          </Link>
        </div>
      </div>
    );
  }

  const QuestionGrid = ({ questions, userAnswers, currentQuestionIndex, jumpToQuestion, setShowQuestionGrid }) => (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowQuestionGrid(false)}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
      />

      {/* Sidebar */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full max-w-[320px] bg-white dark:bg-gray-950 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] border-l border-gray-100 dark:border-gray-800 z-[100] flex flex-col"
      >
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 dark:bg-red-900/30 p-2 rounded-xl">
              <SafeIcon icon={FiGrid} className="w-5 h-5 text-[#E53935]" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">Navigation</h3>
          </div>
          <button
            onClick={() => setShowQuestionGrid(false)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
          >
            <SafeIcon icon={FiX} className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Question List</p>
          <div className="grid grid-cols-4 gap-3">
            {questions.map((_, idx) => {
              const isAnswered = !!userAnswers[idx];
              const isCurrent = idx === currentQuestionIndex;
              return (
                <button
                  key={idx}
                  onClick={() => jumpToQuestion(idx)}
                  className={`
                  aspect-square rounded-xl font-bold text-sm transition-all flex items-center justify-center border-2
                  ${isCurrent ? 'bg-[#E53935] border-[#E53935] text-white shadow-lg shadow-red-200 dark:shadow-none' :
                      isAnswered ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/50 dark:text-green-400' :
                        'bg-gray-50 border-gray-100 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Legend</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-400">
              <div className="w-4 h-4 rounded-md bg-[#E53935]"></div>
              <span>Active Question</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-400">
              <div className="w-4 h-4 rounded-md bg-green-100 dark:bg-green-900/40 border border-green-200 dark:border-green-800"></div>
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-400">
              <div className="w-4 h-4 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"></div>
              <span>Not Attempted</span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );

  return (
    <div className="dark">
    <div className="min-h-screen bg-white dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
      <div className="max-w-4xl mx-auto relative">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Link to={`/student/course/${courseId}/level/${level}`} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-2 font-bold transition-colors">
              <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Exit
            </Link>
            <button
              onClick={() => setShowQuestionGrid(!showQuestionGrid)}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2 font-bold text-sm"
            >
              <SafeIcon icon={FiGrid} className="w-4 h-4" /> Questions
            </button>
          </div>
          <div className="flex gap-4 text-sm font-bold text-gray-600 dark:text-gray-400">
            {isAdaptive && <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-[10px] uppercase tracking-widest">Module {moduleHistory.length}</span>}
            <span className="flex items-center gap-1"><SafeIcon icon={FiClock} className="text-[#E53935]" /> {formatTime(timeElapsed)}</span>
            <span className="flex items-center gap-1"><SafeIcon icon={FiTarget} className="text-[#E53935]" /> {currentQuestionIndex + 1}/{questions.length}</span>
          </div>
        </div>

        <motion.div key={currentQuestionIndex + (currentQuestion.id || 'temp')} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800">
          <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5">
            <div className="bg-[#E53935] h-1.5 transition-all" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} />
          </div>
          <div className="p-5 sm:p-8 md:p-10">
            {/* Topic Name - Premium Header */}
            <div className="mb-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E53935]" />
                    <span className="text-[10px] font-black text-[#E53935] uppercase tracking-[0.2em]">{currentQuestion.topic || 'General'}</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">
                    Question {currentQuestionIndex + 1}
                  </h1>
                </div>
              </div>
            </div>

            {/* Question Text */}
            <div className="mb-10 max-w-3xl">
              <h2 className="text-xl md:text-[22px] font-medium text-slate-800 dark:text-slate-100 leading-[1.6] tracking-normal antialiased">
                <MathRenderer text={getCleanQuestionText(currentQuestion.question || '', currentQuestion.image)} courseId={courseId} />
              </h2>
            </div>

            {/* Question Image/Visual */}
            {currentQuestion.image && (
              <div className="mb-8 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm max-w-full sm:max-w-[80%] md:max-w-[60%] lg:max-w-[50%] hover:shadow-md transition-shadow">
                <img 
                  src={currentQuestion.image} 
                  alt="Question diagram" 
                  className="w-full h-auto max-h-[400px] object-contain bg-white block mx-auto"
                  onError={(e) => {
                    console.warn("Failed to load question image:", currentQuestion.image);
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}

            {isMCQ && (
              <div className="space-y-4 max-w-2xl">
                {currentQuestion.options.map((option, idx) => {
                  const letter = getOptionLetter(idx);
                  const isSelected = selectedAnswer === letter;
                  let containerClass = "border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10";
                  let circleClass = "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400";

                  if (submitted) {
                    if (letter === currentQuestion.correct_answer) {
                      containerClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-slate-900 dark:text-white ring-1 ring-green-500";
                      circleClass = "bg-green-500 text-white border-green-500 shadow-md";
                    } else if (isSelected && letter !== currentQuestion.correct_answer) {
                      containerClass = "border-[#E53935] bg-red-50 dark:bg-red-900/20 text-slate-900 dark:text-white ring-1 ring-[#E53935]";
                      circleClass = "bg-[#E53935] text-white border-[#E53935] shadow-md";
                    } else {
                      containerClass = "border-gray-100 dark:border-gray-800 opacity-40";
                      circleClass = "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700";
                    }
                  } else if (isSelected) {
                    containerClass = "border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600 shadow-sm";
                    circleClass = "bg-blue-600 text-white border-blue-600 shadow-md";
                  }

                  return (
                    <button 
                      key={idx} 
                      onClick={() => handleAnswerSelect(letter)} 
                      disabled={submitted} 
                      className={`w-full p-4 text-left rounded-xl border transition-all flex flex-col sm:flex-row items-start gap-3 sm:gap-4 group ${containerClass}`}
                    >
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black transition-colors shadow-sm shrink-0 ${circleClass}`}>
                          {letter}
                        </span>
                        {/* On mobile, show a small label or just keep it compact */}
                      </div>
                      <div className={`font-normal text-[16px] md:text-[17px] flex-1 leading-relaxed text-slate-800 dark:text-slate-200 w-full ${isSelected || (submitted && letter === currentQuestion.correct_answer) ? 'font-semibold' : ''}`}>
                        <MathRenderer text={option || ''} courseId={courseId} />
                      </div>
                      {submitted && letter === currentQuestion.correct_answer && <SafeIcon icon={FiCheck} className="ml-auto w-5 h-5 text-green-600 shrink-0" />}
                      {submitted && isSelected && letter !== currentQuestion.correct_answer && <SafeIcon icon={FiX} className="ml-auto w-5 h-5 text-[#E53935] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {isShortAnswer && (
              <div className="mb-6">
                <input
                  type="text"
                  value={selectedAnswer}
                  onChange={(e) => handleAnswerSelect(e.target.value)}
                  disabled={submitted}
                  placeholder="Type your answer here..."
                  className={`w-full p-4 border-2 rounded-xl outline-none text-lg transition-all dark:bg-gray-800 dark:text-white dark:caret-white dark:placeholder-gray-400 dark:border-gray-700 ${submitted ? (isCorrectAnswer() ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20') : 'border-gray-200 dark:border-gray-700 focus:border-blue-600 dark:focus:border-blue-600'}`}
                />
              </div>
            )}

            {submitted && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
                {/* Unified Result & Explanation Section */}
                <div className={`p-6 md:p-8 rounded-2xl border-2 transition-all shadow-sm ${isCorrectAnswer() ? 'bg-green-50/40 border-green-100 text-green-900' : 'bg-red-50/40 border-red-100 text-red-900'}`}>
                  
                  {/* Status Indicator */}
                  <div className="flex items-center gap-3 mb-6 sm:mb-8">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-sm ${isCorrectAnswer() ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <SafeIcon icon={isCorrectAnswer() ? FiCheck : FiX} className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#E53935]/60 mb-0.5">Quiz Status</span>
                      <span className="font-black text-lg md:text-xl uppercase tracking-wider">{isCorrectAnswer() ? "Correct Answer" : "Incorrect Answer"}</span>
                    </div>
                  </div>

                  {/* Explicit Correct Answer for wrong attempts */}
                  {!isCorrectAnswer() && (
                    <div className="mb-8 p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-red-100/50 dark:border-red-900/30">
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Verified Correct Answer</span>
                      <div className="text-xl font-bold text-black dark:text-white">
                        <MathRenderer text={getDisplayAnswer(currentQuestion)} courseId={courseId} />
                      </div>
                    </div>
                  )}

                  {/* The Explanation - Main Content */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-xs font-black text-[#E53935] uppercase tracking-widest">Detailed Solution & Explanation</span>
                    </div>
                    
                    <div className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed max-w-full overflow-x-auto whitespace-pre-line break-words clear-both">
                      {currentQuestion.explanation && currentQuestion.explanation.trim() !== '' ? (
                        <MathRenderer text={currentQuestion.explanation} courseId={courseId} />
                      ) : (
                        <p className="text-sm italic text-gray-500 font-bold bg-white/40 p-4 rounded-lg border border-dashed border-gray-300">
                          No solution provided for this problem. You can ask our AI tutor for a step-by-step breakdown.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* AI Tutor Call to Action */}
                  <div className="mt-10 pt-6 border-t border-gray-200/50 dark:border-gray-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                      <SafeIcon icon={FiShield} className="w-3.5 h-3.5" />
                      <span>Analysis Verified by AI Scoring Engine</span>
                    </div>
                    {!isCorrectAnswer() && (
                      <button 
                        onClick={() => {
                          if (planSettings?.feature_ai_tutor) {
                            setShowAITutor(true);
                          } else {
                            if (user?.plan_type === 'free') navigate('/student/upgrade');
                            else alert("AI Tutor is currently disabled by Admin for your plan.");
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#E53935] hover:text-[#E53935] transition-all shadow-sm ${!planSettings?.feature_ai_tutor ? 'opacity-70 grayscale' : ''}`}
                      >
                        <SafeIcon icon={planSettings?.feature_ai_tutor ? FiMessageCircle : FiIcons.FiLock} className="w-4 h-4" />
                        Chat with AI
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3 sm:gap-4">
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handlePrevQuestion}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-1 sm:gap-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all shadow-sm"
              >
                <SafeIcon icon={FiChevronLeft} className="w-4 h-4 sm:w-5 sm:h-5" /><span className="hidden sm:inline">Previous</span>
              </button>
            </div>

            {!submitted ? (
              <button onClick={handleSubmitAnswer} disabled={!selectedAnswer} className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-8 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base disabled:opacity-50 transition-colors shadow-lg shadow-blue-100">
                Check Answer
              </button>
            ) : (
              <div className="flex flex-wrap gap-2 sm:gap-3 justify-end">
                {!isCorrectAnswer() && (
                  <button 
                    onClick={() => {
                      if (planSettings?.feature_ai_tutor) {
                        setShowAITutor(true);
                      } else {
                        if (user?.plan_type === 'free') navigate('/student/upgrade');
                        else alert("AI Tutor is currently disabled.");
                      }
                    }} 
                    className={`flex items-center gap-1 sm:gap-2 text-white font-bold px-3 sm:px-5 py-2 sm:py-3 bg-black rounded-xl text-sm sm:text-base hover:bg-gray-800 dark:hover:bg-gray-700 transition-all shadow-sm ${!planSettings?.feature_ai_tutor ? 'opacity-70' : ''}`}
                  >
                    <SafeIcon icon={planSettings?.feature_ai_tutor ? FiMessageCircle : FiIcons.FiLock} className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Chat with</span> AI
                  </button>
                )}
                <button onClick={handleNextQuestion} disabled={savingResult} className="bg-[#E53935] hover:bg-[#d32f2f] text-white px-5 sm:px-8 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base flex items-center gap-1 sm:gap-2 transition-colors shadow-lg shadow-red-100 disabled:opacity-70">
                  {savingResult ? <SafeIcon icon={FiRefreshCw} className="animate-spin" /> : <SafeIcon icon={FiChevronRight} />}
                  {isLastQuestion ? (savingResult ? 'Saving...' : 'Finish') : 'Next'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {showQuestionGrid && (
          <QuestionGrid
            key="navigation-sidebar"
            questions={questions}
            userAnswers={userAnswers}
            currentQuestionIndex={currentQuestionIndex}
            jumpToQuestion={jumpToQuestion}
            setShowQuestionGrid={setShowQuestionGrid}
          />
        )}
      </AnimatePresence>
      {showAITutor && <AITutorModal question={currentQuestion} userAnswer={selectedAnswer} correctAnswer={currentQuestion.correct_answer} onClose={() => setShowAITutor(false)} />}
    </div>
    </div>
  );
};

export default QuizInterface;