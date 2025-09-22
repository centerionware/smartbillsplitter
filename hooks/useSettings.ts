import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types.ts';
import * as dbService from '../services/dbService.ts';

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>({ paymentDetails: {} });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await dbService.getSettings();
        setSettings(storedSettings);
      } catch (error) {
        console.error("Failed to load settings from IndexedDB:", error);
      }
    };
    loadSettings();
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    const updatedSettings = {
      ...settings,
      ...newSettings,
      paymentDetails: {
        ...settings.paymentDetails,
        ...(newSettings.paymentDetails || {}),
      }
    };
    
    try {
        await dbService.updateSettings(updatedSettings);
        setSettings(updatedSettings);
    } catch (error) {
        console.error("Failed to save settings to IndexedDB:", error);
    }
  }, [settings]);

  return { settings, updateSettings };
};
