import React, { useState } from 'react';
import type { Settings } from '../types';

interface PaymentMethodWarningModalProps {
  onClose: () => void;
  onContinue: () => void;
  onAddMethods: () => void;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
}

const PaymentMethodWarningModal: React.FC<PaymentMethodWarningModalProps> = ({ onClose, onContinue, onAddMethods, onUpdateSettings }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleContinue = () => {
    if (dontShowAgain) {
      onUpdateSettings({ hidePaymentMethodWarning: true });
    }
    onContinue();
  };

  const handleAddMethods = () => {
    if (dontShowAgain) {
      onUpdateSettings({ hidePaymentMethodWarning: true });
    }
    onAddMethods();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-8" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center mb-4">
          Add Payment Methods?
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6 text-center">
          You haven't set up any payment methods. Adding them makes it easier for others to pay you back.
        </p>
        
        <div className="space-y-4">
           <button onClick={handleAddMethods} className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600">
            Add Payment Methods
          </button>
          <button onClick={handleContinue} className="w-full px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">
            Continue Anyway
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center">
          <input 
            id="dontShowAgain" 
            type="checkbox" 
            checked={dontShowAgain} 
            onChange={e => setDontShowAgain(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <label htmlFor="dontShowAgain" className="ml-2 text-sm text-slate-600 dark:text-slate-300">
            Don't show this warning again
          </label>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodWarningModal;
