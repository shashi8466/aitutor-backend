import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { contactService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { FiHelpCircle, FiMessageSquare, FiMail, FiChevronDown, FiChevronUp, FiSend, FiLoader } = FiIcons;

const ParentSupport = () => {
  const { user } = useAuth();
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const faqs = [
    {
      question: "How do I link my child's account to mine?",
      answer: "Ask your child's tutor or our support team to link your account to your child's student profile. Once linked, you can switch between children from the sidebar."
    },
    {
      question: "Where can I see my child's test scores?",
      answer: "Use the Overview, Course Breakdown, and Student Analytics tabs to see your child's progress and completed tests."
    },
    {
      question: "How do I update my profile or notification settings?",
      answer: "Go to Profile Settings from the sidebar to update your contact details and notification preferences."
    },
    {
      question: "Who do I contact for account or billing issues?",
      answer: "Use the Contact Support form here - it goes directly to the admin team."
    }
  ];

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await contactService.submit({
        name: user?.name || 'Parent',
        email: user?.email || 'unknown@parent.com',
        subject: ticketForm.subject,
        message: ticketForm.message,
        mobile: user?.mobile || user?.phone || user?.user_metadata?.mobile || user?.user_metadata?.phone || ''
      }, 'parent_support');
      setSubmitted(true);
      setTicketForm({ subject: '', message: '' });
    } catch (err) {
      console.error(err);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = (index) => {
    setActiveAccordion(activeAccordion === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8 text-center"
        >
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Help & Support</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Find answers to common questions or get in touch with our team.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* FAQs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center space-x-2 mb-6 border-b border-gray-100 dark:border-gray-700 pb-2">
              <SafeIcon icon={FiHelpCircle} className="w-6 h-6 text-[#E53935]" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleAccordion(index)}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{faq.question}</span>
                    <SafeIcon
                      icon={activeAccordion === index ? FiChevronUp : FiChevronDown}
                      className="w-4 h-4 text-gray-500 dark:text-gray-400"
                    />
                  </button>
                  {activeAccordion === index && (
                    <div className="p-4 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm border-t border-gray-200 dark:border-gray-700">
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
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center space-x-2 mb-6 border-b border-gray-100 dark:border-gray-700 pb-2">
              <SafeIcon icon={FiMessageSquare} className="w-6 h-6 text-[#E53935]" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Contact Support</h2>
            </div>

            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <SafeIcon icon={FiSend} className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Message Sent!</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Your request has been sent to our support team.</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                  <select
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  >
                    <option value="" className="bg-white dark:bg-gray-800">Select a topic...</option>
                    <option value="Technical Issue" className="bg-white dark:bg-gray-800">Technical Issue</option>
                    <option value="Content Error" className="bg-white dark:bg-gray-800">Report Incorrect Content</option>
                    <option value="Account Help" className="bg-white dark:bg-gray-800">Account Help</option>
                    <option value="Child Account Linking" className="bg-white dark:bg-gray-800">Child Account Linking</option>
                    <option value="Feedback" className="bg-white dark:bg-gray-800">Feature Suggestion</option>
                    <option value="Other" className="bg-white dark:bg-gray-800">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-gray-900 dark:text-white"
                    placeholder="Describe your issue or suggestion..."
                    value={ticketForm.message}
                    onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-8 py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-[#d32f2f] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-200 dark:shadow-none disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? <SafeIcon icon={FiLoader} className="animate-spin w-5 h-5" /> : <SafeIcon icon={FiSend} className="w-5 h-5" />}
                  <span>{loading ? 'Sending...' : 'Send Message'}</span>
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 text-sm font-medium">
                <SafeIcon icon={FiMail} className="w-4 h-4" />
                <span>support@aiprep365.com</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ParentSupport;
