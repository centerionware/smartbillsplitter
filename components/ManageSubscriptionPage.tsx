import React, { useState } from 'react';
import type { RequestConfirmationFn } from '../App.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import { getApiUrl } from '../services/api.ts';

interface ManageSubscriptionPageProps {
  onBack: () => void;
  requestConfirmation: RequestConfirmationFn;
}

const ManageSubscriptionPage: React.FC<ManageSubscriptionPageProps> = ({ onBack, requestConfirmation }) => {
  const { subscriptionDetails, logout } = useAuth();
  const { showNotification } = useAppControl();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancelSubscription = () => {
    if (!subscriptionDetails) return;

    requestConfirmation(
      'Cancel Subscription?',
      'Are you sure you want to cancel your Pro subscription? This action is permanent and will take effect at the end of your current billing period.',
      async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(getApiUrl('/cancel-subscription'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: subscriptionDetails.provider,
              subscriptionId: subscriptionDetails.subscriptionId,
            }),
          });

          if (response.status !== 204 && response.status !== 200) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to cancel subscription. Status: ${response.status}`);
          }

          showNotification('Subscription cancelled successfully.');
          // Logging out clears local subscription data and returns user to the paywall.
          logout();

        } catch (err: any) {
          setError(err.message || 'An unknown error occurred.');
        } finally {
          setIsLoading(false);
        }
      },
      { confirmText: 'Yes, Cancel', confirmVariant: 'danger' }
    );
  };
  
  const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-slate-700">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{value}</dd>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Settings
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200 mb-2">Manage Subscription</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">View your current subscription details or cancel your plan.</p>

        {subscriptionDetails ? (
          <dl>
            <DetailItem label="Plan" value={`${subscriptionDetails.duration} Pro`} />
            <DetailItem label="Provider" value={subscriptionDetails.provider} />
            <DetailItem label="Start Date" value={new Date(subscriptionDetails.startDate).toLocaleDateString()} />
          </dl>
        ) : (
          <p className="text-center text-slate-500 dark:text-slate-400 py-8">No subscription details found.</p>
        )}
        
        {error && (
            <div className="mt-6 p-3 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/40 dark:text-red-300" role="alert">
               <span className="font-medium">Oops!</span> {error}
            </div>
        )}

        <div className="mt-8">
            <button
              onClick={handleCancelSubscription}
              disabled={isLoading || !subscriptionDetails}
              className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors duration-300 flex items-center justify-center gap-2 disabled:bg-slate-400 dark:disabled:bg-slate-600"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>Cancelling...</span>
                </>
              ) : (
                <span>Cancel Subscription</span>
              )}
            </button>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
              You will retain Pro access until the end of your current billing period.
            </p>
        </div>
      </div>
    </div>
  );
};

export default ManageSubscriptionPage;
