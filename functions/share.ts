import { randomUUID } from 'crypto';
import { HttpRequest, HttpResponse } from '../http-types';
import type { KeyValueStore } from '../services/keyValueStore';

const EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

// --- Business Logic ---
// These functions contain the core logic for share sessions and are independent of the server framework.

/**
 * Checks the existence of multiple share sessions.
 * @param shareIds An array of share IDs to check.
 * @param kv The KeyValueStore instance to use.
 * @returns A promise resolving to an array of objects with their status.
 */
async function checkBatchShareStatus(
  shareIds: string[],
  kv: KeyValueStore
): Promise<{ shareId: string; status: 'live' | 'expired' }[]> {
  if (!Array.isArray(shareIds) || shareIds.length === 0) {
    return [];
  }
  
  const results: { shareId: string; status: 'live' | 'expired' }[] = [];

  // This can be slow without a multi-get, but it's one network call from client.
  for (const shareId of shareIds) {
    const key = `share:${shareId}`;
    const exists = await kv.exists(key);
    results.push({ shareId, status: exists ? 'live' : 'expired' });
  }

  return results;
}

/**
 * Creates a new share session or updates an existing one (upsert).
 * @param encryptedData The encrypted data payload.
 * @param kv The KeyValueStore instance to use.
 * @param shareId Optional ID for creating/updating a specific share. If not provided, a new UUID is generated.
 * @param updateToken An optional token required to update an existing share.
 * @returns An object with the share ID, last update timestamp, and the updateToken (for new or migrated shares).
 */
async function createOrUpdateShare(
    encryptedData: string, 
    kv: KeyValueStore, 
    shareId?: string,
    updateToken?: string
): Promise<{ shareId: string; lastUpdatedAt: number; updateToken?: string }> {
    if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error("Invalid payload. 'encryptedData' string is required.");
    }
    const now = Date.now();

    if (shareId) { // This is an UPDATE or RECREATE
        const key = `share:${shareId}`;
        const existingSessionJson = await kv.get(key);

        if (existingSessionJson) { // It's a standard UPDATE
            const storedPayload = JSON.parse(existingSessionJson);
            
            if (storedPayload.updateToken) { // Modern record, requires token validation
                if (!updateToken || storedPayload.updateToken !== updateToken) {
                    throw new Error("Forbidden: Invalid update token provided.");
                }
                const newPayload = { ...storedPayload, encryptedData, lastUpdatedAt: now };
                await kv.set(key, JSON.stringify(newPayload), { EX: EXPIRATION_SECONDS });
                // FIX: Consistently return the update token on a successful update for client-side state consistency.
                return { shareId, lastUpdatedAt: now, updateToken: storedPayload.updateToken };

            } else { // Legacy record, perform migration
                const newUpdateToken = randomUUID();
                const newPayload = { ...storedPayload, encryptedData, lastUpdatedAt: now, updateToken: newUpdateToken };
                await kv.set(key, JSON.stringify(newPayload), { EX: EXPIRATION_SECONDS });
                // Return the NEW token so the client can save it
                return { shareId, lastUpdatedAt: now, updateToken: newUpdateToken };
            }
        } else { // It's a RECREATE (e.g., from an expired link or DB wipe)
            // This logic handles the user's reported issue. If a client tries to update a share
            // that no longer exists on the server, we treat it as a request to recreate it.
            // A new update token is generated and returned to the client to re-establish sync.
            const newUpdateToken = randomUUID();
            const payload = { encryptedData, lastUpdatedAt: now, updateToken: newUpdateToken };
            await kv.set(key, JSON.stringify(payload), { EX: EXPIRATION_SECONDS });
            // Return the NEW token
            return { shareId, lastUpdatedAt: now, updateToken: newUpdateToken };
        }
    } else { // This is a CREATE
        const newShareId = randomUUID();
        const newUpdateToken = randomUUID();
        const key = `share:${newShareId}`;
        const newSessionPayload = {
            encryptedData,
            lastUpdatedAt: now,
            updateToken: newUpdateToken
        };
        await kv.set(key, JSON.stringify(newSessionPayload), { EX: EXPIRATION_SECONDS });
        return { shareId: newShareId, lastUpdatedAt: now, updateToken: newUpdateToken };
    }
}


/**
 * Retrieves data from a share session.
 * This is backward-compatible and handles payloads that may use the legacy `data` key.
 * @param shareId The ID of the share to retrieve.
 * @param kv The KeyValueStore instance to use.
 * @returns An object containing the encrypted data and last update timestamp.
 */
async function retrieveShare(shareId: string, kv: KeyValueStore): Promise<{ encryptedData: string; lastUpdatedAt: number }> {
    if (!shareId) {
        throw new Error("Missing 'shareId'.");
    }
    const key = `share:${shareId}`;
    const sessionJson = await kv.get(key);

    if (!sessionJson) {
        throw new Error("Invalid or expired share ID.");
    }
    const payload = JSON.parse(sessionJson);
    
    // FIX: A more robust and explicit check for both new and legacy data formats.
    // This ensures that even if old data exists, it is correctly processed and returned
    // to the client in the expected format, preventing polling failures.
    let encryptedContent = payload.encryptedData;
    if (!encryptedContent && payload.data) {
        encryptedContent = payload.data;
    }

    if (!encryptedContent || typeof encryptedContent !== 'string') {
        throw new Error("Share session is corrupted and contains no valid data payload.");
    }
    if (!payload.lastUpdatedAt || typeof payload.lastUpdatedAt !== 'number') {
        throw new Error("Share session is corrupted and is missing a timestamp.");
    }
    
    // Always return the data under the 'encryptedData' key for client consistency.
    return {
        encryptedData: encryptedContent,
        lastUpdatedAt: payload.lastUpdatedAt,
    };
}

/**
 * Efficiently retrieves multiple share sessions, returning only those that have been updated.
 * @param checkPayload An array of objects, each with a shareId and the client's lastUpdatedAt timestamp.
 * @param kv The KeyValueStore instance to use.
 * @returns A promise resolving to an array of full share payloads for only the updated bills.
 */
async function retrieveBatchShares(
  checkPayload: { shareId: string; lastUpdatedAt: number }[],
  kv: KeyValueStore
): Promise<{ shareId: string; encryptedData: string; lastUpdatedAt: number }[]> {
  if (!Array.isArray(checkPayload) || checkPayload.length === 0) {
    return [];
  }
  
  const updatedBills: { shareId: string; encryptedData: string; lastUpdatedAt: number }[] = [];

  // Query stores one by one for each key. A multi-get (mget) is not part of the generic interface.
  for (const clientData of checkPayload) {
    const sessionJson = await kv.get(`share:${clientData.shareId}`);
    if (!sessionJson) continue; // Not found or expired

    const serverPayload = JSON.parse(sessionJson);
    if (serverPayload.lastUpdatedAt > clientData.lastUpdatedAt) {
        const encryptedContent = serverPayload.encryptedData || serverPayload.data;
        if (encryptedContent) {
            updatedBills.push({
                shareId: clientData.shareId,
                encryptedData: encryptedContent,
                lastUpdatedAt: serverPayload.lastUpdatedAt,
            });
        }
    }
  }

  return updatedBills;
}


// --- Framework-Agnostic Handler ---
export const shareHandler = async (req: HttpRequest, context: { kv: KeyValueStore }): Promise<HttpResponse> => {
  const responseHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    // Handle batch status endpoint: POST /share/batch-status
    if (req.method === "POST" && req.path.endsWith('/batch-status')) {
        const { shareIds } = req.body;
        const result = await checkBatchShareStatus(shareIds, context.kv);
        return {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify(result)
        };
    }
    
    // Handle the new batch check endpoint: POST /share/batch-check
    if (req.method === "POST" && req.path.endsWith('/batch-check')) {
        const batchPayload = req.body;