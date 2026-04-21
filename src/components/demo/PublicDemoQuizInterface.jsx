import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { courseService, uploadService } from '../../services/api';
import supabase from '../../supabase/supabase';
import axios from 'axios';
import DemoLeadForm from './DemoLeadForm';
import { calculateSatScore } from '../../utils/scoreCalculator';

const {
  FiArrowLeft, FiCheck, FiX, FiClock, FiTarget,
  FiInfo, FiAward, FiRefreshCw, FiGrid, FiZap, FiChevronLeft, FiChevronRight, FiCheckCircle
} = FiIcons;

// Helper to get clean question text
const getCleanQuestionText = (text, imageUrl) => {
  if (!text) return '';
  if (!imageUrl) return text;
  let cleaned = text;
  try {
    const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const imgTagRegex = new RegExp(`<img[^>]+src=["']${escapedUrl}["'][^>]*>`, 'gi');
    cleaned = cleaned.replace(imgTagRegex, '');
    const mdImgRegex = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)`, 'gi');
    cleaned = cleaned.replace(mdImgRegex, '');
    const rawUrlRegex = new RegExp(`(^|\\n)${escapedUrl}(\\n|$)`, 'gi');
    cleaned = cleaned.replace(rawUrlRegex, '$1$2');
  } catch (e) { console.warn("Error cleaning text:", e); }
  return cleaned.trim();
};


const PublicDemoQuizInterface = () => {
  const { courseId, level } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startTime] = useState(Date.now());
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    loadCourseAndQuestions();
    const timer = setInterval(() => setTimeElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [courseId, level]);

  const loadCourseAndQuestions = async () => {
    setLoading(true);
    try {
      // 1. Fetch Course
      const courseRes = await courseService.getById(courseId);
      if (!courseRes.data?.is_demo) throw new Error("Course not available in demo mode.");
      setCourse(courseRes.data);

      // 2. Load Questions for this Level
      const dbLevel = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
      
      const { data: latestUploadData } = await supabase
        .from('uploads')
        .select('id')
        .eq('course_id', parseInt(courseId))
        .eq('category', 'quiz_document')
        .ilike('level', dbLevel)
        .order('created_at', { ascending: false })
        .limit(1);

      let targetQuestions = [];
      if (latestUploadData?.[0]) {
        const { data: questionsData } = await supabase
          .from('questions')
          .select('*')
          .eq('upload_id', latestUploadData[0].id)
          .order('id', { ascending: true });
        targetQuestions = questionsData || [];
      } else {
        const { data: manualQuestions } = await supabase
          .from('questions')
          .select('*')
          .eq('course_id', parseInt(courseId))
          .is('upload_id', null)
          .ilike('level', dbLevel);
        targetQuestions = manualQuestions || [];
      }

      if (targetQuestions.length === 0) throw new Error("No questions found for this demo level.");
      setQuestions(targetQuestions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const activeQuestion = questions[currentIndex];
  const isMCQ = activeQuestion?.type === 'mcq';

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (val) => {
    if (isAnswerSubmitted) return;
    setSelectedAnswer(val);
  };

  const submitCurrentAnswer = () => {
    if (!selectedAnswer) return;
    setIsAnswerSubmitted(true);
    setUserAnswers(prev => ({ ...prev, [currentIndex]: selectedAnswer }));
  };

  const jumpToQuestion = (idx) => {
    setCurrentIndex(idx);
    const ans = userAnswers[idx] || '';
    setSelectedAnswer(ans);
    setIsAnswerSubmitted(!!ans);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      jumpToQuestion(currentIndex + 1);
    } else {
      if (level.toLowerCase() === 'hard') {
        setShowLeadForm(true);
      } else {
        // Mark level as passed and save current score details
        try {
          const correctCount = questions.reduce((acc, _, idx) => acc + (isCorrect(idx) ? 1 : 0), 0);
          const percentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
          const scaledScore = Math.round(percentage * 8); // Simple approx scale

          const savedProgress = JSON.parse(localStorage.getItem(`demo_progress_${courseId}`) || '{"easy":{"passed":false},"medium":{"passed":false},"hard":{"passed":false}}');
          savedProgress[level.toLowerCase()] = {
            passed: true,
            correctCount,
            totalQuestions: questions.length,
            percentage,
            scaledScore
          };
          localStorage.setItem(`demo_progress_${courseId}`, JSON.stringify(savedProgress));
        } catch (e) {
          console.error("Local storage error:", e);
        }
        setIsFinished(true);
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) jumpToQuestion(currentIndex - 1);
  };

  const isCorrect = (idx = currentIndex) => {
    const q = questions[idx];
    if (!q) return false;
    const ans = userAnswers[idx];
    if (!ans) return false;
    return ans.toString().trim().toLowerCase() === q.correct_answer?.toString().trim().toLowerCase();
  };

  const handleLeadSubmit = async (formData) => {
    setIsSubmittingLead(true);
    
    // Calculate Score Internally
    const correctCount = questions.reduce((acc, _, idx) => acc + (isCorrect(idx) ? 1 : 0), 0);
    const percentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    const scaledScore = Math.round(percentage * 8);
    
    // Get previous scores from localStorage for a cumulative final score
    let easyDetails = null;
    let mediumDetails = null;
    try {
      const savedProgress = JSON.parse(localStorage.getItem(`demo_progress_${courseId}`) || '{}');
      easyDetails = savedProgress.easy?.percentage !== undefined ? savedProgress.easy : null;
      mediumDetails = savedProgress.medium?.percentage !== undefined ? savedProgress.medium : null;
    } catch (e) { console.warn("Could not read previous scores:", e); }

    const easyPct = easyDetails?.percentage || 0;
    const mediumPct = mediumDetails?.percentage || 0;
    const finalScaledScore = calculateSatScore(easyPct, mediumPct, percentage);

    const scoreDetails = {
      allLevels: {
        easy: easyDetails,
        medium: mediumDetails,
        hard: {
          correctCount,
          totalQuestions: questions.length,
          percentage,
          scaledScore
        }
      },
      comprehensive: {
        finalPredictedScore: finalScaledScore,
        overallAccuracy: Math.round(((easyDetails?.correctCount || 0) + (mediumDetails?.correctCount || 0) + correctCount) / ((easyDetails?.totalQuestions || 0) + (mediumDetails?.totalQuestions || 0) + questions.length || 1) * 100),
        totalCorrect: (easyDetails?.correctCount || 0) + (mediumDetails?.correctCount || 0) + correctCount,
        totalQuestions: (easyDetails?.totalQuestions || 0) + (mediumDetails?.totalQuestions || 0) + questions.length
      }
    };

    try {
      await axios.post('/api/demo/submit-lead', {
        courseId,
        level: level.charAt(0).toUpperCase() + level.slice(1).toLowerCase(),
        ...formData,
        scoreDetails
      });

      // Update local progress
      const savedProgress = JSON.parse(localStorage.getItem(`demo_progress_${courseId}`) || '{"easy":{"passed":false},"medium":{"passed":false},"hard":{"passed":false}}');
      savedProgress[level.toLowerCase()].passed = true;
      localStorage.setItem(`demo_progress_${courseId}`, JSON.stringify(savedProgress));

      // Return to demo dashboard
      navigate(`/demo/${courseId}`);
    } catch (err) {
      console.error("Failed to submit lead:", err);
      throw err;
    } finally {
      setIsSubmittingLead(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex flex-col items-center justify-center">
        <SafeIcon icon={FiRefreshCw} className="w-8 h-8 animate-spin text-[#E53935] mb-4" />
        <p className="font-black text-gray-500 uppercase tracking-widest text-sm">Initializing Level...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex flex-col items-center justify-center p-8 text-center">
        <SafeIcon icon={FiX} className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase italic">Demo Error</h2>
        <p className="text-gray-500 mt-2">{error}</p>
        <button onClick={() => navigate(`/demo/${courseId}`)} className="mt-6 text-[#E53935] font-black uppercase tracking-tighter hover:underline">Return to Demo Home</button>
    </div>
  );

  if (isFinished) {
    const nextLevel = level.toLowerCase() === 'easy' ? 'Medium' : 'Hard';
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex flex-col items-center justify-center p-8 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 p-12 rounded-[32px] shadow-2xl border border-gray-100 dark:border-gray-800 max-w-lg w-full">
           <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <SafeIcon icon={FiCheckCircle} className="w-10 h-10 text-green-600" />
           </div>
           <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4 italic">Level Complete!</h2>
           <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
             Great job finishing the {level} difficulty. Ready to step it up?
           </p>
           <button 
             onClick={() => {
                // Navigate to next level and reload component
                navigate(`/demo/${courseId}/level/${nextLevel.toLowerCase()}`);
                window.location.reload(); 
             }}
             className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#E53935] transition-all shadow-xl"
           >
             Continue to {nextLevel}
           </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0F172A] text-slate-200 flex flex-col font-sans selection:bg-red-500/30 overflow-hidden">
      {/* Top Navigation Bar - Stay fixed at top */}
      <div className="bg-[#0F172A] border-b border-slate-800 px-6 py-3 flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(`/demo/${courseId}`)} 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 font-bold text-sm"
          >
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Exit
          </button>
          <button 
            onClick={() => setShowQuestionGrid(!showQuestionGrid)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors text-slate-300 font-bold text-sm"
          >
            <SafeIcon icon={FiGrid} className="w-4 h-4" /> Questions
          </button>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
            <SafeIcon icon={FiClock} className="w-4 h-4 text-red-500" />
            <span className="tabular-nums">{formatTime(timeElapsed)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
            <SafeIcon icon={FiZap} className="w-4 h-4 text-red-500" />
            {currentIndex + 1}/{questions.length}
          </div>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0">
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 bg-[#1E293B]/40 rounded-2xl border border-slate-800 shadow-2xl flex flex-col min-h-0 overflow-hidden"
        >
          {/* Progress Bar */}
          <div className="h-1 bg-slate-800 shrink-0">
            <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 lg:p-14">
            <div className="max-w-4xl mx-auto w-full">
              {/* Question Meta */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xl font-black text-red-500">Q.{currentIndex + 1})</span>
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{activeQuestion.topic || 'General'}</span>
              </div>

              {/* Question Text */}
              <div className="prose prose-invert max-w-none mb-10">
                <h3 className="text-lg md:text-xl lg:text-2xl font-bold leading-relaxed text-slate-100">
                  <MathRenderer text={getCleanQuestionText(activeQuestion.question, activeQuestion.image)} />
                </h3>
              </div>

              {/* Image if exists */}
              {activeQuestion.image && (
                <div className="mb-10 flex justify-center p-4 bg-white rounded-xl">
                  <img src={activeQuestion.image} alt="Stimulus" className="max-h-[350px] object-contain" />
                </div>
              )}

              {/* Options Section */}
              <div className="space-y-3">
                {isMCQ ? (
                  activeQuestion.options.map((option, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isSelected = selectedAnswer === letter;
                    let borderClass = isSelected ? "border-slate-400 bg-slate-800/80" : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60";
                    
                    if (isAnswerSubmitted) {
                      if (letter === activeQuestion.correct_answer) borderClass = "border-green-500/50 bg-green-500/10";
                      else if (isSelected) borderClass = "border-red-500/50 bg-red-500/10";
                      else borderClass = "opacity-50 border-slate-900 bg-transparent";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswerSelect(letter)}
                        disabled={isAnswerSubmitted}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 group ${borderClass}`}
                      >
                        <div className={`w-7 h-7 rounded-full border border-slate-700 flex items-center justify-center text-[10px] font-black shrink-0 ${isSelected ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                          {letter}
                        </div>
                        <div className="text-base font-medium text-slate-200 flex-1">
                          <MathRenderer text={option || ''} />
                        </div>
                        {isAnswerSubmitted && letter === activeQuestion.correct_answer && <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-green-500" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="max-w-md">
                    <input
                      type="text"
                      value={selectedAnswer}
                      onChange={(e) => handleAnswerSelect(e.target.value)}
                      disabled={isAnswerSubmitted}
                      placeholder="Enter numeric response"
                      className="w-full bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-lg font-bold focus:border-red-600 outline-none transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Explanation Breakdown */}
              <AnimatePresence>
                {isAnswerSubmitted && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 rounded-xl bg-slate-900/80 border border-slate-800"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${isCorrect() ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Explanation Breakdown</span>
                    </div>
                    <div className="text-base leading-relaxed text-slate-300">
                      <MathRenderer text={activeQuestion.explanation || 'Detailed breakdown available in the premium version.'} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer - Positioned at Bottom of Card */}
          <div className="bg-[#1E293B] border-t border-slate-800 p-5 flex justify-between items-center shrink-0">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 font-bold hover:text-white hover:bg-slate-800 transition-all disabled:opacity-0 text-sm"
            >
              Previous
            </button>

            {!isAnswerSubmitted ? (
               <button
                 onClick={submitCurrentAnswer}
                 disabled={!selectedAnswer}
                 className="px-8 py-2 bg-[#E53935] hover:bg-red-700 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all disabled:opacity-40 text-sm"
               >
                 Submit
               </button>
            ) : (
               <button
                 onClick={handleNext}
                 className="px-8 py-2 bg-slate-100 hover:bg-white text-slate-900 font-bold rounded-lg shadow-lg active:scale-95 transition-all flex items-center gap-2 text-sm"
               >
                 {currentIndex === questions.length - 1 ? 'Unlock My Score' : 'Next Question'}
                 <SafeIcon icon={FiChevronRight} className="w-4 h-4" />
               </button>
            )}
          </div>
        </motion.div>
      </main>

      <DemoLeadForm 
        isOpen={showLeadForm} 
        onClose={() => setShowLeadForm(false)} 
        onSubmit={handleLeadSubmit}
        courseName={course.name}
        level={level}
      />
    </div>
  );
};

export default PublicDemoQuizInterface;
