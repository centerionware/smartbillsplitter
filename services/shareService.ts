import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload, ConstituentShareInfo, ImportedBill } from '../types';
import type { SubscriptionStatus } from '../hooks/useAuth';
import * as cryptoService from './cryptoService';
import { getBillSigningKey, saveBillSigningKey, deleteBillSigningKeyDB } from './db';
import { getApiUrl, fetchWithRetry } from './api';

// FIX: Added declaration for pako, which is loaded as a global script.
declare var pako: any;

const FREE_TIER_IMAGE_SHARE_LIMIT = 5;

interface ShareBillInfo {
    description: string;
    amountOwed: number;
}

// FIX: Add missing functions that were being imported in useAppLogic.ts
export const pollImportedBills = async (
  importedBills: ImportedBill[]
): Promise<ImportedBill[]> => {
  if (importedBills.length === 0) return [];

  console.log("Polling for updates on imported bills...");
  const checkPayload = importedBills.map(b => ({
    shareId: b.shareId,
    lastUpdatedAt: b.lastUpdatedAt
  }));

  try {
    const response = await fetchWithRetry(await getApiUrl('/share/batch-check'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkPayload)
    });

    if (!response.ok) {
      console.error('Failed to poll for imported bill updates:', response.statusText);
      return [];
    }

    const updatedBillPayloads: { shareId: string; encryptedData: string; lastUpdatedAt: number }[] = await response.json();
    if (updatedBillPayloads.length === 0) {
      console.log("No imported bills have been updated.");
      return [];
    }
    
    console.log(`${updatedBillPayloads.length} imported bills have updates.`);
    const updatedBills: ImportedBill[] = [];

    for (const payload of updatedBillPayloads) {
      const originalBill = importedBills.find(b => b.shareId === payload.shareId);
      if (!originalBill) continue;

      try {
        const encryptionKey = await cryptoService.importEncryptionKey(originalBill.shareEncryptionKey);
        const decryptedBytes = await cryptoService.decrypt(payload.encryptedData, encryptionKey);
        const decryptedJson = pako.inflate(decryptedBytes, { to: 'string' });
        const data: SharedBillPayload = JSON.parse(decryptedJson);

        const publicKey = await cryptoService.importPublicKey(data.publicKey);
        const isVerified = await cryptoService.verify(JSON.stringify(data.bill), data.signature, publicKey);
        if (!isVerified) {
          console.warn(`Signature verification failed for updated imported bill ${originalBill.id}. Skipping update.`);
          continue;
        }

        const updatedImportedBill: ImportedBill = {
          ...originalBill,
          sharedData: {
            bill: data.bill,
            creatorPublicKey: data.publicKey,
            signature: data.signature,
            paymentDetails: data.paymentDetails
          },
          lastUpdatedAt: payload.lastUpdatedAt,
          liveStatus: 'live'
        };
        updatedBills.push(updatedImportedBill);
      } catch (e) {
        console.error(`Failed to decrypt or verify update for imported bill ${originalBill.id}`, e);
        const billWithError: ImportedBill = { ...originalBill, liveStatus: 'error' };
        updatedBills.push(billWithError);
      }
    }
    return updatedBills;
  } catch (error) {
    console.error("Polling for imported bills failed:", error);
    return importedBills.map(b => ({ ...b, liveStatus: 'stale' }));
  }
};

export const pollOwnedSharedBills = async (
  ownedBills: Bill[]
): Promise<Bill[]> => {
  if (ownedBills.length === 0) return [];
  console.log("Polling for status of owned shared bills...");

  const shareIds = ownedBills.map(b => b.shareInfo?.shareId).filter(Boolean) as string[];

  try {
    const response = await fetchWithRetry(await getApiUrl('/share/batch-status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareIds })
    });
    
    if (!response.ok) {
      console.error('Failed to poll for owned bill status:', response.statusText);
      return [];
    }

    const statuses: { shareId: string; status: 'live' | 'expired' }[] = await response.json();
    const billsToUpdate: Bill[] = [];
    
    for (const statusInfo of statuses) {
      const bill = ownedBills.find(b => b.shareInfo?.shareId === statusInfo.shareId);
      if (bill && bill.shareStatus !== statusInfo.status) {
        billsToUpdate.push({ ...bill, shareStatus: statusInfo.status });
      }
    }

    if (billsToUpdate.length > 0) {
      console.log(`${billsToUpdate.length} owned shared bills have status changes.`);
    }

    return billsToUpdate;

  } catch (error) {
    console.error("Polling for owned shared bills failed:", error);
    return ownedBills.map(b => ({ ...b, shareStatus: 'error' }));
  }
};

export const reactivateShare = async (
    bill: Bill,
    settings: Settings,
): Promise<{ lastUpdatedAt: number, updateToken: string }> => {
    let updatedBill = JSON.parse(JSON.stringify(bill));

    const existingShareInfo = updatedBill.shareInfo;
    const keyRecord = await getBillSigningKey(updatedBill.id);

    if (!existingShareInfo?.shareId || !existingShareInfo.encryptionKey || !existingShareInfo.signingPublicKey || !keyRecord) {
        console.error("Cannot reactivate share: Existing keys or shareId are missing.", { billId: updatedBill.id });
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

    if (!shareResult.updateToken || !shareResult.lastUpdatedAt) {
        throw new Error("Server did not return expected update token and timestamp on reactivation.");
    }
    
    return { lastUpdatedAt: shareResult.lastUpdatedAt, updateToken: shareResult.updateToken };
};


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
    
    const billsToUpdate: Bill[] = [];
    const constituentShares: ConstituentShareInfo[] = [];
    const billsToUpdateMap = new Map<string, Bill>();

    for (const bill of unpaidBills) {
        let updatedBill = { ...bill };
        let needsServerUpdate = false;
        let needsLocalUpdate = false;

        if (!updatedBill.shareInfo || !updatedBill.shareInfo.shareId) {
            const signingKeyPair = await cryptoService.generateSigningKeyPair();
            await saveBillSigningKey(updatedBill.id, signingKeyPair.privateKey);
            const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
            const billEncryptionKey = await cryptoService.generateEncryptionKey();
            const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
            updatedBill.shareInfo = { shareId: '', encryptionKey: billEncryptionKeyJwk, signingPublicKey: signingPublicKeyJwk };
            needsServerUpdate = true;
            needsLocalUpdate = true;
        } else {
             try {
                {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
                const res = await fetchWithRetry(await getApiUrl(`/share/${updatedBill.shareInfo.shareId}`), { method: 'GET', signal: AbortSignal.timeout(4000) });
                if (res.status === 404) { needsServerUpdate = true; needsLocalUpdate = true; }
             } catch (e) { console.warn(`Could not verify share for bill ${bill.id}, proceeding optimistically.`); }
        }

        if (needsServerUpdate) {
            const keyRecord = await getBillSigningKey(updatedBill.id);
            if (!keyRecord || !updatedBill.shareInfo) throw new Error(`Could not find signing key for bill ${updatedBill.id}`);
            const encryptionKey = await cryptoService.importEncryptionKey(updatedBill.shareInfo.encryptionKey);
            const encryptedData = await encryptAndSignPayload(updatedBill, settings, keyRecord.privateKey, updatedBill.shareInfo.signingPublicKey, encryptionKey);
            {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
            const urlPath = updatedBill.shareInfo.shareId ? `/share/${updatedBill.shareInfo.shareId}` : '/share';
            const shareResponse = await fetchWithRetry(await getApiUrl(urlPath), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encryptedData }) });
            const shareResult = await shareResponse.json();
            if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session for constituent bill.");
            updatedBill.shareInfo.shareId = shareResult.shareId;
        }
        
        if (needsLocalUpdate) {
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
    updateMultipleBillsCallback: (billsToUpdate: Bill[]) => Promise<void>,
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
    
    // FIX: Swapped `participantName` and `unpaidBills` to match the function signature.
    const { summaryBill, constituentShares, imagesDropped } = await generateAggregateBill(participantName, unpaidBills, settings, updateMultipleBillsCallback, availableSlots);
    const signingKeyPair = await cryptoService.generateSigningKeyPair();
    const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
    const billEncryptionKey = await cryptoService.generateEncryptionKey();

    const encryptedData = await encryptAndSignPayload(summaryBill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey, constituentShares);
    {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
    const shareResponse = await fetchWithRetry(await getApiUrl('/share'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
    });
    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
    const { shareId } = shareResult;

    const participantId = summaryBill.participants[0].id;
    // FIX: Compress participant ID before encrypting to match client-side decompression.
    const compressedParticipantId = pako.deflate(participantId);
    const encryptedParticipantId = await cryptoService.encrypt(compressedParticipantId, billEncryptionKey);
    const urlSafeEncryptedParticipantId = encryptedParticipantId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const fragmentKey = await cryptoService.generateEncryptionKey();
    const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
    // FIX: Compress the bill key before encrypting to match client-side decompression.
    const compressedBillKey = pako.deflate(JSON.stringify(billEncryptionKeyJwk));
    const encryptedBillKey = await cryptoService.encrypt(compressedBillKey, fragmentKey);

    {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
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
 * @returns A promise resolving to the shareable URL string.
 */
export const generateShareLink = async (
    bill: Bill,
    participantId: string,
    settings: Settings,
    updateBillCallback: (updatedBill: Bill) => Promise<void>
): Promise<string> => {
    let updatedBill = JSON.parse(JSON.stringify(bill));
    let needsDBUpdate = false;

    if (updatedBill.shareInfo && updatedBill.shareInfo.shareId) {
        try {
            {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
            const res = await fetchWithRetry(await getApiUrl(`/share/${updatedBill.shareInfo.shareId}`), { method: 'GET', signal: AbortSignal.timeout(4000) });
            if (res.status === 404) {
                console.warn(`Share session for bill ${updatedBill.id} not found on server. Recreating...`);
                updatedBill = await recreateShareSession(updatedBill, settings, updateBillCallback);
            } else if (!res.ok) {
                throw new Error(`Failed to verify existing share session. Status: ${res.status}`);
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
        {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
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
            {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
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
        // FIX: Compress the bill key before encrypting to match client-side decompression.
        const compressedBillKey = pako.deflate(JSON.stringify(billEncryptionKeyJwk));
        const encryptedBillKey = await cryptoService.encrypt(compressedBillKey, fragmentKey);

        {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
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
    // FIX: Compress participant ID before encrypting to match client-side decompression.
    const compressedParticipantId = pako.deflate(participantId);
    const encryptedParticipantId = await cryptoService.encrypt(compressedParticipantId, billEncryptionKey);
    const urlSafeEncryptedParticipantId = encryptedParticipantId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const finalShareInfo = updatedBill.participantShareInfo[participantId];
    const encodedFragmentKey = base64UrlEncode(JSON.stringify(finalShareInfo.fragmentKey));

    const url = new URL(window.location.href);
    url.hash = `#/view-bill?shareId=${updatedBill.shareInfo.shareId}&keyId=${finalShareInfo.keyId}&fragmentKey=${encodedFragmentKey}&p=${urlSafeEncryptedParticipantId}`;

    return url.toString();
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

    // FIX: Await getApiUrl to resolve the URL promise before passing to fetch.
    const shareResponse = await fetchWithRetry(await getApiUrl(`/share/${shareId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData, updateToken: existingShareInfo.updateToken }),
    });

    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) {
        throw new Error(shareResult.error || `Failed to revive the share session on the server for shareId: ${shareId}.`);
    }

    // FIX: Update the bill object with the new share info returned from the server.
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

  {/* FIX: Await getApiUrl to resolve the URL promise before passing to fetch. */}
  const response = await fetchWithRetry(await getApiUrl(`/share/${bill.shareInfo.shareId}`), {