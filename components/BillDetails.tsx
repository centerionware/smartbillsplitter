import React, { useState, useRef, useEffect } from 'react';
import type { Bill, Settings } from '../types';
import ShareModal from './ShareModal.tsx';
import { exportData } from '../services/exportService.ts';
import { View } from '../types';

interface BillDetailsProps {
    bill: Bill;
    onUpdateBill: (bill: Bill) => void;
    onBack: () => void;
    settings: Settings;
    navigate: (view: View, params?: any) => void;
}

const BillDetails: React.FC<BillDetailsProps> = ({ bill, onUpdateBill, onBack, settings, navigate }) => {
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    const handleTogglePaid = (participantId: string) => {
        const updatedParticipants = bill.participants.map(p =>
            p.id === participantId ? { ...p, paid: !p.paid } : p
        );
        onUpdateBill({ ...bill, participants: updatedParticipants });
    };

    const handleExport = () => {
        exportData({ owned: [bill] }, `${bill.description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
        setIsMenuOpen(false);
    };
    
    const handleConvertToTemplate = () => {
        navigate(View.CreateBill, { convertFromBill: bill.id });
        setIsMenuOpen(false);
    };

    return (
        <>
            <div className="max-w-2xl mx-auto">
                <button onClick={onBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Back
                </button>
                <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-grow">
                            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 break-words">{bill.description}</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">{new Date(bill.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">${bill.totalAmount.toFixed(2)}</p>
                            <div ref={menuRef} className="relative">
                                <button
                                    onClick={() => setIsMenuOpen(prev => !prev)}
                                    className="p-3 -m-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
                                    aria-label="More options"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 py-1 z-20">
                                        <button onClick={handleConvertToTemplate} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                            Convert to Template
                                        </button>
                                        <button onClick={handleExport} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                            Export as CSV
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {bill.receiptImage && (
                        <div className="mt-4">
                            <button onClick={() => setIsReceiptModalOpen(true)} className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                                View Receipt Image
                            </button>
                        </div>
                    )}


                    <div className="mt-6">
                        <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">Participants</h3>
                        <ul className="space-y-3">
                            {bill.participants.map(p => (
                                <li key={p.id} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name} - ${p.amountOwed.toFixed(2)}</span>
                                    <button onClick={() => handleTogglePaid(p.id)} className={`px-4 py-1.5 text-sm font-semibold rounded-full ${p.paid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                                        {p.paid ? 'Paid' : 'Unpaid'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
                        <button onClick={() => setIsShareModalOpen(true)} className="w-full bg-teal-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-600 transition-colors">
                            Share Bill
                        </button>
                    </div>
                </div>
                {isShareModalOpen && <ShareModal bill={bill} settings={settings} onClose={() => setIsShareModalOpen(false)} onUpdateBill={onUpdateBill as (b: Bill) => Promise<void>} />}
            </div>

            {isReceiptModalOpen && bill.receiptImage && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-[51] flex justify-center items-center p-4" onClick={() => setIsReceiptModalOpen(false)} role="dialog" aria-modal="true" aria-label="Receipt Image Viewer">
                    <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <img src={bill.receiptImage} alt="Receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" />
                        <button onClick={() => setIsReceiptModalOpen(false)} className="absolute -top-3 -right-3 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close receipt view">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default BillDetails;
