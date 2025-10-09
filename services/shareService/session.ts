import type { Bill, Settings } from '../../types';
import { getApiUrl, fetchWithRetry } from '../api';
import { getBillSigningKey } from '../db';
import { encryptAndSignPayload } from './utils';
import * as cryptoService from '../cryptoService';

export const recreateShareSession = async (
    bill: Bill,
    settings: Settings,
    updateBillCallback: (updatedBill: Bill, options?: { skipSync?: boolean }) => Promise<void>
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

    await updateBillCallback(updatedBill, { skipSync: true });
    
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
    updateBillCallback: (bill: Bill, options?: { skipSync?: boolean }) => Promise<any>
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

  // Handle server responses that include an update token (e.g., on first update or after migration)
  if (result.updateToken && bill.shareInfo) {
    console.log(`Received new/updated token for bill ${bill.id}. Persisting.`);
    const updatedShareInfo = {
      ...bill.shareInfo,
      updateToken: result.updateToken,
    };
    const updatedBill: Bill = {
      ...bill,
      shareInfo: updatedShareInfo,
      lastUpdatedAt: result.lastUpdatedAt
    };
    // Silently update the bill in the DB with the complete shareInfo object
    await updateBillCallback(updatedBill, { skipSync: true });
  }

  console.log(`Successfully synced update for bill ${bill.id}`);
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
  
  if (!result.updateToken) {
    throw new Error('Server did not return an update token on reactivation.');
  }

  console.log(`Successfully reactivated share for bill ${bill.id}`);
  return { lastUpdatedAt: result.lastUpdatedAt, updateToken: result.updateToken };
}