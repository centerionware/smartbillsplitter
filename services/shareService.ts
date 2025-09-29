import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload, ConstituentShareInfo, ImportedBill } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import * as cryptoService from './cryptoService.ts';
import { getBillSigningKey, saveBillSigningKey, deleteBillSigningKeyDB } from './db.ts';
import { getApiUrl, fetchWithRetry } from './api.ts';

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
    updateMultipleBillsCallback: (billsToUpdate: Bill[]) => Promise<void>
): Promise<{ summaryBill: Bill, constituentShares: ConstituentShareInfo[] }> => {
    
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
                const res = await fetchWithRetry(getApiUrl(`/share/${updatedBill.shareInfo.shareId}`), { method: 'GET', signal: AbortSignal.timeout(4000) });
                if (res.status === 404) { needsServerUpdate = true; needsLocalUpdate = true; }
             } catch (e) { console.warn(`Could not verify share for bill ${bill.id}, proceeding optimistically.`); }
        }

        if (needsServerUpdate) {
            const keyRecord = await getBillSigningKey(updatedBill.id);
            if (!keyRecord || !updatedBill.shareInfo) throw new Error(`Could not find signing key for bill ${updatedBill.id}`);
            const encryptionKey = await cryptoService.importEncryptionKey(updatedBill.shareInfo.encryptionKey);
            const encryptedData = await encryptAndSignPayload(updatedBill, settings, keyRecord.privateKey, updatedBill.shareInfo.signingPublicKey, encryptionKey);
            const url = updatedBill.shareInfo.shareId ? getApiUrl(`/share/${updatedBill.shareInfo.shareId}`) : getApiUrl('/share');
            const shareResponse = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encryptedData }) });
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

  const items: ReceiptItem[] = unpaidBills.map(bill => {
    const p = bill.participants.find(p => p.name === participantName);
    const billToStore = billsToUpdateMap.get(bill.id) || bill;
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
  return { summaryBill, constituentShares };
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
    updateMultipleBillsCallback: (billsToUpdate: Bill[]) => Promise<void>
): Promise<string> => {
    const { summaryBill, constituentShares } = await generateAggregateBill(participantName, unpaidBills, settings, updateMultipleBillsCallback);
    const signingKeyPair = await cryptoService.generateSigningKeyPair();
    const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
    const billEncryptionKey = await cryptoService.generateEncryptionKey();

    const encryptedData = await encryptAndSignPayload(summaryBill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey, constituentShares);
    const shareResponse = await fetchWithRetry(getApiUrl('/share'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
    });
    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
    const { shareId } = shareResult;

    const participantId = summaryBill.participants[0].id;
    const encryptedParticipantId = await cryptoService.encrypt(participantId, billEncryptionKey);
    const urlSafeEncryptedParticipantId = encryptedParticipantId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const fragmentKey = await cryptoService.generateEncryptionKey();
    const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
    const encryptedBillKey = await cryptoService.encrypt(JSON.stringify(billEncryptionKeyJwk), fragmentKey);

    const keyResponse = await fetchWithRetry(getApiUrl('/onetime-key'), {
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

    return url.toString();
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
            const res = await fetchWithRetry(getApiUrl(`/share/${updatedBill.shareInfo.shareId}`), { method: 'GET', signal: AbortSignal.timeout(4000) });
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
        const shareResponse = await fetchWithRetry(getApiUrl('/share'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData }),
        });
        const shareResult = await shareResponse.json();
        if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
        
        updatedBill.shareInfo = { 
            shareId: shareResult.shareId, 
            encryptionKey: billEncryptionKeyJwk, 
            signingPublicKey: signingPublicKeyJwk 
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
            const statusResponse = await fetchWithRetry(getApiUrl(`/onetime-key/${existingShareInfo.keyId}/status`));
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
        const encryptedBillKey = await cryptoService.encrypt(JSON.stringify(billEncryptionKeyJwk), fragmentKey);

        const keyResponse = await fetchWithRetry(getApiUrl('/onetime-key'), {
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
    const encryptedParticipantId = await cryptoService.encrypt(participantId, billEncryptionKey);
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
    const { participantShareInfo, ...billForPayload } = bill;
    
    const signature = await cryptoService.sign(JSON.stringify(billForPayload), privateKey);
    const payload: SharedBillPayload = {
        bill: billForPayload,
        creatorName: settings.myDisplayName,
        publicKey: publicKeyJwk,
        signature,
        paymentDetails: settings.paymentDetails,
    };
    if (constituentShares) {
        payload.constituentShares = constituentShares;
    }
    return cryptoService.encrypt(JSON.stringify(payload), encryptionKey);
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

    const shareResponse = await fetchWithRetry(getApiUrl(`/share/${shareId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
    });

    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) {
        throw new Error(shareResult.error || `Failed to revive the share session on the server for shareId: ${shareId}.`);
    }

    await updateBillCallback(updatedBill);
    
    return updatedBill;
};

/**
 * Pushes an update for an already-shared bill to the server.
 * @param bill The updated bill object.
 * @param settings The current app settings.
 */
export async function syncSharedBillUpdate(bill: Bill, settings: Settings): Promise<void> {
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
  
  const response = await fetchWithRetry(getApiUrl(`/share/${bill.shareInfo.shareId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedData }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to sync bill update to the server.');
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

    const checkPayload = bills.map(b => ({ shareId: b.shareId, lastUpdatedAt: b.lastUpdatedAt }));
    const billsNeedingUpdate: ImportedBill[] = [];

    try {
        const response = await fetchWithRetry(getApiUrl('/share/batch-check'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(checkPayload),
            signal: AbortSignal.timeout(20000)
        });
        
        if (response.ok) {
            const updatedShares: { shareId: string, encryptedData: string, lastUpdatedAt: number }[] = await response.json();
            const updatedIds = new Set(updatedShares.map(s => s.shareId));

            for (const bill of bills) {
                if (!updatedIds.has(bill.shareId) && bill.liveStatus === 'stale') {
                    billsNeedingUpdate.push({ ...bill, liveStatus: 'live' });
                }
            }

            for (const share of updatedShares) {
                const originalBill = bills.find(b => b.shareId === share.shareId);
                if (!originalBill) continue;
                try {
                    const symmetricKey = await cryptoService.importEncryptionKey(originalBill.shareEncryptionKey);
                    const decryptedJson = await cryptoService.decrypt(share.encryptedData, symmetricKey);
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
        } else {
            throw new Error(`Batch check failed with status ${response.status}`);
        }
    } catch (error) {
        console.error("Polling for imported bills failed:", error);
        for (const bill of bills) {
            if (bill.liveStatus !== 'stale') billsNeedingUpdate.push({ ...bill, liveStatus: 'stale' });
        }
    }
    
    return billsNeedingUpdate;
}


/**
 * Polls the server to check the status of bills the user has shared.
 * @param bills An array of the user's bills that have shareInfo.
 * @returns A promise that resolves to an array of bill objects that need their status updated locally.
 */
export async function pollOwnedSharedBills(bills: Bill[]): Promise<Bill[]> {
    const billsToUpdate: Bill[] = [];

    const results = await Promise.allSettled(bills.map(async (bill) => {
        if (!bill.shareInfo?.shareId) return null;

        try {
            const response = await fetchWithRetry(getApiUrl(`/share/${bill.shareInfo.shareId}`), {
                method: 'GET',
                signal: AbortSignal.timeout(15000)
            });

            if (response.status === 200 || response.status === 304) {
                if (bill.shareStatus !== 'live') {
                    return { ...bill, shareStatus: 'live' as const };
                }
            } else if (response.status === 404) {
                if (bill.shareStatus !== 'expired') {
                    return { ...bill, shareStatus: 'expired' as const };
                }
            } else {
                if (bill.shareStatus !== 'error') {
                     return { ...bill, shareStatus: 'error' as const };
                }
            }
        } catch (error) {
            console.error(`Polling failed for owned bill ${bill.id}:`, error);
            if (bill.shareStatus !== 'error') {
                 return { ...bill, shareStatus: 'error' as const };
            }
        }
        return null;
    }));

    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            billsToUpdate.push(result.value);
        }
    }
    return billsToUpdate;
}

/**
 * Reactivates an expired share on the server by re-uploading the encrypted bill data.
 * @param bill The bill with an expired share.
 * @param settings The user's settings.
 */
export async function reactivateShare(bill: Bill, settings: Settings): Promise<void> {
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
  
  const response = await fetchWithRetry(getApiUrl(`/share/${bill.shareInfo.shareId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedData }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to reactivate share on the server.');
  }

  console.log(`Successfully reactivated share for bill ${bill.id}`);
}