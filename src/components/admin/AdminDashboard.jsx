import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import LoadingSpinner from '../common/LoadingSpinner';
import Skeleton from '../common/Skeleton';

// Lazy load admin sections
const CourseManagement = lazy(() => import('./CourseManagement'));
const AdminCourseDetail = lazy(() => import('./AdminCourseDetail'));
const QuestionManagement = lazy(() => import('./QuestionManagement'));
const FileUpload = lazy(() => import('./FileUpload'));
const UploadManagement = lazy(() => import('./UploadManagement'));
const KnowledgeBase = lazy(() => import('./KnowledgeBase'));
const AdminSettings = lazy(() => import('./AdminSettings'));
const UserManagement = lazy(() => import('./UserManagement'));
const AdminGroupManagement = lazy(() => import('./AdminGroupManagement'));
const AdminParentManagement = lazy(() => import('./AdminParentManagement'));
const AdminNotificationManager = lazy(() => import('./AdminNotificationManager'));
const AdminParentNotificationManager = lazy(() => import('./AdminParentNotificationManager'));

import { courseService, uploadService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { FiBook, FiUpload, FiHelpCircle, FiFolder, FiTrendingUp, FiUsers, FiGrid, FiDatabase, FiSettings, FiLogOut, FiLayers } = FiIcons;

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalCourses: 0, totalQuestions: 0, totalUploads: 0, activeUsers: 0 });
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    if (location.pathname === '/admin') {
      loadStats();
    }
  }, [location.pathname]); // Only trigger on dashboard index

  const loadStats = async () => {
    try {
      const [coursesResponse, uploadStats] = await Promise.all([
        courseService.getAll(),
        uploadService.getStats()
      ]);
      const courses = coursesResponse.data || [];
      setStats({
        totalCourses: courses.length,
        totalQuestions: courses.reduce((sum, c) => sum + (c.questions_count || 0), 0),
        totalUploads: uploadStats.uploadsCount || 0,
        activeUsers: uploadStats.usersCount || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Overview', path: '/admin', icon: FiGrid },
    { name: 'Users', path: '/admin/users', icon: FiUsers },
    { name: 'Parents', path: '/admin/parents', icon: FiUsers },
    { name: 'Notifications', path: '/admin/notifications', icon: FiBook },
    { name: 'Parent Notifications', path: '/admin/parent-notifications', icon: FiUsers },
    { name: 'Courses', path: '/admin/courses', icon: FiBook },
    { name: 'Student Groups', path: '/admin/groups', icon: FiLayers },
    { name: 'Questions', path: '/admin/questions', icon: FiHelpCircle },
    { name: 'Knowledge Base', path: '/admin/knowledge-base', icon: FiDatabase },
    { name: 'Upload New', path: '/admin/upload', icon: FiUpload },
    { name: 'Files', path: '/admin/uploads', icon: FiFolder },
    { name: 'Settings', path: '/admin/settings', icon: FiSettings },
  ];

  const navRef = useRef(null);

  const scrollNav = (dir) => {
    if (navRef.current) navRef.current.scrollBy({ left: dir * 180, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Area with Logout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2">Manage courses, questions, content, and settings</p>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors font-medium border border-orange-200 dark:border-orange-800 self-start md:self-auto shadow-sm"
            >
              <SafeIcon icon={FiLogOut} className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>

          {/* Navigation */}
          <div className="mt-6 relative">
            {/* Left scroll button */}
            <button
              onClick={() => scrollNav(-1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-full p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hidden md:flex"
              style={{ marginLeft: '-12px' }}
            >
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

            {/* Scrollable nav */}
            <div
              ref={navRef}
              className="flex bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto scrollbar-hide hide-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {navLinks.map((link) => {
                const isActive = link.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(link.path);

                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <SafeIcon icon={link.icon} className="w-4 h-4 mr-2" />
                    {link.name}
                  </Link>
                );
              })}
            </div>

            {/* Right scroll button */}
            <button
              onClick={() => scrollNav(1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-full p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hidden md:flex"
              style={{ marginRight: '-12px' }}
            >
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </motion.div>

        <Suspense fallback={<LoadingSpinner fullPage={false} />}>
          <Routes>
            <Route path="/" element={<DashboardHome stats={stats} loading={loading} />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/courses" element={<CourseManagement onStatsUpdate={loadStats} />} />
            <Route path="/course/:id" element={<AdminCourseDetail />} />
            <Route path="/groups" element={<AdminGroupManagement />} />
            <Route path="/parents" element={<AdminParentManagement />} />
            <Route path="/notifications" element={<AdminNotificationManager />} />
            <Route path="/parent-notifications" element={<AdminParentNotificationManager />} />
            <Route path="/questions" element={<QuestionManagement />} />
            <Route path="/knowledge-base" element={<KnowledgeBase />} />
            <Route path="/upload" element={<FileUpload />} />
            <Route path="/uploads" element={<UploadManagement />} />
            <Route path="/settings" element={<AdminSettings />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
};

const DashboardHome = ({ stats, loading }) => {
  const statCards = [
    { title: 'Total Courses', value: stats.totalCourses, icon: FiBook, color: 'bg-sky-500' },
    { title: 'Total Questions', value: stats.totalQuestions, icon: FiHelpCircle, color: 'bg-orange-500' },
    { title: 'Total Uploads', value: stats.totalUploads, icon: FiUpload, color: 'bg-sky-500' },
    { title: 'Active Users', value: stats.activeUsers, icon: FiUsers, color: 'bg-orange-500' }
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="dashboard-card p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <div className={`${stat.color} p-3 rounded-lg text-white shadow-lg`}>
                <SafeIcon icon={stat.icon} className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                <SafeIcon icon={FiTrendingUp} className="w-3 h-3 mr-1" /> Active
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</p>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="dashboard-card p-6">
          <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { to: '/admin/courses', icon: FiBook, color: 'bg-sky-500', title: 'Manage Courses', desc: 'Add or edit courses' },
              { to: '/admin/groups', icon: FiLayers, color: 'bg-orange-500', title: 'Student Groups', desc: 'Manage tutor groups' },
              { to: '/admin/upload', icon: FiUpload, color: 'bg-sky-500', title: 'Upload Content', desc: 'Parse documents' },
              { to: '/admin/knowledge-base', icon: FiDatabase, color: 'bg-orange-500', title: 'Knowledge Base', desc: 'Review extracted data' },
              { to: '/admin/users', icon: FiUsers, color: 'bg-orange-500', title: 'Manage Users', desc: 'View all users' },
              { to: '/admin/parents', icon: FiUsers, color: 'bg-amber-500', title: 'Parents', desc: 'Create & link parents' },
              { to: '/admin/notifications', icon: FiBook, color: 'bg-teal-500', title: 'Notifications', desc: 'Manage student notifications' },
              { to: '/admin/settings', icon: FiSettings, color: 'bg-slate-700', title: 'Settings', desc: 'Update app name/logo' },
            ].map(item => (
              <Link key={item.title} to={item.to} className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group shadow-sm">
                <div className={`${item.color} w-10 h-10 rounded flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform shadow-lg`}>
                  <SafeIcon icon={item.icon} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{item.title}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="dashboard-card p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <h2 className="text-xl font-bold mb-2">System Status</h2>
          <p className="text-blue-100 mb-6">All systems operational. Database connected.</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-white/10 p-3 rounded">
              <span>Database</span>
              <span className="flex items-center gap-2 text-green-300 font-bold"><div className="w-2 h-2 rounded-full bg-green-400"></div> Connected</span>
            </div>
            <div className="flex justify-between items-center bg-white/10 p-3 rounded">
              <span>AI Service</span>
              <span className="flex items-center gap-2 text-green-300 font-bold"><div className="w-2 h-2 rounded-full bg-green-400"></div> Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;