import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import BrandName from '../../common/BrandName';
import SafeIcon from '../../common/SafeIcon';
import { contactService } from '../../services/api';

const { FiMessageSquare, FiX, FiSend, FiUser, FiCpu, FiRefreshCw, FiCheckCircle } = FiIcons;

const SalesBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0); // 0: Greeting, 1: Name, 2: Email, 3: Phone, 4: Role, 5: Requirement, 6: Confirmed
  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    requirement: ''
  });
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hi! I’m your AIPrep365 AI Tutor 🤖. I can help you with SAT study plans, practice tests, and score improvement strategies. Are you preparing for the Digital SAT?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, isOpen]);

  // Handle flow transitions
  useEffect(() => {
    if (step === 0 && messages.length === 1) {
        // Initial greeting already set
    }
  }, [step, messages.length]);

  const addBotMessage = (text) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text }]);
      setIsTyping(false);
    }, 800);
  };

  const handleSend = async (customText = null) => {
    const text = (customText || input || '').trim();
    if (!text && step !== 4 && step !== 5) return; // Allow empty only if buttons used

    // 1. Add User Message
    const userMsg = { id: Date.now(), sender: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // 2. Process based on current step
    let nextStep = step;
    let nextBotMsg = "";

    if (step === 0) {
        nextStep = 1;
        nextBotMsg = "What’s your name?";
    } else if (step === 1) {
        setLeadData(prev => ({ ...prev, name: text }));
        nextStep = 2;
        nextBotMsg = "Please enter your email address.";
    } else if (step === 2) {
        setLeadData(prev => ({ ...prev, email: text }));
        nextStep = 3;
        nextBotMsg = "Please enter your phone number.";
    } else if (step === 3) {
        setLeadData(prev => ({ ...prev, phone: text }));
        nextStep = 4;
        nextBotMsg = "Who are you?";
    } else if (step === 4) {
        setLeadData(prev => ({ ...prev, role: text }));
        nextStep = 5;
        nextBotMsg = "What are you looking for? (e.g., SAT Courses, Practice Tests, Study Plan, Guidance, Doubt Solving, etc.)";
    } else if (step === 5) {
        const finalData = { ...leadData, requirement: text };
        setLeadData(finalData);
        nextStep = 6;
        nextBotMsg = "Thank you! Your details have been submitted successfully. Our team will contact you soon.";
        
        // AUTO-SUBMIT TO BACKEND
        try {
            await contactService.submit({
                fullName: finalData.name,
                email: finalData.email,
                mobile: finalData.phone,
                subject: `Chatbot Lead: ${finalData.role}`,
                message: `Requirement: ${finalData.requirement}\nCaptured via AI Tutor Chatbot flow.`,
                type: 'Lead'
            });
        } catch (e) {
            console.error("Chatbot lead submission failed", e);
        }
    }

    setStep(nextStep);
    if (nextBotMsg) {
        addBotMessage(nextBotMsg);
    }
  };

  const handleRefresh = () => {
    setStep(0);
    setLeadData({ name: '', email: '', phone: '', role: '', requirement: '' });
    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: "Hi! I’m your AIPrep365 AI Tutor 🤖. I can help you with SAT study plans, practice tests, and score improvement strategies. Are you preparing for the Digital SAT?"
      }
    ]);
    setInput('');
  };

  const QuickActions = () => {
    if (isTyping) return null;

    if (step === 0) {
        return (
            <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => handleSend("Yes, I am!")} className="chat-btn">Yes, I am!</button>
                <button onClick={() => handleSend("Just browsing")} className="chat-btn">Just browsing</button>
            </div>
        );
    }

    if (step === 4) {
        return (
            <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => handleSend("Student")} className="chat-btn">Student</button>
                <button onClick={() => handleSend("Parent")} className="chat-btn">Parent</button>
                <button onClick={() => handleSend("Teacher")} className="chat-btn">Teacher</button>
            </div>
        );
    }

    if (step === 5) {
        return (
            <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => handleSend("SAT Courses")} className="chat-btn">SAT Courses</button>
                <button onClick={() => handleSend("Practice Tests")} className="chat-btn">Practice Tests</button>
                <button onClick={() => handleSend("Study Plan")} className="chat-btn">Study Plan</button>
                <button onClick={() => handleSend("Guidance")} className="chat-btn">Guidance</button>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end print:hidden">
      <style>{`
        .chat-btn {
            font-size: 11px;
            font-weight: bold;
            background: white;
            border: 1px solid #e2e8f0;
            color: #4f46e5;
            padding: 6px 12px;
            border-radius: 9999px;
            transition: all 0.2s;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .chat-btn:hover {
            background: #f8fafc;
            border-color: #4f46e5;
            transform: translateY(-1px);
        }
        .dark .chat-btn {
            background: #1e293b;
            border-color: #334155;
            color: #818cf8;
        }
      `}</style>

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
                  <h4 className="font-black text-sm tracking-tight"><BrandName className="text-sm" /> AI Tutor</h4>
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Expert Mentor</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleRefresh} className="hover:bg-white/20 p-2 rounded-lg transition-all" title="Restart Flow">
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
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-tl-none'}`}>
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

            {/* Input - Hidden on confirmation step */}
            {step < 6 && (
              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800">
                <div className="flex gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={step === 2 ? "Enter your email..." : step === 3 ? "Enter phone number..." : "Type your message..."}
                    className="flex-1 p-2 bg-transparent text-sm outline-none dark:text-white"
                  />
                  <button onClick={() => handleSend()} disabled={!input.trim() || isTyping} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                    <SafeIcon icon={FiSend} className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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