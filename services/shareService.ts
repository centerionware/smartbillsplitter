import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import * as cryptoService from './cryptoService.ts';
import { getBillSigningKey, saveBillSigningKey, deleteBillSigningKeyDB } from './db.ts';
import { getApiUrl } from './api.ts';

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
export const generateAggregateBill = (participantName: string, unpaidBills: Bill[], settings: Settings): Bill => {
  const totalOwed = unpaidBills.reduce((sum, bill) => {
    const p = bill.participants.find(p => p.name === participantName);
    return sum + (p?.amountOwed || 0);
  }, 0);

  const items: ReceiptItem[] = unpaidBills.map(bill => {
    const p = bill.participants.find(p => p.name === participantName);
    return {
      id: bill.id,
      name: bill.description,
      price: p?.amountOwed || 0,
      assignedTo: [] // Not relevant for summary
    };
  });

  const summaryParticipant: Participant = {
    id: 'summary-participant-1',
    name: participantName,
    amountOwed: totalOwed,
    paid: false,
  };

  return {
    id: `summary-${Date.now()}`,
    description: `Summary for ${participantName}`,
    totalAmount: totalOwed,
    date: new Date().toISOString(),
    participants: [summaryParticipant],
    items,
    status: 'active',
  };
};

/**
 * Encrypts a bill and generates a one-time-use shareable URL. This version is for ephemeral
 * bills (like dashboard summaries) and does not persist any share state.
 * @param bill The bill to share.
 * @param settings The current app settings.
 * @returns A promise resolving to the shareable URL string.
 */
export const generateOneTimeShareLink = async (bill: Bill, settings: Settings): Promise<string> => {
    // For one-time links, we always generate fresh keys and do not persist them.
    const signingKeyPair = await cryptoService.generateSigningKeyPair();
    const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
    const billEncryptionKey = await cryptoService.generateEncryptionKey();

    const encryptedData = await encryptAndSignPayload(bill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey);
    const shareResponse = await fetch(getApiUrl('/share'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
    });
    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
    const { shareId } = shareResult;

    // Encrypt participant ID to embed in the URL
    const participantId = bill.participants[0].id;
    const encryptedParticipantId = await cryptoService.encrypt(participantId, billEncryptionKey);
    const urlSafeEncryptedParticipantId = encryptedParticipantId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // Create the one-time key exchange mechanism.
    const fragmentKey = await cryptoService.generateEncryptionKey();
    const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
    const encryptedBillKey = await cryptoService.encrypt(JSON.stringify(billEncryptionKeyJwk), fragmentKey);

    const keyResponse = await fetch(getApiUrl('/onetime-key'), {
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

    // If share info exists, verify it's still valid on the server before proceeding.
    // This prevents generating a link that points to an expired/non-existent share.
    if (updatedBill.shareInfo) {
        try {
            const res = await fetch(getApiUrl(`/share/${updatedBill.shareInfo.shareId}`), {
                method: 'GET',
                signal: AbortSignal.timeout(4000) // Use a timeout to prevent long waits
            });
            
            // If the share is not found on the server, it has expired or been deleted.
            // We must recreate it.
            if (res.status === 404) {
                console.warn(`Share session for bill ${updatedBill.id} not found on server. Recreating...`);
                // recreateShareSession handles all the logic of generating new keys,
                // saving them, updating the server, and persisting the updated bill locally.
                updatedBill = await recreateShareSession(updatedBill, settings, updateBillCallback);
            } else if (!res.ok) {
                // For other server errors (e.g., 500), it's better to fail fast.
                throw new Error(`Failed to verify existing share session. Status: ${res.status}`);
            }
            // If res.ok, the share exists and we can proceed.
        } catch (error: any) {
            console.error("Could not verify share session:", error);
            // Re-throw a user-friendly error to be caught by the UI.
            if (error.name === 'AbortError') {
                throw new Error('Could not connect to the server to verify the share link. Please check your connection and try again.');
            }
            throw new Error(error.message || 'An unexpected error occurred while verifying the share link.');
        }
    }


    // 1. Ensure the main bill sharing infrastructure is set up.
    if (!updatedBill.shareInfo) {
        needsDBUpdate = true;
        const signingKeyPair = await cryptoService.generateSigningKeyPair();
        await saveBillSigningKey(updatedBill.id, signingKeyPair.privateKey);
        const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
        
        const billEncryptionKey = await cryptoService.generateEncryptionKey();
        const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);

        const encryptedData = await encryptAndSignPayload(updatedBill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey);
        const shareResponse = await fetch(getApiUrl('/share'), {
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

    // 2. Check for an existing, unexpired, and unconsumed key.
    if (existingShareInfo && now < existingShareInfo.expires) {
        try {
            // Check server status of the key before reusing it.
            const statusResponse = await fetch(getApiUrl(`/onetime-key/${existingShareInfo.keyId}/status`));
            if (statusResponse.ok) {
                const { status } = await statusResponse.json();
                if (status === 'available') {
                    keyIsAvailableOnServer = true;
                }
            }
            // If response is not ok (e.g., 404), keyIsAvailableOnServer remains false.
        } catch (e) {
            console.error("Failed to check key status, will generate a new one.", e);
            keyIsAvailableOnServer = false;
        }
    }

    // 3. If no key is available (none exists, client-expired, or server-consumed), generate a new one.
    if (!keyIsAvailableOnServer) {
        needsDBUpdate = true;
        const billEncryptionKey = await cryptoService.importEncryptionKey(updatedBill.shareInfo.encryptionKey);
        const fragmentKey = await cryptoService.generateEncryptionKey();
        const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
        const encryptedBillKey = await cryptoService.encrypt(JSON.stringify(billEncryptionKeyJwk), fragmentKey);

        const keyResponse = await fetch(getApiUrl('/onetime-key'), {
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
            expires: now + 5 * 60 * 1000, // 5 minute client-side expiry
        };
    }

    // 4. Persist the updated bill state if any changes were made.
    if (needsDBUpdate) {
        await updateBillCallback(updatedBill);
    }
    
    // 5. Encrypt participant ID and construct the URL
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
    encryptionKey: CryptoKey
): Promise<string> {
    // Create a version of the bill for payload that doesn't include participant share info
    const { participantShareInfo, ...billForPayload } = bill;
    
    const signature = await cryptoService.sign(JSON.stringify(billForPayload), privateKey);
    const payload: SharedBillPayload = {
        bill: billForPayload,
        creatorName: settings.myDisplayName,
        publicKey: publicKeyJwk,
        signature,
        paymentDetails: settings.paymentDetails,
    };
    return cryptoService.encrypt(JSON.stringify(payload), encryptionKey);
}

export const recreateShareSession = async (
    bill: Bill,
    settings: Settings,
    updateBillCallback: (updatedBill: Bill) => Promise<void>
): Promise<Bill> => {
    let updatedBill = JSON.parse(JSON.stringify(bill));

    // 1. Verify that we have the necessary keys and the original shareId to proceed.
    const existingShareInfo = updatedBill.shareInfo;
    const keyRecord = await getBillSigningKey(updatedBill.id);

    if (!existingShareInfo?.shareId || !existingShareInfo.encryptionKey || !existingShareInfo.signingPublicKey || !keyRecord) {
        // This is a critical state issue. We cannot proceed without the original cryptographic identity of the share.
        // It's safer to fail than to create new keys and de-sync existing recipients.
        console.error("Cannot recreate share session: Existing keys or shareId are missing.", { billId: updatedBill.id });
        throw new Error("Cannot re-sync bill because its original sharing keys or ID are missing.");
    }
    
    // 2. We will reuse the existing keys and shareId.
    const { shareId, encryptionKey: encryptionKeyJwk, signingPublicKey: signingPublicKeyJwk } = existingShareInfo;
    const { privateKey } = keyRecord;

    // Import the keys for use.
    const billEncryptionKey = await cryptoService.importEncryptionKey(encryptionKeyJwk);

    // 3. Clear out all old participant-specific share links as they are now invalid because their
    // one-time keys on the server have expired along with the main session.
    delete updatedBill.participantShareInfo;

    // 4. Re-encrypt the current bill payload using the original, persistent keys.
    const encryptedData = await encryptAndSignPayload(updatedBill, settings, privateKey, signingPublicKeyJwk, billEncryptionKey);

    // 5. POST to the server to "revive" the share session using the original shareId.
    // The backend is designed to handle this as an upsert operation.
    const shareResponse = await fetch(getApiUrl(`/share/${shareId}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
    });

    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) {
        // If this fails, there's a server-side issue, and we cannot recover automatically.
        throw new Error(shareResult.error || `Failed to revive the share session on the server for shareId: ${shareId}.`);
    }

    // 6. The bill object itself hasn't changed besides clearing participantShareInfo.
    // The key thing is that the server data is now fresh.
    // We only need to persist the cleared participantShareInfo.
    await updateBillCallback(updatedBill);
    
    // 7. Return the (slightly modified) bill object.
    return updatedBill;
};