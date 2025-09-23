// --- Crypto Service for E2E Encryption ---

const ALGORITHM = 'AES-GCM';
const KEY_OPTIONS: AesKeyGenParams = { name: ALGORITHM, length: 256 };
const KEY_EXTRACTABLE = true;
const KEY_USAGES: KeyUsage[] = ['encrypt', 'decrypt'];

/**
 * Generates a new AES-GCM cryptographic key.
 */
export const generateKey = async (): Promise<CryptoKey> => {
  return crypto.subtle.generateKey(KEY_OPTIONS, KEY_EXTRACTABLE, KEY_USAGES);
};

/**
 * Exports a CryptoKey to a JSON Web Key (JWK) format for transmission.
 * @param key The CryptoKey to export.
 */
export const exportKey = async (key: CryptoKey): Promise<JsonWebKey> => {
  return crypto.subtle.exportKey('jwk', key);
};

/**
 * Imports a JSON Web Key (JWK) into a CryptoKey object.
 * @param jwk The JWK object to import.
 */
export const importKey = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  return crypto.subtle.importKey('jwk', jwk, { name: ALGORITHM }, KEY_EXTRACTABLE, KEY_USAGES);
};

/**
 * Encrypts a string of data using a given CryptoKey.
 * @param data The string data to encrypt.
 * @param key The CryptoKey for encryption.
 * @returns A base64 encoded string containing the IV and the encrypted data.
 */
export const encrypt = async (data: string, key: CryptoKey): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV for GCM should be 12 bytes
  const encodedData = new TextEncoder().encode(data);

  const encryptedContent = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encodedData
  );

  const encryptedBytes = new Uint8Array(encryptedContent);
  // Prepend the IV to the ciphertext for use in decryption
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);

  // Convert the combined ArrayBuffer to a base64 string for easy transport
  return btoa(String.fromCharCode(...combined));
};

/**
 * Decrypts a base64 encoded string using a given CryptoKey.
 * @param encryptedData The base64 string containing the IV and ciphertext.
 * @param key The CryptoKey for decryption.
 * @returns The original decrypted string.
 */
export const decrypt = async (encryptedData: string, key: CryptoKey): Promise<string> => {
  // Decode the base64 string back to an ArrayBuffer
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decryptedContent = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedContent);
};
