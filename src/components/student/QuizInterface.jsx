import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import AITutorModal from './AITutorModal';
import { questionService, progressService, enrollmentService, gradingService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';

const {
  FiArrowLeft, FiCheck, FiX, FiMessageCircle, FiClock, FiTarget,
  FiSkipForward, FiInfo, FiImage, FiAward, FiRefreshCw, FiShield,
  FiTrendingUp, FiChevronLeft, FiChevronRight, FiGrid
} = FiIcons;

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

      // Normalize level: capitalize first letter, lowercase rest (e.g., "easy" -> "Easy")
      const dbLevel = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
      const levelLower = level.toLowerCase();
      console.log(`🔍 [QUIZ] Loading Latest Quiz for Course: ${cId}, Level: ${dbLevel}`);

      // 1. Strict Versioning: Find the SINGLE most recent 'quiz_document' upload
      // strictly for this course/level from the 'uploads' table.
      const { data: latestUploadData, error: uploadErr } = await supabase
        .from('uploads')
        .select('id, created_at, level, status, category, questions_count')
        .eq('course_id', cId)
        .eq('category', 'quiz_document')
        .ilike('level', dbLevel)
        .in('status', ['completed', 'warning'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (uploadErr) {
        console.error("❌ [QUIZ] Error fetching latest upload:", uploadErr);
        throw uploadErr;
      }

      let targetQuestions = [];
      let sourceInfo = "";

      if (latestUploadData && latestUploadData.length > 0) {
        const latestUpload = latestUploadData[0];
        console.log(`📦 [QUIZ] Found Latest Upload: ID ${latestUpload.id}, Time: ${new Date(latestUpload.created_at).toLocaleString()}, Level: ${latestUpload.level}`);
        sourceInfo = `Upload #${latestUpload.id}`;

        // 2. Fetch questions STRICTLY from this upload ID
        const { data: questionsData, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('upload_id', latestUpload.id)
          .order('id', { ascending: true });

        if (qErr) {
          console.error("❌ [QUIZ] Error fetching questions for upload:", qErr);
        } else {
          targetQuestions = questionsData || [];
          console.log(`✅ [QUIZ] Loaded ${targetQuestions.length} questions from ${sourceInfo}`);
        }
      } else {
        // Fallback to manual questions if NO upload exists
        console.log("🔍 [QUIZ] No uploaded quiz file found. Checking for manual questions...");
        const { data: manualQuestions, error: mErr } = await supabase
          .from('questions')
          .select('*')
          .eq('course_id', cId)
          .is('upload_id', null)
          .ilike('level', dbLevel);

        if (!mErr) {
          targetQuestions = manualQuestions || [];
          if (targetQuestions.length > 0) sourceInfo = "Manual Entry";
        }
      }

      if (targetQuestions.length > 0) {
        setQuestions(targetQuestions);
      } else {
        console.warn("⚠️ [QUIZ] No questions found.");
        setQuestions([]);
      }
    } catch (err) {
      console.error("❌ [QUIZ] Load Failure:", err);
      setError("Could not load questions.");
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isMCQ = currentQuestion?.type === 'mcq';
  const isShortAnswer = !isMCQ;

  const getDisplayAnswer = (q) => {
    if (!q) return '';
    if (q.type === 'short_answer' && /^[A-E]$/i.test(q.correct_answer)) {
      const match = q.explanation?.match(/(?:Therefore|Thus|Hence|So|Consequently|is|=)\s*([-]?\d+(?:\.\d+)?)/i);
      if (match && match[1]) return match[1];
      return "See Explanation";
    }
    return q.correct_answer;
  };

  const handleAnswerSelect = (answer) => {
    if (submitted) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer) return;
    setSubmitted(true);
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: selectedAnswer }));
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
      handleFinishQuiz();
    } else {
      jumpToQuestion(currentQuestionIndex + 1);
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
    const ans = userAnswers[idx];
    if (!ans) return false;
    const isExact = ans.toString().trim().toLowerCase() === q.correct_answer?.toString().trim().toLowerCase();
    if (isExact) return true;
    const displayAns = getDisplayAnswer(q);
    if (displayAns !== "See Explanation" && displayAns !== q.correct_answer) {
      return ans.toString().trim() === displayAns.toString().trim();
    }
    return false;
  };

  const handleFinishQuiz = async () => {
    setSavingResult(true);

    // Prepare data for advanced grading
    const questionIds = questions.map(q => q.id);
    const answers = questions.map((_, idx) => userAnswers[idx] || '');
    const duration = Math.floor((Date.now() - quizStartTime) / 1000);

    try {
      console.log("Submitting test for advanced grading...");
      const response = await gradingService.submitTest({
        courseId: parseInt(courseId),
        level: level.charAt(0).toUpperCase() + level.slice(1).toLowerCase(),
        questionIds,
        answers,
        duration
      });

      const { submissionId, rawScore, rawPercentage, scaledScore, sectionScores } = response.data;

      setSubmissionResult({
        submissionId,
        rawScore,
        percentage: rawPercentage,
        scaledScore,
        sectionScores,
        totalQuestions: questions.length
      });

      // SYNC: Also save to the simplified student_progress table to ensure level unlocking
      try {
        await progressService.saveProgress(
          user.id,
          parseInt(courseId),
          level.charAt(0).toUpperCase() + level.slice(1).toLowerCase(),
          Math.round(rawPercentage),
          rawPercentage >= 40
        );
        console.log("✅ [QUIZ] Progress synced to student_progress table");
      } catch (syncErr) {
        console.warn("⚠️ [QUIZ] Failed to sync to student_progress, but submission was saved:", syncErr);
      }

      setResultMessage("Test submitted and graded successfully!");
      setShowResults(true);

    } catch (err) {
      console.error("Advanced grading submission failed:", err);
      // Fallback to basic progress saving if advanced grading fails
      const total = questions.length;
      const correctCount = questions.reduce((acc, _, idx) => acc + (isCorrectAnswer(idx) ? 1 : 0), 0);
      const percentage = Math.round((correctCount / total) * 100);

      try {
        await progressService.saveProgress(
          user.id,
          parseInt(courseId),
          level.charAt(0).toUpperCase() + level.slice(1).toLowerCase(),
          percentage,
          percentage >= 40
        );
        setResultMessage("Saved to progress (fallback)");
        setShowResults(true);
      } catch (fallbackErr) {
        setError("Failed to save result. Please check your connection.");
      }
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
    const scaledScore = res?.scaledScore || Math.round(200 + (percentage / 100) * 600);
    const isPassed = percentage >= 40;

    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl max-w-2xl w-full text-center border border-gray-100 dark:border-gray-800">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg ${isPassed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            <SafeIcon icon={isPassed ? FiAward : FiX} className={`w-10 h-10 ${isPassed ? 'text-green-600' : 'text-[#E53935]'}`} />
          </div>

          <h2 className="text-3xl font-extrabold text-black dark:text-white mb-2">{isPassed ? "Great Job!" : "Keep Practicing"}</h2>
          <p className="text-gray-500 mb-6 font-medium">Test session completed successfully</p>

          {/* Section Scores Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 transition-all hover:shadow-md">
              <p className="text-[10px] text-blue-800 dark:text-blue-400 font-black uppercase tracking-widest mb-1">Overall</p>
              <p className="text-3xl font-black text-blue-900 dark:text-blue-200">{scaledScore}</p>
              <p className="text-xs font-bold text-blue-700/60">{percentage}% Accuracy</p>
            </div>
            {res?.sectionScores && Object.entries(res.sectionScores).map(([section, data]) => (
              data.total > 0 && (
                <div key={section} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 transition-all hover:shadow-md">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mb-1">{section}</p>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">{data.scaled_score || 0}</p>
                  <p className="text-xs font-bold text-gray-400">{data.correct}/{data.total} Correct</p>
                </div>
              )
            ))}
          </div>

          {/* Scoring Info Card */}
          <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-left">
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-2">
              <SafeIcon icon={FiInfo} className="w-4 h-4 text-blue-500" /> Scoring Insights
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Your score is calculated based on the <strong>{level}</strong> difficulty.
              In the SAT, higher level modules unlock higher score ceilings.
              Your raw score of {res?.rawScore} corrects out of {res?.totalQuestions} questions was converted to a scaled score considering the module weight.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link to={`/student/course/${courseId}`} className="w-full py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-[#d32f2f] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100">
              <SafeIcon icon={FiSkipForward} className="w-5 h-5" /> Next Level / Dashboard
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
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 dark:bg-red-900/30 p-2 rounded-xl">
              <SafeIcon icon={FiGrid} className="w-5 h-5 text-[#E53935]" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Navigation</h3>
          </div>
          <button
            onClick={() => setShowQuestionGrid(false)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
          >
            <SafeIcon icon={FiX} className="w-6 h-6" />
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
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
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
            <span className="flex items-center gap-1"><SafeIcon icon={FiClock} className="text-[#E53935]" /> {formatTime(timeElapsed)}</span>
            <span className="flex items-center gap-1"><SafeIcon icon={FiTarget} className="text-[#E53935]" /> {currentQuestionIndex + 1}/{questions.length}</span>
          </div>
        </div>

        <motion.div key={currentQuestionIndex + (currentQuestion.id || 'temp')} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5">
            <div className="bg-[#E53935] h-1.5 transition-all" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} />
          </div>
          <div className="p-8 md:p-10">
            <div className="flex items-start gap-4 mb-6">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 text-[#E53935] font-extrabold text-sm flex-shrink-0 border border-red-100 dark:border-red-900/50">
                {currentQuestionIndex + 1}
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-black dark:text-white leading-relaxed">
                <MathRenderer text={currentQuestion.question || ''} />
              </h2>
            </div>

            {isMCQ && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  const letter = getOptionLetter(idx);
                  const isSelected = selectedAnswer === letter;
                  let containerClass = "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50";
                  let circleClass = "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400";

                  if (submitted) {
                    if (letter === currentQuestion.correct_answer) {
                      containerClass = "border-green-500 bg-green-50";
                      circleClass = "bg-green-500 text-white border-green-500";
                    } else if (isSelected && letter !== currentQuestion.correct_answer) {
                      containerClass = "border-[#E53935] bg-red-50";
                      circleClass = "bg-[#E53935] text-white border-[#E53935]";
                    } else {
                      containerClass = "border-gray-100 dark:border-gray-800 opacity-50";
                    }
                  } else if (isSelected) {
                    containerClass = "border-[#E53935] bg-red-50 dark:bg-red-900/20";
                    circleClass = "bg-[#E53935] text-white border-[#E53935]";
                  }

                  return (
                    <button key={idx} onClick={() => handleAnswerSelect(letter)} disabled={submitted} className={`w-full p-4 text-left rounded-xl border-2 transition-all flex items-center gap-4 group ${containerClass}`}>
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors shadow-sm ${circleClass}`}>{letter}</span>
                      <span className="font-medium flex-1 text-gray-800 dark:text-gray-200"><MathRenderer text={option || ''} /></span>
                      {submitted && letter === currentQuestion.correct_answer && <SafeIcon icon={FiCheck} className="ml-auto w-5 h-5 text-green-600" />}
                      {submitted && isSelected && letter !== currentQuestion.correct_answer && <SafeIcon icon={FiX} className="ml-auto w-5 h-5 text-[#E53935]" />}
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
                  className={`w-full p-4 border-2 rounded-xl outline-none text-lg transition-all dark:bg-gray-800 dark:text-white dark:caret-white dark:placeholder-gray-400 dark:border-gray-700 ${submitted ? (isCorrectAnswer() ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20') : 'border-gray-200 dark:border-gray-700 focus:border-[#E53935] dark:focus:border-[#E53935]'}`}
                />
              </div>
            )}

            {submitted && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${isCorrectAnswer() ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  <SafeIcon icon={isCorrectAnswer() ? FiCheck : FiX} className="w-6 h-6" />
                  <span className="font-bold text-lg">{isCorrectAnswer() ? "Correct!" : "Incorrect"}</span>
                </div>
                {!isCorrectAnswer() && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Correct Answer</span>
                    <div className="text-black dark:text-white font-bold text-lg">
                      <MathRenderer text={getDisplayAnswer(currentQuestion)} />
                    </div>
                  </div>
                )}
                {currentQuestion.explanation && currentQuestion.explanation.trim() !== '' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center gap-2 mb-2">
                      <SafeIcon icon={FiInfo} className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-300 uppercase">Explanation</span>
                    </div>
                    <div className="text-blue-900 dark:text-blue-200 leading-relaxed font-medium"><MathRenderer text={currentQuestion.explanation} /></div>
                  </div>
                )}
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
              <button onClick={handleSubmitAnswer} disabled={!selectedAnswer} className="bg-[#E53935] hover:bg-[#d32f2f] text-white px-5 sm:px-8 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base disabled:opacity-50 transition-colors shadow-lg shadow-red-100">
                Submit
              </button>
            ) : (
              <div className="flex flex-wrap gap-2 sm:gap-3 justify-end">
                {!isCorrectAnswer() && (
                  <button onClick={() => setShowAITutor(true)} className="flex items-center gap-1 sm:gap-2 text-white font-bold px-3 sm:px-5 py-2 sm:py-3 bg-black rounded-xl text-sm sm:text-base hover:bg-gray-800 dark:hover:bg-gray-700 transition-all shadow-sm">
                    <SafeIcon icon={FiMessageCircle} className="w-4 h-4 sm:w-5 sm:h-5" /><span className="hidden sm:inline">Chat with</span> AI
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
  );
};

export default QuizInterface;