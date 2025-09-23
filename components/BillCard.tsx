import React, { useState } from 'react';
import type { Bill } from '../types.ts';

interface BillCardProps {
  bill: Bill;
  onClick: () => void;
}

const BillCard: React.FC<BillCardProps> = ({ bill, onClick }) => {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const handleOpenReceipt = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsReceiptModalOpen(true);
  };

  const handleOpenInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInfoModalOpen(true);
  };

  const paidCount = bill.participants.filter(p => p.paid).length;
  const totalCount = bill.participants.length;
  const isFullyPaid = paidCount === totalCount;

  const totalPaid = bill.participants
    .filter(p => p.paid)
    .reduce((sum, p) => sum + p.amountOwed, 0);
  const unpaidAmount = bill.totalAmount - totalPaid;

  return (
    <>
      <div
        onClick={onClick}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-teal-900/40 transition-shadow duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1 h-full flex flex-col"
      >
        <div className="p-5 flex-grow">
          <div className="flex justify-between items-start">
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{bill.description}</p>
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${
                isFullyPaid
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
              }`}
            >
              {isFullyPaid ? 'Paid' : 'Pending'}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {new Date(bill.date).toLocaleDateString()}
          </p>
          <div className="mt-4">
            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
              ${bill.totalAmount.toFixed(2)}
            </p>
            {!isFullyPaid && unpaidAmount > 0.01 && (
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-1">
                ${unpaidAmount.toFixed(2)} unpaid
              </p>
            )}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex -space-x-2 overflow-hidden">
              {bill.participants.slice(0, 4).map(p => (
                <div key={p.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-teal-500 flex items-center justify-center text-white font-bold text-xs">
                  {p.name.charAt(0)}
                </div>
              ))}
              {bill.participants.length > 4 && (
                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs">
                  +{bill.participants.length - 4}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {bill.receiptImage && (
                <button
                  onClick={handleOpenReceipt}
                  className="p-1.5 text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 rounded-full hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                  aria-label="View Scanned Receipt"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                </button>
              )}
              {bill.additionalInfo && Object.keys(bill.additionalInfo).length > 0 && (
                <button
                  onClick={handleOpenInfo}
                  className="p-1.5 text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 rounded-full hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                  aria-label="View Additional Info"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                </button>
              )}
              <p className="font-medium text-slate-600 dark:text-slate-300">
                {paidCount} of {totalCount} paid
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {isReceiptModalOpen && bill.receiptImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4"
          onClick={(e) => { e.stopPropagation(); setIsReceiptModalOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="Receipt Image Viewer"
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={bill.receiptImage} alt="Scanned receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" />
            <button
              onClick={(e) => { e.stopPropagation(); setIsReceiptModalOpen(false); }}
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
          onClick={(e) => { e.stopPropagation(); setIsInfoModalOpen(false); }}
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
                    onClick={(e) => { e.stopPropagation(); setIsInfoModalOpen(false); }}
                    className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
                >
                    Close
                </button>
              </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BillCard;