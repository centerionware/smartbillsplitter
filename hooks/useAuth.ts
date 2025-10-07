import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSubscriptionStatus, getSubscriptionDetails, saveSubscriptionStatus, saveSubscriptionDetails, deleteSubscriptionDetails, SubscriptionDetails } from '../services/db';

export type SubscriptionStatus = 'subscribed' | 'free' | null;
export type SubscriptionDuration = 'monthly' | 'yearly';

export interface AuthContextType {
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

  // Define logout first to break potential dependency cycle with loadStatus
  const logout = useCallback(async () => {
    // On logout, clear both the simple status and the detailed subscription info.
    await deleteSubscriptionDetails();
    setSubscriptionDetails(null);
    setSubscriptionStatus(null);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedStatus = await getSubscriptionStatus();
      
      if (storedStatus) { // User has a real subscription or chose free tier
        setSubscriptionStatus(storedStatus);
        if (storedStatus === 'subscribed') {
          const details = await getSubscriptionDetails();
          
          if (details && details.customerId === 'trial-user') {
            // This is a trial subscription, check for expiry
            const trialStartTime = new Date(details.startDate).getTime();
            const trialDuration = 5 * 60 * 1000; // 5 minutes
            const now = Date.now();

            if (now < trialStartTime + trialDuration) {
              // Trial is active
              setSubscriptionDetails(details);
              // Re-check status when the trial is supposed to expire
              const timeRemaining = (trialStartTime + trialDuration) - now;
              setTimeout(() => {
                loadStatus();
              }, timeRemaining + 500); // add 500ms buffer
            } else {
              // Trial expired, log the user out
              await logout();
              return; // Stop further execution
            }
          } else if (details) {
            setSubscriptionDetails(details);
          } else {
            // Subscribed status without details? Anomaly. Log out.
            await logout();
            return;
          }
        }
      } else {
        // No subscription status set
        setSubscriptionStatus(null);
        setSubscriptionDetails(null);
      }
    } catch (error) {
      console.error("Failed to load subscription status from DB:", error);
      setSubscriptionStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

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
  }, []);

  const selectFreeTier = useCallback(async () => {
    // When selecting the free tier, ensure any paid subscription details are cleared.
    await deleteSubscriptionDetails();
    await saveSubscriptionStatus('free');
    setSubscriptionDetails(null);
    setSubscriptionStatus('free');
  }, []);
  
  const startTrial = useCallback(async () => {
    const storedStatus = await getSubscriptionStatus();
    const storedDetails = await getSubscriptionDetails();
    if (!storedStatus && !storedDetails) {
        const trialDetails: SubscriptionDetails = {
            provider: 'paypal', // placeholder
            customerId: 'trial-user',
            subscriptionId: 'trial-active',
            startDate: new Date().toISOString(),
            duration: 'yearly', // placeholder
        };
        await saveSubscriptionDetails(trialDetails);
        await saveSubscriptionStatus('subscribed');
        await loadStatus(); // This will set state and schedule expiry check
    }
  }, [loadStatus]);

  const value = { subscriptionStatus, subscriptionDetails, isLoading, login, selectFreeTier, logout, startTrial };

  // FIX: Reverted to React.createElement to resolve JSX parsing errors in a .ts file. The previous use of JSX was causing build errors because the file extension is .ts, not .tsx.
  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};