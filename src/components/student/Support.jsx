import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiHelpCircle, FiMessageSquare, FiMail, FiChevronDown, FiChevronUp, FiSend } = FiIcons;

const Support = () => {
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const faqs = [
    {
      question: "How do I unlock the next difficulty level?",
      answer: "You need to complete the current level's quiz with a score of at least 70% to unlock the next difficulty level."
    },
    {
      question: "Can I retake a quiz?",
      answer: "Yes, you can retake quizzes as many times as you want. Your highest score will be recorded for progress tracking."
    },
    {
      question: "How does the AI Tutor work?",
      answer: "When you answer a question incorrectly, you can click 'Chat with AI Tutor'. The AI analyzes your mistake and provides a personalized explanation or a similar practice question."
    },
    {
      question: "Are the courses free?",
      answer: "Currently, all courses listed on your dashboard are included in your student access plan."
    }
  ];

  const handleTicketSubmit = (e) => {
    e.preventDefault();
    // Simulate API call
    setTimeout(() => {
      setSubmitted(true);
      setTicketForm({ subject: '', message: '' });
    }, 1000);
  };

  const toggleAccordion = (index) => {
    setActiveAccordion(activeAccordion === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
          <p className="text-gray-600 mt-2">Find answers to common questions or get in touch with our team.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* FAQs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
          >
            <div className="flex items-center space-x-2 mb-6">
              <SafeIcon icon={FiHelpCircle} className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleAccordion(index)}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="font-medium text-gray-900">{faq.question}</span>
                    <SafeIcon 
                      icon={activeAccordion === index ? FiChevronUp : FiChevronDown} 
                      className="w-4 h-4 text-gray-500" 
                    />
                  </button>
                  {activeAccordion === index && (
                    <div className="p-4 bg-white text-gray-600 text-sm">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Contact / Report Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
          >
            <div className="flex items-center space-x-2 mb-6">
              <SafeIcon icon={FiMessageSquare} className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-900">Contact Support</h2>
            </div>
            
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <SafeIcon icon={FiSend} className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Message Sent!</h3>
                <p className="text-gray-600 mt-2">We'll get back to you shortly.</p>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select 
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm({...ticketForm, subject: e.target.value})}
                  >
                    <option value="">Select a topic...</option>
                    <option value="Technical Issue">Technical Issue</option>
                    <option value="Content Error">Report Incorrect Content</option>
                    <option value="Account Help">Account Help</option>
                    <option value="Feedback">Feature Suggestion</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe your issue or suggestion..."
                    value={ticketForm.message}
                    onChange={(e) => setTicketForm({...ticketForm, message: e.target.value})}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <SafeIcon icon={FiSend} className="w-4 h-4" />
                  <span>Send Message</span>
                </button>
              </form>
            )}
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-2 text-gray-500 text-sm">
                <SafeIcon icon={FiMail} className="w-4 h-4" />
                <span>support@eduplatform.com</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Support;