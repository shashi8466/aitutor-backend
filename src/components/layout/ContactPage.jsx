import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { contactService } from '../../services/api';

const { FiMail, FiPhone, FiUser, FiMessageSquare, FiSend, FiLoader, FiCheckCircle, FiArrowLeft } = FiIcons;

const ContactPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
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
      
      await contactService.submit(formData);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 transition-colors duration-200 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-4xl mx-auto w-full">
        
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white mb-8 font-bold transition-colors">
          <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back to Home
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Side - Info */}
          <div className="bg-black text-white p-10 md:w-2/5 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl font-extrabold mb-4">Contact Us</h2>
              <p className="text-gray-300 mb-8 leading-relaxed">
                Have questions about our courses or need technical support? We're here to help!
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                    <SafeIcon icon={FiMail} className="w-5 h-5 text-[#E53935]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Email</p>
                    <p className="font-medium">support@aitutor.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                    <SafeIcon icon={FiPhone} className="w-5 h-5 text-[#E53935]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Phone</p>
                    <p className="font-medium">+91 98765 43210</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decor */}
            <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-[#E53935] rounded-full blur-3xl opacity-20"></div>
            <div className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-blue-600 rounded-full blur-3xl opacity-20"></div>
          </div>

          {/* Right Side - Form */}
          <div className="p-10 md:w-3/5 bg-white dark:bg-gray-800">
            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <SafeIcon icon={FiCheckCircle} className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Message Sent!</h3>
                <p className="text-gray-500 dark:text-gray-300 mb-8">Thank you for reaching out. We will get back to you shortly via email.</p>
                <Link to="/" className="px-8 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">
                  Return Home
                </Link>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">
                    {error}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                  <div className="relative">
                    <SafeIcon icon={FiUser} className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                    <input 
                      type="text" 
                      name="fullName" 
                      value={formData.fullName} 
                      onChange={handleChange} 
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Mobile Number</label>
                    <div className="relative">
                      <SafeIcon icon={FiPhone} className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                      <input 
                        type="tel" 
                        name="mobile" 
                        value={formData.mobile} 
                        onChange={handleChange} 
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all"
                        placeholder="+91..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                    <div className="relative">
                      <SafeIcon icon={FiMail} className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                      <input 
                        type="email" 
                        name="email" 
                        value={formData.email} 
                        onChange={handleChange} 
                        required
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Message</label>
                  <div className="relative">
                    <SafeIcon icon={FiMessageSquare} className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                    <textarea 
                      name="message" 
                      value={formData.message} 
                      onChange={handleChange} 
                      required
                      rows="4"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all"
                      placeholder="How can we help you?"
                    ></textarea>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[#E53935] text-white py-4 rounded-xl font-bold hover:bg-[#d32f2f] transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-200 dark:shadow-none disabled:opacity-70"
                >
                  {loading ? <SafeIcon icon={FiLoader} className="animate-spin w-5 h-5" /> : <SafeIcon icon={FiSend} className="w-5 h-5" />}
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;