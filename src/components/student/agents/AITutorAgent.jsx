import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import MathRenderer from '../../../common/MathRenderer';
import { aiService } from '../../../services/api';

const { FiCpu, FiSend, FiUser, FiHelpCircle, FiZap, FiLoader } = FiIcons;

const AITutorAgent = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: "Hi! I'm your Personal AI SAT Tutor. I can help you solving doubts, explaining concepts step-by-step, or adapting to your weak areas. What are we working on today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState('Medium');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Use the generic chat endpoint but with a Tutor system prompt
      const res = await aiService.chatWithContent(
        userMsg.text,
        "Role: Expert SAT Tutor. Goal: Explain concepts clearly, identify weaknesses, and be encouraging.",
        messages,
        difficulty
      );
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: res.data?.reply || "I'm analyzing that..." }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: "I'm having trouble connecting to the knowledge base." }]);
    } finally {
      setLoading(false);
    }
  };

  const DifficultyButton = ({ level }) => (
    <button
      onClick={() => setDifficulty(level)}
      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${difficulty === level
          ? 'bg-white text-black shadow-inner'
          : 'bg-white/10 text-white/60 hover:bg-white/20'
        }`}
    >
      {level.toUpperCase()}
    </button>
  );

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-black p-6 flex justify-between items-center text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#E53935] to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/50">
            <SafeIcon icon={FiCpu} className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Personal AI Tutor</h1>
            <p className="text-gray-400 text-xs flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online • Adapting to your level
            </p>
          </div>
        </div>

        {/* Difficulty Selector */}
        <div className="hidden md:flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/10">
          <DifficultyButton level="Easy" />
          <DifficultyButton level="Medium" />
          <DifficultyButton level="Hard" />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gray-50 dark:bg-gray-900/50">
        {messages.map((msg) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id}
            className={`flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.sender === 'user' ? 'bg-black text-white' : 'bg-white text-[#E53935] border border-gray-200'}`}>
              <SafeIcon icon={msg.sender === 'user' ? FiUser : FiCpu} className="w-5 h-5" />
            </div>
            <div className={`p-4 rounded-2xl max-w-[80%] shadow-sm text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-tl-none'}`}>
              <MathRenderer text={msg.text} />
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start pl-14">
            <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-full flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="relative max-w-4xl mx-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a doubt, paste a question, or say 'Give me a quiz'..."
            // FIXED: Added dark:text-white and text-gray-900 explicitly
            className="w-full pl-6 pr-14 py-4 bg-gray-100 dark:bg-gray-900 border-transparent focus:bg-white focus:border-gray-300 rounded-full outline-none transition-all text-gray-900 dark:text-white font-medium"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-2 bottom-2 w-10 h-10 bg-[#E53935] text-white rounded-full flex items-center justify-center hover:bg-red-700 disabled:opacity-50 transition-colors shadow-md"
          >
            <SafeIcon icon={FiSend} className="w-4 h-4 ml-0.5" />
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-gray-400">AI can make mistakes. Review important concepts.</p>
        </div>
      </div>
    </div>
  );
};

export default AITutorAgent;