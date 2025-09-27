import React, { useState, useEffect, useCallback, useRef } from 'react';
// FIX: Moved RequestConfirmationFn and RequestConfirmationOptions to types.ts and imported them from there.
import type { Bill, Settings, RecurringBill, Participant, ReceiptItem, ImportedBill, SummaryFilter, RequestConfirmationFn, RequestConfirmationOptions } from './types.ts';
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
// FIX: Changed to a named import to resolve module resolution issues.
import { ViewSharedBill } from './components/ViewSharedBill.tsx';
import ManageSubscriptionPage from './components/ManageSubscriptionPage.tsx';
import SetupDisplayNameModal from './components/SetupDisplayNameModal.tsx';
import { useAppControl } from './contexts/AppControlContext.tsx';
import { getApiUrl } from './services/api.ts';

// Determine if the app is running in an iframe.
// This is used to disable URL-based navigation for a smoother sandbox experience.
const isInIframe = window.self !== window.top;
 
const App: React.FC = () => {
  const { bills, addBill, updateBill, deleteBill, archiveBill, unarchiveBill, isLoading: billsLoading, updateMultipleBills } = useBills();
  const { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, isLoading: importedBillsLoading } = useImportedBills();
  const { recurringBills, addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate, isLoading: recurringBillsLoading } = useRecurringBills();
  const { settings, updateSettings, isLoading: settingsLoading } = useSettings();
  const { theme, setTheme, isLoading: themeLoading } = useTheme();
  const { subscriptionStatus, subscriptionDetails, logout } = useAuth();
  const { showNotification } = useAppControl();
  
  // --- Navigation & View State ---
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedImportedBill, setSelectedImportedBill] = useState<ImportedBill | null>(null);
  const [dashboardView, setDashboardView] = useState<'bills' | 'participants'>('bills');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<'active' | 'archived'>('active');
  const [dashboardParticipant, setDashboardParticipant] = useState<string | null>(null);
  const [dashboardSummaryFilter, setDashboardSummaryFilter] = useState<SummaryFilter>('total');
  
  // A single source of truth for the current logical path of the application.
  // On initial load, it reads from the URL hash if not in an iframe, otherwise defaults to the dashboard.
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return isInIframe ? '#/' : (window.location.hash || '#/');
  });

  const [billCreationTemplate, setBillCreationTemplate] = useState<RecurringBill | { forEditing: RecurringBill } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } & RequestConfirmationOptions | null>(null);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [postSetupAction, setPostSetupAction] = useState<(() => void) | null>(null);
  const initRef = useRef(false);

  // --- Navigation ---
  
  // Main navigation function. Updates the app's logical path and, if not in an iframe, the browser's URL hash.
  const navigate = useCallback((hash: string, options?: { replace?: boolean }) => {
    // 1. Update the internal state, which will trigger a re-render and view update.
    setCurrentPath(hash);

    // 2. Conditionally update the browser's history if not in a sandboxed environment.
    if (!isInIframe) {
      const method = options?.replace ? 'replaceState' : 'pushState';
      const currentHash = window.location.hash || '#/';
      if (method === 'pushState' && currentHash === hash) {
        return; // Avoid pushing identical history entries.
      }
      window.history[method](null, '', hash);
    }
  }, [isInIframe]);

  // Effect to handle browser back/forward buttons (popstate).
  // It listens for URL changes and updates the app's internal path to match.
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.hash || '#/');
    };

    if (!isInIframe) {
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isInIframe]);

  // This core effect translates the `currentPath` state into the actual view being displayed.
  // It runs on initial load and whenever `currentPath` changes.
  useEffect(() => {
    if (billsLoading || recurringBillsLoading || importedBillsLoading) return;

    const hash = currentPath; // Use state as the single source of truth
    const [path, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString || '');

    // Reset view-specific states before setting the new one
    setSelectedBill(null);
    setSelectedImportedBill(null);
    setBillCreationTemplate(null);
    setDashboardParticipant(null);

    const statusParam = params.get('status');
    const status = statusParam === 'archived' ? 'archived' : 'active';
    const summaryFilterParam = params.get('summaryFilter');
    const summaryFilter: SummaryFilter = (summaryFilterParam === 'othersOweMe' || summaryFilterParam === 'iOwe') ? summaryFilterParam : 'total';
    
    if (path.startsWith('#/bill/')) {
      const billId = path.substring(7);
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        setSelectedBill(bill);
        setCurrentView(View.BillDetails);
      } else {
        navigate('#/', { replace: true }); // Bill not found, go home
      }
    } else if (path.startsWith('#/imported-bill/')) {
        const billId = path.substring(16);
        const bill = importedBills.find(b => b.id === billId);
        if (bill) {
            setSelectedImportedBill(bill);
            setCurrentView(View.ImportedBillDetails);
        } else {
            navigate('#/', { replace: true });
        }
    } else if (path.startsWith('#/view-bill')) {
      setCurrentView(View.ViewSharedBill);
    } else if (path === '#/create') {
      const fromTemplateId = params.get('fromTemplate');
      const editTemplateId = params.get('editTemplate');
      if (fromTemplateId) {
        const template = recurringBills.find(rb => rb.id === fromTemplateId);
        setBillCreationTemplate(template || null);
      } else if (editTemplateId) {
        const template = recurringBills.find(rb => rb.id === editTemplateId);
        setBillCreationTemplate(template ? { forEditing: template } : null);
      } else {
        setBillCreationTemplate(null);
      }
      setCurrentView(View.CreateBill);
    } else if (path === '#/settings') {
      setCurrentView(View.Settings);
    } else if (path === '#/manage-subscription') {
      setCurrentView(View.ManageSubscriptionPage);
    } else if (path === '#/sync') {
      setCurrentView(View.Sync);
    } else if (path === '#/disclaimer') {
      setCurrentView(View.Disclaimer);
    } else if (path === '#/recurring') {
      setCurrentView(View.RecurringBills);
    } else if (path.startsWith('#/participants/')) {
        const participantName = decodeURIComponent(path.substring(15));
        setDashboardParticipant(participantName);
        setDashboardView('participants');
        setDashboardStatusFilter(status);
        setCurrentView(View.Dashboard);
    } else { // Handle general dashboard views
        const view = path.startsWith('#/participants') ? 'participants' : 'bills';
        setDashboardView(view);
        setDashboardStatusFilter(status);
        setDashboardSummaryFilter(summaryFilter);
        setCurrentView(View.Dashboard);
    }
  }, [currentPath, bills, recurringBills, importedBills, billsLoading, recurringBillsLoading, importedBillsLoading, navigate]);

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
                    const response = await fetch(getApiUrl('/update-customer-metadata'), {
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
    
    let participants: Participant[] = JSON.parse(JSON.stringify(template.participants));
    const items: ReceiptItem[] = JSON.parse(JSON.stringify(template.items || []));

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
    if (!isInIframe) {
      window.history.back();
    } else {
      // In iframe mode, 'back' is simplified to 'go home' as there's no history stack.
      // This covers all current use cases (from settings, details, create, etc.).
      navigate('#/');
    }
  };

  const handleCreateNewBill = () => {
    if (settings && (!settings.myDisplayName.trim() || settings.myDisplayName.trim().toLowerCase() === 'myself')) {
      // Store the action to be performed after the name is successfully set.
      setPostSetupAction(() => () => navigate('#/create'));
      setIsSetupModalOpen(true);
    } else {
      navigate('#/create');
    }
  };
  const handleSelectBill = (bill: Bill) => navigate(`#/bill/${bill.id}`);
  const handleSelectImportedBill = (bill: ImportedBill) => navigate(`#/imported-bill/${bill.id}`);
  const handleGoToSettings = () => navigate('#/settings');
  const handleGoToSync = () => navigate('#/sync');
  const handleGoToDisclaimer = () => navigate('#/disclaimer');
  const handleGoToRecurringBills = () => navigate('#/recurring');
  const handleGoToManageSubscriptionPage = () => navigate('#/manage-subscription');
  const handleCreateFromTemplate = (template: RecurringBill) => navigate(`#/create?fromTemplate=${template.id}`);
  const handleEditTemplate = (template: RecurringBill) => navigate(`#/create?editTemplate=${template.id}`);
  const handleGoHome = () => navigate('#/');
  
  const handleSetDashboardView = (view: 'bills' | 'participants') => {
    const params = new URLSearchParams(currentPath.split('?')[1] || '');
    if (view === 'participants') {
        params.delete('summaryFilter');
    }
    const path = view === 'bills' ? '/' : '/participants';
    const queryString = params.toString() ? `?${params.toString()}` : '';
    navigate(`#${path}${queryString}`);
  };
  
  const handleSetDashboardStatusFilter = (status: 'active' | 'archived') => {
    const params = new URLSearchParams(currentPath.split('?')[1] || '');
    if (status === 'archived') {
        params.set('status', 'archived');
        params.delete('summaryFilter'); // Reset summary filter for archived view
    } else {
        params.delete('status');
    }
    
    let path: string;
    if (dashboardParticipant) {
        path = `/participants/${encodeURIComponent(dashboardParticipant)}`;
    } else {
        path = dashboardView === 'bills' ? '/' : '/participants';
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';
    navigate(`#${path}${queryString}`);
  };
  
  const handleSetDashboardSummaryFilter = (filter: SummaryFilter) => {
    const params = new URLSearchParams(currentPath.split('?')[1] || '');
    if (filter !== 'total') {
        params.set('summaryFilter', filter);
    } else {
        params.delete('summaryFilter');
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    // This action always navigates to the root bill view
    navigate(`#/${queryString}`);
  };

  const handleSelectDashboardParticipant = (name: string) => {
    const params = new URLSearchParams(currentPath.split('?')[1] || '');
    params.delete('summaryFilter');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    navigate(`#/participants/${encodeURIComponent(name)}${queryString}`);
  };
  const handleClearDashboardParticipant = () => {
    const params = new URLSearchParams(currentPath.split('?')[1] || '');
    params.delete('summaryFilter');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    navigate(`#/participants${queryString}`);
  };

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

  // FIX: Converted `handleUpdateBill` to an async function to correctly handle the promise
  // from the `updateBill` hook. This ensures dependent operations, like sharing, can await the update.
  const handleUpdateBill = async (bill: Bill) => {
    await updateBill(bill);
    setSelectedBill(bill);
  };
  
  const handleImportComplete = () => {
    navigate('#/', { replace: true });
  }

  const handleSaveDisplayName = (newName: string) => {
    if (newName.trim()) {
        updateSettings({ myDisplayName: newName.trim() });
        setIsSetupModalOpen(false);
        // If there was a pending action, execute it now.
        if (postSetupAction) {
            postSetupAction();
            setPostSetupAction(null); // Clear the action after executing.
        }
    }
  };

  const renderContent = () => {
    switch (currentView) {
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
            onCreateFromTemplate={handleCreateFromTemplate}
            onEditTemplate={handleEditTemplate}
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
          onGoToSync={handleGoToSync}
          onGoToManageSubscriptionPage={handleGoToManageSubscriptionPage}
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
            onSelectBill={handleSelectBill}
            onSelectImportedBill={handleSelectImportedBill}
            onArchiveBill={archiveBill}
            onUnarchiveBill={unarchiveBill}
            onDeleteBill={deleteBill}
            onUpdateMultipleBills={updateMultipleBills}
            onUpdateImportedBill={updateImportedBill}
            onArchiveImportedBill={archiveImportedBill}
            onUnarchiveImportedBill={unarchiveImportedBill}
            onDeleteImportedBill={deleteImportedBill}
            dashboardView={dashboardView}
            selectedParticipant={dashboardParticipant}
            dashboardStatusFilter={dashboardStatusFilter}
            dashboardSummaryFilter={dashboardSummaryFilter}
            onSetDashboardView={handleSetDashboardView}
            onSetDashboardStatusFilter={handleSetDashboardStatusFilter}
            onSetDashboardSummaryFilter={handleSetDashboardSummaryFilter}
            onSelectParticipant={handleSelectDashboardParticipant}
            onClearParticipant={handleClearDashboardParticipant}
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
      <Header 
        onGoHome={handleGoHome}
        onCreateNewBill={handleCreateNewBill} 
        onGoToSettings={handleGoToSettings} 
        onGoToRecurringBills={handleGoToRecurringBills}
        onNavigate={navigate}
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
        <div className="flex items-center justify-center gap-x-4">
          <span>Built with React & Gemini API</span>
          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
          <button onClick={handleGoToDisclaimer} className="hover:underline text-teal-600 dark:text-teal-400 font-medium">
            Disclaimer
          </button>
          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
          <a href="https://github.com/centerionware/smartbillsplitter/commits/main" target="_blank" rel="noopener noreferrer" className="hover:underline text-teal-600 dark:text-teal-400 font-medium">
            Changelog
          </a>
        </div>
      </footer>
    </div>
  );
};

export default App;