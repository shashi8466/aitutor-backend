import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const { FiHome, FiCpu, FiTarget, FiActivity, FiTrendingUp, FiMap, FiLogOut, FiPieChart, FiUser, FiBook, FiAward, FiHelpCircle, FiZap, FiCalendar, FiFileText, FiX, FiSettings } = FiIcons;

const StudentSidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();

  const menuGroups = [
    {
      title: "Overview",
      items: [
        { name: 'Dashboard', path: '/student', icon: FiHome, exact: true },
        { name: 'Calendar', path: '/student/calendar', icon: FiCalendar, badge: 'Soon' },
      ]
    },
    {
      title: "Learning Center",
      items: [
        { name: 'My Courses', path: '/student/courses', icon: FiBook },
        { name: 'Practice Test', path: '/student/practice-tests', icon: FiActivity, badge: 'Live' },
        { name: 'Leaderboard', path: '/student/leaderboard', icon: FiAward },
      ]
    },
    {
      title: "AI Agents Suite",
      items: [
        { name: 'Personal AI Tutor', path: '/student/tutor', icon: FiCpu, badge: '24/7' },
        { name: 'Study Plan Agent', path: '/student/plan', icon: FiActivity },
        { name: 'Weakness Drills', path: '/student/drills', icon: FiTarget },
        { name: 'Test Review Agent', path: '/student/test-review', icon: FiPieChart },
        { name: 'College Advisor', path: '/student/college', icon: FiMap },
      ]
    },
    {
      title: "System",
      items: [
        { name: 'Profile Settings', path: '/student/settings', icon: FiSettings },
        { name: 'Help & Support', path: '/student/support', icon: FiHelpCircle },
      ]
    }
  ];

  const renderLink = (item) => {
    const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
    // onClick={onClose} ensures sidebar closes when a link is clicked on mobile
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.exact}
        onClick={onClose}
        className={({ isActive }) => `
          flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group mb-1
          ${isActive
            ? 'bg-red-50 dark:bg-red-900/20 text-[#E53935] font-bold shadow-sm border-l-4 border-[#E53935]'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium border-l-4 border-transparent'}
        `}
      >
        <div className="flex items-center gap-3">
          <SafeIcon icon={item.icon} className={`w-5 h-5 ${isActive ? 'fill-current' : ''}`} />
          <span className="text-sm">{item.name}</span>
        </div>
        {item.badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${item.badge === '24/7' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 bottom-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo Area */}
        <div className="h-20 flex items-center px-6 border-b border-gray-100 dark:border-gray-800 justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-[#E53935] to-[#D32F2F] rounded-xl flex items-center justify-center text-white mr-3 shadow-lg shadow-red-500/20 overflow-hidden">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <SafeIcon icon={FiZap} className="w-6 h-6" />
              )}
            </div>
            <div>
              <span className="font-extrabold text-xl text-gray-900 dark:text-white tracking-tight block leading-none">{settings.appName}</span>
              <span className="text-[10px] uppercase font-bold text-[#E53935] tracking-widest">Learning</span>
            </div>
          </div>
          {/* Close Button (Mobile Only) */}
          <button onClick={onClose} className="lg:hidden p-2 text-gray-400 hover:text-gray-600">
            <SafeIcon icon={FiX} className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Menu */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              <p className="px-4 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                {group.title}
              </p>
              {group.items.map(renderLink)}
            </div>
          ))}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20">
          <div className="rounded-xl p-2 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 ring-2 ring-white dark:ring-gray-800 shadow-sm">
                <SafeIcon icon={FiUser} className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{user?.name}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded inline-block">Student</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Log Out">
              <SafeIcon icon={FiLogOut} className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentSidebar;