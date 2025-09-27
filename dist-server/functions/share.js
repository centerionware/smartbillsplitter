var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// functions/share.ts
var share_exports = {};
__export(share_exports, {
  shareHandler: () => shareHandler
});
module.exports = __toCommonJS(share_exports);
var import_crypto = require("crypto");
var EXPIRATION_SECONDS = 30 * 24 * 60 * 60;
async function createOrUpdateShare(encryptedData, kv, shareId) {
  if (!encryptedData || typeof encryptedData !== "string") {
    throw new Error("Invalid payload. 'encryptedData' string is required.");
  }
  const now = Date.now();
  const newSessionPayload = {
    encryptedData,
    lastUpdatedAt: now
  };
  try {
    const idToUse = shareId || (0, import_crypto.randomUUID)();
    const key = `share:${idToUse}`;
    await kv.set(key, JSON.stringify(newSessionPayload), { EX: EXPIRATION_SECONDS });
    if (shareId) {
      console.log(`Upserted shared bill ${shareId}.`);
    } else {
      console.log(`Created new shared bill ${idToUse}.`);
    }
    return { shareId: idToUse, lastUpdatedAt: now };
  } catch (e) {
    console.error("KV error during share operation:", e);
    throw new Error("A database error occurred during the share operation.");
  }
}
async function retrieveShare(shareId, kv) {
  if (!shareId) {
    throw new Error("Missing 'shareId'.");
  }
  const key = `share:${shareId}`;
  const sessionJson = await kv.get(key);
  if (!sessionJson) {
    throw new Error("Invalid or expired share ID.");
  }
  const payload = JSON.parse(sessionJson);
  let encryptedContent = payload.encryptedData;
  if (!encryptedContent && payload.data) {
    encryptedContent = payload.data;
  }
  if (!encryptedContent || typeof encryptedContent !== "string") {
    throw new Error("Share session is corrupted and contains no valid data payload.");
  }
  if (!payload.lastUpdatedAt || typeof payload.lastUpdatedAt !== "number") {
    throw new Error("Share session is corrupted and is missing a timestamp.");
  }
  return {
    encryptedData: encryptedContent,
    lastUpdatedAt: payload.lastUpdatedAt
  };
}
async function retrieveBatchShares(checkPayload, kv) {
  if (!Array.isArray(checkPayload) || checkPayload.length === 0) {
    return [];
  }
  const updatedBills = [];
  for (const clientData of checkPayload) {
    const sessionJson = await kv.get(`share:${clientData.shareId}`);
    if (!sessionJson) continue;
    const serverPayload = JSON.parse(sessionJson);
    if (serverPayload.lastUpdatedAt > clientData.lastUpdatedAt) {
      const encryptedContent = serverPayload.encryptedData || serverPayload.data;
      if (encryptedContent) {
        updatedBills.push({
          shareId: clientData.shareId,
          encryptedData: encryptedContent,
          lastUpdatedAt: serverPayload.lastUpdatedAt
        });
      }
    }
  }
  return updatedBills;
}
var shareHandler = async (req, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (req.method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }
  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };
  try {
    if (req.method === "POST" && req.path.endsWith("/batch-check")) {
      const batchPayload = req.body;
      const result = await retrieveBatchShares(batchPayload, context.kv);
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }
    if (req.method === "POST") {
      const { shareId } = req.params;
      const { encryptedData } = req.body;
      const result = await createOrUpdateShare(encryptedData, context.kv, shareId);
      const statusCode = shareId ? 200 : 201;
      return {
        statusCode,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }
    if (req.method === "GET") {
      const { shareId } = req.params;
      if (!shareId) {
        throw new Error("Missing 'shareId' in path.");
      }
      const serverData = await retrieveShare(shareId, context.kv);
      const clientTimestampStr = req.query.lastUpdatedAt;
      if (clientTimestampStr) {
        const clientTimestamp = parseInt(clientTimestampStr, 10);
        if (!isNaN(clientTimestamp) && serverData.lastUpdatedAt <= clientTimestamp) {
          return {
            statusCode: 304,
            headers: responseHeaders
          };
        }
      }
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(serverData)
      };
    }
    return {
      statusCode: 405,
      headers: { ...responseHeaders, "Allow": "GET, POST, OPTIONS" },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  } catch (error) {
    let statusCode = 500;
    if (error.message.includes("not found or expired") || error.message.includes("Invalid or expired")) {
      statusCode = 404;
    } else if (error.message.includes("Invalid payload") || error.message.includes("Missing 'shareId'")) {
      statusCode = 400;
    }
    return {
      statusCode,
      headers: responseHeaders,
      body: JSON.stringify({ error: "An internal server error occurred.", details: error.message })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  shareHandler
});
