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

        const updatedBillsPromises = activeImported.map(async (bill) => {
            try {
                // Send our last known timestamp to the server to check for new data.
                const response = await fetch(`/share/${bill.shareId}?lastUpdatedAt=${bill.lastUpdatedAt}`);
                
                // If status is 304, there's no new data.
                if (response.status === 304) {
                    return bill;
                }

                if (!response.ok) {
                    console.error(`Failed to poll for bill ${bill.id}, server responded with ${response.status}`);
                    return bill; // Return original on error
                }

                const { encryptedData, lastUpdatedAt } = await response.json();
                
                // Although the server handles the check, this is a good defensive measure.
                if (lastUpdatedAt > bill.lastUpdatedAt) {
                    const key = await cryptoService.importEncryptionKey(bill.shareEncryptionKey!);
                    const decryptedJson = await cryptoService.decrypt(encryptedData, key);
                    const payload: SharedBillPayload = JSON.parse(decryptedJson);

                    const publicKey = await cryptoService.importPublicKey(payload.publicKey);
                    const isVerified = await cryptoService.verify(JSON.stringify(payload.bill), payload.signature, publicKey);
                    
                    if (isVerified) {
                        return {
                            ...bill,
                            sharedData: {
                                bill: payload.bill,
                                creatorPublicKey: payload.publicKey,
                                signature: payload.signature,
                            },
                            lastUpdatedAt,
                        };
                    }
                }
            } catch (error) {
                console.error(`Failed to update bill ${bill.id}:`, error);
            }
            return bill; 
        });
        
        const updatedBillsResult = await Promise.all(updatedBillsPromises);

        // Create a map of only the bills that have new, more recent data.
        const updatedDataMap = new Map(
            updatedBillsResult
                .filter(ub => {
                    const originalBill = importedBills.find(ib => ib.id === ub.id);
                    // The filter condition ensures we only consider bills that actually changed.
                    return originalBill && ub.lastUpdatedAt > originalBill.lastUpdatedAt;
                })
                .map(b => [b.id, b])
        );

        // If there are any updates, update both the state and the database.
        if (updatedDataMap.size > 0) {
            // Update the React state to trigger a UI re-render.
            setImportedBills(prev => {
                const final = prev.map(p => updatedDataMap.get(p.id) || p);
                final.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
                return final;
            });

            // Persist only the changed bills to the database.
            await Promise.all(Array.from(updatedDataMap.values()).map(updateDB));
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