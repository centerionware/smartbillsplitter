import React from 'react';
import type { Bill, Settings, ImportedBill, RecurringBill, SummaryFilter, DashboardView } from '../../types';
import { View } from '../../types';
import type { SubscriptionStatus } from '../../hooks/useAuth';

// Components
import Dashboard from '../dashboard/Dashboard';
import CreateBill from '../CreateBill';
import BillDetails from '../BillDetails';
import ImportedBillDetails from '../ImportedBillDetails';
import SettingsComponent from '../Settings';
import SyncComponent from '../Sync';
import Disclaimer from '../Disclaimer';
import { ViewSharedBill } from '../ViewSharedBill';
import RecurringBillsList from '../RecurringBillsList';
import ManageSubscriptionPage from '../ManageSubscriptionPage';

// This is a temporary type for the massive props object.
// In a more mature app, this might be handled by a context provider.
type AppLogicProps = {
    view: View;
    isLoading: boolean;
    // Bill Data
    bills: Bill[];
    importedBills: ImportedBill[];
    recurringBills: RecurringBill[];
    // Current Items
    currentBill?: Bill;
    currentImportedBill?: ImportedBill;
    recurringBillToEdit?: RecurringBill;
    fromTemplate?: RecurringBill;
    billConversionSource?: Bill;
    // Settings & Auth
    settings: Settings;
    subscriptionStatus: SubscriptionStatus;
    // Navigation & Callbacks
    navigate: (view: View, params?: any) => void;
    setSettingsSection: (section: any) => void;
    updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    requestConfirmation: any;
    // Dashboard State
    dashboardView: DashboardView;
    selectedParticipant: string | null;
    dashboardStatusFilter: 'active' | 'archived';
    dashboardSummaryFilter: SummaryFilter;
    onSetDashboardView: (view: DashboardView) => void;
    onSetDashboardStatusFilter: (status: 'active' | 'archived') => void;
    onSetDashboardSummaryFilter: (filter: SummaryFilter) => void;
    setSelectedParticipant: (name: string | null) => void;
    // Bill Handlers
    updateBill: (bill: Bill) => Promise<void>;
    addImportedBill: (bill: ImportedBill) => Promise<void>;
    updateImportedBill: (bill: ImportedBill) => void;
    updateMultipleImportedBills: (bills: ImportedBill[]) => Promise<void>;
    handleSaveBill: (billData: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => Promise<void>;
    handleSaveRecurringBill: (billData: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => Promise<void>;
    handleUpdateRecurringBill: (bill: RecurringBill) => Promise<void>;
    handleDeleteBill: (billId: string) => void;
    handleDeleteImportedBill: (billId: string) => void;
    handleDeleteRecurringBill: (billId: string) => void;
    handleReshareBill: (billId: string) => Promise<void>;
    createFromTemplate: (template: RecurringBill) => void;
    archiveBill: (billId: string) => Promise<void>;
    unarchiveBill: (billId: string) => Promise<void>;
    // FIX: Added missing properties for recurring bill actions.
    archiveRecurringBill: (billId: string) => Promise<void>;
    unarchiveRecurringBill: (billId: string) => Promise<void>;
    updateMultipleBills: (bills: Bill[]) => Promise<void>;
    archiveImportedBill: (billId: string) => Promise<void>;
    unarchiveImportedBill: (billId: string) => Promise<void>;
};

export const AppRouter: React.FC<AppLogicProps> = (props) => {
    const { 
        view, isLoading, currentBill, currentImportedBill,
        handleSaveBill, handleSaveRecurringBill, handleUpdateRecurringBill, navigate,
        settings, updateSettings, recurringBillToEdit, fromTemplate, billConversionSource,
        updateBill, setSettingsSection, requestConfirmation,
        recurringBills, createFromTemplate, archiveRecurringBill, unarchiveRecurringBill, handleDeleteRecurringBill,
        addImportedBill, importedBills
    } = props;

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
            return currentBill ? <BillDetails bill={currentBill} onUpdateBill={updateBill} onBack={() => navigate(View.Dashboard)} settings={settings} navigate={navigate} onReshareBill={() => props.handleReshareBill(currentBill.id)}/> : <div>Bill not found.</div>;
        case View.ImportedBillDetails:
            return currentImportedBill ? <ImportedBillDetails bill={currentImportedBill} onUpdateBill={props.updateImportedBill} onBack={() => navigate(View.Dashboard)} /> : <div>Bill not found.</div>;
        case View.RecurringBills:
            return <RecurringBillsList recurringBills={recurringBills} onCreateFromTemplate={createFromTemplate} onEditTemplate={(template) => navigate(View.CreateBill, { recurringBillToEdit: template })} onArchive={archiveRecurringBill} onUnarchive={unarchiveRecurringBill} onDelete={handleDeleteRecurringBill} onBack={() => navigate(View.Dashboard)} />;
        case View.Settings:
            return <SettingsComponent onNavigateToSection={setSettingsSection} onBack={() => navigate(View.Dashboard)} />;
        case View.Sync:
            return <SyncComponent onBack={() => navigate(View.Settings)} requestConfirmation={requestConfirmation} />;
        case View.Disclaimer:
            return <Disclaimer onBack={() => navigate(View.Settings)} />;
        case View.ViewShared:
            return <ViewSharedBill onImportComplete={() => { window.location.hash = ''; navigate(View.Dashboard); }} settings={settings} addImportedBill={addImportedBill} importedBills={importedBills} requestConfirmation={requestConfirmation}/>;
        case View.ManageSubscription:
            return <ManageSubscriptionPage onBack={() => navigate(View.Settings)} requestConfirmation={requestConfirmation} />;
        case View.Dashboard:
        default:
            return <Dashboard 
                        bills={props.bills} 
                        importedBills={props.importedBills}
                        recurringBills={props.recurringBills}
                        settings={props.settings}
                        subscriptionStatus={props.subscriptionStatus}
                        onSelectBill={(bill) => navigate(View.BillDetails, { billId: bill.id })} 
                        onSelectImportedBill={(bill) => navigate(View.ImportedBillDetails, { importedBillId: bill.id })}
                        onArchiveBill={props.archiveBill}
                        onUnarchiveBill={props.unarchiveBill}
                        onDeleteBill={props.handleDeleteBill}
                        onReshareBill={props.handleReshareBill}
                        onUpdateMultipleBills={props.updateMultipleBills}
                        onUpdateImportedBill={props.updateImportedBill}
                        onArchiveImportedBill={props.archiveImportedBill}
                        onUnarchiveImportedBill={props.unarchiveImportedBill}
                        onDeleteImportedBill={props.handleDeleteImportedBill}
                        onShowSummaryDetails={(bill) => navigate(View.ImportedBillDetails, { importedBillId: bill.id, showSummary: true })}
                        onCreateFromTemplate={props.createFromTemplate}
                        navigate={navigate}
                        // Dashboard specific props
                        dashboardView={props.dashboardView}
                        selectedParticipant={props.selectedParticipant}
                        dashboardStatusFilter={props.dashboardStatusFilter}
                        dashboardSummaryFilter={props.dashboardSummaryFilter}
                        onSetDashboardView={props.onSetDashboardView}
                        onSetDashboardStatusFilter={props.onSetDashboardStatusFilter}
                        onSetDashboardSummaryFilter={props.onSetDashboardSummaryFilter}
                        onSelectParticipant={(name) => props.setSelectedParticipant(name)}
                        onClearParticipant={() => props.setSelectedParticipant(null)}
                   />;
    }
};
