import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import supabase from '../../supabase/supabase';

const { FiShield, FiLock, FiMail, FiEye, FiEyeOff, FiAlertCircle, FiLoader, FiCheckCircle, FiArrowLeft } = FiIcons;

const AdminLogin = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [redirecting, setRedirecting] = useState(false);

    const { login, user } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();

    useEffect(() => {
        if (user && !loading && !redirecting) {
            if (user.role === 'admin') {
                navigate('/admin');
            } else {
                navigate(user.role === 'tutor' ? '/tutor' : '/student');
            }
        }
    }, [user, navigate, loading, redirecting]);

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
                // Verify user is an admin
                const userRole = result.user?.role;

                if (userRole !== 'admin') {
                    // Provide helpful redirect message
                    if (userRole === 'student') {
                        setError('You are logged in as a Student. Please use the Student login page at /login/student');
                    } else if (userRole === 'tutor') {
                        setError('You are logged in as a Tutor. Please use the Tutor login page at /login/tutor');
                    } else {
                        setError(`Access denied. Your role is "${userRole || 'unknown'}". This page is for administrators only.`);
                    }
                    await supabase.auth.signOut();
                    setLoading(false);
                    return;
                }

                setRedirecting(true);
                setTimeout(() => navigate('/admin'), 100);
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

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-red-50 via-rose-50 to-red-100 dark:from-gray-900 dark:via-red-900/20 dark:to-gray-900 transition-colors duration-200">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full space-y-8 relative"
            >
                <div className="absolute -top-12 left-0">
                    <Link
                        to="/login"
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#E53935] transition-colors"
                    >
                        <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
                        Back to Role Selection
                    </Link>
                </div>

                <div className="text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
                        className="mx-auto h-16 w-16 bg-gradient-to-br from-[#E53935] to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-none overflow-hidden"
                    >
                        {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <SafeIcon icon={FiShield} className="h-8 w-8 text-white" />
                        )}
                    </motion.div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                        Administrator Login
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Full system access and management
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
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <SafeIcon icon={FiMail} className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="Enter your admin email"
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
                            ) : 'Sign in as Admin'}
                        </motion.button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Not an administrator?{' '}
                            <Link to="/login" className="font-bold text-[#E53935] hover:text-[#b71c1c]">
                                Choose different role
                            </Link>
                        </p>
                    </div>
                </motion.div>

                {/* Security Banner */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
                    <strong>Security Notice:</strong> Administrator access is logged and monitored. Only authorized personnel should access this area.
                </div>
            </motion.div>
        </div>
    );
};

export default AdminLogin;
