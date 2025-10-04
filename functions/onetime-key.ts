import { randomUUID } from 'crypto';
import { HttpRequest, HttpResponse } from '../http-types.ts';
import type { KeyValueStore } from '../services/keyValueStore.ts';


// Keys are short-lived, for the initial share only.
const EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

// --- Business Logic ---
// These functions contain the core logic for one-time keys and are independent of the server framework.

/**
 * Creates a new one-time key session, storing an encrypted key.
 * @param encryptedBillKey The encrypted key payload from the client.
 * @param kv The KeyValueStore instance to use.
 * @returns An object containing the generated key ID.
 */
async function createOnetimeKey(encryptedBillKey: string, kv: KeyValueStore): Promise<{ keyId: string }> {
    if (!encryptedBillKey || typeof encryptedBillKey !== 'string') {
        throw new Error("Invalid payload. 'encryptedBillKey' string is required.");
    }
    try {
        const keyId = randomUUID();
        const redisKey = `onetimekey:${keyId}`;
        const payload = JSON.stringify({ encryptedBillKey });
        await kv.set(redisKey, payload, { EX: EXPIRATION_SECONDS });
        console.log(`Created one-time key with ID ${keyId}.`);
        return { keyId };
    } catch (e) {
        console.error('KV error during one-time key creation:', e);
        throw new Error("A database error occurred while creating the one-time key.");
    }
}

/**
 * Atomically retrieves and deletes a one-time key.
 * @param keyId The ID of the key to retrieve.
 * @param kv The KeyValueStore instance to use.
 * @returns An object containing the retrieved encrypted key.
 */
async function retrieveOnetimeKey(keyId: string, kv: KeyValueStore): Promise<{ encryptedBillKey: string; }> {
    if (!keyId) {
        throw new Error("Missing 'keyId'.");
    }
    const redisKey = `onetimekey:${keyId}`;
    
    const payloadJson = await kv.get(redisKey);

    if (payloadJson) {
        await kv.del(redisKey); // Immediately delete after retrieval
        console.log(`One-time key ${keyId} retrieved and deleted.`);
        const payload = JSON.parse(payloadJson);
        if (!payload.encryptedBillKey) {
            throw new Error("Corrupted key payload retrieved from store.");
        }
        return payload;
    } else {
        throw new Error("Invalid or expired key ID.");
    }
}

/**
 * Checks if a one-time key exists without consuming it. Throws an error if not found.
 * @param keyId The ID of the key to check.
 * @param kv The KeyValueStore instance to use.
 * @returns An object with the status 'available'.
 */
async function checkOnetimeKeyStatus(keyId: string, kv: KeyValueStore): Promise<{ status: 'available' }> {
    if (!keyId) {
        throw new Error("Missing 'keyId'.");
    }
    const redisKey = `onetimekey:${keyId}`;
    const exists = await kv.exists(redisKey);
    if (!exists) {
        throw new Error("Key not found or already consumed.");
    }
    return { status: 'available' };
}


// --- Framework-Agnostic Handler ---
export const onetimeKeyHandler = async (req: HttpRequest, context: { kv: KeyValueStore }): Promise<HttpResponse> => {
  const responseHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    if (req.method === "POST") {
        const { encryptedBillKey } = req.body;
        const result = await createOnetimeKey(encryptedBillKey, context.kv);
        return {
          statusCode: 201,
          headers: responseHeaders,
          body: JSON.stringify(result)
        };
    }

    if (req.method === "GET") {
        const { keyId, action } = req.params;
        if (!keyId) {
          throw new Error("Missing 'keyId' for GET request");
        }
        
        if (action === 'status') {
            const result = await checkOnetimeKeyStatus(keyId, context.kv);
            return {
                statusCode: 200,
                headers: responseHeaders,
                body: JSON.stringify(result),
            };
        }

        const result = await retrieveOnetimeKey(keyId, context.kv);
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(result)
        };
    }

    return {
      statusCode: 405,
      headers: { ...responseHeaders, 'Allow': 'GET, POST, OPTIONS' },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };

  } catch (error: any) {
    let statusCode = 500;
    if (error.message.includes("Invalid or expired") || error.message.includes("Key not found or already consumed.")) {
        statusCode = 404;
    } else if (error.message.includes("Invalid payload") || error.message.includes("Missing 'keyId'")) {
        statusCode = 400;
    }
    return {
      statusCode: statusCode,
      headers: responseHeaders,
      body: JSON.stringify({ error: "An internal server error occurred.", details: error.message })
    };
  }
};
