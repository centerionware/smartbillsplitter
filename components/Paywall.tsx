import React, { useState, useEffect } from 'react';

interface PaywallProps {
  onLogin: () => void;
  onSelectFreeTier: () => void;
  initialError?: string;
}

// --- IMPORTANT ---
// You must create Stripe Payment Links and configure them correctly.
// 1. Go to your Stripe Dashboard -> Products.
// 2. Create a payment link for each product.
// 3. In the link's "Advanced options", set the confirmation page to redirect to your app's URL
//    with `?session_id={CHECKOUT_SESSION_ID}` appended.
// 4. Paste the final generated URLs below.
const MONTHLY_PLAN_PAYMENT_LINK = 'https://buy.stripe.com/test_bJe00j34BbdkfAOa9m6sw00';
const YEARLY_PLAN_PAYMENT_LINK = 'https://buy.stripe.com/test_7sY6oHcFb6X42O2ftG6sw01';


const Paywall: React.FC<PaywallProps> = ({ onLogin, onSelectFreeTier, initialError }) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError || null);

  // If an initial error is passed, ensure it's displayed on mount.
  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const handleCheckout = (planIdentifier: string, paymentLinkUrl: string) => {
    setError(null);

    // A valid Payment Link URL from Stripe always starts with "https://buy.stripe.com/".
    if (!paymentLinkUrl || !paymentLinkUrl.startsWith('https://buy.stripe.com/')) {
      setError(`This plan has not been configured. Please paste a valid Stripe Payment Link URL in the code.`);
      return;
    }

    setIsLoading(planIdentifier);

    // Open the checkout page in a new tab. This is crucial for iframe compatibility.
    window.open(paymentLinkUrl, '_blank');

    // Because we open a new tab, we can't know when the user is done.
    // We'll remove the loading spinner after a short delay to allow the user to
    // try the other link if they close the new tab.
    setTimeout(() => {
        setIsLoading(null);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, planIdentifier: string, paymentLinkUrl: string) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
      e.preventDefault();
      handleCheckout(planIdentifier, paymentLinkUrl);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center items-center mb-6">
          <svg className="h-12 w-12 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 ml-3">Smart Bill Splitter</h1>
        </div>

        <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-2">Upgrade to Pro</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          Select a plan to open the secure checkout page in a new tab.
        </p>

        {error && (
           <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/40 dark:text-red-300" role="alert">
              <span className="font-medium">Error:</span> {error}
           </div>
        )}

        <div className="space-y-4 mb-8">
          {/* Monthly Plan */}
          <div
            onClick={() => !isLoading && handleCheckout('monthly', MONTHLY_PLAN_PAYMENT_LINK)}
            onKeyDown={(e) => handleKeyDown(e, 'monthly', MONTHLY_PLAN_PAYMENT_LINK)}
            role="button"
            tabIndex={isLoading ? -1 : 0}
            className={`p-5 border border-slate-200 dark:border-slate-700 rounded-lg text-left flex items-center transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:border-teal-600 dark:hover:border-teal-500 hover:-translate-y-1'}`}
            aria-disabled={!!isLoading}
          >
            <div className="flex-grow">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Monthly Plan</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Billed every month.</p>
            </div>
            {isLoading === 'monthly' ? (
                 <svg className="animate-spin h-6 w-6 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">$1<span className="text-base font-normal text-slate-500 dark:text-slate-400">/mo</span></div>
            )}
          </div>
          {/* Yearly Plan */}
          <div
            onClick={() => !isLoading && handleCheckout('yearly', YEARLY_PLAN_PAYMENT_LINK)}
            onKeyDown={(e) => handleKeyDown(e, 'yearly', YEARLY_PLAN_PAYMENT_LINK)}
            role="button"
            tabIndex={isLoading ? -1 : 0}
            className={`relative p-5 border-2 rounded-lg text-left flex items-center transition-all duration-300 ${isLoading ? 'opacity-50 cursor-not-allowed border-slate-300 dark:border-slate-600' : 'cursor-pointer hover:shadow-lg hover:-translate-y-1 border-teal-500'}`}
             aria-disabled={!!isLoading}
          >
             <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-xs font-semibold px-3 py-1 rounded-full">BEST VALUE</div>
            <div className="flex-grow">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Yearly Plan</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Save 17% with annual billing.</p>
            </div>
             {isLoading === 'yearly' ? (
                 <svg className="animate-spin h-6 w-6 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">$10<span className="text-base font-normal text-slate-500 dark:text-slate-400">/yr</span></div>
            )}
          </div>
        </div>
        
        <p className="mt-6 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Already have a subscription? </span>
            <button
              onClick={onLogin}
              className="font-semibold text-teal-600 dark:text-teal-400 hover:underline"
            >
              Sign In
            </button>
        </p>

        <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-300 dark:border-slate-600" />
            </div>
            <div className="relative flex justify-center">
                <span className="bg-white dark:bg-slate-800 px-2 text-sm text-slate-500 dark:text-slate-400">OR</span>
            </div>
        </div>

        <button
            onClick={onSelectFreeTier}
            className="w-full text-center text-teal-600 dark:text-teal-400 font-semibold hover:underline"
        >
            Continue with the free, ad-supported version
        </button>

      </div>
    </div>
  );
};

export default Paywall;