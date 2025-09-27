import { useState, useEffect, useCallback } from 'react';
import type { PayPalSubscriptionDetails } from '../types';
import { getManagedPayPalSubscriptions, saveManagedPayPalSubscriptions } from '../services/db';
import { getApiUrl } from '../services/api';
import type { SubscriptionDetails } from '../services/db';

export const useSubscriptionManager = (currentDeviceSubscription: SubscriptionDetails | null) => {
  const [managedSubscriptions, setManagedSubscriptions] = useState<PayPalSubscriptionDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAndSetSubscriptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedSubs = await getManagedPayPalSubscriptions();
      const subsMap = new Map(storedSubs.map(s => [s.id, { ...s, isCurrentDevice: false }]));

      if (currentDeviceSubscription && currentDeviceSubscription.provider === 'paypal') {
        if (!subsMap.has(currentDeviceSubscription.subscriptionId)) {
          // If the current device's sub isn't stored, fetch its details.
          try {
            const response = await fetch(getApiUrl(`/paypal-subscription-details?id=${currentDeviceSubscription.subscriptionId}`));
            if (!response.ok) throw new Error('Could not verify current subscription.');
            const details = await response.json();
            subsMap.set(details.id, details);
          } catch (e) {
            console.error("Failed to fetch primary subscription details, it may have been cancelled:", e);
          }
        }
      }
      
      // Ensure the current device's subscription is marked correctly
      if (currentDeviceSubscription) {
          const current = subsMap.get(currentDeviceSubscription.subscriptionId);
          if (current) {
              subsMap.set(current.id, { ...current, isCurrentDevice: true });
          }
      }
      
      const allSubs = Array.from(subsMap.values()).sort((a, b) => (b.isCurrentDevice ? 1 : -1));
      setManagedSubscriptions(allSubs);
      await saveManagedPayPalSubscriptions(allSubs);

    } catch (err) {
      console.error("Failed to load managed subscriptions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentDeviceSubscription]);

  useEffect(() => {
    fetchAndSetSubscriptions();
  }, [fetchAndSetSubscriptions]);

  const addSubscription = useCallback(async (subscriptionId: string): Promise<PayPalSubscriptionDetails> => {
    const response = await fetch(getApiUrl(`/paypal-subscription-details?id=${subscriptionId}`));
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Could not find or verify this subscription ID.');
    }
    const details: PayPalSubscriptionDetails = await response.json();
    
    setManagedSubscriptions(prev => {
      const newSubs = [...prev.filter(s => s.id !== details.id), details];
      newSubs.sort((a, b) => (b.isCurrentDevice ? 1 : -1));
      saveManagedPayPalSubscriptions(newSubs);
      return newSubs;
    });
    return details;
  }, []);

  const removeSubscription = useCallback(async (subscriptionId: string) => {
    setManagedSubscriptions(prev => {
        const newSubs = prev.filter(s => s.id !== subscriptionId);
        saveManagedPayPalSubscriptions(newSubs);
        return newSubs;
    });
  }, []);

  return { managedSubscriptions, addSubscription, removeSubscription, isLoading };
};
