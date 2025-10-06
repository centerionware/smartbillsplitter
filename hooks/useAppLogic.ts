import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Bill, Settings, ImportedBill, RecurringBill, RequestConfirmationFn, SettingsSection, SummaryFilter, DashboardView, Group, Category } from '../types';
import { View } from '../types';
import type { ParticipantData } from '../components/ParticipantList';

// Hooks
import { useBills } from './useBills';
import { useImportedBills } from './useImportedBills';
import { useRecurringBills } from './useRecurringBills';
import { useGroups } from './useGroups';
import { useCategories } from './useCategories';
import { useSettings } from './useSettings';
import { useTheme } from './useTheme';
import { useAuth } from './useAuth';
import { useAppControl } from '../contexts/AppControlContext';
import { syncSharedBillUpdate, pollImportedBills, pollOwnedSharedBills, reactivateShare } from '../services/shareService';
import * as notificationService from '../services/notificationService';
import { usePwaInstall } from './usePwaInstall';
import { getApiUrl, fetchWithRetry } from '../services/api';

const FREE_TIER_IMAGE_SHARE_LIMIT = 5;

export const useAppLogic = () => {
    // --- Hooks ---
    const { settings, updateSettings, isLoading: isSettingsLoading } = useSettings();
    const { bills, addBill, updateBill: originalUpdateBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills: originalUpdateMultipleBills, mergeBills, isLoading: isBillsLoading } = useBills();
    const { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, mergeImportedBills, updateMultipleImportedBills, isLoading: isImportedLoading } = useImportedBills();
    const { recurringBills, addRecurringBill, updateRecurringBill, deleteRecurringBill, archiveRecurringBill, unarchiveRecurringBill, updateRecurringBillDueDate, isLoading: isRecurringLoading } = useRecurringBills();
    const { groups, addGroup, updateGroup, deleteGroup, incrementGroupPopularity, isLoading: isGroupsLoading } = useGroups();
    const { categories, saveCategories, deleteCategory, isLoading: isCategoriesLoading } = useCategories();
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
    const [budgetDate, setBudgetDate] = useState<{ year: number; month: number } | 'last30days'>('last30days');


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
        if (newParams.billId) { urlParams.set('billId', newParams.billId); }
        if (newParams.importedBillId) { urlParams.set('importedBillId', newParams.importedBillId); }
        
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

    // --- DERIVED DATA & LOGIC ---
    const isLoading = isBillsLoading || isImportedLoading || isRecurringLoading || isSettingsLoading || isGroupsLoading || isCategoriesLoading;

    const budgetData = useMemo(() => {
        const myNameLower = settings.myDisplayName.trim().toLowerCase();
        if (!myNameLower || isSettingsLoading || isCategoriesLoading || isBillsLoading || isImportedLoading) {
            return { totalBudget: 0, totalSpending: 0, spendingByCategory: {}, hasBudgetData: false };
        }

        let startDate: Date;
        let endDate = new Date();
        if (budgetDate === 'last30days') {
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);
            startDate.setHours(0,0,0,0);
        } else {
            startDate = new Date(budgetDate.year, budgetDate.month, 1);
            endDate = new Date(budgetDate.year, budgetDate.month + 1, 0);
            endDate.setHours(23, 59, 59, 999);
        }

        const relevantUserBills: { billId: string; description: string; userPortion: number; date: string; categoryId?: string; isImported: boolean }[] = [];
        
        bills.forEach(bill => {
            const billDate = new Date(bill.date);
            if (bill.status === 'active' && billDate >= startDate && billDate <= endDate) {
                const myParticipant = bill.participants.find(p => p.name.trim().toLowerCase() === myNameLower);
                if (myParticipant) {
                    const userPortion = bill.participants.length === 1 && bill.participants[0].name.trim().toLowerCase() === myNameLower ? bill.totalAmount : myParticipant.amountOwed;
                    if (userPortion > 0) {
                        relevantUserBills.push({
                            billId: bill.id, description: bill.description, userPortion, date: bill.date, categoryId: bill.categoryId, isImported: false
                        });
                    }
                }
            }
        });

        importedBills.forEach(iBill => {
            const bill = iBill.sharedData.bill;
            const billDate = new Date(bill.date);
            if (iBill.status === 'active' && billDate >= startDate && billDate <= endDate && iBill.myParticipantId) {
                const myParticipant = bill.participants.find(p => p.id === iBill.myParticipantId);
                if (myParticipant) {
                    const userPortion = myParticipant.amountOwed;
                    if (userPortion > 0) {
                        relevantUserBills.push({
                            billId: iBill.id, description: bill.description, userPortion, date: bill.date, categoryId: bill.categoryId, isImported: true
                        });
                    }
                }
            }
        });
        
        const spendingByCategory: Record<string, any> = {};
        let totalSpending = 0;

        relevantUserBills.forEach(bill => {
            totalSpending += bill.userPortion;
            const categoryId = bill.categoryId;
            const category = categories.find(c => c.id === categoryId);
            
            const targetId = category ? category.id : 'uncategorized';

            if (!spendingByCategory[targetId]) {
                spendingByCategory[targetId] = {
                    category: category || { id: 'uncategorized', name: 'Uncategorized' },
                    spent: 0,
                    bills: []
                };
            }
            spendingByCategory[targetId].spent += bill.userPortion;
            spendingByCategory[targetId].bills.push(bill);
        });

        let totalBudget = settings.totalBudget || 0;
        if (!settings.totalBudget || settings.totalBudget === 0) {
            totalBudget = categories.reduce((sum, cat) => sum + (cat.budget || 0), 0);
        }

        const hasAnyBillsWithCategory = bills.some(b => b.categoryId) || importedBills.some(b => b.sharedData.bill.categoryId);
        const hasAnyBudgetSet = totalBudget > 0 || categories.some(c => c.budget && c.budget > 0);

        return {
            totalBudget,
            totalSpending,
            spendingByCategory,
            hasBudgetData: hasAnyBillsWithCategory || hasAnyBudgetSet
        };
    }, [bills, importedBills, categories, settings, budgetDate, isSettingsLoading, isCategoriesLoading, isBillsLoading, isImportedLoading]);

    // ... (other useMemo and useCallback hooks from the original file remain here, unchanged)
    
    // --- CALLBACKS & HANDLERS ---
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
    
    const updateBill = useCallback(async (bill: Bill): Promise<Bill> => {
        const updatedBill = await originalUpdateBill(bill);
        (async () => {
            if (updatedBill.shareInfo?.shareId) {
                console.log(`[Sync] Initiating update for shared bill: ${updatedBill.id}`);
                try {
                    const res = await fetchWithRetry(await getApiUrl(`/share/${updatedBill.shareInfo.shareId}`), { 
                        method: 'GET', 
                        signal: AbortSignal.timeout(4000) 
                    });
                    
                    if (res.status === 404) {
                        console.log(`[Sync] Share for bill ${updatedBill.id} not found on server. Re-creating...`);
                        const { lastUpdatedAt, updateToken } = await reactivateShare(updatedBill, settings);
                        await originalUpdateBill({ ...updatedBill, shareStatus: 'live', lastUpdatedAt, shareInfo: { ...updatedBill.shareInfo!, updateToken } });
                        console.log(`[Sync] Successfully re-created share for bill ${updatedBill.id}.`);
                    } else if (res.ok) {
                        console.log(`[Sync] Share for bill ${updatedBill.id} is live. Pushing update...`);
                        await syncSharedBillUpdate(updatedBill, settings, originalUpdateBill);
                        console.log(`[Sync] Successfully synced update for bill ${updatedBill.id}.`);
                    } else {
                        const errorData = await res.json().catch(() => ({}));
                        throw new Error(errorData.error || `Server returned status ${res.status} during share check.`);
                    }
                } catch (e: any) {
                    console.error(`[Sync] Failed to sync shared bill update for bill ID ${updatedBill.id}:`, e);
                    showNotification(e.message || `Failed to sync update for "${updatedBill.description}"`, 'error');
                    await originalUpdateBill({ ...updatedBill, shareStatus: 'error' });
                }
            } else {
                console.log(`[Sync] Skipped for bill ${updatedBill.id}: not a shared bill.`);
            }
        })();
        return updatedBill;
    }, [originalUpdateBill, settings, showNotification]);

    const updateMultipleBills = useCallback(async (billsToUpdate: Bill[]): Promise<void> => {
        const updatedBills = await originalUpdateMultipleBills(billsToUpdate);
        (async () => {
            for (const bill of updatedBills) {
                if (bill.shareInfo?.shareId) {
                    console.log(`[Sync] Initiating update for shared bill in batch: ${bill.id}`);
                    try {
                        const res = await fetchWithRetry(await getApiUrl(`/share/${bill.shareInfo.shareId}`), { 
                            method: 'GET', 
                            signal: AbortSignal.timeout(4000) 
                        });

                        if (res.status === 404) {
                             console.log(`[Sync] Share for bill ${bill.id} not found on server. Re-creating...`);
                            const { lastUpdatedAt, updateToken } = await reactivateShare(bill, settings);
                            await originalUpdateBill({ ...bill, shareStatus: 'live', lastUpdatedAt, shareInfo: { ...bill.shareInfo!, updateToken } });
                        } else if (res.ok) {
                            await syncSharedBillUpdate(bill, settings, originalUpdateBill);
                        } else {
                           throw new Error(`Server returned status ${res.status} during share check.`);
                        }
                    } catch (e: any) {
                        console.error(`[Sync] Failed to sync shared bill update for bill ID ${bill.id}:`, e);
                        showNotification(e.message || `Failed to sync update for "${bill.description}"`, 'error');
                        await originalUpdateBill({ ...bill, shareStatus: 'error' });
                    }
                }
            }
        })();
    }, [originalUpdateMultipleBills, settings, showNotification, originalUpdateBill]);

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
                if (billsToUpdate.length > 0) await originalUpdateMultipleBills(billsToUpdate);
            }
        };
        const intervalId = setInterval(poll, 5 * 60 * 1000);
        poll();
        return () => clearInterval(intervalId);
    }, [bills, originalUpdateMultipleBills]);

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
    
    const handleSelectBillFromBudget = (billInfo: { billId: string; isImported: boolean }) => {
        if (billInfo.isImported) {
            navigate(View.ImportedBillDetails, { importedBillId: billInfo.billId });
        } else {
            navigate(View.BillDetails, { billId: billInfo.billId });
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

    return {
        view, params, currentBillId, currentImportedBillId, recurringBillToEdit, fromTemplate, billConversionSource, groupToEdit, currentGroup,
        confirmation, setConfirmation, settingsSection, setSettingsSection, isCsvImporterOpen, setIsCsvImporterOpen,
        isQrImporterOpen, setIsQrImporterOpen, showDebugConsole, toggleDebugConsole,
        dashboardView, selectedParticipant, dashboardStatusFilter, dashboardSummaryFilter, participantsData,
        onSetDashboardView: setDashboardView, onSetDashboardStatusFilter: setDashboardStatusFilter,
        onSetDashboardSummaryFilter: setDashboardSummaryFilter,
        settings, updateSettings, theme, setTheme, subscriptionStatus,
        bills, importedBills, recurringBills, groups, categories, currentBill, currentImportedBill,
        isLoading, canInstall, promptInstall,
        navigate, requestConfirmation, updateBill, addImportedBill, updateImportedBill, updateMultipleImportedBills,
        handleSaveBill, handleSaveRecurringBill, handleUpdateRecurringBill, handleDeleteBill, handleDeleteImportedBill,
        handleDeleteRecurringBill, handleReshareBill, createFromTemplate,
        handleSaveGroup, handleUpdateGroup, handleDeleteGroup,
        saveCategories, deleteCategory, budgetData, budgetDate, setBudgetDate, handleSelectBillFromBudget,
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
