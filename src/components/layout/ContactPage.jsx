import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { contactService } from '../../services/api';

const { FiMail, FiPhone, FiUser, FiMessageSquare, FiSend, FiLoader, FiCheckCircle, FiArrowLeft, FiChevronDown } = FiIcons;

const ContactPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    subject: 'General Inquiry',
    message: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.fullName || !formData.email || !formData.message) {
        throw new Error("Please fill in all required fields.");
      }
      
      const res = await contactService.submit(formData);
      if (res.success || res.message) {
        setSubmitted(true);
      } else {
        throw new Error(res.error || "Failed to send message. Please try again.");
      }
    } catch (err) {
      console.error('Submission Error:', err);
      setError(err.message || "Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const subjects = [
    'General Inquiry',
    'Technical Support',
    'Course Information',
    'Booking a Demo',
    'Billing Issue',
    'Partnership'
  ];

  return (
    <div className="min-h-screen bg-[#030711] text-white selection:bg-sky-500/30 selection:text-sky-400 pt-32 pb-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] opacity-10 pointer-events-none" />

      <div className="max-w-5xl mx-auto w-full relative z-10">
        
        <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-white mb-8 pr-4 py-2 font-black uppercase tracking-[0.2em] text-[10px] transition-all group relative z-50">
          <SafeIcon icon={FiArrowLeft} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
        </Link>

        <div className="bg-[#0a0f1d] border border-white/5 rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          
          {/* Left Side - Info Panel (High Contrast) */}
          <div className="bg-gradient-to-br from-black to-[#0a0f1d] text-white p-12 md:w-[40%] flex flex-col justify-between relative overflow-hidden border-r border-white/5">
            <div className="relative z-10">
              <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-6">Contact Us</h2>
              <p className="text-slate-400 mb-12 leading-relaxed font-medium">
                Have questions about our courses or need technical support? We're here to help you ace your journey!
              </p>
              
              <div className="space-y-8">
                <div className="flex items-center gap-5 group">
                  <div className="w-12 h-12 bg-sky-600/10 border border-sky-600/20 rounded-2xl flex items-center justify-center transition-all group-hover:bg-sky-600/20">
                    <SafeIcon icon={FiMail} className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Email</p>
                    <p className="font-bold tracking-tight">support@aiprep365.com</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-5 group">
                  <div className="w-12 h-12 bg-sky-600/10 border border-sky-600/20 rounded-2xl flex items-center justify-center transition-all group-hover:bg-sky-600/20">
                    <SafeIcon icon={FiPhone} className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Phone</p>
                    <p className="font-bold tracking-tight">+1 987 654 3210</p>
                  </div>
                </div>
              </div>

              <div className="mt-16 pt-10 border-t border-white/5">
                 <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Our AI is always online</span>
                 </div>
              </div>
            </div>
            
            {/* Decor Circles */}
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-red-600/10 rounded-full blur-[80px]" />
            <div className="absolute bottom-[-10%] left-[-20%] w-48 h-48 bg-blue-600/10 rounded-full blur-[60px]" />
          </div>

          {/* Right Side - Interactive Form */}
          <div className="p-12 md:w-[60%] bg-[#0a0f1d] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  className="h-full flex flex-col items-center justify-center text-center"
                >
                  <div className="w-24 h-24 bg-green-500/10 border border-green-500/20 rounded-[32px] flex items-center justify-center mb-8">
                    <SafeIcon icon={FiCheckCircle} className="w-12 h-12 text-green-500" />
                  </div>
                  <h3 className="text-3xl font-black italic tracking-tighter text-white uppercase mb-4">Message Sent!</h3>
                  <p className="text-slate-400 mb-10 max-w-sm mx-auto font-medium">Thank you for reaching out. Our support team (and AI) will get back to you shortly.</p>
                  <Link to="/" className="px-10 py-4 bg-white text-black rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                    <SafeIcon icon={FiArrowLeft} /> Return Home
                  </Link>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit} 
                  className="space-y-6"
                >
                  <div className="mb-8">
                    <h4 className="text-lg font-bold text-white mb-2">Send us a message</h4>
                    <p className="text-sm text-slate-500 font-medium italic">We typically respond in less than 2 hours.</p>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-red-500" /> {error}
                    </motion.div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative group">
                        <SafeIcon icon={FiUser} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors w-4 h-4" />
                        <input 
                          type="text" 
                          name="fullName" 
                          value={formData.fullName} 
                          onChange={handleChange} 
                          required
                          className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/5 rounded-2xl focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Subject</label>
                      <div className="relative group">
                        <SafeIcon icon={FiChevronDown} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none w-4 h-4" />
                        <select 
                          name="subject" 
                          value={formData.subject} 
                          onChange={handleChange} 
                          className="w-full pl-5 pr-10 py-4 bg-black/40 border border-white/5 rounded-2xl focus:border-red-500/50 focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-white font-medium appearance-none cursor-pointer"
                        >
                          {subjects.map(s => <option key={s} value={s} className="bg-[#0a0f1d]">{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mobile Number</label>
                      <div className="relative group">
                        <SafeIcon icon={FiPhone} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-red-500 transition-colors w-4 h-4" />
                        <input 
                          type="tel" 
                          name="mobile" 
                          value={formData.mobile} 
                          onChange={handleChange} 
                          className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/5 rounded-2xl focus:border-red-500/50 focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700"
                          placeholder="+91..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative group">
                        <SafeIcon icon={FiMail} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-sky-500 transition-colors w-4 h-4" />
                        <input 
                          type="email" 
                          name="email" 
                          value={formData.email} 
                          onChange={handleChange} 
                          required
                          className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/5 rounded-2xl focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>
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
                        className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/5 rounded-2xl focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-white font-medium placeholder:text-slate-700 resize-none"
                        placeholder="How can we help you? Tell us about your goals..."
                      ></textarea>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-orange-500 text-slate-950 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-orange-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-950/20 disabled:opacity-50 active:scale-[0.98]"
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
        </div>

        <div className="mt-12 text-center opacity-30">
           <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
             © 2026 Aiprep365 Powered by TestPrep Pundit. All rights reserved.
           </p>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;