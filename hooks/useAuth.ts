import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSubscriptionStatus, getSubscriptionDetails, saveSubscriptionStatus, saveSubscriptionDetails, deleteSubscriptionDetails, SubscriptionDetails } from '../services/db.ts';

export type SubscriptionStatus = 'subscribed' | 'free' | null;
export type SubscriptionDuration = 'monthly' | 'yearly';

interface AuthContextType {
  subscriptionStatus: SubscriptionStatus;
  subscriptionDetails: SubscriptionDetails | null;
  isLoading: boolean;
  login: (details: Omit<SubscriptionDetails, 'startDate'>) => void;
  selectFreeTier: () => void;
  logout: () => void;
  startTrial: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedStatus = await getSubscriptionStatus();
      
      if (storedStatus) { // User has a real subscription or chose free tier
        setSubscriptionStatus(storedStatus);
        if (storedStatus === 'subscribed') {
          const details = await getSubscriptionDetails();
          setSubscriptionDetails(details || null);
        }
        localStorage.removeItem('trialStartTime'); // Clean up trial if a real status is set
      } else { // No subscription status set, check for trial.
        const trialStartTimeStr = localStorage.getItem('trialStartTime');
        if (trialStartTimeStr) {
          const trialStartTime = parseInt(trialStartTimeStr, 10);
          const trialDuration = 24 * 60 * 60 * 1000; // 24 hours
          const now = Date.now();

          if (now < trialStartTime + trialDuration) {
            // Trial is active
            setSubscriptionStatus('subscribed'); // Treat as pro user
            // Set mock details for pro features to work
            setSubscriptionDetails({
                provider: 'paypal', // placeholder, can be anything
                customerId: 'trial-user',
                subscriptionId: 'trial-active',
                startDate: new Date(trialStartTime).toISOString(),
                duration: 'yearly', // placeholder
            });
            // Re-check status when the trial is supposed to expire
            const timeRemaining = (trialStartTime + trialDuration) - now;
            setTimeout(() => {
              loadStatus();
            }, timeRemaining + 500); // add 500ms buffer
          } else {
            // Trial expired
            localStorage.removeItem('trialStartTime');
            setSubscriptionStatus(null);
            setSubscriptionDetails(null);
          }
        } else {
          // No subscription, no trial
          setSubscriptionStatus(null);
          setSubscriptionDetails(null);
        }
      }
    } catch (error) {
      console.error("Failed to load subscription status from DB:", error);
      setSubscriptionStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const login = useCallback(async (details: Omit<SubscriptionDetails, 'startDate'>) => {
    const fullDetails: SubscriptionDetails = {
        ...details,
        startDate: new Date().toISOString(),
    };
    await saveSubscriptionDetails(fullDetails);
    await saveSubscriptionStatus('subscribed');
    setSubscriptionDetails(fullDetails);
    setSubscriptionStatus('subscribed');
    localStorage.removeItem('trialStartTime'); // Clear trial on login
  }, []);

  const selectFreeTier = useCallback(async () => {
    // When selecting the free tier, ensure any paid subscription details are cleared.
    await deleteSubscriptionDetails();
    await saveSubscriptionStatus('free');
    setSubscriptionDetails(null);
    setSubscriptionStatus('free');
    localStorage.removeItem('trialStartTime'); // Clear trial on selecting free tier
  }, []);

  const logout = useCallback(async () => {
    // On logout, clear both the simple status and the detailed subscription info.
    await deleteSubscriptionDetails();
    await saveSubscriptionStatus(null);
    setSubscriptionDetails(null);
    setSubscriptionStatus(null);
  }, []);

  const startTrial = useCallback(async () => {
    const storedStatus = await getSubscriptionStatus();
    const trialStarted = localStorage.getItem('trialStartTime');
    if (!storedStatus && !trialStarted) {
        localStorage.setItem('trialStartTime', Date.now().toString());
        await loadStatus();
    }
  }, [loadStatus]);

  const value = { subscriptionStatus, subscriptionDetails, isLoading, login, selectFreeTier, logout, startTrial };

  return React.createElement(AuthContext.Provider, { value: value }, children);
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};