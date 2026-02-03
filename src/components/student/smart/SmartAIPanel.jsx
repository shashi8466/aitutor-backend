import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import MathRenderer from '../../../common/MathRenderer';
import ReactMarkdown from 'react-markdown';
import { aiService } from '../../../services/api';
import axios from 'axios';

const { FiMessageSquare, FiLayers, FiCheckSquare, FiFileText, FiSend, FiLoader, FiCpu, FiHeadphones, FiList, FiPlay, FiPause, FiChevronRight, FiAlertTriangle, FiUser } = FiIcons;

const checkBackendHealth = async () => {
  try {
    const res = await axios.get('/api/health');
    return res.data && res.data.status === 'ok';
  } catch (err) {
    return false;
  }
};

const SmartAIPanel = ({ content, summary }) => {
  // Tabs: chat, flashcards, quiz, podcast, summary, chapters
  const [activeTab, setActiveTab] = useState('chapters');

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // Data Cache
  const [dataCache, setDataCache] = useState({
    flashcards: [],
    quiz: [],
    chapters: [],
    podcast: null,
    summary: summary || null
  });

  // Ensure content is always a string to prevent errors
  const safeContent = content || '';

  // Loading States
  const [loading, setLoading] = useState(false);
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
      setBackendStatus('checking');
      const isHealthy = await checkBackendHealth();
      setBackendStatus(isHealthy ? 'online' : 'offline');
    };
    checkStatus();
    // Recheck every 30 seconds
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

  // Auto-load Chapters when backend becomes online and content is available
  useEffect(() => {
    if (content && backendStatus === 'online' && !initialLoadAttempted && (!dataCache.chapters || dataCache.chapters.length === 0)) {
      setInitialLoadAttempted(true);
      // Use a small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        loadChaptersInitial();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [content, backendStatus, initialLoadAttempted, dataCache.chapters]);

  // Separate function for initial chapters loading to avoid dependency issues
  const loadChaptersInitial = async () => {
    if (!safeContent || safeContent.trim().length < 50) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Auto-loading chapters with content length:', safeContent.length);
      const res = await aiService.generateChapters(safeContent);
      console.log('Chapters response:', res?.data);

      if (typeof res?.data === 'string' && res.data.includes('<!DOCTYPE html>')) {
        throw new Error("Backend server error: Received HTML instead of data.");
      }

      if (res?.data) {
        let rawData = res.data.chapters !== undefined ? res.data.chapters : (res.data || []);
        rawData = Array.isArray(rawData) ? rawData : [];
        setDataCache(prev => ({ ...prev, chapters: rawData }));
      }
    } catch (err) {
      console.error('Failed to auto-load chapters:', err);
      // Don't set error on initial load to avoid blocking UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const loadFeature = async (feature) => {
    // Clear error when switching tabs
    setError(null);

    // 1. Handle Chat (Local State - No Fetch)
    if (feature === 'chat') {
      if (!safeContent) {
        setError("No content available for chat. Please provide text content first.");
        return;
      }
      setActiveTab('chat');
      return;
    }

    // 2. Check Cache - if data exists, just switch to that tab
    if (dataCache[feature] && (Array.isArray(dataCache[feature]) ? dataCache[feature].length > 0 : dataCache[feature])) {
      setActiveTab(feature);
      return;
    }

    // 3. Set tab first so UI shows the correct view
    setActiveTab(feature);
    setLoading(true);

    // 4. Check backend health before fetching
    const isBackendHealthy = await checkBackendHealth();
    if (!isBackendHealthy) {
      setError("Backend server is not running. Please start it with: npm run server (on port 3001)");
      setLoading(false);
      return;
    }

    // 5. Fetch Data

    try {
      if (!safeContent) throw new Error("No text content available to analyze.");

      // Ensure content is substantial enough for AI processing
      if (safeContent.trim().length < 50) {
        throw new Error("Content too short for AI processing. Please provide more text.");
      }

      let res;
      // Add artificial delay for better UX if needed, but keeping it fast for now
      console.log(`Attempting to generate ${feature} with content length:`, safeContent.length);
      if (feature === 'flashcards') res = await aiService.generateFlashcards(safeContent);
      else if (feature === 'quiz') res = await aiService.generateQuizFromContent(safeContent);
      else if (feature === 'chapters') res = await aiService.generateChapters(safeContent);
      else if (feature === 'podcast') res = await aiService.generatePodcastScript(safeContent);
      else if (feature === 'summary') res = await aiService.summarizeContent(safeContent);

      // Handle response safely
      console.log(`Response received for ${feature}:`, res?.data);

      // CRITICAL: Check if response is actually the AI data or if it's the SPA index.html (happens in some hosting environments)
      if (typeof res?.data === 'string' && res.data.includes('<!DOCTYPE html>')) {
        throw new Error("Backend server error: Received HTML instead of data. This usually means the backend server is not reachable from this domain.");
      }

      if (res && res.data) {
        // Special handling for summary/podcast where we want the whole object, vs arrays like quiz/flashcards
        let rawData = (feature === 'summary' || feature === 'podcast') ? (res.data || {}) : (res.data[feature] || res.data || []);

        // For flashcards, the response is {flashcards: [...]} so we need to extract the array
        if (feature === 'flashcards' && res.data.flashcards !== undefined) {
          rawData = Array.isArray(res.data.flashcards) ? res.data.flashcards : [];
        } else if (feature === 'quiz' && res.data.quiz !== undefined) {
          rawData = Array.isArray(res.data.quiz) ? res.data.quiz : [];
        } else if (feature === 'chapters' && res.data.chapters !== undefined) {
          rawData = Array.isArray(res.data.chapters) ? res.data.chapters : [];
        }

        console.log(`${feature} rawData:`, rawData);

        // Basic validation
        if (Array.isArray(rawData) && rawData.length === 0) {
          // Don't error out, just show empty state
          setDataCache(prev => ({ ...prev, [feature]: [] }));
        } else if (Array.isArray(rawData)) {
          setDataCache(prev => ({ ...prev, [feature]: rawData }));
        } else {
          // For non-array data (like summary, podcast), set directly
          // For flashcards and quiz specifically, ensure we always have an array
          if (feature === 'flashcards' || feature === 'quiz') {
            // Flashcards and quiz APIs return {flashcards: [...]} or {quiz: [...]} so rawData might be the array or undefined
            const arrayData = Array.isArray(rawData) ? rawData : [];
            setDataCache(prev => ({ ...prev, [feature]: arrayData }));
          } else {
            setDataCache(prev => ({ ...prev, [feature]: rawData || {} }));
          }
        }
      } else {
        console.error(`${feature} API call returned no data:`, res);
        // Set empty array for features that expect arrays
        if (['flashcards', 'quiz', 'chapters'].includes(feature)) {
          setDataCache(prev => ({ ...prev, [feature]: [] }));
        } else {
          setDataCache(prev => ({ ...prev, [feature]: {} }));
        }
      }
    } catch (err) {
      console.error(`Failed to load ${feature}:`, err);
      // More specific error messages
      let msg = err.message || `Failed to generate ${feature}.`;

      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        if (status === 404) {
          msg = `Backend endpoint not found. Please ensure the backend server is running on port 3001.`;
        } else if (status === 500) {
          msg = `Server error: ${err.response.data?.error || 'Internal server error'}`;
        } else if (status === 400) {
          msg = `Invalid request: ${err.response.data?.error || 'Bad request'}`;
        } else {
          msg = `Server error (${status}): ${err.response.data?.error || err.message}`;
        }
      } else if (err.request) {
        // Request was made but no response received
        if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
          msg = `Cannot connect to backend server. Please start it with: npm run server`;
        } else if (err.message?.includes('Network') || err.message?.includes('Failed to fetch')) {
          msg = `Connection error. Is the backend server running on port 3001?`;
        } else {
          msg = `Network error: ${err.message}`;
        }
      } else {
        // Error setting up request
        msg = `Error: ${err.message || 'Unknown error occurred'}`;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    const userMsg = { id: Date.now(), sender: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); // Clear input
    setLoading(true);

    try {
      const res = await aiService.chatWithContent(userText, safeContent, messages);
      const reply = res?.data?.reply || "I'm sorry, I couldn't generate a response.";
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply }]);
    } catch (err) {
      console.error("Chat error:", err);
      let errorMsg = "I'm having trouble connecting right now.";
      if (err.response?.status === 404) {
        errorMsg = "Backend server not found. Please ensure it's running on port 3001.";
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        errorMsg = "Cannot connect to backend. Please start it with: npm run server";
      } else if (err.message?.includes('Network') || err.message?.includes('Failed to fetch')) {
        errorMsg = "Connection error. Is the backend server running?";
      }
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: errorMsg }]);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
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

  // --- RENDER HELPERS ---
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
      {/* Backend Status Banner */}
      {backendStatus === 'offline' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-red-800">
            <SafeIcon icon={FiAlertTriangle} className="w-4 h-4" />
            <span className="font-bold">Backend server is offline</span>
            <span className="text-red-600">• Start it with: <code className="bg-red-100 px-1 rounded">npm run server</code></span>
          </div>
          <button
            onClick={async () => {
              setBackendStatus('checking');
              const isHealthy = await checkBackendHealth();
              setBackendStatus(isHealthy ? 'online' : 'offline');
              if (isHealthy) loadFeature(activeTab);
            }}
            className="text-red-700 hover:text-red-900 font-bold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Tab Navigation */}
      <div className="px-2 sm:px-4 py-2 sm:py-3 border-b border-gray-200 bg-white flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shadow-sm z-10">
        {[
          { id: 'chapters', icon: FiList, label: 'Chapters' },
          { id: 'chat', icon: FiMessageSquare, label: 'Chat' },
          { id: 'flashcards', icon: FiLayers, label: 'Flashcards' },
          { id: 'quiz', icon: FiCheckSquare, label: 'Quizzes' },
          { id: 'podcast', icon: FiHeadphones, label: 'Podcast' },
          { id: 'summary', icon: FiFileText, label: 'Summary' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => loadFeature(tab.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap border flex-shrink-0 ${activeTab === tab.id ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <SafeIcon icon={tab.icon} className="w-3 h-3" /> {tab.label}
          </button>
        ))}
      </div>

      {/* 2. Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 relative custom-scrollbar">
        <AnimatePresence mode="wait">
          {loading && activeTab !== 'chat' ? renderLoading() : error ? renderError() : (
            <>
              {/* CHAPTERS VIEW */}
              {activeTab === 'chapters' && (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {dataCache.chapters && Array.isArray(dataCache.chapters) && dataCache.chapters.length > 0 ? (
                    <>
                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between mb-8 cursor-pointer hover:border-black transition-colors" onClick={() => loadFeature('podcast')}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white shadow-lg">
                            <SafeIcon icon={FiPlay} className="w-5 h-5 ml-0.5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">Audio Overview</p>
                            <p className="text-xs text-gray-500">Listen to summary</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">AI Generated</span>
                      </div>
                      {(Array.isArray(dataCache.chapters) ? dataCache.chapters : []).map((chap, i) => (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={i} className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-all flex gap-6 group shadow-sm" >
                          <div className="text-3xl font-bold text-gray-200 group-hover:text-gray-400 transition-colors font-sans w-12 text-center">
                            {(i + 1).toString().padStart(2, '0')}
                          </div>
                          <div className="pt-1">
                            <h4 className="text-lg font-bold text-gray-900 mb-2">{chap.title}</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">{chap.description}</p>
                          </div>
                        </motion.div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-10">
                      {backendStatus === 'checking' ? (
                        <div className="flex flex-col items-center gap-4">
                          <SafeIcon icon={FiLoader} className="w-8 h-8 animate-spin text-gray-400" />
                          <p className="text-gray-500 font-medium">Connecting to backend...</p>
                        </div>
                      ) : backendStatus === 'offline' ? (
                        <div className="flex flex-col items-center gap-4">
                          <SafeIcon icon={FiAlertTriangle} className="w-8 h-8 text-yellow-500" />
                          <p className="text-gray-600 font-medium">Backend server is offline</p>
                          <p className="text-sm text-gray-400">Start the server with: npm run server</p>
                        </div>
                      ) : !safeContent || safeContent.trim().length < 50 ? (
                        <div className="flex flex-col items-center gap-4">
                          <SafeIcon icon={FiFileText} className="w-8 h-8 text-gray-300" />
                          <p className="text-gray-500 font-medium">No content to analyze</p>
                          <p className="text-sm text-gray-400">Upload a document with at least 50 characters</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <SafeIcon icon={FiList} className="w-8 h-8 text-gray-300" />
                          <p className="text-gray-500 font-medium">No chapters generated yet</p>
                          <button
                            onClick={() => loadFeature('chapters')}
                            className="mt-2 px-6 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-all shadow-md"
                          >
                            Generate Chapters
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* QUIZ VIEW */}
              {activeTab === 'quiz' && (
                <div className="space-y-6 max-w-3xl mx-auto pb-10">
                  {((Array.isArray(dataCache.quiz) && dataCache.quiz) || []).map((q, i) => (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm" >
                      <div className="flex gap-4 mb-6">
                        <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="font-bold text-gray-900 text-lg leading-relaxed">
                          {q.question}
                        </p>
                      </div>
                      <div className="space-y-3 pl-12">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 cursor-pointer transition-all group">
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-gray-400 flex items-center justify-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-black opacity-0 group-hover:opacity-10 transition-opacity"></div>
                            </div>
                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{opt}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-6 ml-12 pt-0">
                        <details className="text-sm text-gray-500 cursor-pointer group">
                          <summary className="hover:text-[#E53935] font-bold flex items-center gap-2 list-none transition-colors">
                            <SafeIcon icon={FiChevronRight} className="w-4 h-4 transition-transform group-open:rotate-90" /> Show Answer
                          </summary>
                          <div className="mt-4 p-4 bg-green-50 text-green-900 rounded-xl border border-green-100">
                            <p className="font-bold mb-1">Correct Answer: {q.correctAnswer}</p>
                            <p className="text-sm opacity-80 leading-relaxed">{q.explanation}</p>
                          </div>
                        </details>
                      </div>
                    </motion.div>
                  ))}
                  {dataCache.quiz && Array.isArray(dataCache.quiz) && dataCache.quiz.length === 0 && (
                    <div className="text-center py-12">
                      <div className="flex flex-col items-center gap-4">
                        <SafeIcon icon={FiCheckSquare} className="w-8 h-8 text-gray-300" />
                        <p className="text-gray-500 font-medium">No quiz questions yet</p>
                        <button
                          onClick={() => loadFeature('quiz')}
                          className="mt-2 px-6 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-all shadow-md"
                        >
                          Generate Quiz
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CHAT VIEW */}
              {activeTab === 'chat' && (
                <div className="space-y-6 max-w-3xl mx-auto pb-4">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.sender === 'user' ? 'bg-black text-white' : 'bg-white border border-gray-200 text-black'}`}>
                        <SafeIcon icon={msg.sender === 'user' ? FiUser : FiCpu} className="w-4 h-4" />
                      </div>
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[85%] ${msg.sender === 'user' ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                        <MathRenderer text={msg.text} />
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-2 text-gray-300 text-xs ml-12">
                      <span className="animate-bounce">●</span><span className="animate-bounce delay-100">●</span><span className="animate-bounce delay-200">●</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* FLASHCARDS VIEW */}
              {activeTab === 'flashcards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  {((Array.isArray(dataCache.flashcards) && dataCache.flashcards) || []).map((card, i) => (
                    <div key={i} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between min-h-[200px] group hover:shadow-md transition-all text-center relative overflow-hidden cursor-pointer">
                      <div className="absolute top-4 left-4 text-[10px] font-bold text-gray-300 uppercase tracking-widest">Card {i + 1}</div>
                      <div className="flex-1 flex items-center justify-center">
                        <p className="font-bold text-gray-900 text-xl">{card.front}</p>
                      </div>
                      <div className="absolute inset-0 bg-black/95 flex items-center justify-center p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-white text-sm leading-relaxed">{card.back}</p>
                      </div>
                    </div>
                  ))}
                  {dataCache.flashcards && Array.isArray(dataCache.flashcards) && dataCache.flashcards.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <div className="flex flex-col items-center gap-4">
                        <SafeIcon icon={FiLayers} className="w-8 h-8 text-gray-300" />
                        <p className="text-gray-500 font-medium">No flashcards yet</p>
                        <button
                          onClick={() => loadFeature('flashcards')}
                          className="mt-2 px-6 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-all shadow-md"
                        >
                          Generate Flashcards
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PODCAST VIEW */}
              {activeTab === 'podcast' && (
                <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center">
                  <div className="relative mb-8">
                    <div className="w-48 h-48 bg-gray-100 rounded-full flex items-center justify-center relative z-10 shadow-xl border-4 border-white">
                      <SafeIcon icon={FiHeadphones} className="w-20 h-20 text-gray-800" />
                    </div>
                    {isPlaying && (
                      <>
                        <div className="absolute inset-0 rounded-full border-2 border-black opacity-20 animate-ping"></div>
                        <div className="absolute inset-[-20px] rounded-full border border-black opacity-10 animate-pulse"></div>
                      </>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{dataCache.podcast?.title || "Audio Overview"}</h3>
                  <p className="text-gray-500 mb-8">AI-generated deep dive into this document</p>

                  <button
                    onClick={togglePlay}
                    className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl mb-8"
                  >
                    <SafeIcon icon={isPlaying ? FiPause : FiPlay} className="w-6 h-6 fill-current" />
                  </button>

                  <div className="w-full bg-white p-6 rounded-2xl border border-gray-200 text-left h-64 overflow-y-auto custom-scrollbar shadow-inner">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider">Transcript</p>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {dataCache.podcast?.script || "Script will appear here once generated."}
                    </p>
                  </div>
                </div>
              )}

              {/* SUMMARY VIEW */}
              {activeTab === 'summary' && (
                <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-3xl mx-auto">
                  <h3 className="font-bold text-gray-900 text-xl mb-6 flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg text-[#E53935]"><SafeIcon icon={FiFileText} className="w-5 h-5" /></div>
                    Executive Summary
                  </h3>
                  <div className="prose prose-lg text-gray-700 leading-relaxed">
                    <ReactMarkdown
                      components={{
                        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-4 mb-2 text-gray-900" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-3" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-5 mb-3 space-y-1" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-5 mb-3 space-y-1" {...props} />,
                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
                      }}
                    >
                      {dataCache.summary?.summary || "Summary not available."}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Input Area (Only for Chat) */}
      {activeTab === 'chat' && (
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="relative max-w-3xl mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a follow-up question..."
              // FIXED: Added text-gray-900 explicitly here as well
              className="w-full pl-6 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all shadow-sm font-medium"
            />
            <div className="absolute right-2 top-2 bottom-2 flex items-center gap-1">
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center hover:bg-gray-800 disabled:opacity-50 transition-all shadow-md"
              >
                <SafeIcon icon={FiSend} className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartAIPanel;