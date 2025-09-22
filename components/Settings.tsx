import React, { useState, useMemo } from 'react';
import type { Settings, PaymentDetails } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import type { RequestConfirmationFn } from '../App.tsx';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import { exportData, importData } from '../services/db.ts';

interface SettingsProps {
  settings: Settings;
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onBack: () => void;
  subscriptionStatus: SubscriptionStatus;
  onLogout: () => void;
  requestConfirmation: RequestConfirmationFn;
}

const SettingsComponent: React.FC<SettingsProps> = ({ settings, onUpdateSettings, onBack, subscriptionStatus, onLogout, requestConfirmation }) => {
  const [formData, setFormData] = useState<Settings>(settings);
  const { reloadApp } = useAppControl();

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(settings);
  }, [formData, settings]);

  const handleSave = () => {
    onUpdateSettings(formData);
    onBack();
  };

  const handleBack = () => {
    if (isDirty) {
      requestConfirmation(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        onBack,
        { confirmText: 'Discard', confirmVariant: 'danger' }
      );
    } else {
      onBack();
    }
  };
  
  const handlePaymentInputChange = (field: keyof PaymentDetails, value: string) => {
    setFormData(prev => ({
      ...prev,
      paymentDetails: {
        ...prev.paymentDetails,
        [field]: value,
      }
    }));
  };

  const handleInputChange = (field: keyof Omit<Settings, 'paymentDetails'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleExport = async () => {
    try {
      const data = await exportData();
      const prettyJson = JSON.stringify(data, null, 2);
      
      const blob = new Blob([prettyJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
      link.download = `smart-bill-splitter-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Failed to export data:", error);
        alert("An error occurred while trying to export your data. Please try again.");
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('File is not readable');
        const data = JSON.parse(text);
        
        // Basic validation: check for at least one expected key
        const expectedKeys = ['bills', 'settings', 'theme', 'subscription'];
        const hasData = expectedKeys.some(key => key in data);

        if (!hasData || typeof data !== 'object') {
          alert('Invalid backup file. The file does not contain valid application data.');
          return;
        }

        requestConfirmation(
          'Overwrite All Existing Data?',
          'Importing a backup will permanently replace all your current bills and settings. This action cannot be undone. Are you sure you want to continue?',
          async () => {
            try {
              await importData(data);
              // Reload the application to apply changes from DB.
              reloadApp();
            } catch(importError) {
              console.error("Failed during import transaction:", importError);
              alert('An error occurred during the import process. Your data may be in an inconsistent state.');
            }
          },
          { confirmText: 'Overwrite & Import', confirmVariant: 'danger' }
        );
      } catch (error) {
        console.error("Failed to import data:", error);
        alert('Failed to import data. The file may be corrupted or in the wrong format.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetApp = () => {
    requestConfirmation(
      'Reset All Data?',
      'This will permanently delete all your bills and reset your settings to their original state. This action cannot be undone.',
      () => {
        // We can just import an empty object to clear all stores.
        importData({}).then(() => {
            reloadApp();
        });
      },
      { confirmText: 'Reset Everything', confirmVariant: 'danger' }
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
       <button onClick={handleBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Back to Dashboard
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-3xl font-bold text-slate-700 dark:text-slate-200">Settings</h2>
          <button onClick={handleSave} disabled={!isDirty} className="px-6 py-2 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex-shrink-0">
            Save
          </button>
        </div>
        
        {/* Personalization Section */}
        <div className="space-y-6">
          <div>
              <h3 className="text-xl font-semibold mb-3 text-slate-700 dark:text-slate-200">Personalization</h3>
          </div>
          <div>
            <label htmlFor="myDisplayName" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">My Display Name</label>
            <input id="myDisplayName" type="text" value={formData.myDisplayName || ''} onChange={(e) => handleInputChange('myDisplayName', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Myself" />
          </div>
          <div>
            <label htmlFor="shareTemplate" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Share Message Template</label>
            <textarea id="shareTemplate" rows={5} value={formData.shareTemplate || ''} onChange={(e) => handleInputChange('shareTemplate', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Use placeholders: <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{participantName}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{totalOwed}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{billList}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{paymentInfo}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 p-1 rounded-sm text-xs">{`{promoText}`}</code>.
            </p>
          </div>
        </div>

        <div className="my-8 border-t border-slate-200 dark:border-slate-700" />

        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-semibold mb-3 text-slate-700 dark:text-slate-200">Payment Details</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Enter your usernames or links below. This info will be added to shared bill reminders.</p>
            </div>
            
            <div>
                <label htmlFor="venmo" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Venmo Username</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">@</span>
                    <input id="venmo" type="text" value={formData.paymentDetails.venmo || ''} onChange={(e) => handlePaymentInputChange('venmo', e.target.value)} className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="your-username" />
                </div>
            </div>

             <div>
                <label htmlFor="paypal" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">PayPal.Me Link or Email</label>
                 <input id="paypal" type="text" value={formData.paymentDetails.paypal || ''} onChange={(e) => handlePaymentInputChange('paypal', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="paypal.me/username or email@example.com" />
            </div>

             <div>
                <label htmlFor="cashApp" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Cash App $Cashtag</label>
                 <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                    <input id="cashApp" type="text" value={formData.paymentDetails.cashApp || ''} onChange={(e) => handlePaymentInputChange('cashApp', e.target.value)} className="w-full pl-6 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="YourCashtag" />
                </div>
            </div>
            
            <div>
                <label htmlFor="zelle" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Zelle (Email or Phone)</label>
                <input id="zelle" type="text" value={formData.paymentDetails.zelle || ''} onChange={(e) => handlePaymentInputChange('zelle', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="user@example.com or 555-123-4567" />
            </div>

            <div>
                <label htmlFor="customMessage" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Custom Payment Note</label>
                <textarea id="customMessage" rows={3} value={formData.paymentDetails.customMessage || ''} onChange={(e) => handlePaymentInputChange('customMessage', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g., Cash is fine too!" />
            </div>
        </div>

        <div className="my-8 border-t border-slate-200 dark:border-slate-700" />
        
        {/* Data Management */}
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Data Management</h3>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 rounded-r-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                    <span className="font-bold">Important:</span> This application stores all data directly on your device, not on a server. If you clear your browser data or lose your device, your data will be lost forever. Use the export feature to create a backup file.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={handleExport} className="w-full flex-1 text-center justify-center bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors">
                    Export Data
                </button>
                <label className="w-full flex-1 text-center justify-center bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                    Import Data
                    <input type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
                </label>
            </div>
        </div>

        <div className="my-8 border-t border-slate-200 dark:border-slate-700" />
        
        {/* Danger Zone */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <span className="font-bold">Warning:</span> The action below is irreversible and will delete all your bills and settings. Proceed with caution.
            </p>
          </div>
          <div>
            <button 
              onClick={handleResetApp} 
              className="w-full text-center justify-center bg-red-100 text-red-800 font-semibold py-3 px-4 rounded-lg hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60 transition-colors"
            >
              Reset App to Default
            </button>
          </div>
        </div>

        {subscriptionStatus === 'free' && (
          <>
            <div className="my-8 border-t border-slate-200 dark:border-slate-700" />
            <div className="space-y-4">
               <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Manage Subscription</h3>
               <p className="text-sm text-slate-500 dark:text-slate-400">
                You are currently on the free, ad-supported plan. Upgrade to Pro to remove ads.
               </p>
               <button
                 onClick={onLogout}
                 className="w-full bg-teal-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-600 transition-colors duration-300 flex items-center justify-center gap-2"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="http://www.w3.org/2000/svg" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                 <span>Upgrade to Pro</span>
               </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsComponent;
