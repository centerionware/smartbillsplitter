import { useState, useEffect, useCallback } from 'react';
import type { RecurringBill, RecurrenceRule } from '../types';
import { getRecurringBills, addRecurringBill as addDB, updateRecurringBill as updateDB, deleteRecurringBillDB } from '../services/db';
import { postMessage, useBroadcastListener } from '../services/broadcastService';

/**
 * Calculates the *first* upcoming due date for a *new* recurring bill template.
 * It finds the next valid date after today that matches the rule's constraints.
 * @param rule The recurrence rule.
 * @param fromDate The date to start searching from (typically today).
 * @returns An ISO string of the first due date.
 */
const calculateFirstDueDate = (rule: RecurrenceRule, fromDate: Date): string => {
    const today = new Date(fromDate);
    today.setHours(0, 0, 0, 0);
    let dt = new Date(today);

    switch (rule.frequency) {
        case 'daily':
            dt.setDate(today.getDate() + 1);
            break;
        case 'weekly':
            const dayOfWeek = rule.dayOfWeek ?? 0;
            // Start searching from tomorrow to ensure the date is in the future
            dt.setDate(today.getDate() + 1);
            while (dt.getDay() !== dayOfWeek) {
                dt.setDate(dt.getDate() + 1);
            }
            break;
        case 'monthly':
            const dayOfMonth = rule.dayOfMonth ?? 1;
            // Check if the target day is still upcoming in the current month
            if (today.getDate() < dayOfMonth) {
                const lastDayCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                if (dayOfMonth <= lastDayCurrentMonth) {
                    dt.setDate(dayOfMonth); // Valid date found this month
                    break; // Exit switch
                }
            }
            // If not, find the next valid day in a future month
            dt.setMonth(today.getMonth() + 1, 1);
            const lastDayNextMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
            dt.setDate(Math.min(dayOfMonth, lastDayNextMonth));
            break;
        case 'yearly':
            // Simple approach: jump one year. Assumes same month/day.
            dt.setFullYear(today.getFullYear() + 1);
            break;
    }
    return dt.toISOString();
};


/**
 * Calculates the next due date based on the *previous* due date and the rule's interval.
 * @param rule The recurrence rule, including the interval.
 * @param fromDate The last due date.
 * @returns An ISO string of the next due date in the sequence.
 */
export const calculateNextDueDate = (rule: RecurrenceRule, fromDate: string | Date): string => {
    const dt = new Date(fromDate);
    const interval = rule.interval || 1;
    
    switch (rule.frequency) {
        case 'daily':
            dt.setDate(dt.getDate() + interval);
            break;
        case 'weekly':
            dt.setDate(dt.getDate() + 7 * interval);
            break;
        case 'monthly':
            // Get target day before changing month, in case it was adjusted for a short month
            const dayOfMonth = rule.dayOfMonth ?? new Date(fromDate).getDate();
            // Move to the target month
            dt.setMonth(dt.getMonth() + interval, 1);
            // Get the last day of the new target month
            const lastDayOfNextMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
            // Set the day, capped at the last day of the month
            dt.setDate(Math.min(dayOfMonth, lastDayOfNextMonth));
            break;
        case 'yearly':
            dt.setFullYear(dt.getFullYear() + interval);
            break;
    }
    return dt.toISOString();
};


export const useRecurringBills = () => {
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecurringBills = useCallback(async (isInitialLoad: boolean = false) => {
      if (isInitialLoad) setIsLoading(true);
      try {
        let dbBills = await getRecurringBills();
        dbBills.sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
        setRecurringBills(dbBills);
      } catch (err) {
        console.error("Failed to load recurring bills:", err);
      } finally {
        if (isInitialLoad) setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    loadRecurringBills(true);
  }, [loadRecurringBills]);

  useBroadcastListener(useCallback(message => {
    if (message.type === 'recurring-bills-updated') {
        loadRecurringBills(false);
    }
  }, [loadRecurringBills]));
  
  const addRecurringBill = useCallback(async (newBillData: Omit<RecurringBill, 'id' | 'status' | 'nextDueDate'>) => {
    const newBill: RecurringBill = {
      ...newBillData,
      id: `rb-${Date.now()}`,
      status: 'active',
      nextDueDate: calculateFirstDueDate(newBillData.recurrenceRule, new Date()),
    };
    await addDB(newBill);
    await loadRecurringBills(false);
    postMessage({ type: 'recurring-bills-updated' });
    return newBill;
  }, [loadRecurringBills]);

  const updateRecurringBill = useCallback(async (updatedBill: RecurringBill) => {
    const originalBill = recurringBills.find(b => b.id === updatedBill.id);
    if (originalBill && JSON.stringify(originalBill.recurrenceRule) !== JSON.stringify(updatedBill.recurrenceRule)) {
        updatedBill.nextDueDate = calculateFirstDueDate(updatedBill.recurrenceRule, new Date());
    }
    await updateDB(updatedBill);
    await loadRecurringBills(false);
    postMessage({ type: 'recurring-bills-updated' });
  }, [recurringBills, loadRecurringBills]);
  
  const updateRecurringBillDueDate = useCallback(async (billId: string) => {
    const billToUpdate = recurringBills.find(b => b.id === billId);
    if (billToUpdate) {
        const updatedBill = {
            ...billToUpdate,
            nextDueDate: calculateNextDueDate(billToUpdate.recurrenceRule, billToUpdate.nextDueDate)
        };
        await updateDB(updatedBill);
        await loadRecurringBills(false);
        postMessage({ type: 'recurring-bills-updated' });
    }
  }, [recurringBills, loadRecurringBills]);

  const archiveRecurringBill = useCallback(async (billId: string) => {
    const billToUpdate = recurringBills.find(b => b.id === billId);
    if (billToUpdate) {
      const updatedBill = { ...billToUpdate, status: 'archived' as const };
      await updateDB(updatedBill);
      await loadRecurringBills(false);
      postMessage({ type: 'recurring-bills-updated' });
    }
  }, [recurringBills, loadRecurringBills]);
  
  const unarchiveRecurringBill = useCallback(async (billId: string) => {
    const billToUpdate = recurringBills.find(b => b.id === billId);
    if (billToUpdate) {
      const updatedBill = { ...billToUpdate, status: 'active' as const, nextDueDate: calculateFirstDueDate(billToUpdate.recurrenceRule, new Date()) };
      await updateDB(updatedBill);
      await loadRecurringBills(false);
      postMessage({ type: 'recurring-bills-updated' });
    }
  }, [recurringBills, loadRecurringBills]);

  const deleteRecurringBill = useCallback(async (billId: string) => {
    await deleteRecurringBillDB(billId);
    await loadRecurringBills(false);
    postMessage({ type: 'recurring-bills-updated' });
  }, [loadRecurringBills]);

  return { recurringBills, addRecurringBill, updateRecurringBill, archiveRecurringBill, unarchiveRecurringBill, deleteRecurringBill, updateRecurringBillDueDate, isLoading };
};