

import { randomUUID } from 'crypto';
import redisClient from '../services/redisClient.ts';
import { HttpRequest, HttpResponse } from '../http-types';


// Keys are short-lived, for the initial share only.
const EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

// --- Business Logic ---
// These functions contain the core logic for one-time keys and are independent of the server framework.

/**
 * Creates a new one-time key session, storing an encrypted key.
 * @param encryptedBillKey The encrypted key payload from the client.
 * @returns An object containing the generated key ID.
 */
async function createOnetimeKey(encryptedBillKey: string): Promise<{ keyId: string }> {
    if (!encryptedBillKey || typeof encryptedBillKey !== 'string') {
        throw new Error("Invalid payload. 'encryptedBillKey' string is required.");
    }
    try {
        const keyId = randomUUID();
        const redisKey = `onetimekey:${keyId}`;
        await redisClient.set(redisKey, encryptedBillKey, 'EX', EXPIRATION_SECONDS);
        console.log(`Created one-time key with ID ${keyId}.`);
        return { keyId };
    } catch (e) {
        console.error('Redis error during one-time key creation:', e);
        throw new Error("A database error occurred while creating the one-time key.");
    }
}

/**
 * Atomically retrieves and deletes a one-time key.
 * @param keyId The ID of the key to retrieve.
 * @returns An object containing the retrieved encrypted key.
 */
async function retrieveOnetimeKey(keyId: string): Promise<{ encryptedBillKey: string }> {
    if (!keyId) {
        throw new Error("Missing 'keyId'.");
    }
    const redisKey = `onetimekey:${keyId}`;
    
    // Use a MULTI/EXEC transaction to atomically get and delete the key.
    const transaction = redisClient.multi();
    transaction.get(redisKey);
    transaction.del(redisKey);
    
    const [result] = await transaction.exec() as [[null | Error, string | null]];
    const encryptedBillKey = result[1];

    if (encryptedBillKey) {
        console.log(`One-time key ${keyId} retrieved and deleted.`);
        return { encryptedBillKey };
    } else {
        throw new Error("Invalid or expired key ID.");
    }
}

/**
 * Checks if a one-time key exists without consuming it. Throws an error if not found.
 * @param keyId The ID of the key to check.
 * @returns An object with the status 'available'.
 */
async function checkOnetimeKeyStatus(keyId: string): Promise<{ status: 'available' }> {
    if (!keyId) {
        throw new Error("Missing 'keyId'.");
    }
    const redisKey = `onetimekey:${keyId}`;
    const exists = await redisClient.exists(redisKey);
    if (!exists) {
        throw new Error("Key not found or already consumed.");
    }
    return { status: 'available' };
}


// --- Framework-Agnostic Handler ---
export const onetimeKeyHandler = async (req: HttpRequest): Promise<HttpResponse> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    if (req.method === "POST") {
        const { encryptedBillKey } = req.body;
        const result = await createOnetimeKey(encryptedBillKey);
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
            const result = await checkOnetimeKeyStatus(keyId);
            return {
                statusCode: 200,
                headers: responseHeaders,
                body: JSON.stringify(result),
            };
        }

        const result = await retrieveOnetimeKey(keyId);
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