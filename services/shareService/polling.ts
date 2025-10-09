
import type { Bill, ImportedBill, SharedBillPayload, ConstituentShareInfo, Participant, ReceiptItem } from '../../types';
import { getApiUrl, fetchWithRetry } from '../api';
import * as cryptoService from '../cryptoService';

declare var pako: any;

/**
 * Polls the server for updates on a list of imported bills using an efficient batch request.
 * @param bills An array of imported bills to check.
 * @returns A promise that resolves to an array of bill objects that need to be updated locally.
 */
export async function pollImportedBills(bills: ImportedBill[]): Promise<ImportedBill[]> {
    if (bills.length === 0) return [];

    const constituentToSummaryMap = new Map<string, ImportedBill>();
    const checkPayload: { shareId: string; lastUpdatedAt: number }[] = [];
    const regularBillsToCheck = new Map<string, ImportedBill>();

    for (const bill of bills) {
        if (bill.constituentShares && bill.constituentShares.length > 0) {
            for (const share of bill.constituentShares) {
                const item = bill.sharedData.bill.items?.find(i => i.id === share.originalBillId);
                const lastUpdatedAt = item?.originalBillData?.lastUpdatedAt || bill.lastUpdatedAt;
                checkPayload.push({ shareId: share.shareId, lastUpdatedAt });
                constituentToSummaryMap.set(share.shareId, bill);
            }
        } else {
            checkPayload.push({ shareId: bill.shareId, lastUpdatedAt: bill.lastUpdatedAt });
            regularBillsToCheck.set(bill.shareId, bill);
        }
    }

    const uniqueCheckPayload = Array.from(new Map(checkPayload.map(item => [item.shareId, item])).values());
    const billsNeedingUpdate: ImportedBill[] = [];
    const updatedSummaries = new Map<string, ImportedBill>();

    try {
        const response = await fetchWithRetry(await getApiUrl('/share/batch-check'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(uniqueCheckPayload),
            signal: AbortSignal.timeout(20000)
        });

        if (response.ok) {
            const updatedShares: { shareId: string, encryptedData: string, lastUpdatedAt: number }[] = await response.json();
            const updatedShareIds = new Set(updatedShares.map(s => s.shareId));

            for (const share of updatedShares) {
                if (constituentToSummaryMap.has(share.shareId)) {
                    const summaryTemplate = constituentToSummaryMap.get(share.shareId)!;
                    let summaryToUpdate = updatedSummaries.get(summaryTemplate.id) || JSON.parse(JSON.stringify(summaryTemplate));
                    const constituentInfo = summaryToUpdate.constituentShares!.find((cs: ConstituentShareInfo) => cs.shareId === share.shareId)!;

                    try {
                        const key = await cryptoService.importEncryptionKey(constituentInfo.encryptionKey);
                        const decrypted = await cryptoService.decrypt(share.encryptedData, key);
                        const json = pako.inflate(decrypted, { to: 'string' });
                        const payload: SharedBillPayload = JSON.parse(json);
                        const pubKey = await cryptoService.importPublicKey(payload.publicKey);
                        if (!await cryptoService.verify(JSON.stringify(payload.bill), payload.signature, pubKey)) throw new Error("Signature failed for constituent bill.");

                        const items = summaryToUpdate.sharedData.bill.items;
                        if (items) {
                            const itemIndex = items.findIndex((i: ReceiptItem) => i.id === constituentInfo.originalBillId);
                            if (itemIndex > -1) {
                                items[itemIndex].originalBillData = payload.bill;
                                // This is a crucial update: Recalculate the item's price for the summary based on the updated constituent data
                                const myNameInSummary = summaryToUpdate.sharedData.bill.participants.find(p => p.id === summaryToUpdate.myParticipantId)?.name;
                                if(myNameInSummary) {
                                    const myParticipantInOriginal = payload.bill.participants.find(p => p.name.toLowerCase().trim() === myNameInSummary.toLowerCase().trim());
                                    if (myParticipantInOriginal) {
                                        items[itemIndex].price = myParticipantInOriginal.amountOwed || 0;
                                    }
                                }
                            }
                        }
                        updatedSummaries.set(summaryToUpdate.id, summaryToUpdate);
                    } catch (e) {
                        console.error(`Failed to process constituent update for ${share.shareId}`, e);
                        if (summaryToUpdate.liveStatus !== 'stale') {
                            summaryToUpdate.liveStatus = 'stale';
                            updatedSummaries.set(summaryToUpdate.id, summaryToUpdate);
                        }
                    }
                } else if (regularBillsToCheck.has(share.shareId)) {
                    const originalBill = regularBillsToCheck.get(share.shareId)!;
                    try {
                        const symmetricKey = await cryptoService.importEncryptionKey(originalBill.shareEncryptionKey);
                        const decryptedBytes = await cryptoService.decrypt(share.encryptedData, symmetricKey);
                        const decryptedJson = pako.inflate(decryptedBytes, { to: 'string' });
                        const data: SharedBillPayload = JSON.parse(decryptedJson);
                        const publicKey = await cryptoService.importPublicKey(data.publicKey);
                        if (!(await cryptoService.verify(JSON.stringify(data.bill), data.signature, publicKey))) {
                            throw new Error("Signature verification failed.");
                        }
                        billsNeedingUpdate.push({ ...originalBill, sharedData: { ...originalBill.sharedData, bill: data.bill }, lastUpdatedAt: share.lastUpdatedAt, liveStatus: 'live' });
                    } catch (decryptionError) {
                        console.error(`Processing updated bill ${share.shareId} failed:`, decryptionError);
                        if (originalBill.liveStatus !== 'stale') billsNeedingUpdate.push({ ...originalBill, liveStatus: 'stale' });
                    }
                }
            }
            
            for (const summary of updatedSummaries.values()) {
                const myNameInSummary = summary.sharedData.bill.participants.find(p => p.id === summary.myParticipantId)?.name;
                if (!myNameInSummary) {
                    console.warn(`Could not find my participant name in summary bill ${summary.id}. Skipping recalculation.`);
                    billsNeedingUpdate.push(summary); // Push it anyway with new data, but no recalc
                    continue;
                }

                let totalOwedByMe = 0;
                let totalPortion = 0;
                let allConstituentsPaid = true;
                const paidItems: Record<string, boolean> = { ...(summary.localStatus.paidItems || {}) };

                if (summary.sharedData.bill.items) {
                    for (const item of summary.sharedData.bill.items) {
                        totalPortion += item.price;
                        
                        let isConsideredPaid = false;
                        const originalBill = item.originalBillData;
                        
                        if (originalBill) {
                             const myParticipantInOriginal = originalBill.participants.find(p => p.name.toLowerCase().trim() === myNameInSummary.toLowerCase().trim());
                             if (myParticipantInOriginal?.paid) {
                                paidItems[item.id] = true;
                             }
                        }
                        
                        if (paidItems[item.id]) {
                            isConsideredPaid = true;
                        }

                        if (!isConsideredPaid) {
                            totalOwedByMe += item.price;
                            allConstituentsPaid = false;
                        }
                    }
                }
                
                summary.sharedData.bill.totalAmount = totalPortion;
                if (summary.sharedData.bill.participants[0]) {
                    summary.sharedData.bill.participants[0].amountOwed = totalOwedByMe;
                }
                
                summary.localStatus.paidItems = paidItems;
                summary.localStatus.myPortionPaid = allConstituentsPaid;
                summary.liveStatus = 'live';
                if (summary.sharedData.bill.items) {
                    summary.lastUpdatedAt = Math.max(...summary.sharedData.bill.items.map((i: ReceiptItem) => i.originalBillData?.lastUpdatedAt || 0), summary.lastUpdatedAt);
                }

                billsNeedingUpdate.push(summary);
            }
            
            const polledShareIds = new Set(uniqueCheckPayload.map(p => p.shareId));
            bills.forEach(bill => {
              if (bill.liveStatus === 'stale') {
                 if (bill.constituentShares && bill.constituentShares.length > 0) {
                     const allConstituentsPolled = bill.constituentShares.every((cs: ConstituentShareInfo) => polledShareIds.has(cs.shareId));
                     if (allConstituentsPolled) billsNeedingUpdate.push({ ...bill, liveStatus: 'live' });
                 } else {
                     if (polledShareIds.has(bill.shareId) && !updatedShareIds.has(bill.shareId)) {
                        billsNeedingUpdate.push({ ...bill, liveStatus: 'live' });
                     }
                 }
              }
            });

        } else {
             throw new Error(`Batch check failed with status ${response.status}`);
        }
    } catch (error) {
        console.error("Polling for imported bills failed:", error);
        for (const bill of bills) {
            if (bill.liveStatus !== 'stale') billsNeedingUpdate.push({ ...bill, liveStatus: 'stale' as const });
        }
    }
    
    return Array.from(new Map(billsNeedingUpdate.map(b => [b.id, b])).values());
}


/**
 * Polls the server to check the status of bills the user has shared.
 * @param bills An array of the user's bills that have shareInfo.
 * @returns A promise that resolves to an array of bill objects that need their status updated locally.
 */
export async function pollOwnedSharedBills(bills: Bill[]): Promise<Bill[]> {
    const billsToUpdate: Bill[] = [];
    const billsToCheck = bills.filter(b => b.shareInfo?.shareId);
    if (billsToCheck.length === 0) return [];

    const shareIds = billsToCheck.map(b => b.shareInfo!.shareId);

    try {
        const response = await fetchWithRetry(await getApiUrl('/share/batch-status'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shareIds }),
            signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
            const statuses: { shareId: string, status: 'live' | 'expired' }[] = await response.json();
            const statusMap = new Map(statuses.map(s => [s.shareId, s.status]));

            for (const bill of billsToCheck) {
                const newStatus = statusMap.get(bill.shareInfo!.shareId);
                // If a status was returned and it's different from the current one, mark for update.
                if (newStatus && bill.shareStatus !== newStatus) {
                    billsToUpdate.push({ ...bill, shareStatus: newStatus });
                } else if (!newStatus && bill.shareStatus !== 'error') {
                    // If the server didn't return a status for a known shareId, it's an anomaly/error.
                    billsToUpdate.push({ ...bill, shareStatus: 'error' as const });
                }
            }
        } else {
             throw new Error(`Batch status check failed with status ${response.status}`);
        }
    } catch (error) {
        console.error(`Polling failed for owned bills:`, error);
        // If the entire request fails, mark all polled bills as having an error status if they aren't already.
        for (const bill of billsToCheck) {
            if (bill.shareStatus !== 'error') {
                 billsToUpdate.push({ ...bill, shareStatus: 'error' as const });
            }
        }
    }
    
    return billsToUpdate;
}