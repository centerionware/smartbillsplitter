import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload, ConstituentShareInfo, ImportedBill } from '../types';
import type { SubscriptionStatus } from '../hooks/useAuth';
import * as cryptoService from './cryptoService';
import { getBillSigningKey, saveBillSigningKey } from './db';
import { getApiUrl, fetchWithRetry } from './api';

declare var pako: any;

const FREE_TIER_IMAGE_SHARE_LIMIT = 5;

interface ShareBillInfo {
    description: string;
    amountOwed: number;
}

/**
 * Converts a UTF-8 string to a "binary string" (where each character's char code is a byte value),
 * which is the format required by the btoa function.
 * @param str The UTF-8 string to convert.
 */
function utf8ToBinaryString(str: string): string {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(str);
  let binaryString = '';
  // This loop is more robust than `String.fromCharCode.apply` for large inputs.
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  return binaryString;
}


// Helper to Base64URL encode a string, making it safe for URLs
function base64UrlEncode(str: string): string {
    return btoa(utf8ToBinaryString(str))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}


export const generateShareText = (
    participantName: string,
    totalOwed: number,
    billsInfo: ShareBillInfo[],
    settings: Settings,
    subscriptionStatus: SubscriptionStatus
): string => {
    const billList = billsInfo.map(b => `- "${b.description}": $${b.amountOwed.toFixed(2)}`).join('\n');

    const { paymentDetails, shareTemplate } = settings;
    let paymentInfo = '';
    const paymentMethods = [];
    if (paymentDetails.venmo) paymentMethods.push(`Venmo: @${paymentDetails.venmo}`);
    if (paymentDetails.paypal) paymentMethods.push(`PayPal: ${paymentDetails.paypal}`);
    if (paymentDetails.cashApp) paymentMethods.push(`Cash App: $${paymentDetails.cashApp}`);
    if (paymentDetails.zelle) paymentMethods.push(`Zelle: ${paymentDetails.zelle}`);
    
    if (paymentMethods.length > 0) {
        paymentInfo = `\n\nYou can pay me via ${paymentMethods.join(' or ')}.`;
    }
    if (paymentDetails.customMessage) {
        paymentInfo += paymentInfo ? `\n\n${paymentDetails.customMessage}` : `\n\n${paymentDetails.customMessage}`;
    }

    let promoText = '';
    if (subscriptionStatus === 'free') {
        let appUrl = 'https://sharedbills.app';
        try {
            const constructedUrl = new URL('/', window.location.href).href;
            appUrl = constructedUrl.endsWith('/') ? constructedUrl.slice(0, -1) : constructedUrl;
        } catch (e) { console.warn("Could not determine app URL from context."); }
        promoText = `\n\nCreated with SharedBills: ${appUrl}`;
    }
    
    return shareTemplate
        .replace('{participantName}', participantName)
        .replace('{totalOwed}', `$${totalOwed.toFixed(2)}`)
        .replace('{billList}', billList)
        .replace('{paymentInfo}', paymentInfo)
        .replace('{promoText}', promoText);
};


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

/**
 * Encrypts a bill and generates a one-time-use shareable URL. This version is for ephemeral
 * bills (like dashboard summaries) and does not persist any share state.
 * @param bill The bill to share.
 * @param settings The current app settings.
 * @returns A promise resolving to the shareable URL string.
 */
export const generateOneTimeShareLink = async (
    unpaidBills: Bill[],
    participantName: string,
    settings: Settings,
    updateMultipleBillsCallback: (bills: Bill[]) => Promise<void>,
    allUserBills: Bill[],
    subscriptionStatus: SubscriptionStatus
): Promise<{ shareUrl: string; imagesDropped: number; }> => {
    let availableSlots = Infinity;
    if (subscriptionStatus === 'free') {
        // Count how many *other* bills are already shared with images.
        // The summary itself will count as one "share", but the constituent parts don't count individually against the limit here.
        const usedSlots = allUserBills.filter(b => b.status === 'active' && !!b.shareInfo?.shareId && !!b.receiptImage).length;
        availableSlots = Math.max(0, FREE_TIER_IMAGE_SHARE_LIMIT - usedSlots);
    }
    
    // FIX: Swapped the first two arguments to match the function definition.
    const { summaryBill, constituentShares, imagesDropped } = await generateAggregateBill(participantName, unpaidBills, settings, updateMultipleBillsCallback, availableSlots);
    const signingKeyPair = await cryptoService.generateSigningKeyPair();
    const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
    const billEncryptionKey = await cryptoService.generateEncryptionKey();

    const encryptedData = await encryptAndSignPayload(summaryBill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey, constituentShares);
    const shareResponse = await fetchWithRetry(await getApiUrl('/share'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
    });
    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
    const { shareId } = shareResult;

    const participantId = summaryBill.participants[0].id;
    const compressedParticipantId = pako.deflate(participantId);
    const encryptedParticipantId = await cryptoService.encrypt(compressedParticipantId, billEncryptionKey);
    const urlSafeEncryptedParticipantId = encryptedParticipantId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const fragmentKey = await cryptoService.generateEncryptionKey();
    const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
    const compressedBillKey = pako.deflate(JSON.stringify(billEncryptionKeyJwk));
    const encryptedBillKey = await cryptoService.encrypt(compressedBillKey, fragmentKey);

    const keyResponse = await fetchWithRetry(await getApiUrl('/onetime-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedBillKey }),
    });
    const keyResult = await keyResponse.json();
    if (!keyResponse.ok) throw new Error(keyResult.error || "Failed to create one-time key session.");
    const { keyId } = keyResult;

    const fragmentKeyJwk = await cryptoService.exportKey(fragmentKey);
    const encodedFragmentKey = base64UrlEncode(JSON.stringify(fragmentKeyJwk));

    const url = new URL(window.location.href);
    url.hash = `#/view-bill?shareId=${shareId}&keyId=${keyId}&fragmentKey=${encodedFragmentKey}&p=${urlSafeEncryptedParticipantId}`;

    return { shareUrl: url.toString(), imagesDropped };
};

/**
 * Generates a shareable URL for a specific participant of a persistent bill.
 * It checks for an existing, unexpired one-time key for that participant. If the key has been
 * consumed on the server, it generates a new one and persists its state.
 * @param bill The bill to share.
 * @param participantId The ID of the participant to generate the link for.
 * @param settings The current app settings.
 * @param updateBillCallback A function to persist the updated bill object.
 * @returns A promise resolving to the shareable URL string and the potentially updated bill.
 */
export const generateShareLink = async (
    bill: Bill,
    participantId: string,
    settings: Settings,
    updateBillCallback: (updatedBill: Bill) => Promise<void>
): Promise<{ url: string; billWithNewShareInfo: Bill }> => {
    let updatedBill = JSON.parse(JSON.stringify(bill));
    let needsDBUpdate = false;

    if (updatedBill.shareInfo && updatedBill.shareInfo.shareId) {
        try {
            const res = await fetchWithRetry(await getApiUrl(`/share/${updatedBill.shareInfo.shareId}`), { method: 'GET', signal: AbortSignal.timeout(4000) });
            if (res.status === 404) {
                console.warn(`Share session for bill ${updatedBill.id} not found on server. Recreating...`);
                updatedBill = await recreateShareSession(updatedBill, settings, updateBillCallback);
            } else if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to verify existing share session. Status: ${res.status}`);
            }
        } catch (error: any) {
            console.error("Could not verify share session:", error);
            if (error.name === 'AbortError') {
                throw new Error('Could not connect to the server to verify the share link. Please check your connection and try again.');
            }
            throw new Error(error.message || 'An unexpected error occurred while verifying the share link.');
        }
    }


    if (!updatedBill.shareInfo || !updatedBill.shareInfo.shareId) {
        needsDBUpdate = true;
        const signingKeyPair = await cryptoService.generateSigningKeyPair();
        await saveBillSigningKey(updatedBill.id, signingKeyPair.privateKey);
        const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
        
        const billEncryptionKey = await cryptoService.generateEncryptionKey();
        const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);

        const encryptedData = await encryptAndSignPayload(updatedBill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey);
        const shareResponse = await fetchWithRetry(await getApiUrl('/share'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData }),
        });
        const shareResult = await shareResponse.json();
        if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
        
        updatedBill.shareInfo = { 
            shareId: shareResult.shareId, 
            encryptionKey: billEncryptionKeyJwk, 
            signingPublicKey: signingPublicKeyJwk,
            updateToken: shareResult.updateToken,
        };
    }
    
    if (!updatedBill.participantShareInfo) {
        updatedBill.participantShareInfo = {};
    }

    const existingShareInfo = updatedBill.participantShareInfo[participantId];
    const now = Date.now();
    let keyIsAvailableOnServer = false;

    if (existingShareInfo && now < existingShareInfo.expires) {
        try {
            const statusResponse = await fetchWithRetry(await getApiUrl(`/onetime-key/${existingShareInfo.keyId}/status`));
            if (statusResponse.ok) {
                const { status } = await statusResponse.json();
                if (status === 'available') {
                    keyIsAvailableOnServer = true;
                }
            }
        } catch (e) {
            console.error("Failed to check key status, will generate a new one.", e);
            keyIsAvailableOnServer = false;
        }
    }

    if (!keyIsAvailableOnServer) {
        needsDBUpdate = true;
        const billEncryptionKey = await cryptoService.importEncryptionKey(updatedBill.shareInfo.encryptionKey);
        const fragmentKey = await cryptoService.generateEncryptionKey();
        const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
        const compressedBillKey = pako.deflate(JSON.stringify(billEncryptionKeyJwk));
        const encryptedBillKey = await cryptoService.encrypt(compressedBillKey, fragmentKey);

        const keyResponse = await fetchWithRetry(await getApiUrl('/onetime-key'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedBillKey }),
        });
        const keyResult = await keyResponse.json();
        if (!keyResponse.ok) throw new Error(keyResult.error || "Failed to create one-time key session.");
        
        const newFragmentKeyJwk = await cryptoService.exportKey(fragmentKey);

        updatedBill.participantShareInfo[participantId] = {
            keyId: keyResult.keyId,
            fragmentKey: newFragmentKeyJwk,
            expires: now + 5 * 60 * 1000,
        };
    }

    if (needsDBUpdate) {
        await updateBillCallback(updatedBill);
    }
    
    const billEncryptionKey = await cryptoService.importEncryptionKey(updatedBill.shareInfo.encryptionKey);
    const compressedParticipantId = pako.deflate(participantId);
    const encryptedParticipantId = await cryptoService.encrypt(compressedParticipantId, billEncryptionKey);
    const urlSafeEncryptedParticipantId = encryptedParticipantId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const finalShareInfo = updatedBill.participantShareInfo[participantId];
    const encodedFragmentKey = base64UrlEncode(JSON.stringify(finalShareInfo.fragmentKey));

    const url = new URL(window.location.href);
    url.hash = `#/view-bill?shareId=${updatedBill.shareInfo.shareId}&keyId=${finalShareInfo.keyId}&fragmentKey=${encodedFragmentKey}&p=${urlSafeEncryptedParticipantId}`;

    return { url: url.toString(), billWithNewShareInfo: updatedBill };
};


export async function encryptAndSignPayload(
    bill: Bill, 
    settings: Settings, 
    privateKey: CryptoKey, 
    publicKeyJwk: JsonWebKey,
    encryptionKey: CryptoKey,
    constituentShares?: ConstituentShareInfo[]
): Promise<string> {
    // 1. Create a sanitized version of the bill for sharing
    const { participantShareInfo, ...billData } = bill;

    // Sanitize participants in the main bill by removing contact info
    const sanitizedParticipants = billData.participants.map(({ phone, email, ...p }) => p);

    // Sanitize participants in nested originalBillData within items (for summary bills)
    const sanitizedItems = billData.items?.map(item => {
        if (item.originalBillData) {
            const sanitizedOriginalParticipants = item.originalBillData.participants.map(({ phone, email, ...p }) => p);
            // Create a new item with sanitized originalBillData
            return {
                ...item,
                originalBillData: {
                    ...item.originalBillData,
                    participants: sanitizedOriginalParticipants
                }
            };
        }
        return item;
    });

    // Construct the final bill object for the payload
    const billForPayload = {
        ...billData,
        participants: sanitizedParticipants,
        items: sanitizedItems,
    };
    
    // 2. Sign and create the payload with the sanitized bill
    const signature = await cryptoService.sign(JSON.stringify(billForPayload), privateKey);
    const payload: SharedBillPayload = {
        bill: billForPayload as Bill,
        creatorName: settings.myDisplayName,
        publicKey: publicKeyJwk,
        signature,
        paymentDetails: settings.paymentDetails,
    };
    if (constituentShares) {
        payload.constituentShares = constituentShares;
    }
    
    const payloadString = JSON.stringify(payload);
    
    // 3. Compress and encrypt the payload
    const originalSize = new TextEncoder().encode(payloadString).length;
    const compressedPayload = pako.deflate(payloadString);
    const compressedSize = compressedPayload.byteLength;
    const encryptedData = await cryptoService.encrypt(compressedPayload, encryptionKey);
    const encryptedSize = encryptedData.length;

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    try {
        const payloadCopy = JSON.parse(payloadString);
        console.debug(
            `Sharing payload stats: Original: ${formatBytes(originalSize)}, Compressed: ${formatBytes(compressedSize)}, Encrypted: ${formatBytes(encryptedSize)}`,
            payloadCopy
        );
    } catch (e) {
        console.warn('Could not log share payload for debugging.');
    }
    
    return encryptedData;
}

export const recreateShareSession = async (
    bill: Bill,
    settings: Settings,
    updateBillCallback: (updatedBill: Bill) => Promise<void>
): Promise<Bill> => {
    let updatedBill = JSON.parse(JSON.stringify(bill));

    const existingShareInfo = updatedBill.shareInfo;
    const keyRecord = await getBillSigningKey(updatedBill.id);

    if (!existingShareInfo?.shareId || !existingShareInfo.encryptionKey || !existingShareInfo.signingPublicKey || !keyRecord) {
        console.error("Cannot recreate share session: Existing keys or shareId are missing.", { billId: updatedBill.id });
        throw new Error("Cannot re-sync bill because its original sharing keys or ID are missing.");
    }
    
    const { shareId, encryptionKey: encryptionKeyJwk, signingPublicKey: signingPublicKeyJwk } = existingShareInfo;
    const { privateKey } = keyRecord;

    const billEncryptionKey = await cryptoService.importEncryptionKey(encryptionKeyJwk);
    delete updatedBill.participantShareInfo;

    const encryptedData = await encryptAndSignPayload(updatedBill, settings, privateKey, signingPublicKeyJwk, billEncryptionKey);

    const shareResponse = await fetchWithRetry(await getApiUrl(`/share/${shareId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData, updateToken: existingShareInfo.updateToken }),
    });

    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) {
        throw new Error(shareResult.error || `Failed to revive the share session on the server for shareId: ${shareId}.`);
    }

    if (shareResult.updateToken && updatedBill.shareInfo) {
        updatedBill.shareInfo.updateToken = shareResult.updateToken;
    }
    if (shareResult.lastUpdatedAt) {
        updatedBill.lastUpdatedAt = shareResult.lastUpdatedAt;
    }

    await updateBillCallback(updatedBill);
    
    return updatedBill;
};

/**
 * Pushes an update for an already-shared bill to the server.
 * @param bill The updated bill object.
 * @param settings The current app settings.
 * @param updateBillCallback Callback to save the bill if the server provides a new update token (migration).
 */
export async function syncSharedBillUpdate(
    bill: Bill,
    settings: Settings,
    updateBillCallback: (bill: Bill) => Promise<any>
): Promise<void> {
  if (!bill.shareInfo?.shareId) {
    console.warn("Attempted to sync a bill without a shareId.", bill.id);
    return;
  }

  const keyRecord = await getBillSigningKey(bill.id);
  if (!keyRecord || !keyRecord.privateKey) {
    throw new Error(`Could not find signing key for shared bill ${bill.id}. Cannot sync update.`);
  }

  const billEncryptionKey = await cryptoService.importEncryptionKey(bill.shareInfo.encryptionKey);
  const signingPublicKeyJwk = bill.shareInfo.signingPublicKey;
  const encryptedData = await encryptAndSignPayload(bill, settings, keyRecord.privateKey, signingPublicKeyJwk, billEncryptionKey);
  
  const updateToken = bill.shareInfo.updateToken;

  const response = await fetchWithRetry(await getApiUrl(`/share/${bill.shareInfo.shareId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedData, updateToken }),
  });
  
  const result = await response.json();

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(result.details || 'Update forbidden. This bill may have been updated from another device. Please refresh.');
    }
    throw new Error(result.error || 'Failed to sync bill update to the server.');
  }

  // Handle migration: server sends back a new token for legacy bills
  if (result.updateToken) {
    console.log(`Received new update token for bill ${bill.id}. Migrating.`);
    const migratedBill: Bill = {
      ...bill,
      shareInfo: {
        ...bill.shareInfo,
        updateToken: result.updateToken,
      },
      lastUpdatedAt: result.lastUpdatedAt
    };
    // Silently update the bill in the DB with the new token
    await updateBillCallback(migratedBill);
  }

  console.log(`Successfully synced update for bill ${bill.id}`);
}

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
                    const constituentInfo = summaryToUpdate.constituentShares!.find(cs => cs.shareId === share.shareId)!;

                    try {
                        const key = await cryptoService.importEncryptionKey(constituentInfo.encryptionKey);
                        const decrypted = await cryptoService.decrypt(share.encryptedData, key);
                        const json = pako.inflate(decrypted, { to: 'string' });
                        const payload: SharedBillPayload = JSON.parse(json);
                        const pubKey = await cryptoService.importPublicKey(payload.publicKey);
                        if (!await cryptoService.verify(JSON.stringify(payload.bill), payload.signature, pubKey)) throw new Error("Signature failed for constituent bill.");

                        const itemIndex = summaryToUpdate.sharedData.bill.items.findIndex((i: any) => i.id === constituentInfo.originalBillId);
                        if (itemIndex > -1) {
                            summaryToUpdate.sharedData.bill.items[itemIndex].originalBillData = payload.bill;
                            const myParticipantInOriginal = payload.bill.participants.find(p => p.id === summaryToUpdate.myParticipantId);
                            summaryToUpdate.sharedData.bill.items[itemIndex].price = myParticipantInOriginal?.amountOwed || 0;
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
                let totalOwed = 0;
                let allConstituentsPaid = true;
                const paidItems: Record<string, boolean> = { ...(summary.localStatus.paidItems || {}) };

                for (const item of summary.sharedData.bill.items) {
                    totalOwed += item.price;
                    const originalBill = item.originalBillData;
                    if (originalBill) {
                         const myParticipantInOriginal = originalBill.participants.find((p: Participant) => p.id === summary.myParticipantId);
                         if (myParticipantInOriginal?.paid) {
                            paidItems[item.id] = true;
                         }
                    }
                    if (!paidItems[item.id]) {
                        allConstituentsPaid = false;
                    }
                }
                
                summary.sharedData.bill.totalAmount = totalOwed;
                if (summary.sharedData.bill.participants[0]) {
                    summary.sharedData.bill.participants[0].amountOwed = totalOwed;
                }
                summary.localStatus.paidItems = paidItems;
                summary.localStatus.myPortionPaid = allConstituentsPaid;
                summary.liveStatus = 'live';
                summary.lastUpdatedAt = Math.max(...summary.sharedData.bill.items.map((i: any) => i.originalBillData?.lastUpdatedAt || 0), summary.lastUpdatedAt);
                
                billsNeedingUpdate.push(summary);
            }
            
            const polledShareIds = new Set(uniqueCheckPayload.map(p => p.shareId));
            bills.forEach(bill => {
              if (bill.liveStatus === 'stale') {
                 if (bill.constituentShares && bill.constituentShares.length > 0) {
                     const allConstituentsPolled = bill.constituentShares.every(cs => polledShareIds.has(cs.shareId));
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

/**
 * Reactivates an expired share on the server by re-uploading the encrypted bill data.
 * @param bill The bill with an expired share.
 * @param settings The user's settings.
 * @returns An object containing the new `lastUpdatedAt` timestamp and the new `updateToken`.
 */
export async function reactivateShare(bill: Bill, settings: Settings): Promise<{ lastUpdatedAt: number; updateToken: string; }> {
  if (!bill.shareInfo?.shareId) {
    throw new Error("Cannot reactivate a bill that was never shared.");
  }

  const keyRecord = await getBillSigningKey(bill.id);
  if (!keyRecord || !keyRecord.privateKey) {
    throw new Error(`Could not find signing key for shared bill ${bill.id}. Cannot reactivate.`);
  }

  const billEncryptionKey = await cryptoService.importEncryptionKey(bill.shareInfo.encryptionKey);
  const signingPublicKeyJwk = bill.shareInfo.signingPublicKey;
  const encryptedData = await encryptAndSignPayload(bill, settings, keyRecord.privateKey, signingPublicKeyJwk, billEncryptionKey);
  
  const updateToken = bill.shareInfo.updateToken;
  
  const response = await fetchWithRetry(await getApiUrl(`/share/${bill.shareInfo.shareId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedData, updateToken }),
  });
  
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to reactivate share on the server.');
  }
  
  // The server now consistently returns a token.
  if (!result.updateToken) {
    throw new Error('Server did not return an update token on reactivation.');
  }

  console.log(`Successfully reactivated share for bill ${bill.id}`);
  return { lastUpdatedAt: result.lastUpdatedAt, updateToken: result.updateToken };
}