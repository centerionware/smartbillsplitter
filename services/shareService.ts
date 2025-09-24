import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload } from '../types.ts';
import type { SubscriptionStatus } from '../hooks/useAuth.ts';
import * as cryptoService from './cryptoService.ts';

interface ShareBillInfo {
    description: string;
    amountOwed: number;
}

const EXPIRATION_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

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
 * Encrypts a bill, uploads it, and returns a shareable URL.
 * @param bill The bill to share (can be a real bill or a summary bill).
 * @param settings The current app settings.
 * @param keyPair The user's cryptographic key pair for signing.
 * @returns A promise that resolves with the full, shareable URL.
 */
export const generateShareLink = async (bill: Bill, settings: Settings, keyPair: CryptoKeyPair): Promise<string> => {
    const encryptionKey = await cryptoService.generateEncryptionKey();
    const { shareInfo, ...billToSign } = bill;
    const signature = await cryptoService.sign(JSON.stringify(billToSign), keyPair.privateKey);
    const publicKeyJwk = await cryptoService.exportKey(keyPair.publicKey);

    const payload: SharedBillPayload = {
        bill: billToSign as Bill,
        creatorName: settings.myDisplayName,
        publicKey: publicKeyJwk,
        signature,
    };

    const encryptedData = await cryptoService.encrypt(JSON.stringify(payload), encryptionKey);

    const response = await fetch('/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedData }),
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || "Failed to create a share link on the server.");
    }
    
    const { shareId } = result;
    const exportedEncryptionKey = await cryptoService.exportKey(encryptionKey);
    
    // This is temporary info, not saved back to the bill object here.
    const newShareInfo = {
        shareId,
        encryptionKey: exportedEncryptionKey,
        expiresAt: Date.now() + EXPIRATION_WINDOW,
    };

    const keyString = btoa(JSON.stringify(newShareInfo.encryptionKey));
    const url = new URL(window.location.href);
    url.hash = `#/view-bill?shareId=${shareId}&key=${keyString}`;
    
    return url.toString();
};