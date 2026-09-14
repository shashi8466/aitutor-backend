import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';

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

// Shared table/stats/search UI for one role ('student' or 'parent') - the two roles previously
// had entirely separate page components with near-identical logic; this parameterizes over role
// so there's exactly one implementation of the notification-management behavior.
const ROLE_CONFIG = {
  student: {
    entityLabel: 'Student',
    entityLabelPlural: 'Students',
    accent: 'blue',
    iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    // Students have an admin-controlled status field - use it directly.
    isActive: (entity) => entity.status === 'active'
  },
  parent: {
    entityLabel: 'Parent',
    entityLabelPlural: 'Parents',
    accent: 'amber',
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    // Parents don't have a meaningful admin status field yet - fall back to "recently active or
    // has any notification channel configured" as a proxy, same heuristic the old standalone
    // parent page used.
    isActive: (entity) => {
      const hasConfigs = entity.notification_preferences?.email || entity.notification_preferences?.sms || entity.notification_preferences?.whatsapp;
      const isRecentlyActive = entity.last_active_at && new Date(entity.last_active_at).getTime() > (Date.now() - 90 * 24 * 60 * 60 * 1000);
      return isRecentlyActive || hasConfigs;
    }
  }
};

const ACCENT_CLASSES = {
  blue: { gradient: 'from-blue-500 to-blue-600' },
  amber: { gradient: 'from-amber-500 to-amber-600' }
};

const NotificationRoleManager = ({ role }) => {
  const { user } = useAuth();
  const config = ROLE_CONFIG[role];
  const accent = ACCENT_CLASSES[config.accent];

  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchEntities();
    }
  }, [user, role]);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      const { data } = await authService.getProfilesByRole(role, 500);
      setEntities(data || []);
    } catch (error) {
      console.error(`Error fetching ${role}s:`, error);
      showMessage('error', `Failed to load ${config.entityLabelPlural.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const updatePreferences = async (entityId, newPreferences) => {
    try {
      setSavingId(entityId);

      const { data } = await authService.updateProfile(entityId, {
        notification_preferences: newPreferences
      });

      if (data) {
        setEntities(prev => prev.map(e =>
          e.id === entityId
            ? { ...e, notification_preferences: newPreferences }
            : e
        ));
        showMessage('success', `Notification preferences updated for ${entities.find(e => e.id === entityId)?.name}`);
      } else {
        showMessage('error', 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      showMessage('error', 'Failed to update preferences');
    } finally {
      setSavingId(null);
    }
  };

  const handleTogglePreference = (entityId, key, value) => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;

    const newPreferences = {
      ...entity.notification_preferences,
      [key]: value
    };

    updatePreferences(entityId, newPreferences);
  };

  const handleBulkEnable = async (entityIds, enabled) => {
    try {
      setSavingId('bulk');

      const updates = entityIds.map(id => {
        const entity = entities.find(e => e.id === id);
        const currentPrefs = entity?.notification_preferences || {};
        const updatedPrefs = {
          ...currentPrefs,
          email: enabled,
          sms: enabled,
          whatsapp: enabled
        };
        return authService.updateProfile(id, { notification_preferences: updatedPrefs });
      });

      await Promise.all(updates);
      await fetchEntities();
      showMessage('success', `Notifications ${enabled ? 'enabled' : 'disabled'} for ${entityIds.length} ${config.entityLabelPlural.toLowerCase()}`);
    } catch (error) {
      console.error('Error updating bulk preferences:', error);
      showMessage('error', 'Failed to update bulk preferences');
    } finally {
      setSavingId(null);
    }
  };

  const filteredEntities = entities.filter(entity => {
    const matchesSearch = entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const isActive = config.isActive(entity);

    if (filterStatus === 'active') {
      return matchesSearch && isActive;
    } else if (filterStatus === 'inactive') {
      return matchesSearch && !isActive;
    }

    return matchesSearch;
  });

  const stats = {
    total: entities.length,
    active: entities.filter(e => config.isActive(e)).length,
    inactive: entities.filter(e => !config.isActive(e)).length,
    emailEnabled: entities.filter(e => e.notification_preferences?.email).length,
    smsEnabled: entities.filter(e => e.notification_preferences?.sms).length,
    whatsappEnabled: entities.filter(e => e.notification_preferences?.whatsapp).length
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {config.entityLabelPlural.toLowerCase()}...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.gradient} flex items-center justify-center text-white shadow-lg`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.iconPath} />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{config.entityLabel} Notification Management</h2>
            <p className="text-gray-600 text-sm">Manage notification settings for all {config.entityLabelPlural.toLowerCase()}</p>
          </div>
        </div>

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
          <div className="text-sm text-gray-600 mb-1">Total {config.entityLabelPlural}</div>
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
              <option value="all">All {config.entityLabelPlural}</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <button
              onClick={() => handleBulkEnable(filteredEntities.map(e => e.id), true)}
              disabled={savingId === 'bulk'}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={() => handleBulkEnable(filteredEntities.map(e => e.id), false)}
              disabled={savingId === 'bulk'}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Disable All
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{config.entityLabel}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SMS</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntities.map((entity) => (
                <tr key={entity.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className={`h-10 w-10 rounded-full bg-gradient-to-r ${accent.gradient} flex items-center justify-center text-white font-semibold`}>
                          {entity.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{entity.name}</div>
                        <div className="text-sm text-gray-500">{entity.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      config.isActive(entity)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {config.isActive(entity) ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ToggleSwitch
                      enabled={entity.notification_preferences?.email || false}
                      onChange={(val) => handleTogglePreference(entity.id, 'email', val)}
                      disabled={savingId === entity.id}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ToggleSwitch
                      enabled={entity.notification_preferences?.sms || false}
                      onChange={(val) => handleTogglePreference(entity.id, 'sms', val)}
                      disabled={savingId === entity.id}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ToggleSwitch
                      enabled={entity.notification_preferences?.whatsapp || false}
                      onChange={(val) => handleTogglePreference(entity.id, 'whatsapp', val)}
                      disabled={savingId === entity.id}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entity.last_active_at ? new Date(entity.last_active_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleBulkEnable([entity.id], !entity.notification_preferences?.email)}
                      disabled={savingId === entity.id}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                    >
                      {savingId === entity.id ? 'Saving...' : 'Quick Toggle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEntities.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2">No {config.entityLabelPlural.toLowerCase()} found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

const TABS = [
  { key: 'student', label: 'Student Notifications' },
  { key: 'parent', label: 'Parent Notifications' }
];

const AdminNotificationManager = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('student');

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600">Manage notification settings for students and parents</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <NotificationRoleManager role={activeTab} />

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

export default AdminNotificationManager;
