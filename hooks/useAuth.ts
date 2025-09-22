import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSubscriptionStatus, saveSubscriptionStatus } from '../services/db.ts';

export type SubscriptionStatus = 'subscribed' | 'free' | null;

interface AuthContextType {
  subscriptionStatus: SubscriptionStatus;
  isLoading: boolean;
  login: () => void;
  selectFreeTier: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        setIsLoading(true);
        // FIX: The logic for handling legacy subscription status values (like 'true')
        // has been moved into the `getSubscriptionStatus` service function.
        // This simplifies the hook and centralizes data access logic.
        const storedStatus = await getSubscriptionStatus();
        setSubscriptionStatus(storedStatus);
      } catch (error) {
        console.error("Failed to load subscription status from DB:", error);
        setSubscriptionStatus(null); // Default to null on error
      } finally {
        setIsLoading(false);
      }
    };
    loadStatus();
  }, []);

  const login = useCallback(async () => {
    await saveSubscriptionStatus('subscribed');
    setSubscriptionStatus('subscribed');
  }, []);

  const selectFreeTier = useCallback(async () => {
    await saveSubscriptionStatus('free');
    setSubscriptionStatus('free');
  }, []);

  const logout = useCallback(async () => {
    await saveSubscriptionStatus(null);
    setSubscriptionStatus(null);
  }, []);

  const value = { subscriptionStatus, isLoading, login, selectFreeTier, logout };

  return React.createElement(AuthContext.Provider, { value: value }, children);
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};