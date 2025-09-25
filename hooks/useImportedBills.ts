import { useState, useEffect, useCallback } from 'react';
import type { ImportedBill, SharedBillPayload } from '../types.ts';
import { getImportedBills, addImportedBill as addDB, updateImportedBill as updateDB, deleteImportedBillDB } from '../services/db.ts';
import * as cryptoService from '../services/cryptoService.ts';

const POLLING_INTERVAL = 30000; // 30 seconds

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
  
  // Effect for polling for updates on active imported bills
  useEffect(() => {
    const pollForUpdates = async () => {
        const activeImported = importedBills.filter(b => b.status === 'active' && b.shareEncryptionKey);
        if (activeImported.length === 0) return;

        // 1. Gather all bill IDs and their last known timestamps for the batch request.
        const batchCheckPayload = activeImported.map(bill => ({
            shareId: bill.shareId,
            lastUpdatedAt: bill.lastUpdatedAt,
        }));

        try {
            // 2. Send a single batch request to the server.
            const response = await fetch(`/share/batch-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchCheckPayload),
            });
            
            if (!response.ok) {
                console.error(`Batch poll failed, server responded with ${response.status}`);
                return;
            }

            const updatedBillPayloads: { shareId: string, encryptedData: string, lastUpdatedAt: number }[] = await response.json();
            
            if (updatedBillPayloads.length === 0) {
                return; // No updates
            }
            
            // 3. Decrypt and verify only the bills that the server returned.
            const decryptedUpdatesPromises = updatedBillPayloads.map(async (payload) => {
                const originalBill = activeImported.find(b => b.shareId === payload.shareId);
                if (!originalBill || !originalBill.shareEncryptionKey) return null;

                const key = await cryptoService.importEncryptionKey(originalBill.shareEncryptionKey);
                const decryptedJson = await cryptoService.decrypt(payload.encryptedData, key);
                const sharedPayload: SharedBillPayload = JSON.parse(decryptedJson);

                const publicKey = await cryptoService.importPublicKey(sharedPayload.publicKey);
                const isVerified = await cryptoService.verify(JSON.stringify(sharedPayload.bill), sharedPayload.signature, publicKey);
                
                if (isVerified) {
                    return {
                        ...originalBill,
                        sharedData: {
                            bill: sharedPayload.bill,
                            creatorPublicKey: sharedPayload.publicKey,
                            signature: sharedPayload.signature,
                        },
                        lastUpdatedAt: payload.lastUpdatedAt,
                    };
                }
                return null; // Verification failed
            });

            const decryptedUpdates = (await Promise.all(decryptedUpdatesPromises)).filter((b): b is ImportedBill => b !== null);

            if (decryptedUpdates.length > 0) {
                const updatedDataMap = new Map(decryptedUpdates.map(b => [b.id, b]));

                // Update the React state to trigger a UI re-render.
                setImportedBills(prev => {
                    const final = prev.map(p => updatedDataMap.get(p.id) || p);
                    final.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
                    return final;
                });

                // Persist only the changed bills to the database.
                await Promise.all(Array.from(updatedDataMap.values()).map(updateDB));
            }
        } catch (error) {
            console.error('Failed to poll for bill updates:', error);
        }
    };

    const intervalId = setInterval(pollForUpdates, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [importedBills]);


  const addImportedBill = useCallback(async (newBill: ImportedBill) => {
    await addDB(newBill);
    setImportedBills(prevBills => {
      if (prevBills.some(b => b.id === newBill.id)) {
        return prevBills;
      }
      const updated = [newBill, ...prevBills];
      updated.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
      return updated;
    });
  }, []);

  const updateImportedBill = useCallback(async (updatedBill: ImportedBill) => {
    await updateDB(updatedBill);
    setImportedBills(prevBills => {
      const updated = prevBills.map(bill => (bill.id === updatedBill.id ? updatedBill : bill));
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

  return { importedBills, addImportedBill, updateImportedBill, deleteImportedBill, archiveImportedBill, unarchiveImportedBill, isLoading };
};