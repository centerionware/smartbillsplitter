import React from 'react';
import type { PaymentDetails } from '../types.ts';

interface PaymentMethodsModalProps {
  paymentDetails: PaymentDetails;
  billDescription: string;
  amountOwed: number;
  creatorName: string;
  onClose: () => void;
}

const PaymentMethodsModal: React.FC<PaymentMethodsModalProps> = ({ paymentDetails, billDescription, amountOwed, creatorName, onClose }) => {
  
  const handlePaymentClick = (method: 'venmo' | 'paypal' | 'cashApp') => {
    const amount = amountOwed.toFixed(2);
    const note = encodeURIComponent(billDescription);
    let url = '';

    switch(method) {
        case 'venmo':
            // Venmo deep link for payment. Note: 'pay' is for personal, 'charge' for business.
            url = `venmo://paycharge?txn=pay&recipients=${paymentDetails.venmo}&amount=${amount}&note=${note}`;
            window.location.href = url;
            break;
        case 'paypal':
            // Sanitize input to handle full URLs or just usernames
            let paypalIdentifier = paymentDetails.paypal.trim();
            // Remove common prefixes to isolate the username/email
            paypalIdentifier = paypalIdentifier.replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, '');
            // Construct the correct PayPal.me URL
            url = `https://paypal.me/${paypalIdentifier}/${amount}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            break;
        case 'cashApp':
            // Cash App's $cashtag link. The format supports cashtag, amount, and an optional note.
            const cleanCashtag = paymentDetails.cashApp.trim().replace(/^\$+/, '');
            url = `https://cash.app/$${cleanCashtag}/${amount}`;
            // Add the note if it exists
            if (billDescription) {
                 url += `/${note}`;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
            break;
    }
  };

  const ActionButton: React.FC<{ logo: string; name: string; onClick: () => void }> = ({ logo, name, onClick }) => (
    <button onClick={onClick} className="w-full flex items-center gap-4 text-left p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
        <img src={logo} alt={`${name} logo`} className="h-8 w-8 object-contain"/>
        <span className="font-semibold text-slate-800 dark:text-slate-100">Pay with {name}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Settle up with {creatorName}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">You owe <span className="font-bold text-slate-700 dark:text-slate-200">${amountOwed.toFixed(2)}</span> for "{billDescription}".</p>
        </div>
        <div className="p-6 space-y-3 overflow-y-auto">
            {paymentDetails.venmo && <ActionButton logo="https://cdn.simpleicons.org/venmo/008CFF" name="Venmo" onClick={() => handlePaymentClick('venmo')} />}
            {paymentDetails.paypal && <ActionButton logo="https://cdn.simpleicons.org/paypal/00457C" name="PayPal" onClick={() => handlePaymentClick('paypal')} />}
            {paymentDetails.cashApp && <ActionButton logo="https://cdn.simpleicons.org/cashapp/00C246" name="Cash App" onClick={() => handlePaymentClick('cashApp')} />}
            {paymentDetails.zelle && (
                <div className="flex items-center gap-4 text-left p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <img src="https://cdn.simpleicons.org/zelle/6D1AD8" alt="Zelle logo" className="h-8 w-8 object-contain"/>
                    <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">Pay with Zelle</span>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Use this email/phone in your banking app: <span className="font-medium text-slate-700 dark:text-slate-200">{paymentDetails.zelle}</span></p>
                    </div>
                </div>
            )}
            {paymentDetails.customMessage && (
                 <div className="text-left p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">A Note from {creatorName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap mt-1">{paymentDetails.customMessage}</p>
                </div>
            )}
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <button
                onClick={onClose}
                className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
            >
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodsModal;
