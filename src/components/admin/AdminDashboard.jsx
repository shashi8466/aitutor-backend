import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import LoadingSpinner from '../common/LoadingSpinner';
import Skeleton from '../common/Skeleton';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

// Lazy load admin sections
const CourseManagement = lazy(() => import('./CourseManagement'));
const FullLengthTestEditPage = lazy(() => import('./FullLengthTestEditPage'));
const RegularCourseEditPage = lazy(() => import('./RegularCourseEditPage'));
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
const AdminPlanManagement = lazy(() => import('./AdminPlanManagement'));
const TestReview = lazy(() => import('../student/agents/TestReview'));
const DetailedTestReview = lazy(() => import('../student/DetailedTestReview'));
const FullTestReport = lazy(() => import('../common/FullTestReport'));
const AdminEnrollmentKeys = lazy(() => import('./AdminEnrollmentKeys'));
const AdminDemoLeads = lazy(() => import('./AdminDemoLeads'));
const UniversalLeaderboard = lazy(() => import('../common/UniversalLeaderboard'));

import { courseService, uploadService, adminService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import DashboardPreviewer from './DashboardPreviewer';

const { FiBook, FiUpload, FiHelpCircle, FiFolder, FiTrendingUp, FiUsers, FiGrid, FiDatabase, FiSettings, FiLogOut, FiLayers, FiShield, FiKey, FiMenu, FiX, FiChevronLeft, FiChevronRight, FiChevronDown, FiCalendar, FiActivity, FiUserPlus, FiFileText, FiCheckCircle, FiArrowUp } = FiIcons;

let savedSidebarScroll = 0;
let savedSidebarOpen = true;

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalCourses: 0, totalQuestions: 0, totalUploads: 0, activeUsers: 0 });
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { settings } = useSettings();
  const [showPreviewer, setShowPreviewer] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(savedSidebarOpen);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (location.pathname === '/admin') {
      loadStats();
    }
  }, [location.pathname]); // Only trigger on dashboard index

  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = savedSidebarScroll;
    }
  }, []);

  const handleSidebarScroll = (e) => {
    savedSidebarScroll = e.target.scrollTop;
  };

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    savedSidebarOpen = newState;
  };

  const loadStats = async () => {
    try {
      const response = await adminService.getDashboardStats();
      const data = response.data || {};
      
      setStats({
        totals: data.totals || {
          totalStudents: 0,
          demoLeads: 0,
          originalLeads: 0,
          activeStudents: 0,
          totalCourses: 0,
          totalQuestions: 0,
          activeTests: 0
        },
        pieData: data.pieData || [],
        lineData: data.lineData || [],
        recentActivities: data.recentActivities || []
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

  const navGroups = [
    {
      label: null,
      links: [
        { name: 'Overview', path: '/admin', icon: FiGrid },
      ]
    },
    {
      label: 'USER MANAGEMENT',
      links: [
        { name: 'Users', path: '/admin/users', icon: FiUsers },
        { name: 'Parents', path: '/admin/parents', icon: FiUsers },
        { name: 'Notifications', path: '/admin/notifications', icon: FiBook },
        { name: 'Parent Notifications', path: '/admin/parent-notifications', icon: FiUsers },
      ]
    },
    {
      label: 'ACADEMIC MANAGEMENT',
      links: [
        { name: 'Courses', path: '/admin/courses', icon: FiBook },
        { name: 'Questions', path: '/admin/questions', icon: FiHelpCircle },
        { name: 'Knowledge Base', path: '/admin/knowledge-base', icon: FiDatabase },
        { name: 'Files', path: '/admin/uploads', icon: FiFolder },
        { name: 'Upload New', path: '/admin/upload', icon: FiUpload },
        { name: 'Enrollment Keys', path: '/admin/keys', icon: FiKey },
        { name: 'Student Groups', path: '/admin/groups', icon: FiLayers },
      ]
    },
    {
      label: 'LEADS & REPORTS',
      links: [
        { name: 'Demo Leads', path: '/admin/demo-leads', icon: FiUsers },
        { name: 'Leaderboard', path: '/admin/leaderboard', icon: FiIcons.FiAward },
        { name: 'Plan Management', path: '/admin/plans', icon: FiShield },
      ]
    },
    {
      label: 'SETTINGS',
      links: [
        { name: 'Settings', path: '/admin/settings', icon: FiSettings },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 overflow-hidden">
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed md:relative z-50 h-full bg-[#0B1120] border-r border-slate-800 transition-all duration-300 flex flex-col ${
          isSidebarOpen ? 'w-64' : 'w-20'
        } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo Area */}
        <div className="h-20 flex items-center justify-center px-4 border-b border-slate-800/50 relative">
          <div className="flex items-center justify-center w-full overflow-hidden">
            {(settings?.logo_url || settings?.logoUrl) ? (
              <img src={settings.logo_url || settings.logoUrl} alt="Logo" className="h-12 w-auto object-contain rounded-[4px] shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center shrink-0">
                <span className="text-2xl">🤖</span>
              </div>
            )}
          </div>
          {/* Mobile close button */}
          <button 
            className="absolute right-4 md:hidden text-slate-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <SafeIcon icon={FiX} className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div 
          ref={sidebarRef}
          onScroll={handleSidebarScroll}
          className="flex-1 overflow-y-auto py-4 scrollbar-hide hide-scrollbar"
        >
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="mb-6">
              {group.label && isSidebarOpen && (
                <div className="px-6 mb-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {group.label}
                </div>
              )}
              {group.label && !isSidebarOpen && (
                <div className="px-4 mb-2 flex justify-center">
                  <div className="w-4 h-[1px] bg-slate-700"></div>
                </div>
              )}
              <div className="space-y-1 px-3">
                {group.links.map((link) => {
                  const isActive = link.path === '/admin'
                    ? location.pathname === '/admin'
                    : location.pathname.startsWith(link.path);

                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      title={!isSidebarOpen ? link.name : ''}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center rounded-lg transition-colors ${
                        isSidebarOpen ? 'px-3 py-2.5' : 'justify-center p-3'
                      } ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                      }`}
                    >
                      <SafeIcon icon={link.icon} className={`shrink-0 ${isSidebarOpen ? 'w-4 h-4 mr-3' : 'w-5 h-5'}`} />
                      {isSidebarOpen && (
                        <span className="text-sm font-medium whitespace-nowrap">{link.name}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer / Collapse */}
        <div className="p-4 border-t border-slate-800/50">
          <button
            onClick={toggleSidebar}
            className="hidden md:flex items-center w-full rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors p-2"
            title="Toggle Sidebar"
          >
            <SafeIcon icon={FiChevronLeft} className={`w-5 h-5 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180 mx-auto'}`} />
            {isSidebarOpen && <span className="text-sm font-medium ml-3">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        
        {/* Main Content Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg"
            >
              <SafeIcon icon={FiMenu} className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm hidden sm:block">Manage courses, questions, content, and settings</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowPreviewer(true)}
              className="hidden sm:flex items-center px-3 sm:px-4 py-2 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors font-black text-[10px] sm:text-xs uppercase tracking-widest border border-sky-200 dark:border-sky-800 shadow-sm"
            >
              <SafeIcon icon={FiIcons.FiEye} className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Switch View</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center px-3 sm:px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors font-medium text-xs sm:text-sm shadow-sm"
            >
              <SafeIcon icon={FiLogOut} className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<LoadingSpinner fullPage={false} />}>
            <Routes>
              <Route path="/" element={<DashboardHome stats={stats} loading={loading} setShowPreviewer={setShowPreviewer} />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/courses" element={<CourseManagement onStatsUpdate={loadStats} />} />
              <Route path="/keys" element={<AdminEnrollmentKeys />} />
              <Route path="/full-length-test/:id" element={<FullLengthTestEditPage />} />
              <Route path="/regular-course/:id" element={<RegularCourseEditPage />} />
              <Route path="/course/:id" element={<AdminCourseDetail />} />
              <Route path="/student-analysis/:studentId" element={<TestReview basePath="/admin" />} />
              <Route path="/detailed-review/:submissionId" element={<DetailedTestReview />} />
              <Route path="/report/:submissionId" element={<FullTestReport adminMode={true} />} />
              <Route path="/groups" element={<AdminGroupManagement />} />
              <Route path="/parents" element={<AdminParentManagement />} />
              <Route path="/notifications" element={<AdminNotificationManager />} />
              <Route path="/parent-notifications" element={<AdminParentNotificationManager />} />
              <Route path="/questions" element={<QuestionManagement />} />
              <Route path="/knowledge-base" element={<KnowledgeBase />} />
              <Route path="/upload" element={<FileUpload />} />
              <Route path="/uploads" element={<UploadManagement />} />
              <Route path="/demo-leads" element={<AdminDemoLeads />} />
              <Route path="/leaderboard" element={<UniversalLeaderboard role="admin" title="Global Admin Leaderboard" subtitle="Platform-wide rankings across all students, groups, and courses" />} />
              <Route path="/plans" element={<AdminPlanManagement />} />
              <Route path="/settings" element={<AdminSettings />} />
            </Routes>
          </Suspense>

          <DashboardPreviewer isOpen={showPreviewer} onClose={() => setShowPreviewer(false)} />
        </div>
      </main>
    </div>
  );
};

const DashboardHome = ({ stats, loading, setShowPreviewer }) => {
  const t = stats?.totals || {};
  const lineData = stats?.lineData || [];
  const pieData = stats?.pieData || [];
  const recentActivities = stats?.recentActivities || [];
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Top Header / Date Filter */}
      <div className="flex justify-end">
        <button className="flex items-center px-4 py-2 bg-[#0B1120] text-sm text-slate-300 rounded-lg border border-slate-800 shadow-sm hover:bg-slate-900 transition-colors">
          <SafeIcon icon={FiCalendar} className="w-4 h-4 mr-2 text-slate-400" />
          Aug 1, 2026 - Aug 7, 2026
          <SafeIcon icon={FiChevronDown} className="w-4 h-4 ml-2 text-slate-500" />
        </button>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-[#0B1120] rounded-xl p-5 border border-slate-800 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg flex-shrink-0">
            <SafeIcon icon={FiUsers} className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium mb-1">Total Students</p>
            <h3 className="text-white text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : t.totalStudents || 0}</h3>
            <p className="text-green-500 text-[10px] mt-1 flex items-center font-medium">
              <SafeIcon icon={FiArrowUp} className="w-3 h-3 mr-1" />
              12.5% from last week
            </p>
          </div>
        </div>

        <div className="bg-[#0B1120] rounded-xl p-5 border border-slate-800 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg flex-shrink-0">
            <SafeIcon icon={FiBook} className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium mb-1">Total Courses</p>
            <h3 className="text-white text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : t.totalCourses || 0}</h3>
            <p className="text-green-500 text-[10px] mt-1 flex items-center font-medium">
              <SafeIcon icon={FiArrowUp} className="w-3 h-3 mr-1" />
              8.3% from last week
            </p>
          </div>
        </div>

        <div className="bg-[#0B1120] rounded-xl p-5 border border-slate-800 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg flex-shrink-0">
            <SafeIcon icon={FiFileText} className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium mb-1">Total Questions</p>
            <h3 className="text-white text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : t.totalQuestions || 0}</h3>
            <p className="text-green-500 text-[10px] mt-1 flex items-center font-medium">
              <SafeIcon icon={FiArrowUp} className="w-3 h-3 mr-1" />
              15.7% from last week
            </p>
          </div>
        </div>

        <div className="bg-[#0B1120] rounded-xl p-5 border border-slate-800 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-orange-500/10 rounded-lg flex-shrink-0">
            <SafeIcon icon={FiActivity} className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium mb-1">Active Tests</p>
            <h3 className="text-white text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : t.activeTests || 0}</h3>
            <p className="text-green-500 text-[10px] mt-1 flex items-center font-medium">
              <SafeIcon icon={FiArrowUp} className="w-3 h-3 mr-1" />
              9.1% from last week
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Student Activity Block */}
        <div className="lg:col-span-6 bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col h-full shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-bold text-sm">Student Activity</h3>
            <button className="text-[10px] text-slate-300 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center shadow-sm">
              Last 7 Days <SafeIcon icon={FiChevronDown} className="ml-1.5 w-3 h-3" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg"><SafeIcon icon={FiUsers} className="w-4 h-4 text-blue-500" /></div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Total Students</p>
                <p className="text-white font-bold text-sm">{t.totalStudents || 0}</p>
              </div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg"><SafeIcon icon={FiUsers} className="w-4 h-4 text-green-500" /></div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Demo Leads</p>
                <p className="text-white font-bold text-sm">{t.demoLeads || 0}</p>
              </div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg"><SafeIcon icon={FiUsers} className="w-4 h-4 text-orange-500" /></div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Original Leads</p>
                <p className="text-white font-bold text-sm">{t.originalLeads || 0}</p>
              </div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg"><SafeIcon icon={FiBook} className="w-4 h-4 text-purple-500" /></div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Active Students</p>
                <p className="text-white font-bold text-sm">{t.activeStudents || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="h-48 w-full mt-auto relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px', color: '#fff' }} 
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '10px', color: '#94a3b8', paddingTop: '10px' }} />
                <Line type="monotone" name="Demo Leads" dataKey="demoLeads" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" name="Original Leads" dataKey="originalLeads" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Course Progress Overview Block */}
        <div className="lg:col-span-3 bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col h-full shadow-sm">
          <h3 className="text-white font-bold text-sm mb-6">Course Progress Overview</h3>
          <div className="flex-1 relative flex items-center justify-center min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={pieData} 
                  innerRadius={65} 
                  outerRadius={85} 
                  paddingAngle={2} 
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
              <span className="text-white font-bold text-2xl">{t.totalCourses || 0}</span>
              <span className="text-slate-500 text-[10px] font-medium">Total Courses</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs text-slate-300 font-medium">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">{item.value} ({item.percent})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Block */}
        <div className="lg:col-span-3 bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col h-full shadow-sm">
          <h3 className="text-white font-bold text-sm mb-5">Quick Actions</h3>
          <div className="flex flex-col gap-3">
            {[
              { to: '/admin/courses', icon: FiBook, color: 'bg-blue-500/10 text-blue-500', title: 'Create Course', desc: 'Add a new course' },
              { to: '/admin/demo-leads', icon: FiUsers, color: 'bg-green-500/10 text-green-500', title: 'Demo Leads', desc: 'View & manage demo leads' },
              { to: '/admin/plans', icon: FiShield, color: 'bg-orange-500/10 text-orange-500', title: 'Plan Management', desc: 'Manage subscription plans' },
              { to: '/admin/groups', icon: FiUsers, color: 'bg-purple-500/10 text-purple-500', title: 'Student Groups', desc: 'Manage tutor groups' },
            ].map(action => (
              <Link key={action.title} to={action.to} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-800 hover:border-slate-700 transition-all group">
                <div className={`p-2.5 rounded-lg ${action.color} group-hover:scale-110 transition-transform`}>
                  <SafeIcon icon={action.icon} className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="text-slate-200 text-xs font-bold">{action.title}</h4>
                  <p className="text-slate-500 text-[10px] mt-0.5">{action.desc}</p>
                </div>
                <SafeIcon icon={FiChevronRight} className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white font-bold text-sm">Recent Activities</h3>
          <button className="text-[10px] text-blue-400 hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm">View All</button>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-medium">
                <th className="py-3 px-4 font-medium pb-4">Activity</th>
                <th className="py-3 px-4 font-medium pb-4">Details</th>
                <th className="py-3 px-4 font-medium pb-4">By</th>
                <th className="py-3 px-4 font-medium pb-4">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.length > 0 ? (
                recentActivities.map((act, i) => (
                  <tr key={i} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition-colors">
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <div className={`p-1.5 rounded bg-${act.color}-500/10`}>
                        <SafeIcon icon={FiIcons[act.iconName] || FiIcons.FiActivity} className={`w-3.5 h-3.5 text-${act.color}-500`} />
                      </div>
                      <span className="text-slate-200 text-xs font-medium">{act.title}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-400">{act.details}</td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-400">{act.by}</td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-500">{act.time}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500 text-xs">No recent activities found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;