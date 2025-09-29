import React, { useState, useEffect, useCallback } from 'react';
import type { Bill, Settings, ImportedBill, RecurringBill, RequestConfirmationFn, SettingsSection, SummaryFilter, DashboardView } from './types';
import { View } from './types';

// Hooks
import { useBills } from './hooks/useBills';
import { useImportedBills } from './hooks/useImportedBills';
import { useRecurringBills } from './hooks/useRecurringBills';
import { useSettings } from './hooks/useSettings';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { useAppControl } from './contexts/AppControlContext';
import { syncSharedBillUpdate, pollImportedBills, pollOwnedSharedBills, reactivateShare } from './services/shareService';

// Components
import Header from './components/Header.tsx';
import Dashboard from './components/dashboard/Dashboard.tsx';
import CreateBill from './components/CreateBill.tsx';
import BillDetails from './components/BillDetails.tsx';
import ImportedBillDetails from './components/ImportedBillDetails.tsx';
import SettingsComponent from './components/Settings.tsx';
import SyncComponent from './components/Sync.tsx';
import Disclaimer from './components/Disclaimer.tsx';
import { ViewSharedBill } from './components/ViewSharedBill.tsx';
import RecurringBillsList from './components/RecurringBillsList.tsx';
import ConfirmationDialog from './components/ConfirmationDialog.tsx';
import PwaInstallBanner from './components/PwaInstallBanner.tsx';
import FloatingAd from './components/FloatingAd.tsx';
import SettingsModal from './components/SettingsModal.tsx';
import CsvImporterModal from './components/CsvImporterModal.tsx';
import QrImporterModal from './components/QrImporterModal.tsx';
import ManageSubscriptionPage from './components/ManageSubscriptionPage.tsx';

const App: React.FC = () => {
    // --- State Management ---
    const [view, setView] = useState<View>(View.Dashboard);
    const [currentBillId, setCurrentBillId] = useState<string | null>(null);
    const [currentImportedBillId, setCurrentImportedBillId] = useState<string | null>(null);
    const [recurringBillToEdit, setRecurringBillToEdit] = useState<RecurringBill | undefined>(undefined);
    const [fromTemplate, setFromTemplate] = useState<RecurringBill | undefined>(undefined);
    const [billConversionSource, setBillConversionSource] = useState<Bill | undefined>(undefined);
    
    // --- Confirmation Dialog State ---
    const [confirmation, setConfirmation] = useState<{ title: string; message: string; onConfirm: () => void; options?: any } | null>(null);
    
    // --- Modal State ---
    const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
    const [isCsvImporterOpen, setIsCsvImporterOpen] = useState(false);
    const [isQrImporterOpen, setIsQrImporterOpen] = useState(false);

    // --- Dashboard Specific State ---
    const [dashboardView, setDashboardView] = useState<DashboardView>('bills');
    const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
    const [dashboardStatusFilter, setDashboardStatusFilter] = useState<'active' | 'archived'>('active');
    const [dashboardSummaryFilter, setDashboardSummaryFilter] = useState<SummaryFilter>('total');

    // --- Hooks ---
    const { settings, updateSettings, isLoading: isSettingsLoading } = useSettings();
    const { bills, addBill, updateBill: originalUpdateBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, mergeBills, isLoading: isBillsLoading } = useBills();
    const { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, mergeImportedBills, isLoading: isImportedLoading } = useImportedBills();
    const { recurringBills, addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate, isLoading: isRecurringLoading } = useRecurringBills();
    const { theme, setTheme } = useTheme();
    const { subscriptionStatus } = useAuth();
    const { showNotification } = useAppControl();
    
    // --- Wrapped updateBill to handle server sync ---
    const updateBill = useCallback(async (bill: Bill) => {
        await originalUpdateBill(bill); // Update local DB first
        if (bill.shareInfo?.shareId) {
            // Fire-and-forget update to the server
            syncSharedBillUpdate(bill, settings).catch(e => {
                console.error("Failed to sync shared bill update:", e);
                showNotification("Failed to sync bill update to server", 'error');
            });
        }
    }, [originalUpdateBill, settings, showNotification]);
    
    // Effect for polling imported bills for updates
    useEffect(() => {
        const poll = async () => {
            const activeImported = importedBills.filter(b => b.status === 'active');
            if (activeImported.length === 0) return;

            const billsToUpdate = await pollImportedBills(activeImported);

            if (billsToUpdate.length > 0) {
                for (const updatedBill of billsToUpdate) {
                    await updateImportedBill(updatedBill);
                }
            }
        };

        const intervalId = setInterval(poll, 30 * 1000); // Poll every 30 seconds
        poll(); // Also poll immediately on mount/dependency change

        return () => clearInterval(intervalId);
    }, [importedBills, updateImportedBill]);

    // Effect for polling OWNED shared bills to check for expiration
    useEffect(() => {
        const poll = async () => {
            const ownedShared = bills.filter(b => b.shareInfo?.shareId);
            if (ownedShared.length === 0) return;
            
            const billsToUpdate = await pollOwnedSharedBills(ownedShared);
            if (billsToUpdate.length > 0) {
                console.log(`Polling found ${billsToUpdate.length} status changes for owned shared bills.`);
                await updateMultipleBills(billsToUpdate);
            }
        };

        const intervalId = setInterval(poll, 5 * 60 * 1000); // Poll every 5 minutes
        poll(); // Poll on mount

        return () => clearInterval(intervalId);
    }, [bills, updateMultipleBills]);

    // --- Routing ---
    const navigate = (targetView: View, params: any = {}) => {
        setView(targetView);
        setCurrentBillId(params.billId || null);
        setCurrentImportedBillId(params.importedBillId || null);
        if (targetView === View.CreateBill) {
            setRecurringBillToEdit(params.recurringBillToEdit || undefined);
            setFromTemplate(params.fromTemplate || undefined);
            const sourceBill = bills.find(b => b.id === params.convertFromBill);
            setBillConversionSource(sourceBill || undefined);
        } else {
            setRecurringBillToEdit(undefined);
            setFromTemplate(undefined);
            setBillConversionSource(undefined);
        }

        // Reset dashboard filters when navigating away
        if (targetView !== View.Dashboard) {
            setSelectedParticipant(null);
            setDashboardSummaryFilter('total');
        }
    };
    
    // Handle hash-based routing on initial load and on change
    useEffect(() => {
        const parseHash = () => {
            const hash = window.location.hash.slice(2); // Remove '#/'
            if (hash.startsWith(View.ViewShared)) {
                setView(View.ViewShared);
            } else {
                 // Keep dashboard view state on reload
                if(view !== View.Dashboard) setView(View.Dashboard);
            }
        };
        parseHash();
        window.addEventListener('hashchange', parseHash);
        return () => window.removeEventListener('hashchange', parseHash);
    }, []);

    // --- Callbacks ---
    const requestConfirmation: RequestConfirmationFn = (title, message, onConfirm, options) => {
        setConfirmation({ title, message, onConfirm, options });
    };

    const handleSaveBill = async (billData: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => {
        await addBill(billData);
        if (fromTemplateId) {
            await updateRecurringBillDueDate(fromTemplateId);
            const template = recurringBills.find(rb => rb.id === fromTemplateId);
            showNotification(`Created bill from "${template?.description || 'template'}"`);
        } else {
            showNotification('Bill created successfully!');
        }
    };

    const handleSaveRecurringBill = async (billData: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => {
        await addRecurringBill(billData);
        showNotification('Recurring template created!');
    };
    
    const handleUpdateRecurringBill = async (bill: RecurringBill) => {
        await updateRecurringBill(bill);
        showNotification('Template updated successfully!');
    };
    
    const handleDeleteBill = (billId: string) => {
        requestConfirmation('Delete Bill?', 'This action cannot be undone. Are you sure you want to delete this bill?', () => {
            deleteBill(billId);
            showNotification('Bill deleted.');
        }, { confirmText: 'Delete', confirmVariant: 'danger' });
    };

    const handleDeleteImportedBill = (billId: string) => {
        requestConfirmation('Delete Imported Bill?', 'This will remove the bill from your dashboard. This action cannot be undone.', () => {
            deleteImportedBill(billId);
            showNotification('Imported bill deleted.');
        }, { confirmText: 'Delete', confirmVariant: 'danger' });
    };
    
    const handleDeleteRecurringBill = (billId: string) => {
        requestConfirmation('Delete Template?', 'This action cannot be undone. Are you sure you want to delete this template?', () => {
            deleteRecurringBill(billId);
            showNotification('Template deleted.');
        }, { confirmText: 'Delete', confirmVariant: 'danger' });
    };

    const handleReshareBill = async (billId: string) => {
        const billToReshare = bills.find(b => b.id === billId);
        if (!billToReshare) {
            showNotification("Could not find the bill to reshare.", 'error');
            return;
        }
        try {
            await reactivateShare(billToReshare, settings);
            await updateBill({ ...billToReshare, shareStatus: 'live' });
            showNotification("Bill has been reshared successfully!");
        } catch (e: any) {
            showNotification(e.message || "Failed to reshare the bill.", 'error');
        }
    };
    
    const createFromTemplate = (template: RecurringBill) => {
        const { id, status, nextDueDate, ...billData } = template;

        // When creating from a template, all participants should start as unpaid.
        const updatedParticipants = billData.participants.map(p => ({
            ...p,
            paid: false
        }));

        const newBill: Omit<Bill, 'id' | 'status'> = {
            ...billData,
            participants: updatedParticipants,
            date: new Date().toISOString(),
            totalAmount: billData.totalAmount || 0,
        };
        addBill(newBill);
        updateRecurringBillDueDate(id);
        showNotification(`Created bill from "${template.description}"`);
    };

    // --- Render Logic ---
    const currentBill = bills.find(b => b.id === currentBillId);
    const currentImportedBill = importedBills.find(b => b.id === currentImportedBillId);
    
    const isLoading = isBillsLoading || isImportedLoading || isRecurringLoading || isSettingsLoading;

    const renderView = () => {
        if (isLoading) {
             return (
                 <div className="flex-grow flex items-center justify-center text-center">
                    <div>
                        <svg className="animate-spin h-10 w-10 text-teal-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <h1 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Loading your data...</h1>
                    </div>
                 </div>
            );
        }
        
        switch (view) {
            case View.CreateBill:
                return <CreateBill onSaveBill={handleSaveBill} onSaveRecurringBill={handleSaveRecurringBill} onUpdateRecurringBill={handleUpdateRecurringBill} onBack={() => navigate(View.Dashboard)} settings={settings} updateSettings={updateSettings} recurringBillToEdit={recurringBillToEdit} fromTemplate={fromTemplate} billConversionSource={billConversionSource} />;
            case View.BillDetails:
                return currentBill ? <BillDetails bill={currentBill} onUpdateBill={updateBill} onBack={() => navigate(View.Dashboard)} settings={settings} navigate={navigate} onReshareBill={() => handleReshareBill(currentBill.id)}/> : <div>Bill not found.</div>;
            case View.ImportedBillDetails:
                return currentImportedBill ? <ImportedBillDetails bill={currentImportedBill} onUpdateBill={updateImportedBill} onBack={() => navigate(View.Dashboard)} /> : <div>Bill not found.</div>;
            case View.RecurringBills:
                return <RecurringBillsList recurringBills={recurringBills} onCreateFromTemplate={createFromTemplate} onEditTemplate={(template) => navigate(View.CreateBill, { recurringBillToEdit: template })} onArchive={archiveRecurringBill} onUnarchive={unarchiveRecurringBill} onDelete={handleDeleteRecurringBill} onBack={() => navigate(View.Dashboard)} />;
            case View.Settings:
                return <SettingsComponent onNavigateToSection={setSettingsSection} onBack={() => navigate(View.Dashboard)} />;
            case View.Sync:
                return <SyncComponent onBack={() => navigate(View.Settings)} requestConfirmation={requestConfirmation} />;
            case View.Disclaimer:
                return <Disclaimer onBack={() => navigate(View.Settings)} />;
            case View.ViewShared:
                return <ViewSharedBill onImportComplete={() => { window.location.hash = ''; navigate(View.Dashboard); }} settings={settings} addImportedBill={addImportedBill} importedBills={importedBills}/>;
            case View.ManageSubscription:
                return <ManageSubscriptionPage onBack={() => navigate(View.Settings)} requestConfirmation={requestConfirmation} />;
            case View.Dashboard:
            default:
                return <Dashboard 
                            bills={bills} 
                            importedBills={importedBills}
                            recurringBills={recurringBills}
                            settings={settings}
                            subscriptionStatus={subscriptionStatus}
                            onSelectBill={(bill) => navigate(View.BillDetails, { billId: bill.id })} 
                            onSelectImportedBill={(bill) => navigate(View.ImportedBillDetails, { importedBillId: bill.id })}
                            onArchiveBill={archiveBill}
                            onUnarchiveBill={unarchiveBill}
                            onDeleteBill={handleDeleteBill}
                            onReshareBill={handleReshareBill}
                            onUpdateMultipleBills={updateMultipleBills}
                            onUpdateImportedBill={updateImportedBill}
                            onArchiveImportedBill={archiveImportedBill}
                            onUnarchiveImportedBill={unarchiveImportedBill}
                            onDeleteImportedBill={handleDeleteImportedBill}
                            onShowSummaryDetails={(bill) => navigate(View.ImportedBillDetails, { importedBillId: bill.id, showSummary: true })}
                            onCreateFromTemplate={createFromTemplate}
                            navigate={navigate}
                            // Dashboard specific props
                            dashboardView={dashboardView}
                            selectedParticipant={selectedParticipant}
                            dashboardStatusFilter={dashboardStatusFilter}
                            dashboardSummaryFilter={dashboardSummaryFilter}
                            onSetDashboardView={setDashboardView}
                            onSetDashboardStatusFilter={setDashboardStatusFilter}
                            onSetDashboardSummaryFilter={setDashboardSummaryFilter}
                            onSelectParticipant={setSelectedParticipant}
                            onClearParticipant={() => setSelectedParticipant(null)}
                       />;
        }
    };
    
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 flex flex-col">
            <PwaInstallBanner />
            <Header navigate={navigate} onOpenSettings={setSettingsSection} currentView={view} />
            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                {renderView()}
            </main>
            {subscriptionStatus === 'free' && view === View.Dashboard && <FloatingAd />}
            {confirmation && <ConfirmationDialog isOpen={true} title={confirmation.title} message={confirmation.message} onConfirm={() => { confirmation.onConfirm(); setConfirmation(null); }} onCancel={() => { if(confirmation.options?.onCancel) confirmation.options.onCancel(); setConfirmation(null); }} {...confirmation.options} />}
            {settingsSection && <SettingsModal activeSection={settingsSection} onClose={() => setSettingsSection(null)} settings={settings} updateSettings={updateSettings} requestConfirmation={requestConfirmation} onNavigate={navigate} theme={theme} setTheme={setTheme} onOpenCsvImporter={() => { setSettingsSection(null); setIsCsvImporterOpen(true); }} onOpenQrImporter={() => { setSettingsSection(null); setIsQrImporterOpen(true); }} bills={bills} importedBills={importedBills} />}
            {isCsvImporterOpen && <CsvImporterModal onClose={() => setIsCsvImporterOpen(false)} onMergeBills={mergeBills} onMergeImportedBills={mergeImportedBills} settings={settings} />}
            {isQrImporterOpen && <QrImporterModal onClose={() => setIsQrImporterOpen(false)} onScanSuccess={(url) => { window.location.href = url; setIsQrImporterOpen(false); }} />}
        </div>
    );
};

export default App;