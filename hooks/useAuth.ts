import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEY = 'smart-bill-splitter-subscription-status';

export type SubscriptionStatus = 'subscribed' | 'free' | null;

interface AuthContextType {
  subscriptionStatus: SubscriptionStatus;
  login: () => void;
  selectFreeTier: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStatusFromStorage = (): SubscriptionStatus => {
    try {
      const storedStatus = localStorage.getItem(STORAGE_KEY);
      // Handle legacy 'true' value for subscribed users
      if (storedStatus === 'true' || storedStatus === 'subscribed') {
        return 'subscribed';
      }
      if (storedStatus === 'free') {
        return 'free';
      }
      return null;
    } catch {
      return null;
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(getStatusFromStorage);

  // This listener handles changes from other tabs.
  useEffect(() => {
    const handleStorageChange = () => {
        setSubscriptionStatus(getStatusFromStorage());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'subscribed');
      setSubscriptionStatus('subscribed');
    } catch (error) {
      console.error("Failed to update subscription status in localStorage:", error);
    }
  }, []);

  const selectFreeTier = useCallback(() => {
     try {
      localStorage.setItem(STORAGE_KEY, 'free');
      setSubscriptionStatus('free');
    } catch (error) {
      console.error("Failed to update subscription status in localStorage:", error);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSubscriptionStatus(null);
    } catch (error) {
      console.error("Failed to clear subscription status in localStorage:", error);
    }
  }, []);

  const value = { subscriptionStatus, login, selectFreeTier, logout };

  // FIX: Replaced JSX with React.createElement to be compatible with .ts file extension.
  // The original JSX was causing a TypeScript parsing error.
  return React.createElement(AuthContext.Provider, { value: value }, children);
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};