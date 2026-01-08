import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

const { FiMenu, FiZap } = FiIcons;

const StudentLayout = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { settings } = useSettings();

  // Close sidebar when route changes (mobile UX)
  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 flex flex-col lg:flex-row font-sans">
      {/* Mobile Header (Visible only on lg and below) */}
      <div className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <SafeIcon icon={FiMenu} className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#E53935] to-[#D32F2F] rounded-lg flex items-center justify-center text-white shadow-md overflow-hidden">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <SafeIcon icon={FiZap} className="w-4 h-4" />
              )}
            </div>
            <span className="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight">{settings.appName}</span>
          </div>
        </div>

        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-bold border border-white dark:border-gray-800">
          {user?.name?.charAt(0) || 'S'}
        </div>
      </div>

      {/* Sidebar Component */}
      <StudentSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-72 min-w-0 transition-all duration-200 flex flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StudentLayout;