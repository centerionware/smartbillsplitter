import { useState, useEffect, useCallback } from 'react';
import type { Bill, Settings, ImportedBill, RecurringBill, RequestConfirmationFn, SettingsSection, SummaryFilter, DashboardView } from '../types';
import { View } from '../types';

// Hooks
import { useBills } from './useBills';
import { useImportedBills } from './useImportedBills';
import { useRecurringBills } from './useRecurringBills';
import { useSettings } from './useSettings';
import { useTheme } from './useTheme';
import { useAuth } from './useAuth';
import { useAppControl } from '../contexts/AppControlContext';
import { syncSharedBillUpdate, pollImportedBills, pollOwnedSharedBills, reactivateShare } from '../services/shareService';
import { getDiscoveredApiBaseUrl } from '../services/api';

export const useAppLogic = () => {
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
    const [showDebugConsole, setShowDebugConsole] = useState(false);

    // --- Dashboard Specific State ---
    const [dashboardView, setDashboardView] = useState<DashboardView>('bills');
    const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
    const [dashboardStatusFilter, setDashboardStatusFilter] = useState<'active' | 'archived'>('active');
    const [dashboardSummaryFilter, setDashboardSummaryFilter] = useState<SummaryFilter>('total');

    // --- Hooks ---
    const { settings, updateSettings, isLoading: isSettingsLoading } = useSettings();
    const { bills, addBill, updateBill: originalUpdateBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, mergeBills, isLoading: isBillsLoading } = useBills();
    const { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, mergeImportedBills, updateMultipleImportedBills, isLoading: isImportedLoading } = useImportedBills();
    const { recurringBills, addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate, isLoading: isRecurringLoading } = useRecurringBills();
    const { theme, setTheme } = useTheme();
    const { subscriptionStatus } = useAuth();
    const { showNotification } = useAppControl();
    
    // --- Wrapped updateBill to handle server sync ---
    const updateBill = useCallback(async (bill: Bill) => {
        const updatedBillFromDB = await originalUpdateBill(bill);
        if (updatedBillFromDB.shareInfo?.shareId) {
            syncSharedBillUpdate(updatedBillFromDB, settings, originalUpdateBill).catch(e => {
                console.error("Failed to sync shared bill update:", e);
                showNotification(e.message || "Failed to sync bill update to server", 'error');
            });
        }
    }, [originalUpdateBill, settings, showNotification]);

    // Effect to check for dev environment and show debug console
    useEffect(() => {
        const checkDevEnv = async () => {
            const apiBaseUrl = await getDiscoveredApiBaseUrl();
            let isDevEnv = false;

            if (apiBaseUrl === '') {
                // Case 1: API is using relative paths. This is a dev/sandbox environment.
                isDevEnv = true;
            } else if (apiBaseUrl) {
                try {
                    const apiUrlOrigin = new URL(apiBaseUrl).origin;
                    // Case 2: API and Frontend are served from the same origin.
                    // This is also considered a dev/sandbox environment.
                    if (apiUrlOrigin === window.location.origin) isDevEnv = true;
                } catch (e) {
                    console.error("Could not parse discovered API URL for debug check:", apiBaseUrl, e);
                    // On error, assume production and hide the console.
                    isDevEnv = false;
                }
            }
            // Case 3: API and Frontend have different origins. This is a production environment.
            // In this case, isDevEnv remains false.
            
            if (isDevEnv) {
                console.log("Dev/Sandbox environment detected, showing debug console.");
                setShowDebugConsole(true);
            } else {
                console.log("Production environment detected, debug console is hidden.");
                setShowDebugConsole(false);
            }
        };
        checkDevEnv();
    }, []);
    
    // Effect for polling imported bills for updates
    useEffect(() => {
        const poll = async () => {
            const activeImported = importedBills.filter(b => b.status === 'active');
            if (activeImported.length === 0) return;

            const billsToUpdate = await pollImportedBills(activeImported);

            if (billsToUpdate.length > 0) {
                await updateMultipleImportedBills(billsToUpdate);
            }
        };
        poll();
        const intervalId = setInterval(poll, 30 * 1000);
        return () => clearInterval(intervalId);
    }, [importedBills, updateMultipleImportedBills]);

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
        const intervalId = setInterval(poll, 5 * 60 * 1000);
        poll();
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
        if (targetView !== View.Dashboard) {
            setSelectedParticipant(null);
            setDashboardSummaryFilter('total');
        }
    };
    
    useEffect(() => {
        const parseHash = () => {
            const hash = window.location.hash.slice(2);
            if (hash.startsWith(View.ViewShared)) {
                setView(View.ViewShared);
            } else {
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
            const { lastUpdatedAt, updateToken } = await reactivateShare(billToReshare, settings);
            await updateBill({ 
                ...billToReshare, 
                shareStatus: 'live',
                lastUpdatedAt,
                shareInfo: { ...billToReshare.shareInfo!, updateToken }
            });
            showNotification("Bill has been reshared successfully!");
        } catch (e: any) {
            showNotification(e.message || "Failed to reshare the bill.", 'error');
        }
    };
    
    const createFromTemplate = (template: RecurringBill) => {
        const { id, status, nextDueDate, ...billData } = template;
        const updatedParticipants = billData.participants.map(p => ({ ...p, paid: false }));
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

    // --- Loading State & Derived Data ---
    const currentBill = bills.find(b => b.id === currentBillId);
    const currentImportedBill = importedBills.find(b => b.id === currentImportedBillId);
    const isLoading = isBillsLoading || isImportedLoading || isRecurringLoading || isSettingsLoading;

    return {
        // State
        view, currentBillId, currentImportedBillId, recurringBillToEdit, fromTemplate, billConversionSource,
        confirmation, setConfirmation, settingsSection, setSettingsSection, isCsvImporterOpen, setIsCsvImporterOpen,
        isQrImporterOpen, setIsQrImporterOpen, showDebugConsole,
        dashboardView,
        selectedParticipant, setSelectedParticipant,
        dashboardStatusFilter,
        dashboardSummaryFilter,
        // FIX: Rename state setters to match the 'onSet...' prop names expected by components.
        onSetDashboardView: setDashboardView,
        onSetDashboardStatusFilter: setDashboardStatusFilter,
        onSetDashboardSummaryFilter: setDashboardSummaryFilter,
        // Data & Hooks
        settings, updateSettings, theme, setTheme, subscriptionStatus,
        bills, importedBills, recurringBills, currentBill, currentImportedBill,
        isLoading,
        // Callbacks & Handlers
        navigate, requestConfirmation, updateBill, addImportedBill, updateImportedBill, updateMultipleImportedBills,
        handleSaveBill, handleSaveRecurringBill, handleUpdateRecurringBill, handleDeleteBill, handleDeleteImportedBill,
        handleDeleteRecurringBill, handleReshareBill, createFromTemplate,
        // Bill actions
        addBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, mergeBills,
        archiveImportedBill, unarchiveImportedBill, mergeImportedBills,
        // Recurring Bill actions
        addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate,
    };
};