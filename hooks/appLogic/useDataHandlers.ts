import { useCallback } from 'react';
import { View } from '../../types';
import type { Bill, ImportedBill, RecurringBill, RequestConfirmationFn, Settings, Group } from '../../types';
import type { SubscriptionStatus } from '../../hooks/useAuth';
import { useAppControl } from '../../contexts/AppControlContext';
import { syncSharedBillUpdate, reactivateShare } from '../../services/shareService';
import { getApiUrl, fetchWithRetry } from '../../services/api';

const FREE_TIER_IMAGE_SHARE_LIMIT = 5;

// Define a type for all the data-modifying functions from the base hooks
interface DataMutators {
    originalUpdateBill: (bill: Bill) => Promise<Bill>;
    originalUpdateMultipleBills: (bills: Bill[]) => Promise<Bill[]>;
    addBill: (billData: Omit<Bill, 'id' | 'status'>) => Promise<void>;
    deleteBill: (billId: string) => Promise<void>;
    addImportedBill: (bill: ImportedBill) => Promise<void>;
    deleteImportedBill: (billId: string) => Promise<void>;
    addRecurringBill: (billData: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => Promise<RecurringBill>;
    updateRecurringBill: (bill: RecurringBill) => Promise<void>;
    deleteRecurringBill: (billId: string) => Promise<void>;
    updateRecurringBillDueDate: (billId: string) => Promise<void>;
    addGroup: (groupData: Omit<Group, 'id' | 'lastUpdatedAt' | 'popularity'>) => Promise<Group>;
    updateGroup: (group: Group) => Promise<void>;
    deleteGroup: (groupId: string) => Promise<void>;
    incrementGroupPopularity: (groupId: string) => Promise<void>;
}

interface HandlerDependencies extends DataMutators {
    bills: Bill[];
    recurringBills: RecurringBill[];
    settings: Settings;
    subscriptionStatus: SubscriptionStatus;
    showNotification: (message: string, type?: 'success' | 'info' | 'error') => void;
    requestConfirmation: RequestConfirmationFn;
    navigate: (view: View, params?: any) => void;
}

export const useDataHandlers = ({
    bills, recurringBills, settings, subscriptionStatus,
    showNotification, requestConfirmation, navigate,
    originalUpdateBill, originalUpdateMultipleBills, addBill, deleteBill,
    addImportedBill, deleteImportedBill,
    addRecurringBill, updateRecurringBill, deleteRecurringBill, updateRecurringBillDueDate,
    addGroup, updateGroup, deleteGroup, incrementGroupPopularity
}: HandlerDependencies) => {
    
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

    const handleSaveBill = useCallback(async (billData: Omit<Bill, 'id' | 'status'>, fromTemplateId?: string) => {
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
    }, [addBill, incrementGroupPopularity, updateRecurringBillDueDate, recurringBills, showNotification]);
    
    const handleSelectBillFromBudget = useCallback((billInfo: { billId: string; isImported: boolean }) => {
        if (billInfo.isImported) {
            navigate(View.ImportedBillDetails, { importedBillId: billInfo.billId });
        } else {
            navigate(View.BillDetails, { billId: billInfo.billId });
        }
    }, [navigate]);

    const handleSaveRecurringBill = useCallback(async (billData: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => {
        await addRecurringBill(billData);
        showNotification('Recurring template created!');
    }, [addRecurringBill, showNotification]);
    
    const handleUpdateRecurringBill = useCallback(async (bill: RecurringBill) => {
        await updateRecurringBill(bill);
        showNotification('Template updated successfully!');
    }, [updateRecurringBill, showNotification]);

    const handleSaveGroup = useCallback(async (groupData: Omit<Group, 'id' | 'lastUpdatedAt' | 'popularity'>) => {
        await addGroup(groupData);
        showNotification(`Group "${groupData.name}" created!`);
    }, [addGroup, showNotification]);

    const handleUpdateGroup = useCallback(async (group: Group) => {
        await updateGroup(group);
        showNotification(`Group "${group.name}" updated!`);
    }, [updateGroup, showNotification]);
    
    const handleDeleteBill = useCallback((billId: string) => requestConfirmation('Delete Bill?', 'This action is permanent.', () => { deleteBill(billId); showNotification('Bill deleted.'); }, { confirmText: 'Delete', confirmVariant: 'danger' }), [requestConfirmation, deleteBill, showNotification]);
    const handleDeleteImportedBill = useCallback((billId: string) => requestConfirmation('Delete Imported Bill?', 'This removes it from your dashboard.', () => { deleteImportedBill(billId); showNotification('Imported bill deleted.'); }, { confirmText: 'Delete', confirmVariant: 'danger' }), [requestConfirmation, deleteImportedBill, showNotification]);
    const handleDeleteRecurringBill = useCallback((billId: string) => requestConfirmation('Delete Template?', 'This action is permanent.', () => { deleteRecurringBill(billId); showNotification('Template deleted.'); }, { confirmText: 'Delete', confirmVariant: 'danger' }), [requestConfirmation, deleteRecurringBill, showNotification]);
    const handleDeleteGroup = useCallback((groupId: string) => requestConfirmation('Delete Group?', 'This action is permanent.', () => { deleteGroup(groupId); showNotification('Group deleted.'); }, { confirmText: 'Delete', confirmVariant: 'danger' }), [requestConfirmation, deleteGroup, showNotification]);

    const handleReshareBill = useCallback(async (billId: string) => {
        const bill = bills.find(b => b.id === billId);
        if (!bill) { showNotification("Bill not found.", 'error'); return; }
        try {
            const { lastUpdatedAt, updateToken } = await reactivateShare(bill, settings);
            await updateBill({ ...bill, shareStatus: 'live', lastUpdatedAt, shareInfo: { ...bill.shareInfo!, updateToken } });
            showNotification("Bill reshared successfully!");
        } catch (e: any) { showNotification(e.message || "Failed to reshare.", 'error'); }
    }, [bills, settings, updateBill, showNotification]);
    
    const createFromTemplate = useCallback((template: RecurringBill) => {
        const newBill: Omit<Bill, 'id' | 'status'> = { ...template, participants: template.participants.map(p => ({ ...p, paid: false })), date: new Date().toISOString(), totalAmount: template.totalAmount || 0 };
        addBill(newBill);
        updateRecurringBillDueDate(template.id);
        showNotification(`Created bill from "${template.description}"`);
    }, [addBill, updateRecurringBillDueDate, showNotification]);
    
    return {
        updateBill,
        updateMultipleBills,
        checkAndMakeSpaceForImageShare,
        handleSaveBill,
        handleSelectBillFromBudget,
        handleSaveRecurringBill,
        handleUpdateRecurringBill,
        handleSaveGroup,
        handleUpdateGroup,
        handleDeleteBill,
        handleDeleteImportedBill,
        handleDeleteRecurringBill,
        handleDeleteGroup,
        handleReshareBill,
        createFromTemplate,
    };
};
