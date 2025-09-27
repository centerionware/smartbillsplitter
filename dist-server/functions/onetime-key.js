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

// functions/onetime-key.ts
var onetime_key_exports = {};
__export(onetime_key_exports, {
  onetimeKeyHandler: () => onetimeKeyHandler
});
module.exports = __toCommonJS(onetime_key_exports);
var import_crypto = require("crypto");
var EXPIRATION_SECONDS = 24 * 60 * 60;
async function createOnetimeKey(encryptedBillKey, kv) {
  if (!encryptedBillKey || typeof encryptedBillKey !== "string") {
    throw new Error("Invalid payload. 'encryptedBillKey' string is required.");
  }
  try {
    const keyId = (0, import_crypto.randomUUID)();
    const redisKey = `onetimekey:${keyId}`;
    const payload = JSON.stringify({ encryptedBillKey });
    await kv.set(redisKey, payload, { EX: EXPIRATION_SECONDS });
    console.log(`Created one-time key with ID ${keyId}.`);
    return { keyId };
  } catch (e) {
    console.error("KV error during one-time key creation:", e);
    throw new Error("A database error occurred while creating the one-time key.");
  }
}
async function retrieveOnetimeKey(keyId, kv) {
  if (!keyId) {
    throw new Error("Missing 'keyId'.");
  }
  const redisKey = `onetimekey:${keyId}`;
  const payloadJson = await kv.get(redisKey);
  if (payloadJson) {
    await kv.del(redisKey);
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
async function checkOnetimeKeyStatus(keyId, kv) {
  if (!keyId) {
    throw new Error("Missing 'keyId'.");
  }
  const redisKey = `onetimekey:${keyId}`;
  const exists = await kv.exists(redisKey);
  if (!exists) {
    throw new Error("Key not found or already consumed.");
  }
  return { status: "available" };
}
var onetimeKeyHandler = async (req, context) => {
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
      if (action === "status") {
        const result2 = await checkOnetimeKeyStatus(keyId, context.kv);
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify(result2)
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
      headers: { ...responseHeaders, "Allow": "GET, POST, OPTIONS" },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  } catch (error) {
    let statusCode = 500;
    if (error.message.includes("Invalid or expired") || error.message.includes("Key not found or already consumed.")) {
      statusCode = 404;
    } else if (error.message.includes("Invalid payload") || error.message.includes("Missing 'keyId'")) {
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
  onetimeKeyHandler
});
