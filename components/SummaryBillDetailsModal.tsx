import React, { useState } from 'react';
import type { Bill, ImportedBill, PaymentDetails, ReceiptItem } from '../types';
import PaymentMethodsModal from './PaymentMethodsModal';

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
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

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
        const { name, price, originalBillData } = item;
        if (!originalBillData) return null;
        
        const myNameInSummary = summaryBill.participants.find(p => p.id === myParticipantId)?.name;
        const myParticipantInOriginalBill = myNameInSummary
            ? originalBillData.participants.find(p => p.name.toLowerCase().trim() === myNameInSummary.toLowerCase().trim())
            : null;
        const isPaidByCreator = myParticipantInOriginalBill?.paid ?? false;
        
        const isPaidByMeLocally = importedBill?.localStatus.paidItems?.[item.id] ?? false;

        return (
          <li key={item.id}>
            <div className={`w-full p-4 rounded-lg transition-colors text-left ${isPaidByCreator || isPaidByMeLocally ? 'bg-emerald-50 dark:bg-emerald-900/40' : 'bg-slate-50 dark:bg-slate-700/50'}`}>
                <div className="flex justify-between items-start">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 flex-1 break-words pr-2">{name}</p>
                    
                    {isPaidByCreator ? (
                         <div className="flex-shrink-0">
                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                Paid
                            </span>
                        </div>
                    ) : (
                        <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">You Owe</p>
                            <p className={`font-bold text-xl ${isPaidByMeLocally ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'}`}>
                                ${price.toFixed(2)}
                            </p>
                        </div>
                    )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        Total: ${originalBillData.totalAmount.toFixed(2)} &bull; {new Date(originalBillData.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleSelectItem(item)} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500">Details</button>
                        {!isPaidByCreator && <button onClick={() => setPaymentModalItem(item)} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-500 text-white hover:bg-emerald-600">Settle Up</button>}
                    </div>
                </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const renderDetailView = () => {
    if (!selectedItem || !selectedItem.originalBillData) return null;
    
    const myNameInSummary = summaryBill.participants.find(p => p.id === myParticipantId)?.name;
    const myParticipantInOriginalBill = myNameInSummary
        ? selectedItem.originalBillData.participants.find(p => p.name.toLowerCase().trim() === myNameInSummary.toLowerCase().trim())
        : null;
    const isPaidByCreator = myParticipantInOriginalBill?.paid ?? false;

    const isPaidByMe = importedBill?.localStatus.paidItems?.[selectedItem.id] ?? false;
    const { receiptImage, additionalInfo, participants } = selectedItem.originalBillData;

    return (
      <div>
        <button onClick={() => setView('list')} className="flex items-center gap-2 mb-4 text-teal-600 dark:text-teal-400 font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Back to List
        </button>
        <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedItem.name}</h4>
             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Bill Total: ${selectedItem.originalBillData.totalAmount.toFixed(2)}</p>
            <p className="text-4xl font-extrabold text-teal-600 dark:text-teal-400 mt-2">${selectedItem.price.toFixed(2)}</p>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">Your Portion</p>

            <div className="my-4 flex flex-wrap gap-x-4 gap-y-2">
                {receiptImage && (<button onClick={() => setIsReceiptModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>View Scanned Receipt</button>)}
                {additionalInfo && Object.keys(additionalInfo).length > 0 && (<button onClick={() => setIsInfoModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>View Additional Info</button>)}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                 {!isPaidByCreator && (
                     <button onClick={() => setPaymentModalItem(selectedItem)} className="w-full flex-1 px-6 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors">
                        Settle Up
                    </button>
                 )}
                {importedBill && onUpdateImportedBill && (
                     <button onClick={() => handleToggleItemPaid(selectedItem.id)} disabled={isPaidByCreator} className={`w-full flex-1 px-6 py-3 font-bold rounded-lg transition-colors ${ isPaidByCreator ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 cursor-not-allowed' : isPaidByMe ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500' }`}>
                        {isPaidByCreator ? 'Creator marked as paid' : (isPaidByMe ? 'I Paid' : 'Mark as Paid')}
                    </button>
                )}
            </div>
        </div>
        
        <div className="mt-4">
            <h4 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-2">Original Bill Participants</h4>
            <ul className="space-y-2 text-sm">
                {participants.map(p => (
                    <li key={p.id} className="flex justify-between p-2 bg-slate-100 dark:bg-slate-700/50 rounded-md">
                        <span className="text-slate-700 dark:text-slate-200">{p.name}</span>
                        <span className={`${p.paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{p.paid ? 'Paid' : 'Owes'} ${p.amountOwed.toFixed(2)}</span>
                    </li>
                ))}
            </ul>
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
              <button onClick={onClose} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">
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
       {isReceiptModalOpen && selectedItem?.originalBillData?.receiptImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[51] flex justify-center items-center p-4" onClick={() => setIsReceiptModalOpen(false)} role="dialog" aria-modal="true" aria-label="Receipt Image Viewer">
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={selectedItem.originalBillData.receiptImage} alt="Scanned receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" />
            <button onClick={() => setIsReceiptModalOpen(false)} className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close receipt view"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
      )}
      {isInfoModalOpen && selectedItem?.originalBillData?.additionalInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[51] flex justify-center items-center p-4" onClick={() => setIsInfoModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="info-dialog-title">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 id="info-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Additional Information</h3></div>
              <div className="p-6 flex-grow overflow-y-auto"><dl className="space-y-4">{Object.entries(selectedItem.originalBillData.additionalInfo).map(([key, value]) => (<div key={key} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md"><dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{key}</dt><dd className="mt-1 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{String(value)}</dd></div>))}</dl></div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end"><button onClick={() => setIsInfoModalOpen(false)} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Close</button></div>
          </div>
        </div>
      )}
    </>
  );
};

export default SummaryBillDetailsModal;