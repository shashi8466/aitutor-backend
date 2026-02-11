import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { authService, courseService } from '../../services/api';

const {
  FiUser, FiMail, FiUsers, FiRefreshCw, FiLoader, FiCheck, FiX,
  FiShield, FiBook, FiChevronRight, FiCheckCircle, FiAlertCircle, FiSettings
} = FiIcons;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showManageModal, setShowManageModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profilesRes, coursesRes] = await Promise.all([
        authService.getAllProfiles(),
        courseService.getAll()
      ]);
      setUsers(profilesRes.data || []);
      setCourses(coursesRes.data || []);
      setError('');
    } catch (err) {
      console.error('Error loading management data:', err);
      setError('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    setUpdating(prev => ({ ...prev, [userId]: true }));
    try {
      await authService.updateProfile(userId, updates);
      // Update local state
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, ...updates } : user
      ));
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, ...updates });
      }
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user: ' + err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [userId]: false }));
    }
  };

  const toggleCourseAssignment = async (courseId) => {
    if (!selectedUser) return;

    const currentCourses = selectedUser.assigned_courses || [];
    const isAssigned = currentCourses.includes(courseId);

    let newCourses;
    if (isAssigned) {
      newCourses = currentCourses.filter(id => id !== courseId);
    } else {
      newCourses = [...currentCourses, courseId];
    }

    await handleUpdateUser(selectedUser.id, { assigned_courses: newCourses });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center">
          <SafeIcon icon={FiLoader} className="w-8 h-8 animate-spin text-blue-600" />
          <p className="mt-2 text-gray-600 dark:text-gray-400 font-bold">Initializing command center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">User Authority</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Manage faculty approval, student roles, and course assignments</p>
        </div>
        <button
          onClick={loadData}
          className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-gray-600 dark:text-gray-300 shadow-sm"
        >
          <SafeIcon icon={FiRefreshCw} className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-2xl flex items-center gap-3">
          <SafeIcon icon={FiAlertCircle} className="w-5 h-5" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Identify</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Info</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Authority Role</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Compliance</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200 dark:shadow-none">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{user.name || 'Anonymous'}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{formatDate(user.created_at)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <SafeIcon icon={FiMail} className="text-gray-400 w-3 h-3" /> {user.email}
                      </div>
                      {user.mobile && <div className="text-[10px] font-black text-blue-500 uppercase mt-1">{user.mobile}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateUser(user.id, { role: e.target.value })}
                        disabled={updating[user.id]}
                        className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border-none focus:ring-2 focus:ring-blue-500 transition-all ${user.role === 'admin' ? 'bg-red-50 text-red-600 dark:bg-red-900/30' :
                          user.role === 'tutor' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30' :
                            'bg-blue-50 text-blue-600 dark:bg-blue-900/30'
                          }`}
                      >
                        <option value="student">Student</option>
                        <option value="tutor">Tutor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.role === 'tutor' ? (
                      <button
                        onClick={() => handleUpdateUser(user.id, { tutor_approved: !user.tutor_approved })}
                        disabled={updating[user.id]}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${user.tutor_approved
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                          : 'bg-red-50 text-red-600 dark:bg-red-900/20'
                          }`}
                      >
                        <SafeIcon icon={user.tutor_approved ? FiCheckCircle : FiAlertCircle} />
                        {user.tutor_approved ? 'Approved' : 'Pending'}
                      </button>
                    ) : (
                      <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => { setSelectedUser(user); setShowManageModal(true); }}
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                    >
                      <SafeIcon icon={FiSettings} className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Management Modal */}
      <AnimatePresence>
        {showManageModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManageModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-[32px] p-8 max-w-2xl w-full shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-100">
                    {selectedUser.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{selectedUser.name}</h3>
                    <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-widest">{selectedUser.role} Configuration</p>
                  </div>
                </div>
                <button onClick={() => setShowManageModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                  <SafeIcon icon={FiX} className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="space-y-8">
                {selectedUser.role === 'tutor' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                      <div>
                        <h4 className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest">Tutor Verification</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Approved tutors can view their assigned analytics and manage students.</p>
                      </div>
                      <button
                        onClick={() => handleUpdateUser(selectedUser.id, { tutor_approved: !selectedUser.tutor_approved })}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedUser.tutor_approved ? 'bg-green-600 text-white' : 'bg-red-600 text-white shadow-lg shadow-red-200'
                          }`}
                      >
                        {selectedUser.tutor_approved ? 'Revoke Approval' : 'Grant Approval'}
                      </button>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Course Assignment Matrix</h4>
                      {/* Courses Grid */}
                      {(loading && (!courses || courses.length === 0)) ? (
                        <div className="text-center py-12">
                          <SafeIcon icon={FiRefreshCw} className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                          <p className="mt-2 text-gray-500">Loading courses...</p>
                        </div>
                      ) : (!courses || courses.length === 0) ? (
                        <div className="p-8 text-center bg-gray-50 dark:bg-gray-900 rounded-[32px] border-2 border-dashed border-gray-100 dark:border-gray-800">
                          <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <SafeIcon icon={FiBook} className="w-8 h-8 text-gray-400" />
                          </div>
                          <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">No Courses Available</h4>
                          <p className="text-sm text-gray-500 font-medium mt-1">There are no courses to assign. Please create courses first.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                          {courses.map(course => {
                            const isAssigned = (selectedUser.assigned_courses || []).includes(course.id);
                            return (
                              <button
                                key={course.id}
                                onClick={() => toggleCourseAssignment(course.id)}
                                className={`p-4 rounded-[20px] transition-all flex items-center justify-between group border-2 ${isAssigned
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-sm'
                                  : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-gray-200'
                                  }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isAssigned ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-gray-200'}`}>
                                    <SafeIcon icon={FiBook} className="w-4 h-4" />
                                  </div>
                                  <div className="text-left">
                                    <p className={`text-xs font-black uppercase tracking-tight ${isAssigned ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>{course.name}</p>
                                    <p className="text-[9px] font-bold text-gray-400">ID: {course.id}</p>
                                  </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isAssigned ? 'bg-blue-500 scale-100' : 'bg-gray-100 dark:bg-gray-800 scale-90 opacity-0 group-hover:opacity-100'}`}>
                                  <SafeIcon icon={FiCheck} className="text-white w-3 h-3" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedUser.role !== 'tutor' && (
                  <div className="p-12 text-center bg-gray-50 dark:bg-gray-900 rounded-[32px] border-2 border-dashed border-gray-100 dark:border-gray-800">
                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <SafeIcon icon={FiUser} className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Standard Profile</h4>
                    <p className="text-sm text-gray-500 font-medium mt-1">This user has a basic role. Switch them to <span className="text-blue-600 font-bold">Tutor</span> to enable specialized course management features.</p>
                  </div>
                )}

                <button
                  onClick={() => setShowManageModal(false)}
                  className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <SafeIcon icon={FiCheckCircle} /> Ready to Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;