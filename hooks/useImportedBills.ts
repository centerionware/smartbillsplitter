

import { useState, useEffect, useCallback } from 'react';
import type { ImportedBill } from '../types';
import { 
    getImportedBills, 
    addImportedBill as addDB, 
    updateImportedBill as updateDB, 
    deleteImportedBillDB,
    mergeImportedBillsDB
} from '../services/db';
import { postMessage, useBroadcastListener } from '../services/broadcastService';

const sortImportedBills = (bills: ImportedBill[]) => bills.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());

export const useImportedBills = () => {
  const [importedBills, setImportedBills] = useState<ImportedBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadImportedBills = useCallback(async (isInitialLoad: boolean = false) => {
    if (isInitialLoad) setIsLoading(true);
    try {
      const dbBills = await getImportedBills();
      setImportedBills(sortImportedBills(dbBills));
    } catch (err) {
      console.error("Failed to load imported bills:", err);
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImportedBills(true);
  }, [loadImportedBills]);

  useBroadcastListener(useCallback(message => {
    if (message.type === 'imported-bills-updated') {
      loadImportedBills(false);
    }
  }, [loadImportedBills]));

  const addImportedBill = useCallback(async (newBill: ImportedBill) => {
    await addDB(newBill);
    setImportedBills(prev => sortImportedBills([newBill, ...prev]));
    postMessage({ type: 'imported-bills-updated' });
  }, []);

  const updateImportedBill = useCallback(async (updatedBill: ImportedBill) => {
    await updateDB(updatedBill);
    setImportedBills(prev => sortImportedBills(prev.map(b => b.id === updatedBill.id ? updatedBill : b)));
    postMessage({ type: 'imported-bills-updated' });
  }, []);

  const updateMultipleImportedBills = useCallback(async (billsToUpdate: ImportedBill[]) => {
      if (billsToUpdate.length === 0) return;
      
      const billsWithSyncedStatus = billsToUpdate.map(incomingBill => {
        const myParticipantOnServer = incomingBill.sharedData.bill.participants.find(
            p => p.id === incomingBill.myParticipantId
        );
        const isPaidOnServer = myParticipantOnServer?.paid ?? false;
        return {
            ...incomingBill,
            localStatus: { ...incomingBill.localStatus, myPortionPaid: isPaidOnServer }
        };
      });

      await mergeImportedBillsDB([], billsWithSyncedStatus);
      const updatedMap = new Map(billsWithSyncedStatus.map(b => [b.id, b]));
      setImportedBills(prev => sortImportedBills(prev.map(b => updatedMap.get(b.id) || b)));
      postMessage({ type: 'imported-bills-updated' });
  }, []);

  const deleteImportedBill = useCallback(async (billId: string) => {
    await deleteImportedBillDB(billId);
    setImportedBills(prev => prev.filter(b => b.id !== billId));
    postMessage({ type: 'imported-bills-updated' });
  }, []);

  const archiveImportedBill = useCallback(async (billId: string) => {
    const billToUpdate = importedBills.find(b => b.id === billId);
    if (billToUpdate) {
      const updatedBill = { ...billToUpdate, status: 'archived' as const };
      await updateImportedBill(updatedBill);
    }
  }, [importedBills, updateImportedBill]);

  const unarchiveImportedBill = useCallback(async (billId: string) => {
    const billToUpdate = importedBills.find(b => b.id === billId);
    if (billToUpdate) {
      const updatedBill = { ...billToUpdate, status: 'active' as const };
      await updateImportedBill(updatedBill);
    }
  }, [importedBills, updateImportedBill]);

  const mergeImportedBills = useCallback(async (billsToMerge: (Omit<ImportedBill, 'status' | 'liveStatus'>)[]) => {
      const existingBillMap = new Map(importedBills.map(b => [b.id, b]));
      const billsToAdd: ImportedBill[] = [];
      const billsToUpdate: ImportedBill[] = [];
      let skippedCount = 0;

      // FIX: Explicitly type `billToProcess` because type inference was failing, causing it to be `unknown`.
      // FIX: Explicitly type `billToProcess` because type inference was failing, causing it to be `unknown`.
      billsToMerge.forEach((billToProcess: Omit<ImportedBill, 'status' | 'liveStatus'>) => {
          const existingBill = existingBillMap.get(billToProcess.id);
          if (existingBill) {
              if ((billToProcess.lastUpdatedAt ?? 0) > (existingBill.lastUpdatedAt ?? 0)) {
                  billsToUpdate.push({ ...existingBill, ...billToProcess, status: existingBill.status, liveStatus: 'live' });
              } else {
                  skippedCount++;
              }
          } else {
              billsToAdd.push({ ...billToProcess, status: 'active', liveStatus: 'live' });
          }
      });

      if (billsToAdd.length > 0 || billsToUpdate.length > 0) {
          await mergeImportedBillsDB(billsToAdd, billsToUpdate);
          setImportedBills(prev => {
              const prevMap = new Map(prev.map(b => [b.id, b]));
              billsToUpdate.forEach(b => prevMap.set(b.id, b));
              billsToAdd.forEach(b => prevMap.set(b.id, b));
              return sortImportedBills(Array.from(prevMap.values()));
          });
          postMessage({ type: 'imported-bills-updated' });
      }

      return { added: billsToAdd.length, updated: billsToUpdate.length, skipped: skippedCount };
  }, [importedBills]);
  
  return { importedBills, isLoading, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, mergeImportedBills, updateMultipleImportedBills };
};