import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import MathRenderer from '../../../common/MathRenderer';
import ReactMarkdown from 'react-markdown';
import { aiService } from '../../../services/api';
import axios from 'axios';

const { FiMessageSquare, FiLayers, FiCheckSquare, FiFileText, FiSend, FiLoader, FiCpu, FiHeadphones, FiList, FiPlay, FiPause, FiChevronRight, FiAlertTriangle, FiUser, FiAward } = FiIcons;

const checkBackendHealth = async () => {
  try {
    const res = await axios.get('/api/health');
    return res.data && res.data.status === 'ok';
  } catch (err) {
    return false;
  }
};

const SmartAIPanel = ({ content, summary }) => {
  // Tabs: chat, flashcards, quiz, podcast, summary, chapters, exam
  const [activeTab, setActiveTab] = useState('chapters');

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // Data Cache
  const [dataCache, setDataCache] = useState({
    flashcards: [],
    quiz: [],
    chapters: [],
    exam: { Easy: [], Medium: [], Hard: [] },
    podcast: null,
    summary: summary || null
  });

  const [userExamAnswers, setUserExamAnswers] = useState({});
  const [userQuizAnswers, setUserQuizAnswers] = useState({});
  const [examVisibility, setExamVisibility] = useState({ Easy: true, Medium: true, Hard: true });

  // Ensure content is always a string to prevent errors
  const safeContent = content || '';

  // Loading States
  const [loading, setLoading] = useState(false);
  const [examLoading, setExamLoading] = useState(false);
  const [examProgress, setExamProgress] = useState({ current: 0, total: 60 });
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const speechRef = useRef(null);

  const chatEndRef = useRef(null);

  // Check backend status on mount
  useEffect(() => {
    const checkStatus = async () => {
      const isHealthy = await checkBackendHealth();
      setBackendStatus(isHealthy ? 'online' : 'offline');
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initialize welcome message and summary
  useEffect(() => {
    if (content) {
      if (messages.length === 0) {
        setMessages([{ id: 1, sender: 'ai', text: `**Welcome!** I've analyzed your document. Check the **Chapters** tab for an outline, or ask me anything here.` }]);
      }

      // Update summary if passed via props later
      if (summary && !dataCache.summary) {
        setDataCache(prev => ({ ...prev, summary }));
      }
    }
    return () => window.speechSynthesis.cancel();
  }, [content, summary]);

  // Auto-load Chapters
  useEffect(() => {
    if (content && backendStatus === 'online' && !initialLoadAttempted && (!dataCache.chapters || dataCache.chapters.length === 0)) {
      setInitialLoadAttempted(true);
      const timer = setTimeout(() => {
        loadChaptersInitial();
        // Removed auto-generation of full exam to allow manual selection by difficulty
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [content, backendStatus, initialLoadAttempted, dataCache.chapters]);

  const loadChaptersInitial = async () => {
    if (!safeContent || safeContent.trim().length < 50) return;
    setLoading(true);
    setError(null);
    try {
      const res = await aiService.generateChapters(safeContent);
      if (res?.data) {
        let rawData = res.data.chapters !== undefined ? res.data.chapters : (res.data || []);
        rawData = Array.isArray(rawData) ? rawData : [];
        setDataCache(prev => ({ ...prev, chapters: rawData }));
      }
    } catch (err) {
      console.error('Failed to auto-load chapters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const loadFeature = async (feature) => {
    setError(null);
    if (feature === 'chat') {
      if (!safeContent) {
        setError("No content available for chat.");
        return;
      }
      setActiveTab('chat');
      return;
    }

    if (feature === 'exam') {
      setActiveTab('exam');
      return;
    }

    if (dataCache[feature] && (Array.isArray(dataCache[feature]) ? dataCache[feature].length > 0 : dataCache[feature])) {
      setActiveTab(feature);
      return;
    }

    setActiveTab(feature);
    setLoading(true);

    const isBackendHealthy = await checkBackendHealth();
    if (!isBackendHealthy) {
      setError("Backend server is not running.");
      setLoading(false);
      return;
    }

    try {
      if (!safeContent) throw new Error("No text content available.");
      let res;
      if (feature === 'flashcards') res = await aiService.generateFlashcards(safeContent);
      else if (feature === 'quiz') res = await aiService.generateQuizFromContent(safeContent);
      else if (feature === 'chapters') res = await aiService.generateChapters(safeContent);
      else if (feature === 'podcast') res = await aiService.generatePodcastScript(safeContent);
      else if (feature === 'summary') res = await aiService.summarizeContent(safeContent);

      if (res && res.data) {
        let rawData = (feature === 'summary' || feature === 'podcast') ? (res.data || {}) : (res.data[feature] || res.data || []);
        if (feature === 'flashcards' && res.data.flashcards !== undefined) rawData = res.data.flashcards;
        else if (feature === 'quiz' && res.data.quiz !== undefined) rawData = res.data.quiz;
        else if (feature === 'chapters' && res.data.chapters !== undefined) rawData = res.data.chapters;

        setDataCache(prev => ({ ...prev, [feature]: rawData }));
      }
    } catch (err) {
      console.error(`Failed to load ${feature}:`, err);
      setError(err.message || `Failed to generate ${feature}.`);
    } finally {
      setLoading(false);
    }
  };

  const generateExamByDifficulty = async (difficulty) => {
    if (!safeContent || examLoading) return;
    setExamLoading(true);

    const targetCount = 20;
    const batchSize = 5;
    let currentLoaded = dataCache.exam[difficulty]?.length || 0;

    setExamProgress({ current: currentLoaded, total: targetCount });
    setError(null);

    try {
      let attempts = 0;
      const maxAttempts = 8;

      while (currentLoaded < targetCount && attempts < maxAttempts) {
        attempts++;
        const needed = targetCount - currentLoaded;
        const currentBatchSize = Math.min(needed, batchSize);

        console.log(`Generating ${difficulty} batch: ${currentLoaded}/${targetCount}`);
        const res = await aiService.generateExam(safeContent, difficulty, currentBatchSize);
        const newQuestions = res.data?.questions || [];

        if (newQuestions.length > 0) {
          currentLoaded += newQuestions.length;
          setDataCache(prev => ({
            ...prev,
            exam: {
              ...prev.exam,
              [difficulty]: [...prev.exam[difficulty], ...newQuestions]
            }
          }));

          setExamProgress(prev => ({
            ...prev,
            current: currentLoaded
          }));
        } else {
          if (attempts > 4) break;
        }
      }
    } catch (err) {
      console.error(`${difficulty} exam generation failed:`, err);
      setError(`${difficulty} generation stopped. Click button to resume.`);
    } finally {
      setExamLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    const userMsg = { id: Date.now(), sender: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await aiService.chatWithContent(userText, safeContent, messages);
      const reply = res?.data?.reply || "I couldn't generate a response.";
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: "Connection error." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExamSelect = (diff, qIndex, optionIndex) => {
    const key = `${diff}-${qIndex}`;
    if (userExamAnswers[key]) return; // Prevent re-answering
    setUserExamAnswers(prev => ({
      ...prev,
      [key]: String.fromCharCode(65 + optionIndex)
    }));
  };

  const handleQuizSelect = (qIndex, optionIndex) => {
    const key = `quiz-${qIndex}`;
    if (userQuizAnswers[key]) return;
    setUserQuizAnswers(prev => ({
      ...prev,
      [key]: String.fromCharCode(65 + optionIndex)
    }));
  };

  const toggleExamVisibility = (diff) => {
    setExamVisibility(prev => ({ ...prev, [diff]: !prev[diff] }));
  };

  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else if (dataCache.podcast?.script) {
        const utterance = new SpeechSynthesisUtterance(dataCache.podcast.script);
        utterance.rate = 1.0;
        utterance.onend = () => setIsPlaying(false);
        speechRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    }
  };

  const renderLoading = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-gray-400">
      <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-[#E53935] mb-4" />
      <p className="font-medium text-sm text-gray-600">Generating {activeTab}...</p>
    </motion.div>
  );

  const renderError = () => (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
      <SafeIcon icon={FiAlertTriangle} className="w-10 h-10 text-yellow-500 mb-4" />
      <p className="text-gray-600 font-medium mb-4">{error || "Something went wrong."}</p>
      <button onClick={() => loadFeature(activeTab)} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800">
        Retry
      </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#F9FAFB]">
      {backendStatus === 'offline' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-red-800 font-bold">
            <SafeIcon icon={FiAlertTriangle} className="w-4 h-4" />
            <span>Backend offline (npm run server)</span>
          </div>
          <button onClick={() => checkBackendHealth().then(h => setBackendStatus(h ? 'online' : 'offline'))} className="text-red-700 underline">Retry</button>
        </div>
      )}

      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2 overflow-x-auto no-scrollbar shadow-sm z-10">
        {[
          { id: 'chapters', icon: FiList, label: 'Chapters' },
          { id: 'chat', icon: FiMessageSquare, label: 'Chat' },
          { id: 'flashcards', icon: FiLayers, label: 'Flashcards' },
          { id: 'quiz', icon: FiCheckSquare, label: 'Quizzes' },
          { id: 'exam', icon: FiAward, label: 'Full Exam' },
          { id: 'podcast', icon: FiHeadphones, label: 'Podcast' },
          { id: 'summary', icon: FiFileText, label: 'Summary' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => loadFeature(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${activeTab === tab.id ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
          >
            <SafeIcon icon={tab.icon} className="w-3 h-3" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative custom-scrollbar">
        <AnimatePresence mode="wait">
          {loading && activeTab !== 'chat' ? (
            <div className="h-full" key="loading">{renderLoading()}</div>
          ) : error ? (
            <div className="h-full" key="error">{renderError()}</div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'chapters' && (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {dataCache.chapters && dataCache.chapters.map((chap, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                      <div className="w-10 h-10 rounded-lg bg-black text-white dark:bg-gray-800 dark:text-gray-300 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{chap.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">{chap.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'quiz' && (
                <div className="space-y-6 max-w-3xl mx-auto pb-10">
                  <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-8 text-center">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Interactive Document Quiz</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">10 multiple-choice questions generated from your content.</p>
                  </div>

                  {dataCache.quiz && dataCache.quiz.map((q, i) => {
                    const answerKey = `quiz-${i}`;
                    const selectedAnswer = userQuizAnswers[answerKey];
                    const isCorrect = selectedAnswer === q.correctAnswer;

                    return (
                      <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm" >
                        <div className="flex gap-4 mb-6">
                          <span className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 flex items-center justify-center font-bold text-sm mt-0.5">{i + 1}</span>
                          <div className="font-bold text-gray-900 dark:text-white text-lg leading-relaxed"><MathRenderer text={q.question} /></div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pl-12 mb-5">
                          {q.options.map((opt, oi) => {
                            const letter = String.fromCharCode(65 + oi);
                            const isSelected = selectedAnswer === letter;
                            const isThisCorrect = letter === q.correctAnswer;

                            let bgClass = "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200";
                            if (selectedAnswer) {
                              if (isThisCorrect) bgClass = "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-400 shadow-sm ring-1 ring-green-500";
                              else if (isSelected) bgClass = "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400 shadow-sm ring-1 ring-red-500";
                              else bgClass = "bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 opacity-60 text-gray-500 dark:text-gray-400";
                            }

                            return (
                              <button
                                key={oi}
                                disabled={!!selectedAnswer}
                                onClick={() => handleQuizSelect(i, oi)}
                                className={`p-4 rounded-xl border text-sm transition-all flex items-center gap-3 text-left ${bgClass}`}
                              >
                                <span className={`font-black min-w-[1.5rem] ${isSelected ? 'text-inherit' : 'text-gray-400'}`}>{letter}</span>
                                <div className="flex-1 font-medium">
                                  <MathRenderer text={opt} />
                                </div>
                                {selectedAnswer && isThisCorrect && <SafeIcon icon={FiCheckSquare} className="w-4 h-4 text-green-600 animate-bounce" />}
                                {isSelected && !isThisCorrect && <SafeIcon icon={FiAlertTriangle} className="w-4 h-4 text-red-600" />}
                              </button>
                            );
                          })}
                        </div>

                        {selectedAnswer && (
                          <div className="pl-12">
                            <details className="text-xs group" open>
                              <summary className="hover:text-black dark:hover:text-white font-black flex items-center gap-2 list-none opacity-40 hover:opacity-100 cursor-pointer uppercase tracking-widest transition-opacity text-gray-600 dark:text-gray-400">
                                <SafeIcon icon={FiChevronRight} className="w-3 h-3 transition-transform group-open:rotate-90" /> Explanation
                              </summary>
                              <div className="mt-4 p-5 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <p className={`font-bold mb-2 flex items-center gap-2 ${isCorrect ? 'text-green-600' : 'text-[#E53935]'}`}>
                                  {isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${q.correctAnswer}`}
                                </p>
                                <div className="text-gray-800 dark:text-gray-200 leading-relaxed font-bold">
                                  <MathRenderer text={q.explanation} />
                                </div>
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="space-y-6 max-w-3xl mx-auto pb-4">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm ${msg.sender === 'user' ? 'bg-black text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
                        <SafeIcon icon={msg.sender === 'user' ? FiUser : FiCpu} className="w-4 h-4" />
                      </div>
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[85%] ${msg.sender === 'user' ? 'bg-black text-white dark:bg-gray-100 dark:text-black' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100'}`}>
                        <MathRenderer text={msg.text} />
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}

              {activeTab === 'flashcards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  {dataCache.flashcards.map((card, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-[200px] group transition-all text-center relative overflow-hidden cursor-pointer">
                      <p className="font-bold text-gray-900 dark:text-gray-100 text-xl">{card.front}</p>
                      <div className="absolute inset-0 bg-black/95 flex items-center justify-center p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-sm">{card.back}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'exam' && (
                <div className="max-w-4xl mx-auto pb-10">
                  <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-8 text-center">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Targeted Difficulty Exams</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Generate 20-question batches based on your preferred challenge level.</p>

                    {examLoading ? (
                      <div className="space-y-4 max-w-md mx-auto">
                        <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-black dark:bg-white" animate={{ width: `${(examProgress.current / examProgress.total) * 100}%` }} />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Generating: {examProgress.current} / {examProgress.total}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                        <button
                          onClick={() => generateExamByDifficulty('Easy')}
                          disabled={dataCache.exam.Easy.length >= 20}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${dataCache.exam.Easy.length >= 20 ? 'bg-green-50 border-green-200 text-green-700 opacity-60' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'}`}
                        >
                          <FiAward className={`w-6 h-6 ${dataCache.exam.Easy.length >= 20 ? 'text-green-500' : 'text-green-600'}`} />
                          <span className="text-xs font-bold uppercase tracking-wider">Generate 20 Easy</span>
                          {dataCache.exam.Easy.length >= 20 && <span className="text-[10px] font-black uppercase">Ready ✅</span>}
                        </button>

                        <button
                          onClick={() => generateExamByDifficulty('Medium')}
                          disabled={dataCache.exam.Medium.length >= 20}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${dataCache.exam.Medium.length >= 20 ? 'bg-orange-50 border-orange-200 text-orange-700 opacity-60' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'}`}
                        >
                          <FiAward className={`w-6 h-6 ${dataCache.exam.Medium.length >= 20 ? 'text-orange-500' : 'text-orange-600'}`} />
                          <span className="text-xs font-bold uppercase tracking-wider">Generate 20 Medium</span>
                          {dataCache.exam.Medium.length >= 20 && <span className="text-[10px] font-black uppercase">Ready ✅</span>}
                        </button>

                        <button
                          onClick={() => generateExamByDifficulty('Hard')}
                          disabled={dataCache.exam.Hard.length >= 20}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${dataCache.exam.Hard.length >= 20 ? 'bg-red-50 border-red-200 text-red-700 opacity-60' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'}`}
                        >
                          <FiAward className={`w-6 h-6 ${dataCache.exam.Hard.length >= 20 ? 'text-red-500' : 'text-red-600'}`} />
                          <span className="text-xs font-bold uppercase tracking-wider">Generate 20 Hard</span>
                          {dataCache.exam.Hard.length >= 20 && <span className="text-[10px] font-black uppercase">Ready ✅</span>}
                        </button>
                      </div>
                    )}
                  </div>

                  {['Easy', 'Medium', 'Hard'].map(diff => (
                    <div key={diff} className="mb-12">
                      <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-800 pb-2">
                        <div className="flex items-center gap-3">
                          <h4 className={`text-lg font-bold ${diff === 'Easy' ? 'text-green-600' : diff === 'Medium' ? 'text-orange-500' : 'text-[#E53935]'}`}>{diff} Questions</h4>
                          <span className="text-xs font-black text-gray-400 dark:text-gray-500">{dataCache.exam[diff].length} / 20</span>
                        </div>

                        {dataCache.exam[diff].length > 0 && (
                          <button
                            onClick={() => toggleExamVisibility(diff)}
                            className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
                          >
                            <SafeIcon icon={examVisibility[diff] ? FiPause : FiPlay} className={`w-3 h-3 ${examVisibility[diff] ? 'rotate-90' : ''} transition-transform`} />
                            {examVisibility[diff] ? 'Hide Questions' : 'Show Questions'}
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {examVisibility[diff] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-4 overflow-hidden"
                          >
                            {dataCache.exam[diff].map((q, i) => {
                              const answerKey = `${diff}-${i}`;
                              const selectedAnswer = userExamAnswers[answerKey];
                              const isCorrect = selectedAnswer === q.correctAnswer;

                              return (
                                <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm" >
                                  <div className="flex gap-4 mb-4">
                                    <span className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 flex items-center justify-center font-black text-xs border border-gray-100 dark:border-gray-700">{i + 1}</span>
                                    <div className="font-bold text-gray-900 dark:text-white leading-relaxed"><MathRenderer text={q.question} /></div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-12 mb-5">
                                    {q.options.map((opt, oi) => {
                                      const letter = String.fromCharCode(65 + oi);
                                      const isSelected = selectedAnswer === letter;
                                      const isThisCorrect = letter === q.correctAnswer;

                                      let bgClass = "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200";
                                      if (selectedAnswer) {
                                        if (isThisCorrect) bgClass = "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-400 shadow-sm ring-1 ring-green-500";
                                        else if (isSelected) bgClass = "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400 shadow-sm ring-1 ring-red-500";
                                        else bgClass = "bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 opacity-60 text-gray-500 dark:text-gray-400";
                                      }

                                      return (
                                        <button
                                          key={oi}
                                          disabled={!!selectedAnswer}
                                          onClick={() => handleExamSelect(diff, i, oi)}
                                          className={`p-4 rounded-xl border text-sm transition-all flex items-center gap-3 text-left ${bgClass}`}
                                        >
                                          <span className={`font-black min-w-[1.5rem] ${isSelected ? 'text-inherit' : 'text-gray-400'}`}>{letter}</span>
                                          <div className="flex-1">
                                            <MathRenderer text={opt} />
                                          </div>
                                          {selectedAnswer && isThisCorrect && <SafeIcon icon={FiCheckSquare} className="w-4 h-4 text-green-600 animate-bounce" />}
                                          {isSelected && !isThisCorrect && <SafeIcon icon={FiAlertTriangle} className="w-4 h-4 text-red-600" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="pl-12">
                                    <details className="text-xs group" open={!!selectedAnswer}>
                                      <summary className="hover:text-black dark:hover:text-white font-black flex items-center gap-2 list-none opacity-40 hover:opacity-100 cursor-pointer uppercase tracking-widest transition-opacity text-gray-600 dark:text-gray-400">
                                        <SafeIcon icon={FiChevronRight} className="w-3 h-3 transition-transform group-open:rotate-90" /> Explanation
                                      </summary>
                                      <div className="mt-4 p-5 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <p className={`font-bold mb-2 flex items-center gap-2 ${isCorrect ? 'text-green-600' : 'text-[#E53935]'}`}>
                                          {isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${q.correctAnswer}`}
                                        </p>
                                        <div className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                                          <MathRenderer text={q.explanation} />
                                        </div>
                                      </div>
                                    </details>
                                  </div>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'podcast' && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-48 h-48 bg-gray-100 rounded-full flex items-center justify-center mb-8 relative">
                    <SafeIcon icon={FiHeadphones} className="w-20 h-20 text-gray-800" />
                    {isPlaying && <div className="absolute inset-0 border-4 border-black rounded-full animate-ping opacity-20" />}
                  </div>
                  <h3 className="text-2xl font-bold mb-8">{dataCache.podcast?.title || "Audio Overview"}</h3>
                  <button onClick={togglePlay} className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center shadow-xl mb-8">
                    <SafeIcon icon={isPlaying ? FiPause : FiPlay} className="w-6 h-6" />
                  </button>
                  <div className="w-full max-w-lg bg-white p-6 rounded-2xl border border-gray-200 text-left h-48 overflow-y-auto">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{dataCache.podcast?.script}</p>
                  </div>
                </div>
              )}

              {activeTab === 'summary' && (
                <div className="bg-white dark:bg-gray-900 p-8 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm max-w-3xl mx-auto">
                  <h3 className="font-bold text-gray-900 dark:text-white text-xl mb-6 flex items-center gap-3">
                    <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg text-[#E53935]"><SafeIcon icon={FiFileText} className="w-5 h-5" /></div>
                    Executive Summary
                  </h3>
                  <div className="prose prose-red dark:prose-invert text-gray-700 dark:text-gray-300 leading-relaxed font-bold">
                    <ReactMarkdown>{dataCache.summary?.summary}</ReactMarkdown>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {activeTab === 'chat' && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="relative max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about the content..."
              className="flex-1 px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5 text-gray-900 dark:text-white"
            />
            <button onClick={handleSend} className="w-12 h-12 bg-black text-white dark:bg-white dark:text-black rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform">
              <SafeIcon icon={FiSend} className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartAIPanel;