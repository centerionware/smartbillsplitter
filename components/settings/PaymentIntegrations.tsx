import React from 'react';
import type { Settings } from '../../types';

interface PaymentIntegrationsProps {
  settings: Settings;
  onPaymentDetailsChange: (newDetails: Partial<Settings['paymentDetails']>) => void;
}

const PaymentIntegrations: React.FC<PaymentIntegrationsProps> = ({ settings, onPaymentDetailsChange }) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onPaymentDetailsChange({ [e.target.name]: e.target.value });
  };
  
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="venmo" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Venmo Username</label>
        <input id="venmo" name="venmo" type="text" value={settings.paymentDetails.venmo} onChange={handleChange} placeholder="e.g., Jane-Doe-1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
      </div>
       <div>
        <label htmlFor="paypal" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">PayPal.Me Link or Email</label>
        <input id="paypal" name="paypal" type="text" value={settings.paymentDetails.paypal} onChange={handleChange} placeholder="e.g., paypal.me/janedoe or email@example.com" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
      </div>
       <div>
        <label htmlFor="cashApp" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Cash App $Cashtag</label>
        <input id="cashApp" name="cashApp" type="text" value={settings.paymentDetails.cashApp} onChange={handleChange} placeholder="e.g., $janedoe" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
      </div>
       <div>
        <label htmlFor="zelle" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Zelle (Phone or Email)</label>
        <input id="zelle" name="zelle" type="text" value={settings.paymentDetails.zelle} onChange={handleChange} placeholder="e.g., 555-123-4567" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
      </div>
      <div>
        <label htmlFor="customMessage" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Custom Payment Message</label>
        <textarea id="customMessage" name="customMessage" value={settings.paymentDetails.customMessage} onChange={handleChange} rows={3} placeholder="e.g., Or pay me back in person!" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
      </div>
    </div>
  );
};

export default PaymentIntegrations;
