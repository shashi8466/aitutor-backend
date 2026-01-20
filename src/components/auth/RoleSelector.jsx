import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useSettings } from '../../contexts/SettingsContext';

const { FiUser, FiUsers, FiBook, FiShield, FiArrowRight } = FiIcons;

const RoleSelector = () => {
    const { settings } = useSettings();

    const roles = [
        {
            id: 'student',
            title: 'Student',
            description: 'Access courses, take tests, and track your progress',
            icon: FiUser,
            color: 'from-green-500 to-emerald-600',
            borderColor: 'border-green-500',
            hoverColor: 'hover:border-green-600',
            path: '/login/student'
        },
        {
            id: 'tutor',
            title: 'Tutor',
            description: 'Manage students, create enrollment keys, and track performance',
            icon: FiUsers,
            color: 'from-blue-500 to-indigo-600',
            borderColor: 'border-blue-500',
            hoverColor: 'hover:border-blue-600',
            path: '/login/tutor'
        },
        {
            id: 'admin',
            title: 'Administrator',
            description: 'Full system access, manage courses, users, and settings',
            icon: FiShield,
            color: 'from-red-500 to-rose-600',
            borderColor: 'border-red-500',
            hoverColor: 'hover:border-red-600',
            path: '/login/admin'
        }
    ];

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <div className="max-w-6xl w-full space-y-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
                        className="mx-auto h-20 w-20 bg-gradient-to-br from-[#E53935] to-red-600 rounded-3xl flex items-center justify-center shadow-2xl overflow-hidden mb-6"
                    >
                        {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <SafeIcon icon={FiBook} className="h-10 w-10 text-white" />
                        )}
                    </motion.div>

                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-3">
                        Welcome to {settings.appName}
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                        Choose your role to continue to the platform
                    </p>
                </motion.div>

                {/* Role Cards */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
                >
                    {roles.map((role, index) => (
                        <motion.div
                            key={role.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                        >
                            <Link to={role.path}>
                                <motion.div
                                    whileHover={{ scale: 1.05, y: -5 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border-2 ${role.borderColor} ${role.hoverColor} transition-all duration-300 cursor-pointer group overflow-hidden`}
                                >
                                    {/* Background Gradient (on hover) */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

                                    {/* Icon */}
                                    <div className={`relative mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${role.color} shadow-lg`}>
                                        <SafeIcon icon={role.icon} className="w-8 h-8 text-white" />
                                    </div>

                                    {/* Title */}
                                    <h3 className="relative text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                        {role.title}
                                    </h3>

                                    {/* Description */}
                                    <p className="relative text-gray-600 dark:text-gray-300 mb-6 min-h-[48px]">
                                        {role.description}
                                    </p>

                                    {/* Arrow Icon */}
                                    <div className="relative flex items-center text-gray-700 dark:text-gray-200 font-semibold group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                        <span>Continue</span>
                                        <motion.div
                                            className="ml-2"
                                            animate={{ x: [0, 5, 0] }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                        >
                                            <SafeIcon icon={FiArrowRight} className="w-5 h-5" />
                                        </motion.div>
                                    </div>

                                    {/* Decorative Elements */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                </motion.div>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Footer Links */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    className="text-center mt-8 space-y-4"
                >
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Don't have an account?{' '}
                        <Link to="/signup" className="font-bold text-[#E53935] hover:text-[#b71c1c] transition-colors">
                            Sign up here
                        </Link>
                    </div>

                    <div className="text-sm">
                        <Link to="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                            ← Back to Home
                        </Link>
                    </div>
                </motion.div>

                {/* Info Banner */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1, duration: 0.5 }}
                    className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mt-8"
                >
                    <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                New to the platform?
                            </h4>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Students:</strong> Register with an enrollment key or invitation link<br />
                                <strong>Tutors:</strong> Request approval from an administrator after registration<br />
                                <strong>Admins:</strong> Contact system administrator for access
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default RoleSelector;
