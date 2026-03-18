import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

// Modern Toggle Switch Component
const ToggleSwitch = ({ enabled, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    onClick={() => !disabled && onChange(!enabled)}
    disabled={disabled}
    className={`
      relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent
      transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
      focus-visible:ring-blue-600 focus-visible:ring-white focus-visible:ring-opacity-75
      ${enabled ? 'bg-blue-600' : 'bg-gray-300'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500'}
    `}
  >
    <span
      aria-hidden="true"
      className={`
        pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0
        transition duration-200 ease-in-out
        ${enabled ? 'translate-x-5' : 'translate-x-0'}
      `}
    />
  </button>
);

// Channel Card Component
const ChannelCard = ({ icon, title, description, enabled, onToggle, disabled, color }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl opacity-75 group-hover:opacity-100 transition duration-200"></div>
      <div className="relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white shadow-lg`}>
            {icon}
          </div>
          <ToggleSwitch enabled={enabled} onChange={onToggle} disabled={disabled} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
        
        {/* Status indicator */}
        <div className="mt-4 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
          <span className={`text-xs font-medium ${enabled ? 'text-green-600' : 'text-gray-400'}`}>
            {enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Notification Type Card Component
const NotificationTypeCard = ({ title, description, icon, enabled, onToggle, disabled }) => (
  <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200 border border-gray-200 hover:border-gray-300">
    <div className="flex items-center gap-4 flex-1">
      <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-gray-700 shadow-sm">
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
    <ToggleSwitch enabled={enabled} onChange={onToggle} disabled={disabled} />
  </div>
);

const NotificationPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    email: true,
    sms: true,
    whatsapp: false,
    testCompletion: true,
    weeklyProgress: true,
    testDueDate: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  useEffect(() => {
    if (user?.id) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/notifications/preferences/${user.id}`);
      const data = await response.json();
      
      if (data.success) {
        setPreferences(data.preferences);
      } else {
        handleMessage('Failed to load preferences', 'error');
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      setMessage('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPreferences) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/notifications/preferences/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences: newPreferences })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPreferences(newPreferences);
        handleMessage('Preferences updated successfully!', 'success');
      } else {
        handleMessage('Failed to update preferences', 'error');
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      handleMessage('Failed to update preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePreferenceChange = (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    updatePreferences(newPreferences);
  };

  const handleMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Notification Preferences</h1>
        </div>
        <p className="text-gray-600 ml-13">Customize how you receive updates and alerts</p>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl border-l-4 shadow-sm animate-fade-in ${
          messageType === 'success' 
            ? 'bg-green-50 border-green-500 text-green-700' 
            : 'bg-red-50 border-red-500 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            {messageType === 'success' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-medium">{message}</span>
          </div>
        </div>
      )}

      {/* Communication Channels Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          Communication Channels
        </h2>
        <p className="text-sm text-gray-600 mb-6">Choose which channels to receive notifications through</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ChannelCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            title="Email"
            description="Receive detailed notifications via email with full test reports and progress summaries"
            enabled={preferences.email}
            onToggle={(val) => handlePreferenceChange('email', val)}
            disabled={saving}
            color="blue"
          />

          <ChannelCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
            title="SMS"
            description="Get instant text messages for urgent alerts and quick updates"
            enabled={preferences.sms}
            onToggle={(val) => handlePreferenceChange('sms', val)}
            disabled={saving}
            color="green"
          />

          <ChannelCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            }
            title="WhatsApp"
            description="Receive notifications directly in WhatsApp with rich media content"
            enabled={preferences.whatsapp}
            onToggle={(val) => handlePreferenceChange('whatsapp', val)}
            disabled={saving}
            color="purple"
          />
        </div>
      </div>

      {/* Notification Types Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Notification Types
        </h2>
        <p className="text-sm text-gray-600 mb-6">Select which types of notifications you want to receive</p>
        
        <div className="space-y-4">
          <NotificationTypeCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Test Completion Notifications"
            description="Receive instant notifications when you complete a test with scores and performance analysis"
            enabled={preferences.testCompletion}
            onToggle={(val) => handlePreferenceChange('testCompletion', val)}
            disabled={saving}
          />

          <NotificationTypeCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="Weekly Progress Reports"
            description="Get comprehensive weekly summaries of your performance, improvements, and areas to focus on"
            enabled={preferences.weeklyProgress}
            onToggle={(val) => handlePreferenceChange('weeklyProgress', val)}
            disabled={saving}
          />

          <NotificationTypeCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Test Due Date Reminders"
            description="Receive timely reminders before your tests are due (7 days, 3 days, and 1 day before deadline)"
            enabled={preferences.testDueDate}
            onToggle={(val) => handlePreferenceChange('testDueDate', val)}
            disabled={saving}
          />
        </div>
      </div>

      {/* Saving Indicator */}
      {saving && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-2xl p-4 border-l-4 border-blue-500 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="font-medium text-gray-700">Saving your preferences...</span>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default NotificationPreferences;
