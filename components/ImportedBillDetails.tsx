import React, { useState, useRef, useEffect } from 'react';
import type { ImportedBill } from '../types.ts';
import { exportData } from '../services/exportService.ts';
import PaymentMethodsModal from './PaymentMethodsModal.tsx';
import SummaryBillDetailsModal from './SummaryBillDetailsModal.tsx';

interface ImportedBillDetailsProps {
    bill: ImportedBill;
    onUpdateBill: (bill: ImportedBill) => void;
    onBack: () => void;
}

const ImportedBillDetails: React.FC<ImportedBillDetailsProps> = ({ bill, onUpdateBill, onBack }) => {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const myParticipant = bill.sharedData.bill.participants.find(p => p.id === bill.myParticipantId);
    const isMyPortionPaid = bill.localStatus.myPortionPaid;
    const isSummary = bill.id.startsWith('summary-');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsMenuOpen(false);
          }
        };
        if (isMenuOpen) {
          document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleTogglePaid = () => {
        const updatedBill = {
            ...bill,
            localStatus: {
                ...bill.localStatus,
                myPortionPaid: !bill.localStatus.myPortionPaid
            }
        };
        onUpdateBill(updatedBill);
    };

    const handleExport = () => {
        exportData({ imported: [bill] }, `${bill.sharedData.bill.description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
        setIsMenuOpen(false);
    };

    return (
        <>
            <div className="max-w-2xl mx-auto">
                <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l-4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Back
                </button>
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-grow">
                            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 break-words">{bill.sharedData.bill.description}</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">From {bill.creatorName} &bull; {new Date(bill.sharedData.bill.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">${myParticipant?.amountOwed.toFixed(2)}</p>
                             <div ref={menuRef} className="relative">
                                <button
                                    onClick={() => setIsMenuOpen(prev => !prev)}
                                    className="p-3 -m-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
                                    aria-label="More options"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-20">
                                        <button onClick={handleExport} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                            Export as CSV
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="my-4 flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                        {bill.sharedData.bill.receiptImage && (
                            <button onClick={() => setIsReceiptModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                View Receipt Image
                            </button>
                        )}
                        {bill.sharedData.bill.additionalInfo && Object.keys(bill.sharedData.bill.additionalInfo).length > 0 && (
                            <button onClick={() => setIsInfoModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                View Additional Info
                            </button>
                        )}
                        {bill.sharedData.bill.items && bill.sharedData.bill.items.length > 0 && !isSummary && (
                            <button onClick={() => setIsItemsModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 11a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                View Itemization
                            </button>
                        )}
                    </div>

                    {myParticipant && (
                        <div className="mt-6">
                            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Your Status</h3>
                            <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">My Portion</span>
                                <button onClick={handleTogglePaid} className={`px-4 py-1.5 text-sm font-semibold rounded-full ${isMyPortionPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                                    {isMyPortionPaid ? 'Paid' : 'Unpaid'}
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6 flex flex-col sm:flex-row gap-4">
                        {!isMyPortionPaid && <button onClick={() => setIsPaymentModalOpen(true)} className="flex-1 w-full bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-emerald-600 transition-colors">Settle Up</button>}
                        {isSummary && <button onClick={() => setIsSummaryModalOpen(true)} className="flex-1 w-full bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">View Bill Breakdown</button>}
                    </div>
                </div>
            </div>
            {isPaymentModalOpen && myParticipant && (
                <PaymentMethodsModal
                    paymentDetails={bill.sharedData.paymentDetails}
                    billDescription={bill.sharedData.bill.description}
                    amountOwed={myParticipant.amountOwed}
                    creatorName={bill.creatorName}
                    onClose={() => setIsPaymentModalOpen(false)}
                />
            )}
            {isSummaryModalOpen && myParticipant && (
                <SummaryBillDetailsModal
                    summaryBill={bill.sharedData.bill}
                    paymentDetails={bill.sharedData.paymentDetails}
                    creatorName={bill.creatorName}
                    myParticipantId={myParticipant.id}
                    importedBill={bill}
                    onUpdateImportedBill={onUpdateBill}
                    onClose={() => setIsSummaryModalOpen(false)}
                />
            )}
            {isReceiptModalOpen && bill.sharedData.bill.receiptImage && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-[51] flex justify-center items-center p-4" onClick={() => setIsReceiptModalOpen(false)} role="dialog" aria-modal="true" aria-label="Receipt Image Viewer">
                    <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <img src={bill.sharedData.bill.receiptImage} alt="Receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" />
                        <button onClick={() => setIsReceiptModalOpen(false)} className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close receipt view">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
            {isInfoModalOpen && bill.sharedData.bill.additionalInfo && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-[51] flex justify-center items-center p-4" onClick={() => setIsInfoModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="info-dialog-title">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 id="info-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Additional Information</h3></div>
                        <div className="p-6 flex-grow overflow-y-auto"><dl className="space-y-4">{Object.entries(bill.sharedData.bill.additionalInfo).map(([key, value]) => (<div key={key} className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-md"><dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{key}</dt><dd className="mt-1 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{String(value)}</dd></div>))}</dl></div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end"><button onClick={() => setIsInfoModalOpen(false)} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Close</button></div>
                    </div>
                </div>
            )}
            {isItemsModalOpen && bill.sharedData.bill.items && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-[51] flex justify-center items-center p-4" onClick={() => setIsItemsModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="items-dialog-title">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700"><h3 id="items-dialog-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Itemization</h3></div>
                        <div className="p-6 flex-grow overflow-y-auto">
                            <ul className="space-y-3">
                                {bill.sharedData.bill.items.map(item => {
                                    const assignedParticipants = item.assignedTo
                                        .map(pId => bill.sharedData.bill.participants.find(p => p.id === pId)?.name)
                                        .filter(Boolean);

                                    return (
                                        <li key={item.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold text-slate-800 dark:text-slate-100 break-words pr-2">{item.name}</p>
                                                <p className="font-bold text-lg text-slate-800 dark:text-slate-100">${item.price.toFixed(2)}</p>
                                            </div>
                                            {assignedParticipants.length > 0 && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    Assigned to: {assignedParticipants.join(', ')}
                                                </p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                            <button onClick={() => setIsItemsModalOpen(false)} className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ImportedBillDetails;
