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
  FiFlag, FiStar, FiLogOut, FiChevronDown, FiAlertCircle
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
  const [showLeadForm, setShowLeadForm] = useState(true);
  const [leadDetails, setLeadDetails] = useState(null);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  
  // Break & Security State
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(600);
  const [securityViolations, setSecurityViolations] = useState([]);
  const [showSecurityAlert, setShowSecurityAlert] = useState(false);

  // Time Tracking State
  const [questionTimes, setQuestionTimes] = useState({}); // { qId: totalSeconds }
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [moduleDurations, setModuleDurations] = useState({}); // { moduleKey: totalSeconds }
  const [moduleStartTime, setModuleStartTime] = useState(Date.now());
  
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
    if (isBreakActive) {
      if (breakTimeLeft > 0) {
        const timer = setInterval(() => setBreakTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
      } else {
        handleEndBreak();
      }
    } else if (timeLeft > 0 && !showResults && !showCheckWork && !showLeadForm) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && questions.length > 0 && !showResults && !showCheckWork) {
      setShowCheckWork(true);
    }
  }, [timeLeft, showResults, showCheckWork, questions.length, isBreakActive, breakTimeLeft, showLeadForm]);

  // 2.1 Security/Proctoring Effect
  useEffect(() => {
    if (showResults) return;

    const handleSecurityEvent = (type) => {
      console.warn(`🛡️ [SECURITY] Focus lost: ${type} at ${new Date().toLocaleTimeString()}`);
      setSecurityViolations(prev => [...prev, { type, timestamp: new Date().toISOString(), questionIndex: currentQuestionIndex }]);
      setShowSecurityAlert(true);
      setTimeout(() => setShowSecurityAlert(false), 3000);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleSecurityEvent('tab_switch');
    };

    const onBlur = () => handleSecurityEvent('window_blur');

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [showResults, currentQuestionIndex]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Load Course Info
      const courseRes = await courseService.getById(courseId);
      if (!courseRes.data) throw new Error("Course not found");
      setCourseInfo(courseRes.data);

      // Verify this is a demo FULL LENGTH TEST course
      if (!courseRes.data?.is_demo) throw new Error("Course not available in demo mode.");
      if (!courseRes.data.is_adaptive || courseRes.data.category !== 'Full-Length SAT') {
        throw new Error("This demo interface is only for FULL LENGTH TESTs.");
      }

      console.log(`🔒 [DEMO] Loading Full-Length FULL LENGTH TEST content for course ${courseId}`);

      // 2. Identify the LATEST upload for each of the 6 module slots
      // Using the 'uploads' table metadata which is more reliable than question-level metadata
      const { data: uploadData, error: uploadErr } = await supabase
        .from('uploads')
        .select('id, level, section, file_name')
        .eq('course_id', courseId)
        .eq('category', 'quiz_document')
        .in('status', ['completed', 'warning'])
        .order('id', { ascending: false });

      if (uploadErr) throw uploadErr;
      if (!uploadData || uploadData.length === 0) throw new Error("No quiz documents found for this test.");

      // 3. Map uploads to slots
      const slotLatestUploadId = {};
      const slotToFileName = {};

      uploadData.forEach(upload => {
        const rawSec = (upload.section || '').toLowerCase();
        const rawLvl = (upload.level || '').toLowerCase();
        
        let secKey = '';
        if (rawSec.includes('read') || rawSec.includes('writ') || rawSec.includes('rw')) secKey = 'rw';
        else if (rawSec.includes('math')) secKey = 'math';
        // Fallback to filename if section is missing
        else if (upload.file_name?.toLowerCase().includes('reading') || upload.file_name?.toLowerCase().includes('writing')) secKey = 'rw';
        else if (upload.file_name?.toLowerCase().includes('math')) secKey = 'math';

        let lvlKey = '';
        if (rawLvl.includes('mod') || rawLvl.includes('med')) lvlKey = 'moderate';
        else if (rawLvl.includes('easy')) lvlKey = 'easy';
        else if (rawLvl.includes('hard')) lvlKey = 'hard';
        // Fallback to filename if level is missing
        else if (upload.file_name?.toLowerCase().includes('moderate') || upload.file_name?.toLowerCase().includes('medium')) lvlKey = 'moderate';
        else if (upload.file_name?.toLowerCase().includes('easy')) lvlKey = 'easy';
        else if (upload.file_name?.toLowerCase().includes('hard')) lvlKey = 'hard';

        if (secKey && lvlKey) {
          const slotKey = `${secKey}_${lvlKey}`;
          // Since we ordered by ID DESC, the first one we find is the latest
          if (!slotLatestUploadId[slotKey]) {
            slotLatestUploadId[slotKey] = upload.id;
            slotToFileName[slotKey] = upload.file_name;
          }
        }
      });

      const latestUploadIds = Object.values(slotLatestUploadId);
      if (latestUploadIds.length === 0) throw new Error("No valid module uploads identified.");

      console.log(`📚 [DEMO] Identified latest uploads:`, slotToFileName);

      // 4. Fetch questions ONLY for these specific upload IDs
      const { data: qData, error: qError } = await supabase
        .from('questions')
        .select('*')
        .in('upload_id', latestUploadIds);

      if (qError) throw qError;
      if (!qData || qData.length === 0) throw new Error("No questions found in the identified uploads.");

      // 5. Final Grouping
      const grouped = {
        rw_moderate: [], rw_easy: [], rw_hard: [],
        math_moderate: [], math_easy: [], math_hard: []
      };

      // Map upload_id back to slotKey for fast grouping
      const uploadIdToSlot = {};
      Object.entries(slotLatestUploadId).forEach(([slot, id]) => {
        uploadIdToSlot[id] = slot;
      });

      qData.forEach(q => {
        const slotKey = uploadIdToSlot[q.upload_id];
        if (slotKey) {
          grouped[slotKey].push({
            ...q,
            text: q.question || q.question_text || '',
            options: q.options || [],
            correctAnswer: q.correct_answer || ''
          });
        }
      });

      console.log(`✅ [DEMO] Loaded modules:`, Object.keys(grouped).map(key => `${key}: ${grouped[key].length} questions`));

      setModules(grouped);
      
      // Start with rw_moderate
      const firstModule = grouped['rw_moderate'];
      if (!firstModule || firstModule.length === 0) {
        throw new Error("Reading & Writing Moderate module is missing or has no questions.");
      }
      
      setQuestions(firstModule);
      startModuleTimer(firstModule, 'rw_moderate');
      setModuleStartTime(Date.now());
      setQuestionStartTime(Date.now());
      console.log(`🚀 [DEMO] Starting test with ${firstModule.length} questions`);
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

  const recordTime = () => {
    const now = Date.now();
    const diff = Math.floor((now - questionStartTime) / 1000);
    const qId = questions[currentQuestionIndex]?.id;
    if (qId) {
      setQuestionTimes(prev => ({
        ...prev,
        [qId]: (prev[qId] || 0) + diff
      }));
    }
    setQuestionStartTime(now);
  };

  const handleNext = () => {
    recordTime();
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
    else setShowCheckWork(true);
  };

  const handleBack = () => {
    recordTime();
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
  };

  const detectSection = () => {
    return currentModuleKey.startsWith('rw') ? 'Reading & Writing' : 'Math';
  };

  const getHeaderTitle = () => {
    const section = detectSection();
    const difficulty = currentModuleKey.split('_')[1];
    if (difficulty === 'moderate') return `${section} - Part 1`;
    if (difficulty === 'easy') return `${section} - E`;
    if (difficulty === 'hard') return `${section} - H`;
    return `${section} - ${difficulty ? difficulty.toUpperCase() : ''}`;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  
  const handleNextModule = () => {
    recordTime();

    // Record Module Duration
    const mDuration = Math.floor((Date.now() - moduleStartTime) / 1000);
    setModuleDurations(prev => ({
      ...prev,
      [currentModuleKey]: mDuration
    }));

    const threshold = courseInfo?.threshold_percentage || 60;
    
    // Calculate current module score - Exact match with student test
    const correctCount = questions.filter(q => {
      const ans = userAnswers[q.id];
      return ans && q.correctAnswer && ans.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
    }).length;
    const percentage = (correctCount / questions.length) * 100;

    // Aggregate topic stats
    const topicStats = {};
    questions.forEach(q => {
      const isCorrect = userAnswers[q.id] && q.correctAnswer && userAnswers[q.id].toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
      const topic = q.topic || 'General';
      if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
      topicStats[topic].total++;
      if (isCorrect) topicStats[topic].correct++;
    });

    // Store module score for final calculation
    setModuleScores(prev => ({
      ...prev,
      [currentModuleKey]: {
        correct: correctCount,
        total: questions.length,
        percentage: Math.round(percentage),
        topics: topicStats
      }
    }));

    console.log(`📊 [DEMO] Module ${currentModuleKey} completed: ${correctCount}/${questions.length} (${Math.round(percentage)}%)`);

    let nextKey = '';
    
    // Apply exact same adaptive logic as student test
    if (currentModuleKey === 'rw_moderate') {
      nextKey = percentage >= threshold ? 'rw_hard' : 'rw_easy';
    } else if (currentModuleKey === 'rw_easy' || currentModuleKey === 'rw_hard') {
      // Start 10-minute break
      setIsBreakActive(true);
      setBreakTimeLeft(600);
      setShowCheckWork(false); // Close review screen
      return;
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
      setModuleStartTime(Date.now());
      setQuestionStartTime(Date.now());
      window.scrollTo(0, 0);
    } else {
      // Test complete - automatically submit score report using already verified lead details!
      console.log(`🎯 [DEMO] FULL LENGTH TEST completed. Module history:`, moduleHistory);
      const savedLead = leadDetails || JSON.parse(localStorage.getItem(`demo_lead_${courseId}`) || '{}');
      if (savedLead && savedLead.email) {
        handleFinalScoreSubmit(savedLead);
      } else {
        // Fallback: If for some reason we don't have lead details, open the form
        setShowLeadForm(true);
      }
    }
  };

  const handleEndBreak = () => {
    setIsBreakActive(false);
    const nextKey = 'math_moderate';
    if (modules[nextKey]) {
      setCurrentModuleKey(nextKey);
      setModuleHistory(prev => [...prev, nextKey]);
      setQuestions(modules[nextKey]);
      setCurrentQuestionIndex(0);
      setFlaggedQuestions({});
      setShowCheckWork(false);
      startModuleTimer(modules[nextKey], nextKey);
      setModuleStartTime(Date.now());
      setQuestionStartTime(Date.now());
      window.scrollTo(0, 0);
    }
  };

  const handleLeadSubmit = async (formData) => {
    setIsSubmittingLead(true);
    try {
      console.log('🚀 [DEMO] Initial lead submission with details:', formData);
      const response = await axios.post('/api/demo/submit-lead', {
        courseId,
        level: 'Lead Captured',
        ...formData
      });
      console.log('✅ [DEMO] Initial lead submission successful:', response.data);
      
      setLeadDetails(formData);
      localStorage.setItem(`demo_lead_${courseId}`, JSON.stringify(formData));
      
      // Close the lead form modal and start/resume the actual test timer!
      setShowLeadForm(false);
      
      // Reset module & question start times to give the student the full duration
      setModuleStartTime(Date.now());
      setQuestionStartTime(Date.now());
    } catch (err) {
      console.error("❌ [DEMO] Failed to submit initial lead:", err);
      throw new Error(err?.response?.data?.error || err?.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const handleFinalScoreSubmit = async (formData) => {
    setIsSubmittingLead(true);
    
    console.log(`🎯 [DEMO] Calculating final FULL LENGTH TEST scores...`);
    
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
      
      // Aggregate topic stats
      const topicStats = {};
      questions.forEach(q => {
        const isCorrect = userAnswers[q.id] && q.correctAnswer && userAnswers[q.id].toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
        const topic = q.topic || 'General';
        if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
        topicStats[topic].total++;
        if (isCorrect) topicStats[topic].correct++;
      });

      allModuleScores[currentModuleKey] = {
        correct: correctCount,
        total: questions.length,
        percentage: Math.round(percentage),
        topics: topicStats
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
    
    // 2. Adaptive Flow Bounds (Min 200)
    // Hard path: 200 - 800 (Scale: 600)
    // Easy path: 200 - 700 (Scale: 500)
    const maxSectionScore = hasHardModules ? 800 : 700;
    const rwSectionScale = hasHardModules ? 600 : 500;
    const mathSectionScale = hasHardModules ? 600 : 500;
    
    // Calculate section scores with proper bounds (minimum 200)
    let rwScore, mathScore;
    
    rwScore = rwMax > 0 ? Math.round(200 + (rwRaw / rwMax) * rwSectionScale) : 200;
    mathScore = mathMax > 0 ? Math.round(200 + (mathRaw / mathMax) * mathSectionScale) : 200;
    
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

    console.log(`📊 [DEMO] Final FULL LENGTH TEST Scores:`, {
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
      // Add metadata to indicate this is an FULL LENGTH TEST score with exact scoring logic
      isAdaptiveSAT: (courseInfo?.is_adaptive || courseInfo?.category?.toLowerCase()?.includes('adaptive')) && 
                     (courseInfo?.category?.toLowerCase()?.includes('sat') || courseInfo?.name?.toLowerCase()?.includes('sat')),
      scoringMethod: 'weighted_adaptive_routing', // Updated to reflect routing-based scoring
      routingPath: hasHardModules ? 'hard' : 'easy',
      maxAchievableScore: hasHardModules ? 1600 : 1400
    };

    try {
      console.log('🚀 [DEMO] Submitting final scores with data:', {
        courseId,
        level: 'FULL LENGTH TEST',
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
        level: 'FULL LENGTH TEST', // Override level since we use adaptive flow
        ...formData,
        scoreDetails,
        securityViolations // Track violations in lead too
      });

      console.log('✅ [DEMO] Final score submission successful:', response.data);

      // Update local progress to mark test as completed
      try {
        const savedProgress = JSON.parse(localStorage.getItem(`demo_progress_${courseId}`) || '{}');
        savedProgress.testCompleted = true;
        savedProgress.studentName = formData.fullName || 'Demo Student';
        savedProgress.finalScores = {
          totalScore,
          rwScore,
          mathScore,
          overallAccuracy,
          moduleDetails: allModuleScores,
          completedAt: new Date().toISOString()
        };
        savedProgress.moduleHistory = moduleHistory;
        // Save per-module question data (answers + time) for Answer Summary & Time Analysis pages
        savedProgress.moduleAnswers = {};
        moduleHistory.forEach(mKey => {
          const mQuestions = modules[mKey] || [];
          savedProgress.moduleAnswers[mKey] = mQuestions.map(q => ({
            id: q.id,
            questionNumber: q.questionNumber || q.order,
            correctAnswer: q.correctAnswer,
            userAnswer: userAnswers[q.id] || null,
            topic: q.topic || 'General',
            isCorrect: userAnswers[q.id] && q.correctAnswer &&
              userAnswers[q.id].toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase(),
            timeSpent: questionTimes[q.id] || 0
          }));
        });
        // Save time tracking data
        savedProgress.questionTimes = questionTimes;
        savedProgress.moduleDurations = moduleDurations;
        localStorage.setItem(`demo_progress_${courseId}`, JSON.stringify(savedProgress));
      } catch (e) {
        console.warn("Could not save progress to localStorage:", e);
      }

      // Navigate to full report page
      navigate(`/demo/${courseId}/report`);
    } catch (err) {
      console.error("❌ [DEMO] Failed to submit final scores:", err);
      console.error("❌ [DEMO] Error response:", err?.response?.data);
      
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
        onClose={() => navigate(`/demo/${courseId}`)} 
        onSubmit={handleLeadSubmit}
        courseName={courseInfo?.name}
        level="FULL LENGTH TEST"
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
              {getHeaderTitle()}
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

  // Break Screen UI - Match student test
  if (isBreakActive) {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#1a1a1a] flex flex-col font-sans text-white overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-12 sm:gap-20">
          
          <div className="flex flex-col items-center space-y-8">
            <div className="p-10 rounded-[32px] border-2 border-white/10 bg-white/5 backdrop-blur-xl flex flex-col items-center min-w-[280px]">
              <p className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Remaining Break Time:</p>
              <div className="text-8xl font-black tracking-tighter text-white">
                {formatTime(breakTimeLeft)}
              </div>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEndBreak}
              className="px-10 py-4 bg-[#FFD700] text-black rounded-full font-black text-lg hover:bg-[#FFC700] transition-all shadow-2xl shadow-yellow-500/20"
            >
              Resume Testing
            </motion.button>
          </div>

          <div className="max-w-xl space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-black tracking-tight text-white">Practice Test Break</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                You can resume this practice test as soon as you're ready to move on. On test day, you'll wait until the clock counts down. Read below to see how breaks work on test day.
              </p>
            </div>

            <div className="h-px bg-white/10 w-full" />

            <div className="space-y-6">
              <h3 className="text-2xl font-black text-[#FFD700]">Take a Break: Do Not Close Your Device</h3>
              <p className="text-gray-400">After the break, a <span className="text-white font-bold">Resume Testing Now</span> button will appear and you'll start the next section.</p>
              
              <div className="space-y-4">
                <p className="text-sm font-black uppercase tracking-widest text-gray-500">Follow these rules during the break:</p>
                <ul className="space-y-3 text-gray-300 font-medium">
                  {[
                    "Do not disturb students who are still testing.",
                    "Do not exit the app or close your laptop.",
                    "Do not access phones, smartwatches, textbooks, notes, or the internet.",
                    "Do not eat or drink near any testing device.",
                    "Do not speak in the testing room; outside the room, do not discuss the exam with anyone."
                  ].map((rule, idx) => (
                    <li key={idx} className="flex gap-4 items-start">
                      <span className="text-gray-500 font-black">{idx + 1}.</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-8 border-t border-white/5">
          <p className="text-gray-500 font-bold text-lg">Demo User</p>
        </div>
      </div>
    );
  }

  // Active Exam UI - Exact match with student test
  return (
    <div className="fixed inset-0 z-[999999] bg-white flex flex-col font-sans select-none text-black overflow-hidden take-quiz-force-white px-0">
      <AnimatePresence>
        {showSecurityAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000000] bg-red-600 text-white px-6 py-3 rounded-full font-black text-sm shadow-2xl flex items-center gap-3 border-2 border-white/20"
          >
            <SafeIcon icon={FiAlertCircle} /> SECURITY ALERT: Window focus lost. This event has been tracked.
          </motion.div>
        )}
      </AnimatePresence>
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
              {getHeaderTitle()}
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
                <MathRenderer text={currentQuestion?.text || ''} courseId={courseId} />
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
                            <div className="pointer-events-none">
                              <MathRenderer text={optContent} courseId={courseId} className="text-[17px] text-slate-800 font-normal leading-normal antialiased" />
                            </div>
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
