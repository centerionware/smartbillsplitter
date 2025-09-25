import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import * as cryptoService from './cryptoService.ts';
import { saveBillSigningKey } from './db.ts';

interface ShareBillInfo {
    description: string;
    amountOwed: number;
}

// Converts a UTF-8 string to a binary string where each character's code is 0-255,
// making it suitable for the btoa function. This is a robust way to handle Unicode.
function utf8ToBinaryString(str: string): string {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(str);
  // This is a performant way to convert a Uint8Array to a binary string for btoa
  // It avoids "Maximum call stack size exceeded" errors with large inputs.
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, uint8Array.subarray(i, i + CHUNK_SIZE) as unknown as number[]);
  }
  return binary;
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
    const shareResponse = await fetch('/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
    });
    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
    const { shareId } = shareResult;

    // Create the one-time key exchange mechanism.
    const fragmentKey = await cryptoService.generateEncryptionKey();
    const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);
    const encryptedBillKey = await cryptoService.encrypt(JSON.stringify(billEncryptionKeyJwk), fragmentKey);

    const keyResponse = await fetch('/onetime-key', {
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
    url.hash = `#/view-bill?shareId=${shareId}&keyId=${keyId}&fragmentKey=${encodedFragmentKey}`;

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

    // 1. Ensure the main bill sharing infrastructure is set up.
    if (!updatedBill.shareInfo) {
        needsDBUpdate = true;
        const signingKeyPair = await cryptoService.generateSigningKeyPair();
        await saveBillSigningKey(updatedBill.id, signingKeyPair.privateKey);
        const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
        
        const billEncryptionKey = await cryptoService.generateEncryptionKey();
        const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);

        const encryptedData = await encryptAndSignPayload(updatedBill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey);
        const shareResponse = await fetch('/share', {
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
            const statusResponse = await fetch(`/onetime-key/${existingShareInfo.keyId}/status`);
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

        const keyResponse = await fetch('/onetime-key', {
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
    
    // 5. Construct and return the URL using the (potentially new) info.
    const finalShareInfo = updatedBill.participantShareInfo[participantId];
    const encodedFragmentKey = base64UrlEncode(JSON.stringify(finalShareInfo.fragmentKey));

    const url = new URL(window.location.href);
    url.hash = `#/view-bill?shareId=${updatedBill.shareInfo.shareId}&keyId=${finalShareInfo.keyId}&fragmentKey=${encodedFragmentKey}`;

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
    };
    return cryptoService.encrypt(JSON.stringify(payload), encryptionKey);
}