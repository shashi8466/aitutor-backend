import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useSettings } from '../../contexts/SettingsContext';
import { settingsService } from '../../services/api';

const {
  FiSave, FiImage, FiType, FiCheck, FiAlertCircle, FiLoader,
  FiUpload, FiX, FiCreditCard, FiMail, FiMessageSquare, FiCpu,
  FiKey, FiChevronRight, FiShield, FiGlobe, FiSmartphone
} = FiIcons;

const AdminSettings = () => {
  const { settings, updateSettings, refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Public Settings State
  const [generalData, setGeneralData] = useState({
    appName: '',
    logoFile: null
  });
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Advanced Settings State
  const [advancedData, setAdvancedData] = useState({
    payment_config: { enabled: false, provider: 'stripe', public_key: '', secret_key: '' },
    email_config: { enabled: false, host: '', port: '', user: '', pass: '', from_email: '' },
    sms_config: { enabled: false, provider: 'twilio', account_sid: '', auth_token: '', from_number: '' },
    api_config: { openai_key: '', gemini_key: '', other_integrations: [] }
  });

  useEffect(() => {
    loadAllSettings();
  }, [settings]);

  const loadAllSettings = async () => {
    if (settings) {
      setGeneralData({
        appName: settings.appName || '',
        logoFile: null
      });
      setPreviewUrl(settings.logoUrl);
    }

    try {
      const { data, error } = await settingsService.getAdvanced();
      if (data) {
        setAdvancedData({
          payment_config: data.payment_config || advancedData.payment_config,
          email_config: data.email_config || advancedData.email_config,
          sms_config: data.sms_config || advancedData.sms_config,
          api_config: data.api_config || advancedData.api_config
        });
      }
    } catch (err) {
      console.error("Failed to load advanced settings:", err);
    }
  };

  const handleGeneralChange = (e) => {
    setGeneralData({ ...generalData, [e.target.name]: e.target.value });
  };

  const handleAdvancedChange = (section, field, value) => {
    setAdvancedData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setStatus({ type: 'error', message: 'Logo file too large. Max 2MB.' });
        return;
      }
      setGeneralData({ ...generalData, logoFile: file });
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      // 1. Update Public Settings
      await updateSettings(generalData.appName, generalData.logoFile);

      // 2. Update Advanced Settings
      const { error } = await settingsService.updateAdvanced(advancedData);
      if (error) throw error;

      setStatus({ type: 'success', message: 'All settings updated successfully!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 5000);
      refreshSettings();
    } catch (error) {
      console.error("Failed to update settings:", error);
      setStatus({ type: 'error', message: 'Failed to update settings. ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: FiGlobe, description: 'App name & Branding' },
    { id: 'payment', label: 'Payments', icon: FiCreditCard, description: 'Stripe & PayPal keys' },
    { id: 'notifications', label: 'Notifications', icon: FiMail, description: 'SMTP & SMS gateways' },
    { id: 'integrations', label: 'Integrations', icon: FiCpu, description: 'AI & Third-party APIs' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white">Admin Settings</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Configure your platform’s identity and infrastructure</p>
        </div>

        <button
          onClick={saveSettings}
          disabled={loading}
          className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2"
        >
          {loading ? <SafeIcon icon={FiLoader} className="animate-spin" /> : <SafeIcon icon={FiSave} />}
          {loading ? 'Saving Changes...' : 'Save All Changes'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar / Mobile Tabs */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-2 lg:gap-1 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 lg:w-full flex items-center gap-3 lg:gap-4 p-3 lg:p-4 rounded-xl lg:rounded-2xl transition-all group ${activeTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 lg:border-none'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                  }`}
              >
                <div className={`p-2 rounded-xl transition-colors ${activeTab === tab.id ? 'bg-white dark:bg-gray-800 shadow-sm' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                  <SafeIcon icon={tab.icon} className="w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-xs lg:text-sm whitespace-nowrap">{tab.label}</div>
                  <div className="hidden lg:block text-[10px] opacity-60 uppercase font-black tracking-widest">{tab.id}</div>
                </div>
                <SafeIcon icon={FiChevronRight} className={`ml-auto w-4 h-4 transition-transform hidden lg:block ${activeTab === tab.id ? 'rotate-90' : 'opacity-0'}`} />
              </button>
            ))}
          </div>

          {status.message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-6 p-4 rounded-2xl flex items-center gap-3 border ${status.type === 'success'
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                }`}
            >
              <SafeIcon icon={status.type === 'success' ? FiCheck : FiAlertCircle} className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-bold">{status.message}</p>
            </motion.div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-[600px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
            >
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="p-8 space-y-8">
                  <SectionHeader title="Application Identity" icon={FiGlobe} color="blue" />

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-2">Application Name</label>
                      <input
                        type="text"
                        name="appName"
                        value={generalData.appName}
                        onChange={handleGeneralChange}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-gray-900 dark:text-white shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-4">Branding Logo</label>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-3xl p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center gap-6">
                        <div className="w-32 h-32 bg-white dark:bg-gray-900 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden border border-gray-100 dark:border-gray-800 p-4">
                          {previewUrl ? (
                            <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Logo" />
                          ) : (
                            <SafeIcon icon={FiImage} className="w-10 h-10 text-gray-300" />
                          )}
                        </div>
                        <div className="text-center">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-2 rounded-xl font-bold shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-600"
                          >
                            Upload New Logo
                          </button>
                          <p className="text-xs text-gray-400 mt-2">Max 2MB. SVG, PNG or JPG preferred.</p>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Settings */}
              {activeTab === 'payment' && (
                <div className="p-8 space-y-8">
                  <SectionHeader title="Payment Gateway" icon={FiCreditCard} color="indigo" />

                  <ToggleSection
                    label="Enable Payments"
                    enabled={advancedData.payment_config.enabled}
                    onToggle={(val) => handleAdvancedChange('payment_config', 'enabled', val)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <ConfigInput
                      label="Public Key"
                      value={advancedData.payment_config.public_key}
                      onChange={(val) => handleAdvancedChange('payment_config', 'public_key', val)}
                      placeholder="pk_test_..."
                    />
                    <ConfigInput
                      label="Secret Key"
                      value={advancedData.payment_config.secret_key}
                      onChange={(val) => handleAdvancedChange('payment_config', 'secret_key', val)}
                      placeholder="sk_test_..."
                      type="password"
                    />
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl flex gap-3 text-amber-700 dark:text-amber-400">
                    <SafeIcon icon={FiAlertCircle} className="w-5 h-5 flex-shrink-0" />
                    <p className="text-xs font-bold leading-relaxed">Ensure your keys correspond to the correct environment (Test vs Live). Using test keys will not charge real money.</p>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeTab === 'notifications' && (
                <div className="p-8 space-y-10">
                  <div className="space-y-6">
                    <SectionHeader title="Email Notification (SMTP)" icon={FiMail} color="emerald" />
                    <ToggleSection
                      label="Enable Emails"
                      enabled={advancedData.email_config.enabled}
                      onToggle={(val) => handleAdvancedChange('email_config', 'enabled', val)}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <ConfigInput label="Host" value={advancedData.email_config.host} onChange={(val) => handleAdvancedChange('email_config', 'host', val)} placeholder="smtp.gmail.com" />
                      <ConfigInput label="Port" value={advancedData.email_config.port} onChange={(val) => handleAdvancedChange('email_config', 'port', val)} placeholder="587" />
                      <ConfigInput label="Sender Email" value={advancedData.email_config.from_email} onChange={(val) => handleAdvancedChange('email_config', 'from_email', val)} placeholder="no-reply@edu.com" />
                      <ConfigInput label="User" value={advancedData.email_config.user} onChange={(val) => handleAdvancedChange('email_config', 'user', val)} placeholder="username" />
                      <ConfigInput label="Password" value={advancedData.email_config.pass} onChange={(val) => handleAdvancedChange('email_config', 'pass', val)} type="password" />
                    </div>
                  </div>

                  <hr className="border-gray-100 dark:border-gray-800" />

                  <div className="space-y-6">
                    <SectionHeader title="SMS Gateway (Twilio)" icon={FiSmartphone} color="orange" />
                    <ToggleSection
                      label="Enable SMS"
                      enabled={advancedData.sms_config.enabled}
                      onToggle={(val) => handleAdvancedChange('sms_config', 'enabled', val)}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ConfigInput label="Account SID" value={advancedData.sms_config.account_sid} onChange={(val) => handleAdvancedChange('sms_config', 'account_sid', val)} />
                      <ConfigInput label="Auth Token" value={advancedData.sms_config.auth_token} onChange={(val) => handleAdvancedChange('sms_config', 'auth_token', val)} type="password" />
                      <ConfigInput label="From Number" value={advancedData.sms_config.from_number} onChange={(val) => handleAdvancedChange('sms_config', 'from_number', val)} placeholder="+123456789" />
                    </div>
                  </div>
                </div>
              )}

              {/* Integration Settings */}
              {activeTab === 'integrations' && (
                <div className="p-8 space-y-8">
                  <SectionHeader title="AI & Third-party Integrations" icon={FiKey} color="purple" />

                  <div className="space-y-8">
                    <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-3xl border border-purple-100 dark:border-purple-900/30">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                          <SafeIcon icon={FiCpu} className="w-6 h-6 text-purple-600" />
                        </div>
                        <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-wider">AI Provider Credentials</h4>
                      </div>

                      <div className="space-y-6">
                        <ConfigInput
                          label="OpenAI API Key"
                          value={advancedData.api_config.openai_key}
                          onChange={(val) => handleAdvancedChange('api_config', 'openai_key', val)}
                          type="password"
                          placeholder="sk-..."
                        />
                        <ConfigInput
                          label="Google Gemini Key"
                          value={advancedData.api_config.gemini_key}
                          onChange={(val) => handleAdvancedChange('api_config', 'gemini_key', val)}
                          type="password"
                          placeholder="AIza..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const SectionHeader = ({ title, icon, color }) => (
  <div className="flex items-center gap-4 mb-2">
    <div className={`p-3 rounded-2xl bg-${color}-50 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400`}>
      <SafeIcon icon={icon} className="w-6 h-6" />
    </div>
    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{title}</h3>
  </div>
);

const ConfigInput = ({ label, value, onChange, placeholder = '', type = 'text' }) => (
  <div>
    <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-5 py-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-gray-700 dark:text-white shadow-sm"
    />
  </div>
);

const ToggleSection = ({ label, enabled, onToggle }) => (
  <div className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-800 rounded-[28px] border border-gray-100 dark:border-gray-700">
    <div>
      <h4 className="font-bold text-gray-900 dark:text-white">{label}</h4>
      <p className="text-xs text-gray-400 font-medium">Toggle service visibility and functionality</p>
    </div>
    <button
      onClick={() => onToggle(!enabled)}
      className={`w-14 h-8 rounded-full transition-all relative ${enabled ? 'bg-blue-600 shadow-lg shadow-blue-200 dark:shadow-none' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <div className={`absolute top-1 bottom-1 w-6 bg-white rounded-full transition-all ${enabled ? 'left-7' : 'left-1 shadow-sm'}`} />
    </button>
  </div>
);

export default AdminSettings;