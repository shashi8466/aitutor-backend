import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import axios from 'axios';
import SafeIcon from '../../common/SafeIcon';

const { FiUser, FiMail, FiPhone, FiBookOpen, FiSend, FiLoader, FiCheckCircle, FiX, FiChevronDown } = FiIcons;

const DemoLeadForm = ({ isOpen, onClose, onSubmit, courseName, level }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    grade: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // NOTE: OTP verification temporarily disabled (Twilio not working for USA numbers).

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanedFormData = {
        ...formData,
        phone: formData.phone.replace(/[^\d+]/g, '')
      };
      await onSubmit(cleanedFormData);
      setSubmitted(true);
    } catch (err) {
      console.error('❌ [DEMO FORM] Submission error:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to submit. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800"
        >
          {submitted ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <SafeIcon icon={FiCheckCircle} className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Thank You!</h2>
              <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                Thank you for completing the test. Your full score report will be sent to your email shortly.
              </p>
              <button
                onClick={onClose}
                className="w-full mt-6 py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg"
              >
                Close & Return
              </button>
            </div>
          ) : (
            <>
              <div className="bg-[#E53935] p-6 text-white relative">
                <h2 className="text-xl font-black uppercase tracking-tight">Great job finishing {level}!</h2>
                <p className="text-red-100 text-sm font-medium">Please provide your details to receive your full report.</p>
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <SafeIcon icon={FiX} className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 uppercase tracking-tighter">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Full Name</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <SafeIcon icon={FiUser} className="w-4 h-4" />
                    </div>
                    <input
                      required
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="John Doe"
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Grade</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                      <SafeIcon icon={FiBookOpen} className="w-4 h-4" />
                    </div>
                    <select
                      required
                      name="grade"
                      value={formData.grade}
                      onChange={handleChange}
                      className="w-full pl-10 pr-12 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium cursor-pointer hover:bg-gray-50"
                    >
                      <option value="" className="text-gray-500">Select Grade</option>
                      <option value="9" className="text-gray-900">Grade 9</option>
                      <option value="10" className="text-gray-900">Grade 10</option>
                      <option value="11" className="text-gray-900">Grade 11</option>
                      <option value="12" className="text-gray-900">Grade 12</option>
                      <option value="Other" className="text-gray-900">Other</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none">
                      <SafeIcon icon={FiChevronDown} className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <SafeIcon icon={FiMail} className="w-4 h-4" />
                    </div>
                    <input
                      required
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Phone Number</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <SafeIcon icon={FiPhone} className="w-4 h-4" />
                    </div>
                    <input
                      required
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="e.g., +1 713 452 0639"
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                    />
                  </div>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-1 ml-1 font-medium italic">
                    Include country code: <strong>+1</strong> for USA, <strong>+91</strong> for India
                  </p>
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full mt-2 py-3 bg-black hover:bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  {loading ? (
                    <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Submit &amp; Get Score</>
                  )}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DemoLeadForm;
