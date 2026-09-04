import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { supportIssueService } from '../../services/api';

const { FiX, FiFlag, FiCheckCircle, FiLoader } = FiIcons;

const CATEGORIES = [
  { value: 'incorrect_response', label: 'Incorrect chatbot response' },
  { value: 'verification_query', label: 'Chatbot verification or query' },
  { value: 'support_request', label: 'Chatbot support request' },
  { value: 'other', label: 'Other' }
];

const ChatbotIssueModal = ({ isOpen, onClose, chatMessage }) => {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (submitting) return;
    onClose();
    setTimeout(() => {
      setCategory('');
      setDescription('');
      setSubmitted(false);
      setError('');
    }, 300);
  };

  const handleSubmit = async () => {
    if (!category || submitting) return;
    try {
      setSubmitting(true);
      setError('');
      const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label || category;
      await supportIssueService.submit({
        issue_type: 'chatbot_issue',
        category,
        subject: categoryLabel,
        description: description.trim() || null,
        metadata: { chatMessage: chatMessage || null }
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting chatbot issue:', err);
      setError('Something went wrong submitting your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[999999] backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {submitted ? (
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center mb-4">
                  <SafeIcon icon={FiCheckCircle} className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Thanks! Your report has been submitted.</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Our team will review this chatbot response.</p>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-[#E53935] text-white font-semibold text-sm hover:bg-black transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <SafeIcon icon={FiFlag} className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">Report a Chatbot Problem</h2>
                  </div>
                  <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <SafeIcon icon={FiX} className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 py-5 overflow-y-auto">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">What's wrong with this response?</p>
                  <div className="space-y-2 mb-5">
                    {CATEGORIES.map((c) => (
                      <label
                        key={c.value}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                          category === c.value
                            ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="chatbot-issue-category"
                          value={c.value}
                          checked={category === c.value}
                          onChange={() => setCategory(c.value)}
                          className="w-4 h-4 text-[#E53935] focus:ring-[#E53935]"
                        />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.label}</span>
                      </label>
                    ))}
                  </div>

                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Additional details <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the problem..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 resize-none"
                  />

                  {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handleClose}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!category || submitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E53935] text-white font-semibold text-sm hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting && <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />}
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatbotIssueModal;
