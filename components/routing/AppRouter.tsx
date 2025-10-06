import React from 'react';
import type { Bill, Settings, ImportedBill, RecurringBill, SummaryFilter, DashboardView, SettingsSection, Group, RequestConfirmationFn, Category } from '../../types';
import { View } from '../../types';
import type { ParticipantData } from '../ParticipantList';
import type { BudgetData } from '../dashboard/BudgetView';
import type { SubscriptionStatus } from '../../hooks/useAuth';

// Components
import Dashboard from '../dashboard/Dashboard';
import CreateBill from '../CreateBill';
import CreateGroup from '../CreateGroup';
import BillDetails from '../BillDetails';
import ImportedBillDetails from '../ImportedBillDetails';
import SettingsComponent from '../Settings';
import SyncComponent from '../Sync';
import Disclaimer from '../Disclaimer';
import { ViewSharedBill } from '../ViewSharedBill';
import RecurringBillsList from '../RecurringBillsList';
import ManageSubscriptionPage from '../ManageSubscriptionPage';
import GroupDetailsView from '../dashboard/GroupDetailsView';

type AppLogicProps = {
    view: View;
    isLoading: boolean;
    // Data
    bills: Bill[];
    importedBills: ImportedBill[];
    recurringBills: RecurringBill[];
    groups: Group[];
    categories: Category[];
    participantsData: ParticipantData[];
    // Current Items
    currentBill?: Bill;
    currentImportedBill?: ImportedBill;
    recurringBillToEdit?: RecurringBill;
    fromTemplate?: RecurringBill;
    billConversionSource?: Bill;
    groupToEdit?: Group;
    currentGroup?: Group;
    // Settings & Auth
    settings: Settings;
    subscriptionStatus: SubscriptionStatus;
    // Navigation & Callbacks
    navigate: (view: View, params?: any) => void;
    setSettingsSection: (section: SettingsSection) => void;
    updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    requestConfirmation: RequestConfirmationFn;
    // Dashboard State
    dashboardView: DashboardView;
    selectedParticipant: string | null;
    dashboardStatusFilter: 'active' | 'archived';
    dashboardSummaryFilter: SummaryFilter;
    onSetDashboardView: (view: DashboardView) => void;
    onSetDashboardStatusFilter: (status: 'active' | 'archived') => void;
    onSetDashboardSummaryFilter: (filter: SummaryFilter) => void;
    onSelectParticipant: (name: string | null) => void;
    // Budget
    budgetData: BudgetData;
    budgetDate: { year: number, month: number } | 'last30days';
    setBudgetDate: (date: { year: number, month: number } | 'last30days') => void;
    handleSelectBillFromBudget: (billInfo: { billId: string, isImported: boolean }) => void;
    // Handlers
    updateBill: (bill: Bill) => Promise<Bill>;
    addImportedBill: (bill: ImportedBill) => Promise<void>;
    updateImportedBill: (bill: ImportedBill) => void;
    handleSaveBill: (billData: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => Promise<void>;
    handleSaveRecurringBill: (billData: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => Promise<void>;
    handleUpdateRecurringBill: (bill: RecurringBill) => Promise<void>;
    handleSaveGroup: (groupData: Omit<Group, 'id' | 'lastUpdatedAt' | 'popularity'>) => Promise<void>;
    handleUpdateGroup: (group: Group) => Promise<void>;
    handleDeleteBill: (billId: string) => void;
    handleDeleteImportedBill: (billId: string) => void;
    handleDeleteRecurringBill: (billId: string) => void;
    handleDeleteGroup: (groupId: string) => void;
    handleReshareBill: (billId: string) => Promise<void>;
    createFromTemplate: (template: RecurringBill) => void;
    archiveBill: (billId: string) => Promise<void>;
    unarchiveBill: (billId: string) => Promise<void>;
    archiveRecurringBill: (billId: string) => Promise<void>;
    unarchiveRecurringBill: (billId: string) => Promise<void>;
    updateMultipleBills: (bills: Bill[]) => Promise<void>;
    archiveImportedBill: (billId: string) => Promise<void>;
    unarchiveImportedBill: (billId: string) => Promise<void>;
    canInstall: boolean;
    promptInstall: () => void;
    checkAndMakeSpaceForImageShare: (bill: Bill) => Promise<boolean>;
};

export const AppRouter: React.FC<AppLogicProps> = (props) => {
    const { 
        view, isLoading, currentBill, currentImportedBill, currentGroup,
        handleSaveBill, handleSaveRecurringBill, handleUpdateRecurringBill, navigate,
        settings, updateSettings, recurringBillToEdit, fromTemplate, billConversionSource,
        updateBill, setSettingsSection, requestConfirmation,
        recurringBills, createFromTemplate, archiveRecurringBill, unarchiveRecurringBill, handleDeleteRecurringBill,
        addImportedBill, importedBills, canInstall, promptInstall, checkAndMakeSpaceForImageShare,
        bills, groups, groupToEdit, handleSaveGroup, handleUpdateGroup, handleDeleteGroup, categories
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
            return <CreateBill onSaveBill={handleSaveBill} onSaveRecurringBill={handleSaveRecurringBill} onUpdateRecurringBill={handleUpdateRecurringBill} onBack={() => navigate(View.Dashboard)} settings={settings} updateSettings={updateSettings} recurringBillToEdit={recurringBillToEdit} fromTemplate={fromTemplate} billConversionSource={billConversionSource} groups={groups} categories={categories} />;
        case View.CreateGroup:
            return <CreateGroup onSave={handleSaveGroup} onUpdate={handleUpdateGroup} onBack={() => navigate(View.Dashboard, { view: 'groups' })} groupToEdit={groupToEdit} />;
        case View.GroupDetails:
            return currentGroup ? <GroupDetailsView group={currentGroup} {...props} onUpdateMultipleBills={props.updateMultipleBills} onBack={() => navigate(View.Dashboard, { view: 'groups' })} /> : <div>Group not found.</div>;
        case View.BillDetails:
            return currentBill ? <BillDetails bill={currentBill} onUpdateBill={updateBill} onBack={() => navigate(View.Dashboard)} settings={settings} updateSettings={updateSettings} setSettingsSection={setSettingsSection} navigate={navigate} onReshareBill={() => props.handleReshareBill(currentBill.id)} checkAndMakeSpaceForImageShare={checkAndMakeSpaceForImageShare} /> : <div>Bill not found.</div>;
        case View.ImportedBillDetails:
            return currentImportedBill ? <ImportedBillDetails bill={currentImportedBill} onUpdateBill={props.updateImportedBill} onBack={() => navigate(View.Dashboard)} /> : <div>Bill not found.</div>;
        case View.RecurringBills:
            return <RecurringBillsList recurringBills={recurringBills} onCreateFromTemplate={createFromTemplate} onEditTemplate={(template) => navigate(View.CreateBill, { recurringBillToEdit: template })} onArchive={archiveRecurringBill} onUnarchive={unarchiveRecurringBill} onDelete={handleDeleteRecurringBill} onBack={() => navigate(View.Dashboard)} />;
        case View.Settings:
            return <SettingsComponent onNavigateToSection={setSettingsSection} onBack={() => navigate(View.Dashboard)} canInstall={canInstall} promptInstall={promptInstall} />;
        case View.Sync:
            return <SyncComponent onBack={() => navigate(View.Settings)} requestConfirmation={requestConfirmation} />;
        case View.Disclaimer:
            return <Disclaimer onBack={() => navigate(View.Settings)} />;
        case View.ViewShared:
            return <ViewSharedBill onImportComplete={() => { window.location.hash = ''; navigate(View.Dashboard); }} settings={settings} addImportedBill={addImportedBill} importedBills={importedBills} requestConfirmation={requestConfirmation} bills={bills}/>;
        case View.ManageSubscription:
            return <ManageSubscriptionPage onBack={() => navigate(View.Settings)} requestConfirmation={requestConfirmation} />;
        case View.Dashboard:
        default:
            return <Dashboard 
                        {...props}
                        onDeleteGroup={handleDeleteGroup}
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
                        onSelectParticipant={props.onSelectParticipant}
                        onClearParticipant={() => props.onSelectParticipant(null)}
                        budgetData={props.budgetData}
                        budgetDate={props.budgetDate}
                        setBudgetDate={props.setBudgetDate}
                        handleSelectBillFromBudget={props.handleSelectBillFromBudget}
                   />;
    }
};