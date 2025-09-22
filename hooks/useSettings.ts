import { useState, useEffect } from 'react';
import type { Settings } from '../types';

const STORAGE_KEY = 'smart-bill-splitter-settings';

const initialSettings: Settings = {
  paymentDetails: {
    venmo: '',
    paypal: '',
    cashApp: '',
    zelle: '',
    customMessage: '',
  }
};

const loadSettingsFromStorage = (): Settings => {
  try {
    const storedSettings = localStorage.getItem(STORAGE_KEY);
    if (storedSettings) {
      // Merge with initial settings to ensure all keys are present
      const parsed = JSON.parse(storedSettings);
      return {
        ...initialSettings,
        ...parsed,
        paymentDetails: {
            ...initialSettings.paymentDetails,
            ...(parsed.paymentDetails || {}),
        }
      };
    }
  } catch (error) {
    console.error("Failed to parse settings from localStorage:", error);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialSettings));
  return initialSettings;
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(loadSettingsFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings,
      paymentDetails: {
        ...prevSettings.paymentDetails,
        ...(newSettings.paymentDetails || {}),
      }
    }));
  };

  return { settings, updateSettings };
};