import type { Bill, Participant, Settings } from '../types';
import type { SubscriptionStatus } from '../../hooks/useAuth';
import * as cryptoService from '../cryptoService';
import { getApiUrl, fetchWithRetry } from '../api';
import { generateAggregateBill } from './aggregate';
import { base64UrlEncode, encryptAndSignPayload } from './utils';
import { recreateShareSession } from './session';
import { saveBillSigningKey, getBillSigningKey } from '../db';

declare var pako: any;

const FREE_TIER_IMAGE_SHARE_LIMIT = 5;

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
