import React, { useState, useEffect } from 'react';
import type { Bill, Settings, RecurringBill } from './types.ts';
import { View } from './types.ts';
import { useBills } from './hooks/useBills.ts';
import { useSettings } from './hooks/useSettings.ts';
import { useTheme } from './hooks/useTheme.ts';
import { useAuth } from './hooks/useAuth.ts';
import { useRecurringBills } from './hooks/useRecurringBills.ts';
import Header from './components/Header.tsx';
import Dashboard from './components/Dashboard.tsx';
import CreateBill from './components/CreateBill.tsx';
import BillDetails from './components/BillDetails.tsx';
import SettingsComponent from './components/Settings.tsx';
import SyncComponent from './components/Sync.tsx';
import PwaInstallBanner from './components/PwaInstallBanner.tsx';
import FloatingAd from './components/FloatingAd.tsx';
import ConfirmationDialog from './components/ConfirmationDialog.tsx';
import Disclaimer from './components/Disclaimer.tsx';
import RecurringBillsList from './components/RecurringBillsList.tsx';
 
export type RequestConfirmationOptions = {
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  onCancel?: () => void;
};

export type RequestConfirmationFn = (
  title: string,
  message: string,
  onConfirm: () => void,
  options?: RequestConfirmationOptions
) => void;

const App: React.FC = () => {
  const { bills, addBill, updateBill, deleteBill, archiveBill, unarchiveBill, isLoading: billsLoading, updateMultipleBills } = useBills();
  const { recurringBills, addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate, isLoading: recurringBillsLoading } = useRecurringBills();
  const { settings, updateSettings, isLoading: settingsLoading } = useSettings();
  const { theme, setTheme, isLoading: themeLoading } = useTheme();
  const { subscriptionStatus, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [billCreationTemplate, setBillCreationTemplate] = useState<RecurringBill | { forEditing: RecurringBill } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } & RequestConfirmationOptions | null>(null);

  useEffect(() => {
    if (subscriptionStatus === 'free') {
      const adsenseScriptId = 'adsense-script';
      if (document.getElementById(adsenseScriptId)) return;
      const script = document.createElement('script');
      script.id = adsenseScriptId;
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7626920066448337";
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  }, [subscriptionStatus]);

  const requestConfirmation: RequestConfirmationFn = (title, message, onConfirm, options) => {
    setConfirmation({ isOpen: true, title, message, onConfirm, ...options });
  };

  const handleConfirm = () => {
    confirmation?.onConfirm?.();
    setConfirmation(null);
  };

  const handleCancelDialog = () => {
    confirmation?.onCancel?.();
    setConfirmation(null);
  };

  const handleCreateNewBill = () => {
    setBillCreationTemplate(null);
    setCurrentView(View.CreateBill);
    setSelectedBill(null);
  };

  const handleSelectBill = (bill: Bill) => {
    setSelectedBill(bill);
    setCurrentView(View.BillDetails);
  };

  const handleSaveBill = (bill: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => {
    addBill(bill);
    if (fromTemplateId) {
        updateRecurringBillDueDate(fromTemplateId);
    }
    setCurrentView(View.Dashboard);
    setBillCreationTemplate(null);
  };

  const handleSaveRecurringBill = (bill: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => {
    addRecurringBill(bill);
    setCurrentView(View.RecurringBills);
    setBillCreationTemplate(null);
  };

  const handleUpdateRecurringBill = (bill: RecurringBill) => {
    updateRecurringBill(bill);
    setCurrentView(View.RecurringBills);
    setBillCreationTemplate(null);
  }

  const handleUpdateBill = (bill: Bill) => {
    updateBill(bill);
    setSelectedBill(bill);
  };

  const handleBackToDashboard = () => {
    setCurrentView(View.Dashboard);
    setSelectedBill(null);
    setBillCreationTemplate(null);
  };
  
  const handleGoToSettings = () => {
    setCurrentView(View.Settings);
  };

  const handleGoToSync = () => {
    setCurrentView(View.Sync);
  };

  const handleGoToDisclaimer = () => {
    setCurrentView(View.Disclaimer);
  };

  const handleGoToRecurringBills = () => {
    setCurrentView(View.RecurringBills);
  };
  
  const handleCreateFromTemplate = (template: RecurringBill) => {
    setBillCreationTemplate(template);
    setCurrentView(View.CreateBill);
  };

  const handleEditTemplate = (template: RecurringBill) => {
    setBillCreationTemplate({ forEditing: template });
    setCurrentView(View.CreateBill);
  };

  const renderContent = () => {
    switch (currentView) {
      case View.CreateBill:
        return <CreateBill
            onSave={handleSaveBill}
            onSaveRecurring={handleSaveRecurringBill}
            onUpdateRecurring={handleUpdateRecurringBill}
            onCancel={billCreationTemplate ? handleGoToRecurringBills : handleBackToDashboard}
            requestConfirmation={requestConfirmation}
            settings={settings}
            billTemplate={billCreationTemplate}
         />;
      case View.BillDetails:
        return selectedBill ? (
          <BillDetails
            bill={selectedBill}
            bills={bills}
            settings={settings}
            onUpdateBill={handleUpdateBill}
            onBack={handleBackToDashboard}
            subscriptionStatus={subscriptionStatus}
          />
        ) : (
          <Dashboard
            bills={bills}
            settings={settings}
            subscriptionStatus={subscriptionStatus}
            onSelectBill={handleSelectBill}
            onArchiveBill={archiveBill}
            onUnarchiveBill={unarchiveBill}
            onDeleteBill={deleteBill}
            onUpdateMultipleBills={updateMultipleBills}
          />
        );
      case View.RecurringBills:
        return <RecurringBillsList
            recurringBills={recurringBills}
            onCreateFromTemplate={handleCreateFromTemplate}
            onEditTemplate={handleEditTemplate}
            onArchive={archiveRecurringBill}
            onUnarchive={unarchiveRecurringBill}
            onDelete={deleteRecurringBill}
            onBack={handleBackToDashboard}
        />;
      case View.Settings:
        return <SettingsComponent 
          settings={settings} 
          onUpdateSettings={updateSettings} 
          onBack={handleBackToDashboard}
          onGoToSync={handleGoToSync}
          subscriptionStatus={subscriptionStatus}
          onLogout={logout}
          requestConfirmation={requestConfirmation}
        />;
      case View.Sync:
        return <SyncComponent
          onBack={handleGoToSettings}
          requestConfirmation={requestConfirmation}
        />;
      case View.Disclaimer:
        return <Disclaimer onBack={handleBackToDashboard} />;
      case View.Dashboard:
      default:
        return (
          <Dashboard
            bills={bills}
            settings={settings}
            subscriptionStatus={subscriptionStatus}
            onSelectBill={handleSelectBill}
            onArchiveBill={archiveBill}
            onUnarchiveBill={unarchiveBill}
            onDeleteBill={deleteBill}
            onUpdateMultipleBills={updateMultipleBills}
          />
        );
    }
  };

  if (billsLoading || settingsLoading || themeLoading || recurringBillsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center text-center p-4">
        <svg className="animate-spin h-10 w-10 text-teal-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <h1 className="text-2xl font-semibold text-slate-700 dark:text-slate-200">Loading Your Bills...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200">
      {confirmation?.isOpen && (
        <ConfirmationDialog
          isOpen={confirmation.isOpen}
          title={confirmation.title}
          message={confirmation.message}
          onConfirm={handleConfirm}
          onCancel={handleCancelDialog}
          confirmText={confirmation.confirmText}
          cancelText={confirmation.cancelText}
          confirmVariant={confirmation.confirmVariant}
        />
      )}
      <Header 
        onCreateNewBill={handleCreateNewBill} 
        onGoToSettings={handleGoToSettings} 
        onGoToRecurringBills={handleGoToRecurringBills}
        hasRecurringBills={recurringBills.length > 0}
        theme={theme}
        setTheme={setTheme}
      />
      <PwaInstallBanner />
      <main className="container mx-auto p-4 md:p-8">
        {renderContent()}
      </main>
      {subscriptionStatus === 'free' && <FloatingAd />}
      <footer className="text-center p-6 text-slate-500 dark:text-slate-400 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <p>
            <span className="font-semibold">Privacy First:</span> All data is stored on your device.
          </p>
        </div>
        <div className="flex items-center justify-center gap-x-4">
          <span>Built with React & Gemini API</span>
          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
          <button onClick={handleGoToDisclaimer} className="hover:underline text-teal-600 dark:text-teal-400 font-medium">
            Disclaimer
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
