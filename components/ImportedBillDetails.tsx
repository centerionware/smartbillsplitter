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
        <div className="max-w-2xl mx-auto">
            <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
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
        </div>
    );
};

export default ImportedBillDetails;
