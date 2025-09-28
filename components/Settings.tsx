import React, { useState, useMemo, useEffect } from 'react';
import type { Settings, PaymentDetails, RecurringBill } from '../types.ts';
import { useAuth } from '../hooks/useAuth.ts';
// FIX: Updated import path for RequestConfirmationFn to central types file.
import type { RequestConfirmationFn } from '../types.ts';
import { useAppControl } from '../contexts/AppControlContext.tsx';
import { exportData, importData } from '../services/db.ts';
import * as notificationService from '../services/notificationService.ts';
import { getApiUrl, fetchWithRetry } from '../services/api.ts';

// New imports for refactored child components
import BillReminders from './settings/BillReminders.tsx';
import Personalization from './settings/Personalization.tsx';
import PaymentIntegrations from './settings/PaymentIntegrations.tsx';
import DataSync from './settings/DataSync.tsx';
import DataManagement from './settings/DataManagement.tsx';
import SubscriptionManagement from './settings/SubscriptionManagement.tsx';
import DangerZone from './settings/DangerZone.tsx';

interface SettingsProps {
  settings: Settings;
  recurringBills: RecurringBill[];
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onBack: () => void;
  onGoToSync: () => void;
  onGoToManageSubscriptionPage: () => void;
  subscriptionStatus: ReturnType<typeof useAuth>['subscriptionStatus'];
  onLogout: () => void;
  requestConfirmation: RequestConfirmationFn;
}

const SettingsComponent: React.FC<SettingsProps> = ({ settings, recurringBills, onUpdateSettings, onBack, onGoToSync, onGoToManageSubscriptionPage, subscriptionStatus, onLogout, requestConfirmation }) => {
  const [formData, setFormData] = useState<Settings>(settings);
  const { subscriptionDetails } = useAuth();
  const { reloadApp } = useAppControl();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const [isNotificationSupported, setIsNotificationSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const supported = notificationService.isSupported();
    setIsNotificationSupported(supported);
    if(supported) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(settings);
  }, [formData, settings]);

  const handleSave = () => {
    // Trim display name before saving
    const finalFormData = { ...formData, myDisplayName: formData.myDisplayName.trim() || 'Myself' };
    onUpdateSettings(finalFormData);
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

  const handleInputChange = (field: keyof Omit<Settings, 'paymentDetails'>, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    handleInputChange('notificationsEnabled', enabled);

    if (enabled) {
      const permission = await notificationService.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        // Schedule notifications for all active recurring bills
        recurringBills.forEach(bill => {
          if (bill.status === 'active') {
            notificationService.scheduleNotification(bill, formData.notificationDays);
          }
        });
      } else {
        // If permission denied, revert the toggle state
        handleInputChange('notificationsEnabled', false);
      }
    } else {
      // Cancel all scheduled notifications
      recurringBills.forEach(bill => {
        notificationService.cancelNotification(bill.id);
      });
    }
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
  
  const handleManageStripeSubscription = async () => {
    if (!subscriptionDetails) {
        setPortalError("Could not find your subscription details.");
        return;
    }
    
    setIsPortalLoading(true);
    setPortalError(null);
    
    try {
        const origin = window.location.origin;
        const response = await fetchWithRetry(getApiUrl('/manage-subscription'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...subscriptionDetails, origin }),
        });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Failed to create a customer portal session.");
        }
        
        if (data.url) {
            window.location.href = data.url;
        }

    } catch(err: any) {
        setPortalError(err.message || "An unknown error occurred.");
    } finally {
        setIsPortalLoading(false);
    }
  };

  const handleManagePayPalSubscription = async () => {
    if (isPortalLoading) return;
    
    setIsPortalLoading(true);
    setPortalError(null);
    
    try {
        const response = await fetchWithRetry(getApiUrl('/manage-subscription'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'paypal' }),
        });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Failed to get PayPal portal link.");
        }
        
        if (data.url) {
            window.open(data.url, '_blank', 'noopener,noreferrer');
        } else {
            throw new Error("PayPal portal URL not found in server response.");
        }

    } catch(err: any) {
        setPortalError(err.message || "An unknown error occurred.");
    } finally {
        setIsPortalLoading(false);
    }
  };
  
  const Divider = () => <div className="my-8 border-t border-slate-200 dark:border-slate-700" />;

  return (
    <div className="max-w-2xl mx-auto">
       <button onClick={handleBack} className="flex items-center gap-2 mb-6 text-teal-600 dark:text-teal-400 font-semibold hover:text-teal-800 dark:hover:text-teal-300">
        <svg xmlns="http://www.w.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
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
        
        <BillReminders
            notificationsEnabled={formData.notificationsEnabled}
            notificationDays={formData.notificationDays}
            onToggleNotifications={handleToggleNotifications}
            onDaysChange={(days) => handleInputChange('notificationDays', days)}
            isNotificationSupported={isNotificationSupported}
            notificationPermission={notificationPermission}
        />
        <Divider />
        <Personalization
            myDisplayName={formData.myDisplayName}
            shareTemplate={formData.shareTemplate}
            onDisplayNameChange={(name) => handleInputChange('myDisplayName', name)}
            onShareTemplateChange={(template) => handleInputChange('shareTemplate', template)}
        />
        <Divider />
        <PaymentIntegrations
            paymentDetails={formData.paymentDetails}
            onPaymentDetailsChange={handlePaymentInputChange}
        />
        <Divider />
        <DataSync onGoToSync={onGoToSync} />
        <Divider />
        <DataManagement onExport={handleExport} onImport={handleImport} />
        <Divider />
        <SubscriptionManagement
            subscriptionStatus={subscriptionStatus}
// FIX: Corrected function name from onManageStripeSubscription to handleManageStripeSubscription.
            onManageStripeSubscription={handleManageStripeSubscription}
// FIX: Corrected function name from onManagePayPalSubscription to handleManagePayPalSubscription.
            onManagePayPalSubscription={handleManagePayPalSubscription}
            onGoToManagePayPalSubscription={onGoToManageSubscriptionPage}
            isPortalLoading={isPortalLoading}
            portalError={portalError}
            onLogout={onLogout}
        />
        <Divider />
        <DangerZone onResetApp={handleResetApp} />
      </div>
    </div>
  );
};

export default SettingsComponent;