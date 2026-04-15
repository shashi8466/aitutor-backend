import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const { FiUser, FiLock, FiMail, FiEye, FiEyeOff, FiAlertCircle, FiLoader, FiCheckCircle, FiArrowLeft, FiLogOut, FiBarChart2, FiShield, FiUsers } = FiIcons;

const UnifiedLogin = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [redirecting, setRedirecting] = useState(false);
    const [detectedRole, setDetectedRole] = useState(null);

    const { login, logout, user } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const redirectPath = searchParams.get('redirect');

    // After login, this handles the specific redirection
    const handleRoleRedirection = (role) => {
        setDetectedRole(role);
        setRedirecting(true);

        const paths = {
            'admin': '/admin',
            'tutor': '/tutor',
            'parent': '/parent',
            'student': '/student'
        };

        // Use redirectPath if available, otherwise use default role path.
        // `redirectPath` typically comes URL-encoded (from ProtectedRoute/email flows).
        let targetPath = redirectPath || paths[role] || '/student';
        if (redirectPath) {
            try {
                targetPath = decodeURIComponent(redirectPath);
            } catch {
                // keep as-is
            }
        }

        // Short delay for the "Success" animation
        setTimeout(() => navigate(targetPath), 1200);
    };

    useEffect(() => {
        // If user is already logged in, redirect them
        if (user && !loading && !redirecting) {
            const userStatus = (user.status || 'active').toLowerCase();
            
            // CRITICAL: Only auto-redirect active users. 
            // This prevents loops where a pending user lands on /admin, gets redirected here,
            // and then this effect tries to send them back to /admin.
            if (userStatus === 'active') {
                handleRoleRedirection(user.role);
            } else if (userStatus === 'pending') {
                setError("Your account is pending administrator approval. You will receive an email once approved.");
                logout(); // Clear the session to break the loop
            } else if (userStatus === 'suspended' || userStatus === 'inactive') {
                setError("Your account has been suspended or deactivated.");
                logout();
            }
        }
    }, [user, loading, redirecting, logout]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

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
                // Check account status
                const userStatus = (result.user.status || 'active').toLowerCase();
                
                if (userStatus === 'pending') {
                    setError("Your account is pending administrator approval. You will be notified once approved.");
                    await logout();
                    setLoading(false);
                    return;
                }
                
                if (userStatus === 'suspended' || userStatus === 'inactive') {
                    setError("Your account has been suspended or deactivated. Please contact support.");
                    await logout();
                    setLoading(false);
                    return;
                }

                handleRoleRedirection(result.user.role);
            }
        } catch (err) {
            console.error(err);
            setError("An unexpected error occurred. Please try again.");
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const getRoleConfig = (role) => {
        const configs = {
            'admin': { label: 'Administrator', icon: FiShield, color: 'text-red-500', bg: 'bg-red-500' },
            'tutor': { label: 'Tutor', icon: FiUsers, color: 'text-blue-500', bg: 'bg-blue-500' },
            'parent': { label: 'Parent', icon: FiUsers, color: 'text-amber-500', bg: 'bg-amber-500' },
            'student': { label: 'Student', icon: FiUser, color: 'text-green-500', bg: 'bg-green-500' }
        };
        return configs[role] || configs['student'];
    };

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 transition-colors duration-200">
            {/* Background decorative elements */}
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
                        Welcome Back
                    </h2>
                    <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">
                        Sign in to access your dashboard
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-gray-700/30"
                >
                    <AnimatePresence mode="wait">
                        {redirecting ? (
                            <motion.div
                                key="redirecting"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                className="py-12 text-center"
                            >
                                <div className="relative inline-block mb-6">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className={`w-20 h-20 rounded-full ${getRoleConfig(detectedRole).bg} flex items-center justify-center text-white shadow-2xl`}
                                    >
                                        <SafeIcon icon={FiCheckCircle} className="w-10 h-10" />
                                    </motion.div>
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className={`absolute inset-0 rounded-full ${getRoleConfig(detectedRole).bg} -z-10`}
                                    />
                                </div>

                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Logged in as {getRoleConfig(detectedRole).label}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 animate-pulse">
                                    Redirecting to your dashboard...
                                </p>
                            </motion.div>
                        ) : (
                            <motion.form
                                key="form"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-6"
                                onSubmit={handleSubmit}
                            >
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm flex items-start gap-3"
                                    >
                                        <SafeIcon icon={FiAlertCircle} className="w-5 h-5 flex-shrink-0" />
                                        <span className="font-medium">{error}</span>
                                    </motion.div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                                        Email Address
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                            <SafeIcon icon={FiMail} className="h-5 w-5" />
                                        </div>
                                        <input
                                            name="email"
                                            type="email"
                                            required
                                            className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 transition-all text-gray-900 dark:text-white"
                                            placeholder="janedoe@example.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                            Password
                                        </label>
                                        <Link to="/forgot-password" size="sm" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                            Forgot?
                                        </Link>
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                            <SafeIcon icon={FiLock} className="h-5 w-5" />
                                        </div>
                                        <input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            className="block w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 transition-all text-gray-900 dark:text-white"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={handleChange}
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

                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-md font-black text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                                            Authenticating...
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span>Sign In</span>
                                            <SafeIcon icon={FiArrowLeft} className="w-5 h-5 rotate-180" />
                                        </div>
                                    )}
                                </motion.button>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {!redirecting && (
                        <div className="mt-8 text-center pt-6 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                Don't have an account?{' '}
                                <Link to="/signup" className="font-black text-indigo-600 hover:text-indigo-700">
                                    Get Started
                                </Link>
                            </p>
                        </div>
                    )}
                </motion.div>

                <div className="text-center">
                    <Link to="/" className="text-sm font-medium text-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                        <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
                        Back to Landing Page
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default UnifiedLogin;
