import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsService } from '../services/api';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const cached = localStorage.getItem('site_settings');
    return cached ? JSON.parse(cached) : {
      appName: 'AIPrep365',
      logoUrl: null
    };
  });
  const [loading, setLoading] = useState(true);

  const applySettings = (configs) => {
    if (configs.appName) document.title = configs.appName;
    if (configs.logoUrl) {
      let fav = document.querySelector('link[rel="icon"]');
      if (!fav) {
        fav = document.createElement('link');
        fav.rel = 'icon';
        document.head.appendChild(fav);
      }
      fav.href = configs.logoUrl;
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await settingsService.get();
      if (data) {
        const newSets = {
          appName: data.app_name || 'AIPrep365',
          logoUrl: data.logo_url
        };
        setSettings(newSets);
        applySettings(newSets);
        localStorage.setItem('site_settings', JSON.stringify(newSets));
      }
    } catch (error) {
      console.error("Failed to load site settings:", error);
      // If we have cached settings, apply them anyway
      if (settings) applySettings(settings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (name, logoFile) => {
    const { data } = await settingsService.update(name, logoFile);
    if (data) {
      const newSets = {
        appName: data.app_name,
        logoUrl: data.logo_url
      };
      setSettings(newSets);
      applySettings(newSets);
      localStorage.setItem('site_settings', JSON.stringify(newSets));
    }
    return data;
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};