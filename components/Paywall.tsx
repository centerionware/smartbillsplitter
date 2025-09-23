import React, { useState } from 'react';

interface PaywallProps {
  onSelectFreeTier: () => void;
  initialError?: string;
}

const Paywall: React.FC<PaywallProps> = ({ onSelectFreeTier, initialError }) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError || null);

  const handleCheckout = async (plan: 'monthly' | 'yearly') => {
    setError(null);
    setIsLoading(plan);

    try {
        const origin = window.location.origin;

        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, origin }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create a checkout session.');
        }

        if (data.url) {
            // Redirect the user to the Stripe-hosted checkout page.
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL returned from the server.');
        }

    } catch (err: any) {
        console.error('Checkout error:', err);
        setError(err.message || 'An unknown error occurred. Please try again.');
        setIsLoading(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, plan: 'monthly' | 'yearly') => {
    if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
      e.preventDefault();
      handleCheckout(plan);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center items-center mb-6">
          <svg className="h-12 w-12 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 ml-3">SharedBills</h1>
        </div>

        <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-2">Upgrade to Pro</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          Remove all ads and support future development.
        </p>

        {error && (
           <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/40 dark:text-red-300" role="alert">
              <span className="font-medium">Error:</span> {error}
           </div>
        )}

        <div className="space-y-4 mb-8">
          {/* Monthly Plan */}
          <div
            onClick={() => !isLoading && handleCheckout('monthly')}
            onKeyDown={(e) => handleKeyDown(e, 'monthly')}
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
            onClick={() => !isLoading && handleCheckout('yearly')}
            onKeyDown={(e) => handleKeyDown(e, 'yearly')}
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
        
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Payment processing is handled securely by Stripe.
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