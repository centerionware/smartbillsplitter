import React, { useState } from 'react';
import { DisclaimerContent } from './DisclaimerContent.tsx';

interface PrivacyConsentProps {
  onAccept: () => void;
}

const PrivacyConsent: React.FC<PrivacyConsentProps> = ({ onAccept }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className={`w-full ${showDetails ? 'max-w-2xl' : 'max-w-md'} mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center transition-all duration-300`}>
        <div className="flex justify-center items-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 ml-3">Your Privacy</h1>
        </div>
        
        {showDetails ? (
            <>
                <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Data Privacy Details</h2>
                <div className="text-left max-h-[50vh] overflow-y-auto pr-4 mb-6 text-sm">
                    <DisclaimerContent />
                </div>
            </>
        ) : (
            <>
                <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
                This App Stores Data On Your Device
                </h2>
                <div className="text-slate-500 dark:text-slate-400 mb-8 text-left space-y-4">
                <p>
                    To function, SharedBills needs to store all your data (like bills, settings, and encryption keys) directly in your browser's private storage on this device.
                </p>
                <p>
                    This keeps your data private to you and off of our servers. By continuing, you acknowledge and consent to this local data storage.
                </p>
                </div>
            </>
        )}

        <div className="flex flex-col gap-4">
            <button
                onClick={onAccept}
                className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors"
                >
                Acknowledge & Continue
            </button>
             <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline"
            >
                {showDetails ? 'Hide Details' : 'Read Full Data Policy'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyConsent;