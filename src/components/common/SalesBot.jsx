import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import axios from 'axios';
import BrandName from '../../common/BrandName';
import SafeIcon from '../../common/SafeIcon';
import { contactService } from '../../services/api';

const { FiMessageSquare, FiX, FiSend, FiUser, FiCpu, FiRefreshCw, FiCheckCircle } = FiIcons;

const SalesBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  // steps:
  // 0: Greeting (Role Selection)
  // 1: Student Name
  // 2: Grade/Class
  // 3: Student Email
  // 4: Student Email OTP
  // 5: Student Phone
  // 6: Parent Name
  // 7: Parent Email
  // 8: Parent Email OTP
  // 9: Parent Phone
  // 10: Course
  // 11: Notes
  // 12: Success
  const [step, setStep] = useState(0); 
  const [leadData, setLeadData] = useState({
    role: '',
    studentName: '',
    grade: '',
    studentEmail: '',
    studentPhone: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    course: '',
    notes: ''
  });
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hi! I’m your AIPrep365 AI Tutor 🤖. I can help you with SAT study plans, practice tests, and score improvement strategies. Are you preparing for the Digital SAT?\n\nBefore we begin, who is chatting with us today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, isOpen]);

  const addBotMessage = (text) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text }]);
      setIsTyping(false);
    }, 800);
  };

  const sendOtp = async (email) => {
    try {
      await axios.post('/api/demo/send-email-otp', { email });
      return true;
    } catch (e) {
      console.error("Failed to send OTP:", e);
      return false;
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const res = await axios.post('/api/demo/verify-email-otp', { email, otp });
      return res.data?.success;
    } catch (e) {
      console.error("Failed to verify OTP:", e);
      return false;
    }
  };

  const handleSend = async (customText = null) => {
    const text = (customText || input || '').trim();
    
    // Quick action buttons can send predefined text. If no text is provided, enforce entry unless optional
    if (!text && step !== 0 && step !== 9 && step !== 10) return; 

    // Add user message
    const userMsg = { id: Date.now(), sender: 'user', text: text || 'Skipped' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true); // Manually set typing to block input during async ops

    let nextStep = step;
    let nextBotMsg = "";

    try {
      if (step === 0) {
        setLeadData(prev => ({ ...prev, role: text }));
        nextStep = 1;
        nextBotMsg = "What is the student's name?";
      } 
      else if (step === 1) {
        setLeadData(prev => ({ ...prev, studentName: text }));
        nextStep = 2;
        nextBotMsg = "What grade or class are they in?";
      } 
      else if (step === 2) {
        setLeadData(prev => ({ ...prev, grade: text }));
        nextStep = 3;
        nextBotMsg = "Please enter the student's email address.";
      } 
      else if (step === 3) {
        setLeadData(prev => ({ ...prev, studentEmail: text }));
        const sent = await sendOtp(text);
        nextStep = 4;
        if (sent) {
          nextBotMsg = "We've sent a 6-digit verification code to that email. Please enter it here.";
        } else {
          nextBotMsg = "We encountered an issue sending the OTP. Please enter the email address again.";
          nextStep = 3;
        }
      } 
      else if (step === 4) {
        if (text.toLowerCase() === 'resend') {
          await sendOtp(leadData.studentEmail);
          nextBotMsg = "A new verification code has been sent. Please enter it here.";
          nextStep = 4;
        } else {
          const isValid = await verifyOtp(leadData.studentEmail, text);
          if (isValid) {
            nextStep = 5;
            nextBotMsg = "Email verified successfully! Please enter the student's phone number.";
          } else {
            nextStep = 4;
            nextBotMsg = "Invalid verification code. Please try again or type 'resend' to send a new code.";
          }
        }
      } 
      else if (step === 5) {
        setLeadData(prev => ({ ...prev, studentPhone: text }));
        nextStep = 6;
        nextBotMsg = "What is the parent's name?";
      } 
      else if (step === 6) {
        setLeadData(prev => ({ ...prev, parentName: text }));
        nextStep = 7;
        nextBotMsg = "Please enter the parent's email address.";
      } 
      else if (step === 7) {
        setLeadData(prev => ({ ...prev, parentEmail: text }));
        const sent = await sendOtp(text);
        nextStep = 8;
        if (sent) {
          nextBotMsg = "We've sent a 6-digit verification code to the parent's email. Please enter it here.";
        } else {
          nextBotMsg = "We encountered an issue sending the OTP. Please enter the email address again.";
          nextStep = 7;
        }
      } 
      else if (step === 8) {
        if (text.toLowerCase() === 'resend') {
          await sendOtp(leadData.parentEmail);
          nextBotMsg = "A new verification code has been sent. Please enter it here.";
          nextStep = 8;
        } else {
          const isValid = await verifyOtp(leadData.parentEmail, text);
          if (isValid) {
            nextStep = 9;
            nextBotMsg = "Email verified successfully! Please enter the parent's phone number.";
          } else {
            nextStep = 8;
            nextBotMsg = "Invalid verification code. Please try again or type 'resend' to send a new code.";
          }
        }
      } 
      else if (step === 9) {
        setLeadData(prev => ({ ...prev, parentPhone: text === 'Skipped' ? '' : text }));
        nextStep = 10;
        nextBotMsg = "What course are you interested in? (e.g. SAT, ACT, AP, Practice Tests, Tutoring)";
      } 
      else if (step === 10) {
        setLeadData(prev => ({ ...prev, course: text }));
        nextStep = 11;
        nextBotMsg = "Do you have any additional notes or specific requirements?";
      } 
      else if (step === 11) {
        const finalData = { ...leadData, notes: text };
        setLeadData(finalData);
        nextStep = 12;
        nextBotMsg = "Thank you! Your details have been submitted successfully. Our team will contact you soon.";
        
        // Format message for backend
        const formattedMessage = [
          `Role: ${finalData.role}`,
          `Grade: ${finalData.grade}`,
          `Student Name: ${finalData.studentName}`,
          `Student Email: ${finalData.studentEmail}`,
          `Student Phone: ${finalData.studentPhone}`,
          `Parent Name: ${finalData.parentName}`,
          `Parent Email: ${finalData.parentEmail}`,
          `Parent Phone: ${finalData.parentPhone || 'N/A'}`,
          `Interested Course: ${finalData.course}`,
          `Additional Notes: ${finalData.notes}`
        ].join('\n');

        // AUTO-SUBMIT TO BACKEND
        try {
            await contactService.submit({
                fullName: finalData.studentName || finalData.parentName,
                email: finalData.studentEmail || finalData.parentEmail,
                mobile: finalData.studentPhone || finalData.parentPhone,
                subject: `Chatbot Lead: ${finalData.role}`,
                message: formattedMessage + '\n\nCaptured via AI Tutor Chatbot flow.',
                type: 'Lead'
            });
        } catch (e) {
            console.error("Chatbot lead submission failed", e);
        }
      }
    } finally {
      setIsTyping(false);
      setStep(nextStep);
      if (nextBotMsg) {
        addBotMessage(nextBotMsg);
      }
    }
  };

  const handleRefresh = () => {
    setStep(0);
    setLeadData({
      role: '',
      studentName: '',
      grade: '',
      studentEmail: '',
      studentPhone: '',
      parentName: '',
      parentEmail: '',
      parentPhone: '',
      course: '',
      notes: ''
    });
    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: "Hi! I’m your AIPrep365 AI Tutor 🤖. I can help you with SAT study plans, practice tests, and score improvement strategies. Are you preparing for the Digital SAT?\n\nBefore we begin, who is chatting with us today?"
      }
    ]);
    setInput('');
  };

  const QuickActions = () => {
    if (isTyping) return null;

    if (step === 0) {
        return (
            <div className="flex flex-col gap-2 mt-2 w-full">
                <button onClick={() => handleSend("👨‍🎓 I am a Student")} className="chat-btn text-left">👨‍🎓 I am a Student</button>
                <button onClick={() => handleSend("👨‍👩‍👧 I am a Parent")} className="chat-btn text-left">👨‍👩‍👧 I am a Parent</button>
            </div>
        );
    }

    if (step === 10) {
        return (
            <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => handleSend("SAT")} className="chat-btn">SAT</button>
                <button onClick={() => handleSend("ACT")} className="chat-btn">ACT</button>
                <button onClick={() => handleSend("AP")} className="chat-btn">AP</button>
                <button onClick={() => handleSend("Practice Tests")} className="chat-btn">Practice Tests</button>
                <button onClick={() => handleSend("Tutoring")} className="chat-btn">Tutoring</button>
            </div>
        );
    }

    return null;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end print:hidden">
      <style>{`
        .chat-btn {
            font-size: 12px;
            font-weight: bold;
            background: white;
            border: 1px solid #e2e8f0;
            color: #4f46e5;
            padding: 8px 12px;
            border-radius: 8px;
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
            className="bg-white dark:bg-gray-800 w-[calc(100vw-2rem)] sm:w-80 md:w-96 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-4 flex flex-col max-h-[75vh] sm:max-h-[550px]"
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
                  <div className={`max-w-[88%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words overflow-hidden whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-tl-none'}`} style={{ overflowWrap: 'anywhere' }}>
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
            {step < 12 && (
              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800">
                <div className="flex gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={
                      step === 3 ? "Enter student's email..." : 
                      step === 4 ? "Enter 6-digit code..." :
                      step === 7 ? "Enter parent's email..." :
                      step === 8 ? "Enter 6-digit code..." :
                      "Type your message..."
                    }
                    className="flex-1 p-2 bg-transparent text-sm outline-none dark:text-white"
                  />
                  <button onClick={() => handleSend()} disabled={(!input.trim() && step !== 9) || isTyping} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
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