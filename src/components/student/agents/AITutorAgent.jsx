import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import MathRenderer from '../../../common/MathRenderer';
import { aiService } from '../../../services/api';

const {
  FiCpu, FiSend, FiUser, FiZap, FiLoader,
  FiBookOpen, FiTarget, FiAward, FiRefreshCw
} = FiIcons;

// Quick-action suggestion chips shown in the welcome state
const QUICK_ACTIONS = [
  { label: '📐 Quiz me on Algebra', msg: 'Give me a quiz on Algebra' },
  { label: '📖 Practice Transitions', msg: 'I want 4 questions on Transitions' },
  { label: '📊 10 Question Quiz', msg: 'Give me a 10 question quiz on Linear Equations' },
  { label: '📊 Statistics questions', msg: 'Quiz me on Statistics' },
  { label: '📐 Trigonometry drill', msg: 'Give me a Trigonometry drill' },
  { label: '✍️ Grammar practice', msg: 'Practice grammar questions' },
  { label: '🔢 Quadratics quiz', msg: 'Quiz me on Quadratics' },
];

const DIFFICULTY_CONFIG = {
  Easy: { emoji: '🟢', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/40', active: 'bg-green-500 text-white' },
  Medium: { emoji: '🟡', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/40', active: 'bg-yellow-500 text-white' },
  Hard: { emoji: '🔴', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/40', active: 'bg-red-500 text-white' },
};

// ── Premium Welcome Card (rendered instead of plain markdown for msg id=1) ──
const WelcomeCard = () => (
  <div style={{
    background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
    border: '1px solid rgba(229,57,53,0.25)',
    borderRadius: '18px',
    overflow: 'hidden',
    maxWidth: '420px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  }}>
    {/* Card header */}
    <div style={{
      background: 'linear-gradient(90deg, #E53935 0%, #b71c1c 100%)',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <div style={{
        width: 38, height: 38,
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>🤖</div>
      <div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
          Personal AI SAT Tutor
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
          Digital SAT Specialist • Online
        </div>
      </div>
    </div>

    {/* Card body */}
    <div style={{ padding: '16px 18px' }}>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 14, letterSpacing: '0.02em' }}>
        I CAN HELP YOU WITH
      </p>

      {[
        { icon: '🎯', label: 'Practice Quizzes', example: 'Quiz me on Algebra' },
        { icon: '📚', label: 'Concept Explanations', example: 'Explain completing the square' },
        { icon: '🗺️', label: 'Study Plans', example: 'Make me a 4-week study plan' },
      ].map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '9px 12px',
          marginBottom: 8,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{item.label}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 }}>
              e.g. "{item.example}"
            </div>
          </div>
        </div>
      ))}

      <div style={{
        marginTop: 14,
        padding: '9px 12px',
        background: 'rgba(229,57,53,0.08)',
        borderRadius: 10,
        border: '1px solid rgba(229,57,53,0.2)',
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        textAlign: 'center',
      }}>
        Difficulty is set to <strong style={{ color: '#E53935' }}>Medium</strong> by default — change it anytime above
      </div>
    </div>
  </div>
);

const AITutorAgent = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', isWelcome: true }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState('Medium');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  const handleSend = async (text) => {
    const msgText = (text || input).trim();
    if (!msgText) return;

    const userMsg = { id: Date.now(), sender: 'user', text: msgText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiService.tutorChat(msgText, difficulty);
      const reply = res.data?.reply || "I'm analyzing that...";
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply }]);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || "Connection error";
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: `⚠️ **Error:** ${errMsg}\n\nPlease check your internet connection or try again.`
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleReset = () => {
    setMessages([{ id: Date.now(), sender: 'ai', isWelcome: true }]);
    aiService.tutorChat("reset", difficulty).catch(() => { });
  };

  const DifficultyButton = ({ level }) => {
    const cfg = DIFFICULTY_CONFIG[level];
    const isActive = difficulty === level;
    return (
      <button
        onClick={() => setDifficulty(level)}
        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all duration-200 ${isActive
          ? cfg.active + ' shadow-md scale-105'
          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/15'
          }`}
        title={`Set difficulty to ${level}`}
      >
        {cfg.emoji} {level.toUpperCase()}
      </button>
    );
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-black p-4 flex justify-between items-center text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#E53935] to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/50 flex-shrink-0">
            <SafeIcon icon={FiCpu} className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Personal AI Tutor</h1>
            <p className="text-gray-400 text-xs flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
              Online • Digital SAT Specialist
            </p>
          </div>
        </div>

        {/* Difficulty Selector + Reset */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
            {['Easy', 'Medium', 'Hard'].map(level => (
              <DifficultyButton key={level} level={level} />
            ))}
          </div>
          <button
            onClick={handleReset}
            title="Reset session"
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors ml-1"
          >
            <SafeIcon icon={FiRefreshCw} className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>

      {/* Mobile Difficulty Bar */}
      <div className="md:hidden flex items-center gap-1 bg-gray-900 px-4 py-2 justify-center border-b border-gray-700">
        {['Easy', 'Medium', 'Hard'].map(level => (
          <DifficultyButton key={level} level={level} />
        ))}
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar bg-gray-50 dark:bg-gray-900/50">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm text-sm ${msg.sender === 'user'
                ? 'bg-black text-white'
                : 'bg-white text-[#E53935] border border-gray-200 dark:border-gray-600 dark:bg-gray-800'
                }`}>
                {msg.sender === 'user' ? '👤' : '🤖'}
              </div>

              {/* Bubble */}
              {msg.isWelcome ? (
                <WelcomeCard />
              ) : (
                <div className={`p-3.5 rounded-2xl max-w-[82%] md:max-w-[78%] shadow-sm text-sm leading-relaxed ${msg.sender === 'user'
                  ? 'bg-black text-white rounded-tr-none'
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-none'
                  }`}>
                  <MathRenderer text={msg.text} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-gray-200 dark:border-gray-600 dark:bg-gray-800 text-sm flex-shrink-0">
              🤖
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center shadow-sm">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick action chips (only show when no quiz is active and few messages) */}
        {messages.length <= 2 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-2 pt-2"
          >
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSend(action.msg)}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full text-xs text-gray-700 dark:text-gray-300 hover:border-[#E53935] hover:text-[#E53935] transition-all duration-150 shadow-sm hover:shadow-md"
              >
                {action.label}
              </button>
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative max-w-4xl mx-auto">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask a doubt, paste a question, or say 'Quiz me on Algebra'…"
            disabled={loading}
            className="w-full pl-5 pr-14 py-3.5 bg-gray-100 dark:bg-gray-900 border border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-gray-300 dark:focus:border-gray-600 rounded-full outline-none transition-all text-gray-900 dark:text-white text-sm font-medium disabled:opacity-60"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#E53935] text-white rounded-full flex items-center justify-center hover:bg-red-700 disabled:opacity-40 transition-all shadow-md hover:shadow-red-500/30 hover:scale-105 active:scale-95"
          >
            {loading ? (
              <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />
            ) : (
              <SafeIcon icon={FiSend} className="w-4 h-4 ml-0.5" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          AI can make mistakes. Review important concepts. &nbsp;•&nbsp; Difficulty: <strong>{DIFFICULTY_CONFIG[difficulty]?.emoji} {difficulty}</strong>
        </p>
      </div>
    </div>
  );
};

export default AITutorAgent;
