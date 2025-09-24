import React, { useState } from 'react';
import type { Bill, Participant, Settings } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import ShareModal from './ShareModal.tsx';

interface BillDetailsProps {
  bill: Bill;
  bills: Bill[]; // All bills for context
  settings: Settings;
  onUpdateBill: (bill: Bill) => void;
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onBack: () => void;
  subscriptionStatus: SubscriptionStatus;
}

const BillDetails: React.FC<BillDetailsProps> = ({ bill, bills, settings, onUpdateBill, onUpdateSettings, onBack, subscriptionStatus }) => {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedParticipantId, setCopiedParticipantId] = useState<string | null>(null);

  const togglePaidStatus = (participantId: string) => {
    const updatedParticipants = bill.participants.map(p =>
      p.id === participantId ? { ...p, paid: !p.paid } : p
    );
    onUpdateBill({ ...bill, participants: updatedParticipants });
  };

  const handleShare = async (participant: Participant) => {
    try {
      // 1. Find all active bills this participant is in and hasn't paid
      const activeBills = bills.filter(b => b.status === 'active');
      const participantUnpaidBills = activeBills.filter(b =>
        b.participants.some(p => p.name === participant.name && !p.paid && p.amountOwed > 0)
      );

      if (participantUnpaidBills.length === 0) {
        alert(`${participant.name} is all paid up!`);
        return;
      }

      // 2. Calculate total owed and create a list of bills
      const totalOwed = participantUnpaidBills.reduce((total, currentBill) => {
        const pInBill = currentBill.participants.find(p => p.name === participant.name);
        return total + (pInBill?.amountOwed || 0);
      }, 0);

      const billList = participantUnpaidBills.map(b => {
        const pInBill = b.participants.find(p => p.name === participant.name);
        return `- "${b.description}": $${(pInBill?.amountOwed || 0).toFixed(2)}`;
      }).join('\n');

      // 3. Build payment info string from settings
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
        paymentInfo += paymentInfo ? `\n\n${paymentDetails.customMessage}` : `\n\n${paymentDetails.customMessage}`;
      }

      // 4. Build promo text if on free tier
      let promoText = '';
      if (subscriptionStatus === 'free') {
        let appUrl = 'https://sharedbills.app'; // Default URL
        try {
          const constructedUrl = new URL('/', window.location.href).href;
          appUrl = constructedUrl.endsWith('/') ? constructedUrl.slice(0, -1) : constructedUrl;
        } catch (e) {
          console.warn("Could not determine app URL from context, defaulting.", e);
        }
        promoText = `\n\nCreated with SharedBills: ${appUrl}`;
      }

      // 5. Use the share template from settings
      let shareText = settings.shareTemplate
        .replace('{participantName}', participant.name)
        .replace('{totalOwed}', `$${totalOwed.toFixed(2)}`)
        .replace('{billList}', billList)
        .replace('{paymentInfo}', paymentInfo)
        .replace('{promoText}', promoText);

      // 6. Share or Copy
      if (navigator.share) {
        const shareData = {
          title: 'Bill Split Reminder',
          text: shareText,
        };
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setCopiedParticipantId(participant.id);
        setTimeout(() => setCopiedParticipantId(null), 2000);
      } else {
         alert("Sharing not supported on this browser. Message copied to clipboard as a fallback.");
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Error sharing or copying:", err);
        alert("An error occurred while trying to share. Please try again.");
      }
    }
  };

  const totalPaid = bill.participants
    .filter(p => p.paid)
    .reduce((sum, p) => sum + p.amountOwed, 0);

  const remainingAmount = bill.totalAmount - totalPaid;
  const progressPercentage = bill.totalAmount > 0 ? (totalPaid / bill.totalAmount) * 100 : 0;

  return (
    <>
    {isShareModalOpen && <ShareModal bill={bill} onClose={() => setIsShareModalOpen(false)} settings={settings} onUpdateSettings={onUpdateSettings} />}
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Dashboard
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <div className="flex flex-col md:flex-row justify-between md:items-start mb-4">
          <div className="flex-grow">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{bill.description}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{new Date(bill.date).toLocaleDateString()}</p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-4 mt-4 md:mt-0">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 text-right">
                ${bill.totalAmount.toFixed(2)}
            </div>
            <button onClick={() => setIsShareModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                <span>Share Bill</span>
            </button>
          </div>
        </div>

        <div className="my-2 flex flex-wrap gap-x-4 gap-y-2">
            {bill.receiptImage && (
                <button
                onClick={() => setIsReceiptModalOpen(true)}
                className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                View Scanned Receipt
                </button>
            )}
            {bill.additionalInfo && Object.keys(bill.additionalInfo).length > 0 && (
                <button
                onClick={() => setIsInfoModalOpen(true)}
                className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                View Additional Info
                </button>
            )}
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
                   {!p.paid && p.amountOwed > 0 && (
                    <button
                      onClick={() => handleShare(p)}
                      title={copiedParticipantId === p.id ? "Copied!" : "Send text reminder"}
                      className="p-2 rounded-full font-semibold text-sm transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500"
                      aria-label={`Send text reminder to ${p.name}`}
                    >
                       {copiedParticipantId === p.id ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
                            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                          </svg>
                       )}
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
      
      {isReceiptModalOpen && bill.receiptImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4"
          onClick={() => setIsReceiptModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Receipt Image Viewer"
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={bill.receiptImage} alt="Scanned receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" />
            <button
              onClick={() => setIsReceiptModalOpen(false)}
              className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Close receipt view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isInfoModalOpen && bill.additionalInfo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4"
          onClick={() => setIsInfoModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-dialog-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 id="info-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Additional Information</h3>
              </div>
              <div className="p-6 flex-grow overflow-y-auto">
                <dl className="space-y-4">
                  {Object.entries(bill.additionalInfo).map(([key, value]) => (
                    <div key={key} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md">
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{key}</dt>
                      <dd className="mt-1 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button
                    onClick={() => setIsInfoModalOpen(false)}
                    className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
                >
                    Close
                </button>
              </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
};

export default BillDetails;