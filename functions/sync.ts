import { HttpRequest, HttpResponse } from '../http-types.ts';
import type { KeyValueStore } from '../services/keyValueStore.ts';

const EXPIRATION_SECONDS = 5 * 60; // 5 minutes

/**
 * Generates a unique 6-digit code, ensuring it doesn't already exist in the KV store.
 */
const generateCode = async (kv: KeyValueStore): Promise<string> => {
  let code: string;
  let exists: boolean;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    exists = await kv.exists(`sync:${code}`);
  } while (exists);
  return code;
};


// --- Business Logic ---
// These functions contain the core logic for sync sessions and are independent of the server framework.

/**
 * Creates a new sync session, storing encrypted data and returning a unique code.
 * @param encryptedData The encrypted data payload from the client.
 * @param kv The KeyValueStore instance to use for storage.
 * @returns An object containing the generated sync code.
 */
async function createSyncSession(encryptedData: string, kv: KeyValueStore): Promise<{ code: string }> {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error("Invalid payload. 'encryptedData' string is required.");
  }
  
  try {
    const code = await generateCode(kv);
    await kv.set(`sync:${code}`, encryptedData, { EX: EXPIRATION_SECONDS });
    console.log(`Created sync session ${code}.`);
    return { code };
  } catch(e) {
      console.error('KV error during sync session creation:', e);
      throw new Error("Could not create sync session due to a database error.");
  }
}

/**
 * Retrieves and deletes data from a sync session.
 * @param code The 6-digit sync code.
 * @param kv The KeyValueStore instance to use for storage.
 * @returns An object containing the retrieved encrypted data.
 */
async function retrieveSyncSession(code: string, kv: KeyValueStore): Promise<{ encryptedData: string }> {
    if (!code) {
        throw new Error("Missing 'code' parameter.");
    }

    const key = `sync:${code}`;
    const encryptedData = await kv.get(key);

    if (!encryptedData) {
        throw new Error("Invalid or expired code.");
    }
    
    // Data is for one-time use. Delete it immediately after retrieval.
    await kv.del(key);
    console.log(`Sync session ${code} retrieved and deleted.`);
    
    return { encryptedData };
}

// --- Framework-Agnostic Handler ---
export const syncHandler = async (req: HttpRequest, context: { kv: KeyValueStore }): Promise<HttpResponse> => {
  const corsHeaders = {
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
      const { encryptedData } = req.body;
      const result = await createSyncSession(encryptedData, context.kv);
      return {
        statusCode: 201,
        headers: responseHeaders,
        body: JSON.stringify(result),
      };
    }

    if (req.method === "GET") {
      const code = req.query.code as string;
      const result = await retrieveSyncSession(code, context.kv);
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result),
      };
    }
    
    return {
      statusCode: 405,
      headers: { ...responseHeaders, 'Allow': 'GET, POST, OPTIONS' },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };

  } catch (error: any) {
    let statusCode = 500;
    if (error.message.includes("Invalid or expired")) {
        statusCode = 404;
    } else if (error.message.includes("Invalid payload") || error.message.includes("Missing 'code'")) {
        statusCode = 400;
    }
    
    return {
      statusCode: statusCode,
      headers: responseHeaders,
      body: JSON.stringify({ error: error.message, details: error.message }),
    };
  }
};