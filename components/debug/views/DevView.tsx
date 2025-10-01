import React from 'react';
import { useAuth } from '../../../hooks/useAuth';

export const DevView: React.FC = () => {
  const { subscriptionStatus, subscriptionDetails, login, selectFreeTier, logout, startTrial } = useAuth();

  const handleSetFree = () => {
    selectFreeTier();
  };

  const handleSetPro = () => {
    // A mock pro subscription
    login({
      provider: 'paypal',
      duration: 'yearly',
      customerId: 'dev-pro-user',
      subscriptionId: 'dev-pro-sub',
    });
  };
  
  const handleSetTrial = () => {
    // First logout to clear any existing state, then start trial
    logout();
    // A small delay to ensure logout completes before trial starts
    setTimeout(() => {
        startTrial();
    }, 100);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="p-4 text-slate-300">
      <h3 className="font-bold text-lg mb-4 text-slate-100">Auth State Override</h3>
      <div className="space-y-4">
        <p>Current Status: <span className="font-bold text-teal-400">{subscriptionStatus || 'None (Paywall)'}</span></p>
        <div className="flex flex-wrap gap-4">
            <button onClick={handleSetPro} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md">Set to Pro</button>
            <button onClick={handleSetFree} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md">Set to Free (Ads)</button>
            <button onClick={handleSetTrial} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md">Reset to Trial</button>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-800/80 hover:bg-red-700/80 rounded-md">Logout (Show Paywall)</button>
        </div>
        {subscriptionDetails && (
            <div className="mt-4 text-xs">
                <p>Details:</p>
                <pre className="bg-slate-900 p-2 rounded mt-1 whitespace-pre-wrap">{JSON.stringify(subscriptionDetails, null, 2)}</pre>
            </div>
        )}
      </div>
    </div>
  );
};
