import React from 'react';
import type { Bill } from '../types.ts';
import { availableExporters } from '../services/exportService.ts';

interface ExportActionSheetProps {
    bill: Bill;
    onClose: () => void;
}

const ExportActionSheet: React.FC<ExportActionSheetProps> = ({ bill, onClose }) => {
    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const handleExport = (exporter: typeof availableExporters[0]) => {
        exporter.export(bill);
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end backdrop-blur-sm" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-sheet-title"
        >
            <div 
                className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-2xl p-4 animate-slide-up shadow-2xl" 
                onClick={e => e.stopPropagation()}
            >
                <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4"></div>
                <div className="text-center mb-6">
                    <h3 id="export-sheet-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Export Bill</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{bill.description}</p>
                </div>
                <div className="space-y-2">
                    {availableExporters.map(exporter => (
                        <button
                            key={exporter.format}
                            onClick={() => handleExport(exporter)}
                            className="w-full flex items-center gap-4 text-left p-4 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{exporter.name}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-6">
                    <button 
                        onClick={onClose} 
                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportActionSheet;
