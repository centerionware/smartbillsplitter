import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEY = 'smart-bill-splitter-subscription-status';

export type SubscriptionStatus = 'subscribed' | 'free' | null;
type SubscriptionDuration = 'monthly' | 'yearly';
type SubscriptionData = {
  status: 'subscribed';
  activatedAt: number;
  duration: SubscriptionDuration;
} | {
  status: 'free';
};

interface AuthContextType {
  subscriptionStatus: SubscriptionStatus;
  expirationDate: Date | null;
  login: (duration: SubscriptionDuration) => void;
  selectFreeTier: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getSubscriptionFromStorage = (): SubscriptionData | null => {
    try {
      const storedValue = localStorage.getItem(STORAGE_KEY);
      if (!storedValue) return null;

      // Handle new JSON format first
      if (storedValue.startsWith('{')) {
          const data = JSON.parse(storedValue) as SubscriptionData;

          if (data.status === 'free') {
              return { status: 'free' };
          }

          if (data.status === 'subscribed' && data.activatedAt && data.duration) {
              const MONTH_DURATION_MS = 31 * 24 * 60 * 60 * 1000;
              const YEAR_DURATION_MS = 366 * 24 * 60 * 60 * 1000;
              
              const durationMs = data.duration === 'yearly' ? YEAR_DURATION_MS : MONTH_DURATION_MS;
              const expirationTimestamp = data.activatedAt + durationMs;

              if (Date.now() > expirationTimestamp) {
                  localStorage.removeItem(STORAGE_KEY);
                  return null; // Expired
              }
              return data; // Valid subscription
          }
      }
      
      // Handle legacy string formats by treating them as expired/invalid
      if (storedValue === 'free' || storedValue === 'subscribed' || storedValue === 'true') {
        localStorage.removeItem(STORAGE_KEY); // Clean up legacy value
        return null;
      }

      return null;
    } catch (e) {
      console.error("Error reading subscription status:", e);
      // If anything fails, clear the invalid data.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (removeError) {
        console.error("Failed to remove invalid subscription data:", removeError);
      }
      return null;
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(getSubscriptionFromStorage);

  // This listener handles changes from other tabs.
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setSubscription(getSubscriptionFromStorage());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = useCallback((duration: SubscriptionDuration) => {
    try {
      const newSubscription: SubscriptionData = {
        status: 'subscribed',
        activatedAt: Date.now(),
        duration,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSubscription));
      setSubscription(newSubscription);
    } catch (error) {
      console.error("Failed to update subscription status in localStorage:", error);
    }
  }, []);

  const selectFreeTier = useCallback(() => {
     try {
      const freeSub: SubscriptionData = { status: 'free' };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(freeSub));
      setSubscription(freeSub);
    } catch (error) {
      console.error("Failed to update subscription status in localStorage:", error);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSubscription(null);
    } catch (error) {
      console.error("Failed to clear subscription status in localStorage:", error);
    }
  }, []);

  const subscriptionStatus = subscription?.status ?? null;
  
  let expirationDate: Date | null = null;
  if (subscription?.status === 'subscribed') {
      const MONTH_DURATION_MS = 31 * 24 * 60 * 60 * 1000;
      const YEAR_DURATION_MS = 366 * 24 * 60 * 60 * 1000;
      const durationMs = subscription.duration === 'yearly' ? YEAR_DURATION_MS : MONTH_DURATION_MS;
      expirationDate = new Date(subscription.activatedAt + durationMs);
  }

  const value = { subscriptionStatus, expirationDate, login, selectFreeTier, logout };

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
