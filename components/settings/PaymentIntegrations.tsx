import React from 'react';
import type { PaymentDetails } from '../../types.ts';

interface PaymentIntegrationsProps {
    paymentDetails: PaymentDetails;
    onPaymentDetailsChange: (field: keyof PaymentDetails, value: string) => void;
}

const PaymentIntegrations: React.FC<PaymentIntegrationsProps> = ({
    paymentDetails,
    onPaymentDetailsChange
}) => {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-semibold mb-3 text-slate-700 dark:text-slate-200">Payment Integrations</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Provide your details to generate payment links for others. We don't use OAuth, your info is just stored on your device.</p>
            </div>
            
            <div className="flex items-center gap-4">
                <img src="https://cdn.simpleicons.org/venmo/008CFF" alt="Venmo logo" className="h-8 w-8 object-contain"/>
                <div className="relative flex-grow">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">@</span>
                    <input id="venmo" type="text" value={paymentDetails.venmo || ''} onChange={(e) => onPaymentDetailsChange('venmo', e.target.value)} className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="your-username" />
                </div>
            </div>

             <div className="flex items-center gap-4">
                <img src="https://cdn.simpleicons.org/paypal/00457C" alt="PayPal logo" className="h-8 w-8 object-contain"/>
                 <input id="paypal" type="text" value={paymentDetails.paypal || ''} onChange={(e) => onPaymentDetailsChange('paypal', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="paypal.me/username or email" />
            </div>

             <div className="flex items-center gap-4">
                <img src="https://cdn.simpleicons.org/cashapp/00C246" alt="Cash App logo" className="h-8 w-8 object-contain"/>
                 <div className="relative flex-grow">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                    <input id="cashApp" type="text" value={paymentDetails.cashApp || ''} onChange={(e) => onPaymentDetailsChange('cashApp', e.target.value)} className="w-full pl-6 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="YourCashtag" />
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <img src="https://cdn.simpleicons.org/zelle/6D1AD8" alt="Zelle logo" className="h-8 w-8 object-contain"/>
                <input id="zelle" type="text" value={paymentDetails.zelle || ''} onChange={(e) => onPaymentDetailsChange('zelle', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Email or Phone for Zelle" />
            </div>

            <div>
                <label htmlFor="customMessage" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Custom Payment Note</label>
                <textarea id="customMessage" rows={3} value={paymentDetails.customMessage || ''} onChange={(e) => onPaymentDetailsChange('customMessage', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g., Cash is fine too!" />
            </div>
        </div>
    );
};

export default PaymentIntegrations;