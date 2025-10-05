import React from 'react';
import type { RequestConfirmationFn, Bill, ImportedBill } from '../../types';
import { exportData, importData } from '../../services/db';
import { exportData as exportDataAsCsv } from '../../services/exportService';
import { useAppControl } from '../../contexts/AppControlContext';

interface DataManagementProps {
  requestConfirmation: RequestConfirmationFn;
  onOpenCsvImporter: () => void;
  onOpenQrImporter: () => void;
  bills: Bill[];
  importedBills: ImportedBill[];
}

const DataManagement: React.FC<DataManagementProps> = ({ requestConfirmation, onOpenCsvImporter, onOpenQrImporter, bills, importedBills }) => {
  const { reloadApp, showNotification } = useAppControl();

  const handleExport = async () => {
    try {
      // FIX: Changed function call from non-existent 'exportDB' to the correctly imported 'exportData'.
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sharedbills_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('Data exported successfully!');
    } catch (err) {
      console.error("Export failed:", err);
      showNotification('Data export failed.', 'error');
    }
  };
  
  const handleExportAllCsv = async () => {
    try {
      if (bills.length === 0 && importedBills.length === 0) {
        showNotification("No bills to export.", 'info');
        return;
      }
      const filename = `sharedbills_export_${new Date().toISOString().split('T')[0]}.csv`;
      await exportDataAsCsv({ owned: bills, imported: importedBills }, filename);
      showNotification('All bills exported to CSV successfully!');
    } catch (err) {
      console.error("CSV Export failed:", err);
      showNotification('CSV export failed.', 'error');
    }
  };

  const handleImport = () => {
    requestConfirmation(
      'Import Data?',
      'This will overwrite all current data on this device. This action cannot be undone. Are you sure you want to proceed?',
      () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                const data = JSON.parse(event.target?.result as string);
                // FIX: The function `importData` is correctly imported and used. The original error was likely a cascade from the 'exportDB' error above. No change needed here.
                await importData(data);
                showNotification('Data imported successfully! App will now reload.');
                setTimeout(reloadApp, 1500);
              } catch (err) {
                console.error("Import failed:", err);
                showNotification('Failed to import data. The file may be corrupted.', 'error');
              }
            };
            reader.readAsText(file);
          }
        };
        input.click();
      },
      { confirmText: 'Overwrite & Import', confirmVariant: 'danger' }
    );
  };

  const ActionButton: React.FC<{ onClick: () => void; title: string; description: string; }> = ({ onClick, title, description }) => (
    <button onClick={onClick} className="w-full text-left p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
      <h4 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
    </button>
  );

  return (
    <div className="space-y-4">
      <ActionButton onClick={onOpenCsvImporter} title="Import from CSV" description="Import bills from a CSV file using AI." />
      <ActionButton onClick={onOpenQrImporter} title="Scan QR Code" description="Import a shared bill by scanning its QR code." />
      <ActionButton onClick={handleExportAllCsv} title="Export All Bills (CSV)" description="Save all your owned and imported bills to a single CSV file." />
      <ActionButton onClick={handleExport} title="Export All Data (JSON Backup)" description="Save a JSON file of all your data as a backup." />
      <ActionButton onClick={handleImport} title="Import All Data (Restore)" description="Restore data from a previously exported JSON backup." />
    </div>
  );
};

export default DataManagement;