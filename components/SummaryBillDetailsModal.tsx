import React, { useState } from 'react';
import type { Bill, ImportedBill, PaymentDetails, ReceiptItem } from '../types.ts';
import PaymentMethodsModal from './PaymentMethodsModal.tsx';

interface SummaryBillDetailsModalProps {
  summaryBill: Bill;
  creatorName: string;
  paymentDetails: PaymentDetails;
  myParticipantId: string | null;
  importedBill?: ImportedBill;
  onUpdateImportedBill?: (bill: ImportedBill) => void;
  onClose: () => void;
}

const SummaryBillDetailsModal: React.FC<SummaryBillDetailsModalProps> = ({ summaryBill, creatorName, paymentDetails, myParticipantId, importedBill, onUpdateImportedBill, onClose }) => {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [selectedItem, setSelectedItem] = useState<ReceiptItem | null>(null);
  const [paymentModalItem, setPaymentModalItem] = useState<ReceiptItem | null>(null);

  const handleSelectItem = (item: ReceiptItem) => {
    setSelectedItem(item);
    setView('details');
  };

  const handleToggleItemPaid = (itemId: string) => {
    if (!importedBill || !onUpdateImportedBill) return;

    const currentPaidItems = importedBill.localStatus.paidItems || {};
    const newPaidItems = { ...currentPaidItems, [itemId]: !currentPaidItems[itemId] };

    const allItemsPaid = (importedBill.sharedData.bill.items || []).every(
        item => newPaidItems[item.id]
    );

    const updatedBill: ImportedBill = {
      ...importedBill,
      localStatus: {
        ...importedBill.localStatus,
        paidItems: newPaidItems,
        myPortionPaid: allItemsPaid,
      },
    };
    onUpdateImportedBill(updatedBill);
  };

  const renderListView = () => (
    <ul className="space-y-3">
      {(summaryBill.items || []).map(item => {
        const isPaid = importedBill?.localStatus.paidItems?.[item.id] ?? false;
        return (
          <li key={item.id}>
            <button
              onClick={() => handleSelectItem(item)}
              className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors text-left ${isPaid ? 'bg-emerald-50 dark:bg-emerald-900/40' : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              <span className="font-semibold text-slate-800 dark:text-slate-100">{item.name}</span>
              <div className="flex items-center gap-4">
                <span className={`font-bold ${isPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
                  ${item.price.toFixed(2)}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const renderDetailView = () => {
    if (!selectedItem) return null;
    
    const isPaidByCreator = summaryBill.participants.find(p => p.id === myParticipantId)?.paid ?? false;
    const isPaidByMe = importedBill?.localStatus.paidItems?.[selectedItem.id] ?? false;

    return (
      <div>
        <button onClick={() => setView('list')} className="flex items-center gap-2 mb-4 text-teal-600 dark:text-teal-400 font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Back to List
        </button>
        <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedItem.name}</h4>
            <p className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 mt-2">${selectedItem.price.toFixed(2)}</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                 {!isPaidByCreator && !isPaidByMe && (
                     <button
                        onClick={() => setPaymentModalItem(selectedItem)}
                        className="w-full flex-1 px-6 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                        Settle Up
                    </button>
                 )}
                {importedBill && onUpdateImportedBill && (
                     <button
                        onClick={() => handleToggleItemPaid(selectedItem.id)}
                        disabled={isPaidByCreator}
                        className={`w-full flex-1 px-6 py-3 font-bold rounded-lg transition-colors ${
                        isPaidByCreator
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 cursor-not-allowed'
                            : isPaidByMe
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300'
                                : 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500'
                        }`}
                    >
                        {isPaidByCreator ? 'Creator marked as paid' : (isPaidByMe ? 'I Paid' : 'Mark as Paid')}
                    </button>
                )}
            </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{view === 'list' ? 'Bill Breakdown' : 'Item Details'}</h3>
          </div>
          <div className="p-6 flex-grow overflow-y-auto">
            {view === 'list' ? renderListView() : renderDetailView()}
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end flex-shrink-0">
              <button
                  onClick={onClose}
                  className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
              >
                  Close
              </button>
          </div>
        </div>
      </div>
      {paymentModalItem && (
        <PaymentMethodsModal
            paymentDetails={paymentDetails}
            billDescription={paymentModalItem.name}
            amountOwed={paymentModalItem.price}
            creatorName={creatorName}
            onClose={() => setPaymentModalItem(null)}
        />
      )}
    </>
  );
};

export default SummaryBillDetailsModal;