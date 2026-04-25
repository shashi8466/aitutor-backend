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

const {
  FiChevronLeft, FiChevronRight, FiClock, FiGrid, FiMoreVertical, FiEdit3, FiInfo, FiChevronDown, FiStar, FiSlash, FiX, FiMapPin, FiFlag, FiLogOut, FiTrash2, FiType, FiFilePlus, FiTarget, FiCheckCircle, FiRefreshCw
} = FiIcons;

const ExamInterface = () => {
  const { courseId, level } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
  const [courseInfo, setCourseInfo] = useState(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState({}); 
  const [showTimer, setShowTimer] = useState(true);
  const wasDarkMode = useRef(false);


  useEffect(() => {
    // Store previous theme state and enforce light mode for the test
    wasDarkMode.current = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    
    return () => {
      // Restore the user's preferred theme upon exit
      if (wasDarkMode.current) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
    };
  }, []);

  useEffect(() => {
    if (courseId) {
        courseService.getById(courseId).then(res => {
            if (res.data) setCourseInfo(res.data);
        });
    }
  }, [courseId]);

  useEffect(() => {
    if (user?.id && courseId) loadQuestions();
  }, [courseId, user]);

  useEffect(() => {
    // Partition questions by level when allQuestions changes or activeModuleIndex changes
    const levels = ['Easy', 'Medium', 'Hard'];
    const currentLevel = levels[activeModuleIndex];
    if (allQuestions.length > 0) {
      const filtered = allQuestions.filter(q => q.computedLevel === currentLevel);
      setQuestions(filtered);
      
      // Calculate timer for the CURRENT MODULE ONLY
      const hasMath = filtered.some(q => {
        const text = (q.text || q.question || q.question_text || '').toLowerCase();
        return (q.topic || '').toLowerCase().includes('math') || 
               text.includes('$') || text.includes('\\') || 
               (text.includes('=') && !text.includes('?'));
      });
      const rate = hasMath ? 95 : 71;
      const moduleDuration = filtered.length * rate;
      setTotalTime(moduleDuration);
      setTimeLeft(moduleDuration);
    }
  }, [allQuestions, activeModuleIndex]);

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
      const levelsToLoad = ['Easy', 'Medium', 'Hard'];
      let allTargetQuestions = [];

      for (const lvl of levelsToLoad) {
          const { data: latestUploadData } = await supabase
            .from('uploads')
            .select('id, course_id, category')
            .eq('course_id', cId)
            .eq('category', 'quiz_document')
            .ilike('level', lvl)
            .in('status', ['completed', 'warning'])
            .order('created_at', { ascending: false })
            .limit(1);

          let levelQuestions = [];
          if (latestUploadData?.[0]) {
            const { data: qData } = await supabase
              .from('questions')
              .select('*')
              .eq('upload_id', latestUploadData[0].id)
              .order('id', { ascending: true });
            levelQuestions = qData || [];
          } else {
             const { data: manualQuestions } = await supabase
              .from('questions')
              .select('*')
              .eq('course_id', cId)
              .is('upload_id', null)
              .ilike('level', lvl)
              .order('id', { ascending: true });
              levelQuestions = manualQuestions || [];
          }
          
          levelQuestions.forEach(q => {
             q.computedLevel = lvl;
          });
          allTargetQuestions = [...allTargetQuestions, ...levelQuestions];
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

  const handleNextModule = () => {
    if (activeModuleIndex < 2) {
      setActiveModuleIndex(prev => prev + 1);
      setShowCheckWork(false);
      setCurrentQuestionIndex(0);
      window.scrollTo(0, 0);
    }
  };

  const handleFinish = async () => {
    if (activeModuleIndex < 2) return;
    setSavingResult(true);
    try {
        const finalQuestionIds = allQuestions.map(q => q.id);
        const finalAnswers = allQuestions.map(q => userAnswers[q.id] || '');
        const finalDuration = totalTime - timeLeft;

        // Calculate individual module scores for the UI and Email
        const levels = ['Easy', 'Medium', 'Hard'];
        const moduleScores = {};
        levels.forEach(lvl => {
            const moduleQs = allQuestions.filter(q => q.computedLevel === lvl);
            if (moduleQs.length > 0) {
                const correctCount = moduleQs.filter(q => {
                   const ans = userAnswers[q.id];
                   return ans && q.correctAnswer && ans.toString().trim() === q.correctAnswer.toString().trim();
                }).length;
                moduleScores[lvl.toLowerCase()] = {
                    correct: correctCount,
                    total: moduleQs.length,
                    percentage: Math.round((correctCount / moduleQs.length) * 100)
                };
            }
        });

        const response = await gradingService.submitTest({
            courseId: parseInt(courseId),
            level: 'Hard', 
            questionIds: finalQuestionIds,
            answers: finalAnswers,
            duration: finalDuration,
            mode: 'test'
        });

        const finalResult = {
            ...response.data,
            moduleScores
        };

        setSubmissionResult(finalResult);
        setShowResults(true);
        setShowCheckWork(false); 
        
        try {
            await axios.post('/api/grading/notify-results', {
                submissionId: response.data.submissionId,
                courseName: courseInfo?.name || 'Your Course',
                studentName: user?.name,
                scaledScore: response.data.scaledScore,
                accuracy: Math.round(response.data.rawPercentage),
                questionIds: finalQuestionIds,
                answers: finalAnswers,
                moduleScores, // Explicitly pass the calculated scores
                mode: 'test'
            });
        } catch (e) {}
    } catch (err) {
        setError("Failed to submit exam.");
    } finally {
        setSavingResult(false);
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
                         topic.includes('english') || topic.includes('literacy');

    const isReadingCourse = courseName.includes('reading') || courseName.includes('writing') || courseName.includes('words');
    const isMathCourse = courseName.includes('math') || courseName.includes('algebra') || courseName.includes('calc');

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
                Section 1, Module {activeModuleIndex + 1}: {detectSection()}
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
                    {activeModuleIndex < 2 ? (
                      <button onClick={handleNextModule} className="px-10 py-3.5 bg-blue-600 text-white rounded-full font-black text-[15px] hover:bg-blue-700 transition-all flex items-center gap-3 shadow-xl">
                        Next Module <SafeIcon icon={FiChevronRight} />
                      </button>
                    ) : (
                      <button onClick={handleFinish} disabled={savingResult} className="px-10 py-3.5 bg-black text-white rounded-full font-black text-[15px] hover:bg-slate-800 transition-all flex items-center gap-3 shadow-xl disabled:opacity-50">
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
    const res = submissionResult;
    const percentage = res ? Math.round(res.rawPercentage || 0) : 0;
    const modScores = res?.moduleScores || {};

    return (
      <div className="fixed inset-0 z-[999999] bg-[#0F172A]/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-[#1E293B] p-8 sm:p-12 rounded-[48px] shadow-2xl max-w-2xl w-full border border-white/10 flex flex-col items-center relative overflow-y-auto max-h-[95vh]">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl rotate-12 flex items-center justify-center mb-6">
             <div className="w-12 h-12 bg-blue-600 rounded-xl -rotate-12 flex items-center justify-center shadow-xl shadow-blue-900/50">
                <SafeIcon icon={FiIcons.FiAward} className="w-6 h-6 text-white" />
             </div>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-2 text-center">Test Completed!</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8 text-center">Performance Summary</p>
          
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-6 rounded-3xl text-center shadow-lg">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2">Scaled Score</p>
              <div className="flex flex-col"><span className="text-4xl font-black text-[#2E4DC6]">{res?.scaledScore || '-'}</span></div>
            </div>
            <div className="bg-white p-6 rounded-3xl text-center shadow-lg">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.2em] mb-2">Accuracy</p>
              <div className="flex flex-col"><span className="text-4xl font-black text-slate-900">{percentage}%</span></div>
            </div>
          </div>

          <div className="w-full space-y-3 mb-10">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-2">Module Breakdown</p>
            {['Easy', 'Medium', 'Hard'].map(lvl => {
              const data = modScores[lvl.toLowerCase()];
              if (!data) return null;
              return (
                <div key={lvl} className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${lvl === 'Easy' ? 'bg-green-500' : lvl === 'Medium' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                    <span className="text-white font-bold">{lvl} Module</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-xs font-bold">{data.correct} / {data.total}</span>
                    <span className={`text-sm font-black ${data.percentage >= 70 ? 'text-green-400' : data.percentage >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {data.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <Link to="/student" className="w-full py-4 bg-black text-white rounded-[24px] font-black text-lg hover:bg-slate-900 transition-all text-center flex items-center justify-center gap-3">
              Back to Dashboard <SafeIcon icon={FiChevronRight} className="w-5 h-5 text-slate-400" />
          </Link>
        </motion.div>
      </div>
    );
  }

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
              Section 1, Module {activeModuleIndex + 1}: {detectSection()}
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
      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden pt-4 bg-white relative z-10">
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-12 bg-white border-b-[6px] md:border-b-0 md:border-r-[10px] border-[#0f172a]">
          <div className="prose prose-slate max-w-none leading-relaxed text-[15px] sm:text-[17px] text-black">
                <MathRenderer text={currentQuestion?.question_html || currentQuestion?.text || ''} />
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
              {currentQuestion?.question_text && (
                 <div className="text-[17px] font-bold text-black mb-8 leading-relaxed">
                   <MathRenderer text={currentQuestion.question_text} />
                 </div>
              )}

              {(!currentQuestion?.options || currentQuestion.options.filter(o => o && o.toString().trim() !== '').length === 0) ? (
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
                            <div className="pointer-events-none"><MathRenderer text={optContent} className="text-[17px] text-slate-900" /></div>
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
                      Section 1, Module {activeModuleIndex + 1}: {detectSection()} Questions
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
