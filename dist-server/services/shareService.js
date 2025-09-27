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

// services/shareService.ts
var shareService_exports = {};
__export(shareService_exports, {
  encryptAndSignPayload: () => encryptAndSignPayload,
  generateAggregateBill: () => generateAggregateBill,
  generateOneTimeShareLink: () => generateOneTimeShareLink,
  generateShareLink: () => generateShareLink,
  generateShareText: () => generateShareText,
  recreateShareSession: () => recreateShareSession
});
module.exports = __toCommonJS(shareService_exports);

// services/cryptoService.ts
var SYMMETRIC_ALGORITHM = "AES-GCM";
var SYMMETRIC_KEY_OPTIONS = { name: SYMMETRIC_ALGORITHM, length: 256 };
var SYMMETRIC_KEY_EXTRACTABLE = true;
var SYMMETRIC_KEY_USAGES = ["encrypt", "decrypt"];
var SIGNING_ALGORITHM = { name: "ECDSA", hash: "SHA-384" };
var SIGNING_KEY_OPTIONS = { name: "ECDSA", namedCurve: "P-384" };
var SIGNING_KEY_EXTRACTABLE = true;
var SIGNING_KEY_USAGES = ["sign", "verify"];
var uint8ArrayToBinaryString = (arr) => {
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return binary;
};
var generateEncryptionKey = async () => {
  return crypto.subtle.generateKey(SYMMETRIC_KEY_OPTIONS, SYMMETRIC_KEY_EXTRACTABLE, SYMMETRIC_KEY_USAGES);
};
var exportKey = async (key) => {
  return crypto.subtle.exportKey("jwk", key);
};
var importEncryptionKey = async (jwk) => {
  return crypto.subtle.importKey("jwk", jwk, { name: SYMMETRIC_ALGORITHM }, SYMMETRIC_KEY_EXTRACTABLE, SYMMETRIC_KEY_USAGES);
};
var encrypt = async (data, key) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  const encryptedContent = await crypto.subtle.encrypt(
    { name: SYMMETRIC_ALGORITHM, iv },
    key,
    encodedData
  );
  const encryptedBytes = new Uint8Array(encryptedContent);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);
  return btoa(uint8ArrayToBinaryString(combined));
};
var generateSigningKeyPair = async () => {
  return crypto.subtle.generateKey(SIGNING_KEY_OPTIONS, SIGNING_KEY_EXTRACTABLE, SIGNING_KEY_USAGES);
};
var sign = async (data, privateKey) => {
  const encodedData = new TextEncoder().encode(data);
  const signatureBuffer = await crypto.subtle.sign(SIGNING_ALGORITHM, privateKey, encodedData);
  return btoa(uint8ArrayToBinaryString(new Uint8Array(signatureBuffer)));
};

// services/db.ts
var DB_NAME = "SmartBillSplitterDB";
var DB_VERSION = 10;
var STORES = {
  BILLS: "bills",
  RECURRING_BILLS: "recurring_bills",
  IMPORTED_BILLS: "imported_bills",
  SETTINGS: "settings",
  THEME: "theme",
  SUBSCRIPTION: "subscription",
  SUBSCRIPTION_DETAILS: "subscription_details",
  CRYPTO_KEYS: "crypto_keys",
  // Note: This is now legacy and unused.
  BILL_SIGNING_KEYS: "bill_signing_keys",
  MANAGED_PAYPAL_SUBSCRIPTIONS: "managed_paypal_subscriptions"
};
var db;
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      switch (event.oldVersion) {
        case 0:
          dbInstance.createObjectStore(STORES.BILLS, { keyPath: "id" });
          dbInstance.createObjectStore(STORES.RECURRING_BILLS, { keyPath: "id" });
          dbInstance.createObjectStore(STORES.IMPORTED_BILLS, { keyPath: "id" });
          dbInstance.createObjectStore(STORES.SETTINGS);
          dbInstance.createObjectStore(STORES.THEME);
          dbInstance.createObjectStore(STORES.SUBSCRIPTION);
          dbInstance.createObjectStore(STORES.SUBSCRIPTION_DETAILS);
          dbInstance.createObjectStore(STORES.BILL_SIGNING_KEYS, { keyPath: "billId" });
        // Note: STORES.CRYPTO_KEYS is legacy and intentionally not created.
        // Fallthrough for upgrades: cases below will run for new users as well.
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
          if (!dbInstance.objectStoreNames.contains(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS)) {
            dbInstance.createObjectStore(STORES.MANAGED_PAYPAL_SUBSCRIPTIONS);
          }
      }
    };
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };
    request.onerror = (event) => {
      console.error("Database error:", event.target.error);
      reject("Error opening database.");
    };
  });
}
async function getStore(storeName, mode) {
  if (!db) await initDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}
async function get(storeName, key) {
  const store = await getStore(storeName, "readonly");
  return promisifyRequest(store.get(key));
}
async function set(storeName, value, key) {
  const store = await getStore(storeName, "readwrite");
  await promisifyRequest(store.put(value, key));
}
var saveBillSigningKey = (billId, privateKey) => set(STORES.BILL_SIGNING_KEYS, { billId, privateKey });
var getBillSigningKey = (billId) => get(STORES.BILL_SIGNING_KEYS, billId);

// services/api.ts
var API_BASE_URL = null;
var getApiUrl = (path) => {
  if (API_BASE_URL === null) {
    console.error("getApiUrl() was called before initializeApi() completed. This is not recommended. Falling back to relative path.");
    return path;
  }
  if (API_BASE_URL === "") {
    const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
    return sanitizedPath;
  }
  return new URL(path, API_BASE_URL).toString();
};

// services/shareService.ts
function utf8ToBinaryString(str) {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(str);
  let binaryString = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  return binaryString;
}
function base64UrlEncode(str) {
  return btoa(utf8ToBinaryString(str)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
var generateShareText = (participantName, totalOwed, billsInfo, settings, subscriptionStatus) => {
  const billList = billsInfo.map((b) => `- "${b.description}": $${b.amountOwed.toFixed(2)}`).join("\n");
  const { paymentDetails, shareTemplate } = settings;
  let paymentInfo = "";
  const paymentMethods = [];
  if (paymentDetails.venmo) paymentMethods.push(`Venmo: @${paymentDetails.venmo}`);
  if (paymentDetails.paypal) paymentMethods.push(`PayPal: ${paymentDetails.paypal}`);
  if (paymentDetails.cashApp) paymentMethods.push(`Cash App: $${paymentDetails.cashApp}`);
  if (paymentDetails.zelle) paymentMethods.push(`Zelle: ${paymentDetails.zelle}`);
  if (paymentMethods.length > 0) {
    paymentInfo = `

You can pay me via ${paymentMethods.join(" or ")}.`;
  }
  if (paymentDetails.customMessage) {
    paymentInfo += paymentInfo ? `

${paymentDetails.customMessage}` : `

${paymentDetails.customMessage}`;
  }
  let promoText = "";
  if (subscriptionStatus === "free") {
    let appUrl = "https://sharedbills.app";
    try {
      const constructedUrl = new URL("/", window.location.href).href;
      appUrl = constructedUrl.endsWith("/") ? constructedUrl.slice(0, -1) : constructedUrl;
    } catch (e) {
      console.warn("Could not determine app URL from context.");
    }
    promoText = `

Created with SharedBills: ${appUrl}`;
  }
  return shareTemplate.replace("{participantName}", participantName).replace("{totalOwed}", `$${totalOwed.toFixed(2)}`).replace("{billList}", billList).replace("{paymentInfo}", paymentInfo).replace("{promoText}", promoText);
};
var generateAggregateBill = (participantName, unpaidBills, settings) => {
  const totalOwed = unpaidBills.reduce((sum, bill) => {
    const p = bill.participants.find((p2) => p2.name === participantName);
    return sum + (p?.amountOwed || 0);
  }, 0);
  const items = unpaidBills.map((bill) => {
    const p = bill.participants.find((p2) => p2.name === participantName);
    return {
      id: bill.id,
      name: bill.description,
      price: p?.amountOwed || 0,
      assignedTo: []
      // Not relevant for summary
    };
  });
  const summaryParticipant = {
    id: "summary-participant-1",
    name: participantName,
    amountOwed: totalOwed,
    paid: false
  };
  return {
    id: `summary-${Date.now()}`,
    description: `Summary for ${participantName}`,
    totalAmount: totalOwed,
    date: (/* @__PURE__ */ new Date()).toISOString(),
    participants: [summaryParticipant],
    items,
    status: "active"
  };
};
var generateOneTimeShareLink = async (bill, settings) => {
  const signingKeyPair = await generateSigningKeyPair();
  const signingPublicKeyJwk = await exportKey(signingKeyPair.publicKey);
  const billEncryptionKey = await generateEncryptionKey();
  const encryptedData = await encryptAndSignPayload(bill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey);
  const shareResponse = await fetch(getApiUrl("/share"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encryptedData })
  });
  const shareResult = await shareResponse.json();
  if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
  const { shareId } = shareResult;
  const participantId = bill.participants[0].id;
  const encryptedParticipantId = await encrypt(participantId, billEncryptionKey);
  const urlSafeEncryptedParticipantId = encryptedParticipantId.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const fragmentKey = await generateEncryptionKey();
  const billEncryptionKeyJwk = await exportKey(billEncryptionKey);
  const encryptedBillKey = await encrypt(JSON.stringify(billEncryptionKeyJwk), fragmentKey);
  const keyResponse = await fetch(getApiUrl("/onetime-key"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encryptedBillKey })
  });
  const keyResult = await keyResponse.json();
  if (!keyResponse.ok) throw new Error(keyResult.error || "Failed to create one-time key session.");
  const { keyId } = keyResult;
  const fragmentKeyJwk = await exportKey(fragmentKey);
  const encodedFragmentKey = base64UrlEncode(JSON.stringify(fragmentKeyJwk));
  const url = new URL(window.location.href);
  url.hash = `#/view-bill?shareId=${shareId}&keyId=${keyId}&fragmentKey=${encodedFragmentKey}&p=${urlSafeEncryptedParticipantId}`;
  return url.toString();
};
var generateShareLink = async (bill, participantId, settings, updateBillCallback) => {
  let updatedBill = JSON.parse(JSON.stringify(bill));
  let needsDBUpdate = false;
  if (updatedBill.shareInfo) {
    try {
      const res = await fetch(getApiUrl(`/share/${updatedBill.shareInfo.shareId}`), {
        method: "GET",
        signal: AbortSignal.timeout(4e3)
        // Use a timeout to prevent long waits
      });
      if (res.status === 404) {
        console.warn(`Share session for bill ${updatedBill.id} not found on server. Recreating...`);
        updatedBill = await recreateShareSession(updatedBill, settings, updateBillCallback);
      } else if (!res.ok) {
        throw new Error(`Failed to verify existing share session. Status: ${res.status}`);
      }
    } catch (error) {
      console.error("Could not verify share session:", error);
      if (error.name === "AbortError") {
        throw new Error("Could not connect to the server to verify the share link. Please check your connection and try again.");
      }
      throw new Error(error.message || "An unexpected error occurred while verifying the share link.");
    }
  }
  if (!updatedBill.shareInfo) {
    needsDBUpdate = true;
    const signingKeyPair = await generateSigningKeyPair();
    await saveBillSigningKey(updatedBill.id, signingKeyPair.privateKey);
    const signingPublicKeyJwk = await exportKey(signingKeyPair.publicKey);
    const billEncryptionKey2 = await generateEncryptionKey();
    const billEncryptionKeyJwk = await exportKey(billEncryptionKey2);
    const encryptedData = await encryptAndSignPayload(updatedBill, settings, signingKeyPair.privateKey, signingPublicKeyJwk, billEncryptionKey2);
    const shareResponse = await fetch(getApiUrl("/share"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedData })
    });
    const shareResult = await shareResponse.json();
    if (!shareResponse.ok) throw new Error(shareResult.error || "Failed to create share session.");
    updatedBill.shareInfo = {
      shareId: shareResult.shareId,
      encryptionKey: billEncryptionKeyJwk,
      signingPublicKey: signingPublicKeyJwk
    };
  }
  if (!updatedBill.participantShareInfo) {
    updatedBill.participantShareInfo = {};
  }
  const existingShareInfo = updatedBill.participantShareInfo[participantId];
  const now = Date.now();
  let keyIsAvailableOnServer = false;
  if (existingShareInfo && now < existingShareInfo.expires) {
    try {
      const statusResponse = await fetch(getApiUrl(`/onetime-key/${existingShareInfo.keyId}/status`));
      if (statusResponse.ok) {
        const { status } = await statusResponse.json();
        if (status === "available") {
          keyIsAvailableOnServer = true;
        }
      }
    } catch (e) {
      console.error("Failed to check key status, will generate a new one.", e);
      keyIsAvailableOnServer = false;
    }
  }
  if (!keyIsAvailableOnServer) {
    needsDBUpdate = true;
    const billEncryptionKey2 = await importEncryptionKey(updatedBill.shareInfo.encryptionKey);
    const fragmentKey = await generateEncryptionKey();
    const billEncryptionKeyJwk = await exportKey(billEncryptionKey2);
    const encryptedBillKey = await encrypt(JSON.stringify(billEncryptionKeyJwk), fragmentKey);
    const keyResponse = await fetch(getApiUrl("/onetime-key"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedBillKey })
    });
    const keyResult = await keyResponse.json();
    if (!keyResponse.ok) throw new Error(keyResult.error || "Failed to create one-time key session.");
    const newFragmentKeyJwk = await exportKey(fragmentKey);
    updatedBill.participantShareInfo[participantId] = {
      keyId: keyResult.keyId,
      fragmentKey: newFragmentKeyJwk,
      expires: now + 5 * 60 * 1e3
      // 5 minute client-side expiry
    };
  }
  if (needsDBUpdate) {
    await updateBillCallback(updatedBill);
  }
  const billEncryptionKey = await importEncryptionKey(updatedBill.shareInfo.encryptionKey);
  const encryptedParticipantId = await encrypt(participantId, billEncryptionKey);
  const urlSafeEncryptedParticipantId = encryptedParticipantId.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const finalShareInfo = updatedBill.participantShareInfo[participantId];
  const encodedFragmentKey = base64UrlEncode(JSON.stringify(finalShareInfo.fragmentKey));
  const url = new URL(window.location.href);
  url.hash = `#/view-bill?shareId=${updatedBill.shareInfo.shareId}&keyId=${finalShareInfo.keyId}&fragmentKey=${encodedFragmentKey}&p=${urlSafeEncryptedParticipantId}`;
  return url.toString();
};
async function encryptAndSignPayload(bill, settings, privateKey, publicKeyJwk, encryptionKey) {
  const { participantShareInfo, ...billForPayload } = bill;
  const signature = await sign(JSON.stringify(billForPayload), privateKey);
  const payload = {
    bill: billForPayload,
    creatorName: settings.myDisplayName,
    publicKey: publicKeyJwk,
    signature,
    paymentDetails: settings.paymentDetails
  };
  return encrypt(JSON.stringify(payload), encryptionKey);
}
var recreateShareSession = async (bill, settings, updateBillCallback) => {
  let updatedBill = JSON.parse(JSON.stringify(bill));
  const existingShareInfo = updatedBill.shareInfo;
  const keyRecord = await getBillSigningKey(updatedBill.id);
  if (!existingShareInfo?.shareId || !existingShareInfo.encryptionKey || !existingShareInfo.signingPublicKey || !keyRecord) {
    console.error("Cannot recreate share session: Existing keys or shareId are missing.", { billId: updatedBill.id });
    throw new Error("Cannot re-sync bill because its original sharing keys or ID are missing.");
  }
  const { shareId, encryptionKey: encryptionKeyJwk, signingPublicKey: signingPublicKeyJwk } = existingShareInfo;
  const { privateKey } = keyRecord;
  const billEncryptionKey = await importEncryptionKey(encryptionKeyJwk);
  delete updatedBill.participantShareInfo;
  const encryptedData = await encryptAndSignPayload(updatedBill, settings, privateKey, signingPublicKeyJwk, billEncryptionKey);
  const shareResponse = await fetch(getApiUrl(`/share/${shareId}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encryptedData })
  });
  const shareResult = await shareResponse.json();
  if (!shareResponse.ok) {
    throw new Error(shareResult.error || `Failed to revive the share session on the server for shareId: ${shareId}.`);
  }
  await updateBillCallback(updatedBill);
  return updatedBill;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  encryptAndSignPayload,
  generateAggregateBill,
  generateOneTimeShareLink,
  generateShareLink,
  generateShareText,
  recreateShareSession
});
