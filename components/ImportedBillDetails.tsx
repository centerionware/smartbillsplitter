import React, { useState } from 'react';
import type { ImportedBill, Settings } from '../types.ts';
import PaymentMethodsModal from './PaymentMethodsModal.tsx';

interface ImportedBillDetailsProps {
  importedBill: ImportedBill;
  settings: Settings;
  onUpdateImportedBill: (bill: ImportedBill) => void;
  onBack: () => void;
  onShowSummaryDetails?: () => void;
}

const ImportedBillDetails: React.FC<ImportedBillDetailsProps> = ({ importedBill, settings, onUpdateImportedBill, onBack, onShowSummaryDetails }) => {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const { bill } = importedBill.sharedData;
  const myParticipant = bill.participants.find(p => p.id === importedBill.myParticipantId);

  const toggleMyPaidStatus = () => {
    const updatedBill = {
      ...importedBill,
      localStatus: {
        ...importedBill.localStatus,
        myPortionPaid: !importedBill.localStatus.myPortionPaid,
      },
    };
    onUpdateImportedBill(updatedBill);
  };
  
  const isLive = importedBill.liveStatus === 'live' || (importedBill.liveStatus === undefined && (Date.now() - importedBill.lastUpdatedAt) < (24 * 60 * 60 * 1000));
  const isExpired = importedBill.liveStatus === 'expired';
  const hasPaymentInfo = importedBill.sharedData.paymentDetails && Object.values(importedBill.sharedData.paymentDetails).some(val => !!val);
  const isSummary = importedBill.id.startsWith('summary-');

  return (
    <>
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </button>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg border-l-4 border-indigo-500">
          <div className="flex flex-col md:flex-row justify-between md:items-start mb-2">
            <div className="flex-grow">
              <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{bill.description}</h2>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-slate-500 dark:text-slate-400">{new Date(bill.date).toLocaleDateString()}</p>
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Shared by {importedBill.creatorName}</p>
                    {isLive && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Live</span>
                        </div>
                    )}
                    {isExpired && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50">
                             <span className="relative flex h-2 w-2">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="text-xs font-semibold text-red-800 dark:text-red-300">Expired</span>
                        </div>
                    )}
                 </div>
              </div>
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 text-right mt-4 md:mt-0">
              ${bill.totalAmount.toFixed(2)}
            </div>
          </div>
          
           <div className="my-2 flex flex-wrap gap-x-4 gap-y-2">
            {bill.receiptImage && (
                <button onClick={() => setIsReceiptModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                    View Scanned Receipt
                </button>
            )}
            {bill.additionalInfo && Object.keys(bill.additionalInfo).length > 0 && (
                <button onClick={() => setIsInfoModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    View Additional Info
                </button>
            )}
            {isSummary && onShowSummaryDetails && (
                 <button onClick={onShowSummaryDetails} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" /><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    View Bill Breakdown
                </button>
            )}
        </div>

          {myParticipant && (
            <div className="mt-6 mb-8 p-4 bg-teal-50 dark:bg-teal-900/40 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-medium text-teal-800 dark:text-teal-200">My Portion to Pay:</p>
                <p className="text-3xl font-bold text-teal-900 dark:text-teal-100">${myParticipant.amountOwed.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                  {hasPaymentInfo && !myParticipant.paid && !importedBill.localStatus.myPortionPaid && (
                      <button
                          onClick={() => setIsPaymentModalOpen(true)}
                          className="px-5 py-3 rounded-lg font-bold text-sm transition-colors bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                          Settle Up
                      </button>
                  )}
                  <button
                    onClick={toggleMyPaidStatus}
                    className={`px-5 py-3 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${
                      importedBill.localStatus.myPortionPaid
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500'
                    }`}
                  >
                    {importedBill.localStatus.myPortionPaid ? 'I Paid' : 'Mark as Paid'}
                  </button>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xl font-semibold mb-4 text-slate-700 dark:text-slate-200">All Participants</h3>
            <ul className="space-y-3">
              {bill.participants.map(p => {
                const isMe = myParticipant && p.id === myParticipant.id;
                const liClasses = `flex items-center justify-between p-4 rounded-lg transition-colors duration-200 ${isMe ? 'bg-indigo-50 dark:bg-indigo-900/40 ring-2 ring-indigo-400' : 'bg-slate-50 dark:bg-slate-700/50'}`;
                return (
                  <li key={p.id} className={liClasses}>
                      <div className="flex items-center gap-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                          {isMe && <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-800 px-2 py-0.5 rounded-full">You</span>}
                      </div>
                      <div className={`px-3 py-1 text-sm font-semibold rounded-full ${p.paid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                          {p.paid ? 'Paid' : 'Owes'} ${p.amountOwed.toFixed(2)}
                      </div>
                  </li>
                );
              })}
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
              <div className="p-6 flex-grow overflow-y-auto"><dl className="space-y-4">{Object.entries(bill.additionalInfo).map(([key, value]) => (<div key={key} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md"><dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{key}</dt><dd className="mt-1 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{String(value)}</dd></div>))}</dl></div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end"><button onClick={() => setIsInfoModalOpen(false)} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Close</button></div>
          </div>
        </div>
      )}
      {isPaymentModalOpen && myParticipant && (
        <PaymentMethodsModal
            paymentDetails={importedBill.sharedData.paymentDetails}
            billDescription={bill.description}
            amountOwed={myParticipant.amountOwed}
            creatorName={importedBill.creatorName}
            onClose={() => setIsPaymentModalOpen(false)}
        />
      )}
    </>
  );
};

export default ImportedBillDetails;