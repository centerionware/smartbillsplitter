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

// services/cryptoService.ts
var cryptoService_exports = {};
__export(cryptoService_exports, {
  decrypt: () => decrypt,
  encrypt: () => encrypt,
  exportKey: () => exportKey,
  generateEncryptionKey: () => generateEncryptionKey,
  generateSigningKeyPair: () => generateSigningKeyPair,
  importEncryptionKey: () => importEncryptionKey,
  importPublicKey: () => importPublicKey,
  sign: () => sign,
  verify: () => verify
});
module.exports = __toCommonJS(cryptoService_exports);
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
function decodeBase64(base64Input) {
  let base64 = base64Input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  if (padding) {
    if (padding === 2) base64 += "==";
    else if (padding === 3) base64 += "=";
  }
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    if (e instanceof DOMException && e.name === "InvalidCharacterError") {
      throw new Error("Failed to decode data. The Base64 string is corrupted or contains invalid characters.");
    }
    throw new Error(`An unexpected error occurred during Base64 decoding: ${e.message}`);
  }
}
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
var decrypt = async (encryptedData, key) => {
  const combined = decodeBase64(encryptedData);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decryptedContent = await crypto.subtle.decrypt(
    { name: SYMMETRIC_ALGORITHM, iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decryptedContent);
};
var generateSigningKeyPair = async () => {
  return crypto.subtle.generateKey(SIGNING_KEY_OPTIONS, SIGNING_KEY_EXTRACTABLE, SIGNING_KEY_USAGES);
};
var importPublicKey = async (jwk) => {
  return crypto.subtle.importKey("jwk", jwk, SIGNING_KEY_OPTIONS, true, ["verify"]);
};
var sign = async (data, privateKey) => {
  const encodedData = new TextEncoder().encode(data);
  const signatureBuffer = await crypto.subtle.sign(SIGNING_ALGORITHM, privateKey, encodedData);
  return btoa(uint8ArrayToBinaryString(new Uint8Array(signatureBuffer)));
};
var verify = async (data, signature, publicKey) => {
  const encodedData = new TextEncoder().encode(data);
  const signatureBytes = decodeBase64(signature);
  return crypto.subtle.verify(SIGNING_ALGORITHM, publicKey, signatureBytes.slice(), encodedData.slice());
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  decrypt,
  encrypt,
  exportKey,
  generateEncryptionKey,
  generateSigningKeyPair,
  importEncryptionKey,
  importPublicKey,
  sign,
  verify
});
