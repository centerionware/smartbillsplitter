import React from 'react';
import type { Bill, Participant, Settings } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';

interface BillDetailsProps {
  bill: Bill;
  settings: Settings;
  onUpdateBill: (bill: Bill) => void;
  onBack: () => void;
  subscriptionStatus: SubscriptionStatus;
}

const BillDetails: React.FC<BillDetailsProps> = ({ bill, settings, onUpdateBill, onBack, subscriptionStatus }) => {
  const togglePaidStatus = (participantId: string) => {
    const updatedParticipants = bill.participants.map(p =>
      p.id === participantId ? { ...p, paid: !p.paid } : p
    );
    onUpdateBill({ ...bill, participants: updatedParticipants });
  };

  const handleShare = async (participant: Participant) => {
    if (!navigator.share) {
      alert("Sharing is not supported on this browser.");
      return;
    }

    try {
      const { paymentDetails } = settings;
      let paymentInfo = '';
      const paymentMethods = [];
      if (paymentDetails.venmo) paymentMethods.push(`Venmo: @${paymentDetails.venmo}`);
      if (paymentDetails.paypal) paymentMethods.push(`PayPal: ${paymentDetails.paypal}`);
      if (paymentDetails.cashApp) paymentMethods.push(`Cash App: $${paymentDetails.cashApp}`);
      if (paymentDetails.zelle) paymentMethods.push(`Zelle: ${paymentDetails.zelle}`);

      if (paymentMethods.length > 0) {
        paymentInfo = `\n\nYou can pay me via ${paymentMethods.join(' or ')}.`;
      }
      
      if (paymentDetails.customMessage) {
        // If there's already payment info, add a new line. Otherwise, start the section.
        paymentInfo += paymentInfo ? `\n\n${paymentDetails.customMessage}` : `\n\n${paymentDetails.customMessage}`;
      }

      let promoText = '';
      if (subscriptionStatus === 'free') {
        let appUrl = 'https://sharedbills.app'; // Default URL
        try {
          const constructedUrl = new URL('/', window.location.href).href;
          // Clean up trailing slash if present.
          appUrl = constructedUrl.endsWith('/') ? constructedUrl.slice(0, -1) : constructedUrl;
        } catch (e) {
          console.warn("Could not determine app URL from context due to sandboxing, defaulting to sharedbills.app", e);
          // appUrl is already set to the default, so no action is needed here.
        }
        promoText = `\n\nCreated with Smart Bill Splitter: ${appUrl}`;
      }

      const shareData = {
        title: 'Bill Split Reminder',
        text: `Hi ${participant.name}, this is a reminder that you owe $${participant.amountOwed.toFixed(2)} for "${bill.description}".${paymentInfo}${promoText}`,
      };
      await navigator.share(shareData);
    } catch (err: any) {
      // The user canceling the share dialog is expected behavior, not an error.
      // We'll ignore the AbortError that's thrown in that case.
      if (err.name !== 'AbortError') {
        console.error("Error sharing:", err);
      }
    }
  };

  const totalPaid = bill.participants
    .filter(p => p.paid)
    .reduce((sum, p) => sum + p.amountOwed, 0);

  const remainingAmount = bill.totalAmount - totalPaid;
  const progressPercentage = bill.totalAmount > 0 ? (totalPaid / bill.totalAmount) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Dashboard
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{bill.description}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{new Date(bill.date).toLocaleDateString()}</p>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 mt-4 md:mt-0">
            ${bill.totalAmount.toFixed(2)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 mb-8">
            <div className="flex justify-between mb-1 text-sm font-medium">
                <span className="text-slate-600 dark:text-slate-300">Total Paid: ${totalPaid.toFixed(2)}</span>
                <span className="text-slate-600 dark:text-slate-300">Remaining: ${remainingAmount.toFixed(2)}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                <div className="bg-teal-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
            </div>
        </div>
        

        {/* Participants List */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">Participants</h3>
          <ul className="space-y-3">
            {bill.participants.map(p => (
              <li key={p.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex-wrap gap-2">
                <div className="flex-grow">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">${p.amountOwed.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                   {!p.paid && typeof navigator.share !== 'undefined' && (
                    <button
                      onClick={() => handleShare(p)}
                      title="Share reminder"
                      className="p-2 rounded-full font-semibold text-sm transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500"
                      aria-label={`Share with ${p.name}`}
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
                        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => togglePaidStatus(p.id)}
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-colors ${
                      p.paid
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500'
                    }`}
                  >
                    {p.paid ? 'Paid' : 'Mark as Paid'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BillDetails;