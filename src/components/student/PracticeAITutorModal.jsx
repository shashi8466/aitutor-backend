import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { aiService, planService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { FiX, FiUser, FiCpu, FiSend, FiLightbulb, FiRefreshCw, FiCheck, FiAlertCircle, FiAward, FiFileText, FiAlertTriangle } = FiIcons;

const AIQuestionCard = ({ data, onComplete }) => {
  const [selected, setSelected] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!data) return <div className="text-red-500">Error: Invalid question data</div>;

  let baseQuestion = data.question || data.questionText || data.question_text ||
    data.text || data.Question || "Question text missing";

  let safeOptions = data.options || data.choices || data.Options || data.Choices || [];
  if (!Array.isArray(safeOptions)) safeOptions = [];

  const firstOpt = safeOptions[0];
  let leakage = "";
  if (typeof firstOpt === 'string' && firstOpt.length > 5) {
    const letter = 'A';
    const labelMatch = firstOpt.match(new RegExp(`(?:^|\\s)(${letter}[\\)|\\.\\s]|\\(${letter}\\)|Choice\\s+${letter})`, 'i'));
    if (labelMatch && labelMatch.index > 3) {
      leakage = firstOpt.substring(0, labelMatch.index).trim();
      console.log(`🔍 [Leakage Detected] Found spilling text: "${leakage}"`);
    }
  }

  const questionText = leakage ? `${baseQuestion} ${leakage}` : baseQuestion;
  const effectiveIsMCQ = safeOptions.length > 1;

  const rawCorrect = (data.correctAnswer || '').toString().trim();
  const letters = ['A', 'B', 'C', 'D', 'E'];
  let correctLetter = '';

  if (effectiveIsMCQ) {
    if (letters.includes(rawCorrect.toUpperCase())) {
      correctLetter = rawCorrect.toUpperCase();
    } else {
      const index = safeOptions.findIndex(opt =>
        opt.toString().trim() === rawCorrect || opt.toString().trim().includes(rawCorrect)
      );
      if (index !== -1) correctLetter = letters[index];
    }
  }

  const isCorrect = submitted && (
    effectiveIsMCQ 
      ? (selected === correctLetter)
      : (selected.trim().toLowerCase() === rawCorrect.toLowerCase())
  );

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
  };

  const cleanOption = (text, index) => {
    if (typeof text !== 'string') return text;
    const letter = String.fromCharCode(65 + index);
    const labelPattern = new RegExp(`(?:^|\\s)(${letter}[\\)|\\.\\s]|\\(${letter}\\)|Choice\\s+${letter})`, 'i');
    const match = text.match(labelPattern);
    if (match) {
      return text.substring(match.index + match[0].length).trim();
    }
    return text.trim();
  };

  return (
    <div className="mt-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-800">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1.5">
          <SafeIcon icon={FiAward} className="w-3 h-3" /> Practice
        </span>
        {data.concept && (
          <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
            {data.concept}
          </span>
        )}
      </div>

      {data.passage && (
        <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm overflow-y-auto max-h-[250px] text-slate-700 font-medium">
          <MathRenderer text={data.passage} />
        </div>
      )}

      {data.imageUrl && !questionText.includes('<img') && (!data.passage || !data.passage.includes('<img')) && (
        <div className="mb-5 flex justify-center">
          <img
            src={data.imageUrl}
            alt="Question diagram"
            className="max-w-full max-h-[300px] object-contain rounded-xl border border-slate-200 shadow-sm bg-white"
            onError={(e) => e.target.style.display = 'none'}
          />
        </div>
      )}

      <div className="mb-6 font-bold text-[15px] text-slate-900 leading-relaxed">
        <MathRenderer text={questionText} />
      </div>

      {effectiveIsMCQ ? (
        <div className="space-y-2 mb-6">
          {safeOptions.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            let btnClass = "w-full text-left p-4 rounded-xl border text-[14px] transition-all flex items-center gap-4 font-medium ";

            if (submitted) {
              if (letter === correctLetter) btnClass += "bg-green-50 border-green-400 text-green-900 ring-1 ring-green-400";
              else if (selected === letter) btnClass += "bg-red-50 border-red-400 text-red-900 ring-1 ring-red-400";
              else btnClass += "bg-white border-slate-100 opacity-60 text-slate-500";
            } else {
              if (selected === letter) btnClass += "bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500";
              else btnClass += "bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-slate-700";
            }

            return (
              <button key={i} onClick={() => !submitted && setSelected(letter)} disabled={submitted} className={btnClass}>
                <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 shadow-sm ${submitted && letter === correctLetter ? 'bg-green-500 text-white border-green-500' : (selected === letter && !submitted ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300 text-slate-600')}`}>
                  {letter}
                </span>
                <span className="flex-1 text-[15px]"><MathRenderer text={cleanOption(opt, i)} /></span>
                {submitted && letter === correctLetter && <SafeIcon icon={FiCheck} className="text-green-500 w-5 h-5 shrink-0" />}
                {submitted && selected === letter && letter !== correctLetter && <SafeIcon icon={FiX} className="text-red-500 w-5 h-5 shrink-0" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Your Answer</label>
          <input
            type="text"
            disabled={submitted}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            placeholder="Type your answer here..."
            className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all disabled:opacity-70 disabled:bg-slate-50 shadow-sm"
          />
        </div>
      )}

      {!submitted ? (
        <button onClick={handleSubmit} disabled={!selected.toString().trim()} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
          Check Answer
        </button>
      ) : (
        <div className="animate-fade-in mt-4">
          <div className={`p-5 rounded-2xl mb-4 text-sm ${isCorrect ? 'bg-green-50 text-green-900 border border-green-200' : 'bg-red-50 text-red-900 border border-red-200'}`}>
            <p className="font-bold mb-2 flex items-center gap-2 text-base">
              <SafeIcon icon={isCorrect ? FiCheck : FiAlertCircle} className="w-5 h-5" />
              {isCorrect ? "Correct answer!" : "Incorrect"}
            </p>
            {!isCorrect && <p className="text-sm font-semibold opacity-80 mt-1">Correct Answer: {rawCorrect}</p>}
            <div className="text-slate-700 mt-4 border-t border-black/5 pt-4 overflow-x-auto whitespace-pre-line break-words max-w-full leading-relaxed">
              <strong>Explanation:</strong> <MathRenderer text={data.explanation || "No explanation provided."} />
            </div>
          </div>
          <button onClick={() => onComplete('practice')} className="w-full py-3.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
            <SafeIcon icon={FiRefreshCw} className="w-4 h-4" /> Next Question
          </button>
        </div>
      )}
    </div>
  );
};

const PracticeAITutorModal = ({ question, userAnswer, correctAnswer, onClose, isACT, fallbackQuestions = [], courseTopic, subjectGroup = null }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "I noticed you had some trouble with this question. How can I help you understand it better?",
      options: [
        { label: "Explain the Concept", action: 'simplify' },
        { label: "Generate Practice Question", action: 'practice' }
      ]
    }
  ]);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const currentPlan = user?.plan_type || 'free';
      const { data: settings } = await planService.getSettings();
      const currentSettings = (settings || []).find(s => s.plan_type === currentPlan);
      setFeatureEnabled(currentSettings?.feature_ai_tutor !== false);
    } catch (err) {
      console.error("Failed to check AI access:", err);
    }
  };
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, loading]);

  const handleAction = async (action) => {
    const userText = action === 'simplify' ? "Explain the concept in a simpler way." : "Generate a similar practice question.";

    setChatMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userText }]);
    setLoading(true);

    try {
      if (action === 'simplify') {
        const response = await aiService.getExplanation(
          question?.question || "No question context",
          userAnswer || "No answer",
          correctAnswer || "No correct answer"
        );

        const data = response.data || {};
        let replyText = `**Core Concept:** ${data.concept || "Review"}\n\n${data.explanation || "I couldn't generate an explanation."}`;

        if (data.steps && Array.isArray(data.steps)) {
          replyText += "\n\n**Steps:**\n" + data.steps.map(s => `- ${s}`).join('\n');
        }

        setChatMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: replyText,
            options: [{ label: "Generate Practice Question", action: 'practice' }]
          }
        ]);

      } else if (action === 'practice') {
        if (!question) throw new Error("Question context missing");

        const questionPayload = {
          question: question.question,
          level: question.level || "Medium",
          concept: question.concept || question.topic || courseTopic || "",
          topic: question.topic || question.concept || courseTopic || "",
          options: question.options || [],
          correctAnswer: question.correctAnswer || "",
          explanation: question.explanation || "",
          imageUrl: question.image || question.image_url || question.imageUrl || null,
          passage: question.passage || question.passageText || null
        };

        const previousQuestions = chatMessages
          .filter(m => (m.isQuestion && m.questionData) || m.questions)
          .map(m => {
            if (m.questionData) return m.questionData.question;
            if (m.questions) return m.questions.map(q => q.question || q.text).join(' | ');
            return "";
          });

        let newQuestion = null;
        let isFallback = false;
        let kbError = null;
        try {
          const response = await aiService.generateSimilarQuestion(
            questionPayload,
            previousQuestions,
            isACT,
            subjectGroup
          );
          newQuestion = response.data;
        } catch (e) {
          kbError = e;
          console.warn("[AI Tutor] KB fallback error:", e);
        }

        if (!newQuestion || (!newQuestion.question && !newQuestion.text)) {
          if (fallbackQuestions && fallbackQuestions.length > 0) {
            const availableFallbacks = fallbackQuestions.filter(fq =>
              !previousQuestions.includes(fq.question || fq.text)
            );
            if (availableFallbacks.length > 0) {
              const randomIndex = Math.floor(Math.random() * availableFallbacks.length);
              newQuestion = availableFallbacks[randomIndex];
              isFallback = true;
            }
          }
        }

        if (!newQuestion || (!newQuestion.question && !newQuestion.text)) {
          // Surface the real backend/network error instead of a generic message when one exists.
          throw kbError || new Error("Failed to fetch a practice question.");
        }

        const mappedQuestion = {
          id: newQuestion.id || Date.now(),
          question: newQuestion.question || newQuestion.text,
          passage: newQuestion.passage || newQuestion.passageText || questionPayload.passage || null,
          options: newQuestion.options || [],
          correctAnswer: newQuestion.correctAnswer,
          explanation: newQuestion.explanation || '',
          concept: newQuestion.topic || newQuestion.concept || questionPayload.concept || 'this topic',
          level: questionPayload.level,
          topic: newQuestion.topic,
          imageUrl: newQuestion.imageUrl || questionPayload.imageUrl || null,
          source: isFallback ? 'Test Set Fallback' : 'Knowledge Base'
        };

        const aiMessageText = isACT 
          ? `I've found a practice question for you on **${mappedQuestion.concept}**.`
          : `I've found a ${questionPayload.level} level practice question for you from the Knowledge Base on **${mappedQuestion.concept}**.`;

        setChatMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: aiMessageText,
            isQuestion: true,
            questionData: mappedQuestion
          }
        ]);
      }
    } catch (err) {
      let errorMsg = "Something went wrong while connecting to the AI.";
      let detailMsg = "Please check your network connection and try again.";

      if (err.response) {
        if (err.response.status === 404) {
          errorMsg = err.response.data?.error || "Service Endpoint Not Found (404)";
          detailMsg = err.response.data?.error ? "Please try a different topic or difficulty level." : "The AI service route is missing.";
        } else if (err.response.data && err.response.data.error) {
          errorMsg = "AI Service Error";
          detailMsg = typeof err.response.data.error === 'string'
            ? err.response.data.error
            : JSON.stringify(err.response.data.error);
        }
      } else if (err.message) {
        detailMsg = err.message;
      }

      setChatMessages(prev => [
        ...prev,
        { id: Date.now(), sender: 'ai', text: `**${errorMsg}**\n\n${detailMsg}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    setChatMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: inputValue }]);
    const currentInput = inputValue;
    setInputValue('');
    setLoading(true);

    try {
      const countPatterns = [
        /(\d+)\s+(?:questions?|problems?|items?|exercises?)/i,
        /(?:give me|quiz me|want|need)\s+(\d+)/i,
        /(\d+)\s*[-–—]\s*question/i,
      ];
      
      let requestedCount = 5;
      for (const pattern of countPatterns) {
        const match = currentInput.match(pattern);
        if (match && match[1]) {
          const val = parseInt(match[1]);
          if (!isNaN(val) && val > 0) {
            requestedCount = Math.min(val, 50);
            break;
          }
        }
      }
      
      const isQuestionRequest = currentInput.toLowerCase().includes('question') || 
                               currentInput.toLowerCase().includes('practice') ||
                               currentInput.toLowerCase().includes('quiz') ||
                               currentInput.toLowerCase().includes('give me');

      if (isQuestionRequest) {
        const topic = question?.topic || question?.concept || "this topic";
        
        let newQuestion = null;
        let isFallback = false;
        try {
          const response = await aiService.generateSimilarQuestion(
            {
              question: question?.question || "",
              level: question?.level || "Medium",
              concept: topic,
              topic
            },
            chatMessages.filter(m => m.isQuestion).map(m => m.questionData?.question || ""),
            isACT,
            subjectGroup
          );
          newQuestion = response.data;
        } catch (e) {
          console.warn("[AI Tutor] Manual KB fallback error:", e);
        }

        if (!newQuestion || (!newQuestion.question && !newQuestion.text)) {
          if (fallbackQuestions && fallbackQuestions.length > 0) {
            const previousQuestions = chatMessages.filter(m => m.isQuestion).map(m => m.questionData?.question || "");
            const availableFallbacks = fallbackQuestions.filter(fq => 
              !previousQuestions.includes(fq.question || fq.text)
            );
            if (availableFallbacks.length > 0) {
              const randomIndex = Math.floor(Math.random() * availableFallbacks.length);
              newQuestion = availableFallbacks[randomIndex];
              isFallback = true;
            }
          }
        }

        if (newQuestion && (newQuestion.question || newQuestion.text)) {
          const mappedQuestion = {
            id: newQuestion.id || Date.now(),
            question: newQuestion.question || newQuestion.text,
            passage: newQuestion.passage || newQuestion.passageText || question?.passage || question?.passageText || null,
            options: newQuestion.options || [],
            correctAnswer: newQuestion.correctAnswer,
            explanation: newQuestion.explanation || '',
            concept: newQuestion.topic || newQuestion.concept || topic,
            level: question?.level || 'Medium',
            topic: newQuestion.topic,
            imageUrl: newQuestion.imageUrl || question?.image || question?.image_url || question?.imageUrl || null,
            source: isFallback ? 'Test Set Fallback' : 'AI-Generated'
          };
          
          setChatMessages(prev => [
            ...prev,
            { 
              id: Date.now() + 1, 
              sender: 'ai', 
              text: `Here is a fresh practice question on **${mappedQuestion.concept}**:`,
              isQuestion: true,
              questionData: mappedQuestion
            }
          ]);
        } else {
          setChatMessages(prev => [
            ...prev,
            { id: Date.now() + 1, sender: 'ai', text: "I tried to generate a question but something went wrong. Could you please try again?" }
          ]);
        }
      } else {
        const response = await aiService.chatWithContent(
          currentInput,
          `Original Question: ${question?.question || ''}\nCorrect Answer: ${correctAnswer || ''}\nStudent Answered: ${userAnswer || ''}`,
          chatMessages
        );

        setChatMessages(prev => [
          ...prev,
          { id: Date.now() + 1, sender: 'ai', text: response.data?.reply || "I'm analyzing that..." }
        ]);
      }
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { id: Date.now(), sender: 'ai', text: "Service unavailable. Please check your connection." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-slate-900/40 flex items-end md:items-center justify-center p-0 md:p-6 z-[999999] backdrop-blur-sm">
      <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-t-[2rem] md:rounded-2xl shadow-2xl w-full max-w-5xl h-[92dvh] md:h-[85vh] flex flex-col overflow-hidden border border-slate-200 mobile-safe">

        {/* Header */}
        <div className="bg-white p-5 flex justify-between items-center border-b border-slate-100 shadow-sm z-30">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-md shadow-indigo-500/20">
              <SafeIcon icon={FiCpu} className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 tracking-tight">AI Tutor Assistant</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Precision Mode {isACT ? '' : `• ${question?.level || 'Easy'} Level`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-90"
          >
            <SafeIcon icon={FiX} className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel (Original Question) */}
          <div className="hidden md:flex w-1/3 bg-[#FAFAFA] border-r border-slate-200 p-6 flex-col overflow-y-auto">
            <div className="mb-6 flex-1">
              <h4 className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <SafeIcon icon={FiFileText} className="w-4 h-4" /> Original Context
              </h4>
              
              {question?.passage && (
                <div className="mb-4 bg-white p-4 rounded-xl border border-slate-200 text-sm text-slate-700 shadow-sm leading-relaxed overflow-y-auto max-h-[250px]">
                  <MathRenderer text={question.passage} />
                </div>
              )}
              {(() => {
                const img = question?.image || question?.image_url || question?.imageUrl;
                return img && (!question?.question?.includes('<img') && (!question?.passage || !question.passage.includes('<img'))) ? (
                  <div className="mb-4 flex justify-center bg-white p-2 rounded-xl border border-slate-200">
                    <img src={img} alt="Original Diagram" className="max-w-full max-h-[200px] object-contain rounded-lg" />
                  </div>
                ) : null;
              })()}
              <div className="bg-[#F4F1FB] p-5 rounded-2xl text-sm text-slate-800 leading-relaxed font-medium">
                <MathRenderer text={question?.question || "No question loaded"} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl">
                <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest block mb-2">Your Answer</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 text-[15px] font-bold">{userAnswer || 'No answer'}</span>
                  <SafeIcon icon={FiX} className="text-red-500 w-5 h-5" />
                </div>
              </div>
              <div className="bg-green-50/50 border border-green-100 p-4 rounded-2xl">
                <span className="text-[11px] font-bold text-green-600 uppercase tracking-widest block mb-2">Correct Answer</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 text-[15px] font-bold">{correctAnswer || 'Unknown'}</span>
                  <SafeIcon icon={FiCheck} className="text-green-500 w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel (Chat) */}
          <div className="flex-1 flex flex-col bg-white">
            {!featureEnabled ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600">
                    <SafeIcon icon={FiIcons.FiZap} className="w-10 h-10" />
                </div>
                <div className="space-y-4">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900">AI Tutor is Premium</h3>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium max-w-[280px] sm:max-w-xs">
                        Unlock your personal AI study companion to get instant explanations and custom practice questions.
                    </p>
                </div>
                <button 
                    onClick={() => { onClose(); window.location.href = '/student/upgrade'; }}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all"
                >
                    Upgrade to Premium
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-white">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex gap-3 max-w-[95%] md:max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>

                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600' : 'bg-indigo-50 border border-indigo-100'}`}>
                          <SafeIcon icon={msg.sender === 'user' ? FiUser : FiCpu} className={`w-4 h-4 ${msg.sender === 'user' ? 'text-white' : 'text-indigo-600'}`} />
                        </div>

                        <div className={`p-4 md:p-5 rounded-2xl shadow-sm text-sm leading-relaxed w-full font-medium ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                          <p className="whitespace-pre-wrap"><MathRenderer text={msg.text} /></p>

                          {msg.isQuestion && msg.questionData && (
                            <AIQuestionCard data={msg.questionData} onComplete={handleAction} />
                          )}

                          {msg.options && (
                            <div className="mt-5 flex flex-col gap-3">
                              {msg.options.map((opt, idx) => (
                                <button key={idx} onClick={() => handleAction(opt.action)} className={`bg-white hover:bg-slate-50 text-indigo-600 px-5 py-3.5 rounded-xl text-sm font-bold text-left flex items-center gap-3 border ${opt.action === 'simplify' ? 'border-red-200' : 'border-indigo-200'} transition-colors shadow-sm`}>
                                  <SafeIcon icon={opt.action === 'simplify' ? FiAlertTriangle : FiRefreshCw} className={`w-4 h-4 ${opt.action === 'simplify' ? 'text-red-400' : 'text-indigo-500'}`} />
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-100 px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-100 pb-safe">
                  <div className="flex gap-2 relative max-w-3xl mx-auto w-full">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask a follow-up question..."
                      className="flex-1 pl-5 pr-14 py-4 border border-slate-200 bg-white rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-[15px] text-slate-800 transition-shadow font-medium shadow-sm placeholder-slate-400"
                    />
                    <button onClick={handleSendMessage} disabled={!inputValue.trim() || loading} className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm">
                      <SafeIcon icon={FiSend} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PracticeAITutorModal;
