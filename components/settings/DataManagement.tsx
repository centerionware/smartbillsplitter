import React from 'react';

interface DataManagementProps {
    onExport: () => void;
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onExport, onImport }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Data Management</h3>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 rounded-r-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                    <span className="font-bold">Important:</span> This application stores all data directly on your device, not on a server. If you clear your browser data or lose your device, your data will be lost forever. Use the export feature to create a backup file.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={onExport} className="w-full flex-1 text-center justify-center bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">
                    Export Data
                </button>
                <label className="w-full flex-1 text-center justify-center bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                    Import Data
                    <input type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
                </label>
            </div>
        </div>
    );
};

export default DataManagement;
