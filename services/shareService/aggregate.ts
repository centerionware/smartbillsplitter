import type { Bill, ConstituentShareInfo, Participant, ReceiptItem, Settings } from '../types';
import { getApiUrl, fetchWithRetry } from '../api';
import { getBillSigningKey, saveBillSigningKey } from '../db';
import * as cryptoService from '../cryptoService';
import { encryptAndSignPayload } from './utils';

/**
 * Creates a virtual "summary" bill from a collection of a participant's real bills.
 * @param participantName The name of the participant.
 * @param unpaidBills The list of bills where the participant has an outstanding balance.
 * @param settings The current app settings, used for the creator's display name.
 * @returns A new Bill object representing the aggregate debt.
 */
export const generateAggregateBill = async (
    participantName: string, 
    unpaidBills: Bill[], 
    settings: Settings,
    updateMultipleBillsCallback: (billsToUpdate: Bill[]) => Promise<void>,
    availableSlots: number
): Promise<{ summaryBill: Bill, constituentShares: ConstituentShareInfo[], imagesDropped: number }> => {
    
    const constituentShares: ConstituentShareInfo[] = [];
    const billsToUpdateMap = new Map<string, Bill>();

    for (const bill of unpaidBills) {
        let updatedBill = { ...bill };
        let needsServerUpdate = false;

        if (!updatedBill.shareInfo || !updatedBill.shareInfo.shareId) {
            const signingKeyPair = await cryptoService.generateSigningKeyPair();
            await saveBillSigningKey(updatedBill.id, signingKeyPair.privateKey);
            const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
            const billEncryptionKey = await cryptoService.generateEncryptionKey();
            const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
            updatedBill.shareInfo = { shareId: '', encryptionKey: billEncryptionKeyJwk, signingPublicKey: signingPublicKeyJwk };
            needsServerUpdate = true;
        } else {
            // Even if a share exists, we must push the latest data to the server
            // to ensure the summary reflects any local updates.
            needsServerUpdate = true;
        }

        if (needsServerUpdate) {
            const keyRecord = await getBillSigningKey(updatedBill.id);
            if (!keyRecord || !updatedBill.shareInfo) throw new Error(`Could not find signing key for bill ${updatedBill.id}`);
            const encryptionKey = await cryptoService.importEncryptionKey(updatedBill.shareInfo.encryptionKey);
            const encryptedData = await encryptAndSignPayload(updatedBill, settings, keyRecord.privateKey, updatedBill.shareInfo.signingPublicKey, encryptionKey);
            
            // Use POST with shareId for updates/recreations, or POST to base for new shares
            const urlPath = updatedBill.shareInfo.shareId ? `/share/${updatedBill.shareInfo.shareId}` : '/share';
            
            const shareResponse = await fetchWithRetry(await getApiUrl(urlPath), { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    encryptedData,
                    updateToken: updatedBill.shareInfo.updateToken
                }) 
            });

            const shareResult = await shareResponse.json();
            if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create/update share session for constituent bill.");
            
            // Update local bill with potentially new shareId or updateToken from server
            updatedBill.shareInfo.shareId = shareResult.shareId;
            if (shareResult.updateToken) {
                updatedBill.shareInfo.updateToken = shareResult.updateToken;
            }
            if(shareResult.lastUpdatedAt) {
                updatedBill.lastUpdatedAt = shareResult.lastUpdatedAt;
            }
            billsToUpdateMap.set(updatedBill.id, updatedBill);
        }

        if (updatedBill.shareInfo) {
            constituentShares.push({
                originalBillId: updatedBill.id,
                shareId: updatedBill.shareInfo.shareId,
                publicKey: updatedBill.shareInfo.signingPublicKey,
                encryptionKey: updatedBill.shareInfo.encryptionKey
            });
        }
    }

    if (billsToUpdateMap.size > 0) {
        await updateMultipleBillsCallback(Array.from(billsToUpdateMap.values()));
    }

    const totalOwed = unpaidBills.reduce((sum, bill) => {
        const p = bill.participants.find(p => p.name === participantName);
        return sum + (p?.amountOwed || 0);
    }, 0);

    let imagesDropped = 0;
    let slotsRemaining = availableSlots;
    const sortedUnpaidBills = [...unpaidBills].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const items: ReceiptItem[] = sortedUnpaidBills.map(bill => {
        const p = bill.participants.find(p => p.name === participantName);
        // Ensure we use the version of the bill that has the correct shareInfo if it was just created
        const billToStore = { ...(billsToUpdateMap.get(bill.id) || bill) };
    
        if (billToStore.receiptImage) {
            if (slotsRemaining > 0) {
                slotsRemaining--;
            } else {
                imagesDropped++;
                delete billToStore.receiptImage; // Omit the image if no slots are left
            }
        }
    
        return {
            id: bill.id,
            name: bill.description,
            price: p?.amountOwed || 0,
            assignedTo: [],
            originalBillData: JSON.parse(JSON.stringify(billToStore)),
        };
    });

    const summaryParticipant: Participant = {
        id: `p-summary-${participantName.replace(/\s/g, '')}`,
        name: participantName,
        amountOwed: totalOwed,
        paid: totalOwed < 0.01,
    };

    const summaryBill = {
        id: `summary-${Date.now()}`,
        description: `Summary for ${participantName}`,
        totalAmount: totalOwed,
        date: new Date().toISOString(),
        participants: [summaryParticipant],
        items,
        status: 'active' as const,
    };
    return { summaryBill, constituentShares, imagesDropped };
};
