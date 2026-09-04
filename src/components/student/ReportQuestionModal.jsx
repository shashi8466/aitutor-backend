import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { supportIssueService } from '../../services/api';

const { FiX, FiFlag, FiCheckCircle, FiLoader } = FiIcons;

const CATEGORIES = [
  { value: 'incorrect_question', label: 'Incorrect question' },
  { value: 'incorrect_answer', label: 'Incorrect answer/options' },
  { value: 'formatting_issue', label: 'Formatting/display issue' },
  { value: 'image_not_loading', label: 'Image/table not loading' },
  { value: 'typo_content', label: 'Typo or content issue' },
  { value: 'duplicate_question', label: 'Duplicate question' },
  { value: 'other', label: 'Other' }
];

const ReportQuestionModal = ({
  isOpen,
  onClose,
  question,
  questionNumber,
  courseId,
  courseInfo,
  level,
  submissionId,
  user
}) => {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (submitting) return;
    onClose();
    // Reset after the close animation so a reopen always starts fresh.
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
        issue_type: 'question_report',
        category,
        subject: categoryLabel,
        description: description.trim() || null,
        related_question_id: question?.id,
        related_course_id: courseId,
        related_submission_id: submissionId || null,
        metadata: {
          question_number: questionNumber,
          topic: question?.topic || null,
          difficulty: level || null,
          subject: courseInfo?.tutor_type || courseInfo?.category || null
        }
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting question report:', err);
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {submitted ? (
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                  <SafeIcon icon={FiCheckCircle} className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Thanks! Your report has been submitted.</h2>
                <p className="text-sm text-slate-500 mb-6">Our team will review this question.</p>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <SafeIcon icon={FiFlag} className="w-4 h-4 text-slate-500" />
                    <h2 className="text-base font-bold text-slate-900">Report a Problem</h2>
                  </div>
                  <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <SafeIcon icon={FiX} className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 py-5 overflow-y-auto">
                  <p className="text-sm font-semibold text-slate-700 mb-3">What's wrong with this question?</p>
                  <div className="space-y-2 mb-5">
                    {CATEGORIES.map((c) => (
                      <label
                        key={c.value}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                          category === c.value
                            ? 'border-indigo-300 bg-indigo-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="report-category"
                          value={c.value}
                          checked={category === c.value}
                          onChange={() => setCategory(c.value)}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-800">{c.label}</span>
                      </label>
                    ))}
                  </div>

                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Additional details <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the problem..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none text-sm text-slate-800 placeholder:text-slate-400 resize-none"
                  />

                  {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                  <button
                    onClick={handleClose}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!category || submitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

export default ReportQuestionModal;
