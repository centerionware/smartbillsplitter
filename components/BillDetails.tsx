import React, { useState } from 'react';
import type { Bill, Settings } from './types';
import type { SubscriptionStatus } from '../hooks/useAuth';

interface BillDetailsProps {
  bill: Bill;
  bills: Bill[];
  settings: Settings;
  onUpdateBill: (bill: Bill) => void;
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onBack: () => void;
  subscriptionStatus: SubscriptionStatus;
}

const BillDetails: React.FC<BillDetailsProps> = ({ bill, onUpdateBill, onBack }) => {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const handleParticipantPaidToggle = (participantId: string) => {
    const updatedParticipants = bill.participants.map(p =>
      p.id === participantId ? { ...p, paid: !p.paid } : p
    );
    onUpdateBill({ ...bill, participants: updatedParticipants });
  };

  return (
    <>
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </button>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
          <div className="flex flex-col md:flex-row justify-between md:items-start mb-2">
            <div className="flex-grow">
              <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{bill.description}</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{new Date(bill.date).toLocaleDateString()}</p>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 text-right mt-4 md:mt-0">
              ${bill.totalAmount.toFixed(2)}
            </div>
          </div>
          
          <div className="my-2 flex flex-wrap gap-x-4 gap-y-2">
            {bill.receiptImage && (
                <button onClick={() => setIsReceiptModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                    View Scanned Receipt
                </button>
            )}
            {bill.additionalInfo && Object.keys(bill.additionalInfo).length > 0 && (
                <button onClick={() => setIsInfoModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="http://www.w3.org/2000/svg" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    View Additional Info
                </button>
            )}
          </div>
          
          <div className="my-8 border-t border-slate-200 dark:border-slate-700" />
          
          <div>
            <h3 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">Participants</h3>
            <ul className="space-y-3">
              {bill.participants.map(p => (
                <li key={p.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xs">
                      {p.name.charAt(0)}
                    </div>
                    <p className="ml-3 font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">${p.amountOwed.toFixed(2)}</span>
                    <button 
                      onClick={() => handleParticipantPaidToggle(p.id)}
                      className={`px-3 py-1 text-sm font-semibold rounded-full ${p.paid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                      {p.paid ? 'Paid' : 'Unpaid'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {isReceiptModalOpen && bill.receiptImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={() => setIsReceiptModalOpen(false)} role="dialog" aria-modal="true" aria-label="Receipt Image Viewer">
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={bill.receiptImage} alt="Scanned receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" />
            <button onClick={() => setIsReceiptModalOpen(false)} className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close receipt view"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
      )}

      {isInfoModalOpen && bill.additionalInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4" onClick={() => setIsInfoModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="info-dialog-title">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 id="info-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Additional Information</h3></div>
              <div className="p-6 flex-grow overflow-y-auto"><dl className="space-y-4">{Object.entries(bill.additionalInfo).map(([key, value]) => (<div key={key} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md"><dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{key}</dt><dd className="mt-1 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{value}</dd></div>))}</dl></div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end"><button onClick={() => setIsInfoModalOpen(false)} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Close</button></div>
          </div>
        </div>
      )}
    </>
  );
};

export default BillDetails;
