import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { authService, enrollmentService } from '../../services/api';

const { FiUser, FiLock, FiMail, FiBook, FiEye, FiEyeOff, FiArrowRight, FiAlertCircle, FiLoader, FiRefreshCw, FiCheckCircle, FiPhone, FiUsers, FiArrowLeft, FiLink } = FiIcons;

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    mobile: '',
    fatherName: '',
    fatherMobile: ''
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

  const { signup, login } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [enrollmentKey, setEnrollmentKey] = useState(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    authService.wakeUp();
    // Check for enrollment key in URL
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
    if (enrollmentKey) {
      setEnrolling(true);
      try {
        await enrollmentService.useKey(enrollmentKey);
      } catch (err) {
        console.error('Auto-enrollment failed during signup:', err);
      }
    }

    // Redirect based on role
    if (role === 'admin') {
      navigate('/admin');
    } else if (role === 'tutor') {
      navigate('/tutor');
    } else {
      navigate('/student');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSlowConnection(false);
    setError('');

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    const slowTimer = setTimeout(() => setSlowConnection(true), 2000);

    try {
      const result = await signup(formData);
      clearTimeout(slowTimer);

      if (result.success) {
        if (result.session) {
          // User is logged in immediately
          setRedirecting(true);
          await finalizeRegistration(formData.role);
        } else {
          // User needs to check email
          setSuccessMode(true);
        }
      } else {
        const errLower = (result.error || '').toLowerCase();
        if (errLower.includes("user already registered") || errLower.includes("unique constraint")) {
          console.log("User exists, attempting auto-login...");
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
      console.error(err);
      setError("An unexpected error occurred.");
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
    // Attempt to login to check if email is verified
    const result = await login({ email: formData.email, password: formData.password });
    if (result.success) {
      setRedirecting(true);
      await finalizeRegistration(formData.role);
    } else {
      setResendStatus('Email not verified yet. Please check your inbox.');
      setCheckingVerification(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiMail} className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-black dark:text-white mb-2">Check your email</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We've sent a confirmation link to <strong className="text-black dark:text-white">{formData.email}</strong>.
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
            className="mx-auto h-16 w-16 bg-[#E53935] rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-none overflow-hidden"
          >
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <SafeIcon icon={FiBook} className="h-8 w-8 text-white" />
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

          <form className="space-y-6" onSubmit={handleSubmit}>
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
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="student@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={handleInteraction}
                />
              </div>
            </div>

            {/* MOBILE (New) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiPhone} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Mobile Number"
                  value={formData.mobile}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* FATHER'S NAME (New) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Father's Name (Optional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiUsers} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="fatherName"
                  name="fatherName"
                  type="text"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Father/Guardian Name"
                  value={formData.fatherName}
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
                <option value="admin">Admin (Demo Purpose)</option>
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

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || redirecting}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-bold text-white transition-all shadow-red-200 dark:shadow-none ${redirecting ? 'bg-green-600' : 'bg-[#E53935] hover:bg-[#d32f2f]'}`}
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
    </div>
  );
};

export default Signup;