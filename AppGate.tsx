import React, { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.ts';
import App from './App.tsx';
import Paywall from './components/Paywall.tsx';

const AppGate: React.FC = () => {
  const { subscriptionStatus, login, selectFreeTier } = useAuth();
  // We use a loading state to prevent a flicker while we check the URL.
  const [isCheckingUrl, setIsCheckingUrl] = useState(true);

  useEffect(() => {
    const checkUrlForPaymentSuccess = () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('payment') && urlParams.get('payment') === 'success') {
        login();
        // Clean up the URL to prevent re-triggering on refresh.
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setIsCheckingUrl(false);
    };

    checkUrlForPaymentSuccess();
  }, [login]);

  // While checking the URL, show a simple loading state.
  if (isCheckingUrl) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <svg className="animate-spin h-10 w-10 text-teal-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <h1 className="text-2xl font-semibold text-slate-700 dark:text-slate-200">Loading...</h1>
      </div>
    );
  }

  // If status is null, user hasn't made a choice. Show paywall.
  if (!subscriptionStatus) {
    return <Paywall onLogin={login} onSelectFreeTier={selectFreeTier} />;
  }

  // If status is 'subscribed' or 'free', show the app.
  return <App />;
};

export default AppGate;