import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import supabase from '../../supabase/supabase';
import { authService } from '../../services/api';

const { FiUser, FiLock, FiEye, FiEyeOff, FiBook, FiAlertCircle, FiRefreshCw, FiLoader, FiCheckCircle, FiArrowLeft } = FiIcons;

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const { login, user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  // Pre-warm DB on mount
  useEffect(() => {
    authService.wakeUp();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading && !redirecting) {
      const target = user.role === 'admin' ? '/admin' : '/student';
      navigate(target);
    }
  }, [user, navigate, loading, redirecting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResendMessage('');

    try {
      const result = await login(formData);

      if (!result.success) {
        let errorMessage = result.error || "";
        if (errorMessage.toLowerCase().includes("email not confirmed")) {
          setError("Your email address has not been verified yet.");
        } else if (errorMessage.toLowerCase().includes("invalid login credentials")) {
          setError("Invalid email or password. Please try again.");
        } else {
          setError(errorMessage || "Login failed. Please check your connection.");
        }
        setLoading(false);
      } else {
        // Success: Immediate feedback and FAST redirection
        setRedirecting(true);
        const target = result.user.role === 'admin' ? '/admin' : '/student';
        // Minimal delay just for animation smoothness
        setTimeout(() => navigate(target), 100);
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!formData.email) {
      setError("Please enter your email address first.");
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
      });
      if (error) throw error;
      setResendMessage("Confirmation email resent! Please check your inbox and spam folder.");
      setError('');
    } catch (err) {
      setError(err.message || "Failed to resend confirmation email.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
            transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
            className="mx-auto h-16 w-16 bg-[#E53935] rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-none overflow-hidden"
          >
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <SafeIcon icon={FiBook} className="h-8 w-8 text-white" />
            )}
          </motion.div>
          <h2 className="mt-6 text-3xl font-extrabold text-black dark:text-white">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to continue to <strong className="text-[#E53935]">{settings.appName}</strong>
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700"
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                <div className="flex items-start space-x-2">
                  <SafeIcon icon={FiAlertCircle} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span className="break-words">{error}</span>
                </div>
                {error.includes("not been verified") && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendLoading}
                    className="mt-2 text-[#E53935] underline hover:text-red-900 dark:hover:text-red-400 font-bold flex items-center"
                  >
                    {resendLoading ? "Sending..." : "Resend Confirmation Email"}
                  </button>
                )}
              </div>
            )}

            {resendMessage && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
                <SafeIcon icon={FiRefreshCw} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>{resendMessage}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiUser} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SafeIcon icon={FiLock} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
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
                  Success! Redirecting...
                </div>
              ) : loading ? (
                <div className="flex items-center gap-2">
                  <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />
                  Signing in...
                </div>
              ) : 'Sign in'}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/signup" className="font-bold text-[#E53935] hover:text-[#b71c1c]">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;