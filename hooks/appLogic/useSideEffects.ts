import { useEffect } from 'react';
import { pollImportedBills, pollOwnedSharedBills } from '../../services/shareService';
import * as notificationService from '../../services/notificationService';
import type { Bill, ImportedBill, RecurringBill, Settings } from '../../types';

interface SideEffectsDependencies {
    bills: Bill[];
    importedBills: ImportedBill[];
    recurringBills: RecurringBill[];
    settings: Settings;
    updateMultipleImportedBills: (bills: ImportedBill[]) => void;
    originalUpdateMultipleBills: (bills: Bill[]) => Promise<Bill[]>;
}

export const useSideEffects = ({
    bills, importedBills, recurringBills, settings,
    updateMultipleImportedBills, originalUpdateMultipleBills
}: SideEffectsDependencies) => {
    
    // Polling for imported bills
    useEffect(() => {
        const poll = async () => {
            const activeImported = importedBills.filter(b => b.status === 'active');
            if (activeImported.length > 0) {
                const billsToUpdate = await pollImportedBills(activeImported);
                if (billsToUpdate.length > 0) await updateMultipleImportedBills(billsToUpdate);
            }
        };
        const intervalId = setInterval(poll, 30 * 1000);
        poll(); // Initial poll
        return () => clearInterval(intervalId);
    }, [importedBills, updateMultipleImportedBills]);

    // Polling for owned bills
    useEffect(() => {
        const poll = async () => {
            const ownedShared = bills.filter(b => b.shareInfo?.shareId);
            if (ownedShared.length > 0) {
                const billsToUpdate = await pollOwnedSharedBills(ownedShared);
                if (billsToUpdate.length > 0) await originalUpdateMultipleBills(billsToUpdate);
            }
        };
        const intervalId = setInterval(poll, 5 * 60 * 1000);
        poll(); // Initial poll
        return () => clearInterval(intervalId);
    }, [bills, originalUpdateMultipleBills]);

    // Notification syncing
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
};
