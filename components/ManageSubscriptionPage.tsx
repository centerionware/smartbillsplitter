import React, { useState, useEffect, useCallback } from 'react';
import type { RequestConfirmationFn, PayPalSubscriptionDetails } from '../types.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import { getApiUrl, fetchWithRetry } from '../services/api.ts';
import { useSubscriptionManager } from '../hooks/useSubscriptionManager.ts';

interface ManageSubscriptionPageProps {
  onBack: () => void;
  requestConfirmation: RequestConfirmationFn;
}

const ManageSubscriptionPage: React.FC<ManageSubscriptionPageProps> = ({ onBack, requestConfirmation }) => {
  const { subscriptionDetails, logout } = useAuth();
  const { showNotification } = useAppControl();
  const { managedSubscriptions, addSubscription, removeSubscription, isLoading: isManagerLoading } = useSubscriptionManager(subscriptionDetails);
  
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newSubId, setNewSubId] = useState('');

  const handleCancelSubscription = (subId: string) => {
    if (!subscriptionDetails) return;

    requestConfirmation(
      'Cancel Subscription?',
      `Are you sure you want to cancel subscription ${subId}? This action is permanent.`,
      async () => {
        setIsCancelling(subId);
        try {
          const response = await fetchWithRetry(await getApiUrl('/cancel-subscription'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'paypal',
              subscriptionId: subId,
            }),
          });

          if (response.status !== 204 && response.status !== 200) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to cancel subscription. Status: ${response.status}`);
          }
          
          showNotification('Subscription cancelled successfully.');

          if (subId === subscriptionDetails.subscriptionId) {
            logout();
          } else {
            removeSubscription(subId);
          }
        } catch (err: any) {
          showNotification(err.message || 'An unknown error occurred.', 'error');
        } finally {
          setIsCancelling(null);
        }
      },
      { confirmText: 'Yes, Cancel', confirmVariant: 'danger' }
    );
  };
  
  const handleAddSubscription = async () => {
      const idToAdd = newSubId.trim();
      if (!idToAdd) return;
      if (managedSubscriptions.some(s => s.id === idToAdd)) {
          setAddError("This subscription has already been added.");
          return;
      }

      setIsAdding(true);
      setAddError(null);
      try {
        const details = await addSubscription(idToAdd);
        showNotification(`Successfully added subscription ${details.id}.`);
        setNewSubId('');
      } catch (err: any) {
          setAddError(err.message);
      } finally {
          setIsAdding(false);
      }
  };

  const SubscriptionCard: React.FC<{ sub: PayPalSubscriptionDetails }> = ({ sub }) => (
    <div className={`p-4 rounded-lg border-2 ${sub.isCurrentDevice ? 'bg-teal-50 dark:bg-teal-900/40 border-teal-500/50' : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700'}`}>
      {sub.isCurrentDevice && <p className="text-xs font-bold text-teal-600 dark:text-teal-400 mb-2">CURRENT DEVICE</p>}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <p className="font-mono text-sm text-slate-500 dark:text-slate-400 break-all">{sub.id}</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100 capitalize">{sub.plan} Plan &bull; Started {new Date(sub.startTime).toLocaleDateString()}</p>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => handleCancelSubscription(sub.id)}
            disabled={!!isCancelling}
            className="px-4 py-2 bg-red-600 text-white font-semibold text-sm rounded-lg hover:bg-red-700 disabled:bg-slate-400"
          >
            {isCancelling === sub.id ? 'Cancelling...' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        Back to Settings
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200 mb-2">Manage PayPal Subscriptions</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">View and cancel any active subscriptions linked to your PayPal account for this app.</p>
        
        {isManagerLoading ? (
            <p className="text-center p-8">Loading subscriptions...</p>
        ) : (
            <div className="space-y-4">
              {managedSubscriptions.map(sub => <SubscriptionCard key={sub.id} sub={sub} />)}
            </div>
        )}
        
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Link Another Subscription</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                If you have other active subscriptions (e.g., from another device), you can add them here to manage them. You can find your Subscription ID (starts with "I-...") in your PayPal account under "Automatic Payments".
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                 <input
                    type="text"
                    value={newSubId}
                    onChange={(e) => setNewSubId(e.target.value)}
                    placeholder="Enter Subscription ID (I-...)"
                    className="flex-grow w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    onClick={handleAddSubscription}
                    disabled={isAdding || !newSubId.trim()}
                    className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 disabled:bg-slate-400"
                  >
                    {isAdding ? 'Verifying...' : 'Add'}
                  </button>
            </div>
            {addError && <p className="text-sm text-red-500 mt-2">{addError}</p>}
        </div>
      </div>
    </div>
  );
};

export default ManageSubscriptionPage;
