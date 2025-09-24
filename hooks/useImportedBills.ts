import { useState, useEffect, useCallback } from 'react';
import type { ImportedBill, SharedBillPayload } from '../types.ts';
import { getImportedBills, addImportedBill as addDB, updateImportedBill as updateDB, deleteImportedBillDB } from '../services/db.ts';
import * as cryptoService from '../services/cryptoService.ts';

const POLLING_INTERVAL = 30 * 1000; // 30 seconds

export const useImportedBills = () => {
  const [importedBills, setImportedBills] = useState<ImportedBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const updateImportedBill = useCallback(async (updatedBill: ImportedBill) => {
    await updateDB(updatedBill);
    setImportedBills(prev => {
        const updated = prev.map(bill => (bill.id === updatedBill.id ? updatedBill : bill));
        updated.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
        return updated;
    });
  }, []);

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
  
  // Effect for background polling of updates
  useEffect(() => {
    const checkForUpdates = async () => {
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        for (const bill of importedBills) {
            // Stop polling for bills that were shared more than 24 hours ago
            if (now - bill.lastUpdatedAt > twentyFourHours) {
                continue;
            }

            try {
                const response = await fetch(`/share/${bill.shareId}?lastCheckedAt=${bill.lastUpdatedAt}`);
                if (response.status === 304) continue;
                if (response.status === 404) continue; // Expired on server
                if (!response.ok) continue;

                const { encryptedData, lastUpdatedAt } = await response.json();

                // Decrypt and verify the new payload
                const encryptionKey = await cryptoService.importEncryptionKey(bill.shareEncryptionKey);
                const decryptedJson = await cryptoService.decrypt(encryptedData, encryptionKey);
                const newData: SharedBillPayload = JSON.parse(decryptedJson);

                // Use the creator's public key that we stored during import
                const publicKey = await cryptoService.importPublicKey(bill.sharedData.creatorPublicKey);
                const isVerified = await cryptoService.verify(JSON.stringify(newData.bill), newData.signature, publicKey);

                if (isVerified) {
                    const updatedBill: ImportedBill = {
                        ...bill,
                        creatorName: newData.creatorName, // Update name in case it changed
                        sharedData: {
                           bill: newData.bill,
                           creatorPublicKey: bill.sharedData.creatorPublicKey, // Keep original public key
                           signature: newData.signature,
                        },
                        lastUpdatedAt,
                    };
                    await updateImportedBill(updatedBill);
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


  const addImportedBill = useCallback(async (newBill: ImportedBill) => {
    await addDB(newBill);
    setImportedBills(prev => {
        // Avoid adding duplicates
        if (prev.some(b => b.id === newBill.id)) return prev;
        const updated = [...prev, newBill];
        updated.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
        return updated;
    });
  }, []);

  const deleteImportedBill = useCallback(async (billId: string) => {
    await deleteImportedBillDB(billId);
    setImportedBills(prev => prev.filter(bill => bill.id !== billId));
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

  return { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, isLoading };
};