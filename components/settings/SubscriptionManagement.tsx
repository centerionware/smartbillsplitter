import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { View } from '../../types';

interface SubscriptionManagementProps {
  onNavigate: (view: View, params?: any) => void;
  onGoToManageSubscriptionPage: () => void;
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({ onNavigate, onGoToManageSubscriptionPage }) => {
  const { subscriptionStatus, subscriptionDetails, logout } = useAuth();
  
  const handleGoToPaywall = () => {
    // Logging out effectively sends the user to the paywall
    logout();
  };

  return (
    <div>
      {subscriptionStatus === 'subscribed' && subscriptionDetails ? (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/40 rounded-lg">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">You are a Pro Subscriber!</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">Thank you for your support.</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            {subscriptionDetails.customerId === 'trial-user' ? (
              'Status: Active (Free Trial)'
            ) : (
              `Status: Active (${subscriptionDetails.duration}) via ${subscriptionDetails.provider}`
            )}
          </p>
        </div>
      ) : (
        <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
           <p className="font-semibold text-slate-800 dark:text-slate-100">You are on the Free Plan</p>
           <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Enjoy the core features, supported by ads.</p>
        </div>
      )}
      
      <div className="mt-6 space-y-3">
        {subscriptionStatus === 'free' && (
            <button onClick={handleGoToPaywall} className="w-full px-6 py-3 bg-yellow-400 text-yellow-900 font-bold rounded-lg hover:bg-yellow-500">
                Upgrade to Pro
            </button>
        )}
        {subscriptionDetails?.provider === 'stripe' && (
             <button onClick={() => onNavigate(View.ManageSubscription)} className="w-full px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
                Manage Stripe Subscription
            </button>
        )}
        {subscriptionDetails?.provider === 'paypal' && (
             <button onClick={onGoToManageSubscriptionPage} className="w-full px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
                Manage PayPal Subscriptions In-App
            </button>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManagement;