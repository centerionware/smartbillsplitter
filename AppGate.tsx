import React, { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.ts';
import App from './App.tsx';
import Paywall from './components/Paywall.tsx';

const AppGate: React.FC = () => {
  const { subscriptionStatus, login, selectFreeTier, isLoading: isAuthLoading } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    // This effect handles the redirect from a successful Stripe checkout.
    const verifyServerSidePayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');

      if (sessionId) {
        setIsVerifying(true);
        setVerificationError(null);
        try {
          const response = await fetch('/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to verify payment session.');
          }

          if (data.status === 'success') {
            login({
              duration: data.duration,
              customerId: data.customerId,
              subscriptionId: data.subscriptionId,
            });
          } else {
             throw new Error('Payment verification was not successful.');
          }

        } catch (error: any) {
          console.error("Payment verification failed:", error);
          setVerificationError(error.message);
        } finally {
          // Clean up the URL to prevent re-triggering on refresh.
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsVerifying(false);
        }
      }
    };

    verifyServerSidePayment();
  }, [login]);

  // While checking auth status or verifying payment, show a loading state.
  if (isAuthLoading || isVerifying) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <svg className="animate-spin h-10 w-10 text-teal-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <h1 className="text-2xl font-semibold text-slate-700 dark:text-slate-200">
          {isVerifying ? 'Verifying your payment...' : 'Loading...'}
        </h1>
      </div>
    );
  }

  // If status is null, user hasn't made a choice or subscription expired. Show paywall.
  if (!subscriptionStatus) {
    return <Paywall onSelectFreeTier={selectFreeTier} initialError={verificationError} />;
  }

  // If status is 'subscribed' or 'free', show the app.
  return <App />;
};

export default AppGate;