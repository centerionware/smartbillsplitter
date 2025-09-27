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

// functions/sync.ts
var sync_exports = {};
__export(sync_exports, {
  syncHandler: () => syncHandler
});
module.exports = __toCommonJS(sync_exports);
var EXPIRATION_SECONDS = 5 * 60;
var generateCode = async (kv) => {
  let code;
  let exists;
  do {
    code = Math.floor(1e5 + Math.random() * 9e5).toString();
    exists = await kv.exists(`sync:${code}`);
  } while (exists);
  return code;
};
async function createSyncSession(encryptedData, kv) {
  if (!encryptedData || typeof encryptedData !== "string") {
    throw new Error("Invalid payload. 'encryptedData' string is required.");
  }
  try {
    const code = await generateCode(kv);
    await kv.set(`sync:${code}`, encryptedData, { EX: EXPIRATION_SECONDS });
    console.log(`Created sync session ${code}.`);
    return { code };
  } catch (e) {
    console.error("KV error during sync session creation:", e);
    throw new Error("Could not create sync session due to a database error.");
  }
}
async function retrieveSyncSession(code, kv) {
  if (!code) {
    throw new Error("Missing 'code' parameter.");
  }
  const key = `sync:${code}`;
  const encryptedData = await kv.get(key);
  if (!encryptedData) {
    throw new Error("Invalid or expired code.");
  }
  await kv.del(key);
  console.log(`Sync session ${code} retrieved and deleted.`);
  return { encryptedData };
}
var syncHandler = async (req, context) => {
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
      const { encryptedData } = req.body;
      const result = await createSyncSession(encryptedData, context.kv);
      return {
        statusCode: 201,
        headers: responseHeaders,
        body: JSON.stringify(result)
      };
    }
    if (req.method === "GET") {
      const code = req.query.code;
      const result = await retrieveSyncSession(code, context.kv);
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
    if (error.message.includes("Invalid or expired")) {
      statusCode = 404;
    } else if (error.message.includes("Invalid payload") || error.message.includes("Missing 'code'")) {
      statusCode = 400;
    }
    return {
      statusCode,
      headers: responseHeaders,
      body: JSON.stringify({ error: error.message, details: error.message })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  syncHandler
});
