import React, { useState, useEffect, useRef } from 'react';
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
  FiInfo, FiAward, FiRefreshCw, FiGrid, FiZap, FiChevronLeft, FiChevronRight, FiCheckCircle,
  FiFlag, FiStar, FiLogOut, FiChevronDown
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

// Helper to extract image URLs from question text
const extractImagesFromText = (text) => {
  if (!text) return [];
  const images = [];
  try {
    // Match <img> tags
    const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgTagRegex.exec(text)) !== null) {
      images.push(match[1]);
    }
  } catch (e) {
    console.warn("Error extracting images:", e);
  }
  return images;
};

// Helper to get clean text without image tags
const getCleanTextWithoutImages = (text) => {
  if (!text) return '';
  let cleaned = text;
  try {
    // Remove <img> tags
    const imgTagRegex = /<img[^>]+src=["'][^"']+["'][^>]*>/gi;
    cleaned = cleaned.replace(imgTagRegex, '');
    // Remove [IMAGE: ...] placeholders
    const imagePlaceholderRegex = /\[IMAGE:\s*[^\]]+\]/gi;
    cleaned = cleaned.replace(imagePlaceholderRegex, '');
  } catch (e) {
    console.warn("Error cleaning text:", e);
  }
  return cleaned.trim();
};


const PublicDemoQuizInterface = () => {
  const { courseId, level } = useParams();
  const navigate = useNavigate();
  
  // Core State - Exact match with student test
  const [modules, setModules] = useState({}); // { rw_moderate: [], rw_easy: [], rw_hard: [], math_moderate: [], math_easy: [], math_hard: [] }
  const [currentModuleKey, setCurrentModuleKey] = useState('rw_moderate');
  const [moduleHistory, setModuleHistory] = useState(['rw_moderate']);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  
  // UI State - Exact match with student test
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showCheckWork, setShowCheckWork] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [savingResult, setSavingResult] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [courseInfo, setCourseInfo] = useState(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTimer, setShowTimer] = useState(true);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  
  // Scoring State
  const [totalScore, setTotalScore] = useState(0);
  const [rwScore, setRwScore] = useState(0);
  const [mathScore, setMathScore] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [moduleDetails, setModuleDetails] = useState({});
  const [moduleScores, setModuleScores] = useState({}); // Track scores per module
  
  const wasDarkMode = useRef(false);

  // 1. Initial Setup: Load Course and Questions - Exact match with student test
  useEffect(() => {
    wasDarkMode.current = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    
    if (courseId) {
      loadInitialData();
    }

    return () => {
      if (wasDarkMode.current) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
    };
  }, [courseId]);

  // 2. Timer Effect - Exact match with student test
  useEffect(() => {
    if (timeLeft > 0 && !showResults && !showCheckWork) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && questions.length > 0 && !showResults && !showCheckWork) {
      setShowCheckWork(true);
    }
  }, [timeLeft, showResults, showCheckWork, questions.length]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load Course Info - Exact match with student test
      const courseRes = await courseService.getById(courseId);
      if (!courseRes.data) throw new Error("Course not found");
      setCourseInfo(courseRes.data);

      // Verify this is a demo Adaptive SAT course
      if (!courseRes.data?.is_demo) throw new Error("Course not available in demo mode.");
      if (!courseRes.data.is_adaptive || courseRes.data.category !== 'Full-Length SAT') {
        throw new Error("This demo interface is only for Full-Length Adaptive SAT Tests.");
      }

      console.log(`🔒 [DEMO] Loading Full-Length Adaptive SAT content for course ${courseId}`);

      // 2. Identify the LATEST upload for each of the 6 module slots - Exact match with student test
      const { data: uploadData, error: uploadErr } = await supabase
        .from('uploads')
        .select('id, level')
        .eq('course_id', courseId)
        .eq('category', 'quiz_document')
        .in('status', ['completed', 'warning'])
        .order('id', { ascending: false });

      if (uploadErr) throw uploadErr;

      // 3. Load ALL questions for this course to identify versions - Exact match with student test
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select('*')
        .eq('course_id', courseId);

      if (qError) throw qError;
      if (!qData || qData.length === 0) throw new Error("No questions found for this test.");

      // 4. Group questions by upload_id and determine the "Dominant Slot" for each file - Exact match with student test
      const uploadStats = {}; // { uploadId: { slot: count } }
      const uploadQuestions = {}; // { uploadId: [questions] }

      qData.forEach(q => {
        const sec = (q.section || '').toLowerCase();
        const lvl = (q.level || '').toLowerCase();
        const uId = q.upload_id;
        if (!uId) return;

        let secKey = '';
        if (sec.includes('read') || sec.includes('writ') || sec.includes('eng') || sec.includes('lit')) secKey = 'rw';
        else if (sec.includes('math') || sec.includes('calc') || sec.includes('alg')) secKey = 'math';
        
        let lvlKey = '';
        if (lvl.includes('mod') || lvl.includes('med')) lvlKey = 'moderate';
        else if (lvl.includes('easy')) lvlKey = 'easy';
        else if (lvl.includes('hard')) lvlKey = 'hard';

        // Always add the question to the upload's pool
        if (!uploadQuestions[uId]) uploadQuestions[uId] = [];
        uploadQuestions[uId].push({
          ...q,
          text: q.question || q.question_text || '',
          options: q.options || [],
          correctAnswer: q.correct_answer || ''
        });

        // Track stats for dominant slot detection
        if (secKey && lvlKey) {
          const slot = `${secKey}_${lvlKey}`;
          if (!uploadStats[uId]) uploadStats[uId] = {};
          uploadStats[uId][slot] = (uploadStats[uId][slot] || 0) + 1;
        }
      });

      // 5. For each slot, pick the LATEST upload_id whose dominant slot matches - Exact match with student test
      const slotLatestUploadId = {};
      
      // Sort upload IDs descending (latest first)
      const sortedUploadIds = Object.keys(uploadStats).map(Number).sort((a, b) => b - a);

      sortedUploadIds.forEach(uId => {
        const stats = uploadStats[uId];
        // Find the slot with the most questions in this upload
        let dominantSlot = '';
        let maxCount = 0;
        Object.keys(stats).forEach(slot => {
          if (stats[slot] > maxCount) {
            maxCount = stats[slot];
            dominantSlot = slot;
          }
        });

        if (dominantSlot && !slotLatestUploadId[dominantSlot]) {
          slotLatestUploadId[dominantSlot] = uId;
        }
      });

      // 6. Final Grouping: Take EVERY question from the identified upload for each slot - Exact match with student test
      const grouped = {
        rw_moderate: [], rw_easy: [], rw_hard: [],
        math_moderate: [], math_easy: [], math_hard: []
      };

      Object.keys(slotLatestUploadId).forEach(slotKey => {
        const latestId = slotLatestUploadId[slotKey];
        // Take ALL questions belonging to this upload ID. 
        // This ensures the count matches the Admin panel exactly.
        grouped[slotKey] = uploadQuestions[latestId] || [];
      });

      console.log(`📚 [DEMO] Loaded modules:`, Object.keys(grouped).map(key => `${key}: ${grouped[key].length} questions`));

      setModules(grouped);
      
      // Start with rw_moderate - Exact match with student test
      const firstModule = grouped['rw_moderate'];
      if (!firstModule || firstModule.length === 0) throw new Error("Reading & Writing Moderate module is missing.");
      
      setQuestions(firstModule);
      startModuleTimer(firstModule, 'rw_moderate');
      console.log(`✅ [DEMO] Starting with Reading & Writing Moderate module (${firstModule.length} questions)`);
    } catch (err) {
      console.error(`❌ [DEMO] Error loading content:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startModuleTimer = (moduleQuestions, key) => {
    const isMath = key.startsWith('math');
    // SAT Timing: R&W ~71s/q, Math ~95s/q - Exact match with student test
    const rate = isMath ? 95 : 71;
    const duration = moduleQuestions.length * rate;
    setTotalTime(duration);
    setTimeLeft(duration);
  };


  // 3. Navigation & Answer Handling - Exact match with student test
  const handleAnswerSelect = (answer) => {
    const q = questions[currentQuestionIndex];
    if (q) {
      setUserAnswers(prev => ({ ...prev, [q.id]: answer }));
    }
  };

  const toggleFlag = () => {
    setFlaggedQuestions(prev => ({ ...prev, [currentQuestionIndex]: !prev[currentQuestionIndex] }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
    else setShowCheckWork(true);
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
  };

  const detectSection = () => {
    return currentModuleKey.startsWith('rw') ? 'Reading & Writing' : 'Math';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  
  const handleNextModule = () => {
    const threshold = courseInfo?.threshold_percentage || 60;
    
    // Calculate current module score - Exact match with student test
    const correctCount = questions.filter(q => {
      const ans = userAnswers[q.id];
      return ans && q.correctAnswer && ans.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
    }).length;
    const percentage = (correctCount / questions.length) * 100;

    // Store module score for final calculation
    setModuleScores(prev => ({
      ...prev,
      [currentModuleKey]: {
        correct: correctCount,
        total: questions.length,
        percentage: Math.round(percentage)
      }
    }));

    console.log(`📊 [DEMO] Module ${currentModuleKey} completed: ${correctCount}/${questions.length} (${Math.round(percentage)}%)`);

    let nextKey = '';
    
    // Apply exact same adaptive logic as student test
    if (currentModuleKey === 'rw_moderate') {
      nextKey = percentage >= threshold ? 'rw_hard' : 'rw_easy';
    } else if (currentModuleKey === 'rw_easy' || currentModuleKey === 'rw_hard') {
      nextKey = 'math_moderate';
    } else if (currentModuleKey === 'math_moderate') {
      nextKey = percentage >= threshold ? 'math_hard' : 'math_easy';
    }
    // After math_easy or math_hard, test is complete

    if (nextKey && modules[nextKey]) {
      console.log(`🔄 [DEMO] Transitioning to ${nextKey} (threshold: ${threshold}%, score: ${Math.round(percentage)}%)`);
      setCurrentModuleKey(nextKey);
      setModuleHistory(prev => [...prev, nextKey]);
      setQuestions(modules[nextKey]);
      setCurrentQuestionIndex(0);
      setFlaggedQuestions({});
      setShowCheckWork(false);
      startModuleTimer(modules[nextKey], nextKey);
      window.scrollTo(0, 0);
    } else {
      // Test complete - show lead form instead of results
      console.log(`🎯 [DEMO] Adaptive test completed. Module history:`, moduleHistory);
      setShowLeadForm(true);
    }
  };

  const handleLeadSubmit = async (formData) => {
    setIsSubmittingLead(true);
    
    console.log(`🎯 [DEMO] Calculating final Adaptive SAT Test scores...`);
    
    // Calculate scores using the exact same logic as student test
    let rwRaw = 0;
    let rwMax = 0;
    let mathRaw = 0;
    let mathMax = 0;

    const moduleDetails = {};
    const allModuleScores = { ...moduleScores };

    // Add current module if not already scored (in case of direct submission)
    if (!moduleScores[currentModuleKey]) {
      const correctCount = questions.filter(q => {
        const ans = userAnswers[q.id];
        return ans && q.correctAnswer && ans.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
      }).length;
      const percentage = (correctCount / questions.length) * 100;
      
      allModuleScores[currentModuleKey] = {
        correct: correctCount,
        total: questions.length,
        percentage: Math.round(percentage)
      };
    }

    // Calculate scores per module using the exact same weighted system as student test
    moduleHistory.forEach(mKey => {
      const mScore = allModuleScores[mKey];
      if (!mScore) return;
      
      const isRW = mKey.startsWith('rw');
      const diff = mKey.split('_')[1]; // moderate, easy, hard
      const weight = diff === 'hard' ? 3 : (diff === 'moderate' ? 2 : 1); // Same weights as student test
      
      let moduleCorrect = mScore.correct;
      
      if (isRW) {
        rwRaw += moduleCorrect * weight;
        rwMax += mScore.total * weight;
      } else {
        mathRaw += moduleCorrect * weight;
        mathMax += mScore.total * weight;
      }

      moduleDetails[mKey] = {
        correct: moduleCorrect,
        total: mScore.total,
        percentage: mScore.percentage,
        difficulty: diff.toUpperCase()
      };
    });

    // Determine the routing path and calculate maximum achievable scores
    const hasHardModules = moduleHistory.some(mKey => mKey.includes('hard'));
    const hasEasyModules = moduleHistory.some(mKey => mKey.includes('easy'));
    
    // Maximum scores based on routing path
    // Easy path (Moderate → Easy): max 1400 (700 RW + 700 Math)
    // Hard path (Moderate → Hard): max 1600 (800 RW + 800 Math)
    const maxSectionScore = hasHardModules ? 800 : 700;
    
    // Calculate section scores with proper maximum limits
    let rwScore, mathScore;
    
    if (hasHardModules) {
      // Hard path: Full 800 points per section available
      rwScore = rwMax > 0 ? Math.round((rwRaw / rwMax) * 800) : 0;
      mathScore = mathMax > 0 ? Math.round((mathRaw / mathMax) * 800) : 0;
    } else {
      // Easy path: Maximum 700 points per section
      rwScore = rwMax > 0 ? Math.round((rwRaw / rwMax) * 700) : 0;
      mathScore = mathMax > 0 ? Math.round((mathRaw / mathMax) * 700) : 0;
    }
    
    const totalScore = rwScore + mathScore;
    
    // Log scoring details for debugging
    console.log(`📊 [DEMO] Scoring Calculation:`, {
      routingPath: hasHardModules ? 'Hard (max 1600)' : 'Easy (max 1400)',
      maxSectionScore,
      rwScore,
      mathScore,
      totalScore,
      moduleHistory
    });

    // Calculate overall accuracy
    const totalCorrect = Object.values(allModuleScores).reduce((sum, score) => sum + score.correct, 0);
    const totalQuestions = Object.values(allModuleScores).reduce((sum, score) => sum + score.total, 0);
    const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    console.log(`📊 [DEMO] Final Adaptive SAT Test Scores:`, {
      rwScore,
      mathScore,
      totalScore,
      overallAccuracy,
      moduleDetails,
      moduleHistory
    });

    const scoreDetails = {
      allLevels: {
        rw_moderate: allModuleScores.rw_moderate || null,
        rw_easy: allModuleScores.rw_easy || null,
        rw_hard: allModuleScores.rw_hard || null,
        math_moderate: allModuleScores.math_moderate || null,
        math_easy: allModuleScores.math_easy || null,
        math_hard: allModuleScores.math_hard || null
      },
      comprehensive: {
        finalPredictedScore: totalScore,
        rwScore,
        mathScore,
        overallAccuracy,
        totalCorrect,
        totalQuestions,
        moduleDetails,
        moduleHistory,
        routingPath: hasHardModules ? 'hard' : 'easy',
        maxAchievableScore: hasHardModules ? 1600 : 1400,
        maxSectionScore
      },
      // Add metadata to indicate this is an Adaptive SAT Test score with exact scoring logic
      isAdaptiveSAT: (courseInfo?.is_adaptive || courseInfo?.category?.toLowerCase()?.includes('adaptive')) && 
                     (courseInfo?.category?.toLowerCase()?.includes('sat') || courseInfo?.name?.toLowerCase()?.includes('sat')),
      scoringMethod: 'weighted_adaptive_routing', // Updated to reflect routing-based scoring
      routingPath: hasHardModules ? 'hard' : 'easy',
      maxAchievableScore: hasHardModules ? 1600 : 1400
    };

    try {
      console.log('🚀 [DEMO] Submitting lead with data:', {
        courseId,
        level: 'Adaptive SAT Test',
        formData: { ...formData, phone: formData.phone ? formData.phone.substring(0, 10) + '...' : 'missing' },
        scoreDetails: {
          hasScoreDetails: !!scoreDetails,
          hasAllLevels: !!scoreDetails?.allLevels,
          hasComprehensive: !!scoreDetails?.comprehensive,
          totalScore: scoreDetails?.comprehensive?.finalPredictedScore || 0
        }
      });

      const response = await axios.post('/api/demo/submit-lead', {
        courseId,
        level: 'Adaptive SAT Test', // Override level since we use adaptive flow
        ...formData,
        scoreDetails
      });

      console.log('✅ [DEMO] Lead submission successful:', response.data);

      // Update local progress to mark test as completed
      try {
        const savedProgress = JSON.parse(localStorage.getItem(`demo_progress_${courseId}`) || '{}');
        savedProgress.testCompleted = true;
        savedProgress.finalScores = {
          totalScore,
          rwScore,
          mathScore,
          overallAccuracy,
          completedAt: new Date().toISOString()
        };
        localStorage.setItem(`demo_progress_${courseId}`, JSON.stringify(savedProgress));
      } catch (e) {
        console.warn("Could not save progress to localStorage:", e);
      }

      // Return to demo dashboard
      navigate(`/demo/${courseId}`);
    } catch (err) {
      console.error("❌ [DEMO] Failed to submit lead:", err);
      console.error("❌ [DEMO] Error response:", err?.response?.data);
      console.error("❌ [DEMO] Error status:", err?.response?.status);
      
      // Create a more descriptive error message
      const errorMessage = err?.response?.data?.error || 
                          err?.message || 
                          'Failed to submit. Please check your connection and try again.';
      
      throw new Error(errorMessage);
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
  if (error) return <div className="h-screen flex items-center justify-center p-8 text-red-600 font-bold">{error}</div>;

  if (showLeadForm) {
    return (
      <DemoLeadForm 
        isOpen={showLeadForm} 
        onClose={() => setShowLeadForm(false)} 
        onSubmit={handleLeadSubmit}
        courseName={courseInfo?.name}
        level="Adaptive SAT Test"
      />
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestion?.id] || '';

  // Review Screen - Exact match with student test
  if (showCheckWork) {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#F1F5F9] flex flex-col font-sans select-none text-black overflow-hidden take-quiz-force-white px-0">
        <header className="bg-[#0f172a] px-10 h-[60px] flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-white">
              {detectSection()} - Module {moduleHistory.length % 2 === 1 ? '1' : '2'}
            </h2>
            <span className="text-[11px] text-gray-400 font-semibold">Review Section</span>
          </div>
          <div className="flex flex-col items-center mt-1">
            <div className="timer-text">{formatTime(timeLeft)}</div>
            <span className="text-[9px] font-bold text-gray-400 tracking-widest cursor-pointer hover:text-white">HIDE</span>
          </div>
          <div className="w-[100px]"></div>
        </header>

        <main className="flex-1 overflow-y-auto p-12 bg-white">
          <div className="max-w-4xl mx-auto w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
            <div className="p-10 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Section Review</h2>
              <p className="text-slate-500 font-medium">Review your work before you finish this section. You can click any question number to return to it.</p>
            </div>

            <div className="p-10">
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-4">
                {questions.map((q, idx) => {
                  const isAnswered = !!userAnswers[q.id];
                  const isFlagged = flaggedQuestions[idx];
                  return (
                    <button 
                      key={idx} 
                      onClick={() => { setShowCheckWork(false); setCurrentQuestionIndex(idx); }}
                      className={`aspect-square w-full rounded-xl relative flex items-center justify-center font-bold text-xl transition-all border-2 ${isAnswered ? 'bg-[#2E4DC6] border-[#2E4DC6] text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'}`}
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

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <div className="w-3.5 h-3.5 rounded bg-[#2E4DC6]"></div> Answered
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <div className="w-3.5 h-3.5 rounded border-2 border-slate-200"></div> Unanswered
                </div>
              </div>
              
              <div className="flex gap-4">
                  <button onClick={() => setShowCheckWork(false)} className="px-8 py-3.5 bg-white text-slate-900 border-2 border-slate-200 rounded-full font-black text-[15px] hover:bg-slate-50 transition-all flex items-center gap-3">
                    <SafeIcon icon={FiChevronLeft} /> Back to Questions
                  </button>
                  <button onClick={handleNextModule} className="px-10 py-3.5 bg-blue-600 text-white rounded-full font-black text-[15px] hover:bg-blue-700 transition-all flex items-center gap-3 shadow-xl">
                    {moduleHistory.length < 4 ? 'Next Module' : 'Submit Test'} <SafeIcon icon={FiChevronRight} />
                  </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Active Exam UI - Exact match with student test
  return (
    <div className="fixed inset-0 z-[999999] bg-white flex flex-col font-sans select-none text-black overflow-hidden take-quiz-force-white px-0">
      <style>{`
        .take-quiz-force-white header { background: #0f172a !important; color: white !important; min-height: 60px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 16px !important; position: relative !important; z-index: 10000 !important; }
        @media (min-width: 640px) { .take-quiz-force-white header { padding: 0 40px !important; } }
        .take-quiz-force-white footer { background: #ffffff !important; border-top: 1px solid #e2e8f0 !important; min-height: 70px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 16px !important; position: relative !important; z-index: 10000 !important; }
        @media (min-width: 640px) { .take-quiz-force-white footer { padding: 0 40px !important; min-height: 60px !important; } }
        .timer-text { color: #ffffff !important; font-weight: 800 !important; font-size: 16px !important; }
        @media (min-width: 640px) { .timer-text { font-size: 18px !important; } }
        .practice-banner { background: #1e1b4b !important; color: white !important; text-align: center !important; padding: 4px 0 !important; font-size: 10px !important; font-weight: 800 !important; letter-spacing: 0.1em !important; position: relative !important; z-index: 9000 !important; }
      `}</style>

      <header>
        <div className="flex flex-col">
          <h2 className="text-[15px] font-bold text-white">
              {detectSection()} - Module {moduleHistory.length % 2 === 1 ? '1' : '2'}: {currentModuleKey.split('_')[1].toUpperCase()}
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
                       onClick={() => { setShowMoreMenu(false); navigate(`/demo/${courseId}`); }} 
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

      <div className="practice-banner">THIS IS A PRACTICE TEST</div>
      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden pt-4 bg-white relative z-10">
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-12 bg-white border-b-[6px] md:border-b-0 md:border-r-[10px] border-[#0f172a]">
          <div className="prose prose-slate max-w-none leading-[1.6] text-[16px] sm:text-[18px] text-slate-900 font-medium tracking-tight antialiased">
            {/* Extract and display images separately */}
            {(() => {
              const questionText = currentQuestion?.text || '';
              const images = extractImagesFromText(questionText);
              const cleanText = getCleanTextWithoutImages(questionText);
              
              return (
                <>
                  {/* Display images first */}
                  {images.length > 0 && (
                    <div className="mb-6 space-y-4">
                      {images.map((imgUrl, idx) => (
                        <div key={idx} className="flex justify-center">
                          <img 
                            src={imgUrl} 
                            alt={`Question image ${idx + 1}`} 
                            className="max-w-full h-auto rounded-lg shadow-sm border border-slate-200"
                            onError={(e) => {
                              console.warn('Failed to load image:', imgUrl);
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Display clean text without image tags */}
                  <MathRenderer text={cleanText} />
                </>
              );
            })()}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-12 bg-white relative z-20">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-4">
               <div className="bg-black text-white w-8 h-8 flex items-center justify-center font-bold rounded-lg">{currentQuestionIndex + 1}</div>
               <button onClick={toggleFlag} className={`flex items-center gap-2 text-sm font-bold border-b-2 border-dashed ${flaggedQuestions[currentQuestionIndex] ? 'text-black border-black' : 'text-gray-800 border-gray-400'}`}>
                  <SafeIcon icon={FiStar} className={flaggedQuestions[currentQuestionIndex] ? 'fill-current' : ''} /> Mark for Review
               </button>
             </div>
          </div>

          <div className="space-y-4 relative z-30">
              {(currentQuestion?.type === 'short_answer' || !currentQuestion?.options || currentQuestion.options.filter(o => o && o.toString().trim() !== '').length < 4) ? (
                  <div className="w-full flex flex-col mt-4">
                      <p className="text-[15px] font-bold text-slate-500 mb-4 uppercase tracking-wider">Student-Produced Response</p>
                      <div className="relative w-full max-w-[180px] transition-all mb-12">
                          <input 
                            type="text" 
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-4 py-3 font-bold text-lg text-left focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-50 text-slate-900 placeholder:text-slate-400 transition-all shadow-sm" 
                            value={selectedAnswer} 
                            placeholder="Type response"
                            onChange={(e) => handleAnswerSelect(e.target.value)} 
                          />
                      </div>
                  </div>
              ) : (
                  currentQuestion.options.map((optContent, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isSelected = selectedAnswer === letter;
                    
                    // Extract images from option content
                    const optionImages = extractImagesFromText(optContent);
                    const cleanOptionText = getCleanTextWithoutImages(optContent);
                    
                    return (
                      <div key={letter} className="flex gap-4 group relative z-40">
                         <button
                            type="button"
                            onClick={() => handleAnswerSelect(letter)}
                            className={`w-[44px] h-[44px] rounded-full flex items-center justify-center font-bold shrink-0 transition-colors cursor-pointer pointer-events-auto relative z-50 ${isSelected ? 'border-2 border-blue-600 text-blue-600 bg-white ring-4 ring-blue-50 shadow-sm' : 'border border-slate-200 text-slate-400 bg-white group-hover:border-slate-300'}`}
                         >
                            {letter}
                         </button>
                         <div 
                            role="button"
                            onClick={() => handleAnswerSelect(letter)}
                            className={`flex-1 rounded-2xl p-5 min-h-[60px] cursor-pointer pointer-events-auto transition-all flex flex-col justify-center relative z-50 ${isSelected ? 'border-2 border-blue-600 bg-blue-50/5 shadow-sm' : 'border border-slate-200 bg-white group-hover:border-slate-300 shadow-sm'}`}
                         >
                            {/* Display option images if any */}
                            {optionImages.length > 0 && (
                              <div className="mb-3 space-y-2">
                                {optionImages.map((imgUrl, imgIdx) => (
                                  <div key={imgIdx} className="flex justify-center">
                                    <img 
                                      src={imgUrl} 
                                      alt={`Option ${letter} image ${imgIdx + 1}`} 
                                      className="max-w-full h-auto rounded-lg shadow-sm border border-slate-200"
                                      onError={(e) => {
                                        console.warn('Failed to load option image:', imgUrl);
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Display clean option text */}
                            <div className="pointer-events-none"><MathRenderer text={cleanOptionText} className="text-[17px] text-slate-800 font-normal leading-normal antialiased" /></div>
                         </div>
                      </div>
                    );
                  })
              )}
          </div>
        </div>
      </main>

      <footer>
        <div className="text-[10px] sm:text-sm font-bold flex-1 text-slate-900 truncate max-w-[80px] sm:max-w-none">Demo User</div>
        <div className="relative flex justify-center shrink-0 mx-2">
          <button onClick={() => setShowNavigation(!showNavigation)} className="bg-black text-white px-3 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline">Question </span>{currentQuestionIndex + 1}<span className="sm:hidden"> / </span><span className="hidden sm:inline"> of </span>{questions.length}
              <SafeIcon icon={showNavigation ? FiX : FiChevronDown} className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
          </button>
          <AnimatePresence>
          {showNavigation && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed bottom-[80px] sm:bottom-[130px] bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-[0_0_40px_-10px_rgba(0,0,0,0.15)] z-[1000] w-[90vw] sm:w-[420px] left-1/2 -translate-x-1/2 flex flex-col items-center max-h-[70vh] overflow-y-auto">
               <div className="hidden sm:block absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-slate-200 rotate-45"></div>
               <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 w-full relative">
                  <span className="font-bold text-sm text-slate-900 w-full text-center">
                      {detectSection()} - Module {moduleHistory.length % 2 === 1 ? '1' : '2'} Questions
                  </span>
                  <SafeIcon icon={FiX} onClick={() => setShowNavigation(false)} className="cursor-pointer text-gray-400 absolute right-0 top-0" />
               </div>
               <div className="flex flex-wrap gap-2 mb-8 justify-center">
                   {questions.map((q, idx) => (
                       <div key={idx} onClick={() => { setCurrentQuestionIndex(idx); setShowNavigation(false); }} className={`w-[34px] h-[34px] flex items-center justify-center font-black rounded-sm cursor-pointer transition-all text-sm border ${userAnswers[q.id] ? 'text-blue-600 border-blue-600 bg-blue-50' : 'text-blue-600 border-blue-600 border-dashed bg-white'}`}>
                           {idx + 1}
                       </div>
                   ))}
               </div>
               <button onClick={() => { setShowNavigation(false); setShowCheckWork(true); }} className="px-5 py-1.5 rounded-full border border-blue-600 text-blue-600 font-bold text-sm hover:bg-blue-50 transition-all">Go to Review Page</button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-3 sm:gap-8 flex-1 justify-end">
          <button onClick={handleBack} disabled={currentQuestionIndex === 0} className="font-bold text-xs sm:text-sm text-blue-600 disabled:opacity-30 hover:underline">Back</button>
          <button onClick={handleNext} className="px-4 sm:px-8 py-2 sm:py-2.5 bg-blue-600 text-white rounded-full font-bold text-xs sm:text-sm hover:bg-blue-700 transition-colors shadow-sm">
            {currentQuestionIndex === questions.length - 1 ? 'Review' : 'Next'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PublicDemoQuizInterface;
