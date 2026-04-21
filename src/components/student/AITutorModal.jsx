import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { aiService, planService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { FiX, FiUser, FiCpu, FiSend, FiLightbulb, FiRefreshCw, FiCheck, FiAlertCircle, FiAward } = FiIcons;

const AIQuestionCard = ({ data, onComplete }) => {
  const [selected, setSelected] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Safety checks & Robust Key Extraction
  if (!data) return <div className="text-red-500">Error: Invalid question data</div>;

  // Try to find the question text across common key variations
  const questionText = data.question || data.questionText || data.question_text ||
    data.text || data.Question || "Question text missing";

  // Try to find options
  let safeOptions = data.options || data.choices || data.Options || data.Choices || [];
  if (!Array.isArray(safeOptions)) safeOptions = [];

  const effectiveIsMCQ = safeOptions.length > 1;

  const rawCorrect = (data.correctAnswer || '').toString().trim();
  const letters = ['A', 'B', 'C', 'D', 'E'];
  let correctLetter = '';

  // Determine correct letter/index
  if (letters.includes(rawCorrect.toUpperCase())) {
    correctLetter = rawCorrect.toUpperCase();
  } else {
    const index = safeOptions.findIndex(opt =>
      opt.toString().trim() === rawCorrect || opt.toString().trim().includes(rawCorrect)
    );
    if (index !== -1) correctLetter = letters[index];
  }

  const isCorrect = submitted && (selected === correctLetter);

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
  };

  return (
    <div className="mt-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm text-gray-800 dark:text-gray-200">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
          <SafeIcon icon={FiAward} className="w-3 h-3" /> Practice
        </span>
        {data.concept && (
          <span className="bg-red-50 text-[#E53935] text-xs font-bold px-2 py-1 rounded border border-red-100">
            {data.concept}
          </span>
        )}
      </div>

      <div className="mb-4 font-bold text-lg text-black dark:text-white leading-relaxed">
        <MathRenderer text={questionText} />
      </div>

      {/* Fallback image: show if backend returned an imageUrl and the question text doesn't already embed an <img> */}
      {data.imageUrl && !questionText.includes('<img') && (
        <div className="mb-4 flex justify-center">
          <img
            src={data.imageUrl}
            alt="Question diagram"
            className="max-w-full max-h-[300px] object-contain rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            onError={(e) => e.target.style.display = 'none'}
          />
        </div>
      )}

      {effectiveIsMCQ ? (
        <div className="space-y-2 mb-4">
          {safeOptions.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            let btnClass = "w-full text-left p-3 rounded-lg border text-sm transition-all flex items-center gap-3 font-medium ";

            if (submitted) {
              if (letter === correctLetter) btnClass += "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-400";
              else if (selected === letter) btnClass += "bg-red-50 dark:bg-red-900/20 border-[#E53935] text-[#E53935]";
              else btnClass += "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60";
            } else {
              if (selected === letter) btnClass += "bg-red-50 dark:bg-red-900/20 border-[#E53935]";
              else btnClass += "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700";
            }

            return (
              <button key={i} onClick={() => !submitted && setSelected(letter)} disabled={submitted} className={btnClass}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${submitted && letter === correctLetter ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                  {letter}
                </span>
                <span className="flex-1 text-sm"><MathRenderer text={opt} /></span>
                {submitted && letter === correctLetter && <SafeIcon icon={FiCheck} className="text-green-600 w-4 h-4" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-4 text-gray-500 text-sm italic">
          (Short answer practice not fully supported in preview mode)
        </div>
      )}

      {!submitted ? (
        <button onClick={handleSubmit} disabled={!selected} className="w-full py-2 bg-black text-white rounded-lg font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors">
          Check Answer
        </button>
      ) : (
        <div className="animate-fade-in">
          <div className={`p-3 rounded-lg mb-4 text-sm ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'}`}>
            <p className="font-bold mb-1 flex items-center gap-2">
              <SafeIcon icon={isCorrect ? FiCheck : FiAlertCircle} className="w-4 h-4" />
              {isCorrect ? "Correct! Great job." : "Not quite right."}
            </p>
            <p className="text-gray-700 dark:text-gray-300 mt-2 border-t border-black/5 dark:border-white/5 pt-2 overflow-x-auto whitespace-pre-line break-words max-w-full">
              <strong>Explanation:</strong> <MathRenderer text={data.explanation || "No explanation provided."} />
            </p>
          </div>
          <button onClick={() => onComplete('practice')} className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2">
            <SafeIcon icon={FiRefreshCw} className="w-4 h-4" /> Generate Another
          </button>
        </div>
      )}
    </div>
  );
};

const AITutorModal = ({ question, userAnswer, correctAnswer, onClose }) => {
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

        // CLEAN PAYLOAD: Only send essential text to avoid circular references or token limits
        const questionPayload = {
          question: question.question,
          level: question.level || "Medium",
          concept: question.concept || question.topic || "",
          topic: question.topic || question.concept || "",
          // Pass image URL so backend can replace [DIAGRAM PRESENT] with the actual image
          imageUrl: question.image || question.image_url || question.imageUrl || null
        };

        const previousQuestions = chatMessages
          .filter(m => (m.isQuestion && m.questionData) || m.questions)
          .map(m => {
            if (m.questionData) return m.questionData.question;
            if (m.questions) return m.questions.map(q => q.question || q.text).join(' | ');
            return "";
          });

        console.log('🎯 [AI Tutor] Generating NEW question via OpenAI with KB reference...');
        
        const response = await aiService.generateSimilarQuestion(
          questionPayload,
          previousQuestions
        );
        
        const newQuestion = response.data;
        if (!newQuestion || (!newQuestion.question && !newQuestion.text)) {
          throw new Error("AI failed to generate a valid question");
        }

        // Map AI response format to expected format
        const mappedQuestion = {
          id: newQuestion.id || Date.now(),
          question: newQuestion.question || newQuestion.text,
          options: newQuestion.options || [],
          correctAnswer: newQuestion.correctAnswer,
          explanation: newQuestion.explanation || '',
          concept: newQuestion.topic || newQuestion.concept || questionPayload.concept || 'this topic',
          level: questionPayload.level,
          topic: newQuestion.topic,
          imageUrl: newQuestion.imageUrl || null,
          source: 'AI-Generated (KB Style)'
        };

        setChatMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: `I've generated a new ${questionPayload.level} level practice question for you on **${mappedQuestion.concept}**.`,
            isQuestion: true,
            questionData: mappedQuestion
          }
        ]);
      }
    } catch (err) {
      console.error("AI Action Error:", err);

      let errorMsg = "Something went wrong while connecting to the AI.";
      let detailMsg = "Please check your network connection and try again.";

      if (err.response) {
        if (err.response.status === 404) {
          errorMsg = "Service Endpoint Not Found (404)";
          detailMsg = "The AI service route is missing. Please restart the backend server.";
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
      // Extract question count from user message with improved pattern matching
      const countPatterns = [
        /(\d+)\s+(?:questions?|problems?|items?|exercises?)/i,
        /(?:give me|quiz me|want|need)\s+(\d+)/i,
        /(\d+)\s*[-–—]\s*question/i,
      ];
      
      let requestedCount = 5; // Default
      for (const pattern of countPatterns) {
        const match = currentInput.match(pattern);
        if (match && match[1]) {
          const val = parseInt(match[1]);
          if (!isNaN(val) && val > 0) {
            requestedCount = Math.min(val, 50); // Cap at 50 for performance
            console.log(`[AI Tutor] Extracted count: ${requestedCount} from "${currentInput}"`);
            break;
          }
        }
      }
      
      // Check if user is asking for practice/questions
      const isQuestionRequest = currentInput.toLowerCase().includes('question') || 
                               currentInput.toLowerCase().includes('practice') ||
                               currentInput.toLowerCase().includes('quiz') ||
                               currentInput.toLowerCase().includes('give me');

      if (isQuestionRequest) {
        // Use AI generation with KB reference for question requests
        const topic = question?.topic || question?.concept || "this topic";
        console.log(`🎯 [AI Tutor] Manual question request for topic: "${topic}"`);
        
        const response = await aiService.generateSimilarQuestion(
          {
            question: question?.question || "",
            level: question?.level || "Medium",
            concept: topic,
            topic
          },
          chatMessages.filter(m => m.isQuestion).map(m => m.questionData?.question || "")
        );

        const newQuestion = response.data;
        if (newQuestion && (newQuestion.question || newQuestion.text)) {
          const mappedQuestion = {
            id: newQuestion.id || Date.now(),
            question: newQuestion.question || newQuestion.text,
            options: newQuestion.options || [],
            correctAnswer: newQuestion.correctAnswer,
            explanation: newQuestion.explanation || '',
            concept: newQuestion.topic || newQuestion.concept || topic,
            level: question?.level || 'Medium',
            topic: newQuestion.topic,
            source: 'AI-Generated (KB Style)'
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
        // Use regular chat for other requests
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
      console.error("AI Chat Error:", err);
      setChatMessages(prev => [
        ...prev,
        { id: Date.now(), sender: 'ai', text: "Service unavailable. Please check your connection." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black bg-opacity-80 flex items-end md:items-center justify-center p-0 md:p-4 z-50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-4xl h-[100dvh] md:h-[85vh] flex flex-col overflow-hidden border border-gray-800 dark:border-gray-700 mobile-safe">

        {/* Header */}
        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-3 md:p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-800 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#E53935] to-[#FF5722] p-2.5 rounded-xl shadow-lg shadow-red-500/20">
              <SafeIcon icon={FiCpu} className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg text-slate-900 dark:text-white tracking-tight">AI Tutor Assistant</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Precision Mode • {question?.level || 'Medium'} Level
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all active:scale-90"
          >
            <SafeIcon icon={FiX} className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel (Original Question) */}
          <div className="hidden md:block w-1/3 bg-[#FAFAFA] dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 p-6 overflow-y-auto">
            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Original Context</h4>
              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-800 dark:text-gray-200 shadow-sm leading-relaxed font-medium">
                <MathRenderer text={question?.question || "No question loaded"} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-3 rounded-lg">
                <span className="text-xs font-bold text-[#E53935] block mb-1">Your Answer</span>
                <span className="text-black dark:text-white text-sm font-bold">{userAnswer || 'No answer'}</span>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-3 rounded-lg">
                <span className="text-xs font-bold text-green-600 dark:text-green-400 block mb-1">Correct Answer</span>
                <span className="text-black dark:text-white text-sm font-bold">{correctAnswer || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Right Panel (Chat) */}
          <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
            {!featureEnabled ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-3xl flex items-center justify-center text-amber-600">
                    <SafeIcon icon={FiIcons.FiZap} className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">AI Tutor is Premium</h3>
                    <p className="text-gray-500 text-sm font-medium max-w-xs">
                        Unlock your personal AI study companion to get instant explanations and custom practice questions.
                    </p>
                </div>
                <button 
                    onClick={() => { onClose(); window.location.href = '/student/upgrade'; }}
                    className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
                >
                    Upgrade to Premium
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 bg-white dark:bg-gray-900">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[95%] md:max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.sender === 'user' ? 'bg-[#E53935]' : 'bg-black'}`}>
                      <SafeIcon icon={msg.sender === 'user' ? FiUser : FiCpu} className="w-4 h-4 text-white" />
                    </div>

                    <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed w-full font-medium ${msg.sender === 'user' ? 'bg-[#E53935] text-white rounded-tr-none' : 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>
                      <p className="whitespace-pre-wrap"><MathRenderer text={msg.text} /></p>

                      {msg.isQuestion && msg.questionData && (
                        <AIQuestionCard data={msg.questionData} onComplete={handleAction} />
                      )}

                      {msg.questions && Array.isArray(msg.questions) && (
                        <div className="mt-4 space-y-3">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                            Found {msg.questions.length} questions from Knowledge Base:
                          </p>
                          {msg.questions.map((q, index) => (
                            <div key={q.id || index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="bg-black text-white text-xs font-bold px-2 py-1 rounded">
                                  Q{index + 1}
                                </span>
                                {q.topic && (
                                  <span className="bg-red-50 text-red-700 text-xs font-bold px-2 py-1 rounded border border-red-100">
                                    {q.topic}
                                  </span>
                                )}
                                {q.difficulty && (
                                  <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-100">
                                    {q.difficulty}
                                  </span>
                                )}
                              </div>
                              <div className="font-medium text-sm mb-2">
                                <MathRenderer text={q.text || q.question} />
                              </div>
                              {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                                <div className="space-y-1">
                                  {q.options.map((opt, i) => (
                                    <div key={i} className="text-sm text-gray-600 dark:text-gray-400">
                                      {String.fromCharCode(65 + i)}. {opt}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {q.correctAnswer && (
                                <div className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">
                                  Correct: {q.correctAnswer}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.options && (
                        <div className="mt-4 flex flex-col gap-2">
                          {msg.options.map((opt, idx) => (
                            <button key={idx} onClick={() => handleAction(opt.action)} className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-lg text-sm font-bold text-left flex items-center gap-3 border border-gray-200 dark:border-gray-600 transition-colors shadow-sm">
                              <SafeIcon icon={opt.action === 'simplify' ? FiLightbulb : FiRefreshCw} className="w-4 h-4 text-[#E53935]" />
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
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 pl-4 pr-12 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none text-sm dark:text-white dark:caret-white transition-shadow font-medium"
                />
                <button onClick={handleSendMessage} disabled={!inputValue.trim() || loading} className="absolute right-2 top-2 bottom-2 bg-black hover:bg-gray-800 text-white px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
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

export default AITutorModal;