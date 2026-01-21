import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { tutorService } from '../../services/api';

import {
    FiHome, FiBook, FiUsers, FiKey, FiMail, FiBarChart2,
    FiSettings, FiLogOut, FiMenu, FiX, FiAward, FiClock,
    FiTrendingUp, FiCheckCircle, FiLayers
} from 'react-icons/fi';

// Import tutor components
import GroupManager from './GroupManager';
import TutorGrades from './TutorGrades';
import TutorCourses from './TutorCourses';
import TutorStudents from './TutorStudents';
import TutorEnrollmentKeys from './TutorEnrollmentKeys';
import TutorInvitations from './TutorInvitations';

const TutorOverview = ({ dashboardData }) => (
    <div className="p-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h2>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md uppercase tracking-tight">Sync v1.0.5</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">My Courses</p>
                <p className="text-3xl font-black text-blue-600">{dashboardData?.courses?.length || 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Active Students</p>
                <p className="text-3xl font-black text-indigo-600">
                    {typeof dashboardData?.total_students === 'object' ? (dashboardData?.total_students?.count || 0) : (dashboardData?.total_students || 0)}
                </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Enrollments</p>
                <p className="text-3xl font-black text-purple-600">
                    {typeof dashboardData?.total_enrollments === 'object' ? (dashboardData?.total_enrollments?.count || 0) : (dashboardData?.total_enrollments || 0)}
                </p>
            </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
            <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-2">Welcome back!</h3>
            <p className="text-blue-700 dark:text-blue-300">You can manage your assigned courses, students, and enrollment keys from the sidebar.</p>
        </div>
    </div>
);

const TutorSettingsPage = () => (
    <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Settings</h2>
        <p className="text-gray-600 dark:text-gray-400">Manage your tutor profile and notification preferences here.</p>
    </div>
);

const TutorDashboard = () => {
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);

    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        console.log('🏗️ [TutorDashboard] Mounted/Route Changed');
        fetchDashboardData();

        // Safety Catch: Always reset scroll lock when changing tabs
        document.body.style.overflow = 'unset';

        const handleFocus = () => {
            console.log('👀 [TutorDashboard] Window Focused');
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            console.log('🧹 [TutorDashboard] Component Effect Cleanup');
            window.removeEventListener('focus', handleFocus);
            document.body.style.overflow = 'unset';
        };
    }, [location.pathname]); // Trigger on every navigation

    const fetchDashboardData = async () => {
        try {
            console.log('📡 [TutorDashboard] Fetching data...');
            const response = await tutorService.getDashboard();
            setDashboardData(response.data);
            console.log('✅ [TutorDashboard] Data loaded');
        } catch (error) {
            console.error('❌ [TutorDashboard] Error:', error);
            // Don't show generic "Failed to load" error to user unless critical
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login/tutor');
    };

    const menuItems = [
        { path: '/tutor', icon: FiHome, label: 'Dashboard', exact: true },
        { path: '/tutor/courses', icon: FiBook, label: 'My Courses' },
        { path: '/tutor/students', icon: FiUsers, label: 'Students' },
        { path: '/tutor/groups', icon: FiLayers, label: 'Student Groups' },
        { path: '/tutor/enrollment-keys', icon: FiKey, label: 'Enrollment Keys' },
        { path: '/tutor/invitations', icon: FiMail, label: 'Invitations' },
        { path: '/tutor/grades', icon: FiBarChart2, label: 'Grade Reports' },
        { path: '/tutor/settings', icon: FiSettings, label: 'Settings' },
    ];

    const isActivePath = (path, exact = false) => {
        if (exact) {
            return location.pathname === path;
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.aside
                        initial={{ x: -300 }}
                        animate={{ x: 0 }}
                        exit={{ x: -300 }}
                        transition={{ type: "spring", stiffness: 100 }}
                        className="fixed lg:sticky top-0 left-0 h-screen w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-[9999] overflow-y-auto"
                    >
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                        <SafeIcon icon={FiUsers} className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tutor Panel</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Manage & Track</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    <SafeIcon icon={FiX} className="w-5 h-5" />
                                </button>
                            </div>

                            {/* User Profile */}
                            <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                        {user?.name?.charAt(0) || 'T'}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                                            {user?.name || 'Tutor'}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                            {user?.email}
                                        </p>
                                    </div>
                                </div>
                                {dashboardData && (
                                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                {dashboardData.stats?.totalCourses || 0}
                                            </p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Courses</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                {typeof dashboardData.stats?.totalStudents === 'object' ? (dashboardData.stats.totalStudents.count || 0) : (dashboardData.stats?.totalStudents || 0)}
                                            </p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Students</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Navigation Menu */}
                            <nav className="space-y-1">
                                {menuItems.map((item) => (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActivePath(item.path, item.exact)
                                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <SafeIcon icon={item.icon} className="w-5 h-5" />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                ))}
                            </nav>

                            {/* Logout Button */}
                            <button
                                onClick={handleLogout}
                                className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-200 dark:border-red-800"
                            >
                                <SafeIcon icon={FiLogOut} className="w-5 h-5" />
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Top Bar */}
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 z-30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <SafeIcon icon={sidebarOpen ? FiX : FiMenu} className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {menuItems.find(item => isActivePath(item.path, item.exact))?.label || 'Dashboard'}
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Welcome back, {user?.name}
                                </p>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        {dashboardData && location.pathname === '/tutor' && (
                            <div className="hidden md:flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                        <SafeIcon icon={FiCheckCircle} className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                                            {dashboardData.stats?.totalStudents || 0} Students
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                        <SafeIcon icon={FiTrendingUp} className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Recent</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                                            {typeof dashboardData.stats?.recentTests === 'object' ? (dashboardData.stats.recentTests.count || 0) : (dashboardData.stats?.recentTests || 0)} Tests
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-6 overflow-auto">
                    <Routes>
                        <Route index element={<TutorOverview dashboardData={dashboardData} />} />
                        <Route path="courses" element={<TutorCourses />} />
                        <Route path="students" element={<TutorStudents />} />
                        <Route path="groups" element={<GroupManager />} />
                        <Route path="enrollment-keys" element={<TutorEnrollmentKeys />} />
                        <Route path="invitations" element={<TutorInvitations />} />
                        <Route path="grades" element={<TutorGrades />} />
                        <Route path="settings" element={<TutorSettingsPage />} />
                    </Routes>
                </main>
            </div>

            {/* Mobile Overlay - Only visible below 1024px when sidebar is open */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm lg:hidden z-[9990] pointer-events-auto"
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default TutorDashboard;
