




import { useState, useEffect, useCallback } from 'react';
import type { ImportedBill } from '../types';
import { 
    getImportedBills, 
    addImportedBill as addDB, 
    updateImportedBill as updateDB, 
    deleteImportedBillDB,
    mergeImportedBillsDB
} from '../services/db';

export const useImportedBills = () => {
  const [importedBills, setImportedBills] = useState<ImportedBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const dbBills = await getImportedBills();
        dbBills.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
        setImportedBills(dbBills);
      } catch (err) {
        console.error("Failed to load imported bills:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const addImportedBill = useCallback(async (newBill: ImportedBill) => {
    await addDB(newBill);
    setImportedBills(prev => {
        const updated = [newBill, ...prev];
        updated.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
        return updated;
    });
  }, []);

  const updateImportedBill = useCallback(async (updatedBill: ImportedBill) => {
    await updateDB(updatedBill);
    setImportedBills(prev => {
        const updated = prev.map(b => (b.id === updatedBill.id ? updatedBill : b));
        updated.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
        return updated;
    });
  }, []);

  const archiveImportedBill = useCallback(async (billId: string) => {
    const billToUpdate = importedBills.find(b => b.id === billId);
    if (billToUpdate) {
      await updateDB({ ...billToUpdate, status: 'archived' });
      setImportedBills(prev => prev.map(b => b.id === billId ? {...b, status: 'archived'} : b));
    }
  }, [importedBills]);

  const unarchiveImportedBill = useCallback(async (billId: string) => {
    const billToUpdate = importedBills.find(b => b.id === billId);
    if (billToUpdate) {
      await updateDB({ ...billToUpdate, status: 'active' });
      setImportedBills(prev => prev.map(b => b.id === billId ? {...b, status: 'active'} : b));
    }
  }, [importedBills]);

  const deleteImportedBill = useCallback(async (billId: string) => {
    await deleteImportedBillDB(billId);
    setImportedBills(prev => prev.filter(b => b.id !== billId));
  }, []);

  const mergeImportedBills = useCallback(async (billsToMerge: Omit<ImportedBill, 'status' | 'liveStatus'>[]) => {
      const existingBillMap = new Map(importedBills.map(b => [b.id, b]));
      const billsToAdd: ImportedBill[] = [];
      const billsToUpdate: ImportedBill[] = [];
      let skippedCount = 0;

      // FIX: Use a for...of loop with explicit typing for the iterated item to prevent type inference issues.
      for (const incomingBill of billsToMerge) {
          const typedIncomingBill = incomingBill as Omit<ImportedBill, 'status' | 'liveStatus'>;
          const existingBill = existingBillMap.get(typedIncomingBill.id);
          if (existingBill) {
              if (typedIncomingBill.lastUpdatedAt > existingBill.lastUpdatedAt) {
                  billsToUpdate.push({ ...existingBill, ...typedIncomingBill, status: existingBill.status, liveStatus: existingBill.liveStatus });
              } else {
                  skippedCount++;
              }
          } else {
              billsToAdd.push({ ...typedIncomingBill, status: 'active', liveStatus: 'live' });
          }
      }

      if (billsToAdd.length > 0 || billsToUpdate.length > 0) {
          await mergeImportedBillsDB(billsToAdd, billsToUpdate);
          setImportedBills(prev => {
              const updatedMap = new Map(billsToUpdate.map(b => [b.id, b]));
              const currentBillsMap = new Map(prev.map(b => [b.id, b]));
              updatedMap.forEach((value, key) => currentBillsMap.set(key, value));
              const finalBills = [...Array.from(currentBillsMap.values()), ...billsToAdd];
              // FIX: Explicitly typing the sort callback arguments resolves potential type inference issues.
              finalBills.sort((a: ImportedBill, b: ImportedBill) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
              return finalBills;
          });
      }

      return { added: billsToAdd.length, updated: billsToUpdate.length, skipped: skippedCount };
  }, [importedBills]);

  return { importedBills, isLoading, addImportedBill, updateImportedBill, archiveImportedBill, unarchiveImportedBill, deleteImportedBill, mergeImportedBills };
};