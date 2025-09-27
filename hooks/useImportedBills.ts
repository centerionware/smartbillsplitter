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
  
  // Effect for polling for updates on active imported bills
  useEffect(() => {
    const pollForUpdates = async () => {
        const activeImported = importedBills.filter(b => b.status === 'active' && b.shareEncryptionKey);
        if (activeImported.length === 0) return;

        const updatedBills: ImportedBill[] = [];

        await Promise.all(activeImported.map(async (bill) => {
            try {
                const response = await fetch(getApiUrl(`/share/${bill.shareId}?lastUpdatedAt=${bill.lastUpdatedAt}`));

                if (response.status === 404) {
                    if (bill.liveStatus !== 'expired') {
                        updatedBills.push({ ...bill, liveStatus: 'expired' });
                    }
                } else if (response.ok) {
                    let updatedBillData = { ...bill, liveStatus: 'live' as const };
                    let hasDataUpdate = false;

                    if (response.status === 200) { // 200 means there's an update
                        const payload = await response.json();
                        if (!bill.shareEncryptionKey) return;

                        const key = await cryptoService.importEncryptionKey(bill.shareEncryptionKey);
                        const decryptedJson = await cryptoService.decrypt(payload.encryptedData, key);
                        const sharedPayload: SharedBillPayload = JSON.parse(decryptedJson);

                        const publicKey = await cryptoService.importPublicKey(sharedPayload.publicKey);
                        const isVerified = await cryptoService.verify(JSON.stringify(sharedPayload.bill), sharedPayload.signature, publicKey);
                        
                        if (isVerified) {
                             updatedBillData = {
                                ...updatedBillData,
                                sharedData: {
                                    bill: sharedPayload.bill,
                                    creatorPublicKey: sharedPayload.publicKey,
                                    signature: sharedPayload.signature,
                                    paymentDetails: sharedPayload.paymentDetails,
                                },
                                lastUpdatedAt: payload.lastUpdatedAt,
                             };
                             hasDataUpdate = true;
                        }
                    }
                    
                    if (bill.liveStatus !== 'live' || hasDataUpdate) {
                        updatedBills.push(updatedBillData);
                    }
                } else {
                    console.error(`Poll for ${bill.shareId} failed with status ${response.status}`);
                }
            } catch (error) {
                console.error(`Poll for ${bill.shareId} failed with network error`, error);
            }
        }));

        if (updatedBills.length > 0) {
            const updatedDataMap = new Map(updatedBills.map(b => [b.id, b]));

            setImportedBills(prev => {
                const final = prev.map(p => updatedDataMap.get(p.id) || p);
                final.sort((a, b) => new Date(b.sharedData.bill.date).getTime() - new Date(a.sharedData.bill.date).getTime());
                return final;
            });
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