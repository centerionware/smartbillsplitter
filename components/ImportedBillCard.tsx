import React from 'react';
import type { ImportedBill } from '../types.ts';

interface ImportedBillCardProps {
  importedBill: ImportedBill;
  onUpdate: (bill: ImportedBill) => void;
  onSettleUp: () => void;
}

const ImportedBillCard: React.FC<ImportedBillCardProps> = ({ importedBill, onUpdate, onSettleUp }) => {
  const { bill } = importedBill.sharedData;
  const myParticipant = bill.participants.find(p => p.id === importedBill.myParticipantId);

  const toggleMyPaidStatus = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    const updatedBill = {
      ...importedBill,
      localStatus: {
        ...importedBill.localStatus,
        myPortionPaid: !importedBill.localStatus.myPortionPaid
      }
    };
    onUpdate(updatedBill);
  };
  
  const isLive = importedBill.liveStatus === 'live' || (importedBill.liveStatus === undefined && (Date.now() - importedBill.lastUpdatedAt) < (24 * 60 * 60 * 1000));
  const isExpired = importedBill.liveStatus === 'expired';
  const hasPaymentInfo = importedBill.sharedData.paymentDetails && Object.values(importedBill.sharedData.paymentDetails).some(val => !!val);

  // Sort participants to ensure "me" is always shown in the avatar stack if possible.
  const participantsForDisplay = [...bill.participants].sort((a, b) => {
    if (a.id === importedBill.myParticipantId) return -1;
    if (b.id === importedBill.myParticipantId) return 1;
    return 0;
  });

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-indigo-900/40 transition-shadow duration-300 overflow-hidden transform hover:-translate-y-1 h-full flex flex-col border-l-4 border-indigo-500"
    >
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start">
            <div>
                 <p className="text-lg font-bold text-slate-800 dark:text-slate-100 break-words">{bill.description}</p>
                 <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Shared by {importedBill.creatorName}</p>
                    {isLive && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
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
           
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 whitespace-nowrap ${
                myParticipant && myParticipant.paid
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
              }`}
            >
              {myParticipant && myParticipant.paid ? 'They marked as paid' : 'You owe'}
            </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {new Date(bill.date).toLocaleDateString()}
        </p>
        <div className="mt-4">
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
            ${myParticipant?.amountOwed.toFixed(2) || '0.00'}
          </p>
           <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Total bill: ${bill.totalAmount.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
        <div className="flex items-center justify-between text-sm">
            <div className="flex -space-x-2 overflow-hidden">
              {participantsForDisplay.slice(0, 4).map(p => {
                const isMe = p.id === importedBill.myParticipantId;
                return (
                  <div key={p.id} className={`inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 flex items-center justify-center text-white font-bold text-xs ${isMe ? 'bg-indigo-500' : 'bg-teal-500'} ${p.paid ? 'opacity-50' : ''}`}>
                    {p.name.charAt(0)}
                  </div>
                );
              })}
              {bill.participants.length > 4 && (
                <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs">
                  +{bill.participants.length - 4}
                </div>
              )}
            </div>
             <div className="flex items-center gap-2">
                {hasPaymentInfo && myParticipant && !myParticipant.paid && !importedBill.localStatus.myPortionPaid && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onSettleUp(); }}
                        className="px-4 py-2 rounded-full font-semibold text-sm transition-colors bg-emerald-500 text-white hover:bg-emerald-600"
                    >
                        Settle Up
                    </button>
                )}
                <button
                    onClick={toggleMyPaidStatus}
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-colors whitespace-nowrap ${
                    importedBill.localStatus.myPortionPaid
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500'
                    }`}
                >
                    {importedBill.localStatus.myPortionPaid ? 'I Paid' : 'Mark as Paid'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImportedBillCard;