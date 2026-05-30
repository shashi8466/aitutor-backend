import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import axios from 'axios';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { authService, enrollmentService } from '../../services/api';

const { FiUser, FiLock, FiMail, FiBook, FiEye, FiEyeOff, FiArrowRight, FiAlertCircle, FiLoader, FiRefreshCw, FiCheckCircle, FiPhone, FiUsers, FiArrowLeft, FiLink, FiX } = FiIcons;

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    mobile: '',
    fatherName: '',
    fatherMobile: '',
    parentEmail: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMode, setSuccessMode] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');
  const [slowConnection, setSlowConnection] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  // States for country code, terms checkbox, and OTP
  const [countryCode, setCountryCode] = useState('+1');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);

  // States for Email OTP
  const [studentEmailOtpSent, setStudentEmailOtpSent] = useState(false);
  const [studentEmailOtp, setStudentEmailOtp] = useState('');
  const [studentEmailOtpLoading, setStudentEmailOtpLoading] = useState(false);
  const [studentEmailOtpError, setStudentEmailOtpError] = useState('');
  const [studentEmailDebugOtp, setStudentEmailDebugOtp] = useState('');
  const [studentEmailOtpVerified, setStudentEmailOtpVerified] = useState(false);

  const [parentEmailOtpSent, setParentEmailOtpSent] = useState(false);
  const [parentEmailOtp, setParentEmailOtp] = useState('');
  const [parentEmailOtpLoading, setParentEmailOtpLoading] = useState(false);
  const [parentEmailOtpError, setParentEmailOtpError] = useState('');
  const [parentEmailDebugOtp, setParentEmailDebugOtp] = useState('');
  const [parentEmailOtpVerified, setParentEmailOtpVerified] = useState(false);



  const { signup, login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [enrollmentKey, setEnrollmentKey] = useState(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    authService.wakeUp();
    const query = new URLSearchParams(window.location.search);
    const key = query.get('key');
    if (key) {
      setEnrollmentKey(key.trim().toUpperCase());
    }
  }, []);

  const handleAutoEnroll = async (key) => {
    if (!key) return;
    setEnrolling(true);
    try {
      await enrollmentService.useKey(key);
    } catch (err) {
      console.error('Auto-enrollment failed:', err);
    } finally {
      setEnrolling(false);
    }
  };

  const handleInteraction = () => {
    authService.wakeUp();
  };

  const finalizeRegistration = async (role) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'tutor') {
        navigate('/tutor');
      } else if (role === 'parent') {
        navigate('/parent');
      } else {
        navigate('/student');
      }
    } catch (error) {
      console.error('Redirection error:', error);
      navigate('/student');
    }
  };

  const handleSendOTP = async () => {
    if (!formData.mobile || formData.mobile.trim().length < 8) {
      setError('Please enter a valid mobile number.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    setError('');
    setDebugOtp('');
    try {
      const fullPhone = `${countryCode}${formData.mobile.replace(/[^\d]/g, '')}`;
      const response = await axios.post('/api/demo/send-otp', { phone: fullPhone });
      if (response.data.success) {
        setOtpSent(true);
        if (response.data.otpForTesting) {
          setDebugOtp(response.data.otpForTesting);
        }
      } else {
        setOtpError(response.data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setOtpError(err?.response?.data?.error || err?.message || 'Failed to send OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSendStudentEmailOTP = async () => {
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      setError('Please enter a valid student email address.');
      return;
    }
    setStudentEmailOtpLoading(true);
    setStudentEmailOtpError('');
    setError('');
    setStudentEmailDebugOtp('');
    try {
      const response = await axios.post('/api/demo/send-email-otp', { email: formData.email });
      if (response.data.success) {
        setStudentEmailOtpSent(true);
        if (response.data.otpForTesting) {
          setStudentEmailDebugOtp(response.data.otpForTesting);
        }
      } else {
        setStudentEmailOtpError(response.data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setStudentEmailOtpError(err?.response?.data?.error || err?.message || 'Failed to send OTP.');
    } finally {
      setStudentEmailOtpLoading(false);
    }
  };

  const handleVerifyStudentEmailOTP = async () => {
    if (studentEmailOtp.length !== 6) {
      setStudentEmailOtpError('Please enter a 6-digit verification code.');
      return;
    }
    setStudentEmailOtpLoading(true);
    setStudentEmailOtpError('');
    try {
      const response = await axios.post('/api/demo/verify-email-otp', { email: formData.email, otp: studentEmailOtp });
      if (response.data.success) {
        setStudentEmailOtpVerified(true);
        setStudentEmailOtpError('');
      } else {
        setStudentEmailOtpError(response.data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setStudentEmailOtpError(err?.response?.data?.error || err?.message || 'Verification failed.');
    } finally {
      setStudentEmailOtpLoading(false);
    }
  };

  const handleSendParentEmailOTP = async () => {
    if (!formData.parentEmail || !/^\S+@\S+\.\S+$/.test(formData.parentEmail)) {
      setError('Please enter a valid parent email address.');
      return;
    }
    setParentEmailOtpLoading(true);
    setParentEmailOtpError('');
    setError('');
    setParentEmailDebugOtp('');
    try {
      const response = await axios.post('/api/demo/send-email-otp', { email: formData.parentEmail });
      if (response.data.success) {
        setParentEmailOtpSent(true);
        if (response.data.otpForTesting) {
          setParentEmailDebugOtp(response.data.otpForTesting);
        }
      } else {
        setParentEmailOtpError(response.data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setParentEmailOtpError(err?.response?.data?.error || err?.message || 'Failed to send OTP.');
    } finally {
      setParentEmailOtpLoading(false);
    }
  };

  const handleVerifyParentEmailOTP = async () => {
    if (parentEmailOtp.length !== 6) {
      setParentEmailOtpError('Please enter a 6-digit verification code.');
      return;
    }
    setParentEmailOtpLoading(true);
    setParentEmailOtpError('');
    try {
      const response = await axios.post('/api/demo/verify-email-otp', { email: formData.parentEmail, otp: parentEmailOtp });
      if (response.data.success) {
        setParentEmailOtpVerified(true);
        setParentEmailOtpError('');
      } else {
        setParentEmailOtpError(response.data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setParentEmailOtpError(err?.response?.data?.error || err?.message || 'Verification failed.');
    } finally {
      setParentEmailOtpLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Please enter a 6-digit verification code.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const fullPhone = `${countryCode}${formData.mobile.replace(/[^\d]/g, '')}`;
      const response = await axios.post('/api/demo/verify-otp', { phone: fullPhone, otp });
      if (response.data.success) {
        setOtpVerified(true);
        setShowOtpModal(false);

        // OTP Verified, proceed to actual Supabase signup!
        setLoading(true);
        setSlowConnection(false);
        setError('');

        const slowTimer = setTimeout(() => setSlowConnection(true), 2000);

        try {
          const signupPayload = {
            ...formData,
            mobile: fullPhone
          };
          console.log('🔄 Starting signup for:', signupPayload.email);
          const result = await signup(signupPayload);
          clearTimeout(slowTimer);

          if (result.success) {
            console.log('✅ Signup successful:', result);
            const roleRequiresApproval = formData.role === 'tutor' || formData.role === 'admin';
            if (roleRequiresApproval) {
              setSuccessMode(true);
              setLoading(false);
              return;
            }
            if (!result.session) {
              try {
                const loginResult = await login({ email: formData.email, password: formData.password });
                if (loginResult.success) {
                  setRedirecting(true);
                  await finalizeRegistration(formData.role);
                  return;
                }
              } catch (e) { }
            }
            if (result.session) {
              setRedirecting(true);
              await finalizeRegistration(formData.role);
            } else {
              setSuccessMode(true);
            }
          } else {
            const errLower = (result.error || '').toLowerCase();
            if (errLower.includes("user already registered") || errLower.includes("unique constraint")) {
              try {
                const loginResult = await login({ email: formData.email, password: formData.password });
                if (loginResult.success) {
                  setRedirecting(true);
                  await finalizeRegistration(formData.role);
                  return;
                } else {
                  setError("This email is registered but the password didn't match. Please Log In.");
                }
              } catch (loginErr) {
                setError("Account exists. Please Log In.");
              }
            } else {
              setError(result.error || "An error occurred during signup.");
            }
            setLoading(false);
          }
        } catch (err) {
          clearTimeout(slowTimer);
          setError("An unexpected error occurred. Please try again.");
          setLoading(false);
        }
      } else {
        setOtpError(response.data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setOtpError(err?.response?.data?.error || err?.message || 'Verification failed.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTPInline = async (e) => {
    if (e) e.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Please enter a 6-digit verification code.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const fullPhone = `${countryCode}${formData.mobile.replace(/[^\d]/g, '')}`;
      const response = await axios.post('/api/demo/verify-otp', { phone: fullPhone, otp });
      if (response.data.success) {
        setOtpVerified(true);
        setOtpError('');
      } else {
        setOtpError(response.data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setOtpError(err?.response?.data?.error || err?.message || 'Verification failed.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError("You must agree to the Terms & Conditions and Privacy Policy.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (!parentEmailOtpVerified) {
      setError("Please verify the parent email address.");
      return;
    }

    if (!studentEmailOtpVerified) {
      setError("Please verify the student email address.");
      return;
    }

    if (formData.email.trim().toLowerCase() === formData.parentEmail.trim().toLowerCase()) {
      setError("Student Email and Parent Email cannot be the same.");
      return;
    }

    // Proceed to sign up
    setLoading(true);
    setSlowConnection(false);
    setError('');

    try {
      const studentEmailCheck = await authService.checkEmail(formData.email);
      if (studentEmailCheck?.exists) {
        setError("This email address is already registered. Please use a different email.");
        setLoading(false);
        return;
      }

      const parentEmailCheck = await authService.checkEmail(formData.parentEmail);
      if (parentEmailCheck?.exists) {
        setError("This email address is already registered. Please use a different email.");
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Could not verify email uniqueness before signup:", err);
    }

    const slowTimer = setTimeout(() => setSlowConnection(true), 2000);

    try {
      const fullPhone = `${countryCode}${formData.mobile.replace(/[^\d]/g, '')}`;
      const signupPayload = {
        ...formData,
        mobile: fullPhone
      };
      console.log('🔄 Starting signup for:', signupPayload.email);
      const result = await signup(signupPayload);
      clearTimeout(slowTimer);

      if (result.success) {
        console.log('✅ Signup successful:', result);
        const roleRequiresApproval = formData.role === 'tutor' || formData.role === 'admin';
        if (roleRequiresApproval) {
          setSuccessMode(true);
          setLoading(false);
          return;
        }
        if (!result.session) {
          try {
            const loginResult = await login({ email: formData.email, password: formData.password });
            if (loginResult.success) {
              setRedirecting(true);
              await finalizeRegistration(formData.role);
              return;
            }
          } catch (e) { }
        }
        if (result.session) {
          setRedirecting(true);
          await finalizeRegistration(formData.role);
        } else {
          setSuccessMode(true);
        }
      } else {
        const errLower = (result.error || '').toLowerCase();
        if (errLower.includes("user already registered") || errLower.includes("unique constraint")) {
          try {
            const loginResult = await login({ email: formData.email, password: formData.password });
            if (loginResult.success) {
              setRedirecting(true);
              await finalizeRegistration(formData.role);
              return;
            } else {
              setError("This email is registered but the password didn't match. Please Log In.");
            }
          } catch (loginErr) {
            setError("Account exists. Please Log In.");
          }
        } else {
          setError(result.error || "An error occurred during signup.");
        }
        setLoading(false);
      }
    } catch (err) {
      clearTimeout(slowTimer);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };


  const handleResend = async () => {
    setResending(true);
    setResendStatus('');
    try {
      const { error } = await authService.resendVerification(formData.email);
      if (error) {
        if (error.message.includes("Rate limit")) {
          setResendStatus('Too many requests. Please wait a bit.');
        } else {
          setResendStatus('Failed to send. Please check your connection.');
        }
      } else {
        setResendStatus('Email sent! Check your inbox and spam folder.');
      }
    } catch (err) {
      setResendStatus('Failed to send. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  const checkVerification = async () => {
    setCheckingVerification(true);
    setResendStatus('');
    const result = await login({ email: formData.email, password: formData.password });
    if (result.success) {
      setRedirecting(true);
      await finalizeRegistration(formData.role);
    } else {
      const errMsg = (result.error || '').toLowerCase();
      if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid grant')) {
        setResendStatus('This account already exists but the password you entered is incorrect. Please try a different password or reset it.');
      } else {
        setResendStatus('Email not verified yet or account does not exist. Please check your inbox.');
      }
      setCheckingVerification(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

  if (successMode) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 bg-[#FAFAFA] dark:bg-gray-900 transition-colors duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-center relative"
        >
          <div className="absolute -top-12 left-0">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#E53935] transition-colors"
            >
              <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
          <div className={`w-16 h-16 ${formData.role === 'student' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <SafeIcon icon={formData.role === 'student' ? FiMail : FiLoader} className={`w-8 h-8 ${formData.role === 'student' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} />
          </div>
          <h2 className="text-2xl font-bold text-black dark:text-white mb-2">
            {formData.role === 'student' ? 'Check your email' : 'Waiting for Approval'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {formData.role === 'student'
              ? <>We've sent a confirmation link to <strong className="text-black dark:text-white">{formData.email}</strong>.</>
              : <>Your account request for <strong>{formData.role === 'admin' ? 'Administrator' : 'Tutor'}</strong> access has been submitted. An administrator will review and approve your account shortly.</>
            }
          </p>
          <div className="space-y-3">
            <button
              onClick={checkVerification}
              disabled={checkingVerification}
              className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-bold rounded-lg text-white bg-green-600 hover:bg-green-700 transition-all"
            >
              {checkingVerification ? <SafeIcon icon={FiLoader} className="animate-spin mr-2" /> : <SafeIcon icon={FiCheckCircle} className="mr-2" />}
              I've Verified My Email
            </button>

            <Link to="/login" className="inline-flex items-center justify-center w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-sm font-bold rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all">
              Back to Sign In <SafeIcon icon={FiArrowRight} className="ml-2 w-4 h-4" />
            </Link>

            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium underline flex items-center justify-center gap-2"
            >
              {resending ? <SafeIcon icon={FiLoader} className="animate-spin w-3 h-3" /> : <SafeIcon icon={FiRefreshCw} className="w-3 h-3" />}
              {resending ? 'Sending...' : 'Resend Confirmation Email'}
            </button>
            {resendStatus && (
              <p className={`text-xs font-bold ${resendStatus.includes('Failed') || resendStatus.includes('not verified') || resendStatus.includes('Too many') ? 'text-red-500' : 'text-green-600'}`}>
                {resendStatus}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#FAFAFA] dark:bg-gray-900 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 relative"
      >
        <div className="absolute -top-12 left-0">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#E53935] transition-colors"
          >
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mx-auto h-16 w-auto max-w-[240px] flex items-center justify-center overflow-hidden"
          >
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-full w-auto object-contain rounded-[6px]" />
            ) : (
              <div className="h-16 w-16 bg-[#E53935] rounded-2xl flex items-center justify-center shadow-lg">
                <SafeIcon icon={FiBook} className="h-8 w-8 text-white" />
              </div>
            )}
          </motion.div>
          <h2 className="mt-6 text-3xl font-extrabold text-black dark:text-white">Create an Account</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Join <strong className="text-[#E53935]">{settings.appName}</strong> today
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700"
          onMouseEnter={handleInteraction}
        >
          {enrollmentKey && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <SafeIcon icon={FiLink} className="text-white w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none mb-1">Invitation Detected</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                  You will be auto-enrolled with key: <span className="text-blue-600 font-black">{enrollmentKey}</span>
                </p>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex flex-col gap-2 animate-pulse">
                <span className="font-bold flex items-center gap-2">
                  <SafeIcon icon={FiAlertCircle} className="w-4 h-4" /> {error}
                </span>
                <Link to="/login" className="underline text-xs hover:text-red-900 dark:hover:text-red-400 block mt-1">
                  Click here to Log In instead
                </Link>
              </div>
            )}

            {/* FULL NAME */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiUser} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Student Full Name"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={handleInteraction}
                />
              </div>
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiMail} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  disabled={studentEmailOtpVerified || studentEmailOtpSent}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                  placeholder="student@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={handleInteraction}
                />
              </div>

              {/* STUDENT EMAIL OTP FLOW */}
              {!studentEmailOtpVerified && (
                <div className="mt-2 space-y-2">
                  {!studentEmailOtpSent ? (
                    <button
                      type="button"
                      disabled={studentEmailOtpLoading || !formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)}
                      onClick={handleSendStudentEmailOTP}
                      className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                    >
                      {studentEmailOtpLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  ) : (
                    <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                        Verification code sent to {formData.email}
                      </p>
                      {studentEmailOtpError && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-extrabold uppercase tracking-wide">{studentEmailOtpError}</p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Enter 6-Digit OTP"
                          value={studentEmailOtp}
                          onChange={(e) => setStudentEmailOtp(e.target.value.replace(/[^\d]/g, ''))}
                          className="flex-1 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-bold tracking-widest outline-none focus:ring-1 focus:ring-[#E53935]"
                        />
                        <button
                          type="button"
                          disabled={studentEmailOtpLoading || studentEmailOtp.length !== 6}
                          onClick={handleVerifyStudentEmailOTP}
                          className="px-4 py-2 bg-[#E53935] hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                        >
                          {studentEmailOtpLoading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendStudentEmailOTP}
                        className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold underline"
                      >
                        Resend Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              {studentEmailOtpVerified && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-lg border border-green-200/50 flex items-center gap-1.5">
                  <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-green-600 dark:text-green-400" />
                  Student email verified successfully!
                </div>
              )}
            </div>

            {/* PARENT NAME */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Parent Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiUser} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="fatherName"
                  name="fatherName"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Parent Name"
                  value={formData.fatherName}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* PARENT EMAIL */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Parent Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiMail} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="parentEmail"
                  name="parentEmail"
                  type="email"
                  required
                  disabled={parentEmailOtpVerified || parentEmailOtpSent}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                  placeholder="parent@example.com"
                  value={formData.parentEmail}
                  onChange={handleChange}
                />
              </div>

              {/* PARENT EMAIL OTP FLOW */}
              {!parentEmailOtpVerified && (
                <div className="mt-2 space-y-2">
                  {!parentEmailOtpSent ? (
                    <button
                      type="button"
                      disabled={parentEmailOtpLoading || !formData.parentEmail || !/^\S+@\S+\.\S+$/.test(formData.parentEmail)}
                      onClick={handleSendParentEmailOTP}
                      className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                    >
                      {parentEmailOtpLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  ) : (
                    <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                        Verification code sent to {formData.parentEmail}
                      </p>
                      {parentEmailOtpError && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-extrabold uppercase tracking-wide">{parentEmailOtpError}</p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Enter 6-Digit OTP"
                          value={parentEmailOtp}
                          onChange={(e) => setParentEmailOtp(e.target.value.replace(/[^\d]/g, ''))}
                          className="flex-1 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-bold tracking-widest outline-none focus:ring-1 focus:ring-[#E53935]"
                        />
                        <button
                          type="button"
                          disabled={parentEmailOtpLoading || parentEmailOtp.length !== 6}
                          onClick={handleVerifyParentEmailOTP}
                          className="px-4 py-2 bg-[#E53935] hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                        >
                          {parentEmailOtpLoading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendParentEmailOTP}
                        className="text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold underline"
                      >
                        Resend Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              {parentEmailOtpVerified && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-lg border border-green-200/50 flex items-center gap-1.5">
                  <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-green-600 dark:text-green-400" />
                  Parent email verified successfully!
                </div>
              )}
            </div>


            {/* STUDENT MOBILE WITH COUNTRY CODE SELECTOR */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Student Mobile Number</label>
              <div className="flex gap-2">
                <div className="w-28 shrink-0">
                  <div className="relative">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all font-bold cursor-pointer"
                    >
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+91">🇮🇳 +91</option>
                    </select>
                  </div>
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SafeIcon icon={FiPhone} className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Mobile Number"
                    value={formData.mobile}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* PARENT MOBILE NUMBER (No OTP required for parent) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Parent Mobile Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiPhone} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="fatherMobile"
                  name="fatherMobile"
                  type="tel"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="+1234567890"
                  value={formData.fatherMobile}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* ACCOUNT TYPE */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Account Type</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="block w-full pl-3 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              >
                <option value="student">Student</option>
                <option value="tutor">Tutor (Requires Approval)</option>
                <option value="admin">Admin (Requires Approval)</option>
              </select>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiLock} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={handleInteraction}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <SafeIcon icon={showPassword ? FiEyeOff : FiEye} className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                </button>
              </div>
            </div>


            {/* Mandatory Checkbox */}
            <div className="flex items-start gap-2 py-1">
              <input
                id="termsAccepted"
                name="termsAccepted"
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 text-[#E53935] border-gray-300 rounded focus:ring-[#E53935] cursor-pointer shrink-0"
              />
              <label htmlFor="termsAccepted" className="text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer select-none leading-normal">
                I agree to the <button type="button" onClick={() => setShowTermsModal(true)} className="text-[#E53935] underline hover:text-[#b71c1c] font-black inline">Privacy Policy &amp; Terms &amp; Conditions</button>
              </label>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || redirecting || !termsAccepted || !otpVerified || !parentEmailOtpVerified || formData.name.trim() === '' || formData.email.trim() === '' || formData.fatherName.trim() === '' || formData.password.length < 6}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-bold text-white transition-all shadow-red-200 dark:shadow-none ${redirecting ? 'bg-green-600' : 'bg-[#E53935] hover:bg-[#d32f2f]'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {redirecting ? (
                <div className="flex items-center gap-2">
                  <SafeIcon icon={FiCheckCircle} className="w-4 h-4" />
                  {formData.role === 'admin' ? 'Admin Access Granted...' : 'Account Created! Redirecting...'}
                </div>
              ) : loading ? (
                <div className="flex items-center gap-2">
                  <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />
                  {slowConnection ? 'Finalizing Setup...' : 'Creating Account...'}
                </div>
              ) : 'Sign Up'}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-[#E53935] hover:text-[#b71c1c]">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>



      {/* Terms & Conditions Modal Overlay */}
      {renderTermsModal()}
    </div>
  );
};

export default Signup;