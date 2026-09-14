import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { contactService } from '../../services/api';

const { FiX, FiUser, FiMail, FiPhone, FiMessageSquare, FiSend, FiLoader, FiCheckCircle } = FiIcons;

const EMPTY_FORM = { fullName: '', email: '', mobile: '', subject: '', message: '' };

const ContactUsModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleClose = () => {
    onClose();
    // Reset after the close animation finishes so the form doesn't visibly reset mid-close.
    setTimeout(() => {
      setFormData(EMPTY_FORM);
      setSubmitted(false);
      setError('');
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.fullName || !formData.email || !formData.message) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await contactService.submit(formData);
      if (res.success || res.message) {
        setSubmitted(true);
      } else {
        throw new Error(res.error || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      console.error('Contact form submission error:', err);
      setError(err.message || 'Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[#0a0f1d] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
          >
            <button
              onClick={handleClose}
              aria-label="Close"
              className="absolute top-5 right-5 z-10 p-2 rounded-full text-slate-500 hover:text-white hover:bg-white/5 transition-all"
            >
              <SafeIcon icon={FiX} className="w-5 h-5" />
            </button>

            <div className="p-8 sm:p-10">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center text-center py-10"
                  >
                    <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-[28px] flex items-center justify-center mb-6">
                      <SafeIcon icon={FiCheckCircle} className="w-10 h-10 text-green-500" />
                    </div>
                    <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase mb-3">Message sent successfully!</h3>
                    <p className="text-slate-400 mb-8 max-w-sm mx-auto font-medium">Thank you for reaching out. Our support team will get back to you shortly.</p>
                    <button
                      onClick={handleClose}
                      className="px-10 py-4 bg-white text-black rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Close
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={handleSubmit}
                    className="space-y-5"
                  >
                    <div className="mb-6">
                      <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase mb-2">Contact Us</h3>
                      <p className="text-sm text-slate-500 font-medium">Have a question? Send us a message and we'll get back to you.</p>
                    </div>

                    {error && (
                      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" /> {error}
                      </motion.div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Name</label>
                      <div className="relative group">
                        <SafeIcon icon={FiUser} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors w-4 h-4" />
                        <input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          required
                          className="w-full pl-12 pr-4 py-3.5 bg-black/40 border border-white/5 rounded-2xl focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                        <div className="relative group">
                          <SafeIcon icon={FiMail} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors w-4 h-4" />
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full pl-12 pr-4 py-3.5 bg-black/40 border border-white/5 rounded-2xl focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700"
                            placeholder="john@example.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone Number</label>
                        <div className="relative group">
                          <SafeIcon icon={FiPhone} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors w-4 h-4" />
                          <input
                            type="tel"
                            name="mobile"
                            value={formData.mobile}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-3.5 bg-black/40 border border-white/5 rounded-2xl focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700"
                            placeholder="+1..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Subject</label>
                      <input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        className="w-full px-5 py-3.5 bg-black/40 border border-white/5 rounded-2xl focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700"
                        placeholder="What's this about?"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Message</label>
                      <div className="relative group">
                        <SafeIcon icon={FiMessageSquare} className="absolute left-4 top-4 text-slate-600 group-focus-within:text-sky-500 transition-colors w-4 h-4" />
                        <textarea
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          required
                          rows="4"
                          className="w-full pl-12 pr-4 py-3.5 bg-black/40 border border-white/5 rounded-2xl focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700 resize-none"
                          placeholder="How can we help you?"
                        ></textarea>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-orange-500 text-slate-950 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-orange-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-950/20 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {loading ? (
                        <SafeIcon icon={FiLoader} className="animate-spin w-5 h-5" />
                      ) : (
                        <>
                          <SafeIcon icon={FiSend} className="w-4 h-4" />
                          Send Message
                        </>
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContactUsModal;
