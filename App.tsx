import React, { useState } from 'react';
import type { Bill, Settings } from './types.ts';
import { View } from './types.ts';
import { useBills } from './hooks/useBills.ts';
import { useSettings } from './hooks/useSettings.ts';
import { useTheme } from './hooks/useTheme.ts';
import { useAuth } from './hooks/useAuth.ts';
import Header from './components/Header.tsx';
import Dashboard from './components/Dashboard.tsx';
import CreateBill from './components/CreateBill.tsx';
import BillDetails from './components/BillDetails.tsx';
import SettingsComponent from './components/Settings.tsx';
import PwaInstallBanner from './components/PwaInstallBanner.tsx';
import FloatingAd from './components/FloatingAd.tsx';
import ConfirmationDialog from './components/ConfirmationDialog.tsx';
import Disclaimer from './components/Disclaimer.tsx';

export type RequestConfirmationOptions = {
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
};

export type RequestConfirmationFn = (
  title: string,
  message: string,
  onConfirm: () => void,
  options?: RequestConfirmationOptions
) => void;

const App: React.FC = () => {
  const { bills, addBill, updateBill, deleteBill, archiveBill, unarchiveBill } = useBills();
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const { subscriptionStatus, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } & RequestConfirmationOptions | null>(null);

  const requestConfirmation: RequestConfirmationFn = (title, message, onConfirm, options) => {
    setConfirmation({ isOpen: true, title, message, onConfirm, ...options });
  };

  const handleConfirm = () => {
    if (confirmation?.onConfirm) {
      confirmation.onConfirm();
    }
    setConfirmation(null);
  };

  const handleCancelDialog = () => {
    setConfirmation(null);
  };

  const handleCreateNewBill = () => {
    setCurrentView(View.CreateBill);
    setSelectedBill(null);
  };

  const handleSelectBill = (bill: Bill) => {
    setSelectedBill(bill);
    setCurrentView(View.BillDetails);
  };

  const handleSaveBill = (bill: Omit<Bill, 'id' | 'status'>) => {
    addBill(bill);
    setCurrentView(View.Dashboard);
  };

  const handleUpdateBill = (bill: Bill) => {
    updateBill(bill);
    setSelectedBill(bill); // Keep details view updated
  };

  const handleBackToDashboard = () => {
    setCurrentView(View.Dashboard);
    setSelectedBill(null);
  };
  
  const handleGoToSettings = () => {
    setCurrentView(View.Settings);
    setSelectedBill(null);
  };

  const handleGoToDisclaimer = () => {
    setCurrentView(View.Disclaimer);
    setSelectedBill(null);
  };

  const renderContent = () => {
    switch (currentView) {
      case View.CreateBill:
        return <CreateBill onSave={handleSaveBill} onCancel={handleBackToDashboard} requestConfirmation={requestConfirmation} />;
      case View.BillDetails:
        return selectedBill ? (
          <BillDetails
            bill={selectedBill}
            settings={settings}
            onUpdateBill={handleUpdateBill}
            onBack={handleBackToDashboard}
            subscriptionStatus={subscriptionStatus}
          />
        ) : (
          <Dashboard
            bills={bills}
            onSelectBill={handleSelectBill}
            onArchiveBill={archiveBill}
            onUnarchiveBill={unarchiveBill}
            onDeleteBill={deleteBill}
          />
        );
      case View.Settings:
        return <SettingsComponent 
          settings={settings} 
          onUpdateSettings={updateSettings} 
          onBack={handleBackToDashboard} 
          subscriptionStatus={subscriptionStatus}
          onLogout={logout}
          requestConfirmation={requestConfirmation}
        />;
      case View.Disclaimer:
        return <Disclaimer onBack={handleBackToDashboard} />;
      case View.Dashboard:
      default:
        return (
          <Dashboard
            bills={bills}
            onSelectBill={handleSelectBill}
            onArchiveBill={archiveBill}
            onUnarchiveBill={unarchiveBill}
            onDeleteBill={deleteBill}
          />
        );
    }
  };

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