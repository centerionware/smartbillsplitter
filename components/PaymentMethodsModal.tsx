import React, { useState } from 'react';
import type { PaymentDetails } from '../types';

interface PaymentMethodsModalProps {
  paymentDetails: PaymentDetails;
  billDescription: string;
  amountOwed: number;
  creatorName: string;
  onClose: () => void;
}

type PaymentMethod = 'venmo' | 'paypal' | 'cashApp' | 'zelle';

const PaymentMethodsModal: React.FC<PaymentMethodsModalProps> = ({ paymentDetails, billDescription, amountOwed, creatorName, onClose }) => {
  const [activeMethod, setActiveMethod] = useState<PaymentMethod | null>(null);

  const handleLaunchApp = (method: PaymentMethod) => {
    const amount = amountOwed.toFixed(2);
    const note = encodeURIComponent(billDescription);
    let url = '';

    switch(method) {
        case 'venmo':
            const venmoID = paymentDetails.venmo.trim();
            url = `venmo://paycharge?txn=pay&recipients=${venmoID}&amount=${amount}&note=${note}`;
            window.location.href = url;
            break;
        case 'paypal':
            let paypalIdentifier = paymentDetails.paypal.trim();
            if (paypalIdentifier.includes('@')) {
                // It's an email address
                url = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(paypalIdentifier)}&amount=${amount}&item_name=${note}&currency_code=USD`;
            } else {
                // Assume it's a PayPal.me username
                paypalIdentifier = paypalIdentifier.replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, '');
                url = `https://paypal.me/${paypalIdentifier}/${amount}`;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
            break;
        case 'cashApp':
            const cleanCashtag = paymentDetails.cashApp.trim().replace(/^\$/, '');
            url = `https://cash.app/$${cleanCashtag}/${amount}?note=${note}`;
            window.open(url, '_blank', 'noopener,noreferrer');
            break;
        case 'zelle':
            // Zelle does not have a universal deep link, so we don't launch anything.
            break;
    }
  };

  // FIX: Explicitly cast string literals to the `PaymentMethod` type to resolve TypeScript error where 'string' is not assignable to the specific union type.
  const methods: { id: PaymentMethod; name: string; logo: string; info: string | null }[] = [
    { id: 'venmo' as PaymentMethod, name: 'Venmo', logo: 'https://cdn.simpleicons.org/venmo/008CFF', info: paymentDetails.venmo },
    { id: 'paypal' as PaymentMethod, name: 'PayPal', logo: 'https://cdn.simpleicons.org/paypal/00457C', info: paymentDetails.paypal },
    { id: 'cashApp' as PaymentMethod, name: 'Cash App', logo: 'https://cdn.simpleicons.org/cashapp/00C246', info: paymentDetails.cashApp },
    { id: 'zelle' as PaymentMethod, name: 'Zelle', logo: 'https://cdn.simpleicons.org/zelle/6D1AD8', info: paymentDetails.zelle }
  ].filter(method => method.info && method.info.trim() !== '');

  const ActionButton: React.FC<{ logo: string; name: string; onClick: () => void }> = ({ logo, name, onClick }) => (
    <button onClick={onClick} className="w-full flex items-center gap-4 text-left p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
        <img src={logo} alt={`${name} logo`} className="h-8 w-8 object-contain"/>
        <span className="font-semibold text-slate-800 dark:text-slate-100">Pay with {name}</span>
    </button>
  );

  const renderMainView = () => (
    <div className="space-y-3">
        {methods.map(method => (
            <ActionButton key={method.id} logo={method.logo} name={method.name} onClick={() => setActiveMethod(method.id)} />
        ))}
        {paymentDetails.customMessage && (
             <div className="text-left p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                <p className="font-semibold text-slate-800 dark:text-slate-100">A Note from {creatorName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap mt-1">{paymentDetails.customMessage}</p>
            </div>
        )}
    </div>
  );
  
  const renderDetailView = () => {
    const method = methods.find(m => m.id === activeMethod);
    if (!method) return null;

    return (
        <div>
            <button onClick={() => setActiveMethod(null)} className="flex items-center gap-2 mb-4 text-teal-600 dark:text-teal-400 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Back
            </button>
            <div className="p-6 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-center">
                <img src={method.logo} alt={`${method.name} logo`} className="h-12 w-12 object-contain mx-auto mb-4"/>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {method.id === 'zelle' ? `Use this email/phone in your banking app to pay with Zelle:` : `You are about to pay ${creatorName} using ${method.name}.`}
                </p>
                <p className="font-mono text-lg font-semibold my-2 p-2 bg-slate-200 dark:bg-slate-600 rounded break-all">{method.info}</p>
                {method.id !== 'zelle' &&
                    <button onClick={() => handleLaunchApp(method.id)} className="w-full mt-4 px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">
                        Launch App
                    </button>
                }
            </div>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Settle up with {creatorName}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">You owe <span className="font-bold text-slate-700 dark:text-slate-200">${amountOwed.toFixed(2)}</span> for "{billDescription}".</p>
        </div>
        <div className="p-6 flex-grow overflow-y-auto">
            {activeMethod ? renderDetailView() : renderMainView()}
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end flex-shrink-0">
            <button onClick={onClose} className="px-5 py-2 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodsModal;