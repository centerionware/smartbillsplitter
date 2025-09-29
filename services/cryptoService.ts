// --- Crypto Service for E2E Encryption and Digital Signatures ---

// --- Symmetric Encryption (AES-GCM) ---
const SYMMETRIC_ALGORITHM = 'AES-GCM';
const SYMMETRIC_KEY_OPTIONS: AesKeyGenParams = { name: SYMMETRIC_ALGORITHM, length: 256 };
const SYMMETRIC_KEY_EXTRACTABLE = true;
const SYMMETRIC_KEY_USAGES: KeyUsage[] = ['encrypt', 'decrypt'];

// --- Asymmetric Signing (ECDSA) ---
const SIGNING_ALGORITHM: EcdsaParams = { name: 'ECDSA', hash: 'SHA-384' };
const SIGNING_KEY_OPTIONS: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-384' };
const SIGNING_KEY_EXTRACTABLE = true; // Allow exporting the public key
const SIGNING_KEY_USAGES: KeyUsage[] = ['sign', 'verify'];

/**
 * Converts a Uint8Array to a "binary string" (a string where each character's char code is a byte value),
 * which is the format required by the btoa function. This is a robust way to handle Unicode.
 * @param arr The Uint8Array to convert.
 */
const uint8ArrayToBinaryString = (arr: Uint8Array): string => {
  let binary = '';
  // This loop is more robust than `String.fromCharCode.apply` for large inputs on some JS engines.
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return binary;
};

/**
 * Decodes a standard or URL-safe Base64 string into a Uint8Array, with robust error handling.
 * @param base64Input The Base64 string (standard or URL-safe).
 * @throws An error with a specific message if decoding fails.
 */
function decodeBase64(base64Input: string): Uint8Array {
    // 1. Handle URL-safe characters by replacing them with standard Base64 equivalents.
    let base64 = base64Input.replace(/-/g, '+').replace(/_/g, '/');

    // 2. Add padding if it was stripped. Base64 strings should have a length divisible by 4.
    const padding = base64.length % 4;
    if (padding) {
        if (padding === 2) base64 += '==';
        else if (padding === 3) base64 += '=';
        // If padding is 1, the string is malformed anyway, and atob will throw.
    }

    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (e: any) {
        // This provides a much clearer error than the default 'atob' failure.
        if (e instanceof DOMException && e.name === 'InvalidCharacterError') {
            throw new Error("Failed to decode data. The Base64 string is corrupted or contains invalid characters.");
        }
        // Rethrow other errors with more context.
        throw new Error(`An unexpected error occurred during Base64 decoding: ${e.message}`);
    }
}


/**
 * Generates a new AES-GCM cryptographic key for symmetric encryption.
 */
export const generateEncryptionKey = async (): Promise<CryptoKey> => {
  return crypto.subtle.generateKey(SYMMETRIC_KEY_OPTIONS, SYMMETRIC_KEY_EXTRACTABLE, SYMMETRIC_KEY_USAGES);
};

/**
 * Exports a CryptoKey to a JSON Web Key (JWK) format for transmission.
 * @param key The CryptoKey to export.
 */
export const exportKey = async (key: CryptoKey): Promise<JsonWebKey> => {
  return crypto.subtle.exportKey('jwk', key);
};

/**
 * Imports a JSON Web Key (JWK) into a CryptoKey object for symmetric encryption.
 * @param jwk The JWK object to import.
 */
export const importEncryptionKey = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  return crypto.subtle.importKey('jwk', jwk, { name: SYMMETRIC_ALGORITHM }, SYMMETRIC_KEY_EXTRACTABLE, SYMMETRIC_KEY_USAGES);
};

/**
 * Encrypts a string of data using a given CryptoKey.
 * @param data The string or Uint8Array data to encrypt.
 * @param key The CryptoKey for encryption.
 * @returns A base64 encoded string containing the IV and the encrypted data.
 */
export const encrypt = async (data: string | Uint8Array, key: CryptoKey): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV for GCM should be 12 bytes
  const encodedData = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  // FIX: By calling .slice() on the Uint8Array, we create a shallow copy with a new,
  // guaranteed-standard ArrayBuffer. This resolves a TypeScript error where the buffer
  // was inferred as potentially being a SharedArrayBuffer, which is incompatible
  // with the Web Crypto API.
  const encryptedContent = await crypto.subtle.encrypt(
    { name: SYMMETRIC_ALGORITHM, iv },
    key,
    encodedData.slice()
  );

  const encryptedBytes = new Uint8Array(encryptedContent);
  // Prepend the IV to the ciphertext for use in decryption
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);

  // Convert the combined ArrayBuffer to a base64 string for easy transport
  return btoa(uint8ArrayToBinaryString(combined));
};

/**
 * Decrypts a base64 encoded string using a given CryptoKey.
 * @param encryptedData The base64 string containing the IV and ciphertext.
 * @param key The CryptoKey for decryption.
 * @returns The original decrypted data as a Uint8Array.
 */
export const decrypt = async (encryptedData: string, key: CryptoKey): Promise<Uint8Array> => {
  // Decode the base64 string back to an ArrayBuffer using the robust helper
  const combined = decodeBase64(encryptedData);
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // FIX: By calling .slice() on the Uint8Array, we create a shallow copy with a new,
  // guaranteed-standard ArrayBuffer. This resolves a TypeScript error where the buffer
  // was inferred as potentially being a SharedArrayBuffer, which is incompatible
  // with the Web Crypto API.
  const decryptedContent = await crypto.subtle.decrypt(
    { name: SYMMETRIC_ALGORITHM, iv },
    key,
    ciphertext.slice()
  );

  return new Uint8Array(decryptedContent);
};

// --- Digital Signature Functions ---

/**
 * Generates a new ECDSA key pair for digital signatures.
 */
export const generateSigningKeyPair = async (): Promise<CryptoKeyPair> => {
  return crypto.subtle.generateKey(SIGNING_KEY_OPTIONS, SIGNING_KEY_EXTRACTABLE, SIGNING_KEY_USAGES);
};

/**
 * Imports a public key from JWK format for verification.
 * @param jwk The public key in JWK format.
 */
export const importPublicKey = async (jwk: JsonWebKey): Promise<CryptoKey> => {
    return crypto.subtle.importKey('jwk', jwk, SIGNING_KEY_OPTIONS, true, ['verify']);
};

/**
 * Imports a private key from JWK format for signing.
 * @param jwk The private key in JWK format.
 */
export const importPrivateKey = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  return crypto.subtle.importKey('jwk', jwk, SIGNING_KEY_OPTIONS, true, ['sign']);
};


/**
 * Creates a digital signature for a given data string.
 * @param data The data to sign.
 * @param privateKey The private key to sign with.
 * @returns A base64 encoded signature string.
 */
export const sign = async (data: string, privateKey: CryptoKey): Promise<string> => {
  const encodedData = new TextEncoder().encode(data);
  // FIX: Use .slice() to prevent potential SharedArrayBuffer issues with the Web Crypto API.
  const signatureBuffer = await crypto.subtle.sign(SIGNING_ALGORITHM, privateKey, encodedData.slice());
  return btoa(uint8ArrayToBinaryString(new Uint8Array(signatureBuffer)));
};

/**
 * Verifies a digital signature against the original data.
 * @param data The original data that was signed.
 * @param signature The base64 encoded signature.
 * @param publicKey The public key to verify with.
 * @returns A boolean indicating if the signature is valid.
 */
export const verify = async (data: string, signature: string, publicKey: CryptoKey): Promise<boolean> => {
  const encodedData = new TextEncoder().encode(data);
  // Decode the signature using the robust helper
  const signatureBytes = decodeBase64(signature);

  // FIX: By calling .slice() on the Uint8Arrays, we create shallow copies with new,
  // guaranteed-standard ArrayBuffers. This resolves a TypeScript error where the buffers
  // were inferred as potentially being SharedArrayBuffers, which are incompatible
  // with the Web Crypto API.
  return crypto.subtle.verify(
    SIGNING_ALGORITHM,
    publicKey,
    signatureBytes.slice(),
    encodedData.slice()
  );
};