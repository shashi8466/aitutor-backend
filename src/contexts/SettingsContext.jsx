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
  const [settings, setSettings] = useState({
    appName: 'Pundits AI',
    logoUrl: null
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
          appName: data.app_name || 'Pundits AI',
          logoUrl: data.logo_url
        };
        setSettings(newSets);
        applySettings(newSets);
      }
    } catch (error) {
      console.error("Failed to load site settings:", error);
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
    }
    return data;
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};