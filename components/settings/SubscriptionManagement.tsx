import React from 'react';
import type { SubscriptionStatus } from '../../hooks/useAuth';
import { useAuth } from '../../hooks/useAuth.ts';

interface SubscriptionManagementProps {
    subscriptionStatus: SubscriptionStatus;
    onManageStripeSubscription: () => void;
    onGoToManagePayPalSubscription: () => void;
    isPortalLoading: boolean;
    portalError: string | null;
    onLogout: () => void;
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({
    subscriptionStatus,
    onManageStripeSubscription,
    onGoToManagePayPalSubscription,
    isPortalLoading,
    portalError,
    onLogout
}) => {
    const { subscriptionDetails } = useAuth();

    const handleManageClick = () => {
        if (subscriptionDetails?.provider === 'stripe') {
            onManageStripeSubscription();
        } else if (subscriptionDetails?.provider === 'paypal') {
            onGoToManagePayPalSubscription();
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Manage Subscription</h3>
            {subscriptionStatus === 'subscribed' ? (
                 <>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        You are a Pro subscriber. You can manage your subscription, update payment methods, and view your invoice history.
                    </p>
                     {portalError && (
                        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/40 dark:text-red-300" role="alert">
                           <span className="font-medium">Error:</span> {portalError}
                        </div>
                     )}
                    <button
                        onClick={handleManageClick}
                        disabled={isPortalLoading}
                        className="w-full bg-teal-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-600 transition-colors duration-300 flex items-center justify-center gap-2 disabled:bg-slate-400 dark:disabled:bg-slate-600"
                    >
                         {isPortalLoading ? (
                            <>
                               <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                               <span>Redirecting...</span>
                            </>
                         ) : (
                             <span>Manage Subscription</span>
                         )}
                    </button>
                 </>
            ) : (
                 <>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        You are currently on the free, ad-supported plan. Upgrade to Pro to remove ads.
                    </p>
                    <button
                        onClick={onLogout}
                        className="w-full bg-teal-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-600 transition-colors duration-300 flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        <span>Upgrade to Pro</span>
                    </button>
                 </>
            )}
        </div>
    );
};

export default SubscriptionManagement;