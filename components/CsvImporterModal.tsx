import React, { useState, useCallback, useRef } from 'react';
import { parseCsv, ParsedBillFromCsv } from '../services/geminiService.ts';
import type { Settings } from '../types.ts';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import type { SubscriptionDetails } from '../services/db.ts';

interface CsvImporterModalProps {
  onClose: () => void;
  onImportSuccess: (bills: ParsedBillFromCsv[]) => void;
  settings: Settings;
  subscriptionStatus: SubscriptionStatus;
  subscriptionDetails: SubscriptionDetails | null;
}

const CsvImporterModal: React.FC<CsvImporterModalProps> = ({ onClose, onImportSuccess, settings, subscriptionStatus, subscriptionDetails }) => {
    const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showNotification } = useAppControl();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const processFile = (file: File) => {
        setStatus('processing');
        setError(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const csvContent = e.target?.result as string;
                if (!csvContent) {
                    throw new Error("Could not read file content.");
                }
                const parsedBills = await parseCsv(csvContent, settings.myDisplayName, subscriptionStatus, subscriptionDetails?.customerId);
                if (parsedBills.length === 0) {
                   showNotification("AI couldn't find any valid bills in the CSV.", 'info');
                   onClose();
                   return;
                }
                onImportSuccess(parsedBills);
            } catch (err: any) {
                setError(err.message || 'An unknown error occurred.');
                setStatus('error');
            }
        };
        reader.onerror = () => {
             setError("Failed to read the selected file.");
             setStatus('error');
        };
        reader.readAsText(file);
    };
    
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm" 
            onClick={status !== 'processing' ? onClose : undefined}
            role="dialog"
            aria-modal="true"
            aria-labelledby="csv-importer-title"
        >
            <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-8 text-center" 
                onClick={e => e.stopPropagation()}
            >
                <h2 id="csv-importer-title" className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Import Bills from CSV</h2>

                {status === 'idle' && (
                    <>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">Upload a CSV file and let AI automatically create your bills. Ensure your file has headers like 'Description', 'Amount', 'Date', and 'Participant'.</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".csv,text/csv"
                            className="hidden"
                        />
                        <button
                            onClick={handleUploadClick}
                            className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
                        >
                            Select CSV File
                        </button>
                    </>
                )}

                {status === 'processing' && (
                    <div className="py-8">
                         <svg className="animate-spin h-12 w-12 text-teal-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         <p className="text-slate-600 dark:text-slate-300">Analyzing CSV with AI, please wait...</p>
                    </div>
                )}

                {status === 'error' && (
                     <>
                        <p className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 p-4 rounded-lg my-6">{error}</p>
                        <div className="flex gap-4">
                            <button onClick={onClose} className="flex-1 px-6 py-3 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500">
                                Close
                            </button>
                             <button onClick={handleUploadClick} className="flex-1 px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600">
                                Try Again
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CsvImporterModal;