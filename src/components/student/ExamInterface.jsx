import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { questionService, progressService, enrollmentService, gradingService, planService, courseService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import AdaptiveResultsDashboard from '../common/AdaptiveResultsDashboard';

const {
  FiChevronLeft, FiChevronRight, FiClock, FiGrid, FiMoreVertical, FiEdit3, FiInfo, FiChevronDown, FiStar, FiSlash, FiX, FiMapPin, FiFlag, FiLogOut, FiTrash2, FiType, FiFilePlus, FiTarget, FiCheckCircle, FiRefreshCw
} = FiIcons;

const ExamInterface = () => {
  const { courseId, level } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [courseInfo, setCourseInfo] = useState(null);

  const isSequential = ['AP', 'ACT'].includes(courseInfo?.main_category?.toUpperCase());
  const maxModuleIndex = isSequential ? 0 : 2;

  let unitId = '';
  let unitName = '';
  let unitOrder = 0;

  if (isSequential && level) {
    unitId = level; // e.g. "Unit 1: Chemistry of Life"
    const match = level.match(/(?:Unit|Topic)\s+(\d+)[:\s]+(.*)/i);
    if (match) {
      unitOrder = parseInt(match[1], 10);
      unitName = match[2].trim();
    } else {
      unitName = level;
      const numMatch = level.match(/\d+/);
      unitOrder = numMatch ? parseInt(numMatch[0], 10) : 1;
    }
  }

  const [allQuestions, setAllQuestions] = useState([]);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [showCheckWork, setShowCheckWork] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [savingResult, setSavingResult] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState({}); 
  const [showTimer, setShowTimer] = useState(true);
  const [questionTimes, setQuestionTimes] = useState({});
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const wasDarkMode = useRef(false);
  const isSubmittingRef = useRef(false); // Hard lock to prevent duplicate submissions


  useEffect(() => {
    // Store previous theme state exactly ONCE on mount
    wasDarkMode.current = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    
    return () => {
      // Restore the user's preferred theme upon exit
      if (wasDarkMode.current) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    };
  }, []);

  useEffect(() => {
    if (showResults) {
      if (wasDarkMode.current) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [showResults]);

  useEffect(() => {
    if (courseId) {
        courseService.getById(courseId).then(res => {
            if (res.data) setCourseInfo(res.data);
        });
    }
  }, [courseId]);

  useEffect(() => {
    if (user?.id && courseId) loadQuestions();
  }, [courseId, level, user]);

  useEffect(() => {
    // Partition questions by level when allQuestions changes or activeModuleIndex changes
    const isSequential = ['AP', 'ACT'].includes(courseInfo?.main_category?.toUpperCase());
    const levels = isSequential ? [level] : ['Easy', 'Medium', 'Hard'];
    const currentLevel = levels[activeModuleIndex];
    if (allQuestions.length > 0) {
      const filtered = allQuestions.filter(q => (q.computedLevel || '').toLowerCase() === (currentLevel || '').toLowerCase());
      setQuestions(filtered);
      
      // Calculate timer for the CURRENT MODULE ONLY
      const hasMath = filtered.some(q => {
        const text = (q.text || q.question || q.question_text || '').toLowerCase();
        return (q.topic || '').toLowerCase().includes('math') || 
               text.includes('$') || text.includes('\\') || 
               (text.includes('=') && !text.includes('?'));
      });
      
      let moduleDuration;
      if (isSequential) {
        moduleDuration = filtered.length * 60;
      } else {
        const rate = hasMath ? 95 : 71;
        moduleDuration = filtered.length * rate;
      }
      setTotalTime(moduleDuration);
      setTimeLeft(moduleDuration);
      setQuestionStartTime(Date.now());
    }
  }, [allQuestions, activeModuleIndex, courseInfo, level]);

  useEffect(() => {
    if (timeLeft > 0 && !showResults && !showCheckWork) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && questions.length > 0 && !showResults && !showCheckWork) {
      setShowCheckWork(true);
    }
  }, [timeLeft, showResults, showCheckWork, questions.length]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const cId = parseInt(courseId);
      const courseRes = await courseService.getById(cId);
      const cData = courseRes.data;
      setCourseInfo(cData);

      const isSequential = ['AP', 'ACT'].includes(cData?.main_category?.toUpperCase());
      const levelsToLoad = isSequential ? [level] : ['Easy', 'Medium', 'Hard'];
      let allTargetQuestions = [];

      // Check for section practice query param (used in ACT full-length sub-sections practice)
      const searchParams = new URLSearchParams(window.location.search);
      const querySection = searchParams.get('section');
      if (querySection) {
        console.log(`🎯 [Exam] Section practice requested: ${querySection}`);
        const { data: sectionUploadData } = await supabase
          .from('uploads')
          .select('id, file_name')
          .eq('course_id', cId)
          .eq('category', 'quiz_document')
          .ilike('section', querySection)
          .in('status', ['completed', 'warning'])
          .order('id', { ascending: false })
          .limit(1);

        if (sectionUploadData?.[0]) {
          console.log(`🎯 [Exam] Found section upload ${sectionUploadData[0].id}: ${sectionUploadData[0].file_name}`);
          const { data: qData } = await supabase
            .from('questions')
            .select('*')
            .eq('upload_id', sectionUploadData[0].id)
            .order('id', { ascending: true });
          
          if (qData && qData.length > 0) {
            allTargetQuestions = qData.map(q => ({ ...q, computedLevel: q.level || 'Medium' }));
            console.log(`✅ [Exam] Loaded ${allTargetQuestions.length} questions for section: ${querySection}`);
          }
        }
      }

      // 1. First, try to find a single upload that covers ALL levels for this course
      if (allTargetQuestions.length === 0) {
        const { data: globalUpload } = await supabase
          .from('uploads')
          .select('id')
          .eq('course_id', cId)
          .eq('category', 'quiz_document')
          .eq('level', 'All')
          .in('status', ['completed', 'warning'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (globalUpload?.[0]) {
          console.log(`🎯 [Exam] Found global upload ${globalUpload[0].id} for course ${cId}`);
          const { data: qData } = await supabase
            .from('questions')
            .select('*')
            .eq('upload_id', globalUpload[0].id)
            .order('id', { ascending: true });
          
          if (qData && qData.length > 0) {
            allTargetQuestions = qData.map(q => ({
              ...q,
              computedLevel: q.level || 'Medium'
            }));
          }
        }
      }

      // 2. If no global upload, fetch per-level using ONLY the latest upload per level.
      //    STRICT ISOLATION: never fall back to orphaned/unlinked questions.
      if (allTargetQuestions.length === 0) {
        console.log(`📂 [Exam] No global upload, fetching per-level for course ${cId}`);
        for (const lvl of levelsToLoad) {
            const { data: latestUploadData } = await supabase
              .from('uploads')
              .select('id, file_name')
              .eq('course_id', cId)
              .eq('category', 'quiz_document')
              .ilike('level', lvl)
              .in('status', ['completed', 'warning'])
              .order('id', { ascending: false })
              .limit(1);

            if (latestUploadData?.[0]) {
              console.log(`✅ [Exam] Level ${lvl}: using upload ${latestUploadData[0].id} (${latestUploadData[0].file_name})`);
              const { data: qData } = await supabase
                .from('questions')
                .select('*')
                .eq('upload_id', latestUploadData[0].id)
                .order('id', { ascending: true });
              
              if (qData && qData.length > 0) {
                const mapped = qData.map(q => ({ ...q, computedLevel: lvl }));
                allTargetQuestions = [...allTargetQuestions, ...mapped];
                console.log(`✅ [Exam] Loaded ${qData.length} questions for level ${lvl}`);
              }
            } else {
              // STRICT: Skip this level — do NOT fall back to orphaned questions.
              // Orphaned questions (upload_id = null) are legacy data and must not be shown.
              console.warn(`⚠️ [Exam] No upload found for level ${lvl} in course ${cId}. Skipping.`);
            }
        }
      }

      if (allTargetQuestions.length > 0) {
        const mapped = allTargetQuestions.map(q => ({
          ...q,
          text: q.question || q.question_text || '',
          options: q.options || (q.option_a ? [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean) : []),
          correctAnswer: q.correct_answer || q.correctAnswer || ''
        }));
        setAllQuestions(mapped);
      } else {
        setError("No questions found for this test.");
      }
    } catch (err) {
      setError("Failed to load exam content.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    recordTime();
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
    else setShowCheckWork(true);
  };

  const handleBack = () => {
    recordTime();
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
  };

  const handleNextModule = () => {
    if (activeModuleIndex < maxModuleIndex) {
      setActiveModuleIndex(prev => prev + 1);
      setShowCheckWork(false);
      setCurrentQuestionIndex(0);
      setQuestionStartTime(Date.now());
      window.scrollTo(0, 0);
    }
  };

  const handleFinish = async () => {
    recordTime();
    if (activeModuleIndex < maxModuleIndex) return;
    // 🔒 Hard submission lock — prevents duplicate API calls from double-clicks
    // or rapid state updates before React re-renders the disabled button state.
    if (isSubmittingRef.current) {
      console.warn('⚠️ [ExamInterface] Submission already in progress — ignoring duplicate call.');
      return;
    }
    isSubmittingRef.current = true;
    setSavingResult(true);
    try {
        const finalQuestionIds = allQuestions.map(q => q.id);
        const finalAnswers = allQuestions.map(q => userAnswers[q.id] || '');
        const finalDuration = totalTime - timeLeft;

        // Calculate individual module scores for the UI and Email
        const levels = isSequential ? [level] : ['Easy', 'Medium', 'Hard'];
        const moduleScores = {};
        levels.forEach(lvl => {
            const moduleQs = allQuestions.filter(q => (q.computedLevel || '').toLowerCase() === (lvl || '').toLowerCase());
            if (moduleQs.length > 0) {
                const correctCount = moduleQs.filter(q => {
                   const studentAns = (userAnswers[q.id] || '').toString().trim().toLowerCase();
                   if (!studentAns || !q.correctAnswer) return false;
                   
                   let acceptedAnswers = [];
                   const rawCorrect = q.correctAnswer.toString().trim();
                   
                   // Robust multi-format parsing
                   if (rawCorrect.startsWith('[') && rawCorrect.endsWith(']')) {
                     try {
                       // Handle JSON array format ["2", "-12"]
                       const parsed = JSON.parse(rawCorrect);
                       acceptedAnswers = Array.isArray(parsed) ? parsed.map(a => a.toString().trim().toLowerCase()) : [parsed.toString().trim().toLowerCase()];
                     } catch (e) {
                       // Fallback to comma split if JSON parse fails
                       acceptedAnswers = rawCorrect.split(/[,|]/).map(a => a.trim().toLowerCase());
                     }
                   } else {
                     // Handle comma or pipe separated format "2, -12"
                     acceptedAnswers = rawCorrect.split(/[,|]/).map(a => a.trim().toLowerCase());
                   }
                   
                   return acceptedAnswers.includes(studentAns);
                }).length;
                moduleScores[lvl.toLowerCase()] = {
                    correct: correctCount,
                    total: moduleQs.length,
                    percentage: Math.round((correctCount / moduleQs.length) * 100)
                };
            }
        });

        const isACTTest = (courseInfo?.tutor_type || '').toUpperCase().includes('ACT') || (courseInfo?.name || '').toUpperCase().includes('ACT');
        
        const sectionName = detectSection(); // Returns 'Reading & Writing' or 'Math'
        const isRW = sectionName === 'Reading & Writing';
        
        // Construct full responses array for the dashboard with explicit section labels
        const fullResponses = allQuestions.map(q => {
            return {
                ...q,
                section: sectionName,
                question_text: q.text,
                selected_answer: userAnswers[q.id] || '',
                is_correct: userAnswers[q.id] && q.correctAnswer &&
                            userAnswers[q.id].toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase(),
                is_unattempted: !userAnswers[q.id],
                time_spent: questionTimes[q.id] || 0
            };
        });
        
        const totalCorrect = fullResponses.filter(r => r.is_correct).length;
        const accuracyVal = Math.round((totalCorrect / allQuestions.length) * 100);
        
        let finalResult = {};
        let response;

        if (isACTTest && allQuestions.length >= 100) { // Full ACT Test is 171 questions
            // Partition by ACT sections using topic/category/subject/text keywords
            let englishQs = [], mathQs = [], readingQs = [], scienceQs = [];
            
            fullResponses.forEach(r => {
                const textStr = ((r.topic || '') + ' ' + (r.category || '') + ' ' + (r.subject || '')).toLowerCase();
                const qText = (r.question_text || '').toLowerCase();
                
                if (textStr.includes('math') || qText.includes('$') || qText.includes('\\')) {
                    mathQs.push(r);
                } else if (textStr.includes('science')) {
                    scienceQs.push(r);
                } else if (textStr.includes('read')) {
                    readingQs.push(r);
                } else {
                    // Default to English if it's verbal but not explicitly Reading
                    englishQs.push(r);
                }
            });

            const englishCorrect = englishQs.filter(r => r.is_correct).length;
            const mathCorrect = mathQs.filter(r => r.is_correct).length;
            const readingCorrect = readingQs.filter(r => r.is_correct).length;
            const scienceCorrect = scienceQs.filter(r => r.is_correct).length;

            // Simple exact linear mapping (can be replaced by client tables)
            const getActScaled = (correct, max) => Math.min(36, Math.max(1, Math.round((correct / max) * 35) + 1));
            
            const englishScaled = getActScaled(englishCorrect, 50);
            const mathScaled = getActScaled(mathCorrect, 45);
            const readingScaled = getActScaled(readingCorrect, 36);
            const scienceScaled = getActScaled(scienceCorrect, 40);
            
            const composite = Math.round((englishScaled + mathScaled + readingScaled + scienceScaled) / 4);

            const actScores = {
                english: { raw: englishCorrect, max: englishQs.length || 50, scaled: englishScaled },
                math: { raw: mathCorrect, max: mathQs.length || 45, scaled: mathScaled },
                reading: { raw: readingCorrect, max: readingQs.length || 36, scaled: readingScaled },
                science: { raw: scienceCorrect, max: scienceQs.length || 40, scaled: scienceScaled },
                composite: composite
            };

            response = await gradingService.submitAdaptiveTest({
                courseId: parseInt(courseId),
                questionIds: finalQuestionIds,
                answers: finalAnswers,
                duration: finalDuration,
                scores: {
                    totalCorrect,
                    accuracy: accuracyVal,
                    actScores,
                    totalScore: composite
                }
            });

            finalResult = {
                ...response.data,
                moduleScores,
                course: courseInfo,
                student_name: user?.name || user?.full_name || "Student",
                responses: fullResponses,
                isACT: true,
                actScores,
                totalScore: composite,
                scaled_score: composite,
                accuracy: accuracyVal,
                test_date: new Date().toISOString()
            };
        } else {
            response = await gradingService.submitTest({
                courseId: parseInt(courseId),
                level: isSequential ? level : 'Hard', 
                questionIds: finalQuestionIds,
                answers: finalAnswers,
                duration: finalDuration,
                mode: 'test'
            });

            // Standard SAT Logic
            const finalTotalScore = response.data?.scaled_score || response.data?.score || Math.round(200 + (totalCorrect / allQuestions.length) * 600);
            
            finalResult = {
                ...response.data,
                moduleScores,
                course: courseInfo,
                student_name: user?.name || user?.full_name || "Student",
                responses: fullResponses,
                rwScore: isRW ? finalTotalScore : 0,
                mathScore: !isRW ? finalTotalScore : 0,
                totalScore: finalTotalScore,
                scaled_score: finalTotalScore,
                accuracy: accuracyVal,
                test_date: new Date().toISOString()
            };
        }

        setSubmissionResult(finalResult);
        setShowResults(true);
        setShowCheckWork(false); 
        
        // Backend now handles notification automatically via submitTest
    } catch (err) {
        setError("Failed to submit exam.");
        // Release lock on error so the student can retry
        isSubmittingRef.current = false;
    } finally {
        setSavingResult(false);
        // Note: lock stays 'true' on success to prevent any re-submission
    }
  };

  const detectSection = () => {
    // Current module questions are the best indicator
    const currentQs = questions || [];
    const firstQ = currentQs[0] || allQuestions[0];
    
    const topic = (firstQ?.topic || firstQ?.category || firstQ?.subject || '').toLowerCase();
    const courseName = (courseInfo?.name || '').toLowerCase();
    const text = (firstQ?.text || firstQ?.question || firstQ?.question_text || '').toLowerCase();
    
    // Explicit indicators for Math
    const isMathSymbolic = text.includes('$') || text.includes('\\') || text.includes('=') || 
                           text.includes(' triangle ') || text.includes(' figure ') || 
                           topic.includes('math') || topic.includes('algebra') || 
                           topic.includes('geometry') || topic.includes('calc');

    // Explicit indicators for Reading & Writing
    const isRWKeywords = text.includes(' passage ') || text.includes(' text ') || 
                         text.includes(' author ') || text.includes(' logically completes ') ||
                         topic.includes('read') || topic.includes('writ') || 
                         topic.includes('english') || topic.includes('literacy') ||
                         topic.includes('rhetorical') || topic.includes('synthesis');

    const courseCategory = (courseInfo?.category || '').toLowerCase();
    const isReadingCourse = courseName.includes('reading') || courseName.includes('writing') || courseName.includes('words') || courseName.includes('rhetorical') || courseName.includes('synthesis') || courseCategory === 'reading_writing' || courseCategory.includes('reading');
    const isMathCourse = courseName.includes('math') || courseName.includes('algebra') || courseName.includes('calc') || courseCategory === 'math' || courseCategory.includes('math');

    if (isReadingCourse && !isMathSymbolic) return 'Reading & Writing';
    if (isMathCourse) return 'Math';
    
    const isReading = (isRWKeywords && !isMathSymbolic) || (topic.includes('read') || topic.includes('writ'));
    
    return isReading ? 'Reading & Writing' : 'Math';
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-[#2E4DC6]">Loading Exam Environment...</div>;
  if (error) return <div className="h-screen flex items-center justify-center p-8 text-red-600 font-bold">{error}</div>;

  const currentQuestion = questions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestion?.id] || '';

  if (showCheckWork) {
      return (
        <div className="fixed inset-0 z-[999999] bg-[#F1F5F9] flex flex-col font-sans select-none text-black overflow-hidden take-quiz-force-white px-0">
          <header className="bg-[#0f172a] px-10 h-[60px] flex items-center justify-between shadow-sm">
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-white">
                {isSequential ? `${unitId} Graded Quiz` : `Section 1, Module ${activeModuleIndex + 1}: ${detectSection()}`}
              </h2>
              <span className="text-[11px] text-gray-400 font-semibold">{isSequential ? "Review Unit Quiz" : "Review Section"}</span>
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
                <h2 className="text-3xl font-black text-slate-900 mb-2">{isSequential ? "Unit Quiz Review" : "Section Review"}</h2>
                <p className="text-slate-600 font-medium">
                  {isSequential 
                    ? "Review your work before you finish this unit. You can click any question number to return to it." 
                    : "Review your work before you finish this section. You can click any question number to return to it."}
                </p>
              </div>

              <div className="p-10">
                <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-4">
                  {questions.map((q, idx) => {
                    const isAnswered = !!userAnswers[q.id];
                    const isFlagged = flaggedQuestions[idx];
                    return (
                      <button 
                        key={idx} 
                        onClick={() => { setShowCheckWork(false); setCurrentQuestionIndex(idx); setQuestionStartTime(Date.now()); }}
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
                
                <div className="flex flex-col sm:flex-row gap-4 items-center w-full sm:w-auto">
                    <button onClick={() => { setShowCheckWork(false); setQuestionStartTime(Date.now()); }} className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-full font-black text-[13px] sm:text-[15px] hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
                      <SafeIcon icon={FiChevronLeft} /> Back to Questions
                    </button>
                    {activeModuleIndex < maxModuleIndex ? (
                      <button onClick={handleNextModule} className="w-full sm:w-auto px-8 sm:px-10 py-3 bg-blue-600 text-white rounded-full font-black text-[13px] sm:text-[15px] hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl">
                        Next Module <SafeIcon icon={FiChevronRight} />
                      </button>
                    ) : (
                      <button onClick={handleFinish} disabled={savingResult} className="w-full sm:w-auto px-8 sm:px-10 py-3 bg-black text-white rounded-full font-black text-[13px] sm:text-[15px] hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50">
                        {savingResult ? <SafeIcon icon={FiRefreshCw} className="animate-spin" /> : <SafeIcon icon={FiCheckCircle} />} Submit Test
                      </button>
                    )}
                </div>
              </div>
            </div>
          </main>
        </div>
      );
  }

  if (showResults) {
    return (
      <AdaptiveResultsDashboard 
        submission={submissionResult} 
        onExit={() => navigate(`/student/course/${courseId}`)} 
        adminMode={false} 
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[999999] bg-white flex flex-col font-sans select-none text-black overflow-hidden take-quiz-force-white px-0">
      <style>{`
        .take-quiz-force-white header { 
          background: #0f172a !important; 
          color: white !important; 
          min-height: 54px !important; 
          display: flex !important; 
          align-items: center !important; 
          justify-content: space-between !important; 
          padding: 0 12px !important; 
          position: relative !important; 
          z-index: 10000 !important; 
        }
        @media (min-width: 640px) { 
          .take-quiz-force-white header { padding: 0 40px !important; min-height: 60px !important; } 
        }
        
        .take-quiz-force-white footer { 
          background: #ffffff !important; 
          border-top: 1px solid #e2e8f0 !important; 
          min-height: 64px !important; 
          display: flex !important; 
          align-items: center !important; 
          justify-content: space-between !important; 
          padding: 0 12px !important; 
          position: relative !important; 
          z-index: 10000 !important; 
        }
        @media (min-width: 640px) { 
          .take-quiz-force-white footer { padding: 0 40px !important; min-height: 70px !important; } 
        }

        .timer-text { color: #ffffff !important; font-weight: 800 !important; font-size: 14px !important; }
        @media (min-width: 640px) { .timer-text { font-size: 18px !important; } }
        
        .practice-banner { background: #1e1b4b !important; color: white !important; text-align: center !important; padding: 4px 0 !important; font-size: 9px !important; font-weight: 800 !important; letter-spacing: 0.1em !important; position: relative !important; z-index: 9000 !important; }
        @media (min-width: 640px) { .practice-banner { font-size: 10px !important; } }
      `}</style>

      <header>
        <div className="flex flex-col">
          <h2 className="text-[12px] sm:text-[15px] font-bold text-white leading-tight truncate max-w-[120px] sm:max-w-none">
              {isSequential ? `${unitId} Graded Quiz` : `Section 1, Module ${activeModuleIndex + 1}: ${detectSection()}`}
          </h2>
          <span className="text-[9px] sm:text-[11px] text-gray-400 font-medium">Directions <SafeIcon icon={FiChevronDown} className="w-2.5 h-2.5 sm:w-3 sm:h-3" /></span>
        </div>
        <div className="flex flex-col items-center mt-1">
            <div className="timer-text">{formatTime(timeLeft)}</div>
            <span className="text-[9px] font-bold text-gray-400 tracking-widest cursor-pointer hover:text-white">HIDE</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 relative">
           <button 
             onClick={() => setShowMoreMenu(!showMoreMenu)} 
             className="flex flex-col items-center cursor-pointer text-gray-300 hover:text-white bg-transparent border-none p-0 outline-none relative z-[10001]"
           >
               <span className="text-lg sm:text-xl font-black leading-none">⋮</span>
               <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest">More</span>
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

      {isSequential ? (
        <div className="practice-banner">AP CURRICULUM UNIT GRADED QUIZ</div>
      ) : (
        <div className="practice-banner">THIS IS A PRACTICE TEST</div>
      )}
      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden pt-4 bg-white relative z-10">
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white border-b-[4px] md:border-b-0 md:border-r-[10px] border-[#0f172a] max-h-[calc(100vh-140px)] custom-scrollbar">
          <div className="prose prose-slate max-w-none leading-relaxed text-[15px] sm:text-[17px] text-black">
                {currentQuestion?.passage ? (
                    <MathRenderer text={currentQuestion.passage} />
                ) : (
                    <MathRenderer text={currentQuestion?.question || currentQuestion?.question_html || currentQuestion?.text || ''} />
                )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 bg-white relative z-20 max-h-[calc(100vh-140px)] custom-scrollbar">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-4">
               <div className="bg-black text-white w-8 h-8 flex items-center justify-center font-bold rounded-lg">{currentQuestionIndex + 1}</div>
               <button onClick={toggleFlag} className={`flex items-center gap-2 text-sm font-bold border-b-2 border-dashed ${flaggedQuestions[currentQuestionIndex] ? 'text-black border-black' : 'text-gray-800 border-gray-400'}`}>
                  <SafeIcon icon={FiStar} className={flaggedQuestions[currentQuestionIndex] ? 'fill-current' : ''} /> Mark for Review
               </button>
             </div>
          </div>

          <div className="space-y-4 relative z-30">
              {/* Only show question text here if passage is present (split mode), or if explicit question_text exists */}
              {(currentQuestion?.passage || currentQuestion?.question_text) && (
                 <div className="text-[17px] font-bold text-black mb-8 leading-relaxed">
                   <MathRenderer text={currentQuestion?.passage ? (currentQuestion?.question || currentQuestion?.text || '') : (currentQuestion?.question_text || '')} />
                 </div>
              )}

              {/* Detect if this is an SPR (Student-Produced Response / Short Answer) */}
              {(
                (!currentQuestion?.options || currentQuestion.options.filter(o => o && o.toString().trim() !== '').length === 0) || 
                currentQuestion?.type === 'short_answer' || 
                currentQuestion?.type === 'spr' ||
                // If correct answer is a JSON array or has commas, it's likely an SPR with multiple answers
                (currentQuestion?.correctAnswer && (currentQuestion.correctAnswer.toString().includes(',') || currentQuestion.correctAnswer.toString().includes('|') || currentQuestion.correctAnswer.toString().startsWith('[')))
              ) ? (
                  <div className="w-full flex flex-col mt-4">
                      <p className="text-[15px] font-bold text-slate-500 mb-4 uppercase tracking-wider">STUDENT-PRODUCED RESPONSE</p>
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
                      <div key={letter} className="flex flex-col sm:flex-row gap-2 sm:gap-4 group relative z-40">
                         <button
                            type="button"
                            onClick={() => handleAnswerSelect(letter)}
                            className={`w-[36px] h-[36px] sm:w-[44px] sm:h-[44px] rounded-full flex items-center justify-center font-bold shrink-0 transition-colors cursor-pointer pointer-events-auto relative z-50 text-sm sm:text-base ${isSelected ? 'border-2 border-blue-600 text-blue-600 bg-white ring-4 ring-blue-50 shadow-sm' : 'border border-slate-200 text-slate-400 bg-white group-hover:border-slate-300'}`}
                         >
                            {letter}
                         </button>
                         <div 
                            role="button"
                            onClick={() => handleAnswerSelect(letter)}
                            className={`flex-1 rounded-xl sm:rounded-2xl p-3 sm:p-5 min-h-[48px] sm:min-h-[60px] cursor-pointer pointer-events-auto transition-all flex flex-col justify-center relative z-50 ${isSelected ? 'border-2 border-blue-600 bg-blue-50/5 shadow-sm' : 'border border-slate-200 bg-white group-hover:border-slate-300 shadow-sm'}`}
                         >
                            <div className="pointer-events-none w-full">
                               <MathRenderer text={optContent} className="text-sm sm:text-[17px] text-slate-900" />
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
        <div className="text-[10px] sm:text-sm font-bold flex-1 text-slate-900 truncate max-w-[80px] sm:max-w-none">{user?.name || 'Student'}</div>
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
                      {isSequential ? `${unitId} Questions` : `Section 1, Module ${activeModuleIndex + 1}: ${detectSection()} Questions`}
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

export default ExamInterface;
