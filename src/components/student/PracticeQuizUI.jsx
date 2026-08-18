import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';

const {
  FiArrowLeft, FiGrid, FiClock, FiTarget, FiFlag, FiCheck, FiX, FiMessageCircle, FiArrowRight, FiLoader
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
  } catch (e) {
    console.warn("Error cleaning question text:", e);
  }
  return cleaned.trim();
};

const PracticeQuizUI = ({
  courseId,
  level,
  questions,
  currentQuestionIndex,
  currentQuestion,
  userAnswers,
  selectedAnswer,
  submitted,
  timeElapsed,
  isMCQ,
  isShortAnswer,
  handleAnswerSelect,
  handleSubmitAnswer,
  handleNextQuestion,
  handlePrevQuestion,
  isCorrectAnswer,
  getDisplayAnswer,
  getOptionLetter,
  formatTime,
  setShowQuestionGrid,
  navigate,
  courseInfo,
  isSequential,
  isACTFullLengthCourse,
  planSettings,
  setShowAITutor,
  user,
  savingResult
}) => {
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isCorrect = isCorrectAnswer();
  const correctAnswerLetter = currentQuestion?.correct_answer;
  const displayAnswerText = getDisplayAnswer(currentQuestion);

  // Parse time taken if we had a way to track per-question time, otherwise use overall time
  // The screenshot shows "Time Taken: 01:23". We'll use formatTime(timeElapsed) for now, 
  // or a placeholder if per-question time isn't available.
  const timeTakenStr = formatTime(timeElapsed);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 font-sans py-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        
        {/* TOP BAR */}
        <div className="p-4 flex flex-wrap items-center justify-between border-b border-slate-100 gap-4 bg-white">
          <div className="flex items-center gap-3">
            <Link 
              to={(isSequential || isACTFullLengthCourse(courseInfo)) ? `/student/course/${courseId}` : `/student/course/${courseId}/level/${level}`} 
              className="px-4 py-2 rounded-xl border border-slate-200 text-indigo-600 font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm"
            >
              <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Exit
            </Link>
            <button
              onClick={() => setShowQuestionGrid(true)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-indigo-600 font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm"
            >
              <SafeIcon icon={FiGrid} className="w-4 h-4" /> Questions
            </button>
          </div>

          <div className="flex-1 max-w-xl mx-auto flex flex-col items-center">
            <span className="text-sm font-bold text-indigo-600 mb-2">
              {currentQuestionIndex + 1} of {questions.length} Questions
            </span>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold flex items-center gap-2 text-sm border border-blue-100">
              <SafeIcon icon={FiClock} className="w-4 h-4" /> {formatTime(timeElapsed)}
            </div>
            <div className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm border border-slate-200 flex items-center justify-center min-w-[60px]">
              {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>
        </div>

        {/* TWO COLUMN MAIN CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px] items-stretch">
          
          {/* LEFT COLUMN: Question */}
          <div className="p-6 md:p-8 flex flex-col min-h-[500px] border-b lg:border-b-0 lg:border-r border-slate-100 bg-white">
            <div className="flex items-center gap-2 text-indigo-600 mb-4 uppercase tracking-widest text-xs font-bold">
              <SafeIcon icon={FiIcons.FiBookmark} className="w-4 h-4" />
              <span>{currentQuestion.topic || 'General Concepts'}</span>
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-6">
              Question {currentQuestionIndex + 1}
            </h1>

            {/* Passage if exists */}
            {currentQuestion.passage && (
              <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-base md:text-lg font-normal leading-loose">
                <MathRenderer text={currentQuestion.passage} courseId={courseId} />
              </div>
            )}

            <div className="text-slate-900 text-lg md:text-xl font-medium leading-relaxed mb-8 flex-1">
              <MathRenderer text={getCleanQuestionText(currentQuestion.question || '', currentQuestion.image)} courseId={courseId} />
            </div>

            {currentQuestion.image && (
              <div className="mb-8 rounded-xl overflow-hidden border border-slate-200 p-2">
                <img 
                  src={currentQuestion.image} 
                  alt="Question diagram" 
                  className="max-w-full h-auto mx-auto max-h-[400px] object-contain"
                />
              </div>
            )}

            <div className="mt-auto pt-6">
              <button className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium text-sm transition-colors px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                <SafeIcon icon={FiFlag} className="w-4 h-4" /> Report
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Answers & Controls */}
          <div className="p-6 md:p-8 flex flex-col justify-between bg-white">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">SELECT YOUR ANSWER</h3>
              
              {isMCQ && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, idx) => {
                    const letter = getOptionLetter(idx);
                    const isSelected = selectedAnswer === letter;
                    const isActuallyCorrect = letter === correctAnswerLetter;
                    
                    let containerClass = "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30";
                    let circleClass = "bg-white border-slate-300 text-slate-600";
                    let textClass = "text-slate-800 font-medium";

                    if (submitted) {
                      if (isActuallyCorrect) {
                        containerClass = "border-green-400 bg-green-50 ring-1 ring-green-400";
                        circleClass = "bg-green-500 text-white border-green-500";
                        textClass = "text-green-900 font-medium";
                      } else if (isSelected && !isActuallyCorrect) {
                        containerClass = "border-red-400 bg-red-50 ring-1 ring-red-400";
                        circleClass = "bg-red-500 text-white border-red-500";
                        textClass = "text-red-900 font-medium";
                      } else {
                        containerClass = "border-slate-100 opacity-60 bg-white";
                        circleClass = "bg-slate-50 text-slate-400 border-slate-200";
                        textClass = "text-slate-500";
                      }
                    } else if (isSelected) {
                      containerClass = "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500";
                      circleClass = "bg-indigo-600 text-white border-indigo-600";
                      textClass = "text-indigo-900 font-medium";
                    }

                    return (
                      <button 
                        key={idx} 
                        onClick={() => {
                          handleAnswerSelect(letter);
                          if (!submitted && handleSubmitAnswer) {
                            // If auto-submit is desired upon clicking an answer
                            // The screenshot doesn't show a Check Answer button, it auto-submits or we need one.
                            // Looking at the original QuizInterface, if 'Check Answer' isn't explicitly there for MCQ.
                            // Wait, the original UI submits manually or auto? It submits automatically if we are not taking a test but a practice?
                            // Let's just select the answer.
                          }
                        }}
                        disabled={submitted} 
                        className={`w-full p-4 text-left rounded-xl border transition-all flex items-center gap-4 ${containerClass}`}
                      >
                        <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 shadow-sm ${circleClass}`}>
                          {letter}
                        </span>
                        <div className={`flex-1 text-base ${textClass}`}>
                          <MathRenderer text={option || ''} courseId={courseId} />
                        </div>
                        {submitted && isActuallyCorrect && <SafeIcon icon={FiCheck} className="w-5 h-5 text-green-500 shrink-0" />}
                        {submitted && isSelected && !isActuallyCorrect && <SafeIcon icon={FiX} className="w-5 h-5 text-red-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {isShortAnswer && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={selectedAnswer}
                    onChange={(e) => handleAnswerSelect(e.target.value)}
                    disabled={submitted}
                    placeholder="Type your answer here..."
                    className={`w-full p-4 border rounded-xl outline-none text-base transition-all text-slate-900 ${
                      submitted 
                        ? (isCorrect ? 'border-green-400 bg-green-50 text-green-900' : 'border-red-400 bg-red-50 text-red-900') 
                        : 'border-slate-200 focus:border-indigo-500 bg-white'
                    }`}
                  />
                </div>
              )}

              {/* Controls inside right column */}
              <div className="mt-8 flex items-center justify-between gap-2">
                <button 
                  onClick={handlePrevQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2.5 text-indigo-600 font-semibold flex items-center gap-2 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Previous
                </button>

                <div className="flex gap-2">
                  {submitted && !isCorrect && (
                    <button
                      onClick={() => {
                        if (planSettings?.feature_ai_tutor) {
                          setShowAITutor(true);
                        } else {
                          if (user?.plan_type === 'free') navigate('/student/upgrade');
                          else alert("AI Tutor is currently disabled by Admin for your plan.");
                        }
                      }}
                      className="px-4 py-2.5 text-indigo-600 border border-indigo-200 font-semibold flex items-center gap-2 hover:bg-indigo-50 rounded-xl transition-colors whitespace-nowrap"
                    >
                      <SafeIcon icon={FiMessageCircle} className="w-4 h-4" /> Chat with AI
                    </button>
                  )}

                  {!submitted ? (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={!selectedAnswer}
                      className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Check Answer
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      disabled={isLastQuestion && savingResult}
                      className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLastQuestion && savingResult ? (
                        <><SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" /> Finishing...</>
                      ) : (
                        <>{isLastQuestion ? 'Finish' : 'Next'} <SafeIcon icon={FiArrowRight} className="w-4 h-4" /></>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Result & Explanation */}
        {submitted && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-slate-100 p-6 md:p-8 flex flex-col gap-6 bg-white"
          >
            {/* Status Blocks Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`rounded-xl p-4 flex items-start gap-3 border ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <div className={`${isCorrect ? 'bg-green-500' : 'bg-red-500'} text-white rounded-full p-1 mt-0.5`}>
                  <SafeIcon icon={isCorrect ? FiCheck : FiX} className="w-4 h-4" />
                </div>
                <div>
                  <div className={`${isCorrect ? 'text-green-900' : 'text-red-900'} font-semibold text-sm`}>Your Answer: {selectedAnswer}</div>
                  <div className={`${isCorrect ? 'text-green-700' : 'text-red-700'} text-xs font-medium`}>{isCorrect ? 'Correct' : 'Incorrect'}</div>
                </div>
              </div>

              {!isCorrect && (
                <div className="bg-green-50 rounded-xl p-4 flex items-start gap-3 border border-green-100">
                  <div className="bg-green-500 text-white rounded-full p-1 mt-0.5">
                    <SafeIcon icon={FiCheck} className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-green-900 font-semibold text-sm">Correct Answer: {correctAnswerLetter}</div>
                    <div className="text-green-700 text-xs font-medium"><MathRenderer text={displayAnswerText} courseId={courseId} /></div>
                  </div>
                </div>
              )}
              {isCorrect && (
                <div className="bg-green-50 rounded-xl p-4 flex items-start gap-3 border border-green-100">
                  <div className="bg-green-500 text-white rounded-full p-1 mt-0.5">
                    <SafeIcon icon={FiCheck} className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-green-900 font-semibold text-sm">Correct Answer: {correctAnswerLetter}</div>
                    <div className="text-green-700 text-xs font-medium"><MathRenderer text={displayAnswerText} courseId={courseId} /></div>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-center gap-1">
                <div className="text-slate-600 text-sm flex items-center gap-2">
                  <SafeIcon icon={FiIcons.FiInfo} className="w-4 h-4 text-slate-400" />
                  <span>Question Status:</span> 
                  <span className={`font-semibold ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                </div>
                <div className="text-slate-600 text-sm flex items-center gap-2">
                  <span className="w-4" />
                  <span>Time Taken:</span>
                  <span className="font-semibold text-slate-800">{timeTakenStr}</span>
                </div>
              </div>
            </div>

            {/* Explanation Section */}
            <div className="mt-2">
              <div className="flex items-center gap-2 text-indigo-600 font-bold mb-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <SafeIcon icon={FiIcons.FiHelpCircle} className="w-4 h-4" />
                </div>
                <span>Explanation</span>
              </div>
              <div className="text-slate-800 text-base md:text-lg font-normal leading-loose bg-white p-2 rounded-xl">
                {currentQuestion.explanation && currentQuestion.explanation.trim() !== '' ? (
                  <MathRenderer text={currentQuestion.explanation} courseId={courseId} />
                ) : (
                  <span className="italic text-slate-500">No detailed explanation provided for this question. You can use the "Chat with AI" feature for help.</span>
                )}
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default PracticeQuizUI;
