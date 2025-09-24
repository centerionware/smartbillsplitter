import { useState, useEffect, useCallback } from 'react';
import type { ImportedBill, SharedBillPayload } from '../types.ts';
import { getImportedBills, addImportedBill as addDB, updateImportedBill as updateDB, deleteImportedBillDB } from '../services/db.ts';
import * as cryptoService from '../services/cryptoService.ts';

const POLLING_INTERVAL = 30 * 1000; // 30 seconds

export const useImportedBills = () => {
  const [importedBills, setImportedBills] = useState<ImportedBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        let dbBills = await getImportedBills();
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
    // The 'put' operation in IndexedDB is idempotent (it acts as an insert or update).
    // This means we can safely write to the DB first without worrying about creating duplicates.
    await addDB(newBill);
    
    // Then, use a functional state update to guarantee we're working with the latest state.
    setImportedBills(prevBills => {
      // If the bill is already present in the current state, do nothing to avoid re-renders.
      if (prevBills.some(b => b.id === newBill.id)) {
        return prevBills;
      }
      
      // Otherwise, add the new bill and re-sort the array.
      const updated = [newBill, ...prevBills];
      updated.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
      return updated;
    });
  }, []);

  const updateImportedBill = useCallback(async (updatedBill: ImportedBill) => {
    await updateDB(updatedBill);
    setImportedBills(prevBills => {
      const updated = prevBills.map(bill => (bill.id === updatedBill.id ? updatedBill : bill));
      // Sorting is not strictly necessary on update, but maintains order if the date were editable.
      updated.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
      return updated;
    });
  }, []);

  const deleteImportedBill = useCallback(async (billId: string) => {
    await deleteImportedBillDB(billId);
    setImportedBills(prev => prev.filter(bill => bill.id !== billId));
  }, []);
  
  const archiveImportedBill = useCallback(async (billId: string) => {
    let billToUpdate: ImportedBill | undefined;
    setImportedBills(prevBills => 
        prevBills.map(bill => {
            if (bill.id === billId) {
                billToUpdate = { ...bill, status: 'archived' };
                return billToUpdate;
            }
            return bill;
        })
    );
    if (billToUpdate) {
        await updateDB(billToUpdate);
    }
  }, []);
  
  const unarchiveImportedBill = useCallback(async (billId: string) => {
    let billToUpdate: ImportedBill | undefined;
     setImportedBills(prevBills => 
        prevBills.map(bill => {
            if (bill.id === billId) {
                billToUpdate = { ...bill, status: 'active' };
                return billToUpdate;
            }
            return bill;
        })
    );
    if (billToUpdate) {
        await updateDB(billToUpdate);
    }
  }, []);

  // Effect for background polling of updates
  useEffect(() => {
    const checkForUpdates = async () => {
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        for (const bill of importedBills) {
            if (bill.status !== 'active' || (now - bill.lastUpdatedAt > twentyFourHours)) {
                continue;
            }

            try {
                const response = await fetch(`/share/${bill.shareId}?lastCheckedAt=${bill.lastUpdatedAt}`);
                if (response.status === 304 || response.status === 404 || !response.ok) continue;

                const { encryptedData, lastUpdatedAt } = await response.json();

                const encryptionKey = await cryptoService.importEncryptionKey(bill.shareEncryptionKey);
                const decryptedJson = await cryptoService.decrypt(encryptedData, encryptionKey);
                const newData: SharedBillPayload = JSON.parse(decryptedJson);

                const publicKey = await cryptoService.importPublicKey(bill.sharedData.creatorPublicKey);
                const isVerified = await cryptoService.verify(JSON.stringify(newData.bill), newData.signature, publicKey);

                if (isVerified) {
                    const updatedBill: ImportedBill = {
                        ...bill,
                        creatorName: newData.creatorName,
                        sharedData: {
                           bill: newData.bill,
                           creatorPublicKey: bill.sharedData.creatorPublicKey,
                           signature: newData.signature,
                        },
                        lastUpdatedAt,
                    };
                    // Use the safe update function
                    updateImportedBill(updatedBill);
                } else {
                    console.warn(`Signature verification failed for update of bill ${bill.id}`);
                }
            } catch (err) {
                console.error(`Error polling for bill ${bill.id}:`, err);
            }
        }
    };
    
    const intervalId = setInterval(checkForUpdates, POLLING_INTERVAL);
    return () => clearInterval(intervalId);

  }, [importedBills, updateImportedBill]);

  return { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, isLoading };
};