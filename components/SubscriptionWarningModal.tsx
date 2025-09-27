import React, { useState, useEffect } from 'react';

interface SubscriptionWarningModalProps {
  onContinue: () => void;
  onCancel: () => void;
}

const SubscriptionWarningModal: React.FC<SubscriptionWarningModalProps> = ({ onContinue, onCancel }) => {
  const [countdown, setCountdown] = useState(7);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  return (
    <div
      className="fixed inset-0 bg-slate-900 bg-opacity-80 z-50 flex justify-center items-center p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      onClick={onCancel}
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-8" onClick={e => e.stopPropagation()}>
        <h2 id="dialog-title" className="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center mb-4">
          A Quick Heads-Up Before You Subscribe
        </h2>
        
        <div id="dialog-description" className="space-y-4 text-slate-600 dark:text-slate-300">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">1. Privacy First: Your Subscription is Tied to This Device</h3>
                <p className="text-sm mt-1">For your privacy, this app stores everything locally. Your subscription is tied *only* to this device. If you lose it, you won't be able to manage your subscription as there is no traditional "account recovery" login.</p>
            </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">2. Fighting "Zombie" Subscriptions</h3>
                <p className="text-sm mt-1">To prevent you from being charged for an unused subscription if you lose your device, the app occasionally pings our server to mark your account "active." If you stop using the app, we can automatically cancel it for you.</p>
            </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">3. A Note from the Developer</h3>
                <p className="text-sm mt-1">This is a one-man show, and I'm doing my best (with a little help from my algorithm friends) to build a useful and fair app. Thanks for your support!</p>
            </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-end sm:space-x-4 gap-3 sm:gap-0">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto order-2 sm:order-1 px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            disabled={countdown > 0}
            className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 font-bold rounded-lg transition-colors bg-teal-500 text-white hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `Please Read... (${countdown}s)` : 'Continue to Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionWarningModal;
