import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { aiService } from '../../services/api';

const { FiMessageSquare, FiX, FiSend, FiUser, FiCpu, FiRefreshCw } = FiIcons;

const SalesBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hi! I’m your Digital SAT AI Tutor. I can help you with SAT plans, practice tests, and score improvement strategies. Are you a student preparing for the Digital SAT?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, isOpen]);

  const handleSend = async (customText = null) => {
    const textToSend = customText || input;
    if (!textToSend.trim()) return;

    const userMsg = { id: Date.now(), sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await aiService.salesChat(textToSend, messages);
      const reply = res.data?.reply || "I'm here to help with your SAT journey! How else can I assist you today?";
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: "I'm having a little trouble connecting. Feel free to try again or check our courses directly!" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleRefresh = () => {
    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: "Hi! I’m your Digital SAT AI Tutor. I can help you with SAT plans, practice tests, and score improvement strategies. Are you a student preparing for the Digital SAT?"
      }
    ]);
    setInput('');
  };

  const QuickActions = () => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.sender !== 'bot' || isTyping) return null;

    const lowerText = lastMsg.text.toLowerCase();

    // Logic to show different buttons based on bot's last response
    let buttons = [];

    if (lowerText.includes("preparing for the digital sat")) {
      buttons = [
        { label: "Yes, I'm a student", val: "Yes, I'm a student preparing for the SAT." },
        { label: "I'm a Teacher", val: "I'm a teacher looking for classroom resources." },
        { label: "I'm a Parent", val: "I'm a parent looking for my child's SAT prep." }
      ];
    } else if (lowerText.includes("taken a practice test")) {
      buttons = [
        { label: "Yes, I have", val: "Yes, I have taken a practice test before." },
        { label: "No, not yet", val: "No, I haven't taken a practice test yet." }
      ];
    } else if (lowerText.includes("want to improve most")) {
      buttons = [
        { label: "Math", val: "I want to improve my Math score." },
        { label: "Reading & Writing", val: "I want to improve my Reading & Writing score." },
        { label: "Full SAT", val: "I want to improve in all sections." }
      ];
    } else if (lowerText.includes("next step") || lowerText.includes("recommend")) {
      buttons = [
        { label: "Practice Tests", val: "Tell me more about practice tests." },
        { label: "Study Plans", val: "How do personalized study plans work?" },
        { label: "View Courses", val: "Show me the available SAT courses." }
      ];
    }

    if (buttons.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {buttons.map((btn, i) => (
          <button
            key={i}
            onClick={() => handleSend(btn.val)}
            className="text-[11px] font-bold bg-white dark:bg-gray-700 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm"
          >
            {btn.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-gray-800 w-[calc(100vw-2rem)] sm:w-80 md:w-96 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-4 flex flex-col max-h-[550px]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center relative backdrop-blur-md">
                  <SafeIcon icon={FiCpu} className="w-6 h-6" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 border-2 border-indigo-600 rounded-full animate-pulse"></span>
                </div>
                <div>
                  <h4 className="font-black text-sm tracking-tight">Digital SAT AI Tutor</h4>
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Expert Mentor</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleRefresh} className="hover:bg-white/20 p-2 rounded-lg transition-all" title="Refresh Chat">
                  <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-lg transition-all">
                  <SafeIcon icon={FiX} className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900 custom-scrollbar h-[350px]">
              {messages.map((msg, idx) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                  {idx === messages.length - 1 && <QuickActions />}
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-xl rounded-tl-none border border-gray-100 dark:border-gray-800 shadow-sm flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800">
              <div className="flex gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about SAT prep..."
                  className="flex-1 p-2 bg-transparent text-sm outline-none dark:text-white"
                />
                <button onClick={() => handleSend()} disabled={!input.trim() || isTyping} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                  <SafeIcon icon={FiSend} className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center transition-all ${isOpen ? 'bg-gray-600 rotate-90 rounded-full' : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 shadow-indigo-200 dark:shadow-none'}`}
      >
        <SafeIcon icon={isOpen ? FiX : FiMessageSquare} className="w-8 h-8 text-white" />
      </motion.button>
    </div>
  );
};

export default SalesBot;