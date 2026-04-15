import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';


import BrandName from '../../common/BrandName';


const { FiUser, FiLogOut, FiSettings, FiHelpCircle, FiMenu, FiX, FiPieChart } = FiIcons;

const Navbar = () => {
  const { user, logout } = useAuth();
  const { settings, loading } = useSettings();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    navigate('/login');
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] p-2 sm:p-4 lg:p-5 transition-all duration-300 mobile-safe">
      <nav className="mx-auto flex max-w-[1500px] items-center justify-between rounded-2xl sm:rounded-[24px] border border-white/5 bg-slate-900/40 px-3 sm:px-6 lg:px-10 py-3 sm:py-4 backdrop-blur-2xl shadow-2xl w-full">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link to="/" className="flex items-center gap-2 sm:gap-4 group min-w-0" onClick={closeMenu}>
            {(settings.logo_url || settings.logoUrl) ? (
              <div className="h-13 w-auto max-w-[140px] flex items-center justify-center">
                <img src={settings.logo_url || settings.logoUrl} alt="Logo" className="h-full w-auto object-contain rounded-[6px]" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-xl bg-black border border-white/20 flex items-center justify-center shadow-xl">
                 <span className="text-white font-black italic text-xs tracking-tighter shadow-sm">AI</span>
              </div>
            )}
            <div className="text-base sm:text-xl lg:text-2xl font-black tracking-tight text-white flex items-center truncate">
              {settings.appName === 'Aiprep365' || settings.appName === 'AIPrep365' || !settings.appName ? <BrandName /> : settings.appName}
            </div>
          </Link>
        </div>

        <div className="hidden lg:flex items-center gap-10 text-sm font-semibold tracking-wide text-slate-400">
          {user ? (
            <>
              {user.role === 'admin' && <Link to="/admin" className="hover:text-white transition-all uppercase">Admin</Link>}
              {user.role === 'student' && <Link to="/student" className="hover:text-white transition-all uppercase">Dashboard</Link>}
            </>
          ) : (
            ['FEATURES', 'RESULTS', 'HOW IT WORKS', 'PRICING'].map((item) => (
              <Link key={item} to="/" className="hover:text-white transition-all uppercase">{item}</Link>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-300 hidden sm:block">{user.name}</span>
              <button onClick={handleLogout} className="p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
                <SafeIcon icon={FiLogOut} className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="hidden sm:block px-5 lg:px-8 py-2.5 rounded-full border border-sky-500 text-sky-500 text-xs sm:text-sm font-semibold tracking-wide hover:bg-sky-500/10 transition-all">LOGIN</button>
              <button onClick={() => navigate('/signup')} className="hidden sm:block px-5 lg:px-8 py-2.5 rounded-full bg-orange-500 text-slate-950 text-xs sm:text-sm font-bold tracking-wide hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95">SIGN UP</button>
            </>
          )}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-white/5 transition-all">
            <SafeIcon icon={isMenuOpen ? FiX : FiMenu} className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Back Drop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeMenu}
                className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[150]"
              />
              
              {/* Side/Full Menu */}
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="lg:hidden fixed top-0 right-0 bottom-0 w-[92%] max-w-[400px] bg-slate-900 border-l border-white/5 shadow-2xl z-[200] overflow-y-auto"
              >
                <div className="flex flex-col h-full p-8">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-3">
                      {(settings.logo_url || settings.logoUrl) ? (
                        <div className="h-10 w-auto max-w-[100px] flex items-center justify-center">
                          <img src={settings.logo_url || settings.logoUrl} alt="Logo" className="h-full w-auto object-contain rounded-[6px]" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-black border border-white/20 flex items-center justify-center">
                          <span className="text-white font-black italic text-[10px]">AI</span>
                        </div>
                      )}
                      <span className="text-lg font-black text-white">
                        {settings.appName === 'Aiprep365' || settings.appName === 'AIPrep365' || !settings.appName ? <BrandName className="text-lg" /> : settings.appName}
                      </span>
                    </div>
                    <button onClick={closeMenu} className="p-2 text-slate-400 hover:text-white">
                      <FiX size={24} />
                    </button>
                  </div>

                  <div className="space-y-2 flex-1">
                    {user ? (
                      <>
                        <div className="flex items-center space-x-3 p-4 bg-white/5 rounded-2xl border border-white/5 mb-6">
                          <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white">
                            <SafeIcon icon={FiUser} className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-white leading-none">{user.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-black mt-1">{user.role}</p>
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
                      </>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Navigation</p>
                        {['FEATURES', 'RESULTS', 'HOW IT WORKS', 'PRICING'].map((item) => (
                          <Link 
                            key={item} 
                            to="/" 
                            onClick={closeMenu}
                            className="block text-lg font-black text-slate-300 hover:text-white transition-all uppercase tracking-tighter"
                          >
                            {item}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-8 border-t border-white/5">
                    {user ? (
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-3 py-4 text-red-500 font-black uppercase text-xs tracking-widest bg-red-500/10 rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all"
                      >
                        <SafeIcon icon={FiLogOut} className="w-4 h-4" />
                        Log Out
                      </button>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          onClick={() => { closeMenu(); navigate('/login'); }}
                          className="w-full flex justify-center items-center py-4 rounded-2xl border border-sky-500 text-sky-500 font-black text-xs uppercase tracking-widest"
                        >
                          Login
                        </button>
                        <button
                          onClick={() => { closeMenu(); navigate('/signup'); }}
                          className="w-full flex justify-center items-center py-4 bg-orange-500 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20"
                        >
                          Sign Up
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
};

const MobileNavLink = ({ to, icon, children, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center gap-3 px-4 py-3 text-slate-300 font-bold hover:bg-white/5 rounded-2xl transition-all"
  >
    <SafeIcon icon={icon} className="w-5 h-5 text-slate-500" />
    {children}
  </Link>
);

export default Navbar;