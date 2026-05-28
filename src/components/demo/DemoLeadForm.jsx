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
  const [showTermsModal, setShowTermsModal] = useState(false);

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

  const renderTermsModal = () => {
    if (!showTermsModal) return null;
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTermsModal(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-700 z-[2001]"
          >
            <div className="bg-[#E53935] p-5 text-white relative">
              <h3 className="text-lg font-black uppercase tracking-tight">Privacy Policy &amp; Terms &amp; Conditions</h3>
              <p className="text-red-100 text-xs font-medium">Please review our terms of service and data policy below.</p>
              <button
                onClick={() => setShowTermsModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors text-white"
              >
                <SafeIcon icon={FiX} className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[55vh] space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300 font-medium text-left">
              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">1. Introduction</h4>
              <p>Welcome to AIPrep365. By creating an account, verifying OTP, or accessing our SAT/AP preparation platform, you agree to the following Privacy Policy and Terms &amp; Conditions.</p>
              <p>Users must read and accept these terms before signing up, verifying OTP, or starting any demo/full-length test.</p>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">2. Information We Collect</h4>
              <p>We may collect the following user information during signup or exam registration:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Full Name</li>
                <li>Email Address</li>
                <li>Mobile Number</li>
                <li>Parent/Guardian Name</li>
                <li>Parent/Guardian Email</li>
                <li>Account Type</li>
                <li>OTP Verification Status</li>
              </ul>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">3. OTP Verification &amp; Messaging Policy</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Mobile numbers are collected for OTP verification, authentication, account security, and important platform communication purposes.</li>
                <li>By providing your phone number, you consent to receive OTP codes, verification messages, account-related notifications, and important updates from AIPrep365.</li>
                <li>The platform supports OTP verification for both India (+91) and USA (+1) phone numbers.</li>
                <li>Users must successfully verify OTP before: creating an account, submitting signup forms, or starting demo SAT/AP exams.</li>
              </ul>
              <p>Without OTP verification, users cannot proceed further.</p>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">4. How We Use User Data</h4>
              <p>User information is used only for:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Account creation and authentication</li>
                <li>OTP verification</li>
                <li>Exam access and progress tracking</li>
                <li>Parent communication (if required)</li>
                <li>Important platform notifications and updates</li>
                <li>Sending OTP and service-related messages to registered phone numbers</li>
              </ul>
              <p>We do not sell or share user personal information with unauthorized third parties.</p>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">5. Data Protection &amp; Security</h4>
              <p>We take reasonable security measures to protect user information, OTP data, and personal details from unauthorized access, misuse, or disclosure.</p>
              <p>User data is stored securely and used only for platform-related operations.</p>
              <p>However, users are responsible for maintaining the confidentiality of their login credentials.</p>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">6. Parent Information</h4>
              <p>If parent/guardian details are collected:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>They will only be used for communication related to student performance, updates, account verification, or important notifications.</li>
                <li>Parent information will not be publicly displayed or shared externally.</li>
              </ul>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">7. User Responsibilities</h4>
              <p>Users agree:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>To provide accurate information</li>
                <li>Not to misuse OTP systems</li>
                <li>Not to create fake accounts</li>
                <li>Not to share exam content illegally</li>
                <li>Not to attempt unauthorized access to the platform</li>
              </ul>
              <p>Violation of these terms may result in account suspension or removal.</p>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">8. Demo Test &amp; Exam Rules</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Users may be required to complete registration before starting demo/full-length tests.</li>
                <li>OTP verification and acceptance of Terms &amp; Conditions are mandatory before exam access.</li>
                <li>The platform reserves the right to restrict access if suspicious activity is detected.</li>
              </ul>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">9. Mandatory Acceptance</h4>
              <p>Before signup or exam access, users must check the checkbox below:</p>
              <p><strong>&ldquo;I agree to the Terms &amp; Conditions and Privacy Policy&rdquo;</strong></p>
              <p>If unchecked:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Signup must remain blocked</li>
                <li>OTP verification submission must remain blocked</li>
                <li>Demo/SAT exam access must remain blocked</li>
              </ul>

              <h4 className="font-bold text-gray-900 dark:text-white border-b pb-1 uppercase tracking-wider text-xs">10. Contact</h4>
              <p>For any privacy, OTP, or account-related concerns, users may contact the platform administrator or support team.</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-150 dark:border-gray-600 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-6 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-all text-xs"
              >
                Close &amp; Return
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
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


                    {/* Mandatory Checkbox */}
                    <div className="flex items-start gap-2 py-1 mt-2">
                      <input
                        id="termsAccepted"
                        name="termsAccepted"
                        type="checkbox"
                        required
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1 h-3.5 w-3.5 text-[#E53935] border-gray-300 rounded focus:ring-[#E53935] cursor-pointer shrink-0"
                      />
                      <label htmlFor="termsAccepted" className="text-[11px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer select-none leading-normal">
                        I agree to the <button type="button" onClick={() => setShowTermsModal(true)} className="text-[#E53935] underline hover:text-red-700 font-black inline">Privacy Policy &amp; Terms &amp; Conditions</button>
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
                      <label className="block text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-1 text-center">Enter 6-Digit OTP</label>
                      <input
                        required
                        maxLength={6}
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="123456"
                        className="w-full text-center py-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 focus:border-[#E53935] rounded-xl outline-none transition-all text-gray-900 dark:text-white font-extrabold text-2xl tracking-widest placeholder-gray-300 hover:bg-gray-50"
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
                        <>Start Exam</>
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

      {/* Terms & Conditions Modal Overlay */}
      {renderTermsModal()}
    </AnimatePresence>
  );
};

export default DemoLeadForm;
