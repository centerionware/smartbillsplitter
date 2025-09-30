import { useState, useEffect, useCallback } from 'react';
import type { Bill, Participant } from '../types';
import { getBills, addBill as addBillDB, updateBill as updateBillDB, deleteBillDB, addMultipleBillsDB, mergeBillsDB } from '../services/db';
import { postMessage, useBroadcastListener } from '../services/broadcastService';

const createDefaultBills = (): Bill[] => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const defaultBills: Bill[] = [
        {
            id: `bill-${Date.now() - 1000}`,
            description: "Morning Coffee Run",
            totalAmount: 12.75,
            date: yesterday.toISOString(),
            status: 'active',
            participants: [
                { id: 'p1', name: 'Myself', amountOwed: 4.25, paid: true },
                { id: 'p2', name: 'Alex', amountOwed: 4.25, paid: false },
                { id: 'p3', name: 'Casey', amountOwed: 4.25, paid: false },
            ],
            lastUpdatedAt: Date.now(),
        },
        {
            id: `bill-${Date.now() - 2000}`,
            description: "Movie Night Tickets",
            totalAmount: 30.00,
            date: new Date(today.setDate(today.getDate() - 7)).toISOString(),
            status: 'archived',
            participants: [
                { id: 'p1', name: 'Myself', amountOwed: 15.00, paid: true },
                { id: 'p2', name: 'Jordan', amountOwed: 15.00, paid: true },
            ],
            lastUpdatedAt: Date.now() - 10000,
        }
    ];
    return defaultBills;
};


export const useBills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadBills = useCallback(async (isInitialLoad: boolean = false) => {
    if (isInitialLoad) setIsLoading(true);
    try {
      const dbBills = await getBills();

      if (isInitialLoad && dbBills.length === 0 && !localStorage.getItem('sharedbills.defaultDataLoaded')) {
          console.log("First launch: creating default example bills.");
          const defaultBills = createDefaultBills();
          await addMultipleBillsDB(defaultBills);
          dbBills.push(...defaultBills);
          localStorage.setItem('sharedbills.defaultDataLoaded', 'true');
      }
      
      dbBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setBills(dbBills);
    } catch (error) {
      console.error("Failed to load bills from IndexedDB:", error);
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills(true);
  }, [loadBills]);

  useBroadcastListener(useCallback(message => {
    if (message.type === 'bills-updated') {
      loadBills(false);
    }
  }, [loadBills]));

  const addBill = useCallback(async (newBillData: Omit<Bill, 'id' | 'status'>) => {
    const newBill: Bill = {
      ...newBillData,
      id: `bill-${Date.now()}`,
      status: 'active',
      lastUpdatedAt: Date.now(),
    };
    await addBillDB(newBill);
    postMessage({ type: 'bills-updated' });
    await loadBills(false);
  }, [loadBills]);

  const updateBill = useCallback(async (updatedBill: Bill): Promise<Bill> => {
    const billWithTimestamp = { ...updatedBill, lastUpdatedAt: Date.now() };
    await updateBillDB(billWithTimestamp);
    postMessage({ type: 'bills-updated' });
    await loadBills(false);
    return billWithTimestamp;
  }, [loadBills]);
  
  const updateMultipleBills = useCallback(async (billsToUpdate: Bill[]) => {
      const now = Date.now();
      const billsWithTimestamp = billsToUpdate.map(b => ({ ...b, lastUpdatedAt: now }));
      await mergeBillsDB([], billsWithTimestamp);
      postMessage({ type: 'bills-updated' });
      await loadBills(false);
  }, [loadBills]);

  const deleteBill = useCallback(async (billId: string) => {
    await deleteBillDB(billId);
    postMessage({ type: 'bills-updated' });
    await loadBills(false);
  }, [loadBills]);

  const archiveBill = useCallback(async (billId: string) => {
    const billToUpdate = bills.find(b => b.id === billId);
    if (billToUpdate) {
      await updateBill({ ...billToUpdate, status: 'archived' });
    }
  }, [bills, updateBill]);

  const unarchiveBill = useCallback(async (billId: string) => {
    const billToUpdate = bills.find(b => b.id === billId);
    if (billToUpdate) {
      await updateBill({ ...billToUpdate, status: 'active' });
    }
  }, [bills, updateBill]);

  const mergeBills = useCallback(async (billsToMerge: (Omit<Bill, 'status'>)[]) => {
      const existingBillMap = new Map(bills.map(b => [b.id, b]));
      const billsToAdd: Bill[] = [];
      const billsToUpdate: Bill[] = [];
      let skippedCount = 0;

      // FIX: Explicitly cast `incomingBill` to its correct type `Omit<Bill, 'status'>`. This resolves a TypeScript inference issue where `incomingBill` was incorrectly typed as 'unknown', causing errors when accessing its properties.
      for (const incomingBill of billsToMerge) {
          const typedIncomingBill = incomingBill as Omit<Bill, 'status'>;
          const existingBill = existingBillMap.get(typedIncomingBill.id);

          if (existingBill) {
              if ((typedIncomingBill.lastUpdatedAt ?? 0) > (existingBill.lastUpdatedAt ?? 0)) {
                  billsToUpdate.push({ ...existingBill, ...typedIncomingBill, status: existingBill.status });
              } else {
                  skippedCount++;
              }
          } else {
              billsToAdd.push({ ...typedIncomingBill, status: 'active' });
          }
      }

      if (billsToAdd.length > 0 || billsToUpdate.length > 0) {
          await mergeBillsDB(billsToAdd, billsToUpdate);
          postMessage({ type: 'bills-updated' });
          await loadBills(false);
      }

      return { added: billsToAdd.length, updated: billsToUpdate.length, skipped: skippedCount };
  }, [bills, loadBills]);

  return { bills, isLoading, addBill, updateBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, mergeBills };
};