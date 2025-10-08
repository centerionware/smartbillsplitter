import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';
import { getSettings, saveSettings, getCommunicationKeyPair, saveCommunicationKeyPair } from '../services/db';
import { generateSigningKeyPair } from '../services/cryptoService';
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
  hidePaymentMethodWarning: false,
  totalBudget: undefined,
  dashboardLayoutMode: 'card',
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
      
      if (isInitialLoad) {
          let commKeyPair = await getCommunicationKeyPair();
          if (!commKeyPair) {
              console.log("Communication key pair not found, generating a new one.");
              commKeyPair = await generateSigningKeyPair();
              await saveCommunicationKeyPair(commKeyPair);
          }
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
    // Use the async postMessage but don't wait for it
    postMessage({ type: 'settings-updated' });
    // Also update local state immediately for the current tab
    setSettings(updatedSettings);
  }, [settings]);

  return { settings, updateSettings, isLoading };
};