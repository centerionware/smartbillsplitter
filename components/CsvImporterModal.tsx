import React, { useState, useCallback, useRef } from 'react';
// FIX: Changed import to ParsedCsvData, which is now correctly defined and exported.
import { parseCsv, ParsedCsvData, ParsedBillFromCsv } from '../services/geminiService';
import type { Settings, ImportedBill } from '../types';
import { useAppControl } from '../contexts/AppControlContext';

interface CsvImporterModalProps {
  onClose: () => void;
  onMergeBills: (bills: ParsedBillFromCsv[]) => Promise<{ added: number, updated: number, skipped: number }>;
  onMergeImportedBills: (bills: Omit<ImportedBill, 'status' | 'liveStatus'>[]) => Promise<{ added: number, updated: number, skipped: number }>;
  settings: Settings;
}

const CsvImporterModal: React.FC<CsvImporterModalProps> = ({ onClose, onMergeBills, onMergeImportedBills, settings }) => {
    const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showNotification } = useAppControl();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            processFiles(Array.from(files));
        }
    };

    const processFiles = async (files: File[]) => {
        setStatus('processing');
        setError(null);

        const allParsedData: ParsedCsvData = { ownedBills: [], importedBills: [] };

        for (const file of files) {
            try {
                const csvContent = await file.text();
                if (!csvContent) {
                    // Skip empty files silently
                    continue;
                }
                const parsedData = await parseCsv(csvContent, settings.myDisplayName);
                allParsedData.ownedBills.push(...parsedData.ownedBills);
                allParsedData.importedBills.push(...parsedData.importedBills);
            } catch (err: any) {
                setError(`Failed to process ${file.name}: ${err.message || 'An unknown error occurred.'}`);
                setStatus('error');
                return; // Stop processing on the first error
            }
        }
        
        try {
            const ownedResult = await onMergeBills(allParsedData.ownedBills);
            const importedResult = await onMergeImportedBills(allParsedData.importedBills);
            
            const totalAdded = ownedResult.added + importedResult.added;
            const totalUpdated = ownedResult.updated + importedResult.updated;
            const totalProcessed = totalAdded + totalUpdated + ownedResult.skipped + importedResult.skipped;

            if (totalAdded === 0 && totalUpdated === 0) {
                if (totalProcessed > 0) {
                    showNotification("All bills in the file(s) already exist and are up-to-date.", 'info');
                } else {
                     showNotification("No valid bills could be found in the selected file(s).", 'info');
                }
            } else {
                 showNotification(`Import complete: ${totalAdded} added, ${totalUpdated} updated.`, 'success');
            }
            onClose();

        } catch (mergeError: any) {
            setError(`Failed to save imported data: ${mergeError.message}`);
            setStatus('error');
        }
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
                        <p className="text-slate-600 dark:text-slate-300 mb-6">Upload a CSV file and let AI automatically create your bills. For best results, use a file previously exported from this app.</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".csv,text/csv"
                            className="hidden"
                            multiple // Allow multiple file selection
                        />
                        <button
                            onClick={handleUploadClick}
                            className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
                        >
                            Select CSV File(s)
                        </button>
                    </>
                )}

                {status === 'processing' && (
                    <div className="py-8">
                         <svg className="animate-spin h-12 w-12 text-teal-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         <p className="text-slate-600 dark:text-slate-300">Analyzing CSV, please wait...</p>
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