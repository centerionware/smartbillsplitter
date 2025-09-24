import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import * as cryptoService from './cryptoService.ts';

interface ShareBillInfo {
    description: string;
    amountOwed: number;
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
 * Encrypts a bill, uploads it, and generates a single shareable URL with a one-time key.
 * @param bill The bill to share.
 * @param settings The current app settings.
 * @param keyPair The user's cryptographic key pair for signing.
 * @returns A promise resolving to an object with the share URL and the shareInfo.
 */
export const generateShareLink = async (
    bill: Bill, 
    settings: Settings, 
    keyPair: CryptoKeyPair
): Promise<{ url: string; shareInfo: Bill['shareInfo'] | null }> => {
    const { links, shareInfo } = await generateShareLinksForParticipants(bill, [], settings, keyPair);
    return { url: links.get('default') || '', shareInfo };
};


/**
 * Generates unique, one-time-use share links for a list of participants.
 * If the participant list is empty, it generates a single default link.
 * @param bill The bill to share.
 * @param participantNames A list of participant names to generate links for.
 * @param settings App settings.
 * @param keyPair User's signing key pair.
 * @returns A map of participant names to their unique share URLs, and the bill's shareInfo.
 */
export const generateShareLinksForParticipants = async (
    bill: Bill,
    participantNames: string[],
    settings: Settings,
    keyPair: CryptoKeyPair
): Promise<{ links: Map<string, string>, shareInfo: Bill['shareInfo'] | null }> => {
    let shareId = bill.shareInfo?.shareId;
    let encryptionKey = bill.shareInfo?.encryptionKey 
        ? await cryptoService.importEncryptionKey(bill.shareInfo.encryptionKey)
        : null;
    let newShareInfo: Bill['shareInfo'] | null = null;
    
    // 1. If the bill hasn't been shared before, create a new session.
    if (!shareId || !encryptionKey) {
        encryptionKey = await cryptoService.generateEncryptionKey();
        const encryptedData = await encryptAndSignPayload(bill, settings, keyPair, encryptionKey);

        const shareResponse = await fetch('/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData }),
        });
        const shareResult = await shareResponse.json();
        if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to upload bill data.");
        
        shareId = shareResult.shareId;
        const exportedKey = await cryptoService.exportKey(encryptionKey);
        newShareInfo = { shareId, encryptionKey: exportedKey };
    }
    
    const exportedKey = await cryptoService.exportKey(encryptionKey);
    const links = new Map<string, string>();
    const namesToGenerate = participantNames.length > 0 ? participantNames : ['default'];

    for (const name of namesToGenerate) {
        const keyResponse = await fetch('/share-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: exportedKey, shareId }),
        });
        const keyResult = await keyResponse.json();
        if (!keyResponse.ok) throw new Error(keyResult.error || `Failed to get one-time key for ${name}.`);
        
        const { keyId } = keyResult;
        const url = new URL(window.location.href);
        url.hash = `#/view-bill?shareId=${shareId}&keyId=${keyId}`;
        links.set(name, url.toString());
    }
    
    return { links, shareInfo: newShareInfo };
};


async function encryptAndSignPayload(
    bill: Bill, 
    settings: Settings, 
    keyPair: CryptoKeyPair, 
    encryptionKey: CryptoKey
): Promise<string> {
    const signature = await cryptoService.sign(JSON.stringify(bill), keyPair.privateKey);
    const publicKeyJwk = await cryptoService.exportKey(keyPair.publicKey);
    const payload: SharedBillPayload = {
        bill,
        creatorName: settings.myDisplayName,
        publicKey: publicKeyJwk,
        signature,
    };
    return cryptoService.encrypt(JSON.stringify(payload), encryptionKey);
}