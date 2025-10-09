import type { Settings, Bill, Participant, ReceiptItem, SharedBillPayload, ConstituentShareInfo } from '../types';
import type { SubscriptionStatus } from '../../hooks/useAuth';
import * as cryptoService from '../cryptoService';

declare var pako: any;

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
export function base64UrlEncode(str: string): string {
    return btoa(utf8ToBinaryString(str))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}


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
