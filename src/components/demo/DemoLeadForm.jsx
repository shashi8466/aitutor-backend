import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import axios from 'axios';
import SafeIcon from '../../common/SafeIcon';

const { FiUser, FiMail, FiPhone, FiBookOpen, FiLoader, FiCheckCircle, FiX, FiChevronDown, FiShield } = FiIcons;

const DemoLeadForm = ({ isOpen, onClose, onSubmit, courseName, level }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    grade: '',
    email: '',
    phone: '',
    parentName: '',
    parentEmail: ''
  });
  const [countryCode, setCountryCode] = useState('+1');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // OTP Verification States
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOTP = async () => {
    if (!termsAccepted) {
      setError('You must agree to the Terms & Conditions and Privacy Policy.');
      return;
    }
    if (!formData.phone || formData.phone.trim().length < 8) {
      setError('Please enter a valid phone number.');
      return;
    }
    setOtpLoading(true);
    setError('');
    setOtpError('');
    setDebugOtp('');

    try {
      const fullPhone = `${countryCode}${formData.phone.replace(/[^\d]/g, '')}`;
      const response = await axios.post('/api/demo/send-otp', { phone: fullPhone });
      if (response.data.success) {
        setOtpSent(true);
        if (response.data.otpForTesting) {
          setDebugOtp(response.data.otpForTesting);
        }
      } else {
        setError(response.data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      console.error('❌ [DEMO OTP] Send error:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to send OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyAndSubmit = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit verification code.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    setError('');

    try {
      const fullPhone = `${countryCode}${formData.phone.replace(/[^\d]/g, '')}`;
      const response = await axios.post('/api/demo/verify-otp', { phone: fullPhone, otp });
      if (response.data.success) {
        setOtpVerified(true);
        const cleanedFormData = {
          ...formData,
          phone: fullPhone,
          countryCode
        };
        await onSubmit(cleanedFormData);
        setSubmitted(true);
      } else {
        setOtpError(response.data.error || 'Invalid verification code.');
      }
    } catch (err) {
      console.error('❌ [DEMO OTP] Verify error:', err);
      setOtpError(err?.response?.data?.error || err?.message || 'Verification failed.');
    } finally {
      setOtpLoading(false);
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
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Verified!</h2>
              <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                Your details are successfully verified. You may now start your SAT exam.
              </p>
              <button
                onClick={onClose}
                className="w-full mt-6 py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg"
              >
                Start SAT Exam
              </button>
            </div>
          ) : (
            <>
              <div className="bg-[#E53935] p-6 text-white relative">
                <h2 className="text-xl font-black uppercase tracking-tight">Before Starting the Exam</h2>
                <p className="text-red-100 text-sm font-medium">Please verify your details to start the SAT practice test.</p>
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <SafeIcon icon={FiX} className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[80vh]">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 uppercase tracking-tighter mb-4">
                    {error}
                  </div>
                )}

                {!otpSent ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Student Full Name</label>
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
                      <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Student Email Address</label>
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
                      <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Parent Name</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          <SafeIcon icon={FiUser} className="w-4 h-4" />
                        </div>
                        <input
                          required
                          type="text"
                          name="parentName"
                          value={formData.parentName}
                          onChange={handleChange}
                          placeholder="Sarah Doe"
                          className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Parent Email Address</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          <SafeIcon icon={FiMail} className="w-4 h-4" />
                        </div>
                        <input
                          required
                          type="email"
                          name="parentEmail"
                          value={formData.parentEmail}
                          onChange={handleChange}
                          placeholder="sarah@example.com"
                          className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="w-28 shrink-0">
                        <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">Country</label>
                        <div className="relative">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="w-full pl-3 pr-8 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-bold hover:bg-gray-50 cursor-pointer"
                          >
                            <option value="+1">🇺🇸 +1</option>
                            <option value="+91">🇮🇳 +91</option>
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none">
                            <SafeIcon icon={FiChevronDown} className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1">
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
                            placeholder="e.g., 713 452 0639"
                            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-medium placeholder-gray-400 hover:bg-gray-50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Privacy Policy & Terms Section */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-[10px] space-y-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 leading-normal font-medium mt-4">
                      <p className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-[9px]">Privacy Policy &amp; Terms Summary</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>User phone numbers will only be used for OTP verification and authentication purposes.</li>
                        <li>User data such as Name, Email, Parent Name, Parent Email, and Phone Number will be stored securely and will not be shared with third parties.</li>
                        <li>OTP verification is mandatory before account creation.</li>
                      </ul>
                    </div>

                    {/* Mandatory Checkbox */}
                    <div className="flex items-start gap-2 py-1 mt-2">
                      <input
                        id="termsAccepted"
                        name="termsAccepted"
                        type="checkbox"
                        required
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1 h-3.5 w-3.5 text-[#E53935] border-gray-300 rounded focus:ring-[#E53935] cursor-pointer"
                      />
                      <label htmlFor="termsAccepted" className="text-[11px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                        I agree to the Terms &amp; Conditions and Privacy Policy
                      </label>
                    </div>

                    <button
                      disabled={otpLoading || !termsAccepted || !formData.fullName || !formData.email || !formData.phone || !formData.parentName || !formData.parentEmail || !formData.grade}
                      onClick={handleSendOTP}
                      type="button"
                      className="w-full mt-4 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      {otpLoading ? (
                        <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                      ) : (
                        <>Send Verification Code</>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyAndSubmit} className="space-y-4">
                    <div className="text-center p-2 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 text-sm font-semibold">
                      Verification code sent to <strong>{countryCode} {formData.phone}</strong>
                    </div>

                    {otpError && (
                      <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 uppercase tracking-tighter">
                        {otpError}
                      </div>
                    )}

                    {debugOtp && (
                      <div className="p-3 bg-yellow-50 text-yellow-800 text-xs font-bold rounded-lg border border-yellow-100 tracking-tight text-center">
                        🔑 DEBUG CODE (SMS Not Configured): <strong>{debugOtp}</strong>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1 text-center">Enter 6-Digit OTP</label>
                      <input
                        required
                        maxLength={6}
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="123456"
                        className="w-full text-center py-4 bg-white border-2 border-gray-200 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 font-extrabold text-2xl tracking-widest placeholder-gray-300 hover:bg-gray-50"
                      />
                    </div>

                    <button
                      disabled={otpLoading || otp.length !== 6}
                      type="submit"
                      className="w-full mt-2 py-3 bg-[#E53935] hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      {otpLoading ? (
                        <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                      ) : (
                        <>Verify &amp; Start Test</>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="w-full text-center text-xs text-gray-500 font-bold hover:underline py-2"
                    >
                      Back to details edit
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DemoLeadForm;
