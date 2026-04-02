import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';

const AdminNotificationManager = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStudents();
    }
  }, [user]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      // Fetch ONLY students (with limit to keep it fast)
      const { data } = await authService.getProfilesByRole('student', 500);
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      showMessage('error', 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const updateStudentPreferences = async (studentId, newPreferences) => {
    try {
      setSavingId(studentId);

      const { data } = await authService.updateProfile(studentId, {
        notification_preferences: newPreferences
      });

      if (data) {
        // Update local state
        setStudents(prev => prev.map(s => 
          s.id === studentId 
            ? { ...s, notification_preferences: newPreferences }
            : s
        ));
        showMessage('success', `Notification preferences updated for ${students.find(s => s.id === studentId)?.name}`);
      } else {
        showMessage('error', data?.error || 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating student preferences:', error);
      showMessage('error', 'Failed to update preferences');
    } finally {
      setSavingId(null);
    }
  };

  const handleTogglePreference = (studentId, key, value) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const newPreferences = {
      ...student.notification_preferences,
      [key]: value
    };
    
    updateStudentPreferences(studentId, newPreferences);
  };

  const handleBulkEnable = async (studentIds, enabled) => {
    try {
      setSavingId('bulk');

      // Update locally instead of hitting outdated backend
      const updates = studentIds.map(id => {
        const student = students.find(s => s.id === id);
        const currentPrefs = student?.notification_preferences || {};
        const updatedPrefs = {
          ...currentPrefs,
          email: enabled,
          sms: enabled,
          whatsapp: enabled
        };
        return authService.updateProfile(id, { notification_preferences: updatedPrefs });
      });

      await Promise.all(updates);
      await fetchStudents();
      showMessage('success', `Notifications ${enabled ? 'enabled' : 'disabled'} for ${studentIds.length} students`);
    } catch (error) {
      console.error('Error updating bulk preferences:', error);
      showMessage('error', 'Failed to update bulk preferences');
    } finally {
      setSavingId(null);
    }
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const hasConfigs = student.notification_preferences?.email || 
                      student.notification_preferences?.sms || 
                      student.notification_preferences?.whatsapp;
    
    // Use admin-controlled status, not login activity
    const isActive = student.status === 'active';

    if (filterStatus === 'active') {
      return matchesSearch && isActive;
    } else if (filterStatus === 'inactive') {
      return matchesSearch && !isActive;
    }
    
    return matchesSearch;
  });

  // Statistics
  const stats = {
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    inactive: students.filter(s => s.status === 'inactive').length,
    emailEnabled: students.filter(s => s.notification_preferences?.email).length,
    smsEnabled: students.filter(s => s.notification_preferences?.sms).length,
    whatsappEnabled: students.filter(s => s.notification_preferences?.whatsapp).length
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only administrators can access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Student Notification Management</h1>
              <p className="text-gray-600">Manage notification settings for all students</p>
            </div>
          </div>
        </div>

        {/* Success/Error Message */}
        {message.text && (
          <div className={`p-4 rounded-xl border-l-4 shadow-sm animate-fade-in ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-500 text-green-700' 
              : 'bg-red-50 border-red-500 text-red-700'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total Students</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Active</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Inactive</div>
          <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Email Enabled</div>
          <div className="text-2xl font-bold text-blue-600">{stats.emailEnabled}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">SMS Enabled</div>
          <div className="text-2xl font-bold text-purple-600">{stats.smsEnabled}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">WhatsApp Enabled</div>
          <div className="text-2xl font-bold text-indigo-600">{stats.whatsappEnabled}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Students</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <button
              onClick={() => handleBulkEnable(filteredStudents.map(s => s.id), true)}
              disabled={savingId === 'bulk'}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={() => handleBulkEnable(filteredStudents.map(s => s.id), false)}
              disabled={savingId === 'bulk'}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Disable All
            </button>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SMS</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      student.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {student.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ToggleSwitch
                      enabled={student.notification_preferences?.email || false}
                      onChange={(val) => handleTogglePreference(student.id, 'email', val)}
                      disabled={savingId === student.id}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ToggleSwitch
                      enabled={student.notification_preferences?.sms || false}
                      onChange={(val) => handleTogglePreference(student.id, 'sms', val)}
                      disabled={savingId === student.id}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ToggleSwitch
                      enabled={student.notification_preferences?.whatsapp || false}
                      onChange={(val) => handleTogglePreference(student.id, 'whatsapp', val)}
                      disabled={savingId === student.id}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.last_active_at ? new Date(student.last_active_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleBulkEnable([student.id], !student.notification_preferences?.email)}
                      disabled={savingId === student.id}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                    >
                      {savingId === student.id ? 'Saving...' : 'Quick Toggle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2">No students found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

// Toggle Switch Component
const ToggleSwitch = ({ enabled, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    onClick={() => !disabled && onChange(!enabled)}
    disabled={disabled}
    className={`
      relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
      transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
      focus-visible:ring-blue-600 focus-visible:ring-white focus-visible:ring-opacity-75
      ${enabled ? 'bg-blue-600' : 'bg-gray-300'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500'}
    `}
  >
    <span
      aria-hidden="true"
      className={`
        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0
        transition duration-200 ease-in-out
        ${enabled ? 'translate-x-5' : 'translate-x-0'}
      `}
    />
  </button>
);

export default AdminNotificationManager;
