import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { courseService, gradingService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import AdaptiveResultsDashboard from '../common/AdaptiveResultsDashboard';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const {
  FiChevronLeft, FiChevronRight, FiClock, FiGrid, FiMoreVertical, FiEdit3, FiInfo, FiChevronDown, FiStar, FiSlash, FiX, FiMapPin, FiFlag, FiLogOut, FiTrash2, FiType, FiFilePlus, FiTarget, FiCheckCircle, FiRefreshCw, FiAlertCircle, FiActivity, FiPieChart, FiBarChart2, FiEye, FiAward
} = FiIcons;

const AdaptiveExamInterface = () => {
  const { courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Core State
  const [modules, setModules] = useState({}); // { rw_moderate: [], rw_easy: [], ... }
  const [currentModuleKey, setCurrentModuleKey] = useState('rw_moderate');
  const [moduleHistory, setModuleHistory] = useState(['rw_moderate']);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { qId: answer }
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  
  // UI State
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
  
  // Break & Security State
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(600);
  const [securityViolations, setSecurityViolations] = useState([]);
  const [showSecurityAlert, setShowSecurityAlert] = useState(false);
  
  // Scoring State
  const [totalScore, setTotalScore] = useState(0);
  const [rwScore, setRwScore] = useState(0);
  const [mathScore, setMathScore] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [moduleDetails, setModuleDetails] = useState({});
  
  const [resultsView, setResultsView] = useState('summary'); // 'summary' or 'review'
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all', 'correct', 'incorrect', 'unanswered'
  const [allTestQuestions, setAllTestQuestions] = useState([]);
  
  // Time Tracking State
  const [questionTimes, setQuestionTimes] = useState({}); // { qId: totalSeconds }
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [moduleDurations, setModuleDurations] = useState({}); // { moduleKey: totalSeconds }
  const [moduleStartTime, setModuleStartTime] = useState(Date.now());

  const wasDarkMode = useRef(false);

  // 1. Initial Setup: Load Course and Questions
  useEffect(() => {
    wasDarkMode.current = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    if (showResults && wasDarkMode.current) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else if (!showResults) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    
    if (courseId) {
      loadInitialData();
    }

    return () => {
      if (wasDarkMode.current) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
    };
  }, [courseId, showResults]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Load Course Info
      const courseRes = await courseService.getById(courseId);
      if (!courseRes.data) throw new Error("Course not found");
      setCourseInfo(courseRes.data);

      console.log(`🔒 [EXAM] Loading Full-Length FULL LENGTH TEST content for course ${courseId}`);

      // 2. Identify the LATEST upload for each of the 6 module slots
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
          if (!slotLatestUploadId[slotKey]) {
            slotLatestUploadId[slotKey] = upload.id;
            slotToFileName[slotKey] = upload.file_name;
          }
        }
      });

      const latestUploadIds = Object.values(slotLatestUploadId);
      if (latestUploadIds.length === 0) throw new Error("No valid module uploads identified.");

      console.log(`📚 [EXAM] Identified latest uploads:`, slotToFileName);

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

      console.log(`✅ [EXAM] Loaded modules:`, Object.keys(grouped).map(key => `${key}: ${grouped[key].length} questions`));

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
      console.log(`🚀 [EXAM] Starting test with ${firstModule.length} questions`);
    } catch (err) {
      console.error(`❌ [EXAM] Error loading content:`, err);
      setError(err.message || "Failed to load exam content.");
    } finally {
      setLoading(false);
    }
  };

  const startModuleTimer = (moduleQuestions, key) => {
    const isMath = key.startsWith('math');
    // SAT Timing: R&W ~71s/q, Math ~95s/q
    const rate = isMath ? 95 : 71;
    const duration = moduleQuestions.length * rate;
    setTotalTime(duration);
    setTimeLeft(duration);
  };

  // 2. Timer Effect
  useEffect(() => {
    if (isBreakActive) {
      if (breakTimeLeft > 0) {
        const timer = setInterval(() => setBreakTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
      } else {
        handleEndBreak();
      }
    } else if (timeLeft > 0 && !showResults && !showCheckWork) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && questions.length > 0 && !showResults && !showCheckWork) {
      setShowCheckWork(true);
    }
  }, [timeLeft, showResults, showCheckWork, questions.length, isBreakActive, breakTimeLeft]);

  // 2.1 Security/Proctoring Effect
  useEffect(() => {
    if (showResults) return;

    const handleSecurityEvent = (type) => {
      console.warn(`🛡️ [SECURITY] Focus lost: ${type} at ${new Date().toLocaleTimeString()}`);
      setSecurityViolations(prev => [...prev, { type, timestamp: new Date().toISOString(), questionIndex: currentQuestionIndex }]);
      setShowSecurityAlert(true);
      // Auto-hide alert after 3 seconds
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

  // 3. Navigation & Answer Handling
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

  // 4. Adaptive Logic: Transition between modules
  const handleNextModule = () => {
    recordTime();
    
    // Record Module Duration
    const mDuration = Math.floor((Date.now() - moduleStartTime) / 1000);
    setModuleDurations(prev => ({
      ...prev,
      [currentModuleKey]: mDuration
    }));

    const threshold = courseInfo?.threshold_percentage || 60;
    
    // Calculate current module score
    const correctCount = questions.filter(q => {
      const ans = userAnswers[q.id];
      return ans && q.correctAnswer && ans.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
    }).length;
    const percentage = (correctCount / questions.length) * 100;

    let nextKey = '';
    if (currentModuleKey === 'rw_moderate') {
      nextKey = percentage >= threshold ? 'rw_hard' : 'rw_easy';
    } else if (currentModuleKey === 'rw_easy' || currentModuleKey === 'rw_hard') {
      // Move to Math but start with a break
      setIsBreakActive(true);
      setBreakTimeLeft(600);
      setShowCheckWork(false); // Close review screen
      return; 
    } else if (currentModuleKey === 'math_moderate') {
      nextKey = percentage >= threshold ? 'math_hard' : 'math_easy';
    }

    if (nextKey && modules[nextKey]) {
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
      handleFinish(); // No more modules
    }
  };

  const handleEndBreak = () => {
    setIsBreakActive(false);
    // After break, always go to math_moderate
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

  // 5. Final Grading & Submission
  const handleFinish = async () => {
    setSavingResult(true);
    try {
        // Collect all questions from the history (adaptive path)
        const pathQuestions = [];
        moduleHistory.forEach(key => {
            pathQuestions.push(...modules[key]);
        });

        const questionIds = pathQuestions.map(q => q.id);
        const answers = pathQuestions.map(q => userAnswers[q.id] || '');
        
        // Calculate scores per module for details and section scores
        let rwRaw = 0;
        let rwMax = 0;
        let mathRaw = 0;
        let mathMax = 0;

        // Track path to determine section ceilings (Easy path max 700, Hard path max 800)
        let rwPath = 'moderate';
        let mathPath = 'moderate';

        const calculatedModuleDetails = {};
        const topicStats = {};
        const moduleAnswers = {};

        moduleHistory.forEach(mKey => {
            const mQs = modules[mKey];
            const isRW = mKey.startsWith('rw');
            const diff = mKey.split('_')[1]; // moderate, easy, hard

            // Map answers for this module
            moduleAnswers[mKey] = mQs.map(q => ({
              ...q,
              userAnswer: userAnswers[q.id] || '',
              isCorrect: userAnswers[q.id] && q.correctAnswer && 
                         userAnswers[q.id].toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase()
            }));
            
            // 1. Difficulty Weights (Easy=1, Moderate=2, Hard=3)
            const weight = diff === 'hard' ? 3 : (diff === 'moderate' ? 2 : 1);
            
            // Track if student went to Easy or Hard module for the ceiling
            if (isRW) {
                if (diff === 'easy') rwPath = 'easy';
                if (diff === 'hard') rwPath = 'hard';
            } else {
                if (diff === 'easy') mathPath = 'easy';
                if (diff === 'hard') mathPath = 'hard';
            }
            
            let moduleCorrect = 0;
            let moduleIncorrect = 0;
            let moduleUnanswered = 0;

            mQs.forEach(q => {
                const ans = userAnswers[q.id];
                const isCorrect = ans && q.correctAnswer && ans.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
                const isUnanswered = !ans;

                if (isCorrect) {
                  moduleCorrect++;
                  if (isRW) rwRaw += weight;
                  else mathRaw += weight;
                } else if (isUnanswered) {
                  moduleUnanswered++;
                } else {
                  moduleIncorrect++;
                }
                
                if (isRW) rwMax += weight;
                else mathMax += weight;

                // Topic Aggregation
                const topic = q.topic || 'General';
                if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0, incorrect: 0, unanswered: 0, totalTime: 0 };
                topicStats[topic].total++;
                topicStats[topic].totalTime += (questionTimes[q.id] || 0);
                if (isCorrect) topicStats[topic].correct++;
                else if (isUnanswered) topicStats[topic].unanswered++;
                else topicStats[topic].incorrect++;
            });

            calculatedModuleDetails[mKey] = {
                correct: moduleCorrect,
                incorrect: moduleIncorrect,
                unanswered: moduleUnanswered,
                total: mQs.length,
                percentage: Math.round((moduleCorrect / mQs.length) * 100),
                difficulty: diff.toUpperCase(),
                duration: moduleDurations[mKey] || 0
            };
        });

        // 2. Adaptive Flow Bounds (Min 200)
        // Hard path: 200 - 800 (Scale: 600)
        // Easy path: 200 - 700 (Scale: 500)
        const rwSectionScale = rwPath === 'hard' ? 600 : 500;
        const mathSectionScale = mathPath === 'hard' ? 600 : 500;

        // Final score calculation: 200 + (Weighted_Raw / Weighted_Max) * Section_Scale
        const finalRwScore = rwMax > 0 ? Math.round(200 + (rwRaw / rwMax) * rwSectionScale) : 200;
        const finalMathScore = mathMax > 0 ? Math.round(200 + (mathRaw / mathMax) * mathSectionScale) : 200;
        const finalTotalScore = finalRwScore + finalMathScore;

        const totalCorrect = pathQuestions.filter(q => {
            const ans = userAnswers[q.id];
            return ans && q.correctAnswer && ans.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
        }).length;
        const accuracyVal = Math.round((totalCorrect / pathQuestions.length) * 100);

        // Update State for UI
        setTotalScore(finalTotalScore);
        setRwScore(finalRwScore);
        setMathScore(finalMathScore);
        setAccuracy(accuracyVal);
        setModuleDetails(calculatedModuleDetails);

        // Segregate topic stats by section
        const sectionTopicStats = { rw: {}, math: {} };
        Object.keys(topicStats).forEach(t => {
            // Find a question with this topic to determine its section
            const sampleQ = pathQuestions.find(q => (q.topic || 'General') === t);
            const isRW = sampleQ && Object.keys(modules).some(k => k.startsWith('rw') && modules[k].some(mq => mq.id === sampleQ.id));
            if (isRW) sectionTopicStats.rw[t] = topicStats[t];
            else sectionTopicStats.math[t] = topicStats[t];
        });

        // Calculate total test duration from question times
        const totalDuration = Object.values(questionTimes).reduce((a, b) => a + b, 0);

        // Construct full responses array for the dashboard with explicit section labels
        const fullResponses = pathQuestions.map(q => {
            // Find which module this question belonged to
            const moduleKey = Object.keys(modules).find(k => modules[k].some(mq => mq.id === q.id));
            const isRW = moduleKey && moduleKey.startsWith('rw');
            
            return {
                ...q,
                section: isRW ? 'Reading & Writing' : 'Math',
                question_text: q.text,
                selected_answer: userAnswers[q.id] || '',
                is_correct: userAnswers[q.id] && q.correctAnswer &&
                            userAnswers[q.id].toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase(),
                is_unattempted: !userAnswers[q.id],
                time_spent: questionTimes[q.id] || 0
            };
        });

        const response = await gradingService.submitAdaptiveTest({
            courseId: parseInt(courseId),
            questionIds,
            answers,
            duration: totalDuration,
            scores: {
                totalScore: finalTotalScore,
                rwScore: finalRwScore,
                mathScore: finalMathScore,
                accuracy: accuracyVal,
                totalCorrect,
                moduleDetails: calculatedModuleDetails,
                sectionTopicStats,
                securityViolations, 
                responses: fullResponses 
            }
        });

        setAllTestQuestions(pathQuestions);
        
        const finishedAt = new Date().toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(',', ' |');

        setSubmissionResult({
            ...response.data,
            student_name: user?.full_name || user?.name || "Student",
            responses: fullResponses,
            moduleHistory,
            moduleAnswers,
            rwScore: finalRwScore,
            mathScore: finalMathScore,
            totalScore: finalTotalScore,
            moduleDetails: calculatedModuleDetails,
            topicStats,
            sectionTopicStats,
            questionTimes,
            totalCorrect,
            totalQs: pathQuestions.length,
            attempted: pathQuestions.filter(q => userAnswers[q.id]).length,
            accuracy: accuracyVal,
            finishedAt
        });
        setShowResults(true);
        setShowCheckWork(false);

        // Backend now handles notification automatically via submitAdaptiveTest

    } catch (err) {
        console.error("Submission error:", err);
        setError("Failed to submit exam.");
    } finally {
        setSavingResult(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const detectSection = () => {
    return currentModuleKey.startsWith('rw') ? 'Reading & Writing' : 'Math';
  };

  const getHeaderTitle = () => {
    const section = detectSection();
    const difficulty = currentModuleKey.split('_')[1];
    if (difficulty === 'moderate') return `${section} – Part 1`;
    return `${section} – Part 2`;
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-[#2E4DC6]">Initializing Adaptive Exam Environment...</div>;
  if (error) return <div className="h-screen flex items-center justify-center p-8 text-red-600 font-bold">{error}</div>;

  const currentQuestion = questions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestion?.id] || '';

  if (showResults) {
    return (
      <AdaptiveResultsDashboard 
        submission={submissionResult} 
        onExit={() => navigate('/student')} 
        adminMode={false} 
      />
    );
  }

  // Review Screen
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
          <div className="flex flex-col items-center">
              <div className="text-white font-black text-lg">
                {formatTime(timeLeft)}
              </div>
          </div>
          <div className="w-[100px]"></div>
        </header>

        <main className="flex-1 overflow-y-auto p-12 bg-white">
          <div className="max-w-4xl mx-auto w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
            <div className="p-10 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Section Review</h2>
              <p className="text-slate-500 font-medium">Review your work before you finish this section. You can click any question number to return to it.</p>
            </div>

            <div className="p-6 sm:p-10">
              <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 gap-3 sm:gap-4">
                {questions.map((q, idx) => {
                  const isAnswered = !!userAnswers[q.id];
                  const isFlagged = flaggedQuestions[idx];
                  return (
                    <button 
                      key={idx} 
                      onClick={() => { setShowCheckWork(false); setCurrentQuestionIndex(idx); }}
                      className={`aspect-square w-full rounded-xl relative flex items-center justify-center font-bold text-lg sm:text-xl transition-all border-2 ${isAnswered ? 'bg-[#2E4DC6] border-[#2E4DC6] text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'}`}
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

            <div className="p-6 sm:p-10 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <div className="w-3.5 h-3.5 rounded bg-[#2E4DC6]"></div> Answered
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <div className="w-3.5 h-3.5 rounded border-2 border-slate-200"></div> Unanswered
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <button onClick={() => setShowCheckWork(false)} className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-900 border-2 border-slate-200 rounded-full font-black text-[15px] hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
                    <SafeIcon icon={FiChevronLeft} /> Back to Questions
                  </button>
                  <button onClick={handleNextModule} className="w-full sm:w-auto px-10 py-3.5 bg-blue-600 text-white rounded-full font-black text-[15px] hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl">
                    {moduleHistory.length < 4 ? 'Next Module' : 'Submit Test'} <SafeIcon icon={FiChevronRight} />
                  </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Break Screen UI
  if (isBreakActive) {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#1a1a1a] flex flex-col font-sans text-white overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-12 sm:gap-20">
          
          {/* Left Side: Timer */}
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

          {/* Right Side: Instructions */}
          <div className="max-w-xl space-y-6 sm:space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Practice Test Break</h2>
              <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
                You can resume this practice test as soon as you're ready to move on. On test day, you'll wait until the clock counts down. Read below to see how breaks work on test day.
              </p>
            </div>

            <div className="h-px bg-white/10 w-full" />

            <div className="space-y-6">
              <h3 className="text-xl sm:text-2xl font-black text-[#FFD700]">Take a Break: Do Not Close Your Device</h3>
              <p className="text-sm sm:text-base text-gray-400">After the break, a <span className="text-white font-bold">Resume Testing Now</span> button will appear and you'll start the next section.</p>
              
              <div className="space-y-4">
                <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-500">Follow these rules during the break:</p>
                <ul className="space-y-3 text-sm sm:text-base text-gray-300 font-medium">
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
        
        {/* Footer */}
        <div className="p-8 border-t border-white/5">
          <p className="text-gray-500 font-bold text-lg">{user?.name || 'Student'}</p>
        </div>
      </div>
    );
  }

  // Active Exam UI
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
        .take-quiz-force-white header { background: #0f172a !important; color: white !important; min-height: 60px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 12px !important; position: relative !important; z-index: 10000 !important; }
        @media (min-width: 640px) { .take-quiz-force-white header { padding: 0 40px !important; } }
        .take-quiz-force-white footer { background: #ffffff !important; border-top: 1px solid #e2e8f0 !important; min-height: 75px !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 12px !important; position: relative !important; z-index: 10000 !important; }
        @media (min-width: 640px) { .take-quiz-force-white footer { padding: 0 40px !important; min-height: 60px !important; } }
        .timer-text { color: #ffffff !important; font-weight: 800 !important; font-size: 15px !important; }
        @media (min-width: 640px) { .timer-text { font-size: 18px !important; } }
        .practice-banner { background: #1e1b4b !important; color: white !important; text-align: center !important; padding: 6px 0 !important; font-size: 9px !important; font-weight: 800 !important; letter-spacing: 0.1em !important; position: relative !important; z-index: 9000 !important; }
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

      <div className="practice-banner">THIS IS A PRACTICE TEST</div>
      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden pt-2 sm:pt-4 bg-white relative z-10">
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white border-b-[6px] md:border-b-0 md:border-r-[10px] border-[#0f172a]">
          <div className="prose prose-slate max-w-none leading-[1.6] text-[16px] sm:text-[18px] text-slate-900 font-medium tracking-tight antialiased">
                <MathRenderer text={currentQuestion?.text || ''} courseId={courseId} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white relative z-20">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
             <div className="flex items-center gap-3">
               <div className="bg-black text-white w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center font-bold rounded-lg text-sm sm:text-base">{currentQuestionIndex + 1}</div>
               <button onClick={toggleFlag} className={`flex items-center gap-2 text-xs sm:text-sm font-bold border-b-2 border-dashed ${flaggedQuestions[currentQuestionIndex] ? 'text-black border-black' : 'text-gray-800 border-gray-400'}`}>
                  <SafeIcon icon={FiStar} className={flaggedQuestions[currentQuestionIndex] ? 'fill-current' : ''} /> <span className="whitespace-nowrap">Mark for Review</span>
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
                            className={`flex-1 rounded-2xl p-4 sm:p-5 min-h-[50px] sm:min-h-[60px] cursor-pointer pointer-events-auto transition-all flex flex-col justify-center relative z-50 ${isSelected ? 'border-2 border-blue-600 bg-blue-50/5 shadow-sm' : 'border border-slate-200 bg-white group-hover:border-slate-300 shadow-sm'}`}
                         >
                            <div className="pointer-events-none"><MathRenderer text={optContent} courseId={courseId} className="text-[15px] sm:text-[17px] text-slate-800 font-normal leading-normal antialiased" /></div>
                         </div>
                      </div>
                    );
                  })
              )}
          </div>
        </div>
      </main>

      <footer>
        <div className="text-[10px] sm:text-sm font-bold flex-1 text-slate-900 truncate max-w-[60px] sm:max-w-none px-1">
          {user?.name || 'Student'}
        </div>
        <div className="relative flex justify-center shrink-0 mx-1">
          <button onClick={() => setShowNavigation(!showNavigation)} className="bg-black text-white px-2 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-3">
              <span className="hidden sm:inline">Question </span>{currentQuestionIndex + 1}<span className="sm:hidden"> / </span><span className="hidden sm:inline"> of </span>{questions.length}
              <SafeIcon icon={showNavigation ? FiX : FiChevronDown} className="w-2.5 h-2.5 sm:w-4 sm:h-4 text-gray-400" />
          </button>
          <AnimatePresence>
          {showNavigation && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed bottom-[85px] sm:bottom-[130px] bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-[0_0_40px_-10px_rgba(0,0,0,0.2)] z-[1000] w-[94vw] sm:w-[420px] left-1/2 -translate-x-1/2 flex flex-col items-center max-h-[75vh] overflow-y-auto">
               <div className="hidden sm:block absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-slate-200 rotate-45"></div>
               <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 w-full relative">
                  <span className="font-black text-[10px] sm:text-sm text-slate-900 w-full text-center uppercase tracking-widest px-8">
                      {detectSection()} - Module {moduleHistory.length % 2 === 1 ? '1' : '2'}
                  </span>
                  <SafeIcon icon={FiX} onClick={() => setShowNavigation(false)} className="cursor-pointer text-gray-400 absolute right-0 top-0 w-4 h-4" />
               </div>
               <div className="flex flex-wrap gap-2 mb-8 justify-center">
                   {questions.map((q, idx) => (
                       <div key={idx} onClick={() => { setCurrentQuestionIndex(idx); setShowNavigation(false); }} className={`w-[32px] h-[32px] sm:w-[34px] sm:h-[34px] flex items-center justify-center font-black rounded-sm cursor-pointer transition-all text-xs sm:text-sm border ${userAnswers[q.id] ? 'text-blue-600 border-blue-600 bg-blue-50' : 'text-blue-600 border-blue-600 border-dashed bg-white'}`}>
                           {idx + 1}
                       </div>
                   ))}
               </div>
               <button onClick={() => { setShowNavigation(false); setShowCheckWork(true); }} className="w-full sm:w-auto px-5 py-2.5 rounded-full border-2 border-blue-600 text-blue-600 font-black text-xs sm:text-sm hover:bg-blue-50 transition-all uppercase tracking-widest">Go to Review Page</button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-4 sm:gap-8 flex-1 justify-end px-1">
          <button onClick={handleBack} disabled={currentQuestionIndex === 0} className="font-bold text-[10px] sm:text-sm text-blue-600 disabled:opacity-30 hover:underline uppercase tracking-widest">Back</button>
          <button onClick={handleNext} className="px-4 sm:px-8 py-2 sm:py-2.5 bg-blue-600 text-white rounded-full font-black text-[10px] sm:text-sm hover:bg-blue-700 transition-colors shadow-lg uppercase tracking-widest">
            {currentQuestionIndex === questions.length - 1 ? 'Review' : 'Next'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default AdaptiveExamInterface;
