import React from 'react';
import type { RequestConfirmationFn } from '../../types';
import { useAppControl } from '../../contexts/AppControlContext.tsx';
import { closeDB } from '../../services/db.ts';

interface DangerZoneProps {
  requestConfirmation: RequestConfirmationFn;
}

const DangerZone: React.FC<DangerZoneProps> = ({ requestConfirmation }) => {
  const { showNotification } = useAppControl();
  
  const handleReset = () => {
    requestConfirmation(
      'Hard Reset Application?',
      'This will permanently delete all bills, settings, and subscription data from this device. This action cannot be undone. Are you sure you want to proceed?',
      () => {
        // First, close any active database connection from this tab.
        // This is crucial to prevent the current tab from blocking the delete operation.
        closeDB();

        const deleteRequest = indexedDB.deleteDatabase('SmartBillSplitterDB');
        
        deleteRequest.onsuccess = () => {
          localStorage.clear();
          sessionStorage.clear();
          showNotification('Application has been reset. Reloading now...');
          setTimeout(() => window.location.reload(), 1500);
        };
        deleteRequest.onerror = () => {
            showNotification('Could not delete database. Please clear site data in browser settings.', 'error');
        };
        deleteRequest.onblocked = () => {
             showNotification('Reset blocked. Close other tabs for this site and try again.', 'error');
        };
      },
      { confirmText: 'Yes, Delete Everything', confirmVariant: 'danger' }
    );
  };
  
  return (
    <div className="p-4 border-2 border-dashed border-red-500/50 rounded-lg bg-red-50 dark:bg-red-900/20">
      <h4 className="font-bold text-red-800 dark:text-red-200">Hard Reset</h4>
      <p className="text-sm text-red-700 dark:text-red-300 mt-1 mb-4">
        Permanently delete all data stored by this application on this device. This is useful if the app is not working correctly or you want a fresh start.
      </p>
      <button
        onClick={handleReset}
        className="w-full sm:w-auto px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
      >
        Reset Application
      </button>
    </div>
  );
};

export default DangerZone;