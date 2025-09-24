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
 * @param data The string data to encrypt.
 * @param key The CryptoKey for encryption.
 * @returns A base64 encoded string containing the IV and the encrypted data.
 */
export const encrypt = async (data: string, key: CryptoKey): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV for GCM should be 12 bytes
  const encodedData = new TextEncoder().encode(data);

  const encryptedContent = await crypto.subtle.encrypt(
    { name: SYMMETRIC_ALGORITHM, iv },
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
    { name: SYMMETRIC_ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedContent);
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
}

/**
 * Signs a string of data with a private key.
 * @param data The string data to sign.
 * @param privateKey The private CryptoKey for signing.
 * @returns A base64 encoded signature.
 */
export const sign = async (data: string, privateKey: CryptoKey): Promise<string> => {
  const encodedData = new TextEncoder().encode(data);
  const signatureBuffer = await crypto.subtle.sign(SIGNING_ALGORITHM, privateKey, encodedData);
  const signatureBytes = new Uint8Array(signatureBuffer);
  return btoa(String.fromCharCode(...signatureBytes));
};

/**
 * Verifies a signature against data using a public key.
 * @param data The original string data that was signed.
 * @param signatureB64 The base64 encoded signature.
 * @param publicKey The public CryptoKey for verification.
 * @returns A boolean indicating if the signature is valid.
 */
export const verify = async (data: string, signatureB64: string, publicKey: CryptoKey): Promise<boolean> => {
  const encodedData = new TextEncoder().encode(data);
  const signatureBytes = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  return crypto.subtle.verify(SIGNING_ALGORITHM, publicKey, signatureBytes, encodedData);
};