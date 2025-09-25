import { randomUUID } from 'crypto';
import redisClient from '../services/redisClient.ts';
import { HttpRequest, HttpResponse } from '../http-types.ts';

const EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

// --- Business Logic ---
// These functions contain the core logic for share sessions and are independent of the server framework.

/**
 * Creates a new share session or updates an existing one.
 * @param encryptedData The encrypted data payload.
 * @param shareId Optional ID for updating an existing share.
 * @returns An object with the share ID and last update timestamp.
 */
async function createOrUpdateShare(encryptedData: string, shareId?: string): Promise<{ shareId: string; lastUpdatedAt: number }> {
    if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error("Invalid payload. 'encryptedData' string is required.");
    }
    const now = Date.now();
    
    try {
        // The session data must use 'encryptedData' to be compatible with the client.
        const sessionData = { encryptedData, lastUpdatedAt: now };
        if (shareId) { // UPDATE
            const key = `share:${shareId}`;
            if (!(await redisClient.exists(key))) {
                throw new Error("Cannot update. Share session not found or expired.");
            }
            await redisClient.set(key, JSON.stringify(sessionData), 'EX', EXPIRATION_SECONDS);
            console.log(`Updated shared bill ${shareId}.`);
            return { shareId, lastUpdatedAt: now };
        } else { // CREATE
            const id = randomUUID();
            const key = `share:${id}`;
            await redisClient.set(key, JSON.stringify(sessionData), 'EX', EXPIRATION_SECONDS);
            console.log(`Created shared bill ${id}.`);
            return { shareId: id, lastUpdatedAt: now };
        }
    } catch (e: any) {
        // If it's one of our thrown errors, rethrow it. Otherwise, wrap it.
        if (e.message.startsWith("Cannot update")) throw e;
        console.error('Redis error during share operation:', e);
        throw new Error("A database error occurred during the share operation.");
    }
}

/**
 * Retrieves data from a share session.
 * This is backward-compatible and handles payloads that may use the legacy `data` key.
 * @param shareId The ID of the share to retrieve.
 * @returns An object containing the encrypted data and last update timestamp.
 */
async function retrieveShare(shareId: string): Promise<{ encryptedData: string; lastUpdatedAt: number }> {
    if (!shareId) {
        throw new Error("Missing 'shareId'.");
    }
    const key = `share:${shareId}`;
    const sessionJson = await redisClient.get(key);

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

// --- Framework-Agnostic Handler ---
export const shareHandler = async (req: HttpRequest): Promise<HttpResponse> => {
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
      const { shareId } = req.params;
      const { encryptedData } = req.body;
      const result = await createOrUpdateShare(encryptedData, shareId);
      const statusCode = shareId ? 200 : 201; // OK for update, Created for new
      return {
        statusCode: statusCode,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }
  
    if (req.method === "GET") {
      const { shareId } = req.params;
      if (!shareId) {
        throw new Error("Missing 'shareId' in path.");
      }
      const result = await retrieveShare(shareId);
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
    if (error.message.includes("not found or expired") || error.message.includes("Invalid or expired")) {
        statusCode = 404;
    } else if (error.message.includes("Invalid payload") || error.message.includes("Missing 'shareId'")) {
        statusCode = 400;
    }
    
    return {
      statusCode: statusCode,
      headers: responseHeaders,
      body: JSON.stringify({ error: "An internal server error occurred.", details: error.message })
    };
  }
};