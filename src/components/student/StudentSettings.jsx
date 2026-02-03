import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';

const { FiUser, FiMail, FiPhone, FiSave, FiLoader, FiCheckCircle, FiShield, FiAlertCircle, FiLock, FiKey } = FiIcons;

const StudentSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'security'

  // Profile Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    fatherName: '',
    fatherMobile: ''
  });

  // Security Form State
  const [securityData, setSecurityData] = useState({
    newEmail: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Ref to track if we've already initialized data to prevent loops
  const initialized = useRef(false);

  useEffect(() => {
    if (user) {
      // Only update if values are actually different to prevent re-render loops
      setFormData(prev => {
        const newData = {
          name: user.name || '',
          email: user.email || '',
          mobile: user.mobile || '',
          fatherName: user.father_name || '',
          fatherMobile: user.father_mobile || ''
        };

        // Simple shallow comparison
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          return newData;
        }
        return prev;
      });

      setSecurityData(prev => {
        if (prev.newEmail !== user.email && !prev.newEmail) {
          return { ...prev, newEmail: user.email };
        }
        return prev;
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSecurityChange = (e) => {
    setSecurityData({ ...securityData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const updates = {
        name: formData.name,
        mobile: formData.mobile,
        father_name: formData.fatherName,
        father_mobile: formData.fatherMobile
      };

      await authService.updateProfile(user.id, updates);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('❌ Profile Update Error:', err);
      setError(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    if (!securityData.newEmail || securityData.newEmail === user.email) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authService.updateEmail(securityData.newEmail);
      setSuccess('Confirmation link sent to your new email! Please check both your old and new inboxes to confirm the change.');
    } catch (err) {
      setError(err.message || 'Failed to update email.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (securityData.newPassword !== securityData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (securityData.newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authService.updatePassword(securityData.newPassword);
      setSuccess('Password updated successfully!');
      setSecurityData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Account Settings</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Manage your personal information and login details.</p>
        </div>

        {/* Tab Navigation - Responsive */}
        <div className="flex flex-wrap gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl mb-4 sm:mb-6 shadow-sm border border-gray-200 dark:border-gray-700 w-full sm:w-fit">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            <SafeIcon icon={FiUser} className="w-4 h-4" /> <span>Personal Info</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'security' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            <SafeIcon icon={FiLock} className="w-4 h-4" /> <span>Login & Security</span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Header Profile Section - Responsive */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 sm:p-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#E53935] to-orange-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-xl border-4 border-white/10 flex-shrink-0">
              {formData.name.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{formData.name || 'Student'}</h2>
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-gray-300 border border-white/20 inline-block">
                Student Account
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-8">
            {/* Status Messages */}
            {success && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-xl flex items-center gap-3">
                <SafeIcon icon={FiCheckCircle} className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{success}</span>
              </motion.div>
            )}
            {error && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-xl flex items-center gap-3">
                <SafeIcon icon={FiAlertCircle} className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium text-sm">{error}</span>
              </div>
            )}

            {/* TAB: PROFILE */}
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Personal Info */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                      <SafeIcon icon={FiUser} className="text-[#E53935]" /> Personal Information
                    </h3>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                      <div className="relative">
                        <input
                          type="email"
                          value={formData.email}
                          disabled
                          className="w-full p-3 pl-10 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        />
                        <SafeIcon icon={FiMail} className="absolute left-3 top-3.5 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 pl-1">To change email, go to "Login & Security".</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Mobile Number</label>
                      <div className="relative">
                        <input
                          type="tel"
                          name="mobile"
                          value={formData.mobile}
                          onChange={handleChange}
                          placeholder="+91..."
                          className="w-full p-3 pl-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all dark:text-white"
                        />
                        <SafeIcon icon={FiPhone} className="absolute left-3 top-3.5 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Guardian Info */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                      <SafeIcon icon={FiShield} className="text-blue-500" /> Guardian Details
                    </h3>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Father / Guardian Name</label>
                      <input
                        type="text"
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleChange}
                        placeholder="Parent Name"
                        className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Guardian Mobile</label>
                      <div className="relative">
                        <input
                          type="tel"
                          name="fatherMobile"
                          value={formData.fatherMobile}
                          onChange={handleChange}
                          placeholder="+91..."
                          className="w-full p-3 pl-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                        />
                        <SafeIcon icon={FiPhone} className="absolute left-3 top-3.5 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 pl-1">Used for progress reports (Parent Connect).</p>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-[#d32f2f] transition-all flex items-center gap-2 shadow-lg shadow-red-200 dark:shadow-none disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <SafeIcon icon={FiLoader} className="animate-spin w-5 h-5" /> : <SafeIcon icon={FiSave} className="w-5 h-5" />}
                    {loading ? 'Saving Changes...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB: SECURITY */}
            {activeTab === 'security' && (
              <div className="space-y-10 max-w-2xl">
                {/* Email Change Section */}
                <form onSubmit={handleEmailUpdate} className="space-y-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <SafeIcon icon={FiMail} className="text-[#E53935]" /> Change Email Address
                  </h3>
                  <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 sm:p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 text-xs sm:text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                    <strong>Note:</strong> Changing your email will require you to verify the new address via a confirmation link sent to your inbox.
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">New Email Address</label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <input
                        type="email"
                        name="newEmail"
                        value={securityData.newEmail}
                        onChange={handleSecurityChange}
                        className="flex-1 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={loading || securityData.newEmail === user.email}
                        className="w-full sm:w-auto px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        Update Email
                      </button>
                    </div>
                  </div>
                </form>

                {/* Password Change Section */}
                <form onSubmit={handlePasswordUpdate} className="space-y-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <SafeIcon icon={FiKey} className="text-[#E53935]" /> Change Password
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                      <input
                        type="password"
                        name="newPassword"
                        value={securityData.newPassword}
                        onChange={handleSecurityChange}
                        placeholder="Min 6 chars"
                        className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={securityData.confirmPassword}
                        onChange={handleSecurityChange}
                        placeholder="Re-enter password"
                        className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none transition-all dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-center sm:justify-end">
                    <button
                      type="submit"
                      disabled={loading || !securityData.newPassword}
                      className="w-full sm:w-auto px-8 py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-[#d32f2f] transition-all disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StudentSettings;