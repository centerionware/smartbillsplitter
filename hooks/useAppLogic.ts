import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Bill, Settings, ImportedBill, RecurringBill, RequestConfirmationFn, SettingsSection, SummaryFilter, DashboardView, Group } from '../types';
import { View } from '../types';
import type { ParticipantData } from '../components/ParticipantList';

// Hooks
import { useBills } from './useBills';
import { useImportedBills } from './useImportedBills';
import { useRecurringBills } from './useRecurringBills';
import { useGroups } from './useGroups';
import { useSettings } from './useSettings';
import { useTheme } from './useTheme';
import { useAuth } from './useAuth';
import { useAppControl } from '../contexts/AppControlContext';
import { syncSharedBillUpdate, pollImportedBills, pollOwnedSharedBills, reactivateShare } from '../services/shareService';
import * as notificationService from '../services/notificationService';
import { usePwaInstall } from './usePwaInstall';

const FREE_TIER_IMAGE_SHARE_LIMIT = 5;

export const useAppLogic = () => {
    // --- Hooks ---
    const { settings, updateSettings, isLoading: isSettingsLoading } = useSettings();
    const { bills, addBill, updateBill: originalUpdateBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, mergeBills, isLoading: isBillsLoading } = useBills();
    const { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, mergeImportedBills, updateMultipleImportedBills, isLoading: isImportedLoading } = useImportedBills();
    const { recurringBills, addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate, isLoading: isRecurringLoading } = useRecurringBills();
    const { groups, addGroup, updateGroup, deleteGroup, incrementGroupPopularity, isLoading: isGroupsLoading } = useGroups();
    const { theme, setTheme } = useTheme();
    const { subscriptionStatus } = useAuth();
    const { showNotification } = useAppControl();
    const { canInstall, promptInstall } = usePwaInstall();

    // --- Core State ---
    const [confirmation, setConfirmation] = useState<{ title: string; message: string; onConfirm: () => void; options?: any } | null>(null);
    const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
    const [isCsvImporterOpen, setIsCsvImporterOpen] = useState(false);
    const [isQrImporterOpen, setIsQrImporterOpen] = useState(false);
    const [showDebugConsole, setShowDebugConsole] = useState(() => sessionStorage.getItem('debugConsoleEnabled') === 'true');
    
    // --- Dashboard State ---
    const [dashboardView, setDashboardView] = useState<DashboardView>('bills');
    const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
    const [dashboardStatusFilter, setDashboardStatusFilter] = useState<'active' | 'archived'>('active');
    const [dashboardSummaryFilter, setDashboardSummaryFilter] = useState<SummaryFilter>('total');

    // --- ROUTING LOGIC ---
    const [routerState, setRouterState] = useState({
        view: View.Dashboard,
        params: {} as Record<string, any>,
        billConversionSource: undefined as Bill | undefined,
        recurringBillToEdit: undefined as RecurringBill | undefined,
        fromTemplate: undefined as RecurringBill | undefined,
        groupToEdit: undefined as Group | undefined,
        currentGroup: undefined as Group | undefined,
    });
    const { view, params, billConversionSource, recurringBillToEdit, fromTemplate, groupToEdit, currentGroup } = routerState;

    const navigate = useCallback((view: View, params: Record<string, any> = {}) => {
        let hash = `#/${view}`;
        const urlParams = new URLSearchParams();
        const newParams = {...params};

        if (newParams.recurringBillToEdit) { urlParams.set('editTemplateId', newParams.recurringBillToEdit.id); delete newParams.recurringBillToEdit; }
        if (newParams.fromTemplate) { urlParams.set('fromTemplateId', newParams.fromTemplate.id); delete newParams.fromTemplate; }
        if (newParams.convertFromBill) { urlParams.set('convertFromBillId', newParams.convertFromBill); delete newParams.convertFromBill; }
        if (newParams.groupToEdit) { urlParams.set('editGroupId', newParams.groupToEdit.id); delete newParams.groupToEdit; }
        if (newParams.groupToView) { urlParams.set('groupId', newParams.groupToView.id); delete newParams.groupToView; }
        
        Object.keys(newParams).forEach(key => {
            if (newParams[key] !== undefined && newParams[key] !== null) {
               urlParams.set(key, String(newParams[key]));
            }
        });
    
        const queryString = urlParams.toString();
        if (queryString) {
            hash += `?${queryString}`;
        }
        
        window.location.hash = hash;
    }, []);

    useEffect(() => {
        const parseHash = () => {
            const hash = window.location.hash;
            const pathWithQuery = hash.substring(1);
            const [path, queryString] = pathWithQuery.split('?');
            const viewPath = path.startsWith('/') ? path.substring(1) : path;
            const view = Object.values(View).find(v => v === viewPath) || View.Dashboard;
            const query = new URLSearchParams(queryString || '');
            
            const params: Record<string, any> = {};
            query.forEach((value, key) => { params[key] = value; });
        
            const convertFromBillId = query.get('convertFromBillId');
            const billConversionSource = bills.find(b => b.id === convertFromBillId);
        
            const editTemplateId = query.get('editTemplateId');
            const recurringBillToEdit = recurringBills.find(b => b.id === editTemplateId);
        
            const fromTemplateId = query.get('fromTemplateId');
            const fromTemplate = recurringBills.find(b => b.id === fromTemplateId);

            const editGroupId = query.get('editGroupId');
            const groupToEdit = groups.find(g => g.id === editGroupId);

            const groupId = query.get('groupId');
            const currentGroup = groups.find(g => g.id === groupId);
            
            setRouterState({ view, params, billConversionSource, recurringBillToEdit, fromTemplate, groupToEdit, currentGroup });
        };

        parseHash();
        window.addEventListener('hashchange', parseHash);
        return () => window.removeEventListener('hashchange', parseHash);
    }, [bills, recurringBills, groups]);

    useEffect(() => {
        if (view !== View.Dashboard) {
            setSelectedParticipant(null);
            setDashboardSummaryFilter('total');
        }
    }, [view]);

    // --- Derived Data & Callbacks ---

    const participantsData = useMemo((): ParticipantData[] => {
        const myDisplayNameLower = settings.myDisplayName.trim().toLowerCase();
        const participantContactInfo = new Map<string, { phone?: string; email?: string }>();
        bills.forEach(bill => {
            bill.participants.forEach(p => {
                if (p.name.trim().toLowerCase() === myDisplayNameLower) return;
                const existing = participantContactInfo.get(p.name) || {};
                if ((p.phone && !existing.phone) || (p.email && !existing.email)) {
                    participantContactInfo.set(p.name, { phone: p.phone || existing.phone, email: p.email || existing.email });
                }
            });
        });

        if (dashboardStatusFilter === 'active') {
            const debtMap = new Map<string, number>();
            bills.forEach(bill => {
                if (bill.status !== 'active') return;
                bill.participants.forEach(p => {
                    if (!p.paid && p.amountOwed > 0.005 && p.name.trim().toLowerCase() !== myDisplayNameLower) {
                        debtMap.set(p.name, (debtMap.get(p.name) || 0) + p.amountOwed);
                    }
                });
            });
            return Array.from(debtMap.entries())
                .map(([name, amount]) => ({ name, amount, type: 'owed' as const, ...participantContactInfo.get(name) }))
                .sort((a, b) => b.amount - a.amount);
        } else {
            const participantStats = new Map<string, { outstandingDebt: number; totalBilled: number }>();
            bills.forEach(bill => {
                // FIX: Added a nested loop to iterate through bill participants, resolving an issue where the participant variable 'p' was not defined.
                bill.participants.forEach(p => {
                    const stats = participantStats.get(p.name) || { outstandingDebt: 0, totalBilled: 0 };
                    stats.totalBilled += p.amountOwed;
                    if (!p.paid) stats.outstandingDebt += p.amountOwed;
                    participantStats.set(p.name, stats);
                });
            });
            return Array.from(participantStats.entries())
                .filter(([name, stats]) => stats.outstandingDebt < 0.01 && stats.totalBilled > 0 && name.trim().toLowerCase() !== myDisplayNameLower)
                .map(([name, stats]) => ({ name, amount: stats.totalBilled, type: 'paid' as const, ...participantContactInfo.get(name) }))
                .sort((a, b) => b.amount - a.amount);
        }
    }, [bills, dashboardStatusFilter, settings.myDisplayName]);


    const updateBill = useCallback(async (bill: Bill) => {
        const updatedBillFromDB = await originalUpdateBill(bill);
        if (updatedBillFromDB.shareInfo?.shareId) {
            syncSharedBillUpdate(updatedBillFromDB, settings, originalUpdateBill).catch(e => {
                console.error("Failed to sync shared bill update:", e);
                showNotification(e.message || "Failed to sync bill update to server", 'error');
            });
        }
        return updatedBillFromDB;
    }, [originalUpdateBill, settings, showNotification]);

    const checkAndMakeSpaceForImageShare = useCallback(async (billToShare: Bill): Promise<boolean> => {
        if (subscriptionStatus !== 'free' || !billToShare.receiptImage) {
            return true;
        }

        const sharedImageBills = bills.filter(b => 
            b.id !== billToShare.id &&
            b.status === 'active' && 
            !!b.shareInfo?.shareId && 
            !!b.receiptImage
        );

        if (sharedImageBills.length < FREE_TIER_IMAGE_SHARE_LIMIT) {
            return true;
        }

        const oldestBill = [...sharedImageBills].sort((a, b) => (a.lastUpdatedAt || 0) - (b.lastUpdatedAt || 0))[0];
        
        showNotification(`Free image limit reached. Removing image from "${oldestBill.description}" to make space.`, 'info');
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            await updateBill({ ...oldestBill, receiptImage: undefined });
            showNotification('Space freed. Proceeding with share.', 'success');
            return true;
        } catch (error: any) {
            console.error("Failed to automatically downgrade bill:", error);
            showNotification(`Error: ${error.message || 'Could not make space for the new image.'}`, 'error');
            return false;
        }
    }, [subscriptionStatus, bills, updateBill, showNotification]);

    const toggleDebugConsole = (enabled: boolean) => {
        sessionStorage.setItem('debugConsoleEnabled', String(enabled));
        setShowDebugConsole(enabled);
        showNotification(`Debug console ${enabled ? 'enabled' : 'disabled'} for this session.`);
    };
    
    useEffect(() => {
        const poll = async () => {
            const activeImported = importedBills.filter(b => b.status === 'active');
            if (activeImported.length > 0) {
                const billsToUpdate = await pollImportedBills(activeImported);
                if (billsToUpdate.length > 0) await updateMultipleImportedBills(billsToUpdate);
            }
        };
        const intervalId = setInterval(poll, 30 * 1000);
        poll();
        return () => clearInterval(intervalId);
    }, [importedBills, updateMultipleImportedBills]);

    useEffect(() => {
        const poll = async () => {
            const ownedShared = bills.filter(b => b.shareInfo?.shareId);
            if (ownedShared.length > 0) {
                const billsToUpdate = await pollOwnedSharedBills(ownedShared);
                if (billsToUpdate.length > 0) await updateMultipleBills(billsToUpdate);
            }
        };
        const intervalId = setInterval(poll, 5 * 60 * 1000);
        poll();
        return () => clearInterval(intervalId);
    }, [bills, updateMultipleBills]);

    useEffect(() => {
        if (!notificationService.isSupported()) return;
        const sync = async () => {
            if (settings.notificationsEnabled && Notification.permission === 'granted') {
                const active = recurringBills.filter(b => b.status === 'active');
                for (const bill of active) await notificationService.scheduleNotification(bill, settings.notificationDays);
                const registration = await navigator.serviceWorker.ready;
                const scheduled = await registration.getNotifications();
                for (const n of scheduled) {
                    const billId = n.tag.replace('bill-reminder-', '');
                    if (!active.some(b => b.id === billId)) await notificationService.cancelNotification(billId);
                }
            } else {
                for (const bill of recurringBills) await notificationService.cancelNotification(bill.id);
            }
        };
        sync().catch(err => console.error("Failed to sync notifications:", err));
    }, [settings.notificationsEnabled, settings.notificationDays, recurringBills]);


    const requestConfirmation: RequestConfirmationFn = (title, message, onConfirm, options) => setConfirmation({ title, message, onConfirm, options });

    const handleSaveBill = async (billData: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => {
        await addBill(billData);

        if (billData.groupId) {
            await incrementGroupPopularity(billData.groupId);
        }

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

    const handleSaveGroup = async (groupData: Omit<Group, 'id' | 'lastUpdatedAt' | 'popularity'>) => {
        await addGroup(groupData);
        showNotification(`Group "${groupData.name}" created!`);
    };

    const handleUpdateGroup = async (group: Group) => {
        await updateGroup(group);
        showNotification(`Group "${group.name}" updated!`);
    };
    
    const handleDeleteBill = (billId: string) => requestConfirmation('Delete Bill?', 'This action is permanent.', () => { deleteBill(billId); showNotification('Bill deleted.'); }, { confirmText: 'Delete', confirmVariant: 'danger' });
    const handleDeleteImportedBill = (billId: string) => requestConfirmation('Delete Imported Bill?', 'This removes it from your dashboard.', () => { deleteImportedBill(billId); showNotification('Imported bill deleted.'); }, { confirmText: 'Delete', confirmVariant: 'danger' });
    const handleDeleteRecurringBill = (billId: string) => requestConfirmation('Delete Template?', 'This action is permanent.', () => { deleteRecurringBill(billId); showNotification('Template deleted.'); }, { confirmText: 'Delete', confirmVariant: 'danger' });
    const handleDeleteGroup = (groupId: string) => requestConfirmation('Delete Group?', 'This action is permanent.', () => { deleteGroup(groupId); showNotification('Group deleted.'); }, { confirmText: 'Delete', confirmVariant: 'danger' });

    const handleReshareBill = async (billId: string) => {
        const bill = bills.find(b => b.id === billId);
        if (!bill) { showNotification("Bill not found.", 'error'); return; }
        try {
            const { lastUpdatedAt, updateToken } = await reactivateShare(bill, settings);
            await updateBill({ ...bill, shareStatus: 'live', lastUpdatedAt, shareInfo: { ...bill.shareInfo!, updateToken } });
            showNotification("Bill reshared successfully!");
        } catch (e: any) { showNotification(e.message || "Failed to reshare.", 'error'); }
    };
    
    const createFromTemplate = (template: RecurringBill) => {
        const newBill: Omit<Bill, 'id' | 'status'> = { ...template, participants: template.participants.map(p => ({ ...p, paid: false })), date: new Date().toISOString(), totalAmount: template.totalAmount || 0 };
        addBill(newBill);
        updateRecurringBillDueDate(template.id);
        showNotification(`Created bill from "${template.description}"`);
    };

    const currentBillId = routerState.params.billId || null;
    const currentImportedBillId = routerState.params.importedBillId || null;
    const currentBill = bills.find(b => b.id === currentBillId);
    const currentImportedBill = importedBills.find(b => b.id === currentImportedBillId);
    const isLoading = isBillsLoading || isImportedLoading || isRecurringLoading || isSettingsLoading || isGroupsLoading;

    return {
        view, params, currentBillId, currentImportedBillId, recurringBillToEdit, fromTemplate, billConversionSource, groupToEdit, currentGroup,
        confirmation, setConfirmation, settingsSection, setSettingsSection, isCsvImporterOpen, setIsCsvImporterOpen,
        isQrImporterOpen, setIsQrImporterOpen, showDebugConsole, toggleDebugConsole,
        dashboardView, selectedParticipant, dashboardStatusFilter, dashboardSummaryFilter, participantsData,
        onSetDashboardView: setDashboardView, onSetDashboardStatusFilter: setDashboardStatusFilter,
        onSetDashboardSummaryFilter: setDashboardSummaryFilter,
        settings, updateSettings, theme, setTheme, subscriptionStatus,
        bills, importedBills, recurringBills, groups, currentBill, currentImportedBill,
        isLoading, canInstall, promptInstall,
        navigate, requestConfirmation, updateBill, addImportedBill, updateImportedBill, updateMultipleImportedBills,
        handleSaveBill, handleSaveRecurringBill, handleUpdateRecurringBill, handleDeleteBill, handleDeleteImportedBill,
        handleDeleteRecurringBill, handleReshareBill, createFromTemplate,
        handleSaveGroup, handleUpdateGroup, handleDeleteGroup,
        addBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, mergeBills,
        archiveImportedBill, unarchiveImportedBill, mergeImportedBills,
        addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate,
        checkAndMakeSpaceForImageShare,
        onSelectParticipant: (name: string | null) => {
            if (name) {
                setDashboardView('participants');
            }
            setSelectedParticipant(name);
        },
        onClearParticipant: () => setSelectedParticipant(null)
    };
};