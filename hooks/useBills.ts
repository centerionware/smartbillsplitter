

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

const sortBills = (b: Bill[]) => b.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const useBills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadBills = useCallback(async (isInitialLoad: boolean = false) => {
    if (isInitialLoad) setIsLoading(true);
    try {
      let dbBills = await getBills();

      if (isInitialLoad && dbBills.length === 0 && !localStorage.getItem('sharedbills.defaultDataLoaded')) {
          console.log("First launch: creating default example bills.");
          const defaultBills = createDefaultBills();
          await addMultipleBillsDB(defaultBills);
          dbBills.push(...defaultBills);
          localStorage.setItem('sharedbills.defaultDataLoaded', 'true');
      }
      
      setBills(sortBills(dbBills));
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
    setBills(prev => sortBills([newBill, ...prev]));
    postMessage({ type: 'bills-updated' });
  }, []);

  const updateBill = useCallback(async (updatedBill: Bill): Promise<Bill> => {
    const billWithTimestamp = { ...updatedBill, lastUpdatedAt: Date.now() };
    await updateBillDB(billWithTimestamp);
    setBills(prev => sortBills(prev.map(b => b.id === billWithTimestamp.id ? billWithTimestamp : b)));
    postMessage({ type: 'bills-updated' });
    return billWithTimestamp;
  }, []);
  
  const updateMultipleBills = useCallback(async (billsToUpdate: Bill[]): Promise<Bill[]> => {
      const now = Date.now();
      const billsWithTimestamp = billsToUpdate.map(b => ({ ...b, lastUpdatedAt: now }));
      await mergeBillsDB([], billsWithTimestamp);
      const updatedMap = new Map(billsWithTimestamp.map(b => [b.id, b]));
      setBills(prev => sortBills(prev.map(b => updatedMap.get(b.id) || b)));
      postMessage({ type: 'bills-updated' });
      return billsWithTimestamp;
  }, []);

  const deleteBill = useCallback(async (billId: string) => {
    await deleteBillDB(billId);
    setBills(prev => prev.filter(b => b.id !== billId));
    postMessage({ type: 'bills-updated' });
  }, []);

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

      // FIX: Replaced forEach with for...of loop to resolve TypeScript inference issues.
      for (const billToProcess of billsToMerge) {
          const existingBill = existingBillMap.get(billToProcess.id);

          if (existingBill) {
              if ((billToProcess.lastUpdatedAt ?? 0) > (existingBill.lastUpdatedAt ?? 0)) {
                  billsToUpdate.push({ ...existingBill, ...billToProcess, status: existingBill.status });
              } else {
                  skippedCount++;
              }
          } else {
              billsToAdd.push({ ...billToProcess, status: 'active' });
          }
      }

      if (billsToAdd.length > 0 || billsToUpdate.length > 0) {
          await mergeBillsDB(billsToAdd, billsToUpdate);
          setBills(prev => {
              const prevMap = new Map(prev.map(b => [b.id, b]));
              billsToUpdate.forEach(b => prevMap.set(b.id, b));
              billsToAdd.forEach(b => prevMap.set(b.id, b));
              return sortBills(Array.from(prevMap.values()));
          });
          postMessage({ type: 'bills-updated' });
      }

      return { added: billsToAdd.length, updated: billsToUpdate.length, skipped: skippedCount };
  }, [bills]);

  return { bills, isLoading, addBill, updateBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, mergeBills };
};