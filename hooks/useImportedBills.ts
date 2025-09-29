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

  const updateMultipleImportedBills = useCallback(async (billsToUpdate: ImportedBill[]) => {
      if (billsToUpdate.length === 0) return;
      await mergeImportedBillsDB([], billsToUpdate);
      setImportedBills(prev => {
          const updatedMap = new Map(billsToUpdate.map(b => [b.id, b]));
          const finalBills = prev.map(b => updatedMap.get(b.id) || b);
          finalBills.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
          return finalBills;
      });
  }, []);

  const deleteImportedBill = useCallback(async (billId: string) => {
    await deleteImportedBillDB(billId);
    setImportedBills(prev => prev.filter(bill => bill.id !== billId));
  }, []);

  const archiveImportedBill = useCallback(async (billId: string) => {
    const billToUpdate = importedBills.find(b => b.id === billId);
    if (billToUpdate) {
      await updateImportedBill({ ...billToUpdate, status: 'archived' });
    }
  }, [importedBills, updateImportedBill]);

  const unarchiveImportedBill = useCallback(async (billId: string) => {
    const billToUpdate = importedBills.find(b => b.id === billId);
    if (billToUpdate) {
      await updateImportedBill({ ...billToUpdate, status: 'active' });
    }
  }, [importedBills, updateImportedBill]);

  const mergeImportedBills = useCallback(async (billsToMerge: (Omit<ImportedBill, 'status' | 'liveStatus'>)[]) => {
      const existingBillMap = new Map(importedBills.map(b => [b.id, b]));
      const billsToAdd: ImportedBill[] = [];
      const billsToUpdate: ImportedBill[] = [];
      let skippedCount = 0;

      // FIX(line 90, 91): Explicitly cast the iterated item to its correct type inside the loop. This resolves a TypeScript inference issue where the item's type was incorrectly being treated as 'unknown', causing errors when accessing its properties like `lastUpdatedAt` and when using the spread operator.
      for (const incomingBill of billsToMerge) {
          const typedIncomingBill = incomingBill as Omit<ImportedBill, 'status' | 'liveStatus'>;
          const existingBill = existingBillMap.get(typedIncomingBill.id);

          if (existingBill) {
              if ((typedIncomingBill.lastUpdatedAt ?? 0) > (existingBill.lastUpdatedAt ?? 0)) {
                  billsToUpdate.push({ ...existingBill, ...typedIncomingBill, status: existingBill.status });
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
              // FIX: Add explicit types to sort callback arguments to avoid implicit 'any'.
              finalBills.sort((a: ImportedBill, b: ImportedBill) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
              return finalBills;
          });
      }

      return { added: billsToAdd.length, updated: billsToUpdate.length, skipped: skippedCount };
  }, [importedBills]);
  
  return { importedBills, isLoading, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, mergeImportedBills, updateMultipleImportedBills };
};