import { useState, useEffect, useCallback } from 'react';
import type { ImportedBill, SharedBillPayload } from '../types.ts';
import { getImportedBills, addImportedBill as addDB, updateImportedBill as updateDB, deleteImportedBillDB } from '../services/db.ts';
import * as cryptoService from '../services/cryptoService.ts';
import { getApiUrl } from '../services/api.ts';

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
  
  useEffect(() => {
    const pollForUpdates = async () => {
        const sharesToCheck: { shareId: string; lastUpdatedAt: number }[] = [];
        
        importedBills.forEach(bill => {
            if (bill.status !== 'active') return;

            if (bill.constituentShares && bill.constituentShares.length > 0) {
                // Summary bill: check each constituent share. Use the main bill's lastUpdatedAt as the baseline.
                bill.constituentShares.forEach(cs => {
                    sharesToCheck.push({ shareId: cs.shareId, lastUpdatedAt: bill.lastUpdatedAt });
                });
            } else if (bill.shareId && bill.shareEncryptionKey) {
                // Regular imported bill.
                sharesToCheck.push({ shareId: bill.shareId, lastUpdatedAt: bill.lastUpdatedAt });
            }
        });

        if (sharesToCheck.length === 0) return;
        
        const uniqueSharesToCheck = Array.from(new Map(sharesToCheck.map(s => [s.shareId, s])).values());
        if (uniqueSharesToCheck.length === 0) return;

        try {
            const response = await fetch(getApiUrl('/share/batch-check'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uniqueSharesToCheck),
            });
            
            if (!response.ok) throw new Error(`Batch update check failed with status ${response.status}`);

            const updatedPayloads: { shareId: string, encryptedData: string, lastUpdatedAt: number }[] = await response.json();
            if (updatedPayloads.length === 0) return;
            
            const updatesMap = new Map(updatedPayloads.map(p => [p.shareId, p]));
            const billsToUpdateInDB: ImportedBill[] = [];
            let needsStateUpdate = false;

            const newImportedBillsState = await Promise.all(importedBills.map(async (bill): Promise<ImportedBill> => {
                if (bill.status !== 'active') return bill;
                let billWasUpdated = false;
                let newBillData = JSON.parse(JSON.stringify(bill)); // Deep copy

                if (newBillData.constituentShares && newBillData.constituentShares.length > 0) {
                    // --- Summary Bill Update Logic ---
                    let latestTimestamp = newBillData.lastUpdatedAt;
                    const updatedItems = await Promise.all(
                        (newBillData.sharedData.bill.items || []).map(async (item: any) => {
                            const constituentShare = newBillData.constituentShares.find((cs: any) => cs.originalBillId === item.id);
                            if (!constituentShare || !updatesMap.has(constituentShare.shareId)) return item;
                            
                            billWasUpdated = true;
                            const payload = updatesMap.get(constituentShare.shareId)!;
                            latestTimestamp = Math.max(latestTimestamp, payload.lastUpdatedAt);
                            
                            try {
                                const key = await cryptoService.importEncryptionKey(constituentShare.encryptionKey);
                                const decryptedJson = await cryptoService.decrypt(payload.encryptedData, key);
                                const sharedPayload: SharedBillPayload = JSON.parse(decryptedJson);
                                const publicKey = await cryptoService.importPublicKey(sharedPayload.publicKey);
                                if (!await cryptoService.verify(JSON.stringify(sharedPayload.bill), sharedPayload.signature, publicKey)) throw new Error("Signature failed");
                                return { ...item, originalBillData: sharedPayload.bill };
                            } catch (e) {
                                console.error(`Failed to process update for constituent bill ${item.id}`, e);
                                return item;
                            }
                        })
                    );
                    if (billWasUpdated) {
                        newBillData.sharedData.bill.items = updatedItems;
                        newBillData.lastUpdatedAt = latestTimestamp;
                        
                        // Recalculate the summary total based on the updated constituent bills.
                        let newTotalOwed = 0;
                        for (const item of updatedItems) {
                            if (item.originalBillData) {
                                const myPart = item.originalBillData.participants.find((p: any) => p.id === newBillData.myParticipantId);
                                if (myPart && !myPart.paid) {
                                    newTotalOwed += myPart.amountOwed;
                                }
                            }
                        }
                        
                        // Update the summary bill's total amount and the participant's amount owed.
                        newBillData.sharedData.bill.totalAmount = newTotalOwed;
                        if (newBillData.sharedData.bill.participants[0]) {
                            newBillData.sharedData.bill.participants[0].amountOwed = newTotalOwed;
                        }
                    }
                } else if (newBillData.shareId && newBillData.shareEncryptionKey && updatesMap.has(newBillData.shareId)) {
                    // --- Regular Bill Update Logic ---
                    billWasUpdated = true;
                    const payload = updatesMap.get(newBillData.shareId)!;
                     try {
                        const key = await cryptoService.importEncryptionKey(newBillData.shareEncryptionKey);
                        const decryptedJson = await cryptoService.decrypt(payload.encryptedData, key);
                        const sharedPayload: SharedBillPayload = JSON.parse(decryptedJson);
                        const publicKey = await cryptoService.importPublicKey(sharedPayload.publicKey);
                        if (!await cryptoService.verify(JSON.stringify(sharedPayload.bill), sharedPayload.signature, publicKey)) throw new Error("Signature failed");
                        
                        newBillData.sharedData = { ...sharedPayload, creatorPublicKey: sharedPayload.publicKey };
                        newBillData.lastUpdatedAt = payload.lastUpdatedAt;
                    } catch (e) {
                        console.error(`Failed to process update for regular bill ${newBillData.id}`, e);
                        billWasUpdated = false; // Revert update on error
                    }
                }
                
                if (billWasUpdated) {
                    needsStateUpdate = true;
                    billsToUpdateInDB.push(newBillData);
                    return newBillData;
                }
                return bill;
            }));

            if (needsStateUpdate) {
                newImportedBillsState.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
                setImportedBills(newImportedBillsState);
                await Promise.all(billsToUpdateInDB.map(b => updateDB(b)));
            }
        } catch (error) {
            console.error("Polling for updates failed:", error);
        }
    };

    const intervalId = setInterval(pollForUpdates, POLLING_INTERVAL);
    // Initial poll on load
    setTimeout(pollForUpdates, 1000); 
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