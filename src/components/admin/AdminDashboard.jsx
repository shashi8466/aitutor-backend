import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import CourseManagement from './CourseManagement';
import AdminCourseDetail from './AdminCourseDetail';
import QuestionManagement from './QuestionManagement';
import FileUpload from './FileUpload';
import UploadManagement from './UploadManagement';
import KnowledgeBase from './KnowledgeBase';
import AdminSettings from './AdminSettings';
import UserManagement from './UserManagement';
import AdminGroupManagement from './AdminGroupManagement';
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
    loadStats();
  }, [location.pathname]);

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
    { name: 'Courses', path: '/admin/courses', icon: FiBook },
    { name: 'Student Groups', path: '/admin/groups', icon: FiLayers },
    { name: 'Questions', path: '/admin/questions', icon: FiHelpCircle },
    { name: 'Knowledge Base', path: '/admin/knowledge-base', icon: FiDatabase },
    { name: 'Upload New', path: '/admin/upload', icon: FiUpload },
    { name: 'Files', path: '/admin/uploads', icon: FiFolder },
    { name: 'Settings', path: '/admin/settings', icon: FiSettings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Area with Logout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Manage courses, questions, content, and settings</p>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium border border-red-200 self-start md:self-auto shadow-sm"
            >
              <SafeIcon icon={FiLogOut} className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex space-x-1 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
            {navLinks.map((link) => {
              const isActive = link.path === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(link.path);

              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  <SafeIcon icon={link.icon} className="w-4 h-4 mr-2" />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </motion.div>

        <Routes>
          <Route path="/" element={<DashboardHome stats={stats} loading={loading} />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/courses" element={<CourseManagement onStatsUpdate={loadStats} />} />
          <Route path="/course/:id" element={<AdminCourseDetail />} />
          <Route path="/groups" element={<AdminGroupManagement />} />
          <Route path="/questions" element={<QuestionManagement />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/upload" element={<FileUpload />} />
          <Route path="/uploads" element={<UploadManagement />} />
          <Route path="/settings" element={<AdminSettings />} />
        </Routes>
      </div>
    </div>
  );
};

const DashboardHome = ({ stats, loading }) => {
  const statCards = [
    { title: 'Total Courses', value: stats.totalCourses, icon: FiBook, color: 'bg-blue-500' },
    { title: 'Total Questions', value: stats.totalQuestions, icon: FiHelpCircle, color: 'bg-green-500' },
    { title: 'Total Uploads', value: stats.totalUploads, icon: FiUpload, color: 'bg-purple-500' },
    { title: 'Active Users', value: stats.activeUsers, icon: FiUsers, color: 'bg-orange-500' }
  ];

  if (loading) return <div className="flex justify-center h-64 items-center dark:text-white">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex justify-between items-center mb-4">
              <div className={`${stat.color} p-3 rounded-lg text-white`}>
                <SafeIcon icon={stat.icon} className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center">
                <SafeIcon icon={FiTrendingUp} className="w-3 h-3 mr-1" /> Active
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{stat.title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold mb-4 dark:text-white">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/admin/courses" className="p-4 border dark:border-gray-600 rounded hover:shadow-md transition-all group">
              <div className="bg-blue-500 w-10 h-10 rounded flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                <SafeIcon icon={FiBook} />
              </div>
              <h3 className="font-bold dark:text-white">Manage Courses</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Add or edit courses</p>
            </Link>
            <Link to="/admin/groups" className="p-4 border dark:border-gray-600 rounded hover:shadow-md transition-all group">
              <div className="bg-indigo-500 w-10 h-10 rounded flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                <SafeIcon icon={FiLayers} />
              </div>
              <h3 className="font-bold dark:text-white">Student Groups</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manage tutor groups</p>
            </Link>
            <Link to="/admin/upload" className="p-4 border dark:border-gray-600 rounded hover:shadow-md transition-all group">
              <div className="bg-green-500 w-10 h-10 rounded flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                <SafeIcon icon={FiUpload} />
              </div>
              <h3 className="font-bold dark:text-white">Upload Content</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Parse documents</p>
            </Link>
            <Link to="/admin/knowledge-base" className="p-4 border dark:border-gray-600 rounded hover:shadow-md transition-all group">
              <div className="bg-purple-500 w-10 h-10 rounded flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                <SafeIcon icon={FiDatabase} />
              </div>
              <h3 className="font-bold dark:text-white">Knowledge Base</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Review extracted data</p>
            </Link>
            <Link to="/admin/users" className="p-4 border dark:border-gray-600 rounded hover:shadow-md transition-all group">
              <div className="bg-orange-500 w-10 h-10 rounded flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                <SafeIcon icon={FiUsers} />
              </div>
              <h3 className="font-bold dark:text-white">Manage Users</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">View all users</p>
            </Link>
            <Link to="/admin/settings" className="p-4 border dark:border-gray-600 rounded hover:shadow-md transition-all group">
              <div className="bg-gray-700 w-10 h-10 rounded flex items-center justify-center text-white mb-2 group-hover:scale-110 transition-transform">
                <SafeIcon icon={FiSettings} />
              </div>
              <h3 className="font-bold dark:text-white">Settings</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Update app name/logo</p>
            </Link>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow p-6 text-white">
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