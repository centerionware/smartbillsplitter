import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import * as cryptoService from './cryptoService.ts';
import { getBillSigningKey, saveBillSigningKey } from './db.ts';

interface ShareBillInfo {
    description: string;
    amountOwed: number;
}

// Helper to Base64URL encode a string, making it safe for URLs
function base64UrlEncode(str: string): string {
    // Regular base64 contains characters that are not URL-safe (+, /, =)
    return btoa(str)
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
 * Encrypts a bill, uploads it, and generates a single, one-time-use shareable URL.
 * The URL contains a temporary key in the fragment, which is used to decrypt the long-term
 * bill key fetched from a self-destructing server endpoint.
 * @param bill The bill to share.
 * @param settings The current app settings.
 * @param onShareInfoCreated Optional callback to persist new share info for a real bill.
 * @returns A promise resolving to the shareable URL string.
 */
export const generateShareLink = async (
    bill: Bill,
    settings: Settings,
    onShareInfoCreated?: (info: Bill['shareInfo']) => Promise<void>
): Promise<string> => {
    let shareId = bill.shareInfo?.shareId;
    let billEncryptionKey: CryptoKey;
    
    // 1. Setup Keys & Share Session if needed for the main bill data
    if (!bill.shareInfo) {
        // This is the first time this specific bill is being shared.
        // Generate and store all necessary long-term keys.
        const signingKeyPair = await cryptoService.generateSigningKeyPair();
        await saveBillSigningKey(bill.id, signingKeyPair.privateKey);
        const signingPublicKeyJwk = await cryptoService.exportKey(signingKeyPair.publicKey);
        
        billEncryptionKey = await cryptoService.generateEncryptionKey();
        const billEncryptionKeyJwk = await cryptoService.exportKey(billEncryptionKey);

        // Encrypt and upload the main bill payload
        const encryptedData = await encryptAndSignPayload(bill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey);
        const shareResponse = await fetch('/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData }),
        });
        const shareResult = await shareResponse.json();
        if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
        
        shareId = shareResult.shareId;
        const newShareInfo = { shareId, encryptionKey: billEncryptionKeyJwk, signingPublicKey: signingPublicKeyJwk };

        if (onShareInfoCreated) {
            await onShareInfoCreated(newShareInfo);
        }
    } else {
        // Bill has been shared before, so we can reuse its existing long-term key.
        billEncryptionKey = await cryptoService.importEncryptionKey(bill.shareInfo.encryptionKey);
    }

    if (!shareId) throw new Error("Could not determine shareId for the bill.");

    // 2. Create the one-time key exchange mechanism for this specific share action.
    // This part runs every time a new link is generated.
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

    // 3. Construct the final URL with all parts in the fragment.
    const fragmentKeyJwk = await cryptoService.exportKey(fragmentKey);
    const encodedFragmentKey = base64UrlEncode(JSON.stringify(fragmentKeyJwk));

    const url = new URL(window.location.href);
    url.hash = `#/view-bill?shareId=${shareId}&keyId=${keyId}&fragmentKey=${encodedFragmentKey}`;

    return url.toString();
};


export async function encryptAndSignPayload(
    bill: Bill, 
    settings: Settings, 
    privateKey: CryptoKey, 
    publicKeyJwk: JsonWebKey,
    encryptionKey: CryptoKey
): Promise<string> {
    const signature = await cryptoService.sign(JSON.stringify(bill), privateKey);
    const payload: SharedBillPayload = {
        bill,
        creatorName: settings.myDisplayName,
        publicKey: publicKeyJwk,
        signature,
    };
    return cryptoService.encrypt(JSON.stringify(payload), encryptionKey);
}