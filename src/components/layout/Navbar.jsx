import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';

const { FiUser, FiLogOut, FiBook, FiSettings, FiHelpCircle, FiLogIn, FiUserPlus, FiLoader, FiSun, FiMoon, FiMenu, FiX, FiPieChart } = FiIcons;

const Navbar = () => {
  const { user, logout } = useAuth();
  const { settings, loading } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white/90 dark:bg-gray-900/90 shadow-sm border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40 backdrop-blur-md transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group" onClick={closeMenu}>
              {loading ? (
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              ) : settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded-md" />
              ) : (
                <div className="bg-[#E53935] p-1.5 rounded-lg group-hover:bg-[#d32f2f] transition-colors">
                  <SafeIcon icon={FiBook} className="h-6 w-6 text-white" />
                </div>
              )}
              <span className="text-xl font-bold text-[#000000] dark:text-white tracking-tight group-hover:text-[#E53935] transition-colors">
                {loading ? "Loading..." : settings.appName}
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Theme Toggle Button (Visible on all) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              <SafeIcon
                icon={theme === 'dark' ? FiSun : FiMoon}
                className={`w-5 h-5 ${theme === 'dark' ? 'text-yellow-400' : 'text-gray-600'}`}
              />
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <>
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive('/admin')
                        ? 'bg-red-50 text-[#E53935] dark:bg-red-900/20 dark:text-red-400'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                        }`}
                    >
                      <SafeIcon icon={FiSettings} className="inline-block w-4 h-4 mr-1.5" />
                      Admin
                    </Link>
                  )}
                  {user.role === 'student' && (
                    <>
                      <Link
                        to="/student"
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${location.pathname === '/student'
                          ? 'bg-red-50 text-[#E53935] dark:bg-red-900/20 dark:text-red-400'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                          }`}
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/student/support"
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive('/student/support')
                          ? 'bg-red-50 text-[#E53935] dark:bg-red-900/20 dark:text-red-400'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                          }`}
                      >
                        <SafeIcon icon={FiHelpCircle} className="inline-block w-4 h-4 mr-1.5" />
                        Support
                      </Link>
                    </>
                  )}

                  <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

                  <div className="flex items-center space-x-3 pl-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-[#E53935] flex items-center justify-center text-white shadow-sm ring-2 ring-white dark:ring-gray-700">
                        <SafeIcon icon={FiUser} className="w-4 h-4" />
                      </div>
                      <div className="hidden lg:flex flex-col">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-none">{user.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize leading-none mt-1">{user.role}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-2 rounded-lg text-gray-400 hover:text-[#E53935] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Logout"
                    >
                      <SafeIcon icon={FiLogOut} className="w-5 h-5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-[#E53935] dark:text-gray-300 dark:hover:text-[#E53935] font-medium text-sm px-3 py-2 transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-[#E53935] hover:bg-[#d32f2f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <SafeIcon icon={isMenuOpen ? FiX : FiMenu} className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {user ? (
                <>
                  <div className="flex items-center space-x-3 p-3 mb-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-[#E53935] flex items-center justify-center text-white">
                      <SafeIcon icon={FiUser} className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white leading-none">{user.name}</p>
                      <p className="text-xs text-gray-500 capitalize mt-1">{user.role}</p>
                    </div>
                  </div>

                  {user.role === 'admin' ? (
                    <MobileNavLink to="/admin" icon={FiSettings} onClick={closeMenu}>Admin Panel</MobileNavLink>
                  ) : (
                    <>
                      <MobileNavLink to="/student" icon={FiPieChart} onClick={closeMenu}>Student Dashboard</MobileNavLink>
                      <MobileNavLink to="/student/support" icon={FiHelpCircle} onClick={closeMenu}>Help & Support</MobileNavLink>
                    </>
                  )}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  >
                    <SafeIcon icon={FiLogOut} className="w-5 h-5" />
                    Log Out
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Link
                    to="/login"
                    onClick={closeMenu}
                    className="flex justify-center items-center py-3 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-700 dark:text-gray-200"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    onClick={closeMenu}
                    className="flex justify-center items-center py-3 bg-[#E53935] text-white rounded-xl font-bold"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

const MobileNavLink = ({ to, icon, children, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
  >
    <SafeIcon icon={icon} className="w-5 h-5 text-gray-400" />
    {children}
  </Link>
);

export default Navbar;