import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

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
        setMessage('Preferences updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      setMessage('Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handlePreferenceChange = (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    updatePreferences(newPreferences);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Notification Preferences</h2>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Email Notifications</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.email}
                onChange={(e) => handlePreferenceChange('email', e.target.checked)}
                disabled={saving}
              />
              <span>Enable email notifications</span>
            </label>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">SMS Notifications</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.sms}
                onChange={(e) => handlePreferenceChange('sms', e.target.checked)}
                disabled={saving}
              />
              <span>Enable SMS notifications</span>
            </label>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">WhatsApp Notifications</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.whatsapp}
                onChange={(e) => handlePreferenceChange('whatsapp', e.target.checked)}
                disabled={saving}
              />
              <span>Enable WhatsApp notifications</span>
            </label>
          </div>
        </div>

        {saving && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Saving preferences...
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPreferences;
