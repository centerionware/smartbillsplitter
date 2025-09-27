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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        setIsLoading(true);
        // This function now contains all logic for checking expiration.
        const storedStatus = await getSubscriptionStatus();
        setSubscriptionStatus(storedStatus);
        if (storedStatus === 'subscribed') {
          const details = await getSubscriptionDetails();
          setSubscriptionDetails(details || null);
        }
      } catch (error) {
        console.error("Failed to load subscription status from DB:", error);
        setSubscriptionStatus(null); // Default to null on error
      } finally {
        setIsLoading(false);
      }
    };
    loadStatus();
  }, []);

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

  const logout = useCallback(async () => {
    // On logout, clear both the simple status and the detailed subscription info.
    await deleteSubscriptionDetails();
    await saveSubscriptionStatus(null);
    setSubscriptionDetails(null);
    setSubscriptionStatus(null);
  }, []);

  const value = { subscriptionStatus, subscriptionDetails, isLoading, login, selectFreeTier, logout };

  return React.createElement(AuthContext.Provider, { value: value }, children);
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};