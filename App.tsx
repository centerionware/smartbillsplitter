import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Bill, Settings, RecurringBill, ImportedBill, RequestConfirmationFn, RequestConfirmationOptions } from './types.ts';
import { View } from './types.ts';
import { useBills } from './hooks/useBills.ts';
import { useImportedBills } from './hooks/useImportedBills.ts';
import { useSettings } from './hooks/useSettings.ts';
import { useTheme } from './hooks/useTheme.ts';
import { useAuth } from './hooks/useAuth.ts';
import { useRecurringBills, calculateNextDueDate } from './hooks/useRecurringBills.ts';
import * as notificationService from './services/notificationService.ts';
import Header from './components/Header.tsx';
import Dashboard from './components/Dashboard.tsx';
import { CreateBill } from './components/CreateBill.tsx';
import BillDetails from './components/BillDetails.tsx';
import ImportedBillDetails from './components/ImportedBillDetails.tsx';
import SettingsComponent from './components/Settings.tsx';
import SyncComponent from './components/Sync.tsx';
import PwaInstallBanner from './components/PwaInstallBanner.tsx';
import ConfirmationDialog from './components/ConfirmationDialog.tsx';
import Disclaimer from './components/Disclaimer.tsx';
import RecurringBillsList from './components/RecurringBillsList.tsx';
import { ViewSharedBill } from './components/ViewSharedBill.tsx';
import ManageSubscriptionPage from './components/ManageSubscriptionPage.tsx';
import SetupDisplayNameModal from './components/SetupDisplayNameModal.tsx';
import { useAppControl } from './contexts/AppControlContext.tsx';
import { getApiUrl, fetchWithRetry } from './services/api.ts';
import SummaryBillDetailsModal from './components/SummaryBillDetailsModal.tsx';
import CsvImporterModal from './components/CsvImporterModal.tsx';
import { useRouter } from './hooks/useRouter.ts';
 
const App: React.FC = () => {
  const { bills, addBill, addMultipleBills, updateBill, deleteBill, archiveBill, unarchiveBill, isLoading: billsLoading, updateMultipleBills } = useBills();
  const { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, isLoading: importedBillsLoading } = useImportedBills();
  const { recurringBills, addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate, isLoading: recurringBillsLoading } = useRecurringBills();
  const { settings, updateSettings, isLoading: settingsLoading } = useSettings();
  const { theme, setTheme, isLoading: themeLoading } = useTheme();
  const { subscriptionStatus, subscriptionDetails, logout } = useAuth();
  const { showNotification } = useAppControl();
  
  const {
    view,
    selectedBill,
    selectedImportedBill,
    billCreationTemplate,
    dashboardView,
    dashboardStatusFilter,
    dashboardSummaryFilter,
    dashboardParticipant,
    navigate,
    currentPath
  } = useRouter({ bills, importedBills, recurringBills });

  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } & RequestConfirmationOptions | null>(null);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [postSetupAction, setPostSetupAction] = useState<(() => void) | null>(null);
  const [summaryBillForModal, setSummaryBillForModal] = useState<ImportedBill | null>(null);
  const [isCsvImporterOpen, setIsCsvImporterOpen] = useState(false);
  const initRef = useRef(false);

  // Effect to update user 'last seen' timestamp in Stripe metadata once per day.
  useEffect(() => {
    const updateLastSeen = async () => {
        if (subscriptionStatus === 'subscribed' && subscriptionDetails?.provider === 'stripe' && subscriptionDetails?.customerId) {
            const lastUpdateKey = `lastStripeUpdate_${subscriptionDetails.customerId}`;
            const lastUpdate = localStorage.getItem(lastUpdateKey);
            const now = Date.now();
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (!lastUpdate || now - parseInt(lastUpdate, 10) > twentyFourHours) {
                console.log("Updating 'last seen' timestamp in Stripe metadata.");
                try {
                    const response = await fetchWithRetry(getApiUrl('/update-customer-metadata'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ customerId: subscriptionDetails.customerId }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || 'Failed to update last seen timestamp.');
                    }
                    
                    localStorage.setItem(lastUpdateKey, now.toString());
                    console.log("'Last seen' timestamp updated successfully.");

                } catch (error) {
                    console.error("Could not update last seen timestamp in Stripe:", error);
                }
            }
        }
    };
    updateLastSeen();
  }, [subscriptionStatus, subscriptionDetails]);


  const createBillFromTemplate = useCallback((template: RecurringBill, myDisplayName: string): Omit<Bill, 'id' | 'status'> => {
    const totalAmount = template.totalAmount || 0;
    
    let participants = JSON.parse(JSON.stringify(template.participants));
    const items = JSON.parse(JSON.stringify(template.items || []));

    const activeParticipants = participants.filter(p => p.name.trim() !== '');
    if (activeParticipants.length > 0 && totalAmount > 0) {
        switch (template.splitMode) {
            case 'equally':
                const amountPerPerson = totalAmount / activeParticipants.length;
                participants.forEach(p => p.amountOwed = amountPerPerson);
                break;
            case 'amount':
                participants.forEach(p => p.amountOwed = p.splitValue || 0);
                break;
            case 'percentage':
                participants.forEach(p => p.amountOwed = (totalAmount * (p.splitValue || 0)) / 100);
                break;
            case 'item':
                participants.forEach(p => p.amountOwed = 0);
                break;
        }
    } else {
        participants.forEach(p => p.amountOwed = 0);
    }
    
    const myNameLower = myDisplayName.trim().toLowerCase();
    participants = participants.map(p => ({
        ...p,
        paid: p.name.trim().toLowerCase() === myNameLower,
    }));
    
    participants.forEach(p => delete (p as any).splitValue);

    return {
        description: template.description,
        totalAmount: totalAmount,
        date: template.nextDueDate,
        participants,
        items,
    };
  }, []);

  const processRecurringBills = useCallback(async () => {
    if (!settings) return;

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let createdCount = 0;

    for (const template of recurringBills) {
        if (template.status !== 'active') continue;

        let currentDueDate = new Date(template.nextDueDate);
        let nextDueDateStr = template.nextDueDate;
        let updated = false;
        let finalNextDueDateStr = nextDueDateStr;

        while (currentDueDate <= now) {
            const newBillData = createBillFromTemplate(template, settings.myDisplayName);
            newBillData.date = nextDueDateStr; 
            await addBill(newBillData);
            createdCount++;

            nextDueDateStr = calculateNextDueDate(template.recurrenceRule, nextDueDateStr);
            finalNextDueDateStr = nextDueDateStr;
            currentDueDate = new Date(nextDueDateStr);
            updated = true;
        }

        if (updated) {
            const updatedTemplate = { ...template, nextDueDate: finalNextDueDateStr };
            await updateRecurringBill(updatedTemplate);
            if(settings.notificationsEnabled) {
              await notificationService.scheduleNotification(updatedTemplate, settings.notificationDays);
            }
        }
    }

    if (createdCount > 0) {
      showNotification(`${createdCount} bill${createdCount > 1 ? 's' : ''} automatically generated.`, 'info');
    }
  }, [recurringBills, settings, addBill, updateRecurringBill, createBillFromTemplate, showNotification]);

  useEffect(() => {
    if (billsLoading || recurringBillsLoading || settingsLoading || initRef.current) {
        return;
    }
    initRef.current = true;
    processRecurringBills();
  }, [billsLoading, recurringBillsLoading, settingsLoading, processRecurringBills]);


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

  const handleBack = () => {
    const isInIframe = window.self !== window.top;
    if (!isInIframe) {
      window.history.back();
    } else {
      navigate('#/');
    }
  };

  const handleCreateNewBill = () => {
    if (settings && (!settings.myDisplayName.trim() || settings.myDisplayName.trim().toLowerCase() === 'myself')) {
      setPostSetupAction(() => () => navigate('#/create'));
      setIsSetupModalOpen(true);
    } else {
      navigate('#/create');
    }
  };
  const handleOpenCsvImporter = () => setIsCsvImporterOpen(true);
  
  const handleSaveBill = (bill: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => {
    addBill(bill);
    if (fromTemplateId) {
        updateRecurringBillDueDate(fromTemplateId);
    }
    navigate('#/', { replace: true });
  };

  const handleSaveRecurringBill = async (bill: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => {
    const newBill = await addRecurringBill(bill);
    if(settings.notificationsEnabled) {
      await notificationService.scheduleNotification(newBill, settings.notificationDays);
    }
    navigate('#/recurring', { replace: true });
  };

  const handleUpdateRecurringBill = async (bill: RecurringBill) => {
    await updateRecurringBill(bill);
    if(settings.notificationsEnabled) {
      await notificationService.scheduleNotification(bill, settings.notificationDays);
    } else {
      await notificationService.cancelNotification(bill.id);
    }
    navigate('#/recurring', { replace: true });
  }

  const handleDeleteRecurringBill = async (billId: string) => {
    await deleteRecurringBill(billId);
    await notificationService.cancelNotification(billId);
  }

  const handleUpdateBill = async (bill: Bill) => {
    await updateBill(bill);
  };
  
  const handleImportComplete = () => {
    navigate('#/', { replace: true });
  }

  const handleSaveDisplayName = (newName: string) => {
    if (newName.trim()) {
        updateSettings({ myDisplayName: newName.trim() });
        setIsSetupModalOpen(false);
        if (postSetupAction) {
            postSetupAction();
            setPostSetupAction(null);
        }
    }
  };

  const renderContent = () => {
    switch (view) {
      case View.CreateBill:
        return <CreateBill
            onSave={handleSaveBill}
            onSaveRecurring={handleSaveRecurringBill}
            onUpdateRecurring={handleUpdateRecurringBill}
            onCancel={handleBack}
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
            onUpdateSettings={updateSettings}
            onBack={handleBack}
            subscriptionStatus={subscriptionStatus}
          />
        ) : ( <div /> );
       case View.ImportedBillDetails:
        return selectedImportedBill ? (
          <ImportedBillDetails
            importedBill={selectedImportedBill}
            settings={settings}
            onUpdateImportedBill={updateImportedBill}
            onBack={handleBack}
            onShowSummaryDetails={() => setSummaryBillForModal(selectedImportedBill)}
          />
        ) : ( <div /> );
       case View.ViewSharedBill:
        return <ViewSharedBill 
            onImportComplete={handleImportComplete} 
            settings={settings} 
            addImportedBill={addImportedBill}
            importedBills={importedBills}
        />;
      case View.RecurringBills:
        return <RecurringBillsList
            recurringBills={recurringBills}
            onCreateFromTemplate={(template) => navigate(`#/create?fromTemplate=${template.id}`)}
            onEditTemplate={(template) => navigate(`#/create?editTemplate=${template.id}`)}
            onArchive={archiveRecurringBill}
            onUnarchive={unarchiveRecurringBill}
            onDelete={handleDeleteRecurringBill}
            onBack={handleBack}
        />;
      case View.Settings:
        return <SettingsComponent 
          settings={settings} 
          onUpdateSettings={updateSettings} 
          onBack={handleBack}
          onGoToSync={() => navigate('#/sync')}
          onGoToManageSubscriptionPage={() => navigate('#/manage-subscription')}
          subscriptionStatus={subscriptionStatus}
          onLogout={logout}
          requestConfirmation={requestConfirmation}
          recurringBills={recurringBills}
        />;
      case View.ManageSubscriptionPage:
        return <ManageSubscriptionPage 
            onBack={handleBack} 
            requestConfirmation={requestConfirmation} 
        />;
      case View.Sync:
        return <SyncComponent
          onBack={handleBack}
          requestConfirmation={requestConfirmation}
        />;
      case View.Disclaimer:
        return <Disclaimer onBack={handleBack} />;
      case View.Dashboard:
      default:
        return (
          <Dashboard
            bills={bills}
            importedBills={importedBills}
            settings={settings}
            subscriptionStatus={subscriptionStatus}
            onSelectBill={(bill) => navigate(`#/bill/${bill.id}`)}
            onSelectImportedBill={(bill) => navigate(`#/imported-bill/${bill.id}`)}
            onArchiveBill={archiveBill}
            onUnarchiveBill={unarchiveBill}
            onDeleteBill={deleteBill}
            onUpdateMultipleBills={updateMultipleBills}
            onUpdateImportedBill={updateImportedBill}
            onArchiveImportedBill={archiveImportedBill}
            onUnarchiveImportedBill={unarchiveImportedBill}
            onDeleteImportedBill={deleteImportedBill}
            onShowSummaryDetails={setSummaryBillForModal}
            dashboardView={dashboardView}
            selectedParticipant={dashboardParticipant}
            dashboardStatusFilter={dashboardStatusFilter}
            dashboardSummaryFilter={dashboardSummaryFilter}
            onSetDashboardView={(view) => {
              const params = new URLSearchParams(currentPath.split('?')[1] || '');
              if (view === 'participants') params.delete('summaryFilter');
              const path = view === 'bills' ? '/' : '/participants';
              const queryString = params.toString() ? `?${params.toString()}` : '';
              navigate(`#${path}${queryString}`);
            }}
            onSetDashboardStatusFilter={(status) => {
              const params = new URLSearchParams(currentPath.split('?')[1] || '');
              if (status === 'archived') {
                  params.set('status', 'archived');
                  params.delete('summaryFilter');
              } else {
                  params.delete('status');
              }
              let path = dashboardParticipant ? `/participants/${encodeURIComponent(dashboardParticipant)}` : (dashboardView === 'bills' ? '/' : '/participants');
              const queryString = params.toString() ? `?${params.toString()}` : '';
              navigate(`#${path}${queryString}`);
            }}
            onSetDashboardSummaryFilter={(filter) => {
              const params = new URLSearchParams(currentPath.split('?')[1] || '');
              if (filter !== 'total') params.set('summaryFilter', filter);
              else params.delete('summaryFilter');
              const queryString = params.toString() ? `?${params.toString()}` : '';
              navigate(`#/${queryString}`);
            }}
            onSelectParticipant={(name) => {
              const params = new URLSearchParams(currentPath.split('?')[1] || '');
              params.delete('summaryFilter');
              const queryString = params.toString() ? `?${params.toString()}` : '';
              navigate(`#/participants/${encodeURIComponent(name)}${queryString}`);
            }}
            onClearParticipant={() => {
              const params = new URLSearchParams(currentPath.split('?')[1] || '');
              params.delete('summaryFilter');
              const queryString = params.toString() ? `?${params.toString()}` : '';
              navigate(`#/participants${queryString}`);
            }}
          />
        );
    }
  };

  if (isSetupModalOpen && settings) {
    return <SetupDisplayNameModal onSave={handleSaveDisplayName} currentName={settings.myDisplayName} />;
  }

  if (billsLoading || settingsLoading || themeLoading || recurringBillsLoading || importedBillsLoading) {
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
      {summaryBillForModal && (
        <SummaryBillDetailsModal
            summaryBill={summaryBillForModal.sharedData.bill}
            creatorName={summaryBillForModal.creatorName}
            paymentDetails={summaryBillForModal.sharedData.paymentDetails}
            myParticipantId={summaryBillForModal.myParticipantId}
            importedBill={summaryBillForModal}
            onUpdateImportedBill={updateImportedBill}
            onClose={() => setSummaryBillForModal(null)}
        />
      )}
      {isCsvImporterOpen && settings && (
        <CsvImporterModal
          onClose={() => setIsCsvImporterOpen(false)}
          onImportSuccess={(newBills) => {
            addMultipleBills(newBills);
            setIsCsvImporterOpen(false);
            showNotification(`${newBills.length} bill(s) imported successfully!`, 'success');
          }}
          settings={settings}
        />
      )}
      <Header 
        onGoHome={() => navigate('#/')}
        onCreateNewBill={handleCreateNewBill} 
        onGoToSettings={() => navigate('#/settings')} 
        onGoToRecurringBills={() => navigate('#/recurring')}
        onNavigate={navigate}
        onOpenCsvImporter={handleOpenCsvImporter}
        hasRecurringBills={recurringBills.length > 0}
        theme={theme}
        setTheme={setTheme}
      />
      <PwaInstallBanner />
      <main className="container mx-auto p-4 md:p-8">
        {renderContent()}
      </main>
      <footer className="text-center p-6 text-slate-500 dark:text-slate-400 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <p>
            <span className="font-semibold">Privacy First:</span> All data is stored on your device.
          </p>
        </div>
        <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2">
          <span>Built with React & Gemini API</span>
          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
          <button onClick={() => navigate('#/disclaimer')} className="hover:underline text-teal-600 dark:text-teal-400 font-medium">
            Disclaimer
          </button>
          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
          <a href="https://github.com/centerionware/smartbillsplitter/commits/main" target="_blank" rel="noopener noreferrer" className="hover:underline text-teal-600 dark:text-teal-400 font-medium">
            Changelog
          </a>
          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
          <a href="https://github.com/centerionware/smartbillsplitter/issues" target="_blank" rel="noopener noreferrer" className="hover:underline text-teal-600 dark:text-teal-400 font-medium">
            Report an Issue
          </a>
        </div>
      </footer>
    </div>
  );
};

export default App;