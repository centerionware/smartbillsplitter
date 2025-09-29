import { useState, useEffect, useCallback } from 'react';
import type { Bill, Participant } from '../types';
import { getBills, addBill as addBillDB, updateBill as updateBillDB, deleteBillDB, addMultipleBillsDB, mergeBillsDB } from '../services/db';

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

  useEffect(() => {
    const loadBills = async () => {
      try {
        setIsLoading(true);
        const dbBills = await getBills();

        // Check if DB is empty and if we've never loaded defaults before
        if (dbBills.length === 0 && !localStorage.getItem('sharedbills.defaultDataLoaded')) {
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
        setIsLoading(false);
      }
    };
    loadBills();
  }, []);

  const addBill = useCallback(async (newBillData: Omit<Bill, 'id' | 'status'>) => {
    const newBill: Bill = {
      ...newBillData,
      id: `bill-${Date.now()}`,
      status: 'active',
      lastUpdatedAt: Date.now(),
    };
    await addBillDB(newBill);
    setBills(prevBills => [newBill, ...prevBills]);
  }, []);

  const updateBill = useCallback(async (updatedBill: Bill) => {
    const billWithTimestamp = { ...updatedBill, lastUpdatedAt: Date.now() };
    await updateBillDB(billWithTimestamp);
    setBills(prevBills => {
      const updated = prevBills.map(bill => (bill.id === billWithTimestamp.id ? billWithTimestamp : bill));
      updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return updated;
    });
  }, []);
  
  const updateMultipleBills = useCallback(async (billsToUpdate: Bill[]) => {
      const now = Date.now();
      const billsWithTimestamp = billsToUpdate.map(b => ({ ...b, lastUpdatedAt: now }));
      const tx = mergeBillsDB([], billsWithTimestamp);
      await tx;
      setBills(prev => {
          const updatedMap = new Map(billsWithTimestamp.map(b => [b.id, b]));
          const updated = prev.map(b => updatedMap.get(b.id) || b);
          updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          return updated;
      });
  }, []);

  const deleteBill = useCallback(async (billId: string) => {
    await deleteBillDB(billId);
    setBills(prevBills => prevBills.filter(bill => bill.id !== billId));
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

      // FIX: Switched from forEach to a for...of loop to ensure correct type inference for `incomingBill`, resolving errors with accessing its properties.
      for (const incomingBill of billsToMerge) {
          const existingBill = existingBillMap.get(incomingBill.id);

          if (existingBill) {
              if ((incomingBill.lastUpdatedAt ?? 0) > (existingBill.lastUpdatedAt ?? 0)) {
                  billsToUpdate.push({ ...existingBill, ...incomingBill, status: existingBill.status });
              } else {
                  skippedCount++;
              }
          } else {
              billsToAdd.push({ ...incomingBill, status: 'active' });
          }
      }

      if (billsToAdd.length > 0 || billsToUpdate.length > 0) {
          await mergeBillsDB(billsToAdd, billsToUpdate);
          setBills(prev => {
              const updatedMap = new Map(billsToUpdate.map(b => [b.id, b]));
              const currentBillsMap = new Map(prev.map(b => [b.id, b]));
              updatedMap.forEach((value, key) => currentBillsMap.set(key, value));
              const finalBills = [...Array.from(currentBillsMap.values()), ...billsToAdd];
              finalBills.sort((a: Bill, b: Bill) => new Date(b.date).getTime() - new Date(a.date).getTime());
              return finalBills;
          });
      }

      return { added: billsToAdd.length, updated: billsToUpdate.length, skipped: skippedCount };
  }, [bills]);

  return { bills, isLoading, addBill, updateBill, deleteBill, archiveBill, unarchiveBill, updateMultipleBills, mergeBills };
};
