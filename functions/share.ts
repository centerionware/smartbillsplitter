import { randomUUID } from 'crypto';
import redisClient from '../services/redisClient.ts';
import { HttpRequest, HttpResponse } from '../http-types.ts';

const EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

// --- Business Logic ---
// These functions contain the core logic for share sessions and are independent of the server framework.

/**
 * Creates a new share session or updates an existing one (upsert).
 * @param encryptedData The encrypted data payload.
 * @param shareId Optional ID for creating/updating a specific share. If not provided, a new UUID is generated.
 * @returns An object with the share ID and last update timestamp.
 */
async function createOrUpdateShare(encryptedData: string, shareId?: string): Promise<{ shareId: string; lastUpdatedAt: number }> {
    if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error("Invalid payload. 'encryptedData' string is required.");
    }
    const now = Date.now();
    
    const newSessionPayload = {
        encryptedData,
        lastUpdatedAt: now,
    };

    try {
        const idToUse = shareId || randomUUID();
        const key = `share:${idToUse}`;
        await redisClient.set(key, JSON.stringify(newSessionPayload), 'EX', EXPIRATION_SECONDS);

        if (shareId) {
            console.log(`Upserted shared bill ${shareId}.`);
        } else {
            console.log(`Created new shared bill ${idToUse}.`);
        }
        return { shareId: idToUse, lastUpdatedAt: now };
    } catch (e: any) {
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

/**
 * Efficiently retrieves multiple share sessions, returning only those that have been updated.
 * @param checkPayload An array of objects, each with a shareId and the client's lastUpdatedAt timestamp.
 * @returns A promise resolving to an array of full share payloads for only the updated bills.
 */
async function retrieveBatchShares(
  checkPayload: { shareId: string; lastUpdatedAt: number }[]
): Promise<{ shareId: string; encryptedData: string; lastUpdatedAt: number }[]> {
  if (!Array.isArray(checkPayload) || checkPayload.length === 0) {
    return [];
  }

  // Create Redis keys for all requested shareIds
  const keys = checkPayload.map(p => `share:${p.shareId}`);
  const results = await redisClient.mget(keys);

  const updatedBills: { shareId: string; encryptedData: string; lastUpdatedAt: number }[] = [];

  results.forEach((sessionJson, index) => {
    if (!sessionJson) return; // This bill was not found or expired

    const clientData = checkPayload[index];
    const serverPayload = JSON.parse(sessionJson);

    // Check if the server's data is newer than the client's
    if (serverPayload.lastUpdatedAt > clientData.lastUpdatedAt) {
        let encryptedContent = serverPayload.encryptedData || serverPayload.data;
        if (encryptedContent) {
             updatedBills.push({
                shareId: clientData.shareId,
                encryptedData: encryptedContent,
                lastUpdatedAt: serverPayload.lastUpdatedAt,
            });
        }
    }
  });

  return updatedBills;
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
    // Handle the new batch check endpoint: POST /share/batch-check
    if (req.method === "POST" && req.path.endsWith('/batch-check')) {
        const batchPayload = req.body;
        const result = await retrieveBatchShares(batchPayload);
        return {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify(result)
        };
    }
      
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

        // Retrieve the full data from Redis. retrieveShare handles 404s if not found.
        const serverData = await retrieveShare(shareId);
        
        // Check if the client sent its last known timestamp.
        const clientTimestampStr = req.query.lastUpdatedAt as string;
        if (clientTimestampStr) {
            const clientTimestamp = parseInt(clientTimestampStr, 10);
            // If client's data is current, send 304 Not Modified.
            if (!isNaN(clientTimestamp) && serverData.lastUpdatedAt <= clientTimestamp) {
                return {
                    statusCode: 304,
                    headers: responseHeaders,
                };
            }
        }

        // Otherwise, send the full, updated payload.
        return {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify(serverData)
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