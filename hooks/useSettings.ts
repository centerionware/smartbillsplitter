import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';
import { getSettings, saveSettings } from '../services/db.ts';
import { postMessage, useBroadcastListener } from '../services/broadcastService';

const initialSettings: Settings = {
  paymentDetails: {
    venmo: '',
    paypal: '',
    cashApp: '',
    zelle: '',
    customMessage: '',
  },
  myDisplayName: '',
  shareTemplate: 'Hi {participantName}, this is a reminder for your outstanding bill(s). You owe a total of {totalOwed}.\n\nBreakdown:\n{billList}{paymentInfo}{promoText}',
  notificationsEnabled: false,
  notificationDays: 3,
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async (isInitialLoad: boolean = false) => {
    if (isInitialLoad) setIsLoading(true);
    try {
      let dbSettings = await getSettings();
      if (!dbSettings) {
        if (isInitialLoad) {
          await saveSettings(initialSettings);
        }
        dbSettings = initialSettings;
      } else {
        dbSettings = { ...initialSettings, ...dbSettings, paymentDetails: {...initialSettings.paymentDetails, ...dbSettings.paymentDetails} };
      }
      setSettings(dbSettings);
    } catch (error) {
      console.error("Failed to load settings from IndexedDB:", error);
      setSettings(initialSettings);
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadSettings(true);
  }, [loadSettings]);

  useBroadcastListener(useCallback(message => {
    if (message.type === 'settings-updated') {
      loadSettings(false);
    }
  }, [loadSettings]));

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    const updatedSettings: Settings = {
      ...settings,
      ...newSettings,
      paymentDetails: {
        ...settings.paymentDetails,
        ...(newSettings.paymentDetails || {}),
      }
    };
    await saveSettings(updatedSettings);
    postMessage({ type: 'settings-updated' });
    // Also update local state immediately for the current tab
    setSettings(updatedSettings);
  }, [settings]);

  return { settings, updateSettings, isLoading };
};
