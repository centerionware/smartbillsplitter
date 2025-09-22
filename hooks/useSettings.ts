import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types.ts';
import { getSettings, saveSettings } from '../services/db.ts';

const initialSettings: Settings = {
  paymentDetails: {
    venmo: '',
    paypal: '',
    cashApp: '',
    zelle: '',
    customMessage: '',
  },
  myDisplayName: 'Myself',
  shareTemplate: 'Hi {participantName}, this is a reminder for your outstanding bill(s). You owe a total of {totalOwed}.\n\nBreakdown:\n{billList}{paymentInfo}{promoText}',
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        let dbSettings = await getSettings();
        if (!dbSettings) {
          // If no settings in DB, save and use initial settings.
          await saveSettings(initialSettings);
          dbSettings = initialSettings;
        } else {
          // Merge saved settings with defaults to handle new fields
          dbSettings = { ...initialSettings, ...dbSettings, paymentDetails: {...initialSettings.paymentDetails, ...dbSettings.paymentDetails} };
        }
        setSettings(dbSettings);
      } catch (error) {
        console.error("Failed to load settings from IndexedDB:", error);
        // Fallback to initial settings on error
        setSettings(initialSettings);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

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
    setSettings(updatedSettings);
  }, [settings]);

  return { settings, updateSettings, isLoading };
};
