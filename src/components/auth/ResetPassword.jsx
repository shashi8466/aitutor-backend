import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { authService } from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';

const { FiLock, FiEye, FiEyeOff, FiAlertCircle, FiCheckCircle, FiLoader, FiArrowLeft } = FiIcons;

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const { settings } = useSettings();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const result = await authService.resetPassword(password);
            if (result.success) {
                setMessage("Your password has been reset successfully. Redirecting to login...");
                setTimeout(() => navigate('/login'), 3000);
            } else {
                setError(result.error || "Failed to reset password. The link may have expired.");
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 transition-colors duration-200">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full space-y-8 relative"
            >
                <div className="text-center">
                    <motion.div
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        className="mx-auto flex items-center justify-center mb-10"
                    >
                        {(settings.logo_url || settings.logoUrl) ? (
                            <div className="h-20 w-auto max-w-[240px] flex items-center justify-center">
                                <img src={settings.logo_url || settings.logoUrl} alt="Logo" className="h-full w-auto object-contain rounded-[6px]" />
                            </div>
                        ) : (
                            <div className="h-20 w-20 rounded-[28px] bg-black border border-white/20 flex items-center justify-center shadow-2xl">
                                <span className="text-white font-black italic text-2xl tracking-tighter">AI</span>
                            </div>
                        )}
                    </motion.div>

                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        New Password
                    </h2>
                    <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">
                        Enter your new secure password below
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-gray-700/30"
                >
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm flex items-start gap-3">
                                <SafeIcon icon={FiAlertCircle} className="w-5 h-5 flex-shrink-0" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        {message && (
                            <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 px-4 py-3 rounded-2xl text-sm flex items-start gap-3">
                                <SafeIcon icon={FiCheckCircle} className="w-5 h-5 flex-shrink-0" />
                                <span className="font-medium">{message}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                                New Password
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                    <SafeIcon icon={FiLock} className="h-5 w-5" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="block w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 transition-all text-gray-900 dark:text-white"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <SafeIcon icon={showPassword ? FiEyeOff : FiEye} className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                                Confirm New Password
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                    <SafeIcon icon={FiLock} className="h-5 w-5" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="block w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 transition-all text-gray-900 dark:text-white"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            disabled={loading || !!message}
                            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-md font-black text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                                    Updating...
                                </div>
                            ) : (
                                "Update Password"
                            )}
                        </motion.button>
                    </form>
                </motion.div>

                <div className="text-center">
                    <Link to="/login" className="text-sm font-medium text-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                        <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
                        Back to Login
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default ResetPassword;
