import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import BrandName from '../../common/BrandName';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { planService } from '../../services/api';


const { FiHome, FiCpu, FiTarget, FiActivity, FiTrendingUp, FiMap, FiLogOut, FiPieChart, FiUser, FiBook, FiAward, FiHelpCircle, FiZap, FiCalendar, FiFileText, FiX, FiSettings, FiStar, FiArrowUpCircle, FiMessageSquare } = FiIcons;

const StudentSidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { settings: appSettings } = useSettings();
  const [planSettings, setPlanSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const isPremium = user?.plan_type === 'premium' && user?.plan_status === 'active';
  const isPending = user?.plan_status === 'pending_upgrade';

  useEffect(() => {
    if (user?.plan_type) {
      loadPlanSettings();
    }
  }, [user?.plan_type]);

  const loadPlanSettings = async () => {
    try {
      const { data } = await planService.getSettings();
      const currentPlanSettings = (data || []).find(s => s.plan_type === user.plan_type);
      setPlanSettings(currentPlanSettings);
    } catch (err) {
      console.error("Failed to load plan settings in sidebar:", err);
    } finally {
      setLoading(false);
    }
  };

  const menuGroups = [
    {
      title: "Overview",
      items: [
        { name: 'Dashboard', path: '/student', icon: FiHome, exact: true },
        { name: 'Calendar', path: '/student/calendar', icon: FiCalendar },
      ]
    },
    {
      title: "Learning Center",
      items: [
        { name: 'My Courses', path: '/student/courses', icon: FiBook },
        { name: 'Practice Test', path: '/student/practice-tests', icon: FiActivity, badge: 'Live' },
        { name: 'Feedback', path: '/student/feedback', icon: FiMessageSquare },
        { name: 'Score Predictor', path: '/student/score-predictor', icon: FiZap, settingKey: 'feature_score_predictor' },
        { name: 'Leaderboard', path: '/student/leaderboard', icon: FiAward, settingKey: 'feature_leaderboard' },
      ]
    },
    {
      title: "AI Agents Suite",
      items: [
        { name: <BrandName className="text-sm" />, path: '/student/tutor', icon: FiCpu, badge: '24/7', settingKey: 'feature_ai_tutor' },
        { name: 'Study Plan Agent', path: '/student/plan', icon: FiActivity, settingKey: 'feature_study_planner' },
        { name: 'Weakness Drills', path: '/student/drills', icon: FiTarget, settingKey: 'feature_weakness_drills' },
        { name: 'Test Review Agent', path: '/student/test-review', icon: FiPieChart, settingKey: 'feature_test_review' },
        { name: 'College Advisor', path: '/student/college', icon: FiMap, settingKey: 'feature_college_advisor' },
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

  const handleLinkClick = (e, item) => {
    if (item.settingKey) {
      const isEnabled = planSettings?.[item.settingKey];
      if (!isEnabled) {
        e.preventDefault();
        if (user?.plan_type === 'free') {
          onClose();
          navigate('/student/upgrade');
        } else {
          alert("This feature is currently disabled by Admin for your plan.");
        }
        return;
      }
    }
    onClose();
  };

  const renderLink = (item) => {
    const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
    const isEnabled = item.settingKey ? (planSettings?.[item.settingKey] ?? true) : true;
    const isLocked = !isEnabled && user?.plan_type === 'free';
    
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.exact}
        onClick={(e) => handleLinkClick(e, item)}
        className={({ isActive }) => `
          flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group mb-1
          ${!isEnabled ? 'opacity-70 grayscale' : ''}
          ${isActive
            ? 'bg-red-50 dark:bg-red-900/20 text-[#E53935] font-bold shadow-sm border-l-4 border-[#E53935]'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium border-l-4 border-transparent'}
        `}
      >
        <div className="flex items-center gap-3">
          <SafeIcon icon={item.icon} className={`w-5 h-5 ${isActive ? 'fill-current' : ''}`} />
          <span className="text-sm flex items-center gap-2">
            {item.name}
            {!isEnabled && <FiIcons.FiLock className="w-3 h-3 text-gray-400" />}
          </span>
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
            <div className="h-12 w-auto max-w-[150px] flex items-center justify-center mr-3 overflow-hidden text-black dark:text-white">
              {appSettings.logoUrl ? (
                <img src={appSettings.logoUrl} alt="Logo" className="h-full w-auto object-contain rounded-[6px]" />
              ) : (
                <BrandName className="text-xl" />
              )}
            </div>
            <div>
              <span className="font-extrabold text-xl text-gray-900 dark:text-white tracking-tight block leading-none">
                {appSettings.appName === 'Aiprep365' || appSettings.appName === 'AIPrep365' || !appSettings.appName ? <BrandName className="text-xl" /> : appSettings.appName}
              </span>
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
          {!isPremium && !isPending && (
            <NavLink
              to="/student/upgrade"
              onClick={onClose}
              className="mb-4 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#E53935] to-[#D32F2F] text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 group"
            >
              <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
                <SafeIcon icon={FiIcons.FiZap} className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-wider">Join Premium</p>
                <p className="text-[10px] text-red-100 font-bold">Unlock All AI Tools</p>
              </div>
              <SafeIcon icon={FiIcons.FiChevronRight} className="w-4 h-4 opacity-50" />
            </NavLink>
          )}

          {isPending && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-800">
              <SafeIcon icon={FiIcons.FiClock} className="w-5 h-5 animate-pulse" />
              <div className="flex-1">
                <p className="text-xs font-bold">Upgrade Pending</p>
                <p className="text-[10px] opacity-70">Verifying in 1 hour</p>
              </div>
            </div>
          )}

          <div className="rounded-xl p-2 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 ring-2 ring-white dark:ring-gray-800 shadow-sm relative">
                <SafeIcon icon={FiUser} className="w-5 h-5" />
                {isPremium && (
                  <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 border-2 border-white dark:border-gray-800">
                    <SafeIcon icon={FiIcons.FiStar} className="w-2.5 h-2.5 text-white fill-white" />
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{user?.name}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded inline-block uppercase tracking-tighter">Student</p>
                  <p className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${isPremium ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {user?.plan_type || 'Free'}
                  </p>
                </div>
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